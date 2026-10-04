import { useMemo, useState } from 'react'
import { ChartColumn, CircleCheck, Coins, Download, LoaderCircle, ReceiptText, ShoppingCart, TrendingUp, Wallet } from 'lucide-react'
import { Button, DemoTag, EmptyState, KpiCard, PageHeader, Segmented, Card } from '@/components/ui'
import { useInstallation, useReport, useServices } from '@/hooks/installation'
import { toast } from '@/stores/toast'
import { cn } from '@/lib/cn'
import { money, num, pct } from '@/lib/format'
import type { ReportSummary } from '@/types/installation'
import { exportReportCsv } from './reports/exportReport'
import { ChannelSplit, Highlights, HeatmapCard, ProviderBreakdown, ResellerBreakdown, RevenueCard, ServiceBreakdown, StatusCard } from './reports/ReportCards'

type Range = '7d' | '30d'

export default function ReportsPage() {
  const [range, setRange] = useState<Range>('30d')
  const report = useReport(range)
  const services = useServices()
  const installation = useInstallation()
  const r = report.data
  const loading = report.isLoading
  const switching = report.isPlaceholderData || (report.isFetching && r?.range !== range)

  const spark = useMemo(() => {
    const d = r?.daily ?? []
    return {
      revenue: d.map((x) => x.revenue),
      cost: d.map((x) => x.cost),
      margin: d.map((x) => x.revenue - x.cost),
      orders: d.map((x) => x.success + x.failed + x.other),
      success: d.map((x) => (x.success + x.failed ? (x.success / (x.success + x.failed)) * 100 : 100)),
      aov: d.map((x) => (x.success ? x.revenue / x.success : 0)),
    }
  }, [r])

  const days = range === '7d' ? 7 : 30
  const marginPct = r && r.revenue ? (r.margin / r.revenue) * 100 : 0
  const completed = r ? r.daily.reduce((a, d) => a + d.success, 0) : 0

  const onExport = (data: ReportSummary) => {
    const file = exportReportCsv(data, { org: installation.data?.orgName })
    toast.success('Report exported', file)
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Revenue, supplier cost and margin across IMEI checks, unlocks, server services and codes — by service, reseller and supplier, computed from the order data in your own database."
        actions={
          <>
            <Segmented
              size="md"
              value={range}
              onChange={setRange}
              items={[
                { value: '7d', label: 'Last 7 days' },
                { value: '30d', label: 'Last 30 days' },
              ]}
            />
            <Button variant="secondary" leading={<Download />} disabled={!r || switching} onClick={() => r && onExport(r)}>
              Export CSV
            </Button>
          </>
        }
      />

      {report.isError && !r ? (
        <Card>
          <EmptyState
            icon={<ChartColumn />}
            title="Reports are unavailable"
            description="The installation API did not return report data. Try again in a moment."
            action={
              <Button size="sm" variant="secondary" onClick={() => report.refetch()}>
                Retry
              </Button>
            }
          />
        </Card>
      ) : (
        <div className={cn('space-y-4 transition-opacity duration-200', switching && 'opacity-60')}>
          <div className="flex items-center gap-2 text-[12px] text-fg-3">
            {switching ? <LoaderCircle className="size-3.5 animate-spin" /> : <span className="size-1.5 rounded-full bg-success" />}
            {r ? (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {num(r.orders)} orders over {days} days · {num(completed)} completed · amounts in USD
                <DemoTag />
              </span>
            ) : (
              <span>Loading report…</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 2xl:grid-cols-6">
            <KpiCard loading={loading} icon={<Coins />} label="Revenue" value={money(r?.revenue, { compact: true })} spark={spark.revenue} sparkColor="var(--c1)" footer="Completed checks, unlocks & codes" />
            <KpiCard loading={loading} icon={<Wallet />} label="Supplier cost" value={money(r?.cost, { compact: true })} spark={spark.cost} sparkColor="var(--c6)" footer={r ? `${pct(r.revenue ? (r.cost / r.revenue) * 100 : 0)} of revenue` : undefined} />
            <KpiCard
              loading={loading}
              icon={<TrendingUp />}
              label="Gross margin"
              value={money(r?.margin, { compact: true })}
              spark={spark.margin}
              sparkColor="var(--c2)"
              footer={
                r ? (
                  <span>
                    <span className="font-medium text-fg tabular">{pct(marginPct)}</span> margin rate
                  </span>
                ) : undefined
              }
            />
            <KpiCard loading={loading} icon={<ShoppingCart />} label="Orders" value={num(r?.orders)} spark={spark.orders} sparkColor="var(--c2)" footer={r ? `${num(Math.round(r.orders / days))} per day on average` : undefined} />
            <KpiCard loading={loading} icon={<CircleCheck />} label="Success rate" value={r ? pct(r.successRate) : '—'} spark={spark.success} sparkColor="var(--success)" footer="Of settled orders" />
            <KpiCard loading={loading} icon={<ReceiptText />} label="Avg order value" value={money(r?.avgOrderValue)} spark={spark.aov} sparkColor="var(--c6)" footer="Per completed order" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <RevenueCard report={r} loading={loading} />
            <StatusCard report={r} loading={loading} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <ServiceBreakdown report={r} services={services.data} loading={loading} />
            <ResellerBreakdown report={r} loading={loading} />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <ProviderBreakdown report={r} loading={loading} />
            <ChannelSplit report={r} loading={loading} />
            <div className="md:col-span-2 lg:col-span-1">
              <Highlights report={r} loading={loading} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <HeatmapCard report={r} loading={loading} />
          </div>
        </div>
      )}
    </div>
  )
}
