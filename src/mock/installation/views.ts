/** DTO builders — join domain records into the shapes the UI consumes (src/types/installation.ts). */
import { sumBy, ZERO, type Micros } from '@/core/money'
import type { Account, Order } from '@/core/domain'
import { OPEN_STATUSES } from '@/core/domain'
import { heldForOrder, walletBalance } from '@/core/services/ledger'
import { candidatesFor, rankOffers } from '@/core/services/routing'
import { supplierDrift, supplierHealth, supplierMetrics } from '@/core/services/supplier'
import { quote } from '@/core/services/pricing'
import { publicStatus } from '@/core/services/presenters'
import { toDhruStatus } from '@/core/edge/dhru'
import type { AccountRow, OrderDetail, OrderRow, PortalOrder, ServiceRow, SupplierView } from '@/types/installation'
import type { Runtime } from './runtime'

const DAY = 86400_000

export function orderRow(rt: Runtime, o: Order): OrderRow {
  const acct = rt.repo.accounts.get(o.accountId)
  const svc = rt.repo.services.get(o.serviceId)
  const fulfilled = o.attempts.find((a) => a.state === 'succeeded' || a.state === 'accepted') ?? o.attempts.at(-1)
  return {
    id: o.id,
    ref: o.ref,
    accountId: o.accountId,
    accountName: acct?.kind === 'guest' ? `${acct.email} (guest)` : (acct?.name ?? o.accountId),
    accountTier: acct?.tier ?? 'retail',
    channel: o.channel,
    serviceId: o.serviceId,
    serviceName: o.serviceName,
    categoryName: svc ? (rt.repo.categories.get(svc.categoryId)?.name ?? '') : '',
    input: o.input,
    price: o.price.amount,
    supplierCost: o.supplierCost,
    status: o.status,
    financialStatus: o.financialStatus,
    supplierName: fulfilled ? (rt.repo.suppliers.get(fulfilled.supplierId)?.name ?? null) : null,
    attempts: o.attempts.length,
    failover: o.attempts.length > 1,
    reviewReason: o.status === 'needs_review' ? (o.review?.message ?? 'Needs review') : null,
    resultSummary: o.result?.summary ?? null,
    refundedTotal: o.refundedTotal,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    completedAt: o.completedAt,
    scenario: o.scenario,
  }
}

export function orderDetail(rt: Runtime, o: Order): OrderDetail {
  const { repo, ctx } = rt
  const acct = repo.accounts.require(o.accountId)
  const svc = repo.services.require(o.serviceId)
  const supplierNames = Object.fromEntries(repo.suppliers.all().map((s) => [s.id, s.name]))
  const live = o.status === 'queued' || o.status === 'processing' || o.status === 'needs_review'
  return {
    order: o,
    account: { id: acct.id, name: acct.name, tier: acct.tier, number: acct.number, email: acct.email, kind: acct.kind, status: acct.status },
    service: { id: svc.id, name: svc.name, code: svc.code, processing: svc.processing, categoryId: svc.categoryId },
    revision: repo.revisions.get(o.serviceRevisionId) ?? repo.revisions.require(svc.revisionId),
    ledger: repo.ledger.forOrder(o.id).slice().sort((a, b) => (a.at < b.at ? -1 : 1)),
    payment: o.paymentIntentId ? (repo.payments.get(o.paymentIntentId) ?? null) : null,
    refunds: repo.refunds.filter((r) => r.orderId === o.id),
    verifications: repo.verifications.filter((v) => v.orderId === o.id),
    webhooks: repo.webhookDeliveries.filter((w) => w.orderId === o.id),
    notifications: repo.notifications.filter((n) => n.orderId === o.id),
    driverCalls: repo.driverCalls.filter((c) => c.orderId === o.id).slice().sort((a, b) => (a.at < b.at ? -1 : 1)),
    candidates: candidatesFor(ctx, o).map((c) => ({
      offerId: c.offer.id,
      priority: c.offer.priority,
      supplierId: c.offer.supplierId,
      supplierName: c.supplier?.name ?? c.offer.supplierId,
      productName: c.product?.name ?? '—',
      cost: c.cost,
      routable: c.routable,
      eligible: live && c.eligible,
      attempted: c.attempted,
      marginBlocked: c.marginBlocked,
      reasons: c.reasons,
    })),
    held: heldForOrder(ctx, o),
    refundable: (o.financialStatus === 'captured' || o.financialStatus === 'partially_refunded' ? o.price.amount - o.refundedTotal : 0) as Micros,
    dhruStatus: toDhruStatus(o.status),
    publicStatus: publicStatus(o),
    supplierNames,
  }
}

export function accountRow(rt: Runtime, a: Account): AccountRow {
  const since = rt.clock.now() - 30 * DAY
  let orders30d = 0
  let spend = 0
  let open = 0
  for (const o of rt.repo.orders.all()) {
    if (o.accountId !== a.id) continue
    if (OPEN_STATUSES.includes(o.status)) open++
    if (new Date(o.createdAt).getTime() >= since) {
      orders30d++
      if (o.financialStatus === 'captured' || o.financialStatus === 'partially_refunded') spend += o.price.amount - o.refundedTotal
    }
  }
  const balance = walletBalance(rt.ctx, a.id)
  return { account: a, balance, tierName: rt.repo.tiers.get(a.pricingTierId)?.name ?? a.pricingTierId, orders30d, spend30d: spend as Micros, openOrders: open, lowBalance: a.lowBalanceAlert != null && balance.available < a.lowBalanceAlert }
}

export function serviceRow(rt: Runtime, serviceId: string, orders30d: Map<string, number>): ServiceRow {
  const s = rt.repo.services.require(serviceId)
  const retail = quote(rt.ctx, s.id, 'tier_retail')
  const ranked = rankOffers(rt.ctx, s.id)
  const routable = ranked.filter((r) => r.routable && r.cost <= retail.amount)
  const reason = s.status !== 'active' ? `Service is ${s.status}` : !ranked.length ? 'No supplier offer mapped' : !routable.length ? (ranked.some((r) => r.routable) ? 'Margin guard blocks every routable offer' : 'All supplier offers are unavailable') : null
  return { service: s, categoryName: rt.repo.categories.get(s.categoryId)?.name ?? '', offers: ranked.length, routableOffers: routable.length, available: !reason, unavailableReason: reason, retail, orders30d: orders30d.get(s.id) ?? 0 }
}

export function supplierView(rt: Runtime, supplierId: string): SupplierView {
  const { repo, ctx } = rt
  const s = repo.suppliers.require(supplierId)
  const metrics = supplierMetrics(ctx, s.id)
  const driver = ctx.drivers.get(s.driver)
  const offers = repo.offers.filter((o) => o.supplierId === s.id)
  const runs = repo.syncRuns.filter((r) => r.supplierId === s.id).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
  return {
    supplier: s,
    health: supplierHealth(ctx, s, metrics),
    metrics,
    reconciliation: supplierDrift(ctx, s),
    driver: { id: driver.id, name: driver.name, version: driver.version, protocol: driver.protocol },
    products: repo.products.count((p) => p.supplierId === s.id && p.status === 'available'),
    offers: offers.length,
    services: new Set(offers.map((o) => o.serviceId)).size,
    lastSync: runs[0] ?? null,
    pendingChanges: repo.syncChanges.count((c) => c.supplierId === s.id && c.decision === 'pending'),
  }
}

/** Customer-facing order view (portal + storefront): no supplier names or internal events. */
export function portalOrder(rt: Runtime, o: Order): PortalOrder {
  const ps = publicStatus(o)
  const svc = rt.repo.services.get(o.serviceId)
  const rev = rt.repo.revisions.get(o.serviceRevisionId)
  const visible = new Set(['created', 'payment_succeeded', 'hold_created', 'processing', 'completed', 'rejected', 'cancelled', 'hold_released', 'refund', 'verification', 'ledger_settled'])
  const relabel: Record<string, string> = { hold_created: 'Funds reserved', ledger_settled: 'Charged', hold_released: 'Funds released', processing: 'Processing' }
  return {
    id: o.id,
    ref: o.ref,
    serviceName: o.serviceName,
    serviceCode: svc?.code ?? '',
    input: o.input,
    price: o.price.amount,
    status: ps.status,
    statusDetail: ps.detail,
    financialStatus: o.financialStatus,
    result: o.result,
    rejection: o.rejection,
    clientReference: o.clientReference,
    channel: o.channel,
    refundedTotal: o.refundedTotal,
    createdAt: o.createdAt,
    completedAt: o.completedAt,
    timeline: o.events
      .filter((e) => visible.has(e.type))
      .filter((e, i, arr) => !(e.type === 'processing' && arr.findIndex((x) => x.type === 'processing') !== i))
      .map((e) => ({ at: e.at, title: relabel[e.type] ?? e.title, detail: e.type === 'created' ? undefined : e.type === 'ledger_settled' ? undefined : e.detail, tone: e.tone })),
    verifications: rt.repo.verifications.filter((v) => v.orderId === o.id),
    resultSchema: rev?.resultSchema ?? [],
  }
}

export function sumHeld(rt: Runtime): Micros {
  return sumBy(rt.repo.ledger.balances('customer_held:'), (b) => b.balance)
}

export const ZERO_MICROS = ZERO
