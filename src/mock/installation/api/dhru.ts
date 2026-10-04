/**
 * DHRU-compatible reseller endpoint — POST /api/dhru (simulated).
 *
 * Lets resellers keep their existing DHRU Fusion client (form-POST with
 * username, apiaccesskey, action, parameters). The edge translates:
 *   accountinfo      → wallet projection
 *   imeiservicelist  → catalog + the account's live prices
 *   placeimeiorder   → PlaceOrder (channel "dhru") — same command as every channel
 *   getimeiorder     → order status mapped to DHRU 0/1/3/4
 * DHRU semantics stop here; Core never sees numeric statuses.
 */
import type { Actor } from '@/core/domain'
import { DomainError } from '@/core/errors'
import { fieldType } from '@/core/fields'
import { placeOrder } from '@/core/commands/orders'
import { quote } from '@/core/services/pricing'
import { availability } from '@/core/services/routing'
import { walletBalance } from '@/core/services/ledger'
import { toDhruStatus } from '@/core/edge/dhru'
import { authenticate, type ApiRuntime } from './native'

export interface DhruRequest {
  username: string
  apiaccesskey: string
  action: string
  parameters?: string
  ip?: string
  userAgent?: string
}

const ok = (o: Record<string, unknown>) => ({ SUCCESS: [o], apiversion: '6.1' })
const fail = (message: string) => ({ ERROR: [{ MESSAGE: message }], apiversion: '6.1' })
const dec = (m: number) => (m / 1_000_000).toFixed(2)

function parseParams(xml: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!xml) return out
  for (const m of xml.matchAll(/<([A-Z_]+)>([^<]*)<\/\1>/g)) out[m[1]!] = m[2]!
  return out
}

function turnaroundLabel(min: number, max: number) {
  const f = (s: number) => (s < 3600 ? `${Math.max(1, Math.round(s / 60))} Minutes` : s < 86400 ? `${Math.round(s / 3600)} Hours` : `${Math.round(s / 86400)} Days`)
  return `${f(min)} - ${f(max)}`
}

export function handleDhru(rt: ApiRuntime, req: DhruRequest): { status: number; body: unknown } {
  const started = rt.ctx.clock.now()
  const ip = req.ip ?? `198.51.100.${rt.rng.int(2, 250)}`
  const account0 = rt.repo.accounts.find((a) => a.email === req.username.toLowerCase() || a.number === req.username)
  let body: unknown
  let accountId: string | null = account0?.id ?? null
  let keyId: string | null = null
  let orderId: string | null = null
  if (!account0) body = fail('Authentication failed')
  else {
    const auth = authenticate(rt, `Bearer ${req.apiaccesskey}`, ip, 'dhru')
    if ('status' in auth || auth.account.id !== account0.id) body = fail('Authentication failed')
    else {
      const { key, account } = auth
      keyId = key.id
      accountId = account.id
      key.lastUsedAt = rt.ctx.clock.iso()
      const actor: Actor = { type: 'dhru', id: key.id, name: `${account.name} · DHRU client` }
      const p = parseParams(req.parameters)
      try {
        switch (req.action) {
          case 'accountinfo': {
            const b = walletBalance(rt.ctx, account.id)
            body = ok({ message: 'Your Accout Info', AccoutInfo: { credit: dec(b.available), creditraw: b.available / 1_000_000, held: dec(b.held), creditlimit: dec(b.creditLimit), mail: account.email, currency: 'USD' } })
            break
          }
          case 'imeiservicelist': {
            const groups: Record<string, { GROUPNAME: string; SERVICES: Record<string, unknown> }> = {}
            for (const s of rt.repo.services.filter((x) => x.visibility.api && x.status === 'active')) {
              const cat = rt.repo.categories.get(s.categoryId)?.name ?? 'Other'
              const q = quote(rt.ctx, s.id, account.pricingTierId)
              const rev = rt.repo.revisions.get(s.revisionId)
              groups[cat] ??= { GROUPNAME: cat, SERVICES: {} }
              groups[cat]!.SERVICES[s.code] = {
                SERVICEID: Number(s.code),
                SERVICENAME: s.name,
                CREDIT: dec(q.amount),
                TIME: turnaroundLabel(s.turnaround.minSec, s.turnaround.maxSec),
                INFO: s.summary,
                AVAILABLE: availability(rt.ctx, s, q.amount).available ? 1 : 0,
                'Requires.Network': rev?.fields.some((f) => f.type === 'gsm.carrier') ? 'Required' : 'None',
                'Requires.Mobile': rev?.fields.some((f) => f.type === 'gsm.model') ? 'Required' : 'None',
                'Requires.SN': rev?.fields.some((f) => f.type === 'gsm.serial') ? 'Required' : 'None',
              }
            }
            body = ok({ MESSAGE: 'IMEI Service List', LIST: groups })
            break
          }
          case 'placeimeiorder': {
            const svc = rt.repo.services.find((s) => s.code === p.ID)
            if (!svc) {
              body = fail('Invalid service ID')
              break
            }
            const rev = rt.repo.revisions.require(svc.revisionId)
            const input: Record<string, string> = {}
            for (const f of rev.fields) {
              const param = fieldType(f.type).dhruParam ?? f.key.toUpperCase()
              if (p[param]) input[f.key] = p[param]!
            }
            const r = placeOrder(rt.ctx, { accountId: account.id, serviceId: svc.id, input, channel: 'dhru', actor, idempotencyKey: p.REFERENCE ? `dhru:${p.REFERENCE}` : null, clientReference: p.REFERENCE ?? null, payment: { mode: 'wallet' } })
            orderId = r.order.id
            body = ok({ MESSAGE: r.replayed ? 'Order already received' : 'Order received', REFERENCEID: r.order.ref })
            break
          }
          case 'getimeiorder': {
            const o = rt.repo.orders.byRef(p.ID ?? '')
            if (!o || o.accountId !== account.id) {
              body = fail('Invalid order ID')
              break
            }
            orderId = o.id
            body = ok({ ID: o.ref, STATUS: String(toDhruStatus(o.status)), CODE: o.status === 'completed' ? (o.result?.summary ?? '') : o.status === 'rejected' || o.status === 'cancelled' ? (o.rejection?.message ?? 'Cancelled') : '' })
            break
          }
          default:
            body = fail(`Unsupported action ${req.action}`)
        }
      } catch (e) {
        if (e instanceof DomainError) body = fail(e.code === 'insufficient_balance' ? 'Insufficient credit' : e.code === 'validation_failed' ? `Invalid input: ${Object.values((e.details as { fields?: Record<string, string> })?.fields ?? {}).join(', ') || e.message}` : e.message)
        else throw e
      }
    }
  }
  const isErr = !!(body as { ERROR?: unknown }).ERROR
  rt.repo.apiLogs.insert({
    id: rt.ctx.ids.id('log'),
    requestId: `req_${rt.ctx.ids.token(20)}`,
    at: rt.ctx.clock.iso(started),
    protocol: 'dhru',
    method: 'POST',
    path: '/api/dhru',
    endpoint: `POST /api/dhru (${req.action})`,
    status: 200,
    latencyMs: rt.rng.int(30, 220),
    accountId,
    apiKeyId: keyId,
    keyPrefix: req.apiaccesskey.slice(0, 13),
    ip,
    userAgent: req.userAgent ?? 'DHRU-Fusion-Client/6.1',
    idempotencyKey: null,
    replayed: false,
    errorCode: isErr ? 'dhru_error' : null,
    requestBody: [`username=${req.username}`, `apiaccesskey=${req.apiaccesskey.slice(0, 13)}••••`, `action=${req.action}`, 'requestformat=JSON', ...(req.parameters ? [`parameters=${req.parameters}`] : [])].join('\n'),
    responseBody: JSON.stringify(body, null, 2),
    orderId,
  })
  // DHRU returns HTTP 200 with SUCCESS/ERROR in the body — preserved for compatibility.
  return { status: 200, body }
}
