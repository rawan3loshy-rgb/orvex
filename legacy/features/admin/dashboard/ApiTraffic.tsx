import { useMemo } from 'react'
import { Link } from 'react-router'
import { Activity, ArrowRight } from 'lucide-react'
import { useApiLogStats, useHealth } from '@/hooks/installation'
import { Card, CardHeader, Skeleton } from '@/components/ui'
import { BarList, TimeChart } from '@/components/charts'
import { cn } from '@/lib/cn'
import { useMeasure } from '@/lib/useMeasure'
import { ms, num, pct, time } from '@/lib/format'

const BUCKET = 3 // 3 × 5 min → 15-minute points

/** Reseller API traffic: request rate (24h), latency percentiles, error rate and top endpoints. */
export function ApiTraffic({ className }: { className?: string }) {
  const health = useHealth()
  const stats = useApiLogStats()
  const h = health.data
  const s = stats.data
  const [chartRef, { height: chartH }] = useMeasure<HTMLDivElement>()

  const series = useMemo(() => {
    const pts = h?.series.throughput ?? []
    const out: { t: string; rpm: number }[] = []
    for (let i = 0; i < pts.length; i += BUCKET) {
      const chunk = pts.slice(i, i + BUCKET)
      out.push({
        t: chunk[0]!.t,
        rpm: Math.round(chunk.reduce((a, p) => a + p.v, 0) / chunk.length),
      })
    }
    return out
  }, [h])
  // 288 five-minute samples of req/min → requests over the last 24h.
  const requests24h = useMemo(() => Math.round((h?.series.throughput ?? []).reduce((a, p) => a + p.v * 5, 0)), [h])
  const peak = useMemo(() => series.reduce((m, p) => (p.rpm > m.rpm ? p : m), series[0] ?? { t: '', rpm: 0 }), [series])

  const endpointTotal = s?.endpoints.reduce((a, e) => a + e.count, 0) ?? 0
  const endpoints = (s?.endpoints ?? []).slice(0, 4).map((e) => {
    const [method, ...path] = e.endpoint.split(' ')
    return {
      key: e.endpoint,
      label: (
        <span className="font-mono text-[11.5px]">
          <span className="text-fg-3">{method}</span> {path.join(' ').replace('/api/v1', '')}
        </span>
      ),
      value: endpointTotal ? (e.count / endpointTotal) * 100 : 0,
    }
  })

  return (
    <Card className={cn('@container flex flex-col overflow-hidden', className)}>
      <CardHeader
        title="API traffic"
        description="Reseller API v1 · last 24h"
        icon={<Activity />}
        actions={
          <Link to="/admin/developer/logs" className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg">
            Logs <ArrowRight className="size-3.5" />
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-px border-y border-line bg-line @min-[460px]:grid-cols-4">
        <Stat label="Now" value={h ? num(h.metrics.throughputRpm) : null} unit="req/min" />
        <Stat label="Requests 24h" value={h ? num(requests24h, { compact: true }) : null} />
        <Stat label={s ? `p50 latency · p95 ${ms(s.p95)}` : 'p50 latency'} value={s ? ms(s.p50) : null} />
        <Stat label="Rejected (4xx/5xx)" value={s ? pct(s.errorRate, 1) : null} tone={s && s.errorRate > 10 ? 'warning' : undefined} />
      </div>
      {/* The chart grows with the row height (no hollow gap when neighbours are taller). */}
      <div ref={chartRef} className="relative min-h-[144px] flex-1">
        <div className="absolute inset-0 px-3 pt-3">
          {!h ? (
            <Skeleton className="mx-2 h-full w-auto rounded-lg" />
          ) : (
            <TimeChart
              data={series}
              x={(d) => d.t}
              kind="area"
              height={Math.max(132, chartH - 12)}
              yTicks={3}
              xLabelCount={5}
              xFormat={(l) => time(l)}
              tooltipTitle={(d) => `${time(d.t)} – ${time(new Date(new Date(d.t).getTime() + BUCKET * 5 * 60_000))}`}
              tooltipFormat={(v) => `${Math.round(v)} req/min`}
              series={[{ key: 'rpm', label: 'Requests / min', color: 'var(--c2)' }]}
            />
          )}
        </div>
      </div>
      <div className="flex items-center justify-between px-5 pt-1 pb-2 text-[11.5px] text-fg-3">
        <span>Requests / min, 15-min average</span>
        {peak.t && (
          <span className="tabular">
            Peak {num(peak.rpm)} at {time(peak.t)}
          </span>
        )}
      </div>
      <div className="border-t border-line px-3 pt-3 pb-3">
        <div className="mono-label px-2.5 pb-1.5">Top endpoints · share of calls</div>
        {stats.isLoading ? (
          <div className="space-y-2 px-2.5">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-6" />
            ))}
          </div>
        ) : endpoints.length ? (
          <BarList items={endpoints} format={(v) => pct(v, 0)} color="var(--c2)" />
        ) : (
          <p className="px-2.5 py-2 text-[12.5px] text-fg-3">No API calls logged in the last 24 hours.</p>
        )}
      </div>
    </Card>
  )
}

function Stat({ label, value, unit, tone }: { label: string; value: string | null; unit?: string; tone?: 'warning' }) {
  return (
    <div className="min-w-0 bg-surface px-4 py-3">
      {value == null ? (
        <Skeleton className="h-5 w-14" />
      ) : (
        <div className="flex items-baseline gap-1 whitespace-nowrap">
          <span className={cn('truncate font-display text-[17px] leading-tight font-semibold tracking-[-0.02em] tabular', tone === 'warning' ? 'text-warning' : 'text-fg')}>{value}</span>
          {unit && <span className="text-[11px] text-fg-3">{unit}</span>}
        </div>
      )}
      <div className="mt-0.5 truncate text-[11px] text-fg-3">{label}</div>
    </div>
  )
}
