/**
 * Boot, persistence and live loop for the demo installation.
 *
 * The full operational state is snapshotted to IndexedDB (debounced) so a page
 * reload keeps the demo's changes. Snapshots older than 12 hours are discarded
 * and the installation is re-seeded, so "today" metrics always look current.
 *
 * Every browser tab runs its own runtime. To keep tabs coherent (e.g. admin
 * publishes the storefront in one tab, /site is open in another), a mutation is
 * persisted right away and the snapshot is broadcast; other tabs adopt it and
 * dispatch `orvex:installation-changed` on window so the app refetches.
 *
 * Snapshots carry a mutation `epoch` (bumped by every announced mutation). A tab
 * only adopts a strictly newer epoch, and never while it holds an unannounced
 * mutation of its own — so a tab doing reads can never roll back another tab's
 * publish or order.
 */
import { formatMoney, usd } from '@/core/money'
import type { OrderChannel, PaymentMethodKind } from '@/core/domain'
import { placeOrder } from '@/core/commands/orders'
import { completePayment, confirmBankTransfer, createTopUp } from '@/core/commands/payments'
import { refreshBalance } from '@/core/commands/suppliers'
import { ensureGuestAccount } from '@/core/commands/accounts'
import { withLuhn, GSM_BRANDS } from '@/core/verticals/gsm'
import { quote } from '@/core/services/pricing'
import { availability } from '@/core/services/routing'
import { walletBalance } from '@/core/services/ledger'
import { DomainError } from '@/core/errors'
import { createRuntime, liveTick, pruneLogs, type Runtime } from './runtime'
import { seedRuntime } from './seed'
import { PLAIN_COLLECTIONS, MockCollection } from './store'
import { handleNative } from './api/native'
import { handleDhru } from './api/dhru'
import { POPULARITY } from './data/catalog'

/** Bump when the snapshot shape changes (v9: storefront draft/published revisions). */
const VERSION = 9
const DB = 'orvex-demo'
const STORE = 'snapshots'
const KEY = 'installation'
const MAX_AGE = 12 * 3600_000

/** Window event fired when this tab adopted state written by another tab. */
export const INSTALLATION_CHANGED_EVENT = 'orvex:installation-changed'

let current: Promise<Runtime> | null = null
/** Newest mutation epoch this tab has seen (adopted, written, or deliberately skipped). */
let knownEpoch = 0
const TAB_ID = Math.random().toString(36).slice(2)
// Browser tabs only — in Node (self-tests) an open channel would also keep the process alive.
const channel = typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('orvex-demo') : null
channel?.addEventListener('message', (e: MessageEvent<{ tab: string; snapshot: Snapshot }>) => {
  if (e.data?.tab !== TAB_ID && e.data?.snapshot) adopt(e.data.snapshot)
})
let timers: ReturnType<typeof setInterval>[] = []

export function runtime(): Promise<Runtime> {
  if (!current) current = boot()
  return current
}

async function boot(): Promise<Runtime> {
  const snap = await idbGet().catch(() => null)
  let rt: Runtime
  if (snap && snap.v === VERSION && Date.now() - snap.savedAt < MAX_AGE) {
    try {
      rt = restore(snap)
      knownEpoch = snap.epoch ?? 0
    } catch (e) {
      console.warn('[orvex] snapshot restore failed — reseeding', e)
      rt = fresh()
    }
  } else rt = fresh()
  startLive(rt)
  return rt
}

function fresh() {
  const rt = createRuntime(20261004)
  seedRuntime(rt, Date.now())
  return rt
}

export async function resetRuntime(): Promise<Runtime> {
  stopLive()
  await idbDelete().catch(() => undefined)
  const rt = fresh()
  current = Promise.resolve(rt)
  startLive(rt)
  persistSoon(rt, { announce: true })
  return rt
}

/** Replace this tab's runtime with a newer snapshot written by another tab. */
function adopt(snap: Snapshot) {
  if (snap.v !== VERSION || (snap.epoch ?? 0) <= knownEpoch) return
  if (announcePending) {
    // This tab has a mutation the others haven't seen yet: keep it, and announce above the epoch we just saw.
    knownEpoch = snap.epoch
    return
  }
  try {
    stopLive()
    if (saveTimer) clearTimeout(saveTimer)
    const rt = restore(snap)
    knownEpoch = snap.epoch
    current = Promise.resolve(rt)
    startLive(rt)
    // Re-persist so a periodic save from this tab can never overwrite the adopted state with an older one.
    persistSoon(rt)
    window.dispatchEvent(new Event(INSTALLATION_CHANGED_EVENT))
  } catch (e) {
    console.warn('[orvex] could not adopt state from another tab', e)
  }
}

/* ------------------------------------------------------------------------- */
/*  Live loop                                                                */
/* ------------------------------------------------------------------------- */
function startLive(rt: Runtime) {
  if (typeof window === 'undefined') return
  stopLive()
  timers.push(setInterval(() => liveTick(rt), 1000))
  timers.push(
    setInterval(() => {
      const t = rt.sim.traffic
      if (t.enabled && Math.random() < t.perMinute / 12) generateTraffic(rt)
    }, 5000),
  )
  timers.push(
    setInterval(() => {
      for (const s of rt.repo.suppliers.all()) {
        try {
          refreshBalance(rt.ctx, { supplierId: s.id })
        } catch {
          /* supplier unreachable — keep last reported balance */
        }
      }
      pruneLogs(rt)
    }, 60_000),
  )
  timers.push(setInterval(() => persistSoon(rt), 20_000))
}

function stopLive() {
  timers.forEach(clearInterval)
  timers = []
}

/** A light trickle of realistic orders so the cockpit is never static. */
function generateTraffic(rt: Runtime) {
  const { repo, ctx, rng } = rt
  const channel = rng.weighted(['storefront', 'portal', 'api', 'dhru'] as OrderChannel[], [30, 20, 35, 15])
  const candidates = repo.accounts.filter((a) => a.status === 'active' && a.kind === 'customer' && a.channels[channel as 'storefront'] && (channel !== 'storefront' || a.tier === 'retail'))
  if (!candidates.length) return
  const acct = channel === 'storefront' && rng.bool(0.4) ? ensureGuestAccount(ctx, `visitor${rng.int(100, 999)}@mail.example`, 'tier_retail') : rng.pick(candidates)
  const pool = repo.services.filter((s) => s.status === 'active' && (channel !== 'storefront' || s.visibility.storefront) && (acct.serviceAccess.mode === 'all' || (acct.serviceAccess.mode === 'categories' && acct.serviceAccess.categoryIds.includes(s.categoryId))))
  if (!pool.length) return
  const svc = rng.weighted(pool, pool.map((s) => Math.max(0.4, POPULARITY[s.id] ?? 1)))
  const price = quote(ctx, svc.id, acct.pricingTierId).amount
  if (!availability(ctx, svc, price).available) return
  const rev = repo.revisions.require(svc.revisionId)
  const input: Record<string, string> = {}
  for (const f of rev.fields) {
    if (!f.required) continue
    input[f.key] =
      f.type === 'gsm.imei'
        ? withLuhn(`35${rng.int(1000000, 9999999)}${rng.int(10000, 99999)}`)
        : f.type === 'gsm.serial'
          ? `F2L${rng.hex(5).toUpperCase()}${rng.int(1000, 9999)}`
          : f.type === 'gsm.brand'
            ? rng.pick(GSM_BRANDS.slice(0, 6)).value
            : f.type === 'gsm.carrier'
              ? rng.pick(f.options ?? [{ value: 'tmobile_us', label: '' }]).value
              : f.type === 'country'
                ? 'US'
                : 'iPhone 15'
  }
  try {
    if (channel === 'storefront') {
      const method: PaymentMethodKind = rng.bool(0.75) ? 'card' : 'paypal'
      const r = placeOrder(ctx, { accountId: acct.id, serviceId: svc.id, input, channel, actor: { type: 'guest', id: acct.id, name: acct.email }, payment: { mode: 'external', method }, tracking: true })
      if (r.paymentIntentId) ctx.scheduler.schedule('payment.settle', { intentId: r.paymentIntentId, outcome: rng.bool(0.95) ? 'succeed' : 'fail' }, ctx.clock.now() + rng.int(8, 30) * 1000)
      return
    }
    const bal = walletBalance(ctx, acct.id)
    if (bal.spendable < price) {
      const intent = createTopUp(ctx, { accountId: acct.id, amount: usd(Math.max(100, Math.ceil((price - bal.spendable) / 1e6) + 100)), method: 'bank_transfer', actor: { type: 'member', id: acct.id, name: acct.contactName } })
      confirmBankTransfer(ctx, { intentId: intent.id, actor: { type: 'system', id: 'system', name: 'Auto-confirm (demo)' } })
      void formatMoney
    }
    if (channel === 'api') {
      const key = repo.apiKeys.find((k) => k.accountId === acct.id && k.status === 'active' && k.environment === 'live')
      if (key) handleNative(rt, { method: 'POST', path: '/v1/orders', headers: { authorization: `Bearer ${key.prefix}_${rng.hex(24)}`, 'idempotency-key': `idem_${rng.hex(16)}` }, body: { service: svc.code, input }, ip: key.ipAllowlist[0]?.replace(/\/\d+$/, '').replace(/\.0$/, '.14') })
      return
    }
    if (channel === 'dhru') {
      const key = repo.apiKeys.find((k) => k.accountId === acct.id && k.status === 'active' && k.dhruCompat)
      if (key) handleDhru(rt, { username: acct.email, apiaccesskey: `${key.prefix}_${rng.hex(20)}`, action: 'placeimeiorder', parameters: `<PARAMETERS><ID>${svc.code}</ID>${input.imei ? `<IMEI>${input.imei}</IMEI>` : ''}${input.model ? `<MODELID>${input.model}</MODELID>` : ''}</PARAMETERS>` })
      return
    }
    placeOrder(ctx, { accountId: acct.id, serviceId: svc.id, input, channel: 'portal', actor: { type: 'member', id: acct.id, name: acct.contactName }, payment: { mode: 'wallet' } })
  } catch (e) {
    if (!(e instanceof DomainError)) console.warn('[orvex:traffic]', e)
  }
  void completePayment
}

/* ------------------------------------------------------------------------- */
/*  Snapshots                                                                */
/* ------------------------------------------------------------------------- */
interface Snapshot {
  v: number
  savedAt: number
  /** Mutation epoch — see the module comment. */
  epoch: number
  seededAt: number
  collections: Record<string, unknown[]>
  orders: unknown[]
  ledger: unknown[]
  idempotency: unknown[]
  storefront: unknown
  sim: Runtime['sim']
  system: Runtime['system']
  sessions: Runtime['sessions']
  scenarios: Runtime['scenarios']
  jobs: Runtime['scheduler']['jobs']
}

function dump(rt: Runtime): Snapshot {
  const collections: Record<string, unknown[]> = {}
  for (const k of PLAIN_COLLECTIONS) collections[k] = (rt.repo[k] as unknown as MockCollection<{ id: string }>).dump()
  return {
    v: VERSION,
    savedAt: Date.now(),
    epoch: knownEpoch,
    seededAt: rt.seededAt,
    collections,
    orders: rt.repo.orders.dump(),
    ledger: rt.repo.ledger.dump(),
    idempotency: rt.repo.idempotency.all(),
    storefront: rt.repo.storefront.get(),
    sim: rt.sim,
    system: rt.system,
    sessions: rt.sessions,
    scenarios: rt.scenarios,
    jobs: rt.scheduler.jobs,
  }
}

function restore(s: Snapshot): Runtime {
  const rt = createRuntime((s.savedAt ^ 0x5f3759df) >>> 0)
  for (const k of PLAIN_COLLECTIONS) (rt.repo[k] as unknown as MockCollection<{ id: string }>).load((s.collections[k] ?? []) as { id: string }[])
  rt.repo.orders.load(s.orders as never)
  rt.repo.ledger.load(s.ledger as never)
  rt.repo.idempotency.load(s.idempotency as never)
  rt.repo.storefront.set(s.storefront as never)
  Object.assign(rt.sim, s.sim)
  rt.system = s.system
  rt.sessions = s.sessions
  rt.scenarios = s.scenarios
  rt.scheduler.jobs = s.jobs
  rt.seededAt = s.seededAt
  rt.live = true
  return rt
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let announcePending = false

/**
 * Snapshot to IndexedDB. Mutations pass `announce`: they are written almost
 * immediately and broadcast to other tabs; periodic saves are debounced and silent.
 */
export function persistSoon(rt: Runtime, opts: { announce?: boolean } = {}) {
  if (typeof indexedDB === 'undefined') return
  announcePending ||= !!opts.announce
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(
    () => {
      const announce = announcePending
      announcePending = false
      saveTimer = null
      try {
        if (announce) knownEpoch += 1
        const snap = dump(rt)
        void idbPut(snap)
          .then(() => announce && channel?.postMessage({ tab: TAB_ID, snapshot: snap }))
          .catch(() => undefined)
      } catch {
        /* best effort */
      }
    },
    announcePending ? 150 : 1500,
  )
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(): Promise<Snapshot | null> {
  if (typeof indexedDB === 'undefined') return null
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY)
    req.onsuccess = () => resolve((req.result as Snapshot) ?? null)
    req.onerror = () => reject(req.error)
  })
}

async function idbPut(s: Snapshot) {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(s, KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function idbDelete() {
  if (typeof indexedDB === 'undefined') return
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
