import { useDeferredValue, useEffect, useEffectEvent, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ArrowRightLeft, Inbox, Plus, ShieldAlert, X } from 'lucide-react'
import { Badge, Button, Card, DataTable, Dot, EmptyState, PageHeader, Pagination, SearchInput, Segmented, Select, Switch, Tabs, Tooltip, type Column } from '@/components/ui'
import { ChannelBadge, CHANNEL_META, FinancialBadge, Money, OrderStatusBadge, ScenarioTag } from '@/components/domain'
import { FINANCIAL_STATUS_LABEL, ACCOUNT_TIER_LABEL } from '@/core/domain'
import { useOrders, useOrderStats } from '@/hooks/installation'
import type { FinancialStatus, OrderChannel, OrderQuery, OrderRow, OrderStatus } from '@/types/installation'
import { cn } from '@/lib/cn'
import { dateTime, num, relative } from '@/lib/format'
import { deviceLabel } from './helpers'
import { CreateOrderModal } from './CreateOrderModal'

const PAGE_SIZE = 25

type StatusTab = 'all' | 'open' | OrderStatus
const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'awaiting_payment', label: 'Awaiting payment' },
  { value: 'queued', label: 'Queued' },
  { value: 'processing', label: 'Processing' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
]

const FINANCIAL: FinancialStatus[] = ['none', 'held', 'captured', 'released', 'partially_refunded', 'refunded']
const CHANNELS = Object.keys(CHANNEL_META) as OrderChannel[]
type Range = NonNullable<OrderQuery['range']>
const RANGES: { value: Range; label: string }[] = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: 'all', label: 'All' },
]

export default function OrdersPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const statusParam = (params.get('status') ?? 'all') as StatusTab
  const status: StatusTab = STATUS_TABS.some((t) => t.value === statusParam) ? statusParam : 'all'
  const financial = (params.get('financial') ?? '') as FinancialStatus | ''
  const channel = (params.get('channel') ?? '') as OrderChannel | ''
  const range = (params.get('range') ?? 'all') as Range
  const failover = params.get('failover') === '1'
  const scenario = params.get('scenario') ?? ''
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1)
  const createOpen = params.get('create') === '1'

  const [search, setSearch] = useState(params.get('search') ?? '')
  const q = useDeferredValue(search.trim())

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '') next.delete(k)
      else next.set(k, v)
    }
    if (!('page' in patch)) next.delete('page')
    setParams(next, { replace: true })
  }

  const pushed = useRef(params.get('search') ?? '')
  const syncSearchToUrl = useEffectEvent((value: string) => {
    if ((params.get('search') ?? '') !== value) {
      pushed.current = value
      update({ search: value || null })
    }
  })
  useEffect(() => {
    syncSearchToUrl(q)
  }, [q])

  // keep the input in sync when the URL changes from elsewhere (cockpit links, back button)
  const urlSearch = params.get('search') ?? ''
  useEffect(() => {
    if (urlSearch !== pushed.current) {
      pushed.current = urlSearch
      setSearch(urlSearch)
    }
  }, [urlSearch])

  const stats = useOrderStats()
  const list = useOrders({
    status: status === 'all' ? undefined : status,
    financial: financial || undefined,
    channel: channel || undefined,
    range: range === 'all' ? undefined : range,
    failover: failover || undefined,
    scenario: scenario || undefined,
    search: q || undefined,
    page,
    pageSize: PAGE_SIZE,
  })

  const s = stats.data
  const tabs = STATUS_TABS.map((t) => ({
    value: t.value,
    label:
      t.value === 'needs_review' ? (
        <span className={cn('inline-flex items-center gap-1.5', (s?.needs_review ?? 0) > 0 && 'text-danger')}>
          {(s?.needs_review ?? 0) > 0 && <Dot tone="danger" pulse />}
          {t.label}
        </span>
      ) : (
        t.label
      ),
    count: s ? num(s[t.value] ?? 0) : undefined,
  }))

  const filtered = !!(financial || channel || range !== 'all' || failover || scenario || q)
  const data = list.data

  const columns: Column<OrderRow>[] = [
    {
      key: 'ref',
      header: 'Order',
      width: 'w-[150px]',
      cell: (r) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[12.5px] font-medium text-fg">{r.ref}</span>
          </div>
          {r.scenario && <ScenarioTag id={r.scenario} className="mt-1" />}
        </div>
      ),
    },
    {
      key: 'service',
      header: 'Service',
      cell: (r) => {
        const dev = deviceLabel(r.input)
        return (
          <div className="min-w-0 max-w-[280px]">
            <div className="truncate font-medium text-fg">{r.serviceName}</div>
            <div className="truncate text-[11.5px] text-fg-3">
              {r.categoryName}
              {dev && <span className="ml-1.5 font-mono">{dev}</span>}
            </div>
          </div>
        )
      },
    },
    {
      key: 'account',
      header: 'Account',
      hideBelow: 'lg',
      cell: (r) => (
        <div className="min-w-0 max-w-[200px]">
          <div className="truncate text-fg-2">{r.accountName}</div>
          <div className="text-[11.5px] text-fg-3">{ACCOUNT_TIER_LABEL[r.accountTier]}</div>
        </div>
      ),
    },
    { key: 'channel', header: 'Channel', hideBelow: 'xl', cell: (r) => <ChannelBadge channel={r.channel} /> },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => (
        <div className="min-w-0">
          <OrderStatusBadge status={r.status} />
          {r.reviewReason && (
            <Tooltip content={r.reviewReason}>
              <div className="mt-1 max-w-[200px] truncate text-[11px] text-danger">{r.reviewReason}</div>
            </Tooltip>
          )}
        </div>
      ),
    },
    { key: 'financial', header: 'Financial', hideBelow: 'md', cell: (r) => <FinancialBadge status={r.financialStatus} /> },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      cell: (r) => (
        <div>
          <Money value={r.price} className="font-mono text-[12.5px] text-fg" />
          {r.refundedTotal > 0 && (
            <div className="text-[11px] text-info">
              −<Money value={r.refundedTotal} />
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'supplier',
      header: 'Supplier',
      hideBelow: 'lg',
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="max-w-[150px] truncate text-fg-2">{r.supplierName ?? <span className="text-fg-3">—</span>}</span>
          {r.attempts > 1 ? (
            <Tooltip content={`${r.attempts} supplier attempts — failover after a safe rejection`}>
              <Badge tone="warning" icon={<ArrowRightLeft />}>
                {r.attempts}
              </Badge>
            </Tooltip>
          ) : null}
        </div>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      align: 'right',
      hideBelow: 'sm',
      cell: (r) => (
        <span className="text-[12px] whitespace-nowrap text-fg-3" title={dateTime(r.createdAt)}>
          {relative(r.createdAt)}
        </span>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Every channel — storefront, portal, API, DHRU endpoint and admin — enters the same PlaceOrder command. Fulfilment and financial status are tracked separately."
        actions={
          <>
            <Button variant="secondary" leading={<ShieldAlert />} onClick={() => update({ status: 'needs_review' })}>
              Review queue
              {(s?.needs_review ?? 0) > 0 && <Badge tone="danger">{s!.needs_review}</Badge>}
            </Button>
            <Button variant="accent" leading={<Plus />} onClick={() => update({ create: '1' })}>
              Create admin order
            </Button>
          </>
        }
      />

      <Card className="overflow-hidden">
        <Tabs items={tabs} value={status} onChange={(v) => update({ status: v === 'all' ? null : v })} className="px-3" />
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Ref, IMEI, account, idempotency key…" className="w-full sm:w-[300px]" />
          <Select
            inputSize="sm"
            className="w-[170px]"
            value={financial}
            onChange={(e) => update({ financial: e.target.value || null })}
            options={[{ value: '', label: 'Any financial status' }, ...FINANCIAL.map((f) => ({ value: f, label: `${FINANCIAL_STATUS_LABEL[f]}${s ? ` (${s[`fin_${f}`] ?? 0})` : ''}` }))]}
          />
          <Select inputSize="sm" className="w-[140px]" value={channel} onChange={(e) => update({ channel: e.target.value || null })} options={[{ value: '', label: 'Any channel' }, ...CHANNELS.map((c) => ({ value: c, label: CHANNEL_META[c].label }))]} />
          <Segmented size="xs" items={RANGES} value={range} onChange={(v) => update({ range: v === 'all' ? null : v })} />
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-[12.5px] text-fg-2 hover:bg-surface-2">
            <Switch size="sm" checked={failover} onChange={(v) => update({ failover: v ? '1' : null })} label="Failover only" />
            Failover only
            {s?.failover != null && <span className="text-fg-3 tabular">{s.failover}</span>}
          </label>
          {scenario && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 py-0.5 pr-1 pl-2.5 text-[12px] font-medium text-accent-ink ring-1 ring-accent/20">
              Scenario {scenario}
              <button type="button" onClick={() => update({ scenario: null })} className="grid size-4.5 place-items-center rounded-full hover:bg-accent/15" aria-label="Clear scenario filter">
                <X className="size-3" />
              </button>
            </span>
          )}
          <div className="ml-auto flex items-center gap-3">
            {filtered && (
              <Button
                size="xs"
                variant="ghost"
                onClick={() => {
                  setSearch('')
                  update({ financial: null, channel: null, range: null, failover: null, scenario: null, search: null })
                }}
              >
                Clear filters
              </Button>
            )}
            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-fg-3">
              <Dot tone="accent" pulse={!list.isFetching} />
              Live
            </span>
          </div>
        </div>

        {status === 'needs_review' && (data?.total ?? 0) > 0 && (
          <div className="flex items-start gap-2.5 border-b border-line bg-danger/[0.05] px-5 py-2.5 text-[12.5px] text-fg-2">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" />
            <span>
              <span className="font-medium text-fg">Supplier outcome unknown.</span> These orders were sent but the supplier never gave a definitive answer. Automatic failover is blocked to prevent duplicate supplier orders; customer funds stay held until an operator resolves each order.
            </span>
          </div>
        )}

        {list.isError ? (
          <EmptyState
            icon={<Inbox />}
            title="Could not load orders"
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
            rows={data?.items}
            rowKey={(r) => r.id}
            loading={list.isLoading}
            dense
            minWidth={760}
            onRowClick={(r) => navigate(`/admin/orders/${r.ref}`)}
            rowClassName={(r) => (r.status === 'needs_review' ? 'bg-danger/[0.035] hover:bg-danger/[0.06]! [&>td:first-child]:shadow-[inset_3px_0_0_var(--danger)]' : undefined)}
            empty={
              <EmptyState
                icon={<Inbox />}
                title={filtered || status !== 'all' ? 'No orders match these filters' : 'No orders yet'}
                description={filtered ? 'Try a wider range or clear the filters.' : status === 'needs_review' ? 'Nothing is waiting for an operator. Unknown supplier outcomes land here.' : 'Orders from every channel appear here as they are placed.'}
                action={
                  filtered ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setSearch('')
                        update({ financial: null, channel: null, range: null, failover: null, scenario: null, search: null })
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            }
          />
        )}
        {data && data.total > 0 && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => update({ page: String(p) })} />}
      </Card>

      <CreateOrderModal open={createOpen} onClose={() => update({ create: null })} onCreated={(row) => navigate(`/admin/orders/${row.ref}`)} />
    </div>
  )
}
