/**
 * Domain self-test — run with `node scripts/selftest.mjs`.
 * Seeds a runtime, checks ledger integrity and the demo script invariants, then
 * replays the key demo stories (timeout → needs review, guarded failover, price
 * change) against the live engine.
 */
import { formatMoney, usd } from '@/core/money'
import { integrityReport } from '@/core/services/integrity'
import { walletBalance } from '@/core/services/ledger'
import { quote } from '@/core/services/pricing'
import { availability } from '@/core/services/routing'
import { supplierDrift, supplierHealth, supplierMetrics } from '@/core/services/supplier'
import { placeOrder } from '@/core/commands/orders'
import { setServicePrice } from '@/core/commands/catalog'
import { lookupSupplier } from '@/core/commands/review'
import { decideSyncChanges } from '@/core/commands/suppliers'
import { runSync, summarizeSyncRun } from '@/core/services/catalogSync'
import { createRuntime, runJobs, adminActor } from './runtime'
import { seedRuntime } from './seed'
import { setBehaviour } from './sim/simulator'

export function selftest() {
  const out: string[] = []
  const log = (...a: unknown[]) => out.push(a.map(String).join(' '))
  const fail: string[] = []
  const check = (cond: boolean, msg: string) => {
    log(`${cond ? '✓' : '✗'} ${msg}`)
    if (!cond) fail.push(msg)
  }
  const t = Date.now()
  const rt = createRuntime(20261004)
  seedRuntime(rt, t)
  log(`seeded in ${Date.now() - t} ms`)
  const r = rt.repo
  log(`suppliers ${r.suppliers.count()} · products ${r.products.count()} · services ${r.services.count()} · offers ${r.offers.count()} · rules ${r.rules.count()} · accounts ${r.accounts.count()}`)
  log(`orders ${r.orders.count()} · ledger tx ${r.ledger.transactions().length} · entries ${r.ledger.entryCount()} · payments ${r.payments.count()} · refunds ${r.refunds.count()} · chargebacks ${r.chargebacks.count()}`)
  log(`api logs ${r.apiLogs.count()} · webhook deliveries ${r.webhookDeliveries.count()} · inbound webhooks ${r.inboundWebhooks.count()} · notifications ${r.notifications.count()} · audit ${r.audit.count()} · verifications ${r.verifications.count()} · driver calls ${r.driverCalls.count()}`)
  const byStatus: Record<string, number> = {}
  for (const o of r.orders.all()) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1
  log('order statuses', JSON.stringify(byStatus))
  const byChannel: Record<string, number> = {}
  for (const o of r.orders.all()) byChannel[o.channel] = (byChannel[o.channel] ?? 0) + 1
  log('channels', JSON.stringify(byChannel))

  const rep = integrityReport(rt.ctx)
  for (const c of rep.checks) log(`  integrity ${c.status.padEnd(4)} ${c.label} — ${c.detail}`)
  check(!rep.checks.some((c) => c.status === 'fail'), 'no failing integrity checks')

  const abc = walletBalance(rt.ctx, 'acc_abcgsm')
  log(`ABC GSM available ${formatMoney(abc.available)} held ${formatMoney(abc.held)} credit ${formatMoney(abc.creditLimit)}`)
  check(abc.available === usd(842.5), 'ABC GSM available = $842.50')
  check(abc.held === usd(27), 'ABC GSM held = $27.00')

  for (const s of r.suppliers.all()) {
    const d = supplierDrift(rt.ctx, s)
    const m = supplierMetrics(rt.ctx, s.id)
    log(`  ${s.name.padEnd(24)} ${supplierHealth(rt.ctx, s).padEnd(12)} ${String(m.attempts).padStart(4)} att/7d ${m.successRate}% p50 ${m.latencyP50} p95 ${m.latencyP95}`)
    log(`  ${''.padEnd(24)} expected ${formatMoney(d.expected).padStart(10)} actual ${formatMoney(d.actual).padStart(10)} drift ${formatMoney(d.drift, { sign: true })}`)
  }
  const alpha = supplierDrift(rt.ctx, r.suppliers.require('sup_alpha'))
  check(alpha.expected === usd(2481.32) && alpha.actual === usd(2470.32), 'Alpha expected $2,481.32 / actual $2,470.32')
  const healths = Object.fromEntries(r.suppliers.all().map((s) => [s.id, supplierHealth(rt.ctx, s)]))
  check(healths.sup_epsilon === 'auth_error', 'Epsilon auth_error')
  check(healths.sup_eta === 'circuit_open', 'Eta circuit_open')
  check(healths.sup_theta === 'half_open', 'Theta half_open')
  check(healths.sup_iota === 'maintenance', 'Iota maintenance')
  check(healths.sup_zeta === 'low_balance', 'Zeta low_balance')
  check(healths.sup_delta === 'degraded', 'Delta degraded')
  check(healths.sup_alpha === 'healthy', 'Alpha healthy')

  const nr = r.orders.filter((o) => o.status === 'needs_review')
  log(`needs review: ${nr.map((o) => `${o.ref}(${o.serviceName})`).join(', ')}`)
  check(nr.length === 7, '7 orders need review')

  for (const sc of rt.scenarios) {
    const o = sc.links[0]?.href.startsWith('/admin/orders/') ? r.orders.get(sc.links[0].href.split('/').pop()!) : undefined
    log(`  scenario ${sc.id}: ${o ? `${o.ref} ${o.status}/${o.financialStatus} attempts=${o.attempts.map((a) => `${a.supplierId.replace('sup_', '')}:${a.state}`).join('>')}` : '—'}`)
  }
  const sA = r.orders.find((o) => o.scenario === 'A')
  check(sA?.status === 'completed' && sA.result?.fields.carrier === 'T-Mobile', 'Scenario A completed with T-Mobile result')
  const sB = r.orders.find((o) => o.scenario === 'B')
  check(sB?.status === 'completed' && sB.attempts.length === 2, 'Scenario B failover to Beta')
  const sC = r.orders.find((o) => o.scenario === 'C')
  check(sC?.status === 'needs_review' && sC.financialStatus === 'held', 'Scenario C needs review, funds held')
  const sK = r.orders.find((o) => o.scenario === 'K')
  check(sK?.financialStatus === 'partially_refunded', 'Scenario K partially refunded')
  const sJ = r.orders.find((o) => o.scenario === 'J')
  check(!!sJ && sJ.events.some((e) => e.type === 'idempotent_replay'), 'Scenario J idempotent replay recorded')
  check(r.gatewayEvents.count((e) => e.status === 'duplicate_ignored') >= 1, 'Scenario I duplicate webhook ignored')
  check(!availability(rt.ctx, r.services.require('svc_4042'), null).available, 'Scenario L Alcatel unavailable')

  const run = r.syncRuns.filter((x) => x.supplierId === 'sup_alpha').sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))[0]
  log('alpha sync counts', JSON.stringify(run?.counts))
  check(!!run && run.counts.new === 12 && run.counts.price === 7 && run.counts.removed === 2 && run.counts.fields === 4 && run.counts.warning === 3, 'Alpha sync 12/7/2/4/3')

  const q = Object.fromEntries(['tier_retail', 'tier_silver', 'tier_gold', 'tier_platinum'].map((tier) => [tier, formatMoney(quote(rt.ctx, 'svc_4001', tier).amount)]))
  log('iPhone 15 Carrier Check prices', JSON.stringify(q))
  check(q.tier_retail === '$3.50' && q.tier_silver === '$0.90' && q.tier_gold === '$0.94' && q.tier_platinum === '$0.82', 'pricing matches the brief')
  check(quote(rt.ctx, 'svc_4011', 'tier_platinum').guard === 'negative_margin', 'Scenario F negative margin (Platinum)')

  /* Live stories on a simulated clock */
  let now = Date.now()
  rt.clock.set(now)
  const tick = (ms: number) => {
    runJobs(rt, now + ms)
    now += ms
    rt.clock.set(now)
  }
  const admin = adminActor(rt)
  setBehaviour(rt.sim, 'sup_alpha', 'timeout', 1, rt.clock.iso())
  const before = walletBalance(rt.ctx, 'acc_abcgsm')
  const p1 = placeOrder(rt.ctx, { accountId: 'acc_abcgsm', serviceId: 'svc_4001', input: { imei: '356938035643809' }, channel: 'portal', actor: admin, payment: { mode: 'wallet' } }).order
  tick(500)
  check(p1.status === 'processing', `timeout story: processing after dispatch (${p1.status})`)
  tick(11_000)
  check(p1.status === 'needs_review' && p1.attempts.length === 1, `timeout story: needs_review, no failover (${p1.status}, ${p1.attempts.length} attempt)`)
  check(walletBalance(rt.ctx, 'acc_abcgsm').held === before.held + p1.price.amount, 'timeout story: funds still held')
  tick(20_000)
  lookupSupplier(rt.ctx, { orderId: p1.id, actor: admin })
  check(p1.status === 'completed' || p1.status === 'processing', `lookup resolves the unknown order (${p1.status})`)

  setBehaviour(rt.sim, 'sup_alpha', 'rejected_safe', 1, rt.clock.iso())
  setBehaviour(rt.sim, 'sup_beta', 'success', 1, rt.clock.iso())
  const p2 = placeOrder(rt.ctx, { accountId: 'acc_abcgsm', serviceId: 'svc_4001', input: { imei: '490154203237518' }, channel: 'portal', actor: admin, payment: { mode: 'wallet' } }).order
  tick(500)
  tick(2_000)
  tick(15_000)
  log('  failover story events:', p2.events.map((e) => `${e.type}@${new Date(e.at).getTime() - (now - 17_500)}`).join(' '))
  check(p2.status === 'completed' && p2.attempts.length === 2 && p2.attempts[1]!.supplierId === 'sup_beta', `failover story: Alpha rejected → Beta completed (${p2.status})`)

  setServicePrice(rt.ctx, { serviceId: 'svc_4001', tierId: 'tier_retail', amount: usd(4), actor: admin })
  check(quote(rt.ctx, 'svc_4001', 'tier_retail').amount === usd(4), 'price change: retail quote is now $4.00')

  /* Provider API: Global GSM Provider catalog sync — supplier products stay separate from ORVEX services */
  const servicesBefore = r.services.count()
  check(r.products.count((p) => p.supplierId === 'sup_global') === 100 && r.offers.count((o) => o.supplierId === 'sup_global') === 22, 'Global GSM Provider: 100 supplier products, 22 mapped as offers')
  const gRun = runSync(rt.ctx, 'sup_global', admin, 'manual')
  const gSum = summarizeSyncRun(gRun, r.syncChanges.all())
  log('global provider sync', JSON.stringify(gSum))
  check(gSum.remote === 101 && gSum.unchanged === 95 && gSum.added === 2 && gSum.changed === 4 && gSum.removed === 1 && gRun.counts.warning === 0, 'provider sync: 101 remote · 95 unchanged · 2 new · 4 changed · 1 removed')
  decideSyncChanges(rt.ctx, { changeIds: r.syncChanges.filter((c) => c.runId === gRun.id && c.decision === 'pending').map((c) => c.id), decision: 'applied', actor: admin })
  check(r.products.count((p) => p.supplierId === 'sup_global' && p.status === 'available') === 101 && r.services.count() === servicesBefore, 'applying a sync adds supplier products, never ORVEX services')
  check(r.products.require('sp_global_101').cost === usd(0.09) && r.products.require('sp_global_201').remoteFields.join(',') === 'imei,brand', 'applied price + field changes land on the supplier products')

  const rep2 = integrityReport(rt.ctx)
  check(!rep2.checks.some((c) => c.status === 'fail'), 'integrity still passes after live stories')
  log(fail.length ? `FAILED ${fail.length}: ${fail.join(' | ')}` : 'ALL CHECKS PASSED')
  return out.join('\n')
}
