import { useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useHealth, useProviders, useSimulation } from '@/hooks/installation'
import { Card, Dot, Skeleton } from '@/components/ui'
import { Sparkline } from '@/components/charts'
import { cn } from '@/lib/cn'
import { dateShort, ms, num, pct } from '@/lib/format'
import { deriveFlow, deriveTotals, useOrderWindow, usePreviousWindow } from './ops'
import { useNow } from './parts'

/** Top-of-page operational status: live state, queue, success, API, uptime, suppliers. */
export function OpsStrip() {
  const sim = useSimulation()
  const health = useHealth()
  const prev = usePreviousWindow()
  const providers = useProviders()
  const { orders, loading, updatedAt } = useOrderWindow()
  const flow = useMemo(() => deriveFlow(orders), [orders])
  const h = health.data
  const prevRate = useMemo(() => (prev.complete ? deriveTotals(prev.orders).successRate : null), [prev])
  const running = sim.data?.running !== false

  const queueSpark = useMemo(() => {
    const pts = h?.series.queue.slice(-36).map((p) => p.v) ?? []
    if (pts.length && !loading) pts[pts.length - 1] = flow.inFlight
    return pts
  }, [h, flow.inFlight, loading])
  const apiSpark = useMemo(() => h?.series.throughput.slice(-36).map((p) => p.v) ?? [], [h])

  const list = providers.data ?? []
  const impaired = list.filter((p) => p.status === 'degraded' || p.status === 'outage')
  const operational = list.filter((p) => p.status === 'operational').length
  const openIncidents = h?.incidents.filter((i) => i.status !== 'resolved').length ?? 0

  return (
    <Card className="overflow-hidden">
      <div className="-mr-px -mb-px grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        <LiveCell running={running} updatedAt={updatedAt} className="col-span-2 sm:col-span-1" />
        <Cell
          label="Processing queue"
          value={num(flow.inFlight)}
          loading={loading}
          spark={queueSpark}
          sparkColor="var(--accent)"
          sub={`${num(flow.processingNow + flow.awaitingNow)} at suppliers · ${num(flow.heldNow + flow.reroutingNow + flow.validatingNow)} queued`}
          to="/admin/orders?status=in_flight"
        />
        <Cell
          label="Success rate · 24h"
          value={flow.successRate == null ? '—' : pct(flow.successRate)}
          loading={loading}
          sub={`${num(flow.failed)} failed${prevRate != null ? ` · prev 24h ${pct(prevRate)}` : ' · balance released'}`}
          dot={flow.successRate != null && flow.successRate < 95 ? 'warning' : undefined}
          to="/admin/orders?status=failed&range=24h"
        />
        <Cell
          label="API traffic"
          value={h ? num(h.metrics.throughputRpm) : '—'}
          unit="req/min"
          loading={!h}
          spark={apiSpark}
          sparkColor="var(--c2)"
          sub={h ? `p50 ${ms(h.metrics.apiLatencyP50)} · ${pct(h.metrics.errorRate, 2)} 5xx` : null}
          to="/admin/developer/logs"
        />
        <Cell
          label="Uptime · 30d"
          value={h ? `${h.uptime.percent30d.toFixed(3)}%` : '—'}
          loading={!h}
          sub={h ? `since ${dateShort(h.uptime.since)} · ${openIncidents ? `${openIncidents} open incident${openIncidents === 1 ? '' : 's'}` : 'no open incidents'}` : null}
          dot={openIncidents ? 'warning' : undefined}
          to="/admin/system/health"
        />
        <Cell
          label="Suppliers"
          value={providers.data ? `${operational}/${list.length}` : '—'}
          unit="operational"
          loading={providers.isLoading}
          sub={impaired.length ? `${impaired.map((p) => p.shortName).join(', ')} ${impaired.length === 1 ? 'degraded' : 'impaired'}` : 'All suppliers healthy'}
          dot={impaired.length ? 'warning' : 'success'}
          to="/admin/providers"
          className="col-span-2 sm:col-span-1"
        />
      </div>
    </Card>
  )
}

function LiveCell({ running, updatedAt, className }: { running: boolean; updatedAt: number; className?: string }) {
  const now = useNow(1000)
  const navigate = useNavigate()
  const secs = updatedAt ? Math.max(0, Math.round((now - updatedAt) / 1000)) : null
  return (
    <button
      type="button"
      onClick={() => navigate('/admin/orders')}
      className={cn(
        'group flex min-w-0 flex-col justify-between gap-2 border-r border-b border-line bg-accent/[0.035] px-4 py-3.5 text-left transition-colors hover:bg-accent/[0.06]',
        !running && 'bg-transparent hover:bg-surface-2/60',
        className,
      )}
    >
      <span className="mono-label">Order engine</span>
      <span className="flex items-center gap-2.5">
        <Dot tone={running ? 'accent' : 'neutral'} pulse={running} className="size-2" />
        <span className="font-display text-[22px] leading-none font-semibold tracking-[-0.025em] text-fg">{running ? 'Live' : 'Paused'}</span>
      </span>
      <span className="truncate text-[11.5px] text-fg-3 tabular">{running ? (secs == null ? 'Connecting…' : `Updated ${secs}s ago · refresh 5s`) : 'Resume the stream from the top bar'}</span>
    </button>
  )
}

function Cell({
  label,
  value,
  unit,
  sub,
  spark,
  sparkColor,
  dot,
  to,
  loading,
  className,
}: {
  label: string
  value: ReactNode
  unit?: string
  sub?: ReactNode
  spark?: number[]
  sparkColor?: string
  dot?: 'success' | 'warning' | 'danger'
  to: string
  loading?: boolean
  className?: string
}) {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate(to)} className={cn('group flex min-w-0 flex-col justify-between gap-2 border-r border-b border-line px-4 py-3.5 text-left transition-colors hover:bg-surface-2/60', className)}>
      <span className="mono-label truncate transition-colors group-hover:text-fg-2">{label}</span>
      <span className="flex min-w-0 items-end justify-between gap-3">
        {loading ? (
          <Skeleton className="h-[22px] w-16" />
        ) : (
          <span className="flex min-w-0 items-baseline gap-1.5 whitespace-nowrap">
            <span className="font-display text-[22px] leading-none font-semibold tracking-[-0.025em] text-fg tabular">{value}</span>
            {unit && <span className="truncate text-[11.5px] text-fg-3">{unit}</span>}
          </span>
        )}
        {spark && spark.length > 1 && !loading && <Sparkline values={spark} color={sparkColor} height={22} fill={false} className="hidden w-14 shrink-0 opacity-90 min-[420px]:block" />}
      </span>
      <span className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-fg-3">
        {dot && <Dot tone={dot} />}
        <span className="truncate">{sub ?? ' '}</span>
      </span>
    </button>
  )
}
