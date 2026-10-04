/**
 * In-memory repositories (MockOrderRepository, MockLedgerRepository, …).
 *
 * Implements the Core ports in src/core/ports.ts. Production swaps these for
 * PostgreSQL repositories; the domain code does not change. The whole store can
 * be serialised to a snapshot (persisted to IndexedDB for the demo) and
 * restored with indexes rebuilt.
 */
import { add, ZERO, type Micros } from '@/core/money'
import { DomainError, notFound } from '@/core/errors'
import { LEDGER_GROUPS, type LedgerAccountBalance, type LedgerGroup, type LedgerTransaction, type Order, type IdempotencyRecord, type StorefrontState } from '@/core/domain'
import type { Collection, IdempotencyRepository, LedgerRepository, OrderRepository, Repositories } from '@/core/ports'

export class MockCollection<T extends { id: string }> implements Collection<T> {
  protected items: T[] = []
  protected index = new Map<string, T>()
  constructor(
    protected entity: string,
    protected newestFirst = false,
  ) {}

  get(id: string) {
    return this.index.get(id)
  }
  require(id: string) {
    const x = this.index.get(id)
    if (!x) throw notFound(this.entity, id)
    return x
  }
  all() {
    return this.items
  }
  filter(pred: (x: T) => boolean) {
    return this.items.filter(pred)
  }
  find(pred: (x: T) => boolean) {
    return this.items.find(pred)
  }
  count(pred?: (x: T) => boolean) {
    if (!pred) return this.items.length
    let n = 0
    for (const x of this.items) if (pred(x)) n++
    return n
  }
  insert(item: T) {
    if (this.index.has(item.id)) throw new DomainError('duplicate_id', `${this.entity} ${item.id} already exists`, 409)
    if (this.newestFirst) this.items.unshift(item)
    else this.items.push(item)
    this.index.set(item.id, item)
    this.onInsert(item)
    return item
  }
  update(id: string, patch: Partial<T> | ((x: T) => void)) {
    const x = this.require(id)
    if (typeof patch === 'function') patch(x)
    else Object.assign(x, patch)
    return x
  }
  remove(id: string) {
    const x = this.index.get(id)
    if (!x) return
    this.index.delete(id)
    this.items.splice(this.items.indexOf(x), 1)
  }
  protected onInsert(_item: T) {}
  /** Snapshot support. */
  dump(): T[] {
    return this.items
  }
  load(items: T[]) {
    this.items = []
    this.index.clear()
    for (const i of items) {
      this.items.push(i)
      this.index.set(i.id, i)
      this.onInsert(i)
    }
  }
}

class MockOrderRepository extends MockCollection<Order> implements OrderRepository {
  private refs = new Map<string, Order>()
  private tokens = new Map<string, Order>()
  constructor() {
    super('Order', true)
  }
  protected onInsert(o: Order) {
    this.refs.set(o.ref, o)
    if (o.trackingToken) this.tokens.set(o.trackingToken, o)
  }
  insert(o: Order) {
    // Keep newest-first ordering even when history is inserted out of order.
    if (this.items.length && o.createdAt < this.items[0]!.createdAt) {
      if (this.index.has(o.id)) throw new DomainError('duplicate_id', `Order ${o.id} already exists`, 409)
      let i = this.items.findIndex((x) => x.createdAt <= o.createdAt)
      if (i < 0) i = this.items.length
      this.items.splice(i, 0, o)
      this.index.set(o.id, o)
      this.onInsert(o)
      return o
    }
    return super.insert(o)
  }
  load(items: Order[]) {
    this.refs.clear()
    this.tokens.clear()
    super.load(items)
  }
  byRef(ref: string) {
    return this.refs.get(ref.toUpperCase())
  }
  byTrackingToken(token: string) {
    return this.tokens.get(token)
  }
  recent(limit?: number) {
    return limit ? this.items.slice(0, limit) : this.items
  }
}

function parseAccount(code: string) {
  const [group, subjectId] = code.split(':') as [LedgerGroup, string | undefined]
  const meta = LEDGER_GROUPS[group] ?? { name: group, type: 'asset' as const }
  return { group, subjectId: subjectId ?? null, name: meta.name, type: meta.type }
}

class MockLedgerRepository implements LedgerRepository {
  private txs: LedgerTransaction[] = []
  private byId = new Map<string, LedgerTransaction>()
  private byKey = new Map<string, LedgerTransaction>()
  private byOrder = new Map<string, LedgerTransaction[]>()
  private totals = new Map<string, { debits: number; credits: number; entries: number }>()
  private entries = 0

  post(tx: LedgerTransaction) {
    if (this.byKey.has(tx.idempotencyKey)) return this.byKey.get(tx.idempotencyKey)!
    let d = 0
    let c = 0
    for (const e of tx.entries) {
      if (e.direction === 'debit') d += e.amount
      else c += e.amount
    }
    if (d !== c) throw new DomainError('unbalanced_transaction', `Ledger transaction ${tx.description} is unbalanced (${d} ≠ ${c})`, 500)
    this.index(tx)
    return tx
  }
  private index(tx: LedgerTransaction) {
    this.txs.push(tx)
    this.byId.set(tx.id, tx)
    this.byKey.set(tx.idempotencyKey, tx)
    if (tx.orderId) {
      const arr = this.byOrder.get(tx.orderId) ?? []
      arr.push(tx)
      this.byOrder.set(tx.orderId, arr)
    }
    for (const e of tx.entries) {
      const t = this.totals.get(e.account) ?? { debits: 0, credits: 0, entries: 0 }
      if (e.direction === 'debit') t.debits += e.amount
      else t.credits += e.amount
      t.entries++
      this.totals.set(e.account, t)
      this.entries++
    }
  }
  byIdempotencyKey(key: string) {
    return this.byKey.get(key)
  }
  get(id: string) {
    return this.byId.get(id)
  }
  transactions(filter?: (t: LedgerTransaction) => boolean) {
    const out: LedgerTransaction[] = []
    for (let i = this.txs.length - 1; i >= 0; i--) {
      const t = this.txs[i]!
      if (!filter || filter(t)) out.push(t)
    }
    return out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  }
  forOrder(orderId: string) {
    return this.byOrder.get(orderId) ?? []
  }
  private toBalance(account: string, t: { debits: number; credits: number; entries: number }): LedgerAccountBalance {
    const meta = parseAccount(account)
    const debitNormal = meta.type === 'asset' || meta.type === 'expense'
    return { account, ...meta, debits: t.debits as Micros, credits: t.credits as Micros, balance: (debitNormal ? t.debits - t.credits : t.credits - t.debits) as Micros, entries: t.entries }
  }
  balance(account: string) {
    return this.toBalance(account, this.totals.get(account) ?? { debits: 0, credits: 0, entries: 0 })
  }
  balances(prefix?: string) {
    const out: LedgerAccountBalance[] = []
    for (const [k, t] of this.totals) if (!prefix || k.startsWith(prefix)) out.push(this.toBalance(k, t))
    return out.sort((a, b) => a.account.localeCompare(b.account))
  }
  recompute() {
    const m = new Map<string, { debits: number; credits: number; entries: number }>()
    for (const tx of this.txs)
      for (const e of tx.entries) {
        const t = m.get(e.account) ?? { debits: 0, credits: 0, entries: 0 }
        if (e.direction === 'debit') t.debits += e.amount
        else t.credits += e.amount
        t.entries++
        m.set(e.account, t)
      }
    return new Map([...m].map(([k, t]) => [k, this.toBalance(k, t)]))
  }
  entryCount() {
    return this.entries
  }
  dump() {
    return this.txs
  }
  load(txs: LedgerTransaction[]) {
    this.txs = []
    this.byId.clear()
    this.byKey.clear()
    this.byOrder.clear()
    this.totals.clear()
    this.entries = 0
    for (const t of txs) this.index(t)
  }
  /** Sum of all balances in a group (e.g. every customer wallet). */
  groupTotal(group: LedgerGroup): Micros {
    let s = ZERO
    for (const b of this.balances(`${group}`)) s = add(s, b.balance)
    return s
  }
}

class MockIdempotencyRepository implements IdempotencyRepository {
  private m = new Map<string, IdempotencyRecord>()
  get(accountId: string, key: string) {
    return this.m.get(`${accountId}|${key}`)
  }
  put(r: IdempotencyRecord) {
    this.m.set(`${r.accountId}|${r.key}`, r)
  }
  all() {
    return [...this.m.values()]
  }
  load(rs: IdempotencyRecord[]) {
    this.m.clear()
    rs.forEach((r) => this.put(r))
  }
}

export type MockRepositories = Repositories & {
  orders: MockOrderRepository
  ledger: MockLedgerRepository
  idempotency: MockIdempotencyRepository
}

export function createRepositories(): MockRepositories {
  let storefront: StorefrontState | null = null
  return {
    accounts: new MockCollection('Account'),
    members: new MockCollection('Member'),
    categories: new MockCollection('Category'),
    services: new MockCollection('Service'),
    revisions: new MockCollection('Service revision'),
    products: new MockCollection('Supplier product'),
    offers: new MockCollection('Offer'),
    tiers: new MockCollection('Pricing tier'),
    rules: new MockCollection('Pricing rule'),
    suppliers: new MockCollection('Supplier'),
    healthSamples: new MockCollection('Health sample'),
    driverCalls: new MockCollection('Driver call', true),
    syncRuns: new MockCollection('Sync run', true),
    syncChanges: new MockCollection('Sync change'),
    orders: new MockOrderRepository(),
    ledger: new MockLedgerRepository(),
    paymentMethods: new MockCollection('Payment method'),
    payments: new MockCollection('Payment', true),
    refunds: new MockCollection('Refund', true),
    chargebacks: new MockCollection('Chargeback', true),
    gatewayEvents: new MockCollection('Gateway event', true),
    verifications: new MockCollection('Verification request', true),
    notifications: new MockCollection('Notification', true),
    notificationRoutes: new MockCollection('Notification route'),
    notificationChannels: new MockCollection('Notification channel'),
    apiKeys: new MockCollection('API key'),
    apiLogs: new MockCollection('API log', true),
    idempotency: new MockIdempotencyRepository(),
    webhookEndpoints: new MockCollection('Webhook endpoint'),
    webhookDeliveries: new MockCollection('Webhook delivery', true),
    inboundWebhooks: new MockCollection('Inbound webhook', true),
    audit: new MockCollection('Audit event', true),
    users: new MockCollection('User'),
    roles: new MockCollection('Role'),
    storefront: {
      get: () => {
        if (!storefront) throw notFound('Storefront', 'state')
        return storefront
      },
      set: (c) => {
        storefront = c
      },
    },
  }
}

/** Collections that are plain MockCollections (for snapshot dump/load). */
export const PLAIN_COLLECTIONS = [
  'accounts',
  'members',
  'categories',
  'services',
  'revisions',
  'products',
  'offers',
  'tiers',
  'rules',
  'suppliers',
  'healthSamples',
  'driverCalls',
  'syncRuns',
  'syncChanges',
  'paymentMethods',
  'payments',
  'refunds',
  'chargebacks',
  'gatewayEvents',
  'verifications',
  'notifications',
  'notificationRoutes',
  'notificationChannels',
  'apiKeys',
  'apiLogs',
  'webhookEndpoints',
  'webhookDeliveries',
  'inboundWebhooks',
  'audit',
  'users',
  'roles',
] as const
