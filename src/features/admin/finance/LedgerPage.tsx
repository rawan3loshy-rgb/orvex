import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { BookOpen, ShieldCheck } from 'lucide-react'
import { formatBps, sub } from '@/core/money'
import { useFinanceSummary, useIntegrity } from '@/hooks/installation'
import { Money } from '@/components/domain'
import { Button, Card, PageHeader, Skeleton, StatusBadge, Tabs } from '@/components/ui'
import { TransactionsTab } from './ledger/TransactionsTab'
import { ChartOfAccountsTab } from './ledger/ChartOfAccountsTab'
import { PostingRulesTab } from './ledger/PostingRulesTab'

type TabKey = 'transactions' | 'accounts' | 'rules'

export default function LedgerPage() {
  const [params, setParams] = useSearchParams()
  const t = params.get('tab') as TabKey | null
  const tab: TabKey = t === 'accounts' || t === 'rules' ? t : 'transactions'
  const integrity = useIntegrity()

  const setTab = (v: TabKey) => {
    const next = new URLSearchParams(params)
    if (v === 'transactions') next.delete('tab')
    else next.set('tab', v)
    setParams(next, { replace: true })
  }

  return (
    <div>
      <PageHeader
        icon={<BookOpen />}
        title="Ledger"
        description="Double-entry, append-only. Every money movement — top-ups, holds, settlements, refunds, chargebacks, supplier top-ups — is a balanced transaction with an idempotency key. Wallet and supplier balances are projections of these entries."
        actions={
          <Button variant="secondary" to="/admin/finance/integrity" leading={<ShieldCheck />}>
            Integrity
            {integrity.data && <StatusBadge status={integrity.data.status} className="ml-1" />}
          </Button>
        }
      />
      <SummaryStrip />
      <Tabs<TabKey>
        className="mt-6 mb-5"
        items={[
          { value: 'transactions', label: 'Transactions' },
          { value: 'accounts', label: 'Chart of accounts' },
          { value: 'rules', label: 'Posting rules' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'transactions' && <TransactionsTab />}
      {tab === 'accounts' && <ChartOfAccountsTab onOpenAccount={(code) => setParams(new URLSearchParams({ account: code }), { replace: true })} />}
      {tab === 'rules' && <PostingRulesTab />}
    </div>
  )
}

function SummaryStrip() {
  const q = useFinanceSummary()
  const s = q.data
  const margin30 = s ? sub(s.revenue30d, s.cost30d) : null
  const marginPct = s && margin30 != null && s.revenue30d ? formatBps(Math.round((margin30 / s.revenue30d) * 10_000)) : '—'
  const cells: { label: string; value: ReactNode; sub: ReactNode }[] = s
    ? [
        { label: 'Revenue', value: <Money value={s.revenue} compact />, sub: 'all time · settled orders' },
        { label: 'Refunds', value: <Money value={s.refunds} compact />, sub: <>contra-revenue · today <Money value={s.refundsToday} /></> },
        { label: 'Cost of sales', value: <Money value={s.costOfSales} compact />, sub: 'supplier cost of settled orders' },
        { label: 'Revenue · 30d', value: <Money value={s.revenue30d} compact />, sub: 'settlements, last 30 days' },
        { label: 'Gross margin · 30d', value: <Money value={margin30} compact tone="auto" />, sub: <>cost <Money value={s.cost30d} compact /> · {marginPct}</> },
        { label: 'Wallets available', value: <Money value={s.walletAvailable} compact />, sub: 'owed to customers (liability)' },
        { label: 'Wallets held', value: <Money value={s.walletHeld} compact />, sub: 'reserved for open orders' },
        { label: 'Gateway clearing', value: <Money value={s.gatewayClearing} compact />, sub: 'collected, not yet paid out' },
        { label: 'Supplier prepaid', value: <Money value={s.supplierPrepaid} compact />, sub: 'credit held at suppliers' },
        { label: 'Bank', value: <Money value={s.bank} compact tone="auto" />, sub: 'payouts in − supplier top-ups out' },
      ]
    : []
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-5">
        {q.isLoading
          ? Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="bg-surface px-4 py-3.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-2.5 h-5 w-24" />
              </div>
            ))
          : cells.map((c) => (
              <div key={c.label} className="min-w-0 bg-surface px-4 py-3.5">
                <div className="mono-label">{c.label}</div>
                <div className="mt-1.5 font-mono text-[17px] leading-none font-semibold tabular">{c.value}</div>
                <div className="mt-1.5 truncate text-[11px] text-fg-3">{c.sub}</div>
              </div>
            ))}
      </div>
      {q.isError && <div className="border-t border-line px-4 py-2.5 text-[12px] text-danger">Could not load the finance summary.</div>}
    </Card>
  )
}
