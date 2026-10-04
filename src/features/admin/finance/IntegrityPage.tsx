import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { CircleCheck, CircleX, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react'
import type { IntegrityCheck, IntegrityStatus } from '@/types/installation'
import { useIntegrity } from '@/hooks/installation'
import { Money } from '@/components/domain'
import { Badge, Button, Card, PageHeader, Skeleton, StatusBadge } from '@/components/ui'
import { dateTime, num, relative } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Explainer, LoadError } from './shared'

const WHY: Record<string, string> = {
  balanced: 'If a single transaction did not balance, money would have been created or destroyed. Double entry makes this structurally impossible — this check proves it.',
  trial: 'The whole ledger must balance too. A mismatch would mean entries were written outside LedgerService.',
  projections: 'Wallet balances shown to customers are cached projections. Recomputing them from raw entries proves the numbers on screen are the ledger’s numbers.',
  holds: 'Customer Held must equal exactly the open orders’ prices. Otherwise a customer could be overcharged (orphan hold) or an order could run unfunded.',
  stale_holds: 'Long holds are usually orders waiting for review (UNKNOWN supplier outcome) or slow async suppliers. Not an error — a work queue.',
  settlement: 'A captured order must settle exactly once. Twice would double-count revenue; never would leave the customer’s funds stuck in Held.',
  payments: 'Gateways resend webhooks. Each succeeded payment must fund the wallet exactly once — duplicates are recorded and ignored thanks to idempotency keys.',
  credit: 'Chargebacks can reclaim money a customer already spent, pushing the wallet below its credit limit. Finance should follow up (freeze, collect).',
  supplier_drift: 'Our expected supplier balance (ledger − in-flight orders) should match what the supplier reports. Drift points to unsettled or unknown orders.',
}

const STATUS_META: Record<IntegrityStatus, { icon: typeof CircleCheck; tone: string; ring: string; title: string; body: string }> = {
  pass: { icon: CircleCheck, tone: 'text-success', ring: 'border-success/30 bg-success/6', title: 'Ledger is consistent', body: 'Every check passed. Money in the system is fully accounted for.' },
  warn: { icon: TriangleAlert, tone: 'text-warning', ring: 'border-warning/30 bg-warning/6', title: 'Consistent, with items to follow up', body: 'No structural errors. Some checks flag operational items (long holds, supplier drift, overdrawn wallets).' },
  fail: { icon: CircleX, tone: 'text-danger', ring: 'border-danger/30 bg-danger/6', title: 'Integrity failure', body: 'At least one structural check failed. Investigate before taking further money actions.' },
}

export default function IntegrityPage() {
  const q = useIntegrity()
  const r = q.data
  return (
    <div>
      <PageHeader
        icon={<ShieldCheck />}
        title="Financial integrity"
        description="Continuous checks that prove the ledger is balanced, projections are correct, and every order and payment posted exactly once. They run automatically every few seconds in this demo (and after every money command in production)."
        actions={
          <Button leading={<RefreshCw className={cn(q.isFetching && 'animate-spin')} />} onClick={() => q.refetch()} disabled={q.isFetching}>
            Run checks again
          </Button>
        }
      />

      {q.isError ? (
        <Card>
          <LoadError what="the integrity report" onRetry={() => q.refetch()} />
        </Card>
      ) : !r ? (
        <div className="space-y-4">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      ) : (
        <div className="space-y-4">
          <Hero status={r.status} checkedAt={r.checkedAt} counts={countBy(r.checks)} />
          <Card className="grid grid-cols-2 gap-px overflow-hidden bg-line sm:grid-cols-4">
            <Tot label="Transactions" value={num(r.totals.transactions)} />
            <Tot label="Entries" value={num(r.totals.entries)} />
            <Tot label="Σ Debits" value={<Money value={r.totals.debits} />} />
            <Tot
              label="Σ Credits"
              value={
                <span className="inline-flex items-center gap-2">
                  <Money value={r.totals.credits} />
                  <Badge tone={r.totals.debits === r.totals.credits ? 'success' : 'danger'}>{r.totals.debits === r.totals.credits ? '= debits' : '≠ debits'}</Badge>
                </span>
              }
            />
          </Card>
          <div className="grid gap-3">
            {r.checks.map((c, i) => (
              <CheckCard key={c.id} c={c} i={i} />
            ))}
          </div>
          <Explainer title="Why this matters for a resale business">
            Customers keep real money in their wallets and suppliers hold your prepaid credit. These checks give finance — and auditors — proof that nothing was double-charged, lost in a retry, or settled twice, without having to trust any single screen. Warnings are operational follow-ups; failures should stop money actions until investigated.
          </Explainer>
        </div>
      )}
    </div>
  )
}

function countBy(checks: IntegrityCheck[]) {
  return { pass: checks.filter((c) => c.status === 'pass').length, warn: checks.filter((c) => c.status === 'warn').length, fail: checks.filter((c) => c.status === 'fail').length }
}

function Hero({ status, checkedAt, counts }: { status: IntegrityStatus; checkedAt: string; counts: { pass: number; warn: number; fail: number } }) {
  const m = STATUS_META[status]
  const Icon = m.icon
  return (
    <Card className={cn('flex flex-col gap-4 border p-5 sm:flex-row sm:items-center sm:justify-between', m.ring)}>
      <div className="flex items-start gap-4">
        <span className={cn('grid size-12 shrink-0 place-items-center rounded-xl border border-current/20 bg-surface', m.tone)}>
          <Icon className="size-6" />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-[20px] font-semibold tracking-tight">{m.title}</h2>
            <StatusBadge status={status} />
          </div>
          <p className="mt-0.5 text-[13px] text-fg-2">{m.body}</p>
          <p className="mt-1 text-[12px] text-fg-3" title={dateTime(checkedAt)}>
            Checked {relative(checkedAt)} · {dateTime(checkedAt)}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-5 pl-16 sm:pl-0">
        <Count n={counts.pass} label="Passed" className="text-success" />
        <Count n={counts.warn} label="Warnings" className="text-warning" />
        <Count n={counts.fail} label="Failed" className="text-danger" />
      </div>
    </Card>
  )
}

function Count({ n, label, className }: { n: number; label: string; className?: string }) {
  return (
    <div className="text-center">
      <div className={cn('font-display text-[24px] leading-none font-semibold tabular', n ? className : 'text-fg-3')}>{n}</div>
      <div className="mt-1 text-[11.5px] text-fg-3">{label}</div>
    </div>
  )
}

function Tot({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="bg-surface px-4 py-3.5">
      <div className="mono-label">{label}</div>
      <div className="mt-1.5 font-mono text-[16px] font-semibold tabular">{value}</div>
    </div>
  )
}

function CheckCard({ c, i }: { c: IntegrityCheck; i: number }) {
  const Icon = STATUS_META[c.status].icon
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03, duration: 0.25 }}>
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <Icon className={cn('mt-0.5 size-4.5 shrink-0', STATUS_META[c.status].tone)} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[14px] font-semibold">{c.label}</div>
              <StatusBadge status={c.status} />
            </div>
            <p className="mt-0.5 text-[12.5px] text-fg-2">{c.description}</p>
            <p className={cn('mt-1.5 font-mono text-[12px]', c.status === 'pass' ? 'text-fg-3' : STATUS_META[c.status].tone)}>{c.detail}</p>
            {WHY[c.id] && <p className="mt-1.5 text-[12px] leading-relaxed text-fg-3">Why it matters: {WHY[c.id]}</p>}
            {c.items.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {c.items.slice(0, 12).map((it) =>
                  it.href ? (
                    <Link key={it.id} to={fixHref(it.href)} className="rounded-md border border-line bg-surface-2/60 px-2 py-1 font-mono text-[11.5px] text-fg-2 transition-colors hover:border-line-strong hover:text-accent-ink">
                      {it.label}
                    </Link>
                  ) : (
                    <span key={it.id} className="rounded-md border border-line bg-surface-2/60 px-2 py-1 font-mono text-[11.5px] text-fg-3">
                      {it.label}
                    </span>
                  ),
                )}
                {c.items.length > 12 && <span className="px-1 py-1 text-[11.5px] text-fg-3">+{c.items.length - 12} more</span>}
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

/** The integrity service links payments to /admin/payments; the console route is /admin/finance/payments. */
function fixHref(href: string) {
  return href.startsWith('/admin/payments') ? href.replace('/admin/payments', '/admin/finance/payments') : href
}
