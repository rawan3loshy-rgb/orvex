import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowDownLeft, ArrowLeftRight, Download, Landmark, LoaderCircle, PiggyBank, RotateCcw, ShoppingCart, Undo2, Wallet } from 'lucide-react'
import { ProviderMark } from '@/components/brand'
import { Badge, Button, Card, DataTable, DemoTag, EmptyState, KpiCard, PageHeader, Pagination, SearchInput, Select, StatusBadge, Tabs, Tooltip, type Column } from '@/components/ui'
import { useProviders, useResellers, useTransactionSummary, useTransactions } from '@/hooks/installation'
import { toast } from '@/stores/toast'
import { cn } from '@/lib/cn'
import { dateTime, money, num, relative } from '@/lib/format'
import type { Transaction, TransactionType } from '@/types/installation'
import { downloadCsv, fileDate, toCsv } from './reports/csv'
import { TransactionDrawer } from './transactions/TransactionDrawer'
import { ResellerAvatar } from './resellers/shared'
import { METHOD_META, TYPE_META, TypeIcon, refundKind } from './transactions/meta'

const PAGE_SIZE = 30
type TypeTab = 'all' | TransactionType

const TYPE_TABS: { value: TypeTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'order_charge', label: 'Order charges' },
  { value: 'top_up', label: 'Top-ups' },
  { value: 'refund', label: 'Refunds' },
  { value: 'adjustment', label: 'Adjustments' },
  { value: 'provider_settlement', label: 'Supplier settlements' },
]

function useDebounced<T>(value: T, delay = 250) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

export default function TransactionsPage() {
  const [type, setType] = useState<TypeTab>('all')
  const [status, setStatus] = useState('')
  const [resellerId, setResellerId] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Transaction | null>(null)
  const q = useDebounced(search.trim())

  const summary = useTransactionSummary()
  const resellers = useResellers()
  const providers = useProviders()
  const txs = useTransactions({ page, pageSize: PAGE_SIZE, type: type === 'all' ? undefined : type, status: status || undefined, resellerId: resellerId || undefined, search: q || undefined })

  const resellerById = useMemo(() => new Map((resellers.data ?? []).map((r) => [r.id, r])), [resellers.data])
  const providerById = useMemo(() => new Map((providers.data ?? []).map((p) => [p.id, p])), [providers.data])

  const filterBy = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setPage(1)
  }
  const activeFilters = [status, resellerId, q, type !== 'all' ? type : ''].filter(Boolean).length
  const clear = () => {
    setType('all')
    setStatus('')
    setResellerId('')
    setSearch('')
    setPage(1)
  }

  const counterparty = (t: Transaction) => {
    if (t.resellerId) return { kind: 'reseller' as const, name: resellerById.get(t.resellerId)?.name ?? t.resellerId }
    if (t.providerId) return { kind: 'provider' as const, name: providerById.get(t.providerId)?.shortName ?? t.providerId }
    return null
  }

  const columns: Column<Transaction>[] = [
    {
      key: 'time',
      header: 'Time',
      width: 'w-[140px]',
      cell: (t) => (
        <Tooltip content={relative(t.at)} placement="right">
          <span className="text-[12.5px] whitespace-nowrap text-fg-2">{dateTime(t.at)}</span>
        </Tooltip>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      width: 'w-[190px]',
      cell: (t) => (
        <span className="flex items-center gap-2.5">
          <TypeIcon type={t.type} />
          <span className="font-medium whitespace-nowrap text-fg">{TYPE_META[t.type].label}</span>
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      cell: (t) => (
        <div className="min-w-0 max-w-[340px]">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-fg-2">{t.description}</span>
            {refundKind(t) === 'Failed order released' && (
              <Badge tone="neutral" className="hidden shrink-0 sm:inline-flex">
                auto-release
              </Badge>
            )}
          </div>
          <div className="truncate font-mono text-[11px] text-fg-3">{t.id}</div>
        </div>
      ),
    },
    {
      key: 'counterparty',
      header: 'Counterparty',
      hideBelow: 'md',
      cell: (t) => {
        const c = counterparty(t)
        if (!c) return <span className="text-fg-3">—</span>
        return (
          <span className="flex min-w-0 items-center gap-2">
            {c.kind === 'provider' ? <ProviderMark id={t.providerId!} size="xs" /> : <ResellerAvatar reseller={{ id: t.resellerId!, name: c.name }} size="xs" />}
            <span className="truncate text-fg-2">{c.name}</span>
          </span>
        )
      },
    },
    {
      key: 'method',
      header: 'Method',
      hideBelow: 'lg',
      cell: (t) => {
        const M = METHOD_META[t.method]
        return (
          <span className="flex items-center gap-1.5 whitespace-nowrap text-fg-3">
            <M.icon className="size-3.5" />
            {M.label}
          </span>
        )
      },
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      sortValue: (t) => t.amount,
      cell: (t) => <span className={cn('font-medium whitespace-nowrap', t.amount > 0 ? 'text-success' : 'text-fg', t.status === 'failed' && 'text-fg-3 line-through decoration-fg-3/50')}>{money(t.amount, { sign: true })}</span>,
    },
    {
      key: 'balance',
      header: 'Balance after',
      align: 'right',
      hideBelow: 'xl',
      cell: (t) => <span className="text-fg-3">{t.balanceAfter == null ? '—' : money(t.balanceAfter)}</span>,
    },
    { key: 'status', header: 'Status', width: 'w-[120px]', cell: (t) => <StatusBadge status={t.status} /> },
  ]

  const s = summary.data
  const kpis: { key: string; label: string; value: number | undefined; icon: ReactNode; footer: string; type?: TransactionType; color: string }[] = [
    { key: 'charges', label: 'Order charges', value: s?.charges30d, icon: <ShoppingCart />, footer: 'Last 30 days · debited from balances', type: 'order_charge', color: 'var(--c1)' },
    { key: 'topups', label: 'Top-ups', value: s?.topUps30d, icon: <ArrowDownLeft />, footer: 'Last 30 days · credited to balances', type: 'top_up', color: 'var(--success)' },
    { key: 'refunds', label: 'Refunds', value: s?.refunds30d, icon: <Undo2 />, footer: 'Last 30 days · failed orders released & operator refunds', type: 'refund', color: 'var(--c2)' },
    { key: 'settlements', label: 'Supplier settlements', value: s?.providerSettlements30d, icon: <Landmark />, footer: 'Last 30 days · prepaid to supplier wallets', type: 'provider_settlement', color: 'var(--c4)' },
    { key: 'outstanding', label: 'Reseller balances', value: s?.outstandingBalances, icon: <Wallet />, footer: 'Prepaid funds held for GSM shops', color: 'var(--c2)' },
    { key: 'wallets', label: 'Supplier wallets', value: s?.providerWallets, icon: <PiggyBank />, footer: 'Prepaid credit across suppliers', color: 'var(--c6)' },
  ]

  const exportPage = () => {
    const items = txs.data?.items ?? []
    const rows = [
      ['id', 'time', 'type', 'description', 'counterparty', 'method', 'amount_usd', 'balance_after_usd', 'status', 'order_id'],
      ...items.map((t) => [t.id, t.at, t.type, t.description, counterparty(t)?.name ?? '', METHOD_META[t.method].label, t.amount.toFixed(2), t.balanceAfter?.toFixed(2) ?? '', t.status, t.orderId ?? '']),
    ]
    const file = `orvex-transactions-p${page}-${fileDate()}.csv`
    downloadCsv(file, toCsv(rows))
    toast.success('Transactions exported', `${items.length} rows · ${file}`)
  }

  const total = txs.data?.total ?? 0

  return (
    <div>
      <PageHeader
        title="Transactions"
        description="The ledger behind every reseller balance and supplier wallet — order charges, top-ups, refunds for failed unlocks and checks, adjustments and supplier settlements."
        actions={
          <Button variant="secondary" leading={<Download />} onClick={exportPage} disabled={!txs.data?.items.length}>
            Export page
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 2xl:grid-cols-6">
        {kpis.map((k) => (
          <KpiCard
            key={k.key}
            loading={summary.isLoading}
            icon={k.icon}
            label={k.label}
            value={money(k.value, { compact: true })}
            footer={k.footer}
            className={cn(k.type && type === k.type && 'border-accent/50 shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_12%,transparent)]')}
            onClick={k.type ? () => filterBy(setType)(type === k.type ? 'all' : k.type!) : undefined}
          />
        ))}
      </div>

      <Tabs items={TYPE_TABS} value={type} onChange={filterBy(setType)} className="mb-4" />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2.5 border-b border-line p-3 sm:p-4 lg:flex-row lg:items-center">
          <SearchInput value={search} onChange={filterBy(setSearch)} placeholder="Search description, ID, reseller, supplier, order #…" className="lg:w-[340px]" />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Select
              inputSize="sm"
              aria-label="Status"
              className="sm:w-[150px]"
              value={status}
              onChange={(e) => filterBy(setStatus)(e.target.value)}
              options={[
                { value: '', label: 'All statuses' },
                { value: 'completed', label: 'Completed' },
                { value: 'pending', label: 'Pending' },
                { value: 'failed', label: 'Failed' },
              ]}
            />
            <Select
              inputSize="sm"
              aria-label="Reseller"
              className="sm:w-[180px]"
              value={resellerId}
              onChange={(e) => filterBy(setResellerId)(e.target.value)}
              options={[{ value: '', label: 'All resellers' }, ...(resellers.data ?? []).map((r) => ({ value: r.id, label: r.name }))]}
            />
          </div>
          <div className="flex items-center justify-between gap-3 text-[12px] text-fg-3 lg:ml-auto">
            <span className="flex items-center gap-1.5 tabular">
              {txs.isFetching && !txs.isLoading && <LoaderCircle className="size-3.5 animate-spin" />}
              {txs.data ? `${num(total)} entries` : ''}
              {txs.data && <DemoTag className="hidden sm:inline-flex" />}
            </span>
            {activeFilters > 0 && (
              <button type="button" onClick={clear} className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg">
                <RotateCcw className="size-3" />
                Clear
              </button>
            )}
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={txs.data?.items}
          rowKey={(t) => t.id}
          loading={txs.isLoading}
          onRowClick={setSelected}
          selectedKey={selected?.id}
          minWidth={760}
          skeletonRows={10}
          className={cn('transition-opacity', txs.isPlaceholderData && 'opacity-60')}
          empty={
            <EmptyState
              icon={<ArrowLeftRight />}
              title="No transactions match"
              description="Adjust the type, status or reseller filters, or search for an order number."
              action={
                activeFilters ? (
                  <Button size="sm" variant="secondary" leading={<RotateCcw />} onClick={clear}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          }
        />
        {total > 0 && <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />}
      </Card>

      <TransactionDrawer
        tx={selected}
        onClose={() => setSelected(null)}
        resellers={resellerById}
        providers={providerById}
      />
    </div>
  )
}
