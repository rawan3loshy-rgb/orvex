import { useSearchParams } from 'react-router'
import { CreditCard } from 'lucide-react'
import type { PaymentRow } from '@/types/installation'
import { usePaymentMethods, usePayments } from '@/hooks/installation'
import { Money, SimulatedBadge } from '@/components/domain'
import { Badge, Card, DataTable, EmptyState, PageHeader, Pagination, Select, StatusBadge, Tabs, type Column } from '@/components/ui'
import { dateTime } from '@/lib/format'
import { LoadError } from './shared'
import { METHOD_LABEL } from './helpers'
import { IntentDrawer } from './payments/IntentDrawer'
import { ChargebacksTab, MethodsTab, RefundsTab } from './payments/OtherTabs'

type TabKey = 'intents' | 'methods' | 'refunds' | 'chargebacks'
const PAGE_SIZE = 30

export default function PaymentsPage() {
  const [params, setParams] = useSearchParams()
  const t = params.get('tab') as TabKey | null
  const tab: TabKey = t === 'methods' || t === 'refunds' || t === 'chargebacks' ? t : 'intents'
  const intentId = params.get('intent')
  const methods = usePaymentMethods()

  const update = (patch: Record<string, string | null>, keepPage = false) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (!v) next.delete(k)
      else next.set(k, v)
    }
    if (!keepPage && !('page' in patch)) next.delete('page')
    setParams(next, { replace: true })
  }

  const drawerQ = usePayments({ intent: intentId ?? undefined, page: 1, pageSize: 1 })
  const drawerIntent = intentId ? drawerQ.data?.items.find((p) => p.id === intentId) : undefined

  return (
    <div>
      <PageHeader
        icon={<CreditCard />}
        title="Payments"
        description="Payment intents, methods, refunds and chargebacks. Every succeeded payment funds a wallet exactly once (DR Gateway Clearing / CR Customer Available); a storefront checkout is payment → wallet → hold → order."
        actions={<SimulatedBadge label="All gateways simulated" />}
      />
      <Tabs<TabKey>
        className="mb-5"
        items={[
          { value: 'intents', label: 'Intents' },
          { value: 'methods', label: 'Methods' },
          { value: 'refunds', label: 'Refunds' },
          { value: 'chargebacks', label: 'Chargebacks' },
        ]}
        value={tab}
        onChange={(v) => update({ tab: v === 'intents' ? null : v, status: null, method: null, purpose: null })}
      />
      {tab === 'intents' && <IntentsTab onOpen={(id) => update({ intent: id }, true)} />}
      {tab === 'methods' && <MethodsTab />}
      {tab === 'refunds' && <RefundsTab />}
      {tab === 'chargebacks' && <ChargebacksTab onOpenIntent={(id) => update({ intent: id }, true)} />}

      <IntentDrawer open={!!intentId} intent={drawerIntent} loading={drawerQ.isLoading} methods={methods.data} onClose={() => update({ intent: null }, true)} />
    </div>
  )
}

function IntentsTab({ onOpen }: { onOpen: (id: string) => void }) {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const method = params.get('method') ?? ''
  const purpose = params.get('purpose') ?? ''
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1)
  const q = usePayments({ status: status || undefined, method: method || undefined, purpose: purpose || undefined, page, pageSize: PAGE_SIZE })
  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    if (k !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }
  const filtered = !!(status || method || purpose)
  const columns: Column<PaymentRow>[] = [
    {
      key: 'ref',
      header: 'Payment',
      cell: (p) => (
        <div>
          <div className="font-mono text-[12.5px] font-medium">{p.ref}</div>
          <div className="font-mono text-[11px] text-fg-3">{p.gatewayRef}</div>
        </div>
      ),
    },
    {
      key: 'account',
      header: 'Account',
      cell: (p) => (
        <div className="min-w-0">
          <div className="truncate text-[12.5px]">{p.accountName}</div>
          <div className="text-[11px] text-fg-3">{p.purpose === 'top_up' ? 'Wallet top-up' : p.orderRef ? `Order ${p.orderRef}` : 'Order payment'}</div>
        </div>
      ),
    },
    { key: 'method', header: 'Method', hideBelow: 'sm', cell: (p) => <span className="text-[12.5px] text-fg-2">{METHOD_LABEL[p.method] ?? p.method}</span> },
    {
      key: 'status',
      header: 'Status',
      cell: (p) => (
        <span className="inline-flex items-center gap-1.5">
          <StatusBadge status={p.status} />
          {p.chargebackId && <Badge tone="danger">CB</Badge>}
        </span>
      ),
    },
    { key: 'amount', header: 'Amount', align: 'right', cell: (p) => <Money value={p.amount} className="font-mono text-[12.5px] font-medium" /> },
    { key: 'refunded', header: 'Refunded', align: 'right', hideBelow: 'lg', cell: (p) => (p.refundedTotal ? <Money value={p.refundedTotal} className="font-mono text-[12.5px] text-info" /> : <span className="text-fg-3">—</span>) },
    { key: 'at', header: 'Created', align: 'right', hideBelow: 'md', cell: (p) => <span className="text-[12px] whitespace-nowrap text-fg-2">{dateTime(p.createdAt)}</span> },
  ]
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-5">
        <Select inputSize="sm" className="w-[170px]" value={status} onChange={(e) => set('status', e.target.value || null)} options={[{ value: '', label: 'Any status' }, ...['requires_payment', 'pending', 'succeeded', 'failed', 'cancelled'].map((s) => ({ value: s, label: s.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase()) }))]} />
        <Select inputSize="sm" className="w-[160px]" value={method} onChange={(e) => set('method', e.target.value || null)} options={[{ value: '', label: 'Any method' }, ...Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))]} />
        <Select inputSize="sm" className="w-[150px]" value={purpose} onChange={(e) => set('purpose', e.target.value || null)} options={[{ value: '', label: 'Any purpose' }, { value: 'order', label: 'Order' }, { value: 'top_up', label: 'Top-up' }]} />
        {status === 'pending' && <span className="text-[12px] text-fg-3">Pending bank transfers wait for finance to confirm receipt.</span>}
      </div>
      {q.isError ? (
        <LoadError what="payments" onRetry={() => q.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={q.data?.items}
          loading={q.isLoading}
          rowKey={(p) => p.id}
          onRowClick={(p) => onOpen(p.id)}
          selectedKey={params.get('intent')}
          dense
          minWidth={760}
          empty={<EmptyState icon={<CreditCard />} title={filtered ? 'No payments match' : 'No payments yet'} description={filtered ? 'Try another status, method or purpose.' : 'Storefront checkouts and wallet top-ups create payment intents.'} />}
        />
      )}
      {q.data && q.data.total > 0 && <Pagination page={q.data.page} pageSize={q.data.pageSize} total={q.data.total} onPage={(p) => set('page', String(p))} />}
    </Card>
  )
}
