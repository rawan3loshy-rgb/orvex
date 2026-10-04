import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, CircleDollarSign, Coins, PieChart, ReceiptText, TrendingUp } from 'lucide-react'
import { useOrderVolume } from '@/hooks/installation'
import { Card, CardHeader, EmptyState, KpiCard, Segmented, Skeleton } from '@/components/ui'
import { ChartLegend, Donut, TimeChart } from '@/components/charts'
import { categoryColor } from '@/components/brand'
import { cn } from '@/lib/cn'
import { dateShort, money, num, pct, time } from '@/lib/format'
import { change, deriveMix, deriveTotals, hourlySeries, useOrderWindow, usePreviousWindow } from './ops'
import { HeadlineStat } from './parts'

/* Series colours: coral = the key series of each chart, graphite (c2) = secondary,
 * stone (c6) = supplier cost, status colours only for success / failure. */
const C_KEY = 'var(--c1)'
const C_SECONDARY = 'var(--c2)'
const C_COST = 'var(--c6)'
const C_INFLIGHT = 'color-mix(in oklab, var(--c2) 26%, var(--surface-3))'

/**
 * Commercial KPIs over the rolling 24h window (same order window as the flow),
 * compared with the 24h before it — so the row reads correctly at any hour.
 */
export function KpiRow() {
  const navigate = useNavigate()
  const { orders, loading } = useOrderWindow()
  const prev = usePreviousWindow()
  const cur = useMemo(() => deriveTotals(orders), [orders])
  const before = useMemo(() => (prev.complete ? deriveTotals(prev.orders) : null), [prev])
  const spark = useMemo(() => hourlySeries(orders), [orders])
  const cmp = 'vs previous 24h'
  const dOrders = change(cur.orders, before?.orders)
  const dRevenue = change(cur.revenue, before?.revenue, 40)
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <KpiCard
        loading={loading}
        icon={<ReceiptText />}
        label="Orders · 24h"
        value={num(cur.orders)}
        delta={dOrders}
        deltaLabel={cmp}
        footer={dOrders == null ? 'Rolling 24h, hourly trend' : undefined}
        spark={spark.orders}
        sparkColor={C_KEY}
        onClick={() => navigate('/admin/orders?range=24h')}
      />
      <KpiCard
        loading={loading}
        icon={<CircleDollarSign />}
        label="Revenue · 24h"
        value={money(cur.revenue)}
        delta={dRevenue}
        deltaLabel={cmp}
        footer={dRevenue == null ? 'Delivered orders, rolling 24h' : undefined}
        spark={spark.revenue}
        sparkColor={C_SECONDARY}
        onClick={() => navigate('/admin/reports')}
      />
      <KpiCard
        loading={loading}
        icon={<Coins />}
        label="Provider cost · 24h"
        value={money(cur.cost)}
        footer={cur.revenue ? `${pct((cur.cost / cur.revenue) * 100)} of revenue · supplier wallets` : 'Charged by suppliers on success'}
        spark={spark.cost}
        sparkColor={C_COST}
        onClick={() => navigate('/admin/transactions')}
      />
      <KpiCard
        loading={loading}
        icon={<TrendingUp />}
        label="Gross margin · 24h"
        value={money(cur.margin)}
        delta={change(cur.margin, before?.margin, 20)}
        footer={cur.revenue ? `${pct((cur.margin / cur.revenue) * 100)} margin${before ? ` · ${cmp}` : ''}` : undefined}
        spark={spark.margin}
        sparkColor={C_KEY}
        onClick={() => navigate('/admin/reports')}
      />
    </div>
  )
}

type Range = '24h' | '7d' | '30d'
type Metric = 'orders' | 'money'

export function VolumeCard({ className }: { className?: string }) {
  const [range, setRange] = useState<Range>('24h')
  const [metric, setMetric] = useState<Metric>('orders')
  const vol = useOrderVolume(range)
  const data = useMemo(() => vol.data ?? [], [vol.data])
  const totals = useMemo(() => {
    const t = { orders: 0, success: 0, failed: 0, revenue: 0, cost: 0 }
    for (const b of data) {
      t.orders += b.success + b.failed + b.other
      t.success += b.success
      t.failed += b.failed
      t.revenue += b.revenue
      t.cost += b.cost
    }
    return t
  }, [data])
  const xFormat = (label: string) => (range === '24h' ? time(label) : dateShort(label))
  const chartData = useMemo(() => data.map((b) => ({ ...b, margin: +(b.revenue - b.cost).toFixed(2) })), [data])
  const empty = !vol.isLoading && totals.orders === 0
  const legend =
    metric === 'orders'
      ? [
          { label: 'Delivered', color: C_KEY },
          { label: 'In flight / other', color: C_INFLIGHT },
          { label: 'Failed', color: 'var(--danger)' },
        ]
      : [
          { label: 'Gross margin', color: C_KEY },
          { label: 'Revenue', color: C_SECONDARY },
          { label: 'Provider cost', color: C_COST },
        ]

  return (
    <Card className={cn('flex flex-col overflow-hidden', className)}>
      <CardHeader
        title={metric === 'orders' ? 'Order volume' : 'Revenue, cost & margin'}
        description={range === '24h' ? 'Last 24 hours, hourly' : range === '7d' ? 'Last 7 days, daily' : 'Last 30 days, daily'}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Segmented
              size="xs"
              value={metric}
              onChange={setMetric}
              items={[
                { value: 'orders', label: 'Orders' },
                { value: 'money', label: 'Money' },
              ]}
            />
            <Segmented
              size="xs"
              value={range}
              onChange={setRange}
              items={[
                { value: '24h', label: '24h' },
                { value: '7d', label: '7d' },
                { value: '30d', label: '30d' },
              ]}
            />
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 pb-2 sm:grid-cols-4">
        {metric === 'orders' ? (
          <>
            <HeadlineStat label="Orders" value={num(totals.orders)} />
            <HeadlineStat label="Delivered" value={num(totals.success)} dot={C_KEY} />
            <HeadlineStat label="Failed" value={num(totals.failed)} dot="var(--danger)" />
            <HeadlineStat label="Success rate" value={totals.success + totals.failed ? pct((totals.success / (totals.success + totals.failed)) * 100) : '—'} />
          </>
        ) : (
          <>
            <HeadlineStat label="Revenue" value={money(totals.revenue)} dot={C_SECONDARY} />
            <HeadlineStat label="Provider cost" value={money(totals.cost)} dot={C_COST} dashed />
            <HeadlineStat label="Gross margin" value={money(totals.revenue - totals.cost)} dot={C_KEY} />
            <HeadlineStat label="Margin %" value={totals.revenue ? pct(((totals.revenue - totals.cost) / totals.revenue) * 100) : '—'} />
          </>
        )}
      </div>
      <div className="flex-1 px-3 pb-4">
        {vol.isLoading ? (
          <Skeleton className="mx-2 h-[260px] w-auto rounded-lg" />
        ) : empty ? (
          <EmptyState compact icon={<ReceiptText />} title="No orders in this period" description="Volume appears here as resellers and website customers place orders." className="h-[260px]" />
        ) : metric === 'orders' ? (
          <TimeChart
            data={chartData}
            x={(d) => d.t}
            kind="bar"
            stacked
            height={260}
            xFormat={xFormat}
            tooltipTitle={(d) => (range === '24h' ? `${time(d.t)} – ${time(new Date(new Date(d.t).getTime() + 3600_000))}` : dateShort(d.t))}
            series={[
              { key: 'success', label: 'Delivered', color: C_KEY },
              { key: 'other', label: 'In flight / other', color: C_INFLIGHT },
              { key: 'failed', label: 'Failed', color: 'var(--danger)' },
            ]}
            xLabelCount={range === '24h' ? 8 : 7}
          />
        ) : (
          <TimeChart
            data={chartData}
            x={(d) => d.t}
            kind="area"
            height={260}
            xFormat={xFormat}
            yFormat={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`)}
            tooltipFormat={(v) => money(v)}
            tooltipTitle={(d) => (range === '24h' ? time(d.t) : dateShort(d.t))}
            series={[
              { key: 'revenue', label: 'Revenue', color: C_SECONDARY },
              {
                key: 'cost',
                label: 'Provider cost',
                color: C_COST,
                type: 'line',
                dashed: true,
              },
              {
                key: 'margin',
                label: 'Gross margin',
                color: C_KEY,
                type: 'line',
              },
            ]}
            xLabelCount={range === '24h' ? 8 : 7}
          />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line px-5 py-3">
        <ChartLegend items={legend} />
        <Link to={metric === 'orders' ? '/admin/orders' : '/admin/reports'} className="flex items-center gap-1 text-[12.5px] text-fg-3 transition-colors hover:text-fg">
          {metric === 'orders' ? 'All orders' : 'Reports'} <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </Card>
  )
}

export function ServiceMixCard({ className }: { className?: string }) {
  const [metric, setMetric] = useState<'orders' | 'revenue'>('orders')
  const { orders, loading } = useOrderWindow()
  const navigate = useNavigate()
  const mix = useMemo(() => deriveMix(orders), [orders])
  const value = (c: (typeof mix)[number]) => (metric === 'orders' ? c.orders : c.revenue)
  const total = mix.reduce((a, c) => a + value(c), 0)
  const best = useMemo(() => mix.filter((c) => c.revenue > 0).sort((a, b) => b.margin / b.revenue - a.margin / a.revenue)[0], [mix])

  return (
    <Card className={cn('flex flex-col overflow-hidden', className)}>
      <CardHeader
        title="Service mix"
        description="By GSM category · rolling 24h"
        actions={
          <Segmented
            size="xs"
            value={metric}
            onChange={setMetric}
            items={[
              { value: 'orders', label: 'Orders' },
              { value: 'revenue', label: 'Revenue' },
            ]}
          />
        }
      />
      {loading ? (
        <div className="flex flex-1 flex-col items-center gap-5 px-5 pb-5">
          <Skeleton className="size-[148px] rounded-full" />
          <div className="w-full space-y-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        </div>
      ) : total === 0 ? (
        <EmptyState compact icon={<PieChart />} title={metric === 'orders' ? 'No orders in 24h' : 'No delivered revenue in 24h'} description="IMEI checks, unlocks, server jobs and codes will be broken down here." className="flex-1" />
      ) : (
        <div className="flex flex-1 flex-col items-center gap-5 px-5 pb-4 sm:flex-row sm:items-center xl:flex-col 2xl:flex-row">
          <Donut
            size={148}
            thickness={16}
            segments={mix.map((c) => ({
              key: c.category,
              label: c.category,
              value: value(c),
              color: categoryColor(c.category),
            }))}
            center={
              <div>
                <div className="font-display text-[20px] font-semibold tracking-[-0.02em] tabular">{metric === 'orders' ? num(total) : money(total, { compact: true })}</div>
                <div className="text-[11px] text-fg-3">{metric === 'orders' ? 'orders' : 'delivered'}</div>
              </div>
            }
          />
          <ul className="w-full min-w-0 flex-1 space-y-0.5">
            {mix.map((c) => {
              const v = value(c)
              return (
                <li key={c.category}>
                  <button
                    type="button"
                    disabled={!c.top}
                    onClick={() => c.top && navigate(`/admin/services/${c.top.serviceId}`)}
                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors enabled:hover:bg-surface-2 disabled:cursor-default"
                  >
                    <span className="size-2 shrink-0 rounded-[3px]" style={{ background: categoryColor(c.category) }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] text-fg">{c.category}</span>
                      <span className="block truncate text-[11px] text-fg-3">{c.top ? `Top: ${c.top.name}` : 'No orders in 24h'}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[12.5px] font-medium text-fg tabular">{metric === 'orders' ? num(v) : money(v)}</span>
                      <span className="block text-[11px] text-fg-3 tabular">{total ? pct((v / total) * 100, 0) : '—'}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-[12px] text-fg-3">
        <span className="min-w-0 truncate">{best ? `Best margin: ${best.category} · ${pct((best.margin / best.revenue) * 100)}` : 'Margins appear once orders are delivered'}</span>
        <Link to="/admin/services" className="flex shrink-0 items-center gap-1 transition-colors hover:text-fg">
          Catalog <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </Card>
  )
}
