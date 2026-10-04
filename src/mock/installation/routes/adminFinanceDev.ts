/** Admin API — ledger, integrity, reconciliation, payments, developer (keys, logs, webhooks, consoles, DHRU), notifications, audit. */
import type { MockRoute } from '@/api/mockRouter'
import { sumBy, type Micros } from '@/core/money'
import { LEDGER_GROUPS, type LedgerGroup, type NotificationChannelConfig, type NotificationRoute, type PaymentMethodConfig } from '@/core/domain'
import { integrityReport } from '@/core/services/integrity'
import { replay } from '@/core/services/webhooks'
import { requirePermission } from '@/core/services/access'
import { confirmBankTransfer, openChargeback, replayGatewayWebhook, resolveChargeback } from '@/core/commands/payments'
import { createApiKey, createWebhookEndpoint, deleteWebhookEndpoint, revokeApiKey, sendTestWebhook, updateApiKey, updateWebhookEndpoint } from '@/core/commands/developer'
import { DHRU_ACTIONS, DHRU_MAPPING_TABLE, DHRU_STATUS_LABEL } from '@/core/edge/dhru'
import type { DhruOverview, LedgerOverview, ReconciliationRow } from '@/types/installation'
import { adminActor, type Runtime } from '../runtime'
import { supplierView } from '../views'
import { handleNative } from '../api/native'
import { handleDhru } from '../api/dhru'
import { DAY, matches, paginate, r, startOfToday, ts, type BodyFor, type CommandParams } from './util'

function explainDrift(v: ReturnType<typeof supplierView>): string {
  const d = v.reconciliation
  if (d.drift === 0) return 'Supplier-reported balance matches the ledger after in-flight orders.'
  const unknownCost = d.unknown.reduce((a, u) => a + u.cost, 0)
  if (d.drift < 0 && unknownCost && Math.abs(d.drift + unknownCost) < 10_000) return `The supplier charged ${d.unknown.length > 1 ? 'orders' : 'an order'} we have not settled: ${d.unknown.map((u) => u.orderRef).join(', ')} — outcome UNKNOWN. The supplier most likely processed ${d.unknown.length > 1 ? 'them' : 'it'}; resolve the review to settle and the drift disappears.`
  if (d.drift < 0 && unknownCost) return `Part of the drift is explained by UNKNOWN orders (${d.unknown.map((u) => u.orderRef).join(', ')}). The rest needs investigation (supplier statement).`
  if (d.drift > 0) return 'The supplier reports more credit than expected — typically a supplier-side refund or goodwill credit that has not been recorded in the ledger yet.'
  return 'The supplier reports less credit than expected — check the supplier statement for charges not linked to an ORVEX order.'
}

export function apiLogStats(rt: Runtime) {
  const since = rt.clock.now() - DAY
  const lat: number[] = []
  let errors = 0
  let native = 0
  let dhru = 0
  const by = new Map<string, number>()
  for (const l of rt.repo.apiLogs.all()) {
    if (ts(l.at) < since) break
    lat.push(l.latencyMs)
    if (l.status >= 400 || l.errorCode) errors++
    if (l.protocol === 'dhru') dhru++
    else native++
    by.set(l.endpoint, (by.get(l.endpoint) ?? 0) + 1)
  }
  lat.sort((a, b) => a - b)
  const q = (p: number) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * p))]! : 0)
  return { requests24h: lat.length, errors24h: errors, errorRate: lat.length ? +((errors / lat.length) * 100).toFixed(2) : 0, p50: q(0.5), p95: q(0.95), byEndpoint: [...by.entries()].map(([endpoint, count]) => ({ endpoint, count })).sort((a, b) => b.count - a.count), byProtocol: { native, dhru } }
}

export const adminFinanceDevRoutes: MockRoute[] = [
  /* Ledger */
  r('GET', '/admin/ledger/transactions', (rt, { query }) => {
    const txs = rt.repo.ledger.transactions((t) => {
      if (query.kind && t.kind !== query.kind) return false
      if (query.account && !t.entries.some((e) => e.account === query.account || e.account.startsWith(`${query.account}:`))) return false
      if (query.accountId && t.accountId !== query.accountId) return false
      if (query.orderId && t.orderId !== query.orderId) return false
      if (query.supplierId && t.supplierId !== query.supplierId) return false
      if (query.search) {
        const o = t.orderId ? rt.repo.orders.get(t.orderId) : undefined
        if (!matches([t.ref, t.description, o?.ref, t.idempotencyKey, t.actor.name], query.search)) return false
      }
      return true
    })
    const page = paginate(txs, query, 30)
    return { ...page, items: page.items.map((t) => ({ ...t, orderRef: t.orderId ? (rt.repo.orders.get(t.orderId)?.ref ?? null) : null, accountName: t.accountId ? (rt.repo.accounts.get(t.accountId)?.name ?? null) : null })) }
  }),
  r('GET', '/admin/ledger/accounts', (rt): LedgerOverview => {
    const accounts = rt.repo.ledger.balances()
    const groups = (Object.keys(LEDGER_GROUPS) as LedgerGroup[]).map((g) => {
      const list = accounts.filter((a) => a.group === g)
      return { group: g, name: LEDGER_GROUPS[g].name, type: LEDGER_GROUPS[g].type, total: sumBy(list, (a) => a.balance), accounts: list.length }
    })
    const named = accounts.map((a) => {
      if (!a.subjectId) return a
      const label = rt.repo.accounts.get(a.subjectId)?.name ?? rt.repo.suppliers.get(a.subjectId)?.name ?? a.subjectId
      return { ...a, name: `${a.name} · ${label}` }
    })
    const rep = integrityReport(rt.ctx)
    return { groups, accounts: named, totals: { debits: rep.totals.debits, credits: rep.totals.credits, transactions: rep.totals.transactions, entries: rep.totals.entries } }
  }),
  r('GET', '/admin/ledger/integrity', (rt) => integrityReport(rt.ctx)),
  r('GET', '/admin/finance/reconciliation', (rt): ReconciliationRow[] => rt.repo.suppliers.all().map((s) => {
    const v = supplierView(rt, s.id)
    return { ...v, explanation: explainDrift(v) }
  })),
  r('GET', '/admin/finance/summary', (rt) => {
    const today = startOfToday(rt.clock.now())
    const since30 = rt.clock.now() - 30 * DAY
    const sumGroup = (prefix: string) => sumBy(rt.repo.ledger.balances(prefix), (b) => b.balance)
    let rev30 = 0
    let cost30 = 0
    for (const t of rt.repo.ledger.transactions((x) => x.kind === 'order_settlement' && ts(x.at) >= since30)) {
      for (const e of t.entries) {
        if (e.account === 'revenue') rev30 += e.amount
        if (e.account === 'cost_of_sales') cost30 += e.amount
      }
    }
    return {
      revenue: rt.repo.ledger.balance('revenue').balance,
      refunds: rt.repo.ledger.balance('refunds').balance,
      costOfSales: rt.repo.ledger.balance('cost_of_sales').balance,
      walletAvailable: sumGroup('customer_available:'),
      walletHeld: sumGroup('customer_held:'),
      gatewayClearing: sumGroup('gateway_clearing:'),
      supplierPrepaid: sumGroup('supplier_prepaid:'),
      bank: rt.repo.ledger.balance('bank').balance,
      revenue30d: rev30 as Micros,
      cost30d: cost30 as Micros,
      refundsToday: sumBy(rt.repo.refunds.filter((x) => ts(x.createdAt) >= today), (x) => x.amount),
    }
  }),

  /* Payments */
  r('GET', '/admin/payment-methods', (rt) => rt.repo.paymentMethods.all()),
  r<Pick<PaymentMethodConfig, 'enabled'>>('PATCH', '/admin/payment-methods/:id', (rt, { params, body }) => {
    requirePermission(rt.ctx, adminActor(rt), 'payments.manage')
    return rt.repo.paymentMethods.update(params.id!, { enabled: !!body.enabled })
  }),
  r('GET', '/admin/payments', (rt, { query }) => {
    const items = rt.repo.payments.filter((p) => (!query.status || p.status === query.status) && (!query.method || p.method === query.method) && (!query.purpose || p.purpose === query.purpose) && (!query.accountId || p.accountId === query.accountId) && (!query.intent || p.id === query.intent))
    const page = paginate(items, query, 30)
    return { ...page, items: page.items.map((p) => ({ ...p, accountName: rt.repo.accounts.get(p.accountId)?.name ?? p.accountId, orderRef: p.orderId ? (rt.repo.orders.get(p.orderId)?.ref ?? null) : null })) }
  }),
  r('POST', '/admin/payments/:id/confirm', (rt, { params }) => confirmBankTransfer(rt.ctx, { intentId: params.id!, actor: adminActor(rt) })),
  r<BodyFor<typeof openChargeback, 'intentId' | 'at', 'reason'>>('POST', '/admin/payments/:id/chargeback', (rt, { params, body }) => {
    requirePermission(rt.ctx, adminActor(rt), 'payments.manage')
    return openChargeback(rt.ctx, { intentId: params.id!, reason: body.reason ?? 'Cardholder dispute (simulated)' })
  }),
  r('POST', '/admin/payments/:id/replay-webhook', (rt, { params }) => replayGatewayWebhook(rt.ctx, params.id!)),
  r('GET', '/admin/refunds', (rt) => rt.repo.refunds.all().map((x) => ({ ...x, orderRef: x.orderId ? (rt.repo.orders.get(x.orderId)?.ref ?? null) : null, accountName: rt.repo.accounts.get(x.accountId)?.name ?? x.accountId }))),
  r('GET', '/admin/chargebacks', (rt) => rt.repo.chargebacks.all().map((x) => ({ ...x, accountName: rt.repo.accounts.get(x.accountId)?.name ?? x.accountId, paymentRef: rt.repo.payments.get(x.paymentIntentId)?.ref ?? '' }))),
  r<BodyFor<typeof resolveChargeback, 'chargebackId'>>('POST', '/admin/chargebacks/:id/resolve', (rt, { params, body }) => resolveChargeback(rt.ctx, { chargebackId: params.id!, outcome: body.outcome, actor: adminActor(rt) })),

  /* API keys */
  r('GET', '/admin/api-keys', (rt, { query }) => {
    const since = rt.clock.now() - DAY
    const counts = new Map<string, number>()
    for (const l of rt.repo.apiLogs.all()) {
      if (ts(l.at) < since) break
      if (l.apiKeyId) counts.set(l.apiKeyId, (counts.get(l.apiKeyId) ?? 0) + 1)
    }
    return rt.repo.apiKeys.filter((k) => (!query.accountId || k.accountId === query.accountId) && (!query.status || k.status === query.status)).map((k) => ({ ...k, accountName: rt.repo.accounts.get(k.accountId)?.name ?? k.accountId, requests24h: counts.get(k.id) ?? 0 }))
  }),
  r<BodyFor<typeof createApiKey>>('POST', '/admin/api-keys', (rt, { body }) => createApiKey(rt.ctx, { ...body, actor: adminActor(rt) })),
  r<BodyFor<typeof revokeApiKey, 'keyId'> | undefined>('POST', '/admin/api-keys/:id/revoke', (rt, { params, body }) => revokeApiKey(rt.ctx, { keyId: params.id!, reason: body?.reason, actor: adminActor(rt) })),
  r<CommandParams<typeof updateApiKey>['patch']>('PATCH', '/admin/api-keys/:id', (rt, { params, body }) => updateApiKey(rt.ctx, { keyId: params.id!, patch: body, actor: adminActor(rt) })),

  /* API logs */
  r('GET', '/admin/api-logs', (rt, { query }) => {
    const items = rt.repo.apiLogs.filter((l) => {
      if (query.protocol && l.protocol !== query.protocol) return false
      if (query.status === 'error' && !(l.status >= 400 || l.errorCode)) return false
      if (query.status === 'ok' && (l.status >= 400 || l.errorCode)) return false
      if (query.accountId && l.accountId !== query.accountId) return false
      if (query.keyId && l.apiKeyId !== query.keyId) return false
      return matches([l.path, l.endpoint, l.requestId, l.idempotencyKey, l.keyPrefix, l.errorCode, l.requestBody, rt.repo.accounts.get(l.accountId ?? '')?.name], query.search)
    })
    const page = paginate(items, query, 40)
    return { ...page, items: page.items.map((l) => ({ ...l, accountName: l.accountId ? (rt.repo.accounts.get(l.accountId)?.name ?? null) : null, orderRef: l.orderId ? (rt.repo.orders.get(l.orderId)?.ref ?? null) : null })) }
  }),
  r('GET', '/admin/api-logs/stats', (rt) => apiLogStats(rt)),

  /* Consoles — run the real handlers (state changes are real) */
  r<BodyFor<typeof handleNative, 'userAgent', 'headers'>>('POST', '/admin/console/native', (rt, { body }) => {
    const t = performance.now()
    const res = handleNative(rt, { method: body.method, path: body.path, headers: Object.fromEntries(Object.entries(body.headers ?? {}).map(([k, v]) => [k.toLowerCase(), String(v)])), query: body.query, body: body.body, ip: body.ip, userAgent: 'ORVEX API console' })
    return { ...res, latencyMs: Math.round(performance.now() - t) + 40 }
  }),
  r<BodyFor<typeof handleDhru, 'userAgent' | 'ip'>>('POST', '/admin/console/dhru', (rt, { body }) => {
    const t = performance.now()
    const res = handleDhru(rt, { username: body.username, apiaccesskey: body.apiaccesskey, action: body.action, parameters: body.parameters, userAgent: 'ORVEX DHRU console' })
    return { status: res.status, headers: { 'content-type': 'application/json' }, body: res.body, latencyMs: Math.round(performance.now() - t) + 40 }
  }),

  /* DHRU compatibility overview */
  r('GET', '/admin/dhru', (rt): DhruOverview => {
    const since = rt.clock.now() - DAY
    const since7 = rt.clock.now() - 7 * DAY
    const today = startOfToday(rt.clock.now())
    const keys = rt.repo.apiKeys.filter((k) => k.dhruCompat && k.status === 'active')
    const accounts = [...new Set(keys.map((k) => k.accountId))].map((id) => {
      const a = rt.repo.accounts.require(id)
      const key = keys.find((k) => k.accountId === id)!
      return { id, name: a.name, username: a.email, keyPrefix: key.prefix, lastUsedAt: key.lastUsedAt, orders7d: rt.repo.orders.count((o) => o.accountId === id && o.channel === 'dhru' && ts(o.createdAt) >= since7) }
    })
    const logs = rt.repo.apiLogs.filter((l) => l.protocol === 'dhru')
    return {
      enabled: rt.system.settings.api.dhruCompatEnabled,
      endpoint: rt.system.settings.api.dhruEndpoint,
      connectedAccounts: accounts.sort((a, b) => b.orders7d - a.orders7d),
      ordersToday: rt.repo.orders.count((o) => o.channel === 'dhru' && ts(o.createdAt) >= today),
      errors24h: logs.filter((l) => ts(l.at) >= since && l.errorCode).length,
      requests24h: logs.filter((l) => ts(l.at) >= since).length,
      mapping: DHRU_MAPPING_TABLE.map((m) => ({ dhru: m.dhru, label: DHRU_STATUS_LABEL[m.dhru], orvex: m.orvex, note: m.note })),
      actions: [...DHRU_ACTIONS],
      recent: logs.slice(0, 30),
    }
  }),

  /* Webhooks */
  r('GET', '/admin/webhooks', (rt) => {
    const since = rt.clock.now() - DAY
    return rt.repo.webhookEndpoints.all().map((w) => {
      const ds = rt.repo.webhookDeliveries.filter((d) => d.endpointId === w.id && ts(d.createdAt) >= since)
      return { ...w, accountName: w.accountId ? (rt.repo.accounts.get(w.accountId)?.name ?? null) : 'Installation (operator)', deliveries24h: ds.length, failed24h: ds.filter((d) => d.status === 'failed').length, retrying: ds.filter((d) => d.status === 'retrying').length, successRate24h: ds.length ? +((ds.filter((d) => d.status === 'delivered').length / ds.length) * 100).toFixed(1) : 100 }
    })
  }),
  r<BodyFor<typeof createWebhookEndpoint>>('POST', '/admin/webhooks', (rt, { body }) => createWebhookEndpoint(rt.ctx, { ...body, actor: adminActor(rt) })),
  r<CommandParams<typeof updateWebhookEndpoint>['patch']>('PATCH', '/admin/webhooks/:id', (rt, { params, body }) => updateWebhookEndpoint(rt.ctx, { endpointId: params.id!, patch: body, actor: adminActor(rt) })),
  r('DELETE', '/admin/webhooks/:id', (rt, { params }) => {
    deleteWebhookEndpoint(rt.ctx, { endpointId: params.id!, actor: adminActor(rt) })
    return { ok: true }
  }),
  r('POST', '/admin/webhooks/:id/test', (rt, { params }) => sendTestWebhook(rt.ctx, { endpointId: params.id!, actor: adminActor(rt) })),
  r('GET', '/admin/webhook-deliveries', (rt, { query }) => {
    const items = rt.repo.webhookDeliveries.filter((d) => (!query.endpointId || d.endpointId === query.endpointId) && (!query.status || d.status === query.status) && (!query.event || d.event === query.event) && (!query.orderId || d.orderId === query.orderId))
    const page = paginate(items, query, 30)
    return { ...page, items: page.items.map((d) => ({ ...d, url: rt.repo.webhookEndpoints.get(d.endpointId)?.url ?? '', orderRef: d.orderId ? (rt.repo.orders.get(d.orderId)?.ref ?? null) : null })) }
  }),
  r('POST', '/admin/webhook-deliveries/:id/replay', (rt, { params }) => {
    requirePermission(rt.ctx, adminActor(rt), 'developer.manage')
    return replay(rt.ctx, params.id!)
  }),
  r('GET', '/admin/inbound-webhooks', (rt, { query }) => {
    const items = rt.repo.inboundWebhooks.filter((w) => (!query.source || w.source === query.source) && (!query.status || w.status === query.status))
    const page = paginate(items, query, 30)
    return { ...page, items: page.items.map((w) => ({ ...w, orderRef: w.orderId ? (rt.repo.orders.get(w.orderId)?.ref ?? null) : null, paymentRef: w.paymentIntentId ? (rt.repo.payments.get(w.paymentIntentId)?.ref ?? null) : null })) }
  }),

  /* Notifications */
  r('GET', '/admin/notifications', (rt, { query }) => {
    const items = rt.repo.notifications.filter((n) => (!query.channel || n.channel === query.channel) && (!query.audience || n.audience === query.audience) && (!query.template || n.template === query.template) && matches([n.subject, n.body, n.recipient], query.search))
    const page = paginate(items, query, 30)
    return { ...page, items: page.items.map((n) => ({ ...n, orderRef: n.orderId ? (rt.repo.orders.get(n.orderId)?.ref ?? null) : null })) }
  }),
  r('GET', '/admin/notifications/config', (rt) => ({ channels: rt.repo.notificationChannels.all(), routes: rt.repo.notificationRoutes.all() })),
  r<Partial<NotificationRoute>>('PATCH', '/admin/notifications/routes/:id', (rt, { params, body }) => {
    requirePermission(rt.ctx, adminActor(rt), 'system.manage')
    return rt.repo.notificationRoutes.update(params.id!, body)
  }),
  r<Partial<NotificationChannelConfig>>('PATCH', '/admin/notifications/channels/:id', (rt, { params, body }) => {
    requirePermission(rt.ctx, adminActor(rt), 'system.manage')
    return rt.repo.notificationChannels.update(params.id!, body)
  }),

  /* Audit */
  r('GET', '/admin/audit', (rt, { query }) => {
    const since = query.range === '24h' ? rt.clock.now() - DAY : query.range === '7d' ? rt.clock.now() - 7 * DAY : 0
    const items = rt.repo.audit.filter((a) => (!since || ts(a.at) >= since) && (!query.severity || a.severity === query.severity) && (!query.actorType || a.actor.type === query.actorType) && (!query.targetType || a.target.type === query.targetType) && matches([a.action, a.summary, a.actor.name, a.target.label, a.reason], query.search))
    return paginate(items, query, 40)
  }),
]
