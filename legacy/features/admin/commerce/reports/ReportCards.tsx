import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { ArrowUpRight, Award, Clock, Crown, Gauge, Percent, ShieldCheck } from 'lucide-react'
import { ProviderMark, ServiceIcon, providerColor } from '@/components/brand'
import { BarList, ChartLegend, Donut, Heatmap, TimeChart } from '@/components/charts'
import { Button, Card, CardBody, CardHeader, Skeleton, Tooltip } from '@/components/ui'
import { cn } from '@/lib/cn'
import { date, dateShort, money, num, pct } from '@/lib/format'
import type { ReportSummary, Service } from '@/types/installation'

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const CHANNEL: Record<string, { label: string; color: string }> = {
  api: { label: 'Reseller API', color: 'var(--c1)' },
  website: { label: 'Website', color: 'var(--c2)' },
  admin: { label: 'Admin', color: 'var(--c6)' },
}

export const axisMoney = (v: number) => (Math.abs(v) >= 1000 ? `$${num(v / 1000, { decimals: Math.abs(v) >= 10_000 ? 0 : 1 })}k` : `$${num(Math.round(v))}`)
const weekdayShort = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short' })

function ChartSkeleton({ height }: { height: number }) {
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {Array.from({ length: 18 }, (_, i) => (
        <Skeleton key={i} className="w-full rounded-sm" />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
export function RevenueCard({ report, loading }: { report?: ReportSummary; loading: boolean }) {
  const data = useMemo(() => (report?.daily ?? []).map((d) => ({ t: d.t, revenue: d.revenue, cost: d.cost, margin: +(d.revenue - d.cost).toFixed(2) })), [report])
  const is7 = report?.range === '7d'
  return (
    <Card className="lg:col-span-2">
      <CardHeader title="Revenue, cost & margin" description="Completed IMEI checks, unlocks and codes, daily · USD" />
      <CardBody>
        {loading || !report ? (
          <ChartSkeleton height={260} />
        ) : (
          <>
            <ChartLegend
              className="mb-4"
              items={[
                { label: 'Revenue', color: 'var(--c1)', value: money(report.revenue, { compact: true }) },
                { label: 'Gross margin', color: 'var(--c2)', value: money(report.margin, { compact: true }) },
                { label: 'Supplier cost', color: 'var(--c6)', value: money(report.cost, { compact: true }) },
              ]}
            />
            <TimeChart
              data={data}
              x={(d) => d.t}
              height={260}
              series={[
                { key: 'revenue', label: 'Revenue', color: 'var(--c1)', type: 'area' },
                { key: 'margin', label: 'Gross margin', color: 'var(--c2)', type: 'area' },
                { key: 'cost', label: 'Supplier cost', color: 'var(--c6)', type: 'line', dashed: true },
              ]}
              yFormat={axisMoney}
              xFormat={(l) => (is7 ? weekdayShort(l) : dateShort(l))}
              xLabelCount={is7 ? 7 : 6}
              tooltipTitle={(d) => date(d.t)}
              tooltipFormat={(v) => money(v)}
              tooltipExtra={(d) => (
                <div className="flex items-center justify-between gap-4 text-[11.5px] text-fg-3">
                  <span>Margin rate</span>
                  <span className="font-medium text-fg tabular">{d.revenue ? pct((d.margin / d.revenue) * 100) : '—'}</span>
                </div>
              )}
            />
          </>
        )}
      </CardBody>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
export function StatusCard({ report, loading }: { report?: ReportSummary; loading: boolean }) {
  const is7 = report?.range === '7d'
  const totals = useMemo(() => {
    const t = { success: 0, failed: 0, other: 0 }
    for (const d of report?.daily ?? []) {
      t.success += d.success
      t.failed += d.failed
      t.other += d.other
    }
    return t
  }, [report])
  return (
    <Card>
      <CardHeader title="Orders by status" description="Daily volume · stacked" />
      <CardBody>
        {loading || !report ? (
          <ChartSkeleton height={260} />
        ) : (
          <>
            <ChartLegend
              className="mb-4"
              items={[
                { label: 'Success', color: 'var(--c2)', value: num(totals.success) },
                { label: 'Failed', color: 'var(--danger)', value: num(totals.failed) },
                { label: 'Other', color: 'var(--c6)', value: num(totals.other) },
              ]}
            />
            <TimeChart
              data={report.daily}
              x={(d) => d.t}
              kind="bar"
              stacked
              height={260}
              series={[
                { key: 'success', label: 'Success', color: 'var(--c2)' },
                { key: 'failed', label: 'Failed', color: 'var(--danger)' },
                { key: 'other', label: 'Refunded, cancelled & in progress', color: 'var(--c6)' },
              ]}
              xFormat={(l) => (is7 ? weekdayShort(l) : dateShort(l))}
              xLabelCount={is7 ? 7 : 5}
              tooltipTitle={(d) => date(d.t)}
              tooltipFormat={(v) => num(v)}
              tooltipExtra={(d) => {
                const done = d.success + d.failed
                return (
                  <div className="flex items-center justify-between gap-4 text-[11.5px] text-fg-3">
                    <span>Success rate</span>
                    <span className="font-medium text-fg tabular">{done ? pct((d.success / done) * 100) : '—'}</span>
                  </div>
                )
              }}
            />
          </>
        )}
      </CardBody>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
export function ServiceBreakdown({ report, services, loading }: { report?: ReportSummary; services?: Service[]; loading: boolean }) {
  const [all, setAll] = useState(false)
  const rows = report?.byService ?? []
  const maxRevenue = Math.max(1, ...rows.map((r) => r.revenue))
  const shown = all ? rows : rows.slice(0, 8)
  return (
    <Card className="overflow-hidden lg:col-span-2">
      <CardHeader title="By service" description="Revenue and margin per catalog service — checks, unlocks, server services and codes" actions={rows.length > 8 && <Button variant="ghost" size="sm" onClick={() => setAll((v) => !v)}>{all ? 'Top 8' : `All ${rows.length}`}</Button>} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-[11.5px] text-fg-3">
              <th className="border-y border-line py-2 pr-4 pl-5 text-left font-medium">Service</th>
              <th className="border-y border-line px-4 py-2 text-right font-medium">Orders</th>
              <th className="w-[34%] border-y border-line px-4 py-2 text-left font-medium">Revenue</th>
              <th className="border-y border-line px-4 py-2 text-right font-medium">Margin</th>
              <th className="border-y border-line py-2 pr-5 pl-4 text-right font-medium">Margin %</th>
            </tr>
          </thead>
          <tbody>
            {loading || !report
              ? Array.from({ length: 6 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className="border-b border-line px-5 py-3">
                      <Skeleton className="h-4" />
                    </td>
                  </tr>
                ))
              : shown.map((r, i) => {
                  const s = services?.find((x) => x.id === r.serviceId)
                  const mp = r.revenue ? (r.margin / r.revenue) * 100 : 0
                  return (
                    <tr key={r.serviceId} className="group transition-colors hover:bg-surface-2/60">
                      <td className="border-b border-line py-2.5 pr-4 pl-5 group-last:border-0">
                        <Link to={`/admin/services/${r.serviceId}`} className="flex min-w-0 items-center gap-2.5">
                          <ServiceIcon icon={s?.icon ?? 'box'} category={s?.category} size="sm" />
                          <span className="truncate font-medium text-fg group-hover:underline">{r.name}</span>
                        </Link>
                      </td>
                      <td className="border-b border-line px-4 py-2.5 text-right text-fg-2 tabular group-last:border-0">{num(r.orders)}</td>
                      <td className="border-b border-line px-4 py-2.5 group-last:border-0">
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg/[0.06]">
                            <motion.div className="h-full rounded-full bg-[var(--c1)]" initial={{ width: 0 }} animate={{ width: `${(r.revenue / maxRevenue) * 100}%` }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: i * 0.025 }} />
                          </div>
                          <span className="w-[76px] shrink-0 text-right font-medium text-fg tabular">{money(r.revenue)}</span>
                        </div>
                      </td>
                      <td className="border-b border-line px-4 py-2.5 text-right text-fg-2 tabular group-last:border-0">{money(r.margin)}</td>
                      <td className="border-b border-line py-2.5 pr-5 pl-4 text-right tabular group-last:border-0">
                        <span className={cn('rounded-md px-1.5 py-0.5 text-[12px] font-medium', mp >= 45 ? 'bg-success/10 text-success' : mp >= 30 ? 'bg-fg/[0.06] text-fg-2' : 'bg-warning/12 text-warning')}>{pct(mp)}</span>
                      </td>
                    </tr>
                  )
                })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
export function ResellerBreakdown({ report, loading }: { report?: ReportSummary; loading: boolean }) {
  const items = (report?.byReseller ?? []).slice(0, 9)
  return (
    <Card>
      <CardHeader title="By reseller" description="GSM shops and distributors · revenue from completed orders" actions={<Button variant="ghost" size="sm" to="/admin/resellers" trailing={<ArrowUpRight />}>Resellers</Button>} />
      <CardBody>
        {loading || !report ? (
          <div className="space-y-2">
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} className="h-7" />
            ))}
          </div>
        ) : (
          <BarList
            format={(v) => money(v)}
            items={items.map((r) => ({
              key: r.resellerId ?? 'direct',
              label: r.resellerId ? (
                <Link to={`/admin/resellers/${r.resellerId}`} className="hover:underline">
                  {r.name}
                </Link>
              ) : (
                <span className="text-fg-2">{r.name}</span>
              ),
              value: r.revenue,
              sub: `${num(r.orders)}`,
              color: r.resellerId ? 'var(--c1)' : 'var(--c6)',
            }))}
          />
        )}
      </CardBody>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
export function ProviderBreakdown({ report, loading }: { report?: ReportSummary; loading: boolean }) {
  const rows = report?.byProvider ?? []
  return (
    <Card>
      <CardHeader title="By supplier" description="Accepted orders, supplier cost and attempt success" />
      <CardBody className="space-y-1">
        {loading || !report
          ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="my-2 h-9" />)
          : rows.map((p) => {
              const tone = p.successRate >= 97 ? 'var(--success)' : p.successRate >= 90 ? 'var(--warning)' : 'var(--danger)'
              return (
                <Link key={p.providerId} to={`/admin/providers/${p.providerId}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2">
                  <ProviderMark id={p.providerId} name={p.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-medium text-fg">{p.name}</span>
                      <span className="shrink-0 text-[12.5px] font-medium text-fg tabular">{money(p.cost, { compact: true })}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2.5">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-fg/[0.07]">
                        <motion.div className="h-full rounded-full" style={{ background: tone }} initial={{ width: 0 }} animate={{ width: `${p.successRate}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
                      </div>
                      <Tooltip content="Share of supplier attempts that were accepted">
                        <span className="w-[46px] shrink-0 text-right font-mono text-[11px] tabular" style={{ color: tone }}>
                          {pct(p.successRate)}
                        </span>
                      </Tooltip>
                      <span className="w-[64px] shrink-0 text-right text-[11.5px] text-fg-3 tabular">{num(p.orders)} orders</span>
                    </div>
                  </div>
                </Link>
              )
            })}
      </CardBody>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
export function ChannelSplit({ report, loading }: { report?: ReportSummary; loading: boolean }) {
  const rows = (report?.byChannel ?? []).slice().sort((a, b) => b.orders - a.orders)
  const total = rows.reduce((a, r) => a + r.orders, 0)
  return (
    <Card>
      <CardHeader title="Channel split" description="Where orders come from" />
      <CardBody>
        {loading || !report ? (
          <div className="flex items-center gap-6">
            <Skeleton className="size-[132px] rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4" />
              <Skeleton className="h-4" />
              <Skeleton className="h-4" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col 2xl:flex-row">
            <Donut
              size={140}
              thickness={16}
              segments={rows.map((r) => ({ key: r.channel, label: CHANNEL[r.channel]?.label ?? r.channel, value: r.orders, color: CHANNEL[r.channel]?.color ?? 'var(--c6)' }))}
              center={
                <div>
                  <div className="font-display text-xl font-semibold tabular">{num(total, { compact: true })}</div>
                  <div className="text-[11px] text-fg-3">orders</div>
                </div>
              }
            />
            <ul className="w-full min-w-0 flex-1 space-y-2.5">
              {rows.map((r) => (
                <li key={r.channel} className="flex items-center gap-2.5 text-[12.5px]">
                  <span className="size-2 shrink-0 rounded-[3px]" style={{ background: CHANNEL[r.channel]?.color }} />
                  <span className="flex-1 truncate text-fg-2">{CHANNEL[r.channel]?.label ?? r.channel}</span>
                  <span className="font-medium text-fg tabular">{total ? pct((r.orders / total) * 100, 0) : '—'}</span>
                  <span className="w-[64px] text-right text-fg-3 tabular">{money(r.revenue, { compact: true })}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
function Highlight({ icon, label, value, sub, color }: { icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode; color?: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 [&_svg]:size-3.5" style={{ color: color ?? 'var(--fg-2)' }}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11.5px] text-fg-3">{label}</div>
        <div className="truncate text-[13px] font-medium text-fg">{value}</div>
      </div>
      {sub && <div className="shrink-0 pt-3.5 text-right text-[12px] text-fg-2 tabular">{sub}</div>}
    </div>
  )
}

export function Highlights({ report, loading }: { report?: ReportSummary; loading: boolean }) {
  const h = useMemo(() => {
    if (!report) return null
    const topService = report.byService[0]
    const bestMargin = report.byService.filter((s) => s.orders >= 10 && s.revenue > 0).sort((a, b) => b.margin / b.revenue - a.margin / a.revenue)[0]
    const topReseller = report.byReseller.find((r) => r.resellerId)
    const reliable = report.byProvider.filter((p) => p.orders >= 10).sort((a, b) => b.successRate - a.successRate)[0]
    let peak = { d: 0, h: 0, v: -1 }
    report.heatmap.forEach((row, d) => row.forEach((v, hr) => v > peak.v && (peak = { d, h: hr, v })))
    return { topService, bestMargin, topReseller, reliable, peak }
  }, [report])
  return (
    <Card>
      <CardHeader title="Highlights" description="Derived from this period" />
      <CardBody className="divide-y divide-line py-0 pb-3">
        {loading || !h ? (
          Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="my-3 h-8" />)
        ) : (
          <>
            {h.topService && <Highlight icon={<Crown />} color="var(--accent-ink)" label="Top service by revenue" value={h.topService.name} sub={money(h.topService.revenue, { compact: true })} />}
            {h.bestMargin && <Highlight icon={<Percent />} color="var(--fg-2)" label="Best margin rate" value={h.bestMargin.name} sub={pct((h.bestMargin.margin / h.bestMargin.revenue) * 100)} />}
            {h.topReseller && <Highlight icon={<Award />} color="var(--fg-2)" label="Top reseller" value={h.topReseller.name} sub={money(h.topReseller.revenue, { compact: true })} />}
            {h.reliable && <Highlight icon={<ShieldCheck />} color={providerColor(h.reliable.providerId)} label="Most reliable supplier" value={h.reliable.name} sub={pct(h.reliable.successRate)} />}
            <Highlight icon={<Clock />} color="var(--fg-2)" label="Busiest hour" value={`${DAYS[h.peak.d]} · ${String(h.peak.h).padStart(2, '0')}:00–${String((h.peak.h + 1) % 24).padStart(2, '0')}:00`} sub={`${num(h.peak.v)} orders`} />
          </>
        )}
      </CardBody>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
export function HeatmapCard({ report, loading }: { report?: ReportSummary; loading: boolean }) {
  const stats = useMemo(() => {
    if (!report) return null
    const byDay = report.heatmap.map((row) => row.reduce((a, v) => a + v, 0))
    const byHour = Array.from({ length: 24 }, (_, h) => report.heatmap.reduce((a, row) => a + (row[h] ?? 0), 0))
    const busiestDay = byDay.indexOf(Math.max(...byDay))
    const quietHour = byHour.indexOf(Math.min(...byHour))
    const business = byHour.slice(8, 18).reduce((a, v) => a + v, 0)
    const total = byHour.reduce((a, v) => a + v, 0)
    return { busiestDay, quietHour, businessShare: total ? (business / total) * 100 : 0 }
  }, [report])
  return (
    <Card className="lg:col-span-3">
      <CardHeader
        icon={<Gauge />}
        title="Order activity by weekday & hour"
        description="Local installation time · darker cells mean more orders"
        actions={
          stats && (
            <div className="hidden items-center gap-4 text-[12px] text-fg-3 md:flex">
              <span>
                Busiest day <span className="font-medium text-fg">{DAYS[stats.busiestDay]}</span>
              </span>
              <span>
                Quietest hour <span className="font-medium text-fg tabular">{String(stats.quietHour).padStart(2, '0')}:00</span>
              </span>
              <span>
                08–18h share <span className="font-medium text-fg tabular">{pct(stats.businessShare, 0)}</span>
              </span>
            </div>
          )
        }
      />
      <CardBody>
        {loading || !report ? (
          <Skeleton className="h-[220px] rounded-lg" />
        ) : (
          <div className="overflow-x-auto">
            <Heatmap grid={report.heatmap} rowLabels={DAYS} className="min-w-[620px]" />
          </div>
        )}
        <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-fg-3">
          Less
          {[12, 34, 56, 78, 100].map((s) => (
            <span key={s} className="size-2.5 rounded-[3px]" style={{ background: `color-mix(in oklab, var(--accent) ${s}%, var(--surface-2))` }} />
          ))}
          More
        </div>
      </CardBody>
    </Card>
  )
}
