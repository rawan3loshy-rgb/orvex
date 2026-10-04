import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { ArrowRight, ChartColumn, Inbox, ReceiptText } from 'lucide-react'
import { ProviderMark } from '@/components/brand'
import { ChartLegend, Donut, TimeChart } from '@/components/charts'
import { Badge, Button, Card, CardHeader, DataTable, EmptyState, Progress, Skeleton, StatusBadge, type Column } from '@/components/ui'
import { useOrders } from '@/hooks/installation'
import { dateShort, dateTime, money, ms, num, pct, relative, titleCase } from '@/lib/format'
import type { OrderRow, Provider, Service, ServiceMapping } from '@/types/installation'
import { MetricStrip } from '../shared'

const DAY = 86400_000

export const orderColumns = (opts?: { hideService?: boolean; hideProvider?: boolean }): Column<OrderRow>[] => [
  {
    key: 'number',
    header: 'Order',
    sortValue: (o) => o.number,
    cell: (o) => (
      <div>
        <div className="font-mono text-[12.5px] font-medium text-fg">#{o.number}</div>
        <div className="font-mono text-[10.5px] text-fg-3">{o.id}</div>
      </div>
    ),
  },
  ...(opts?.hideService
    ? []
    : [
        {
          key: 'service',
          header: 'Service',
          sortValue: (o: OrderRow) => o.serviceName,
          cell: (o: OrderRow) => <span className="text-fg-2">{o.serviceName}</span>,
        } satisfies Column<OrderRow>,
      ]),
  { key: 'status', header: 'Status', sortValue: (o) => o.status, cell: (o) => <StatusBadge status={o.status} /> },
  { key: 'channel', header: 'Channel', hideBelow: 'lg', sortValue: (o) => o.channel, cell: (o) => <Badge variant="outline">{o.channel === 'api' ? 'API' : titleCase(o.channel)}</Badge> },
  ...(opts?.hideProvider
    ? []
    : [
        {
          key: 'provider',
          header: 'Supplier',
          hideBelow: 'md',
          sortValue: (o: OrderRow) => o.providerName ?? '',
          cell: (o: OrderRow) =>
            o.providerId ? (
              <span className="flex items-center gap-2">
                <ProviderMark id={o.providerId} size="xs" />
                <span className="text-fg-2">{o.providerName}</span>
                {o.attempts.length > 1 && <Badge tone="warning">{o.attempts.length} attempts</Badge>}
              </span>
            ) : (
              <span className="text-fg-3">—</span>
            ),
        } satisfies Column<OrderRow>,
      ]),
  { key: 'reseller', header: 'Customer', hideBelow: 'xl', sortValue: (o) => o.resellerName ?? '', cell: (o) => <span className="text-fg-2">{o.resellerName ?? (o.channel === 'website' ? 'Website' : 'Admin')}</span> },
  { key: 'price', header: 'Price', align: 'right', sortValue: (o) => o.price, cell: (o) => <span className="font-medium">{money(o.price)}</span> },
  { key: 'cost', header: 'Supplier cost', align: 'right', hideBelow: 'lg', sortValue: (o) => o.cost, cell: (o) => <span className="text-fg-2">{o.cost ? money(o.cost) : '—'}</span> },
  { key: 'created', header: 'Created', align: 'right', sortValue: (o) => o.createdAt, cell: (o) => <span className="text-fg-3" title={dateTime(o.createdAt)}>{relative(o.createdAt)}</span> },
]

export function OrdersTab({ service: s }: { service: Service }) {
  const navigate = useNavigate()
  const q = useOrders({ serviceId: s.id, pageSize: 20 }, { live: true })
  return (
    <Card className="overflow-hidden">
      <CardHeader
        icon={<ReceiptText />}
        title="Recent orders"
        description={q.data ? `Latest ${Math.min(20, q.data.items.length)} of ${num(q.data.total)} orders for ${s.name} · refreshes live` : 'Loading…'}
        actions={
          <Button size="sm" variant="ghost" to="/admin/orders" trailing={<ArrowRight />}>
            All orders
          </Button>
        }
      />
      <DataTable
        columns={orderColumns({ hideService: true })}
        rows={q.data?.items}
        rowKey={(o) => o.id}
        loading={q.isLoading}
        onRowClick={(o) => navigate(`/admin/orders/${o.id}`)}
        minWidth={680}
        skeletonRows={8}
        empty={<EmptyState compact icon={<Inbox />} title="No orders yet" description="Orders appear here as soon as the service is active and receiving traffic." />}
      />
    </Card>
  )
}

export function AnalyticsTab({ service: s, mappings, providers }: { service: Service; mappings: ServiceMapping[]; providers: Map<string, Provider> }) {
  const q = useOrders({ serviceId: s.id, range: '30d', pageSize: 200 })
  const agg = useMemo(() => {
    const items = q.data?.items ?? []
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const t0 = start.getTime() - 29 * DAY
    const days = Array.from({ length: 30 }, (_, i) => ({ t: new Date(t0 + i * DAY).toISOString(), success: 0, failed: 0, other: 0, revenue: 0, cost: 0 }))
    const byProvider = new Map<string, number>()
    let ok = 0
    let fail = 0
    let revenue = 0
    let cost = 0
    for (const o of items) {
      const i = Math.floor((new Date(o.createdAt).getTime() - t0) / DAY)
      const b = days[i]
      if (o.status === 'success') {
        ok++
        revenue += o.price
        cost += o.cost
      } else if (o.status === 'failed') fail++
      if (o.providerId) byProvider.set(o.providerId, (byProvider.get(o.providerId) ?? 0) + 1)
      if (!b) continue
      if (o.status === 'success') {
        b.success++
        b.revenue += o.price
        b.cost += o.cost
      } else if (o.status === 'failed') b.failed++
      else b.other++
    }
    const firstWithData = days.findIndex((d) => d.success + d.failed + d.other > 0)
    return { items, days, byProvider, ok, fail, revenue, cost, firstWithData }
  }, [q.data])

  const total = q.data?.total ?? 0
  const sampled = total > agg.items.length
  const share = [...agg.byProvider.entries()].sort((a, b) => b[1] - a[1])
  const sorted = mappings.slice().sort((a, b) => a.priority - b.priority)

  return (
    <div className="space-y-5">
      <MetricStrip
        loading={q.isLoading}
        cols="grid-cols-2 lg:grid-cols-4"
        items={[
          { label: 'Orders · 30d', value: num(total), sub: sampled ? `Charts use the latest ${agg.items.length}` : 'All orders charted' },
          { label: 'Success rate', value: agg.ok + agg.fail ? pct((agg.ok / (agg.ok + agg.fail)) * 100) : '—', sub: `${num(agg.fail)} failed in sample`, tone: agg.ok + agg.fail && agg.ok / (agg.ok + agg.fail) < 0.95 ? 'warning' : 'success' },
          { label: 'Revenue (sample)', value: money(agg.revenue, { compact: true }), sub: 'Completed orders only' },
          { label: 'Margin (sample)', value: money(agg.revenue - agg.cost, { compact: true }), sub: agg.revenue ? `${pct(((agg.revenue - agg.cost) / agg.revenue) * 100)} of revenue` : '—', tone: 'success' },
        ]}
      />
      <Card>
        <CardHeader
          icon={<ChartColumn />}
          title="Orders per day"
          description={sampled ? `Based on the most recent ${agg.items.length} of ${num(total)} orders in the last 30 days — earlier days may be under-counted.` : `All ${num(total)} orders in the last 30 days.`}
          actions={sampled ? <Badge tone="warning">Sampled · 200 cap</Badge> : <Badge tone="success">Complete</Badge>}
        />
        <div className="px-5 pb-5">
          {q.isLoading ? (
            <Skeleton className="h-[240px] rounded-lg" />
          ) : agg.items.length ? (
            <>
              <TimeChart
                data={agg.days}
                x={(d) => d.t}
                kind="bar"
                stacked
                height={240}
                xFormat={(l) => dateShort(l)}
                tooltipTitle={(d) => dateShort(d.t)}
                series={[
                  { key: 'success', label: 'Completed', color: 'var(--success)' },
                  { key: 'failed', label: 'Failed', color: 'var(--danger)' },
                  { key: 'other', label: 'In flight / other', color: 'var(--c6)' },
                ]}
                tooltipExtra={(d) => (
                  <div className="flex justify-between gap-4 text-[11.5px] text-fg-3">
                    <span>Revenue</span>
                    <span className="text-fg tabular">{money(d.revenue)}</span>
                  </div>
                )}
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <ChartLegend
                  items={[
                    { label: 'Completed', color: 'var(--success)' },
                    { label: 'Failed', color: 'var(--danger)' },
                    { label: 'In flight / other', color: 'var(--c6)' },
                  ]}
                />
                {sampled && agg.firstWithData > 0 && <span className="text-[11.5px] text-fg-3">Sample begins {dateShort(agg.days[agg.firstWithData]!.t)}</span>}
              </div>
            </>
          ) : (
            <EmptyState compact icon={<ChartColumn />} title="No orders in the last 30 days" />
          )}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader title="Success rate by supplier" description="From mapping telemetry over 30 days (all orders, not sampled)." />
          <ul className="divide-y divide-line border-t border-line">
            {sorted.map((m) => {
              const p = providers.get(m.providerId)
              const sr = m.successRate30d
              return (
                <li key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_160px_80px_72px]">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <ProviderMark id={m.providerId} size="sm" />
                    <span className="truncate text-[13px] font-medium">{p?.name}</span>
                    {p && p.status !== 'operational' && <StatusBadge status={p.status} />}
                  </div>
                  <Progress value={sr} tone={!sr ? 'neutral' : sr >= 97 ? 'success' : sr >= 90 ? 'warning' : 'danger'} className="col-span-2 sm:col-span-1" />
                  <span className="text-right text-[13px] font-medium tabular">{sr ? pct(sr) : '—'}</span>
                  <span className="text-right text-[12px] text-fg-3 tabular">{m.avgLatencyMs ? ms(m.avgLatencyMs) : '—'}</span>
                </li>
              )
            })}
            {!sorted.length && <li className="px-5 py-6 text-[13px] text-fg-3">No mappings.</li>}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Fulfilment share" description="Which supplier completed orders in the sample." />
          <div className="flex flex-col items-center gap-5 px-5 pb-5 sm:flex-row">
            <Donut
              size={148}
              thickness={16}
              segments={share.map(([id, n]) => ({ key: id, label: providers.get(id)?.name ?? id, value: n, color: providers.get(id)?.color ?? 'var(--c6)' }))}
              center={
                <div>
                  <div className="font-display text-xl font-semibold tabular">{num(agg.items.length)}</div>
                  <div className="text-[11px] text-fg-3">orders</div>
                </div>
              }
            />
            <ul className="w-full flex-1 space-y-2">
              {share.map(([id, n]) => (
                <li key={id} className="flex items-center gap-2 text-[12.5px]">
                  <span className="size-2 rounded-sm" style={{ background: providers.get(id)?.color ?? 'var(--c6)' }} />
                  <span className="flex-1 truncate text-fg-2">{providers.get(id)?.name ?? id}</span>
                  <span className="font-medium tabular">{pct((n / Math.max(1, agg.items.length)) * 100, 0)}</span>
                </li>
              ))}
              {!share.length && <li className="text-[12.5px] text-fg-3">No fulfilled orders yet.</li>}
            </ul>
          </div>
        </Card>
      </div>
    </div>
  )
}
