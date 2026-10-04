/**
 * IntegrityService — continuous checks that the ledger tells the truth.
 * Each check explains what it verifies and links to the records involved.
 */
import { add, formatMoney, ZERO, type Micros } from '../money'
import type { CoreContext } from '../ports'
import type { IntegrityCheck, IntegrityReport, IntegrityStatus } from '../domain'
import { heldForOrder, LA } from './ledger'
import { supplierDrift } from './supplier'

const orderLink = (ctx: CoreContext, id: string) => {
  const o = ctx.repo.orders.get(id)
  return { id, label: o?.ref ?? id, href: `/admin/orders/${id}` }
}

export function integrityReport(ctx: CoreContext): IntegrityReport {
  const txs = ctx.repo.ledger.transactions()
  const checks: IntegrityCheck[] = []
  let debits = ZERO
  let credits = ZERO

  /* 1. Every transaction balances */
  const unbalanced: IntegrityCheck['items'] = []
  for (const t of txs) {
    let d = 0
    let c = 0
    for (const e of t.entries) {
      if (e.direction === 'debit') d += e.amount
      else c += e.amount
    }
    debits = add(debits, d as Micros)
    credits = add(credits, c as Micros)
    if (d !== c) unbalanced.push({ id: t.id, label: `${t.ref} (Δ ${formatMoney((d - c) as Micros)})` })
  }
  checks.push({ id: 'balanced', label: 'Every transaction balances', description: 'Σ debits = Σ credits inside each ledger transaction.', status: unbalanced.length ? 'fail' : 'pass', detail: unbalanced.length ? `${unbalanced.length} unbalanced transactions` : `${txs.length.toLocaleString()} transactions balanced`, items: unbalanced })

  /* 2. Trial balance */
  checks.push({ id: 'trial', label: 'Trial balance', description: 'Total debits equal total credits across the whole ledger.', status: debits === credits ? 'pass' : 'fail', detail: `${formatMoney(debits)} debits · ${formatMoney(credits)} credits`, items: [] })

  /* 3. Projections match raw entries */
  const recomputed = ctx.repo.ledger.recompute()
  const drift: IntegrityCheck['items'] = []
  for (const [acct, b] of recomputed) if (ctx.repo.ledger.balance(acct).balance !== b.balance) drift.push({ id: acct, label: acct })
  checks.push({ id: 'projections', label: 'Balance projections', description: 'Cached wallet and account balances equal a full recomputation from entries.', status: drift.length ? 'fail' : 'pass', detail: drift.length ? `${drift.length} projections differ` : `${recomputed.size} ledger accounts verified`, items: drift })

  /* 4. Holds match order financial status */
  const holdIssues: IntegrityCheck['items'] = []
  const stale: IntegrityCheck['items'] = []
  const now = ctx.clock.now()
  for (const o of ctx.repo.orders.all()) {
    const held = heldForOrder(ctx, o)
    const expected = o.financialStatus === 'held' ? o.price.amount : 0
    if (held !== expected) holdIssues.push({ ...orderLink(ctx, o.id), label: `${o.ref}: held ${formatMoney(held)}, expected ${formatMoney(expected as Micros)}` })
    if (o.financialStatus === 'held' && now - new Date(o.createdAt).getTime() > 6 * 3600_000) stale.push({ ...orderLink(ctx, o.id), label: `${o.ref} · ${o.status.replace('_', ' ')} · ${formatMoney(o.price.amount)}` })
  }
  checks.push({ id: 'holds', label: 'Holds match orders', description: 'Customer Held equals the price of every order whose financial status is held — and nothing else.', status: holdIssues.length ? 'fail' : 'pass', detail: holdIssues.length ? `${holdIssues.length} mismatched holds` : 'All holds reconcile to open orders', items: holdIssues })
  checks.push({ id: 'stale_holds', label: 'Long-running holds', description: 'Funds held for more than 6 hours — usually orders waiting for review or slow async suppliers.', status: stale.length ? 'warn' : 'pass', detail: stale.length ? `${stale.length} holds older than 6 h` : 'No long-running holds', items: stale })

  /* 5. Captured orders are settled exactly once */
  const unsettled: IntegrityCheck['items'] = []
  for (const o of ctx.repo.orders.all()) {
    if (o.financialStatus !== 'captured' && o.financialStatus !== 'partially_refunded' && o.financialStatus !== 'refunded') continue
    const s = ctx.repo.ledger.forOrder(o.id).filter((t) => t.kind === 'order_settlement')
    if (s.length !== 1) unsettled.push(orderLink(ctx, o.id))
  }
  checks.push({ id: 'settlement', label: 'Captured orders settled once', description: 'Each captured order has exactly one settlement posting (revenue + cost of sales).', status: unsettled.length ? 'fail' : 'pass', detail: unsettled.length ? `${unsettled.length} orders` : 'All captured orders settled once', items: unsettled })

  /* 6. Successful payments funded a wallet exactly once */
  const unfunded: IntegrityCheck['items'] = []
  for (const p of ctx.repo.payments.filter((x) => x.status === 'succeeded')) {
    const n = ctx.repo.ledger.transactions((t) => t.kind === 'top_up' && t.paymentIntentId === p.id).length
    if (n !== 1) unfunded.push({ id: p.id, label: `${p.ref}: ${n} postings`, href: `/admin/finance/payments?intent=${p.id}` })
  }
  const dupes = ctx.repo.gatewayEvents.count((e) => e.status === 'duplicate_ignored')
  checks.push({ id: 'payments', label: 'Payments funded once', description: 'Every succeeded payment created exactly one wallet top-up, even when the gateway webhook arrived twice.', status: unfunded.length ? 'fail' : 'pass', detail: unfunded.length ? `${unfunded.length} payments` : `All succeeded payments funded once${dupes ? ` · ${dupes} duplicate webhook${dupes > 1 ? 's' : ''} ignored` : ''}`, items: unfunded })

  /* 7. Wallets within credit limits */
  const overdrawn: IntegrityCheck['items'] = []
  for (const a of ctx.repo.accounts.all()) {
    const av = ctx.repo.ledger.balance(LA.available(a.id)).balance
    if (av < -a.creditLimit) overdrawn.push({ id: a.id, label: `${a.name}: ${formatMoney(av)} (limit ${formatMoney(a.creditLimit)})`, href: `/admin/accounts/${a.id}` })
  }
  checks.push({ id: 'credit', label: 'Wallets within credit limit', description: 'No available balance is below minus the account credit limit (chargebacks can cause this).', status: overdrawn.length ? 'warn' : 'pass', detail: overdrawn.length ? `${overdrawn.length} accounts below their credit limit` : 'All wallets within limits', items: overdrawn })

  /* 8. Supplier balance drift (external reconciliation) */
  const drifting: IntegrityCheck['items'] = []
  for (const s of ctx.repo.suppliers.all()) {
    const d = supplierDrift(ctx, s)
    if (d.drift !== 0) drifting.push({ id: s.id, label: `${s.name}: ${formatMoney(d.drift, { sign: true })}`, href: `/admin/finance/reconciliation?supplier=${s.id}` })
  }
  checks.push({ id: 'supplier_drift', label: 'Supplier balances reconcile', description: 'Supplier-reported balance equals the expected balance from our ledger.', status: drifting.length ? 'warn' : 'pass', detail: drifting.length ? `${drifting.length} supplier${drifting.length > 1 ? 's' : ''} drifting` : 'All supplier balances match', items: drifting })

  const status: IntegrityStatus = checks.some((c) => c.status === 'fail') ? 'fail' : checks.some((c) => c.status === 'warn') ? 'warn' : 'pass'
  return { checkedAt: ctx.clock.iso(), status, totals: { transactions: txs.length, entries: ctx.repo.ledger.entryCount(), debits, credits }, checks }
}
