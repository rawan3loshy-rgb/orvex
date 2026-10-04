import { useNavigate, useSearchParams } from 'react-router'
import { Link } from 'react-router'
import { FileSearch, Inbox, LifeBuoy } from 'lucide-react'
import { Button, Card, DataTable, EmptyState, PageHeader, StatusBadge, Tabs, type Column } from '@/components/ui'
import { useVerifications } from '@/hooks/installation'
import type { VerificationRow } from '@/services/installation'
import { dateTime } from '@/lib/format'
import { age, useNow } from '../orders/helpers'
import { VerificationDrawer } from './VerificationDrawer'

type TabKey = 'active' | 'awaiting_supplier' | 'approved' | 'rejected' | 'all'
const TABS: { value: TabKey; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'awaiting_supplier', label: 'Awaiting supplier' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
]

const REASON: Record<string, string> = {
  code_not_working: 'Code not working',
  wrong_result: 'Wrong result',
  result_missing: 'Result missing',
  other: 'Other',
}

export default function VerificationsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const raw = (params.get('status') ?? 'active') as TabKey
  const tab: TabKey = TABS.some((t) => t.value === raw) ? raw : 'active'
  const selectedId = params.get('v')
  const now = useNow(15_000)

  const list = useVerifications(tab === 'all' ? undefined : tab)
  const all = useVerifications()
  const counts: Record<TabKey, number> | null = all.data
    ? {
        active: all.data.filter((r) => r.verification.status === 'open' || r.verification.status === 'awaiting_supplier').length,
        awaiting_supplier: all.data.filter((r) => r.verification.status === 'awaiting_supplier').length,
        approved: all.data.filter((r) => r.verification.status === 'approved').length,
        rejected: all.data.filter((r) => r.verification.status === 'rejected').length,
        all: all.data.length,
      }
    : null

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v == null) next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }

  const rows = list.data?.slice().sort((a, b) => (a.verification.createdAt < b.verification.createdAt ? 1 : -1))
  const selected = (all.data ?? []).find((r) => r.verification.id === selectedId) ?? list.data?.find((r) => r.verification.id === selectedId) ?? null

  const columns: Column<VerificationRow>[] = [
    {
      key: 'ref',
      header: 'Request',
      cell: (r) => (
        <div>
          <div className="font-mono text-[12.5px] font-medium">{r.verification.ref}</div>
          <div className="text-[11.5px] text-fg-3">{REASON[r.verification.reason] ?? r.verification.reason}</div>
        </div>
      ),
    },
    {
      key: 'order',
      header: 'Order',
      cell: (r) => (
        <Link to={`/admin/orders/${r.orderRef || r.orderId}`} onClick={(e) => e.stopPropagation()} className="font-mono text-[12.5px] text-accent-ink hover:underline">
          {r.orderRef}
        </Link>
      ),
    },
    { key: 'service', header: 'Service', cell: (r) => <div className="max-w-[220px] truncate">{r.serviceName}</div> },
    { key: 'account', header: 'Account', hideBelow: 'lg', cell: (r) => <div className="max-w-[180px] truncate text-fg-2">{r.accountName}</div> },
    { key: 'supplier', header: 'Supplier', hideBelow: 'xl', cell: (r) => <span className="text-fg-2">{r.supplierName || '—'}</span> },
    { key: 'result', header: 'Result', hideBelow: 'md', cell: (r) => <div className="max-w-[200px] truncate text-[12px] text-fg-3">{r.result ?? '—'}</div> },
    { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.verification.status} /> },
    {
      key: 'age',
      header: 'Age',
      align: 'right',
      sortValue: (r) => r.verification.createdAt,
      cell: (r) => (
        <span className="font-mono text-[12px] text-fg-3" title={dateTime(r.verification.createdAt)}>
          {age(r.verification.createdAt, now)}
        </span>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Verification requests"
        description="After-care is part of the order lifecycle: a customer reports a completed result as wrong or not working, ORVEX rechecks or asks the supplier, and an approved request refunds through the ledger."
      />

      <Card className="mb-4 flex flex-wrap items-start gap-3 px-5 py-3.5">
        <LifeBuoy className="mt-0.5 size-4 shrink-0 text-fg-3" />
        <div className="min-w-0 flex-1 text-[12.5px] text-fg-2">
          <span className="font-medium text-fg">How it works.</span> Open → <span className="font-mono text-[12px]">Recheck supplier</span> (getStatus, no new order) or <span className="font-mono text-[12px]">Request supplier verification</span> (awaiting supplier, a supplier credit may follow) → approve a refund (wallet or original method, capped at price − refunded) or reject with a note. The order stays <StatusBadge status="completed" /> throughout; only its financial status changes.
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Tabs items={TABS.map((t) => ({ ...t, count: counts?.[t.value] }))} value={tab} onChange={(v) => set({ status: v === 'active' ? null : v })} className="px-3" />
        {list.isError ? (
          <EmptyState
            icon={<FileSearch />}
            title="Could not load verification requests"
            description={(list.error as Error | null)?.message}
            action={
              <Button size="sm" variant="secondary" onClick={() => list.refetch()}>
                Retry
              </Button>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.verification.id}
            loading={list.isLoading}
            dense
            minWidth={720}
            selectedKey={selectedId}
            onRowClick={(r) => set({ v: r.verification.id })}
            empty={<EmptyState icon={<Inbox />} title={tab === 'active' ? 'No open verification requests' : 'Nothing here'} description={tab === 'active' ? 'Customers can open a request from a completed order in the portal or on the storefront tracking page.' : 'No requests with this status.'} />}
          />
        )}
      </Card>

      <VerificationDrawer row={selected} open={!!selectedId && !!selected} onClose={() => set({ v: null })} onOpenOrder={(ref) => navigate(`/admin/orders/${ref}`)} />
    </div>
  )
}
