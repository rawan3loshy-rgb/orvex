import { Fragment, type CSSProperties, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { ChevronDown, ChevronRight, CircleSlash, LoaderCircle, Route, ShieldAlert } from 'lucide-react'
import { LogoMark, ProviderMark } from '@/components/brand'
import { Button, Card, CardHeader, Tooltip } from '@/components/ui'
import { cn } from '@/lib/cn'
import { money, titleCase } from '@/lib/format'
import type { OrderAttempt, OrderDetail, Provider, Service, ServiceMapping } from '@/types/installation'
import { OUTCOME, isInFlight, span } from './lib'
import { OutcomeBadge } from './parts'

/**
 * Edge states: `path` = the hop that delivered (coral), `active` = live hop (animated coral),
 * `route` = a travelled hop that failed (graphite), `idle` = standby / hold (hairline).
 */
type EdgeState = 'path' | 'active' | 'route' | 'idle'

const EDGE_COLOR: Record<EdgeState, string> = {
  path: 'var(--accent)',
  active: 'var(--accent)',
  route: 'color-mix(in oklab, var(--accent-2) 55%, transparent)',
  idle: 'var(--line-strong)',
}

function Edge({ state, label, dashed: forceDashed }: { state: EdgeState; label?: string; dashed?: boolean }) {
  const color = EDGE_COLOR[state]
  const dashed = forceDashed ?? (state === 'active' || state === 'idle')
  return (
    <div aria-hidden className="relative flex h-8 shrink-0 items-center justify-center lg:h-auto lg:w-14 lg:self-stretch">
      <svg className="absolute inset-0 size-full overflow-visible">
        <line className={cn('lg:hidden', state === 'active' && 'animate-dash')} x1="50%" y1="0" x2="50%" y2="100%" stroke={color} strokeWidth={1.5} strokeDasharray={dashed ? '4 4' : undefined} />
        <line className={cn('hidden lg:block', state === 'active' && 'animate-dash')} x1="0" y1="50%" x2="100%" y2="50%" stroke={color} strokeWidth={1.5} strokeDasharray={dashed ? '4 4' : undefined} />
      </svg>
      <ChevronRight className="absolute top-1/2 -right-[5px] hidden size-3.5 -translate-y-1/2 lg:block" style={{ color }} />
      <ChevronDown className="absolute -bottom-[5px] left-1/2 size-3.5 -translate-x-1/2 lg:hidden" style={{ color }} />
      {label && (
        <span className="relative rounded bg-surface px-1 font-mono text-[9.5px] tracking-wider uppercase" style={{ color }}>
          {label}
        </span>
      )}
    </div>
  )
}

function Node({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay }}
      className={cn('relative min-w-0 rounded-xl border p-3.5 lg:w-[200px] lg:min-w-[176px] lg:shrink lg:grow', className)}
    >
      {children}
    </motion.div>
  )
}

/** Coral marks the hop that fulfilled (or is fulfilling) the order; everything else stays graphite. */
const NODE_TONE: Record<OrderAttempt['outcome'], string> = {
  success: 'border-accent/45 bg-surface shadow-[inset_0_2px_0_var(--accent)]',
  timeout: 'border-line bg-surface-2/50',
  error: 'border-line bg-surface-2/50',
  rejected: 'border-danger/25 bg-surface-2/50',
  in_flight: 'border-accent/45 bg-accent/[0.04] shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_10%,transparent)]',
}

const ts = (iso: string) => new Date(iso).getTime()

export function RoutingCard({ order, service, providers, mappings, now }: { order: OrderDetail; service?: Service; providers?: Provider[]; mappings?: ServiceMapping[]; now: number }) {
  const pname = (id: string) => providers?.find((p) => p.id === id)?.name ?? id
  const short = (id: string) => providers?.find((p) => p.id === id)?.shortName ?? pname(id)
  const attempted = new Set(order.attempts.map((a) => a.providerId))
  const standby = (mappings ?? []).filter((m) => m.enabled && !attempted.has(m.providerId)).sort((a, b) => a.priority - b.priority)
  const lastAttempt = order.attempts.at(-1)
  const backingOff = isInFlight(order.status) && !!lastAttempt && lastAttempt.outcome !== 'success' && lastAttempt.outcome !== 'in_flight'
  const strategy = titleCase(service?.routingStrategy ?? 'priority')
  const held = order.attempts.length === 0 && order.error?.code === 'held_for_review'
  const noRoute = order.attempts.length === 0 && order.error?.code === 'no_route'
  const failovers = Math.max(0, order.attempts.length - 1)

  const description = (() => {
    if (order.status === 'created') return `${strategy} strategy · selecting a supplier`
    if (held) return 'Held by a routing rule before submission'
    if (noRoute) return 'No eligible supplier for this service'
    const first = order.attempts[0]
    const ok = order.attempts.find((a) => a.outcome === 'success')
    if (ok && failovers) return `${strategy} strategy · fell back from ${short(first!.providerId)} to ${short(ok.providerId)}`
    if (ok) return `${strategy} strategy · accepted by the primary supplier`
    if (backingOff) return `${strategy} strategy · ${short(lastAttempt!.providerId)} failed, falling back with backoff`
    if (lastAttempt?.outcome === 'in_flight') return `${strategy} strategy · awaiting ${short(lastAttempt.providerId)}`
    return `${strategy} strategy · ${order.attempts.length} supplier${order.attempts.length === 1 ? '' : 's'} attempted, none succeeded`
  })()

  const shownStandby = standby.slice(0, 2)
  const hiddenStandby = standby.length - shownStandby.length
  const edgeFor = (a: OrderAttempt): EdgeState => (a.outcome === 'in_flight' ? 'active' : a.outcome === 'success' ? 'path' : 'route')
  const standbyNote = isInFlight(order.status)
    ? 'Next in line if the live hop fails'
    : order.status === 'failed'
      ? order.error?.code === 'provider_rejected'
        ? 'Not tried — the rejection was definitive'
        : 'Not tried for this order'
      : 'Not needed for this order'

  return (
    <Card>
      <CardHeader
        icon={<Route />}
        title="Supplier chain"
        description={description}
        actions={
          <Button variant="ghost" size="sm" to="/admin/routing" className="hidden sm:inline-flex">
            Routing rules
          </Button>
        }
      />
      <div className="px-5 pb-5">
        <div className="no-scrollbar flex flex-col lg:flex-row lg:items-stretch lg:overflow-x-auto lg:pb-1">
          {/* Router */}
          <Node className="border-line bg-surface-2/60 lg:w-[150px] lg:min-w-[150px] lg:grow-0">
            <div className="flex items-center gap-2.5 lg:flex-col lg:items-start">
              <LogoMark className="size-8" />
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-fg">Core router</p>
                <p className="truncate text-[11.5px] text-fg-3">{strategy}</p>
              </div>
            </div>
          </Node>

          {order.status === 'created' && (
            <>
              <Edge state="active" />
              <Node className="border-dashed border-accent/40 bg-accent/[0.03]">
                <div className="flex items-center gap-2.5 text-[13px] text-fg-2">
                  <LoaderCircle className="size-4 animate-spin text-accent-ink" />
                  Selecting supplier…
                </div>
                <p className="mt-2 text-[12px] text-fg-3">Applying routing rules, supplier health and cost</p>
              </Node>
            </>
          )}

          {held && (
            <>
              <Edge state="idle" label="hold" />
              <Node className="border-warning/30 bg-warning/[0.04]">
                <div className="flex items-center gap-2 text-[13px] font-medium text-fg">
                  <ShieldAlert className="size-4 text-warning" /> Manual review
                </div>
                <p className="mt-2 line-clamp-3 text-[12px] text-fg-3">{order.error?.message}</p>
              </Node>
            </>
          )}

          {noRoute && (
            <>
              <Edge state="idle" />
              <Node className="border-danger/30 bg-danger/[0.04]">
                <div className="flex items-center gap-2 text-[13px] font-medium text-fg">
                  <CircleSlash className="size-4 text-danger" /> No route
                </div>
                <p className="mt-2 text-[12px] text-fg-3">All mapped suppliers are disabled or in outage.</p>
              </Node>
            </>
          )}

          {order.attempts.map((a, i) => {
            const elapsed = a.outcome === 'in_flight' ? now - ts(a.startedAt) : a.latencyMs
            const mapping = mappings?.find((m) => m.providerId === a.providerId)
            return (
              <Fragment key={`${a.providerId}-${i}`}>
                <Edge state={edgeFor(a)} label={i === 0 ? undefined : 'fallback'} dashed={i > 0 && a.outcome !== 'success' ? true : undefined} />
                <Node className={NODE_TONE[a.outcome]} delay={0.06 * (i + 1)}>
                  <div className="flex items-center gap-2.5">
                    <ProviderMark id={a.providerId} name={pname(a.providerId)} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-fg" title={pname(a.providerId)}>
                        {pname(a.providerId)}
                      </p>
                      <p className={cn('mono-label', (a.outcome === 'success' || a.outcome === 'in_flight') && 'text-accent-ink')}>
                        {i === 0 ? 'Primary' : `Fallback ${i}`}
                        {a.outcome === 'success' ? ' · fulfilled' : a.outcome === 'in_flight' ? ' · live' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <OutcomeBadge outcome={a.outcome} />
                    <span className={cn('font-mono text-[12px] tabular', a.outcome === 'in_flight' ? 'text-accent-ink' : 'text-fg-2')}>{span(elapsed)}</span>
                  </div>
                  <Tooltip content={a.message} className="mt-2 block">
                    <span className={cn('line-clamp-2 text-[12px]', a.outcome === 'success' && a.externalRef ? 'font-mono text-[11.5px] text-fg-2' : 'text-fg-3')}>{a.outcome === 'success' && a.externalRef ? `Supplier ref ${a.externalRef}` : a.message}</span>
                  </Tooltip>
                  {mapping && (
                    <p className="mt-1.5 font-mono text-[10.5px] text-fg-3">
                      cost {money(mapping.cost)} · <span title={mapping.externalName}>{mapping.externalId}</span>
                    </p>
                  )}
                </Node>
              </Fragment>
            )
          })}

          {backingOff && shownStandby[0] && (
            <>
              <Edge state="active" label="fallback" />
              <Node className="border-dashed border-accent/40 bg-accent/[0.03]" delay={0.2}>
                <div className="flex items-center gap-2.5">
                  <ProviderMark id={shownStandby[0].providerId} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-fg">{pname(shownStandby[0].providerId)}</p>
                    <p className="mono-label">Up next</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-[12px] text-accent-ink">
                  <LoaderCircle className="size-3.5 animate-spin" /> Backing off…
                </div>
              </Node>
            </>
          )}

          {shownStandby.slice(backingOff ? 1 : 0).map((m, i) => (
            <Fragment key={m.id}>
              <Edge state="idle" />
              <Node className="border-dashed border-line-strong bg-transparent opacity-70" delay={0.25 + i * 0.05}>
                <div className="flex items-center gap-2.5">
                  <ProviderMark id={m.providerId} size="md" className="grayscale-[0.6]" />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-fg-2">{pname(m.providerId)}</p>
                    <p className="mono-label">Standby · P{m.priority}</p>
                  </div>
                </div>
                <p className="mt-3 text-[12px] text-fg-3">{standbyNote}</p>
                <p className="mt-1.5 font-mono text-[10.5px] text-fg-3">cost {money(m.cost)}</p>
              </Node>
            </Fragment>
          ))}
          {hiddenStandby > 0 && <div className="mt-2 self-center text-[12px] text-fg-3 lg:mt-0 lg:ml-3">+{hiddenStandby} more</div>}
        </div>

        {order.attempts.length > 0 && <Waterfall order={order} providerName={short} now={now} />}
      </div>
    </Card>
  )
}

const BAR: Record<OrderAttempt['outcome'], string> = {
  success: 'bg-accent',
  timeout: 'bg-warning',
  error: 'bg-warning',
  rejected: 'bg-danger',
  in_flight: 'bg-accent animate-pulse',
}
const PROCESSING_HATCH = 'repeating-linear-gradient(135deg, var(--accent) 0 2px, transparent 2px 5px)'

function Waterfall({ order, providerName, now }: { order: OrderDetail; providerName: (id: string) => string; now: number }) {
  const t0 = ts(order.createdAt)
  const inflight = isInFlight(order.status)
  const end = order.completedAt ? ts(order.completedAt) : now
  const total = Math.max(1, end - t0)
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / total) * 100))}%`
  const ticks = [0, 0.25, 0.5, 0.75, 1]
  const success = order.attempts.find((a) => a.outcome === 'success')
  const processingFrom = success?.endedAt ? ts(success.endedAt) : null
  const processingTo = order.completedAt ? ts(order.completedAt) : inflight ? now : null

  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="mono-label">Attempt waterfall</span>
        <div className="flex flex-wrap items-center gap-3 text-[11.5px] text-fg-3">
          <Legend className="bg-accent" label="Accepted" />
          <Legend className="bg-warning" label="Timeout / error" />
          <Legend className="bg-danger" label="Rejected" />
          <Legend className="opacity-70" style={{ background: PROCESSING_HATCH }} label="Supplier processing" />
        </div>
      </div>
      <div className="space-y-2">
        {order.attempts.map((a, i) => {
          const start = ts(a.startedAt) - t0
          const len = a.outcome === 'in_flight' ? now - ts(a.startedAt) : a.endedAt ? ts(a.endedAt) - ts(a.startedAt) : a.latencyMs
          const isOk = a === success
          return (
            <div key={i} className="grid grid-cols-[minmax(0,108px)_minmax(0,1fr)_64px] items-center gap-3 sm:grid-cols-[minmax(0,140px)_minmax(0,1fr)_72px]">
              <span className="flex min-w-0 items-center gap-2 text-[12.5px] text-fg-2">
                <ProviderMark id={a.providerId} size="xs" />
                <span className="truncate">{providerName(a.providerId)}</span>
              </span>
              <div className="relative h-6 overflow-hidden rounded-md bg-surface-2">
                {ticks.slice(1, -1).map((t) => (
                  <span key={t} className="absolute inset-y-0 w-px bg-line" style={{ left: `${t * 100}%` }} />
                ))}
                {isOk && processingFrom != null && processingTo != null && processingTo > processingFrom && (
                  <motion.span
                    className="absolute inset-y-1.5 rounded-r-[3px] opacity-60"
                    style={{ left: pct(processingFrom - t0), background: PROCESSING_HATCH }}
                    initial={{ width: 0 }}
                    animate={{ width: pct(processingTo - processingFrom) }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                  />
                )}
                <Tooltip content={`${OUTCOME[a.outcome].label} · ${span(len)} · ${a.message}`} className="absolute inset-y-0 left-0 block w-full">
                  <motion.span
                    className={cn('absolute inset-y-1 rounded-[3px]', BAR[a.outcome])}
                    style={{ left: pct(start), minWidth: 3 }}
                    initial={{ width: 0 }}
                    animate={{ width: pct(len) }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.05 * i }}
                  />
                </Tooltip>
              </div>
              <span className={cn('text-right font-mono text-[11.5px] tabular', a.outcome === 'in_flight' ? 'text-accent-ink' : 'text-fg-2')}>{span(len)}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 grid grid-cols-[minmax(0,108px)_minmax(0,1fr)_64px] gap-3 sm:grid-cols-[minmax(0,140px)_minmax(0,1fr)_72px]">
        <span />
        <div className="relative h-4">
          {ticks.map((t) => (
            <span key={t} className={cn('absolute font-mono text-[10px] text-fg-3 tabular', t === 0 ? 'left-0' : t === 1 ? 'right-0' : '-translate-x-1/2')} style={t > 0 && t < 1 ? { left: `${t * 100}%` } : undefined}>
              {t === 0 ? '0' : span(total * t)}
            </span>
          ))}
        </div>
        <span className="text-right font-mono text-[10px] text-fg-3">{inflight ? 'elapsed' : 'total'}</span>
      </div>
    </div>
  )
}

function Legend({ className, label, style }: { className: string; label: string; style?: CSSProperties }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('size-2 rounded-[3px]', className)} style={style} />
      {label}
    </span>
  )
}
