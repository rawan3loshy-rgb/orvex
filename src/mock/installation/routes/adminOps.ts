/** Admin API — cockpit, orders, reviews, verifications, accounts. */
import type { MockRoute } from '@/api/mockRouter'
import { add, sumBy, ZERO, type Micros } from '@/core/money'
import type { AccountTier, FinancialStatus, Order, OrderChannel, OrderStatus } from '@/core/domain'
import { OPEN_STATUSES } from '@/core/domain'
import { notFound } from '@/core/errors'
import { cancelOrder, placeOrder, refundOrder, type PlaceOrderInput } from '@/core/commands/orders'
import { confirmNotReceived, enterSupplierReference, lookupSupplier, resolveManually } from '@/core/commands/review'
import { approveVerificationRefund, recheckSupplier, rejectVerification, requestSupplierVerification } from '@/core/commands/verification'
import { adjustAccountWallet, createAccount, inviteMember, setAccountStatus, updateAccount, updateMember } from '@/core/commands/accounts'
import { completePayment, confirmBankTransfer, createTopUp } from '@/core/commands/payments'
import { integrityReport } from '@/core/services/integrity'
import { requirePermission } from '@/core/services/access'
import { quote } from '@/core/services/pricing'
import { walletBalance, walletLines } from '@/core/services/ledger'
import type { CockpitAlert, CockpitData } from '@/types/installation'
import { adminActor, type Runtime } from '../runtime'
import { accountRow, orderDetail, orderRow, serviceRow, supplierView, sumHeld } from '../views'
import { DAY, HOUR, matches, paginate, r, startOfToday, ts, type BodyFor, type CommandParams } from './util'

type AccountPatch = CommandParams<typeof updateAccount>['patch']

function findOrder(rt: Runtime, id: string): Order {
  const o = rt.repo.orders.byRef(id) ?? rt.repo.orders.get(id)
  if (!o) throw notFound('Order', id)
  return o
}

/* ------------------------------------------------------------------------- */
/*  Cockpit                                                                  */
/* ------------------------------------------------------------------------- */
export function cockpit(rt: Runtime): CockpitData {
  const { repo, ctx } = rt
  const now = ctx.clock.now()
  const today = startOfToday(now)
  const ystart = today - DAY
  const since24 = now - DAY
  let todayN = 0
  let ySame = 0
  let completedToday = 0
  let rejectedToday = 0
  let ok24 = 0
  let bad24 = 0
  let revenue = ZERO
  let cost = ZERO
  const durations: number[] = []
  const counts: Record<string, number> = {}
  let oldestReview: string | null = null
  const buckets = Array.from({ length: 24 }, (_, i) => ({ t: new Date(Math.floor(now / HOUR) * HOUR - (23 - i) * HOUR).toISOString(), completed: 0, rejected: 0, review: 0 }))
  const firstBucket = ts(buckets[0]!.t)
  for (const o of repo.orders.recent()) {
    const c = ts(o.createdAt)
    counts[o.status] = (counts[o.status] ?? 0) + 1
    if (o.status === 'needs_review' && (!oldestReview || o.review!.openedAt < oldestReview)) oldestReview = o.review!.openedAt
    if (c >= today) todayN++
    else if (c >= ystart && c <= now - DAY) ySame++
    const done = o.completedAt ? ts(o.completedAt) : null
    if (done && done >= since24) {
      if (o.status === 'completed') {
        ok24++
        durations.push((done - c) / 1000)
      }
      if (o.status === 'rejected') bad24++
    }
    if (done && done >= today) {
      if (o.status === 'completed') {
        completedToday++
        revenue = add(revenue, o.price.amount)
        cost = add(cost, o.supplierCost ?? ZERO)
      }
      if (o.status === 'rejected') rejectedToday++
    }
    if (c >= firstBucket) {
      const b = buckets[Math.min(23, Math.floor((c - firstBucket) / HOUR))]!
      if (o.status === 'completed') b.completed++
      else if (o.status === 'rejected') b.rejected++
      else if (o.status === 'needs_review') b.review++
    }
  }
  durations.sort((a, b) => a - b)
  const suppliers = repo.suppliers.all().map((s) => supplierView(rt, s.id))
  const report = integrityReport(ctx)
  const activeServices = repo.services.filter((s) => s.status === 'active')
  const svcRows = activeServices.map((s) => serviceRow(rt, s.id, new Map()))
  const negative: CockpitData['catalog']['negativeMargin'] = []
  let lowMargin = 0
  for (const s of activeServices) {
    for (const t of repo.tiers.all()) {
      const q = quote(ctx, s.id, t.id)
      if (q.guard === 'negative_margin') negative.push({ serviceId: s.id, name: s.name, tier: t.name, margin: q.margin ?? ZERO })
      if (q.guard === 'low_margin') lowMargin++
    }
  }
  let req24 = 0
  let err24 = 0
  let dhru24 = 0
  for (const l of repo.apiLogs.all()) {
    if (ts(l.at) < since24) break
    req24++
    if (l.status >= 400 || l.errorCode) err24++
    if (l.protocol === 'dhru') dhru24++
  }
  let failed24 = 0
  let retrying = 0
  let delivered24 = 0
  for (const d of repo.webhookDeliveries.all()) {
    if (d.status === 'retrying') retrying++
    if (ts(d.createdAt) < since24) continue
    if (d.status === 'failed') failed24++
    if (d.status === 'delivered') delivered24++
  }
  const failingEndpoints = repo.webhookEndpoints.count((w) => w.status === 'failing')
  const lowBalance = repo.accounts
    .filter((a) => a.status === 'active' && a.lowBalanceAlert != null)
    .map((a) => ({ id: a.id, name: a.name, available: walletBalance(ctx, a.id).available }))
    .filter((x) => x.available < (repo.accounts.require(x.id).lowBalanceAlert ?? 0))
  const frozen = repo.accounts.filter((a) => a.status === 'frozen').map((a) => ({ id: a.id, name: a.name, reason: a.statusReason }))
  const verOpen = repo.verifications.count((v) => v.status === 'open')
  const verAwait = repo.verifications.count((v) => v.status === 'awaiting_supplier')
  const pendingSync = repo.syncChanges.count((c) => c.decision === 'pending')
  const unavailable = svcRows.filter((x) => !x.available).map((x) => ({ id: x.service.id, name: x.service.name, reason: x.unavailableReason ?? '' }))
  const walletLiability = sumBy(repo.ledger.balances('customer_available:').filter((b) => b.balance > 0), (b) => b.balance)
  const refundsToday = sumBy(repo.refunds.filter((x) => ts(x.createdAt) >= today), (x) => x.amount)

  const alerts: CockpitAlert[] = []
  const nr = counts.needs_review ?? 0
  if (nr) alerts.push({ id: 'review', severity: 'critical', area: 'orders', title: `${nr} order${nr > 1 ? 's' : ''} need review`, detail: 'Supplier outcome unknown — failover blocked, funds held', href: '/admin/orders?status=needs_review', count: nr })
  for (const s of suppliers) {
    if (s.health === 'healthy') continue
    const sev = s.health === 'auth_error' || s.health === 'circuit_open' ? 'critical' : 'warning'
    const label: Record<string, string> = { degraded: 'is degraded', auth_error: 'authentication failing', low_balance: 'balance is low', circuit_open: 'circuit open — traffic paused', half_open: 'circuit half-open — probing', maintenance: 'in maintenance', disabled: 'disabled' }
    alerts.push({ id: `sup_${s.supplier.id}`, severity: sev, area: 'suppliers', title: `${s.supplier.name} ${label[s.health]}`, detail: s.health === 'low_balance' ? `Reported balance below threshold` : s.health === 'degraded' ? `${s.metrics.successRate}% success · p95 ${s.metrics.latencyP95} ms` : (s.supplier.auth.message ?? s.supplier.maintenance.note ?? ''), href: `/admin/suppliers/${s.supplier.id}` })
  }
  if (unavailable.length) alerts.push({ id: 'unavailable', severity: 'warning', area: 'catalog', title: `${unavailable.length} service${unavailable.length > 1 ? 's' : ''} unavailable`, detail: unavailable.map((u) => u.name).join(', '), href: '/admin/services?availability=unavailable', count: unavailable.length })
  if (negative.length) alerts.push({ id: 'negative', severity: 'warning', area: 'catalog', title: `Negative margin on ${negative.length} price${negative.length > 1 ? 's' : ''}`, detail: negative.map((n) => `${n.name} (${n.tier})`).join(', '), href: '/admin/pricing?guard=negative_margin', count: negative.length })
  if (report.status !== 'pass') {
    const fails = report.checks.filter((c) => c.status === 'fail').length
    alerts.push({ id: 'ledger', severity: fails ? 'critical' : 'info', area: 'finance', title: fails ? 'Ledger integrity check failed' : 'Ledger integrity: attention items', detail: report.checks.filter((c) => c.status !== 'pass').map((c) => c.label).join(' · '), href: '/admin/finance/integrity' })
  }
  const drifting = suppliers.filter((s) => s.reconciliation.drift !== 0)
  if (drifting.length) alerts.push({ id: 'drift', severity: 'warning', area: 'finance', title: `Supplier balance drift at ${drifting.length} supplier${drifting.length > 1 ? 's' : ''}`, detail: drifting.map((s) => s.supplier.name).join(', '), href: '/admin/finance/reconciliation' })
  if (pendingSync) alerts.push({ id: 'sync', severity: 'info', area: 'catalog', title: `${pendingSync} catalog changes to review`, detail: 'Supplier price, field and product changes from the last sync', href: '/admin/catalog/sync', count: pendingSync })
  if (failingEndpoints || failed24) alerts.push({ id: 'webhooks', severity: 'warning', area: 'webhooks', title: `${failingEndpoints} webhook endpoint${failingEndpoints === 1 ? '' : 's'} failing`, detail: `${failed24} failed deliveries in 24 h · ${retrying} retrying`, href: '/admin/developer/webhooks?status=failing' })
  if (req24 && err24 / req24 > 0.03) alerts.push({ id: 'api', severity: 'warning', area: 'api', title: `API error rate ${((err24 / req24) * 100).toFixed(1)}%`, detail: `${err24} of ${req24} requests in 24 h`, href: '/admin/developer/logs?status=error' })
  if (verOpen + verAwait) alerts.push({ id: 'verif', severity: 'info', area: 'orders', title: `${verOpen + verAwait} verification request${verOpen + verAwait > 1 ? 's' : ''}`, detail: `${verOpen} open · ${verAwait} awaiting supplier`, href: '/admin/verifications' })
  if (lowBalance.length || frozen.length) alerts.push({ id: 'accounts', severity: 'info', area: 'accounts', title: `${lowBalance.length} low balance · ${frozen.length} frozen`, detail: [...lowBalance.map((a) => a.name), ...frozen.map((a) => a.name)].join(', '), href: '/admin/accounts?attention=1' })

  const feed: CockpitData['feed'] = []
  for (const o of repo.orders.recent(80)) {
    const e = [...o.events].reverse().find((x) => ['needs_review', 'failover', 'completed', 'rejected', 'margin_guard', 'refund', 'verification'].includes(x.type))
    if (e) feed.push({ id: e.id, at: e.at, tone: e.tone, title: `${o.ref} · ${e.title}`, detail: o.serviceName, href: `/admin/orders/${o.id}` })
  }
  for (const a of repo.audit.all().slice(0, 20)) feed.push({ id: a.id, at: a.at, tone: a.severity === 'critical' ? 'danger' : a.severity === 'warning' ? 'warning' : 'neutral', title: a.summary, detail: `${a.actor.name} · ${a.target.label}`, href: '/admin/system/audit' })
  feed.sort((a, b) => (a.at < b.at ? 1 : -1))

  return {
    generatedAt: ctx.clock.iso(),
    orders: { today: todayN, yesterdaySameTime: ySame, completedToday, rejectedToday, successRate24h: ok24 + bad24 ? +((ok24 / (ok24 + bad24)) * 100).toFixed(1) : 100, medianProcessingSec: durations.length ? Math.round(durations[Math.floor(durations.length / 2)]!) : 0, processing: counts.processing ?? 0, queued: counts.queued ?? 0, needsReview: nr, awaitingPayment: counts.awaiting_payment ?? 0, oldestReviewAt: oldestReview },
    money: { revenueToday: revenue, costToday: cost, marginToday: (revenue - cost) as Micros, marginPct: revenue ? +(((revenue - cost) / revenue) * 100).toFixed(1) : 0, heldTotal: sumHeld(rt), capturedToday: revenue, refundsToday, walletLiability },
    ledger: { status: report.status, warnings: report.checks.filter((c) => c.status === 'warn').length, failures: report.checks.filter((c) => c.status === 'fail').length, checkedAt: report.checkedAt },
    suppliers: suppliers.map((s) => ({ id: s.supplier.id, name: s.supplier.name, driver: s.driver.name, health: s.health, successRate: s.metrics.successRate, latencyP50: s.metrics.latencyP50, balance: s.supplier.reportedBalance, threshold: s.supplier.lowBalanceThreshold, drift: s.reconciliation.drift, circuit: s.supplier.circuit.state })),
    catalog: { unavailable, negativeMargin: negative, lowMargin, pendingSyncChanges: pendingSync },
    api: { requests24h: req24, errors24h: err24, errorRate: req24 ? +((err24 / req24) * 100).toFixed(2) : 0, dhruRequests24h: dhru24 },
    webhooks: { failingEndpoints, failed24h: failed24, retrying, delivered24h: delivered24 },
    accounts: { lowBalance, frozen },
    verifications: { open: verOpen, awaitingSupplier: verAwait },
    alerts: alerts.sort((a, b) => ['critical', 'warning', 'info'].indexOf(a.severity) - ['critical', 'warning', 'info'].indexOf(b.severity)),
    throughput: buckets,
    feed: feed.slice(0, 16),
  }
}

/* ------------------------------------------------------------------------- */
/*  Orders                                                                   */
/* ------------------------------------------------------------------------- */
const RANGE: Record<string, number> = { '24h': DAY, '7d': 7 * DAY, '30d': 30 * DAY }

function filterOrders(rt: Runtime, q: Record<string, string>) {
  const since = q.range && RANGE[q.range] ? rt.clock.now() - RANGE[q.range]! : 0
  return rt.repo.orders.recent().filter((o) => {
    if (since && ts(o.createdAt) < since) return false
    if (q.status === 'open') {
      if (!OPEN_STATUSES.includes(o.status)) return false
    } else if (q.status && o.status !== (q.status as OrderStatus)) return false
    if (q.financial && o.financialStatus !== (q.financial as FinancialStatus)) return false
    if (q.channel && o.channel !== (q.channel as OrderChannel)) return false
    if (q.accountId && o.accountId !== q.accountId) return false
    if (q.serviceId && o.serviceId !== q.serviceId) return false
    if (q.supplierId && !o.attempts.some((a) => a.supplierId === q.supplierId)) return false
    if (q.failover === 'true' && o.attempts.length < 2) return false
    if (q.scenario && o.scenario !== q.scenario) return false
    if (q.search) {
      const acct = rt.repo.accounts.get(o.accountId)
      if (!matches([o.ref, o.id, o.serviceName, acct?.name, acct?.email, o.clientReference, o.idempotencyKey, ...Object.values(o.input), ...o.attempts.map((a) => a.externalRef)], q.search)) return false
    }
    return true
  })
}

export const adminOpsRoutes: MockRoute[] = [
  r('GET', '/admin/cockpit', (rt) => cockpit(rt)),

  r('GET', '/admin/orders', (rt, { query }) => {
    const page = paginate(filterOrders(rt, query), query, Number(query.pageSize ?? 25))
    return { ...page, items: page.items.map((o) => orderRow(rt, o)) }
  }),
  r('GET', '/admin/orders/stats', (rt) => {
    const c: Record<string, number> = { all: 0, open: 0 }
    for (const o of rt.repo.orders.all()) {
      c.all!++
      c[o.status] = (c[o.status] ?? 0) + 1
      if (OPEN_STATUSES.includes(o.status)) c.open!++
      if (o.attempts.length > 1) c.failover = (c.failover ?? 0) + 1
      c[`fin_${o.financialStatus}`] = (c[`fin_${o.financialStatus}`] ?? 0) + 1
    }
    return c
  }),
  r('GET', '/admin/orders/:id', (rt, { params }) => orderDetail(rt, findOrder(rt, params.id!))),
  r<Pick<PlaceOrderInput, 'accountId' | 'serviceId' | 'idempotencyKey' | 'clientReference'> & Partial<Pick<PlaceOrderInput, 'input'>>>('POST', '/admin/orders', (rt, { body }) => {
    requirePermission(rt.ctx, adminActor(rt), 'orders.manage')
    const res = placeOrder(rt.ctx, { accountId: body.accountId, serviceId: body.serviceId, input: body.input ?? {}, channel: 'admin', actor: adminActor(rt), idempotencyKey: body.idempotencyKey ?? null, clientReference: body.clientReference ?? null, payment: { mode: 'wallet' } })
    return orderRow(rt, res.order)
  }),
  r<BodyFor<typeof cancelOrder, 'orderId', 'reason'> | undefined>('POST', '/admin/orders/:id/cancel', (rt, { params, body }) => orderRow(rt, cancelOrder(rt.ctx, { orderId: findOrder(rt, params.id!).id, actor: adminActor(rt), reason: body?.reason || 'Cancelled by operator' }))),
  r<BodyFor<typeof refundOrder, 'orderId' | 'verificationId', 'reason'>>('POST', '/admin/orders/:id/refund', (rt, { params, body }) => refundOrder(rt.ctx, { orderId: findOrder(rt, params.id!).id, amount: body.amount, destination: body.destination, reason: body.reason ?? '', actor: adminActor(rt), idempotencyKey: body.idempotencyKey })),
  r('POST', '/admin/orders/:id/review/lookup', (rt, { params }) => orderDetail(rt, lookupSupplier(rt.ctx, { orderId: findOrder(rt, params.id!).id, actor: adminActor(rt) }))),
  r<BodyFor<typeof confirmNotReceived, 'orderId', 'then'>>('POST', '/admin/orders/:id/review/confirm-not-received', (rt, { params, body }) => orderDetail(rt, confirmNotReceived(rt.ctx, { orderId: findOrder(rt, params.id!).id, reason: body.reason, then: body.then ?? 'retry', actor: adminActor(rt) }))),
  r<BodyFor<typeof enterSupplierReference, 'orderId'>>('POST', '/admin/orders/:id/review/reference', (rt, { params, body }) => orderDetail(rt, enterSupplierReference(rt.ctx, { orderId: findOrder(rt, params.id!).id, externalRef: body.externalRef, reason: body.reason, actor: adminActor(rt) }))),
  r<BodyFor<typeof resolveManually, 'orderId'>>('POST', '/admin/orders/:id/review/resolve', (rt, { params, body }) => orderDetail(rt, resolveManually(rt.ctx, { orderId: findOrder(rt, params.id!).id, outcome: body.outcome, reason: body.reason, result: body.result, actor: adminActor(rt) }))),

  /* Verifications */
  r('GET', '/admin/verifications', (rt, { query }) => {
    const rows = rt.repo.verifications
      .filter((v) => !query.status || v.status === query.status || (query.status === 'active' && (v.status === 'open' || v.status === 'awaiting_supplier')))
      .map((v) => {
        const o = rt.repo.orders.get(v.orderId)
        const acct = rt.repo.accounts.get(v.accountId)
        const att = o?.attempts.find((a) => a.state === 'succeeded')
        return { verification: v, orderRef: o?.ref ?? '', orderId: v.orderId, serviceName: o?.serviceName ?? '', accountName: acct?.name ?? '', price: o?.price.amount ?? 0, refunded: o?.refundedTotal ?? 0, supplierName: att ? (rt.repo.suppliers.get(att.supplierId)?.name ?? '') : '', result: o?.result?.summary ?? null }
      })
    return rows
  }),
  r('POST', '/admin/verifications/:id/recheck', (rt, { params }) => recheckSupplier(rt.ctx, { verificationId: params.id!, actor: adminActor(rt) })),
  r('POST', '/admin/verifications/:id/request-supplier', (rt, { params }) => requestSupplierVerification(rt.ctx, { verificationId: params.id!, actor: adminActor(rt) })),
  r<BodyFor<typeof approveVerificationRefund, 'verificationId', 'destination' | 'note'>>('POST', '/admin/verifications/:id/approve', (rt, { params, body }) => approveVerificationRefund(rt.ctx, { verificationId: params.id!, amount: body.amount, destination: body.destination ?? 'wallet', note: body.note ?? '', actor: adminActor(rt) })),
  r<BodyFor<typeof rejectVerification, 'verificationId', 'note'>>('POST', '/admin/verifications/:id/reject', (rt, { params, body }) => rejectVerification(rt.ctx, { verificationId: params.id!, note: body.note ?? '', actor: adminActor(rt) })),

  /* Accounts */
  r('GET', '/admin/accounts', (rt, { query }) => {
    const rows = rt.repo.accounts
      .filter((a) => {
        if (query.kind === 'customer' && a.kind !== 'customer') return false
        if (query.kind === 'guest' && a.kind !== 'guest') return false
        if (query.tier && a.tier !== (query.tier as AccountTier)) return false
        if (query.status && a.status !== query.status) return false
        if (query.pricingTierId && a.pricingTierId !== query.pricingTierId) return false
        return matches([a.name, a.email, a.number, a.contactName, a.country], query.search)
      })
      .map((a) => accountRow(rt, a))
      .filter((x) => !query.attention || x.lowBalance || x.account.status === 'frozen')
      .sort((a, b) => b.orders30d - a.orders30d)
    return paginate(rows, query, Number(query.pageSize ?? 50))
  }),
  r('GET', '/admin/accounts/:id', (rt, { params }) => {
    const a = rt.repo.accounts.require(params.id!)
    const row = accountRow(rt, a)
    const orders = rt.repo.orders.recent().filter((o) => o.accountId === a.id)
    return {
      ...row,
      members: rt.repo.members.filter((m) => m.accountId === a.id),
      apiKeys: rt.repo.apiKeys.filter((k) => k.accountId === a.id),
      webhooks: rt.repo.webhookEndpoints.filter((w) => w.accountId === a.id),
      recentOrders: orders.slice(0, 25).map((o) => orderRow(rt, o)),
      wallet: walletLines(rt.ctx, a.id).slice(0, 60),
      payments: rt.repo.payments.filter((p) => p.accountId === a.id).slice(0, 30),
      refunds: rt.repo.refunds.filter((x) => x.accountId === a.id),
      verifications: rt.repo.verifications.filter((v) => v.accountId === a.id),
      dhruUsername: a.channels.dhru ? a.email : null,
    }
  }),
  r<BodyFor<typeof createAccount>>('POST', '/admin/accounts', (rt, { body }) => accountRow(rt, createAccount(rt.ctx, { ...body, actor: adminActor(rt) }))),
  r<{ patch: AccountPatch; reason?: string }>('PATCH', '/admin/accounts/:id', (rt, { params, body }) => accountRow(rt, updateAccount(rt.ctx, { accountId: params.id!, patch: body.patch, reason: body.reason, actor: adminActor(rt) }))),
  r<BodyFor<typeof setAccountStatus, 'accountId', 'reason'>>('POST', '/admin/accounts/:id/status', (rt, { params, body }) => accountRow(rt, setAccountStatus(rt.ctx, { accountId: params.id!, status: body.status, reason: body.reason ?? '', actor: adminActor(rt) }))),
  r<BodyFor<typeof adjustAccountWallet, 'accountId', 'reason'>>('POST', '/admin/accounts/:id/adjust', (rt, { params, body }) => adjustAccountWallet(rt.ctx, { accountId: params.id!, amount: body.amount, reason: body.reason ?? '', actor: adminActor(rt), idempotencyKey: body.idempotencyKey })),
  r<BodyFor<typeof createTopUp, 'accountId', 'method'>>('POST', '/admin/accounts/:id/top-up', (rt, { params, body }) => {
    const actor = adminActor(rt)
    const intent = createTopUp(rt.ctx, { accountId: params.id!, amount: body.amount, method: body.method ?? 'manual', actor })
    if (intent.method === 'bank_transfer' || intent.method === 'manual') return confirmBankTransfer(rt.ctx, { intentId: intent.id, actor })
    return completePayment(rt.ctx, { intentId: intent.id, outcome: 'succeed' })
  }),
  r<BodyFor<typeof inviteMember, 'accountId', 'name'>>('POST', '/admin/accounts/:id/members', (rt, { params, body }) => inviteMember(rt.ctx, { accountId: params.id!, name: body.name ?? '', email: body.email, role: body.role, actor: adminActor(rt) })),
  r<CommandParams<typeof updateMember>['patch']>('PATCH', '/admin/members/:id', (rt, { params, body }) => updateMember(rt.ctx, { memberId: params.id!, patch: body, actor: adminActor(rt) })),
  r('GET', '/admin/accounts-summary', (rt) => {
    const all = rt.repo.accounts.all()
    const byTier: Record<string, number> = {}
    for (const a of all) if (a.kind === 'customer') byTier[a.tier] = (byTier[a.tier] ?? 0) + 1
    return { total: all.length, guests: all.filter((a) => a.kind === 'guest').length, byTier, frozen: all.filter((a) => a.status === 'frozen').length, pending: all.filter((a) => a.status === 'pending').length, walletLiability: sumBy(rt.repo.ledger.balances('customer_available:'), (b) => b.balance), held: sumHeld(rt) }
  }),
]
