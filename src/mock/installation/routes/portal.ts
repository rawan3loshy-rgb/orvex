/**
 * Reseller portal API — scoped to the signed-in account member.
 * Orders placed here enter the same PlaceOrder command as every other channel.
 */
import type { MockRoute } from '@/api/mockRouter'
import { add, sumBy, ZERO, type Micros } from '@/core/money'
import type { Account } from '@/core/domain'
import { forbidden, notFound } from '@/core/errors'
import { validateField } from '@/core/fields'
import { cancelOrder, placeOrder, type PlaceOrderInput } from '@/core/commands/orders'
import { openVerification } from '@/core/commands/verification'
import { completePayment, createTopUp } from '@/core/commands/payments'
import { createApiKey, createWebhookEndpoint, deleteWebhookEndpoint, revokeApiKey, sendTestWebhook, updateWebhookEndpoint } from '@/core/commands/developer'
import { inviteMember, updateMember } from '@/core/commands/accounts'
import { quote } from '@/core/services/pricing'
import { availability } from '@/core/services/routing'
import { walletBalance, walletLines } from '@/core/services/ledger'
import type { BulkLineResult, PortalDashboard, PortalMe, PortalService, StatementMonth } from '@/types/installation'
import { memberActor, type Runtime } from '../runtime'
import { portalOrder } from '../views'
import { DAY, matches, paginate, r, startOfToday, ts, type BodyFor, type CommandParams } from './util'

function session(rt: Runtime) {
  const member = rt.repo.members.require(rt.sessions.portalMemberId)
  const account = rt.repo.accounts.require(member.accountId)
  return { member, account }
}

/** Member roles are enforced server-side, not only hidden in the UI. */
function requireRole(rt: Runtime, roles: string[], what: string) {
  const { member } = session(rt)
  if (!roles.includes(member.role)) throw forbidden('member_role', `The ${member.role} role cannot ${what}`)
}
const ORDER_ROLES = ['owner', 'admin', 'orderer']
const FINANCE_ROLES = ['owner', 'admin', 'finance']

function allowed(a: Account, serviceId: string, categoryId: string) {
  const s = a.serviceAccess
  return s.mode === 'all' || (s.mode === 'categories' ? s.categoryIds.includes(categoryId) : s.serviceIds.includes(serviceId))
}

function portalService(rt: Runtime, a: Account, serviceId: string): PortalService {
  const s = rt.repo.services.require(serviceId)
  const rev = rt.repo.revisions.require(s.revisionId)
  const q = quote(rt.ctx, s.id, a.pricingTierId)
  const av = availability(rt.ctx, s, q.amount)
  return { id: s.id, code: s.code, name: s.name, categoryId: s.categoryId, categoryName: rt.repo.categories.get(s.categoryId)?.name ?? '', summary: s.summary, processing: s.processing, turnaround: s.turnaround, price: q.amount, retailPrice: quote(rt.ctx, s.id, 'tier_retail').amount, available: av.available, unavailableReason: av.reason, fields: rev.fields, resultSchema: rev.resultSchema, revision: rev.number, tags: s.tags }
}

function ownOrder(rt: Runtime, account: Account, id: string) {
  const o = rt.repo.orders.byRef(id) ?? rt.repo.orders.get(id)
  if (!o || o.accountId !== account.id) throw notFound('Order', id)
  return o
}

function canManageApi(role: string) {
  return ['owner', 'admin', 'developer'].includes(role)
}

export const portalRoutes: MockRoute[] = [
  r('GET', '/portal/me', (rt): PortalMe => {
    const { member, account } = session(rt)
    return { member, account, balance: walletBalance(rt.ctx, account.id), tierName: rt.repo.tiers.get(account.pricingTierId)?.name ?? '', canManageApi: canManageApi(member.role), canOrder: ['owner', 'admin', 'orderer'].includes(member.role), canSeeFinance: ['owner', 'admin', 'finance'].includes(member.role), dhruUsername: account.channels.dhru ? account.email : null }
  }),
  r('GET', '/portal/dashboard', (rt): PortalDashboard => {
    const { account } = session(rt)
    const now = rt.clock.now()
    const today = startOfToday(now)
    const orders = rt.repo.orders.recent().filter((o) => o.accountId === account.id)
    const days = Array.from({ length: 14 }, (_, i) => ({ t: new Date(today - (13 - i) * DAY).toISOString(), spend: 0, orders: 0 }))
    const top = new Map<string, number>()
    const durations: number[] = []
    let spend30 = ZERO
    for (const o of orders) {
      const t = ts(o.createdAt)
      const idx = Math.floor((t - (today - 13 * DAY)) / DAY)
      if (idx >= 0 && idx < 14) {
        days[idx]!.orders++
        if (o.status === 'completed') days[idx]!.spend += (o.price.amount - o.refundedTotal) / 1e6
      }
      if (t >= now - 30 * DAY) {
        if (o.status === 'completed') spend30 = add(spend30, (o.price.amount - o.refundedTotal) as Micros)
        top.set(o.serviceName, (top.get(o.serviceName) ?? 0) + 1)
      }
      if (o.status === 'completed' && o.completedAt && t >= now - 7 * DAY) durations.push((ts(o.completedAt) - t) / 1000)
    }
    durations.sort((a, b) => a - b)
    return {
      ordersToday: orders.filter((o) => ts(o.createdAt) >= today).length,
      processing: orders.filter((o) => ['queued', 'processing', 'needs_review'].includes(o.status)).length,
      completed7d: orders.filter((o) => o.status === 'completed' && ts(o.createdAt) >= now - 7 * DAY).length,
      rejected7d: orders.filter((o) => o.status === 'rejected' && ts(o.createdAt) >= now - 7 * DAY).length,
      spend30d: spend30,
      avgTurnaroundSec: durations.length ? Math.round(durations[Math.floor(durations.length / 2)]!) : 0,
      recent: orders.slice(0, 8).map((o) => portalOrder(rt, o)),
      spendByDay: days.map((d) => ({ ...d, spend: +d.spend.toFixed(2) })),
      topServices: [...top.entries()].map(([name, n]) => ({ name, orders: n })).sort((a, b) => b.orders - a.orders).slice(0, 5),
    }
  }),
  r('GET', '/portal/services', (rt, { query }) => {
    const { account } = session(rt)
    return rt.repo.services
      .filter((s) => s.status === 'active' && s.visibility.portal && allowed(account, s.id, s.categoryId) && (!query.categoryId || s.categoryId === query.categoryId) && matches([s.name, s.code, ...s.tags], query.search))
      .map((s) => portalService(rt, account, s.id))
  }),
  r('GET', '/portal/services/:id', (rt, { params }) => {
    const { account } = session(rt)
    const s = rt.repo.services.find((x) => x.id === params.id || x.code === params.id)
    if (!s || !allowed(account, s.id, s.categoryId)) throw notFound('Service', params.id!)
    return portalService(rt, account, s.id)
  }),
  r('GET', '/portal/orders', (rt, { query }) => {
    const { account } = session(rt)
    const items = rt.repo.orders
      .recent()
      .filter((o) => o.accountId === account.id)
      .filter((o) => !query.status || (query.status === 'processing' ? ['queued', 'processing', 'needs_review'].includes(o.status) : o.status === query.status))
      .filter((o) => matches([o.ref, o.serviceName, o.clientReference, ...Object.values(o.input)], query.search))
    const page = paginate(items, query, 25)
    return { ...page, items: page.items.map((o) => portalOrder(rt, o)) }
  }),
  r('GET', '/portal/orders/:id', (rt, { params }) => {
    const { account } = session(rt)
    return portalOrder(rt, ownOrder(rt, account, params.id!))
  }),
  r<Pick<PlaceOrderInput, 'serviceId' | 'idempotencyKey' | 'clientReference'> & Partial<Pick<PlaceOrderInput, 'input'>>>('POST', '/portal/orders', (rt, { body }) => {
    requireRole(rt, ORDER_ROLES, 'place orders')
    const { account } = session(rt)
    const res = placeOrder(rt.ctx, { accountId: account.id, serviceId: body.serviceId, input: body.input ?? {}, channel: 'portal', actor: memberActor(rt), idempotencyKey: body.idempotencyKey ?? null, clientReference: body.clientReference ?? null, payment: { mode: 'wallet' } })
    return portalOrder(rt, res.order)
  }),
  r<{ serviceId: string; text?: string }>('POST', '/portal/orders/bulk/validate', (rt, { body }) => {
    const { account } = session(rt)
    const svc = portalService(rt, account, body.serviceId)
    const imeiField = svc.fields.find((f) => f.type === 'gsm.imei' || f.type === 'gsm.serial')
    if (!imeiField) throw forbidden('bulk_not_supported', 'Bulk ordering needs an IMEI or serial field')
    const lines: string[] = String(body.text ?? '').split(/[\n,;]+/).map((x: string) => x.trim()).filter(Boolean)
    const seen = new Set<string>()
    const out: BulkLineResult[] = lines.slice(0, 500).map((raw, i) => {
      const v = validateField(imeiField, raw)
      const dup = seen.has(v.value)
      seen.add(v.value)
      return { line: i + 1, imei: v.value, ok: !v.error && !dup, error: dup ? 'Duplicate in this batch' : (v.error ?? undefined), checks: v.checks }
    })
    const okCount = out.filter((l) => l.ok).length
    return { lines: out, ok: okCount, invalid: out.length - okCount, unitPrice: svc.price, total: (svc.price * okCount) as Micros, balance: walletBalance(rt.ctx, account.id) }
  }, { readOnly: true }),
  r<{ serviceId: string; imeis: string[]; batchId?: string; clientReference?: string; extra?: Record<string, string> }>('POST', '/portal/orders/bulk', (rt, { body }) => {
    requireRole(rt, ORDER_ROLES, 'place orders')
    const { account } = session(rt)
    const svc = portalService(rt, account, body.serviceId)
    const imeiField = svc.fields.find((f) => f.type === 'gsm.imei' || f.type === 'gsm.serial')!
    const batch = body.batchId ?? rt.ctx.ids.token(10)
    const results: BulkLineResult[] = []
    body.imeis.forEach((imei, i) => {
      const v = validateField(imeiField, imei)
      if (v.error) return results.push({ line: i + 1, imei: v.value, ok: false, error: v.error, checks: v.checks })
      try {
        const input: Record<string, string> = { [imeiField.key]: v.value, ...(body.extra ?? {}) }
        const res = placeOrder(rt.ctx, { accountId: account.id, serviceId: svc.id, input, channel: 'portal', actor: memberActor(rt), idempotencyKey: `bulk:${batch}:${v.value}`, clientReference: body.clientReference ? `${body.clientReference}-${i + 1}` : null, payment: { mode: 'wallet' } })
        results.push({ line: i + 1, imei: v.value, ok: true, orderRef: res.order.ref, checks: v.checks })
      } catch (e) {
        results.push({ line: i + 1, imei: v.value, ok: false, error: (e as Error).message, checks: v.checks })
      }
    })
    return { batchId: batch, results, placed: results.filter((x) => x.ok).length }
  }),
  r('POST', '/portal/orders/:id/cancel', (rt, { params }) => {
    requireRole(rt, ORDER_ROLES, 'cancel orders')
    const { account } = session(rt)
    return portalOrder(rt, cancelOrder(rt.ctx, { orderId: ownOrder(rt, account, params.id!).id, actor: memberActor(rt), reason: 'Cancelled in the reseller portal' }))
  }),
  r<BodyFor<typeof openVerification, 'orderId' | 'at', 'reason' | 'message'>>('POST', '/portal/orders/:id/verify', (rt, { params, body }) => {
    const { account } = session(rt)
    return openVerification(rt.ctx, { orderId: ownOrder(rt, account, params.id!).id, reason: body.reason ?? 'other', message: body.message ?? '', actor: memberActor(rt) })
  }),

  /* Wallet */
  r('GET', '/portal/wallet', (rt, { query }) => {
    requireRole(rt, FINANCE_ROLES, 'view the wallet statement')
    const { account } = session(rt)
    const lines = walletLines(rt.ctx, account.id).filter((l) => !query.kind || l.kind === query.kind)
    return { balance: walletBalance(rt.ctx, account.id), ...paginate(lines, query, 30), payments: rt.repo.payments.filter((p) => p.accountId === account.id && p.purpose === 'top_up').slice(0, 10) }
  }),
  r<BodyFor<typeof createTopUp, 'accountId'>>('POST', '/portal/wallet/top-up', (rt, { body }) => {
    requireRole(rt, FINANCE_ROLES, 'top up the wallet')
    const { account } = session(rt)
    return createTopUp(rt.ctx, { accountId: account.id, amount: body.amount, method: body.method, actor: memberActor(rt) })
  }),
  r<BodyFor<typeof completePayment, 'intentId', 'outcome'>>('POST', '/portal/payments/:id/complete', (rt, { params, body }) => {
    const { account } = session(rt)
    const intent = rt.repo.payments.require(params.id!)
    if (intent.accountId !== account.id) throw notFound('Payment', params.id!)
    const forced = rt.sim.nextPayment !== 'auto' ? rt.sim.nextPayment : null
    if (forced) rt.sim.nextPayment = 'auto'
    return completePayment(rt.ctx, { intentId: intent.id, outcome: forced ?? body.outcome ?? 'succeed' })
  }),
  r('GET', '/portal/statements', (rt): StatementMonth[] => {
    requireRole(rt, FINANCE_ROLES, 'view statements')
    const { account } = session(rt)
    const lines = walletLines(rt.ctx, account.id).slice().reverse()
    const months = new Map<string, StatementMonth>()
    let running = 0
    for (const l of lines) {
      const m = l.at.slice(0, 7)
      let row = months.get(m)
      if (!row) {
        row = { month: m, opening: running as Micros, topUps: ZERO, orders: ZERO, refunds: ZERO, adjustments: ZERO, closing: ZERO, lines: 0 }
        months.set(m, row)
      }
      row.lines++
      const net = l.available + l.held
      if (l.kind === 'top_up') row.topUps = add(row.topUps, l.available)
      else if (l.kind === 'refund') row.refunds = add(row.refunds, l.available)
      else if (l.kind === 'adjustment' || l.kind === 'chargeback') row.adjustments = add(row.adjustments, l.available)
      else if (l.kind === 'order_settlement') row.orders = add(row.orders, l.held)
      running += net
      row.closing = running as Micros
    }
    return [...months.values()].reverse()
  }),

  /* API keys & webhooks */
  r('GET', '/portal/api-keys', (rt) => {
    const { account } = session(rt)
    return rt.repo.apiKeys.filter((k) => k.accountId === account.id)
  }),
  r<BodyFor<typeof createApiKey, 'accountId', 'environment' | 'ipAllowlist' | 'rateLimitPerMin' | 'dhruCompat' | 'expiresInDays'>>('POST', '/portal/api-keys', (rt, { body }) => {
    const { account } = session(rt)
    return createApiKey(rt.ctx, { accountId: account.id, name: body.name, environment: body.environment ?? 'live', scopes: body.scopes, ipAllowlist: body.ipAllowlist ?? [], rateLimitPerMin: body.rateLimitPerMin ?? 600, dhruCompat: !!body.dhruCompat, expiresInDays: body.expiresInDays ?? null, actor: memberActor(rt) })
  }),
  r('POST', '/portal/api-keys/:id/revoke', (rt, { params }) => revokeApiKey(rt.ctx, { keyId: params.id!, actor: memberActor(rt) })),
  r('GET', '/portal/webhooks', (rt) => {
    const { account } = session(rt)
    return rt.repo.webhookEndpoints.filter((w) => w.accountId === account.id).map((w) => ({ ...w, recent: rt.repo.webhookDeliveries.filter((d) => d.endpointId === w.id).slice(0, 15) }))
  }),
  r<BodyFor<typeof createWebhookEndpoint, 'accountId', 'description'>>('POST', '/portal/webhooks', (rt, { body }) => {
    const { account } = session(rt)
    return createWebhookEndpoint(rt.ctx, { accountId: account.id, url: body.url, description: body.description ?? '', events: body.events, actor: memberActor(rt) })
  }),
  r<CommandParams<typeof updateWebhookEndpoint>['patch']>('PATCH', '/portal/webhooks/:id', (rt, { params, body }) => updateWebhookEndpoint(rt.ctx, { endpointId: params.id!, patch: body, actor: memberActor(rt) })),
  r('DELETE', '/portal/webhooks/:id', (rt, { params }) => {
    deleteWebhookEndpoint(rt.ctx, { endpointId: params.id!, actor: memberActor(rt) })
    return { ok: true }
  }),
  r('POST', '/portal/webhooks/:id/test', (rt, { params }) => sendTestWebhook(rt.ctx, { endpointId: params.id!, actor: memberActor(rt) })),
  r('GET', '/portal/api-logs', (rt, { query }) => {
    const { account } = session(rt)
    return paginate(rt.repo.apiLogs.filter((l) => l.accountId === account.id), query, 30)
  }),
  r('GET', '/portal/members', (rt) => {
    const { account } = session(rt)
    return rt.repo.members.filter((m) => m.accountId === account.id)
  }),
  r<BodyFor<typeof inviteMember, 'accountId', 'name'>>('POST', '/portal/members', (rt, { body }) => {
    const { account, member } = session(rt)
    if (!['owner', 'admin'].includes(member.role)) throw forbidden('member_role', 'Only owners and admins can invite members')
    return inviteMember(rt.ctx, { accountId: account.id, name: body.name ?? '', email: body.email, role: body.role, actor: memberActor(rt) })
  }),
  r<CommandParams<typeof updateMember>['patch']>('PATCH', '/portal/members/:id', (rt, { params, body }) => {
    const { member } = session(rt)
    if (!['owner', 'admin'].includes(member.role)) throw forbidden('member_role', 'Only owners and admins can change members')
    return updateMember(rt.ctx, { memberId: params.id!, patch: body, actor: memberActor(rt) })
  }),
  r('GET', '/portal/summary-spend', (rt) => {
    const { account } = session(rt)
    return sumBy(rt.repo.orders.filter((o) => o.accountId === account.id && o.status === 'completed'), (o) => o.price.amount)
  }),
]
