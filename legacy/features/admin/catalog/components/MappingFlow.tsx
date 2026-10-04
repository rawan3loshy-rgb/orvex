/**
 * The visual mapping interface:
 *   INTERNAL SERVICE ──▶ ROUTING ENGINE ──┬──▶ Supplier service (P1)
 *                                         ├──▶ Supplier service (P2)
 *                                         └──▶ Supplier service (P3)
 * Nodes are regular DOM cards; connectors are measured SVG curves with
 * animated "order" particles that follow the effective routing chain.
 */
import { useLayoutEffect, useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, ChevronUp, ExternalLink, MoreHorizontal, Pencil, Plus, Route, Trash2 } from 'lucide-react'
import { ProviderMark, ServiceIcon } from '@/components/brand'
import { Badge, Button, MenuItem, MenuSeparator, Popover, StatusBadge, Switch, Tooltip } from '@/components/ui'
import { cn } from '@/lib/cn'
import { money, ms, num, pct } from '@/lib/format'
import type { Provider, RoutingStrategy, Service, ServiceMapping } from '@/types/installation'
import { DELIVERY, MiniStat, ROLE_META, RoleBadge, STRATEGIES, effectiveChain, priorityInk, roleOf, turnaroundLabel, type ChainRole } from './shared'
import { hCurve, railElbow, useFlowGeometry } from './useFlowGeometry'

export interface MappingFlowProps {
  service: Service
  mappings: ServiceMapping[]
  providers: Map<string, Provider>
  strategy?: RoutingStrategy
  editable?: boolean
  busy?: boolean
  onToggle?: (m: ServiceMapping, enabled: boolean) => void
  onMove?: (m: ServiceMapping, dir: -1 | 1) => void
  onEdit?: (m: ServiceMapping) => void
  onRemove?: (m: ServiceMapping) => void
  onAdd?: () => void
  unmapped?: Provider[]
  className?: string
  /** Container width at which the flow switches from stacked to horizontal. */
  breakpoint?: number
}

interface FlowPath {
  key: string
  d: string
  color: string
  width: number
  opacity: number
  dashed?: boolean
  particles: { dur: number; begin: number; r: number }[]
  glow?: boolean
}

const ROLE_PARTICLES: Record<ChainRole, FlowPath['particles']> = {
  primary: [
    { dur: 2.4, begin: 0, r: 3 },
    { dur: 2.4, begin: 0.8, r: 3 },
    { dur: 2.4, begin: 1.6, r: 3 },
  ],
  fallback: [{ dur: 3.4, begin: 0.6, r: 2.4 }],
  emergency: [{ dur: 4.4, begin: 1.8, r: 2.2 }],
}

export function MappingFlow({ service, mappings, providers, strategy, editable, busy, onToggle, onMove, onEdit, onRemove, onAdd, unmapped = [], className, breakpoint = 760 }: MappingFlowProps) {
  const strat = strategy ?? service.routingStrategy
  const sorted = useMemo(() => mappings.slice().sort((a, b) => a.priority - b.priority), [mappings])
  const chain = useMemo(() => effectiveChain(sorted, strat, providers), [sorted, strat, providers])
  const settleKey = `${sorted.map((m) => `${m.id}:${m.enabled}:${m.priority}`).join('|')}|${strat}|${unmapped.length}`
  const { containerRef, register, rects, size, measure } = useFlowGeometry(settleKey)
  const horizontal = size.w >= breakpoint
  // Switching orientation moves every node — re-measure before paint.
  useLayoutEffect(() => measure(), [horizontal, measure])
  const showAdd = editable && !!onAdd && unmapped.length > 0

  const paths = useMemo<FlowPath[]>(() => {
    const svc = rects.svc
    const eng = rects.engine
    if (!svc || !eng) return []
    const out: FlowPath[] = []
    const ey = eng.y + eng.h / 2
    const rail = eng.x + eng.w / 2
    const trunkParticles = chain.length ? [0, 0.55, 1.1].map((b) => ({ dur: 1.65, begin: b, r: 2.6 })) : []
    out.push({
      key: 'trunk',
      d: horizontal ? hCurve(svc.x + svc.w, svc.y + svc.h / 2, eng.x, ey) : `M${rail},${svc.y + svc.h} L${rail},${eng.y}`,
      color: 'var(--accent)',
      width: 1.75,
      opacity: 0.75,
      particles: trunkParticles,
    })
    const target = (key: string) => {
      const r = rects[key]
      if (!r) return null
      return horizontal ? hCurve(eng.x + eng.w, ey, r.x, r.y + r.h / 2) : railElbow(rail, eng.y + eng.h, r.x, r.y + Math.min(r.h / 2, 32))
    }
    // Draw back-to-front so the primary path sits on top.
    const ordered = sorted.slice().sort((a, b) => rank(roleOf(chain, b.id)) - rank(roleOf(chain, a.id)))
    for (const m of ordered) {
      const d = target(m.id)
      if (!d) continue
      const role = roleOf(chain, m.id)
      if (role && role !== 'standby') {
        out.push({
          key: m.id,
          d,
          color: ROLE_META[role].color,
          width: role === 'primary' ? 2 : 1.5,
          opacity: role === 'primary' ? 0.9 : 0.55,
          particles: ROLE_PARTICLES[role],
          glow: role === 'primary',
        })
      } else {
        out.push({ key: m.id, d, color: 'var(--fg-3)', width: 1.25, opacity: 0.45, dashed: true, particles: [] })
      }
    }
    if (showAdd) {
      const d = target('add')
      if (d) out.unshift({ key: 'add', d, color: 'var(--fg-3)', width: 1.25, opacity: 0.3, dashed: true, particles: [] })
    }
    return out
  }, [rects, horizontal, sorted, chain, showAdd])

  return (
    <div className={cn('relative', className)}>
      <div ref={containerRef} className="relative">
        {size.w > 0 && (
          <svg className="pointer-events-none absolute inset-0 overflow-visible" width={size.w} height={size.h} aria-hidden>
            {paths.map((p) => (
              <g key={p.key}>
                {p.glow && <path d={p.d} fill="none" stroke={p.color} strokeWidth={7} strokeOpacity={0.08} strokeLinecap="round" />}
                <path d={p.d} fill="none" stroke={p.color} strokeWidth={p.width} strokeOpacity={p.opacity} strokeDasharray={p.dashed ? '3 5' : undefined} strokeLinecap="round" />
                {p.particles.map((pt, i) => (
                  <circle key={i} r={pt.r} fill={p.color} opacity={0}>
                    <animateMotion dur={`${pt.dur}s`} begin={`${pt.begin}s`} repeatCount="indefinite" path={p.d} />
                    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.85;1" dur={`${pt.dur}s`} begin={`${pt.begin}s`} repeatCount="indefinite" />
                  </circle>
                ))}
              </g>
            ))}
          </svg>
        )}

        <div
          className={cn(horizontal ? 'grid items-center gap-x-14' : 'flex flex-col gap-9')}
          style={horizontal ? { gridTemplateColumns: 'minmax(220px, 270px) 100px minmax(0, 1fr)' } : undefined}
        >
          <ServiceNode service={service} nodeRef={register('svc')} />
          <EngineNode strategy={strat} eligible={chain.length} horizontal={horizontal} nodeRef={register('engine')} />
          <div className={cn('flex min-w-0 flex-col gap-3', !horizontal && 'pl-12')}>
            <AnimatePresence initial={false} mode="popLayout">
              {sorted.map((m, i) => {
                const p = providers.get(m.providerId)
                if (!p) return null
                return (
                  <motion.div
                    key={m.id}
                    ref={register(m.id)}
                    layout="position"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12, transition: { duration: 0.15 } }}
                    transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                    className="relative z-[1]"
                  >
                    <ProviderNode
                      m={m}
                      p={p}
                      role={roleOf(chain, m.id)}
                      editable={editable}
                      busy={busy}
                      first={i === 0}
                      last={i === sorted.length - 1}
                      onToggle={onToggle}
                      onMove={onMove}
                      onEdit={onEdit}
                      onRemove={onRemove}
                    />
                  </motion.div>
                )
              })}
            </AnimatePresence>
            {sorted.length === 0 && (
              <div className="relative z-[1] rounded-xl border border-dashed border-line-strong bg-surface/70 px-4 py-6 text-center">
                <p className="text-[13px] font-medium text-fg">No suppliers mapped yet</p>
                <p className="mt-0.5 text-[12px] text-fg-3">Orders for this service cannot be fulfilled until at least one supplier service is mapped.</p>
              </div>
            )}
            {showAdd && (
              <button
                ref={register('add')}
                type="button"
                onClick={onAdd}
                className="group relative z-[1] flex items-center gap-3 rounded-xl border border-dashed border-line-strong bg-surface/70 px-3.5 py-3 text-left transition-colors hover:border-accent/50 hover:bg-accent/[0.03]"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-dashed border-line-strong text-fg-3 transition-colors group-hover:border-accent/50 group-hover:text-accent-ink">
                  <Plus className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-fg">Map another supplier</span>
                  <span className="block truncate text-[12px] text-fg-3">{num(unmapped.length)} connected supplier{unmapped.length === 1 ? '' : 's'} not mapped to this service — add a fallback</span>
                </span>
                <span className="hidden -space-x-1.5 sm:flex">
                  {unmapped.slice(0, 4).map((p) => (
                    <ProviderMark key={p.id} id={p.id} name={p.name} size="xs" className="ring-2 ring-surface" />
                  ))}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
      <FlowLegend className={cn('mt-6', horizontal ? 'justify-end' : '')} />
    </div>
  )
}

function rank(r: ReturnType<typeof roleOf>) {
  return r === 'primary' ? 3 : r === 'fallback' ? 2 : r === 'emergency' ? 1 : 0
}

export function FlowLegend({ className }: { className?: string }) {
  const items: { label: string; color: string; dashed?: boolean }[] = [
    { label: 'Primary path', color: ROLE_META.primary.color },
    { label: 'Fallback', color: ROLE_META.fallback.color },
    { label: 'Emergency', color: ROLE_META.emergency.color },
    { label: 'Disabled / standby', color: 'var(--fg-3)', dashed: true },
  ]
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-fg-3', className)}>
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          <svg width="18" height="6" aria-hidden>
            <line x1="1" y1="3" x2="17" y2="3" stroke={it.color} strokeWidth="2" strokeLinecap="round" strokeDasharray={it.dashed ? '2 3' : undefined} />
          </svg>
          {it.label}
        </span>
      ))}
    </div>
  )
}

function ServiceNode({ service, nodeRef }: { service: Service; nodeRef: (el: HTMLElement | null) => void }) {
  const D = DELIVERY[service.delivery]
  return (
    <div ref={nodeRef} className="relative z-[1] rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <span className="mono-label flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-accent" />
          Internal service
        </span>
        <StatusBadge status={service.status} noPulse />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <ServiceIcon icon={service.icon} category={service.category} />
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold tracking-[-0.01em] text-fg">{service.name}</div>
          <div className="truncate font-mono text-[11.5px] text-fg-3">
            {service.id} · {service.category}
          </div>
        </div>
      </div>
      {service.fields.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1">
          <span className="mr-0.5 text-[10.5px] text-fg-3">Input</span>
          {service.fields.map((f) => (
            <span key={f.key} className="rounded bg-fg/6 px-1.5 py-px font-mono text-[10.5px] text-fg-2" title={f.label}>
              {f.key}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
        <MiniStat label="Price" value={money(service.price)} />
        <MiniStat label={D.label} value={turnaroundLabel(service.turnaround)} />
        <MiniStat label="Fields" value={service.fields.length} />
      </div>
    </div>
  )
}

function EngineNode({ strategy, eligible, horizontal, nodeRef }: { strategy: RoutingStrategy; eligible: number; horizontal: boolean; nodeRef: (el: HTMLElement | null) => void }) {
  const S = STRATEGIES[strategy]
  const size = horizontal ? 92 : 56
  return (
    <div className={cn('relative z-[1]', horizontal ? 'flex justify-center' : 'flex items-center gap-3.5 pl-1')}>
      <div ref={nodeRef} className="relative grid shrink-0 place-items-center rounded-full" style={{ width: size, height: size }}>
        <span
          className="absolute inset-0 animate-spin-slow rounded-full"
          style={{ background: 'conic-gradient(from 0deg, transparent 0deg, color-mix(in oklab, var(--accent) 80%, transparent) 70deg, transparent 140deg, transparent 360deg)' }}
        />
        <span className="absolute inset-[1.5px] rounded-full border border-line bg-surface shadow-pop" />
        <span className={cn('absolute rounded-full bg-accent/[0.08] ring-1 ring-accent/25', horizontal ? 'inset-[10px]' : 'inset-[7px]')} />
        <Route className={cn('relative text-accent-ink', horizontal ? 'size-6' : 'size-5')} />
      </div>
      <div className={cn(horizontal && 'absolute top-full left-1/2 mt-3 -translate-x-1/2 text-center whitespace-nowrap')}>
        <div className="mono-label">Routing engine</div>
        <div className={cn('mt-0.5 flex items-center gap-1.5 text-[12.5px] font-medium text-fg', horizontal && 'justify-center')}>
          <S.icon className="size-3.5" style={{ color: S.color }} />
          {S.label}
        </div>
        <div className="text-[11px] text-fg-3">
          {eligible} eligible supplier{eligible === 1 ? '' : 's'} · max 3 attempts
        </div>
      </div>
    </div>
  )
}

function ProviderNode({
  m,
  p,
  role,
  editable,
  busy,
  first,
  last,
  onToggle,
  onMove,
  onEdit,
  onRemove,
}: {
  m: ServiceMapping
  p: Provider
  role: ReturnType<typeof roleOf>
  editable?: boolean
  busy?: boolean
  first: boolean
  last: boolean
  onToggle?: MappingFlowProps['onToggle']
  onMove?: MappingFlowProps['onMove']
  onEdit?: MappingFlowProps['onEdit']
  onRemove?: MappingFlowProps['onRemove']
}) {
  const navigate = useNavigate()
  const latency = m.avgLatencyMs || p.latencyP50
  const success = m.successRate30d || p.successRate
  const healthTone = p.status === 'operational' ? 'text-success' : p.status === 'degraded' ? 'text-warning' : 'text-danger'
  const pc = priorityInk(m.priority)
  const skippedReason = !m.enabled ? 'Mapping disabled' : p.status === 'disabled' ? 'Supplier disabled' : p.status === 'outage' ? 'Supplier in outage' : null
  return (
    <div
      className={cn(
        'group flex overflow-hidden rounded-xl border bg-surface shadow-card transition-[border-color,box-shadow] duration-200',
        role === 'primary' ? 'border-accent/35 shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_7%,transparent)]' : 'border-line hover:border-line-strong',
      )}
    >
      {/* Priority rail */}
      <div className="flex w-9 shrink-0 flex-col items-center justify-center gap-0.5 border-r border-line bg-surface-2/60 py-2">
        {editable && onMove && (
          <Tooltip content="Raise priority" placement="left">
            <button type="button" disabled={first || busy} onClick={() => onMove(m, -1)} className="grid size-6 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg disabled:pointer-events-none disabled:opacity-25" aria-label="Raise priority">
              <ChevronUp className="size-3.5" />
            </button>
          </Tooltip>
        )}
        <span className="font-mono text-[11px] font-semibold tabular" style={{ color: pc }}>
          P{m.priority}
        </span>
        {editable && onMove && (
          <Tooltip content="Lower priority" placement="left">
            <button type="button" disabled={last || busy} onClick={() => onMove(m, 1)} className="grid size-6 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg disabled:pointer-events-none disabled:opacity-25" aria-label="Lower priority">
              <ChevronDown className="size-3.5" />
            </button>
          </Tooltip>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3 px-3.5 pt-3 pb-2.5">
          <ProviderMark id={p.id} name={p.name} className={cn(!m.enabled && 'opacity-50 grayscale')} />
          <div className={cn('min-w-0 flex-1', !m.enabled && 'opacity-60')}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate text-[13.5px] font-semibold tracking-[-0.01em] text-fg">{p.name}</span>
              {role ? (
                <RoleBadge role={role} />
              ) : (
                <Tooltip content={skippedReason ?? 'Not in the routing chain'}>
                  <Badge tone="neutral">{!m.enabled ? 'Disabled' : 'Skipped'}</Badge>
                </Tooltip>
              )}
              {p.status !== 'operational' && <StatusBadge status={p.status} />}
            </div>
            <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11.5px] text-fg-3">
              <Tooltip content={`${p.shortName} service ID — what the adapter submits as the supplier’s own service`}>
                <span className="shrink-0 rounded bg-fg/6 px-1.5 py-px font-mono text-[11px] text-fg-2">#{m.externalId}</span>
              </Tooltip>
              <span className="truncate">{m.externalName}</span>
            </div>
          </div>
          {editable && (
            <div className="flex shrink-0 items-center gap-1">
              {onToggle && <Switch size="sm" checked={m.enabled} disabled={busy} onChange={(v) => onToggle(m, v)} label={m.enabled ? 'Disable mapping' : 'Enable mapping'} />}
              <Popover
                placement="bottom-end"
                trigger={({ toggle, open }) => (
                  <Button variant="ghost" size="xs" icon onClick={toggle} aria-label="Mapping actions" className={cn(open && 'bg-surface-2 text-fg')}>
                    <MoreHorizontal />
                  </Button>
                )}
              >
                {(close) => (
                  <>
                    {onEdit && (
                      <MenuItem
                        icon={<Pencil />}
                        onClick={() => {
                          close()
                          onEdit(m)
                        }}
                      >
                        Edit mapping
                      </MenuItem>
                    )}
                    <MenuItem
                      icon={<ExternalLink />}
                      onClick={() => {
                        close()
                        navigate(`/admin/providers/${p.id}`)
                      }}
                    >
                      Open supplier
                    </MenuItem>
                    {onRemove && (
                      <>
                        <MenuSeparator />
                        <MenuItem
                          danger
                          icon={<Trash2 />}
                          onClick={() => {
                            close()
                            onRemove(m)
                          }}
                        >
                          Remove mapping
                        </MenuItem>
                      </>
                    )}
                  </>
                )}
              </Popover>
            </div>
          )}
        </div>
        <div className={cn('grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4', !m.enabled && 'opacity-60')}>
          <Cell label="Supplier cost" value={money(m.cost)} strong />
          <Cell label="Uptime 30d" value={<span className={healthTone}>{pct(p.uptime30d, 2)}</span>} />
          <Cell label="Latency" value={ms(latency)} />
          <Cell label="Success" value={pct(success)} />
        </div>
      </div>
    </div>
  )
}

function Cell({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="min-w-0 bg-surface px-3.5 py-2">
      <div className="text-[10.5px] text-fg-3">{label}</div>
      <div className={cn('truncate text-[12.5px] tabular', strong ? 'font-semibold text-fg' : 'font-medium text-fg-2')}>{value}</div>
    </div>
  )
}
