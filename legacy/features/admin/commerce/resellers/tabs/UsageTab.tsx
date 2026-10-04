import { useMemo } from 'react'
import { ArrowUpRight, ChartColumn, ScrollText } from 'lucide-react'
import { useResellerUsage } from '@/hooks/installation'
import type { Reseller } from '@/types/installation'
import { Button, Card, CardBody, CardHeader, EmptyState, Skeleton, Stat } from '@/components/ui'
import { BarList, ChartLegend, TimeChart } from '@/components/charts'
import { dateShort, ms, money, num, pct } from '@/lib/format'

export function UsageTab({ reseller }: { reseller: Reseller }) {
  const usage = useResellerUsage(reseller.id)
  const u = usage.data

  const daily = useMemo(() => (u?.daily ?? []).map((d) => ({ t: d.t, ok: d.orders - d.failed, failed: d.failed, spend: d.spend })), [u])
  const totals = useMemo(() => {
    const orders = u?.daily.reduce((a, d) => a + d.orders, 0) ?? 0
    const failed = u?.daily.reduce((a, d) => a + d.failed, 0) ?? 0
    const spend = u?.daily.reduce((a, d) => a + d.spend, 0) ?? 0
    const busiest = u?.daily.reduce((m, d) => (d.orders > m.orders ? d : m), { t: '', orders: 0, spend: 0, failed: 0 })
    return { orders, failed, spend, busiest, failRate: orders ? (failed / orders) * 100 : 0 }
  }, [u])

  const errRate = u && u.api.requests24h ? (u.api.errors24h / u.api.requests24h) * 100 : 0

  if (usage.isLoading)
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[300px] rounded-xl" />
        ))}
      </div>
    )

  if (!u || totals.orders === 0)
    return (
      <Card>
        <EmptyState icon={<ChartColumn />} title="No usage in the last 30 days" description={reseller.status === 'pending' ? 'This reseller has not been activated yet.' : 'Usage charts appear once the reseller starts placing orders.'} />
      </Card>
    )

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="Orders · 30 days" description={`${num(totals.orders)} orders · ${num(totals.failed)} failed and released (${pct(totals.failRate)})`} actions={<ChartLegend items={[{ label: 'Completed', color: 'var(--c2)' }, { label: 'Failed', color: 'var(--danger)' }]} />} />
        <CardBody>
          <TimeChart
            data={daily}
            x={(d) => d.t}
            kind="bar"
            stacked
            height={220}
            series={[
              { key: 'ok', label: 'Completed & in progress', color: 'var(--c2)' },
              { key: 'failed', label: 'Failed (released)', color: 'var(--danger)' },
            ]}
            xFormat={(l) => dateShort(l)}
            tooltipTitle={(d) => dateShort(d.t)}
            xLabelCount={6}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Spend · 30 days" description={`${money(totals.spend)} on completed orders${totals.busiest?.t ? ` · busiest day ${dateShort(totals.busiest.t)}` : ''}`} />
        <CardBody>
          <TimeChart data={daily} x={(d) => d.t} kind="area" height={220} series={[{ key: 'spend', label: 'Spend', color: 'var(--c1)' }]} yFormat={(v) => `$${num(Math.round(v))}`} tooltipFormat={(v) => money(v)} xFormat={(l) => dateShort(l)} tooltipTitle={(d) => dateShort(d.t)} xLabelCount={6} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Top services" description="IMEI checks, unlocks and codes by order count, last 30 days" />
        <CardBody>
          <BarList items={u.topServices.map((s, i) => ({ key: s.serviceId, label: s.name, value: s.orders, sub: pct((s.orders / totals.orders) * 100, 0), color: i === 0 ? 'var(--c1)' : 'color-mix(in oklab, var(--c2) 70%, transparent)' }))} format={(v) => num(v)} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          icon={<ScrollText />}
          title="Reseller API · last 24h"
          description="Requests authenticated with this reseller's keys."
          actions={
            <Button size="sm" variant="ghost" to={`/admin/developer/logs?search=${encodeURIComponent(reseller.name)}`} trailing={<ArrowUpRight />}>
              Logs
            </Button>
          }
        />
        <CardBody>
          <div className="grid grid-cols-2 gap-x-6 gap-y-6">
            <Stat label="Requests" value={num(u.api.requests24h)} sub={`≈ ${num(Math.round(u.api.requests24h / 24))} per hour`} />
            <Stat label="Errors (4xx/5xx)" value={num(u.api.errors24h)} tone={u.api.errors24h ? 'warning' : undefined} sub={`${pct(errRate, 2)} error rate`} />
            <Stat label="Median latency" value={ms(u.api.p50)} sub="p50 across endpoints" />
            <Stat label="Rate limit" value={`${num(reseller.limits.ratePerMinute)}/min`} sub={`${num(reseller.limits.dailyOrders)} orders per day`} />
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
