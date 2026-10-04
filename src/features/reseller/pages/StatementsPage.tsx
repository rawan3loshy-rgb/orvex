import { useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, Skeleton } from '@/components/ui'
import { Money } from '@/components/domain'
import { usePortalStatements } from '@/hooks/installation'
import type { StatementMonth } from '@/types/installation'
import type { Micros } from '@/core/money'
import { toast } from '@/stores/toast'
import { num } from '@/lib/format'
import { cn } from '@/lib/cn'
import { ErrorCard, NoAccess } from '../kit'
import { usePortalSession } from '../kitUtils'

const monthLabel = (m: string) => new Date(`${m}-01T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

export default function StatementsPage() {
  const { me, can, role } = usePortalSession()
  const statements = usePortalStatements()
  const [selected, setSelected] = useState<string | null>(null)

  const header = <PageHeader title="Statements" description="Monthly summaries of your wallet, built from the same ledger as your balance. Opening + top-ups − orders + refunds ± adjustments = closing." />
  if (me && !can.finance)
    return (
      <div>
        {header}
        <NoAccess need="finance" role={role} />
      </div>
    )

  const months = statements.data ?? []
  const current = months.find((m) => m.month === selected) ?? months[0]
  const download = (m: StatementMonth) => toast.info(`Statement ${monthLabel(m.month)} (demo)`, `PDF generation is simulated — ${me?.account.name ?? 'account'} · ${me?.account.number ?? ''}`)

  return (
    <div>
      {header}
      {statements.error ? (
        <ErrorCard error={statements.error} onRetry={() => statements.refetch()} />
      ) : statements.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <Skeleton className="h-[320px] rounded-xl" />
          <Skeleton className="h-[320px] rounded-xl" />
        </div>
      ) : !months.length ? (
        <Card>
          <EmptyState icon={<FileText />} title="No statements yet" description="Your first statement appears after your first wallet transaction." />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <Card className="overflow-hidden">
            <div className="border-b border-line px-4 py-3 mono-label">Months</div>
            <ul className="no-scrollbar flex gap-1 overflow-x-auto p-2 lg:block lg:space-y-0.5">
              {months.map((m) => (
                <li key={m.month} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelected(m.month)}
                    className={cn('flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2 text-left text-[13px] transition-colors', current?.month === m.month ? 'bg-surface-2 font-medium text-fg ring-1 ring-line' : 'text-fg-2 hover:bg-surface-2/60')}
                  >
                    <span className="whitespace-nowrap">{monthLabel(m.month)}</span>
                    <Money value={m.closing} className="text-[12px] text-fg-3" />
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {current && (
            <Card>
              <CardHeader
                icon={<FileText />}
                title={`Statement · ${monthLabel(current.month)}`}
                description={`${me?.account.name ?? ''} · ${me?.account.number ?? ''} · ${num(current.lines)} ledger lines`}
                actions={
                  <Button size="sm" leading={<Download />} onClick={() => download(current)}>
                    <span className="hidden sm:inline">Download PDF</span>
                    <span className="sm:hidden">PDF</span>
                    <Badge tone="neutral" variant="outline" className="ml-1 hidden sm:inline-flex">
                      demo
                    </Badge>
                  </Button>
                }
              />
              <div className="px-5 pb-5">
                <dl className="rounded-xl border border-line">
                  <Line label="Opening balance" value={current.opening} strong />
                  <Line label="Top-ups" value={current.topUps} sign />
                  <Line label="Orders charged" value={current.orders} sign />
                  <Line label="Refunds" value={current.refunds} sign />
                  <Line label="Adjustments & chargebacks" value={current.adjustments} sign />
                  <Line label="Closing balance" value={current.closing} strong total />
                </dl>
                <p className="mt-3 text-[12px] text-fg-3">Reservations for open orders are not charges: they move between available and held and only appear here once an order completes (charged) or is released.</p>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function Line({ label, value, sign, strong, total }: { label: string; value: Micros; sign?: boolean; strong?: boolean; total?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-4 border-b border-line px-4 py-3 last:border-0', total && 'bg-surface-2/60')}>
      <dt className={cn('text-[13px]', strong ? 'font-medium text-fg' : 'text-fg-2')}>{label}</dt>
      <dd className={cn('tabular', strong ? 'text-[15px] font-semibold' : 'text-[13.5px]')}>
        <Money value={value} sign={sign} tone={sign ? 'auto' : 'none'} />
      </dd>
    </div>
  )
}
