import { useMemo, useState } from 'react'
import { Card, CardHeader, Segmented, SectionTitle, Skeleton } from '@/components/ui'
import { TimeChart } from '@/components/charts'
import { dateShort, ms, num, time } from '@/lib/format'
import type { TimePoint } from '@/types/common'
import type { HealthSnapshot } from '@/types/installation'

type Range = '1h' | '6h' | '24h'
const POINTS: Record<Range, number> = { '1h': 12, '6h': 72, '24h': 288 }

interface ChartDef {
  key: keyof HealthSnapshot['series']
  title: string
  description: string
  color: string
  kind: 'area' | 'line'
  unit: string
  yFormat: (v: number) => string
  tip: (v: number) => string
  current: (s: HealthSnapshot) => string
  label: string
}

const CHARTS: ChartDef[] = [
  {
    key: 'latency',
    title: 'API latency',
    description: 'p50 response time · Reseller API (orders, IMEI checks) and admin API',
    color: 'var(--c1)',
    kind: 'line',
    unit: 'ms',
    label: 'p50',
    yFormat: (v) => `${Math.round(v)}ms`,
    tip: (v) => `${Math.round(v)} ms`,
    current: (s) => ms(s.metrics.apiLatencyP50),
  },
  {
    key: 'throughput',
    title: 'Throughput',
    description: 'Requests per minute from resellers, website checkout and admin',
    color: 'var(--c2)',
    kind: 'area',
    unit: 'req/min',
    label: 'Requests',
    yFormat: (v) => num(Math.round(v), { compact: true }),
    tip: (v) => `${num(Math.round(v))} req/min`,
    current: (s) => num(s.metrics.throughputRpm),
  },
  {
    key: 'errors',
    title: 'Error rate',
    description: 'Share of requests answered with 5xx — supplier errors are retried, not counted',
    color: 'var(--c5)',
    kind: 'area',
    unit: '%',
    label: 'Errors',
    yFormat: (v) => `${v.toFixed(1)}%`,
    tip: (v) => `${v.toFixed(2)}%`,
    current: (s) => `${s.metrics.errorRate.toFixed(2)}%`,
  },
  {
    key: 'queue',
    title: 'Queue depth',
    description: 'Unlock, code and server jobs waiting for supplier callbacks',
    color: 'var(--c3)',
    kind: 'area',
    unit: 'jobs',
    label: 'Depth',
    yFormat: (v) => String(Math.round(v)),
    tip: (v) => `${Math.round(v)} jobs`,
    current: (s) => num(s.metrics.queueDepth),
  },
]

export function PerformanceCharts({ data }: { data: HealthSnapshot | undefined }) {
  const [range, setRange] = useState<Range>('24h')
  return (
    <section>
      <SectionTitle
        title="Performance"
        description="5-minute resolution, collected by ORVEX Core on this server. Nothing leaves your installation."
        actions={
          <Segmented
            size="xs"
            value={range}
            onChange={setRange}
            items={[
              { value: '1h', label: '1h' },
              { value: '6h', label: '6h' },
              { value: '24h', label: '24h' },
            ]}
          />
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {CHARTS.map((c) => (
          <ChartCard key={c.key} def={c} data={data} range={range} />
        ))}
      </div>
    </section>
  )
}

function ChartCard({ def, data, range }: { def: ChartDef; data: HealthSnapshot | undefined; range: Range }) {
  const points = useMemo<TimePoint[]>(() => (data ? data.series[def.key].slice(-POINTS[range]) : []), [data, def.key, range])
  const stats = useMemo(() => {
    if (!points.length) return null
    const vals = points.map((p) => p.v)
    return { avg: vals.reduce((a, b) => a + b, 0) / vals.length, max: Math.max(...vals) }
  }, [points])

  return (
    <Card>
      <CardHeader
        title={def.title}
        description={def.description}
        actions={
          data ? (
            <div className="text-right">
              <div className="font-display text-[20px] leading-none font-semibold tracking-[-0.02em] text-fg tabular">
                {def.current(data)}
                {def.unit !== '%' && def.unit !== 'ms' && <span className="ml-1 font-sans text-[12px] font-normal tracking-normal text-fg-3">{def.unit}</span>}
              </div>
              {stats && <div className="mt-1 text-[11.5px] text-fg-3 tabular">avg {def.yFormat(stats.avg)} · peak {def.yFormat(stats.max)}</div>}
            </div>
          ) : (
            <Skeleton className="h-6 w-16" />
          )
        }
      />
      <div className="px-3 pb-3">
        {data ? (
          <TimeChart
            data={points}
            x={(d) => d.t}
            series={[{ key: 'v', label: def.label, color: def.color, type: def.kind }]}
            kind={def.kind}
            height={190}
            yFormat={def.yFormat}
            xFormat={(l) => time(l)}
            tooltipTitle={(d) => `${dateShort(d.t)} · ${time(d.t)}`}
            tooltipFormat={(v) => def.tip(v)}
            xLabelCount={range === '1h' ? 6 : 7}
            curve={def.key === 'errors' ? 'linear' : 'smooth'}
          />
        ) : (
          <Skeleton className="h-[190px] w-full rounded-lg" />
        )}
      </div>
    </Card>
  )
}
