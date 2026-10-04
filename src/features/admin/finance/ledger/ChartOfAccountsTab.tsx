import { Fragment, useState, type ReactNode } from 'react'
import { ChevronRight, Scale } from 'lucide-react'
import { add, formatMoney, type Micros } from '@/core/money'
import type { LedgerAccountBalance, LedgerAccountType, LedgerOverview } from '@/types/installation'
import { useLedgerAccounts } from '@/hooks/installation'
import { Money } from '@/components/domain'
import { Badge, Card, CardBody, CardHeader, Skeleton } from '@/components/ui'
import { num } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Explainer, LoadError } from '../shared'

const TYPE_ORDER: { type: LedgerAccountType; label: string; normal: 'debit' | 'credit'; blurb: string }[] = [
  { type: 'asset', label: 'Assets', normal: 'debit', blurb: 'Money the business holds or is owed: gateway clearing, bank, prepaid supplier credit.' },
  { type: 'liability', label: 'Liabilities', normal: 'credit', blurb: 'Money owed to customers: wallet balances available and held for open orders.' },
  { type: 'revenue', label: 'Revenue', normal: 'credit', blurb: 'Settled order revenue, less refunds (contra-revenue).' },
  { type: 'expense', label: 'Expenses', normal: 'debit', blurb: 'Supplier cost of sales, chargeback fees and goodwill credits.' },
]

const sumBal = (xs: LedgerAccountBalance[]) => xs.reduce((a, x) => a + x.balance, 0) as Micros

export function ChartOfAccountsTab({ onOpenAccount }: { onOpenAccount: (code: string) => void }) {
  const q = useLedgerAccounts()
  if (q.isError) return <Card><LoadError what="the chart of accounts" onRetry={() => q.refetch()} /></Card>
  if (q.isLoading || !q.data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    )
  return <Chart data={q.data} onOpenAccount={onOpenAccount} />
}

function Chart({ data, onOpenAccount }: { data: LedgerOverview; onOpenAccount: (code: string) => void }) {
  const [open, setOpen] = useState<Set<string>>(new Set(['supplier_prepaid']))
  const t = data.totals
  const balanced = t.debits === t.credits
  const byType = (type: LedgerAccountType) => data.accounts.filter((a) => a.type === type)
  const assets = sumBal(byType('asset'))
  const liabilities = sumBal(byType('liability'))
  const revenue = sumBal(byType('revenue'))
  const expenses = sumBal(byType('expense'))
  const left = add(assets, expenses)
  const right = add(liabilities, revenue)
  const toggle = (g: string) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(g)) n.delete(g)
      else n.add(g)
      return n
    })

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader icon={<Scale />} title="Trial balance" description="Across the whole ledger, total debits must equal total credits — a structural guarantee of double entry." actions={<Badge tone={balanced ? 'success' : 'danger'} dot>{balanced ? 'Debits = credits' : 'Out of balance'}</Badge>} />
        <CardBody>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
            <Cell label="Total debits" value={<Money value={t.debits} />} />
            <Cell label="Total credits" value={<Money value={t.credits} />} />
            <Cell label="Transactions" value={num(t.transactions)} />
            <Cell label="Entries" value={num(t.entries)} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[12px] text-fg-2">
            <span className="text-fg-3">Assets + Expenses</span>
            <Money value={left} className="font-semibold text-fg" />
            <span className={balanced && left === right ? 'text-success' : 'text-danger'}>{left === right ? '=' : '≠'}</span>
            <Money value={right} className="font-semibold text-fg" />
            <span className="text-fg-3">Liabilities + Revenue</span>
          </div>
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr className="text-left text-[11.5px] tracking-wide text-fg-3">
                <th className="border-b border-line py-2.5 pr-3 pl-5 font-medium">Account</th>
                <th className="border-b border-line px-3 py-2.5 font-medium">Normal</th>
                <th className="border-b border-line px-3 py-2.5 text-right font-medium">Entries</th>
                <th className="border-b border-line px-3 py-2.5 text-right font-medium">Debits</th>
                <th className="border-b border-line px-3 py-2.5 text-right font-medium">Credits</th>
                <th className="border-b border-line py-2.5 pr-5 pl-3 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {TYPE_ORDER.map((ty) => {
                const groups = data.groups.filter((g) => g.type === ty.type)
                const typeAccounts = byType(ty.type)
                return (
                  <Fragment key={ty.type}>
                    <tr className="bg-surface-2/60">
                      <td colSpan={5} className="border-b border-line py-2 pr-3 pl-5">
                        <span className="mono-label text-fg-2">{ty.label}</span>
                        <span className="ml-2 text-[11.5px] text-fg-3">{ty.blurb}</span>
                      </td>
                      <td className="border-b border-line py-2 pr-5 pl-3 text-right font-mono text-[12.5px] font-semibold tabular">
                        <Money value={sumBal(typeAccounts)} />
                      </td>
                    </tr>
                    {groups.map((g) => {
                      const accts = data.accounts.filter((a) => a.group === g.group)
                      const isOpen = open.has(g.group)
                      const dr = accts.reduce((a, x) => a + x.debits, 0) as Micros
                      const cr = accts.reduce((a, x) => a + x.credits, 0) as Micros
                      const entries = accts.reduce((a, x) => a + x.entries, 0)
                      const multi = accts.length > 1 || accts.some((a) => a.subjectId)
                      return (
                        <Fragment key={g.group}>
                          <tr className={cn('transition-colors hover:bg-surface-2/50', multi && 'cursor-pointer')} onClick={() => (multi ? toggle(g.group) : accts[0] && onOpenAccount(accts[0].account))}>
                            <td className="border-b border-line py-2.5 pr-3 pl-5">
                              <div className="flex items-center gap-2">
                                {multi ? <ChevronRight className={cn('size-3.5 text-fg-3 transition-transform', isOpen && 'rotate-90')} /> : <span className="w-3.5" />}
                                <span className="font-medium">{g.name}</span>
                                <span className="font-mono text-[11px] text-fg-3">{g.group}</span>
                                {multi && <span className="text-[11.5px] text-fg-3">· {g.accounts} sub-account{g.accounts === 1 ? '' : 's'}</span>}
                              </div>
                            </td>
                            <td className="border-b border-line px-3 py-2.5 text-[11.5px] text-fg-3 uppercase">{ty.normal === 'debit' ? 'DR' : 'CR'}</td>
                            <td className="border-b border-line px-3 py-2.5 text-right font-mono text-[12px] text-fg-3 tabular">{num(entries)}</td>
                            <td className="border-b border-line px-3 py-2.5 text-right font-mono text-[12.5px] tabular text-fg-2"><Money value={dr} /></td>
                            <td className="border-b border-line px-3 py-2.5 text-right font-mono text-[12.5px] tabular text-fg-2"><Money value={cr} /></td>
                            <td className="border-b border-line py-2.5 pr-5 pl-3 text-right font-mono text-[12.5px] font-medium tabular"><Money value={g.total} tone="auto" /></td>
                          </tr>
                          {isOpen &&
                            accts
                              .slice()
                              .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
                              .map((a) => (
                                <tr key={a.account} className="cursor-pointer bg-surface-2/20 hover:bg-surface-2/60" onClick={() => onOpenAccount(a.account)} title="Show transactions touching this account">
                                  <td className="border-b border-line/70 py-2 pr-3 pl-14">
                                    <div className="truncate text-[12.5px]">{a.name}</div>
                                    <div className="font-mono text-[10.5px] text-fg-3">{a.account}</div>
                                  </td>
                                  <td className="border-b border-line/70 px-3 py-2" />
                                  <td className="border-b border-line/70 px-3 py-2 text-right font-mono text-[11.5px] text-fg-3 tabular">{num(a.entries)}</td>
                                  <td className="border-b border-line/70 px-3 py-2 text-right font-mono text-[12px] text-fg-3 tabular"><Money value={a.debits} /></td>
                                  <td className="border-b border-line/70 px-3 py-2 text-right font-mono text-[12px] text-fg-3 tabular"><Money value={a.credits} /></td>
                                  <td className="border-b border-line/70 py-2 pr-5 pl-3 text-right font-mono text-[12px] tabular"><Money value={a.balance} tone="auto" /></td>
                                </tr>
                              ))}
                        </Fragment>
                      )
                    })}
                  </Fragment>
                )
              })}
              <tr className="bg-surface-2/60 font-semibold">
                <td colSpan={3} className="py-2.5 pr-3 pl-5 text-[12.5px]">Trial balance totals</td>
                <td className="px-3 py-2.5 text-right font-mono text-[12.5px] tabular"><Money value={t.debits} /></td>
                <td className="px-3 py-2.5 text-right font-mono text-[12.5px] tabular"><Money value={t.credits} /></td>
                <td className="py-2.5 pr-5 pl-3 text-right">
                  <Badge tone={balanced ? 'success' : 'danger'}>{balanced ? 'Balanced' : `Δ ${formatMoney((t.debits - t.credits) as Micros)}`}</Badge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
      <Explainer title="Reading balances">
        Balances are signed in each account’s <strong>normal</strong> direction: assets and expenses increase with debits, liabilities and revenue with credits. A negative figure means the account sits on its opposite side — e.g. Refunds (contra-revenue) is negative because refunds are debits, and Supplier Prepaid can go negative if suppliers charged more than we prepaid. Click any row to see the postings behind it.
      </Explainer>
    </div>
  )
}

function Cell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="bg-surface px-3.5 py-3">
      <div className="mono-label">{label}</div>
      <div className="mt-1.5 font-mono text-[16px] font-semibold tabular">{value}</div>
    </div>
  )
}
