import { useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight, CircleX, Hourglass, Plus, ShieldX, Split, Undo2, Workflow } from 'lucide-react'
import { useApiLogs, useServices, useSimulation, useWebhooks } from '@/hooks/installation'
import { Badge, Button, Card, CardHeader, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { duration, ms, num, pct } from '@/lib/format'
import type { Tone } from '@/types/common'
import { deriveFlow, median, useOrderWindow, type FlowStats } from './ops'
import { MiniFact } from './parts'
import { ProcessingQueue } from './ProcessingQueue'

/* The card is a size container: ≥ 600px it lays the stages out as a horizontal
 * track, narrower it becomes a vertical one.
 * Stage geometry (keep in sync with the Connector offsets): marker centre is
 * 17px from the stage's left edge (px-3 + half of a 10px dot) and 18px from its
 * top (py-2.5 + half of the 16px marker row). */
type StageKey = 'incoming' | 'validation' | 'routing' | 'provider' | 'processing' | 'completed'

interface StageView {
  key: StageKey
  label: string
  value: number
  unit: string
  /** Conversion vs. incoming (0–1), drawn as a hairline bar. */
  share: number
  chip: { count: number; label: string; live: boolean }
  detail: ReactNode
  href: string
  hint: string
}

export function OrderFlow({ className }: { className?: string }) {
  const navigate = useNavigate()
  const reduce = !!useReducedMotion()
  const { orders, loading } = useOrderWindow()
  const sim = useSimulation()
  const services = useServices()
  const webhooks = useWebhooks()
  const edge = useApiLogs({ status: '4xx', pageSize: 1 }, { live: true })
  const running = sim.data?.running !== false

  const f = useMemo(() => deriveFlow(orders), [orders])

  const timing = useMemo(() => {
    const delivery = new Map(services.data?.map((s) => [s.id, s.delivery]) ?? [])
    const instant: number[] = []
    const async: number[] = []
    for (const o of orders) {
      if (o.status !== 'success' || !o.completedAt) continue
      const d = new Date(o.completedAt).getTime() - new Date(o.createdAt).getTime()
      ;(delivery.get(o.serviceId) === 'instant' ? instant : async).push(d)
    }
    return { instant: median(instant), async: median(async) }
  }, [orders, services.data])

  const webhookRate = useMemo(() => {
    const list = webhooks.data ?? []
    const n = list.reduce((a, w) => a + w.deliveries24h, 0)
    return n ? list.reduce((a, w) => a + w.successRate24h * w.deliveries24h, 0) / n : null
  }, [webhooks.data])

  const stages = useMemo(() => buildStages(f), [f])

  return (
    <Card className={cn('@container flex flex-col overflow-hidden', className)}>
      <CardHeader
        title="Order flow"
        description="Rolling 24h · every order from intake to delivered result"
        icon={<Workflow />}
        actions={
          <>
            <Badge tone={running ? 'accent' : 'neutral'} dot pulse={running}>
              {running ? 'Live' : 'Paused'}
            </Badge>
            <Button size="xs" variant="ghost" to="/admin/orders" trailing={<ArrowRight />} className="hidden sm:inline-flex">
              Orders
            </Button>
          </>
        }
      />

      {/* Main track */}
      <div className="px-2 pt-1 pb-3 @min-[600px]:px-3 @min-[600px]:pb-4">
        <ol className="grid grid-cols-1 @min-[600px]:grid-cols-6">
          {stages.map((s, i) => (
            <li key={s.key} className="relative">
              {i < stages.length - 1 && <Connector rate={f.rate[i]!} reduce={reduce} seed={i} />}
              <Stage index={i} stage={s} loading={loading} onOpen={() => navigate(s.href)} />
            </li>
          ))}
        </ol>
        {!loading && f.incoming === 0 && (
          <div className="mx-3 mt-2 flex flex-col items-start gap-2 rounded-lg border border-dashed border-line-strong px-4 py-3 text-[12.5px] text-fg-3 sm:flex-row sm:items-center sm:justify-between">
            No orders in the last 24 hours — the flow fills as IMEI checks, unlocks and server jobs arrive.
            <Button size="xs" variant="secondary" leading={<Plus />} to="/admin/orders?create=1">
              Test order
            </Button>
          </div>
        )}
      </div>

      {/* Side branches: where orders leave or loop back */}
      <div className="flex items-center gap-2 border-t border-line px-5 pt-3 pb-2">
        <span className="mono-label">Exceptions &amp; recovery</span>
        <span className="h-px flex-1 border-t border-dashed border-line-strong" />
        <span className="text-[11px] text-fg-3">24h</span>
      </div>
      <div className="grid grid-cols-2 gap-px border-t border-line bg-line @min-[600px]:grid-cols-5">
        <Branch icon={<ShieldX />} tone="neutral" label="Rejected at API" value={edge.data?.total} loading={edge.isLoading} sub="Auth, rate limit, bad IMEI" onClick={() => navigate('/admin/developer/logs?status=4xx')} />
        <Branch icon={<Hourglass />} tone="warning" label="Held for review" value={f.heldNow} loading={loading} sub="Now · high-value unlock rule" onClick={() => navigate('/admin/orders?status=held&range=24h')} />
        <Branch icon={<Split />} tone="warning" label="Auto-fallbacks" value={f.fallbacks} loading={loading} sub={`${num(f.recovered)} recovered`} onClick={() => navigate('/admin/orders?fallback=1&range=24h')} />
        <Branch
          icon={<CircleX />}
          tone="danger"
          label="Failed"
          value={f.failed}
          loading={loading}
          sub={f.noRoute ? `${num(f.noRoute)} with no eligible supplier` : 'Balance released'}
          onClick={() => navigate('/admin/orders?status=failed&range=24h')}
        />
        <Branch
          icon={<Undo2 />}
          tone="neutral"
          label="Refunded / cancelled"
          value={f.refunded + f.cancelled}
          loading={loading}
          sub={`${num(f.refunded)} refunded · ${num(f.cancelled)} cancelled`}
          onClick={() => navigate('/admin/orders?status=refunded&range=24h')}
          className="col-span-2 @min-[600px]:col-span-1"
        />
      </div>

      {/* Oldest in-flight jobs — grows to fill the hero row */}
      <ProcessingQueue orders={orders} services={services.data} loading={loading} />

      {/* Turnaround facts */}
      <div className="grid grid-cols-2 gap-px border-t border-line bg-line @min-[600px]:grid-cols-4">
        <MiniFact className="bg-surface" label="Instant checks" hint="median time to result" value={timing.instant == null ? '—' : ms(timing.instant)} />
        <MiniFact className="bg-surface" label="Unlocks & server jobs" hint="median turnaround" value={timing.async == null ? '—' : duration(timing.async / 1000)} />
        <MiniFact className="bg-surface" label="Fallback recovery" hint="accepted by the next supplier" value={f.fallbacks ? pct((f.recovered / f.fallbacks) * 100, 0) : '—'} />
        <MiniFact className="bg-surface" label="Webhooks delivered" hint="all endpoints · 24h" value={webhookRate == null ? '—' : pct(webhookRate)} />
      </div>
    </Card>
  )
}

function buildStages(f: FlowStats): StageView[] {
  const share = (v: number) => (f.incoming ? Math.min(1, v / f.incoming) : 0)
  const apiShare = f.incoming ? Math.round((f.channels.api / f.incoming) * 100) : 0
  return [
    {
      key: 'incoming',
      label: 'Incoming',
      value: f.incoming,
      unit: 'orders received',
      share: share(f.incoming),
      chip: { count: f.lastHour, label: '/ h', live: false },
      detail: `${apiShare}% via Reseller API`,
      href: '/admin/orders?range=24h',
      hint: 'Orders received from the Reseller API, the public website and the admin in the last 24 hours.',
    },
    {
      key: 'validation',
      label: 'Validation',
      value: f.validated,
      unit: 'passed input checks',
      share: share(f.validated),
      chip: { count: f.validatingNow, label: 'now', live: true },
      detail: 'IMEI · Luhn · balance',
      href: '/admin/orders?status=in_flight&range=24h',
      hint: 'Field validation (IMEI length and Luhn checksum, network, model) and balance reservation.',
    },
    {
      key: 'routing',
      label: 'Routing',
      value: f.routed,
      unit: 'routed to a supplier',
      share: share(f.routed),
      chip: { count: f.heldNow + f.reroutingNow, label: 'now', live: true },
      detail: `${num(f.heldNow)} held · ${num(f.reroutingNow)} retry`,
      href: '/admin/orders?status=in_flight&range=24h',
      hint: 'Routing rules and strategy pick the supplier chain. Held orders wait for manual review; retries wait for backoff before the next supplier.',
    },
    {
      key: 'provider',
      label: 'Provider',
      value: f.submissions,
      unit: 'supplier submissions',
      share: share(f.routed),
      chip: { count: f.awaitingNow, label: 'now', live: true },
      detail: `${num(f.fallbacks)} with fallback`,
      href: '/admin/orders?status=in_flight&range=24h',
      hint: 'Submissions to supplier APIs, automatic fallbacks included. "Now" = waiting for the supplier to accept.',
    },
    {
      key: 'processing',
      label: 'Processing',
      value: f.accepted,
      unit: 'accepted by supplier',
      share: share(f.accepted),
      chip: { count: f.processingNow, label: 'now', live: true },
      detail: 'Unlock queue · server jobs',
      href: '/admin/orders?status=in_flight&range=24h',
      hint: 'Accepted by the supplier and waiting for the result callback (unlocks, FRP / Mi Account jobs, codes).',
    },
    {
      key: 'completed',
      label: 'Completed',
      value: f.completed,
      unit: 'results delivered',
      share: share(f.completed),
      chip: { count: f.rate[4], label: '/ h', live: false },
      detail: f.successRate == null ? 'No finished orders' : `${pct(f.successRate)} success`,
      href: '/admin/orders?status=success&range=24h',
      hint: 'Result delivered to the client (and webhook sent). Refunded orders count here — they were delivered first.',
    },
  ]
}

function Stage({ stage: s, index, loading, onOpen }: { stage: StageView; index: number; loading: boolean; onOpen: () => void }) {
  const live = s.chip.live && s.chip.count > 0
  const done = s.key === 'completed'
  return (
    <button
      type="button"
      onClick={onOpen}
      title={s.hint}
      aria-label={`${s.label}: ${num(s.value)} ${s.unit}. Open matching orders.`}
      className="group grid w-full grid-cols-[10px_minmax(0,1fr)_auto] items-start gap-x-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-surface-2/70 focus-visible:bg-surface-2/70 @min-[600px]:block @min-[600px]:pb-3"
    >
      <span className="col-start-1 row-start-1 flex h-4 items-center @min-[600px]:mb-2">
        <Marker state={live ? 'live' : done ? 'done' : 'idle'} />
      </span>
      <span className="col-start-2 row-start-1 mono-label flex min-w-0 items-center gap-1.5 truncate">
        <span className="text-fg-3/60 @min-[600px]:hidden @min-[760px]:inline">{String(index + 1).padStart(2, '0')}</span>
        <span className="truncate text-fg-2 transition-colors group-hover:text-fg">{s.label}</span>
      </span>
      <span className="col-start-3 row-start-1 row-span-2 block text-right @min-[600px]:mt-1 @min-[600px]:text-left">
        {loading ? (
          <Skeleton className="ml-auto h-6 w-12 @min-[600px]:ml-0 @min-[600px]:h-7 @min-[600px]:w-14" />
        ) : (
          <motion.span
            key={s.value}
            initial={{ opacity: 0.35, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="block font-display text-[22px] leading-none font-semibold tracking-[-0.03em] text-fg tabular @min-[600px]:text-[26px]"
          >
            {num(s.value)}
          </motion.span>
        )}
      </span>
      <span className="col-start-2 row-start-2 mt-0.5 block truncate text-[11.5px] text-fg-3 @min-[600px]:mt-1.5 @min-[600px]:whitespace-normal">{s.unit}</span>
      <span className="col-start-2 col-end-4 row-start-3 mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 @min-[600px]:mt-2.5">
        <Badge tone={live ? 'accent' : 'neutral'} dot={live} pulse={live} className="h-[18px] px-1.5 text-[10.5px]">
          {num(s.chip.count)} {s.chip.label}
        </Badge>
        <span className="min-w-0 truncate text-[11px] text-fg-3 @min-[600px]:w-full @min-[600px]:whitespace-normal">{s.detail}</span>
      </span>
      <span className="mt-3 hidden h-[3px] overflow-hidden rounded-full bg-fg/[0.06] @min-[600px]:block">
        <motion.span
          className="block h-full rounded-full"
          style={{
            background: done ? 'var(--success)' : 'color-mix(in oklab, var(--fg) 34%, transparent)',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(s.share * 100, s.value ? 2 : 0)}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      </span>
    </button>
  )
}

function Marker({ state }: { state: 'live' | 'idle' | 'done' }) {
  return (
    <span className="relative grid size-2.5 place-items-center">
      {state === 'live' && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-accent/50" />}
      <span className={cn('relative size-2.5 rounded-full', state === 'live' ? 'bg-accent' : state === 'done' ? 'bg-success' : 'border-[1.5px] border-fg-3/70')} />
    </span>
  )
}

/**
 * Connector between two stages. Coral particles travel along it at a pace set
 * by the last hour's throughput through that edge — idle edges stay a static
 * hairline. Horizontal in wide cards, vertical in narrow ones.
 */
function Connector({ rate, reduce, seed }: { rate: number; reduce: boolean; seed: number }) {
  const particles = rate <= 0 ? 0 : rate < 5 ? 1 : rate < 12 ? 2 : 3
  const dur = 2.8
  const dots = reduce ? [] : Array.from({ length: particles }, (_, i) => i)
  const timing = (i: number) => ({
    duration: dur,
    repeat: Infinity,
    ease: 'linear' as const,
    times: [0, 0.12, 0.88, 1],
    delay: (i * dur) / Math.max(1, particles) + seed * 0.37,
  })
  const line = particles ? 'bg-accent/30' : 'bg-line-strong'
  return (
    <>
      {/* horizontal */}
      <span aria-hidden className="pointer-events-none absolute top-[14px] right-[-9px] left-[25px] hidden h-2 overflow-hidden @min-[600px]:block">
        <span className={cn('absolute inset-x-0 top-1/2 h-px -translate-y-1/2', line)} />
        {dots.map((i) => (
          <motion.span key={i} className="absolute inset-0" initial={{ x: '0%', opacity: 0 }} animate={{ x: ['0%', '12%', '88%', '100%'], opacity: [0, 1, 1, 0] }} transition={timing(i)}>
            <span className="absolute top-1/2 left-0 h-px w-4 -translate-x-[calc(100%+5px)] -translate-y-1/2 bg-linear-to-r from-transparent to-accent/70" />
            <span className="absolute top-1/2 left-0 size-[5px] -translate-x-full -translate-y-1/2 rounded-full bg-accent" />
          </motion.span>
        ))}
      </span>
      {/* vertical */}
      <span aria-hidden className="pointer-events-none absolute top-[26px] bottom-[-10px] left-[13px] w-2 overflow-hidden @min-[600px]:hidden">
        <span className={cn('absolute inset-y-0 left-1/2 w-px -translate-x-1/2', line)} />
        {dots.map((i) => (
          <motion.span key={i} className="absolute inset-0" initial={{ y: '0%', opacity: 0 }} animate={{ y: ['0%', '12%', '88%', '100%'], opacity: [0, 1, 1, 0] }} transition={timing(i)}>
            <span className="absolute top-0 left-1/2 h-4 w-px -translate-x-1/2 -translate-y-[calc(100%+5px)] bg-linear-to-b from-transparent to-accent/70" />
            <span className="absolute top-0 left-1/2 size-[5px] -translate-x-1/2 -translate-y-full rounded-full bg-accent" />
          </motion.span>
        ))}
      </span>
    </>
  )
}

const branchTone: Record<Tone, string> = {
  neutral: 'text-fg-3',
  accent: 'text-accent-ink',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
}

function Branch({ icon, tone, label, value, sub, loading, onClick, className }: { icon: ReactNode; tone: Tone; label: string; value: number | undefined; sub: ReactNode; loading?: boolean; onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn('group flex min-w-0 flex-col bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-2 @min-[600px]:px-3.5', className)}>
      <span className="flex items-center gap-2">
        <span className={cn('shrink-0 [&_svg]:size-3.5', branchTone[tone])}>{icon}</span>
        {loading ? <Skeleton className="h-5 w-10" /> : <span className="font-display text-[18px] leading-none font-semibold tracking-[-0.02em] text-fg tabular">{num(value ?? 0)}</span>}
      </span>
      <span className="mt-1.5 text-[11.5px] leading-snug font-medium text-fg-2 transition-colors group-hover:text-fg">{label}</span>
      <span className="mt-0.5 text-[11px] leading-snug text-fg-3">{sub}</span>
    </button>
  )
}
