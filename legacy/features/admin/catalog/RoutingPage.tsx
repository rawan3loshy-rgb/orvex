import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, Reorder, motion, useDragControls } from 'motion/react'
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  FlaskConical,
  Globe,
  GripVertical,
  Inbox,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Route,
  Shuffle,
  Sparkles,
  Timer,
  Trash2,
  TriangleAlert,
  Zap,
} from 'lucide-react'
import { ProviderMark, ServiceIcon } from '@/components/brand'
import { Donut } from '@/components/charts'
import { Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, MenuItem, MenuSeparator, PageHeader, Popover, Select, Skeleton, Switch, Tooltip } from '@/components/ui'
import { useInstMutation, useOrders, useRoutingRules, useServiceMappings, useServices } from '@/hooks/installation'
import { routingService } from '@/services/installation'
import { cn } from '@/lib/cn'
import { useMeasure } from '@/lib/useMeasure'
import { money, ms, num, pct } from '@/lib/format'
import type { Provider, RoutingRule, RoutingStrategy, Service } from '@/types/installation'
import { RuleDrawer } from './components/RuleDrawer'
import { FlowConnector, RoutingSimulator } from './components/RoutingBits'
import { exampleInput, sampleResult } from './components/examples'
import { ActionPill, MetricStrip, ROLE_META, ROLES, STRATEGIES, conditionText, effectiveChain, ruleInScope, scopeText, turnaroundLabel, useProviderMap, useServiceMap, type ChainRole } from './components/shared'

export default function RoutingPage() {
  const rules = useRoutingRules()
  const services = useServices()
  const { map: providers, data: providerList } = useProviderMap()
  const recent = useOrders({ range: '24h', pageSize: 200 })
  const [drawer, setDrawer] = useState<{ open: boolean; rule: RoutingRule | null }>({ open: false, rule: null })
  const simRef = useRef<HTMLDivElement>(null)

  const stats = useMemo(() => {
    const list = rules.data ?? []
    const items = recent.data?.items ?? []
    const failovers = items.filter((o) => o.attempts.length > 1).length
    return {
      active: list.filter((r) => r.enabled).length,
      total: list.length,
      hits: list.reduce((a, r) => a + r.hits24h, 0),
      failoverRate: items.length ? (failovers / items.length) * 100 : 0,
      failovers,
      sample: items.length,
      degraded: (providerList ?? []).filter((p) => p.status === 'degraded' || p.status === 'outage'),
    }
  }, [rules.data, recent.data, providerList])

  return (
    <div>
      <PageHeader
        icon={<Route />}
        title="Routing engine"
        description="Decides which supplier fulfils each IMEI check, unlock or code order — rules first, then the service strategy, with automatic failover down the chain."
        actions={
          <>
            <Button variant="secondary" leading={<FlaskConical />} onClick={() => simRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Simulate
            </Button>
            <Button variant="accent" leading={<Plus />} onClick={() => setDrawer({ open: true, rule: null })}>
              New rule
            </Button>
          </>
        }
      />

      <MetricStrip
        className="mb-6"
        cols="grid-cols-2 lg:grid-cols-4"
        loading={rules.isLoading}
        items={[
          { label: 'Active rules', icon: <Sparkles />, value: `${stats.active}`, sub: `${stats.total - stats.active} disabled · evaluated top to bottom` },
          { label: 'Rule hits · 24h', icon: <Zap />, value: num(stats.hits), sub: 'Orders re-routed, excluded or held by a rule' },
          { label: 'Failover rate · 24h', icon: <Shuffle />, value: recent.isLoading ? '—' : pct(stats.failoverRate), sub: `${num(stats.failovers)} of ${num(stats.sample)} recent orders needed a fallback`, tone: stats.failoverRate > 10 ? 'warning' : undefined },
          {
            label: 'Suppliers avoided',
            icon: <TriangleAlert />,
            value: stats.degraded.length,
            sub: stats.degraded.length ? `${stats.degraded.map((p) => p.shortName).join(', ')} degraded right now` : 'All suppliers healthy',
            tone: stats.degraded.length ? 'warning' : 'success',
          },
        ]}
      />

      <PipelineFlow services={services.data} providers={providers} rules={rules.data} />

      <StrategiesSection services={services.data} rules={rules.data} />

      <RulesSection rules={rules.data} loading={rules.isLoading} providers={providers} onEdit={(r) => setDrawer({ open: true, rule: r })} onNew={() => setDrawer({ open: true, rule: null })} />

      <div ref={simRef} className="scroll-mt-20">
        <RoutingSimulator description="Pick a GSM scenario or build an order context — service, carrier country, amount, strategy. The engine runs every rule and the strategy against live supplier health; nothing is submitted or charged." />
      </div>

      <RuleDrawer open={drawer.open} rule={drawer.rule} onClose={() => setDrawer({ open: false, rule: null })} />
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/*  (a) Animated pipeline                                                    */
/* ------------------------------------------------------------------------- */

type StageStatus = 'idle' | 'active' | 'ok' | 'fail' | 'done'

function PipelineFlow({ services, providers, rules }: { services: Service[] | undefined; providers: Map<string, Provider>; rules: RoutingRule[] | undefined }) {
  const [serviceId, setServiceId] = useState('SVC-1008')
  const service = services?.find((s) => s.id === serviceId)
  const mq = useServiceMappings(serviceId)
  const scoped = useMemo(() => (service ? (rules ?? []).filter((r) => r.enabled && ruleInScope(r, service)) : []), [rules, service])
  // Apply in-scope supplier exclusions (health / balance) the way Core does before the strategy runs.
  const { chain, excluded } = useMemo(() => {
    if (!service) return { chain: [], excluded: [] as { name: string; why: string }[] }
    const full = effectiveChain(mq.data ?? [], service.routingStrategy, providers)
    const out: { name: string; why: string }[] = []
    const kept = full.filter((m) => {
      const p = providers.get(m.providerId)
      if (!p) return false
      for (const r of scoped) {
        if (r.action.type !== 'exclude_provider' || (r.action.providerId && r.action.providerId !== p.id)) continue
        const health = r.conditions.find((c) => c.field === 'provider.health')
        const balance = r.conditions.find((c) => c.field === 'provider.balance')
        if (health && p.successRate < Number(health.value)) {
          out.push({ name: p.shortName, why: `health ${pct(p.successRate)} < ${health.value}%` })
          return false
        }
        if (balance && p.balance < Number(balance.value)) {
          out.push({ name: p.shortName, why: `credit ${money(p.balance)} < ${money(Number(balance.value))}` })
          return false
        }
      }
      return true
    })
    return { chain: kept.slice(0, 3), excluded: out }
  }, [service, mq.data, providers, scoped])
  const S = service ? STRATEGIES[service.routingStrategy] : STRATEGIES.priority
  const instant = service?.delivery === 'instant'

  const [tick, setTick] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused) return
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [paused])
  useEffect(() => setTick(0), [serviceId])

  const CYCLE = 9
  const failover = chain.length > 1 && Math.floor(tick / CYCLE) % 2 === 1
  const step = tick % CYCLE

  const statusOf = (stage: number): StageStatus => {
    if (stage < 3) return step === stage ? 'active' : step > stage ? 'done' : 'idle'
    if (stage === 3) {
      if (step === 3) return 'active'
      if (step >= 4) return failover ? 'fail' : 'ok'
      return 'idle'
    }
    if (stage === 4 && failover) {
      if (step === 5) return 'active'
      if (step >= 6) return 'ok'
    }
    return 'idle'
  }

  const primary = chain[0]
  const fallback = chain[1]
  const pName = (i: number) => providers.get(chain[i]?.providerId ?? '')?.shortName ?? '—'
  const input = service ? exampleInput(service) : {}
  const inputText = Object.entries(input)
    .slice(0, 2)
    .map(([k, v]) => `${k} ${v}`)
    .join(' · ')
  const narrative = (() => {
    if (!service) return ''
    switch (step) {
      case 0:
        return `Order #48${213 + Math.floor(tick / CYCLE)} · ${service.name}${inputText ? ` · ${inputText}` : ''} — received from MobileHub via the Reseller API`
      case 1:
        if (excluded.length) return `${scoped.length} rules in scope — ${excluded.map((e) => `${e.name} excluded (${e.why})`).join(', ')}`
        return scoped.length ? `${scoped.length} rule${scoped.length === 1 ? '' : 's'} in scope evaluated — ${scoped[0]!.name}${scoped.length > 1 ? ` +${scoped.length - 1}` : ''}` : 'No rules in scope — strategy decides'
      case 2:
        return `${S.label} strategy ordered the chain: ${chain.map((m) => providers.get(m.providerId)?.shortName).join(' → ') || 'no eligible supplier'}`
      case 3:
        return primary ? `Submitting to ${pName(0)} as supplier service #${primary.externalId}…` : 'No eligible supplier — order would fail and be refunded'
      case 4:
        return failover
          ? `${pName(0)} timed out after ${ms(primary?.timeoutMs ?? 30000)} — failing over`
          : instant
            ? `${pName(0)} answered in ${ms(providers.get(primary?.providerId ?? '')?.latencyP50 ?? 0)} · order completed`
            : `${pName(0)} accepted the job in ${ms(providers.get(primary?.providerId ?? '')?.latencyP50 ?? 0)} · result expected in ${turnaroundLabel(service.turnaround)}`
      case 5:
        return failover ? `Submitting to ${pName(1)} as supplier service #${fallback?.externalId}…` : `${instant ? 'Result' : 'Supplier callback'} “${sampleResult(service).summary}” normalised by the adapter · order.completed sent`
      case 6:
        return failover
          ? `${pName(1)} ${instant ? 'answered' : 'accepted the job'} in ${ms(providers.get(fallback?.providerId ?? '')?.latencyP50 ?? 0)} on attempt 2${instant ? ` · “${sampleResult(service).summary}”` : ''}`
          : `${instant ? 'Result' : 'Supplier callback'} “${sampleResult(service).summary}” normalised by the adapter · order.completed sent`
      default:
        return failover ? 'Reseller charged once · failover invisible to MobileHub' : 'Margin booked · supplier credit settled'
    }
  })()

  return (
    <Card className="mb-6 overflow-hidden">
      <CardHeader
        icon={<Route />}
        title="How an order is routed"
        description="Live walk-through of the engine for one GSM service. Alternates between a first-attempt success and a supplier timeout with failover."
        actions={
          <div className="hidden items-center gap-2 sm:flex">
            <Select inputSize="sm" value={serviceId} onChange={(e) => setServiceId(e.target.value)} options={(services ?? []).map((s) => ({ value: s.id, label: s.name }))} className="w-[190px]" />
            <Tooltip content={paused ? 'Resume animation' : 'Pause animation'}>
              <button type="button" onClick={() => setPaused((p) => !p)} className="flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[12px] text-fg-2 hover:bg-surface-2">
                <span className={cn('size-1.5 rounded-full', paused ? 'bg-fg-3' : 'animate-pulse bg-success')} />
                {paused ? 'Paused' : 'Live'}
              </button>
            </Tooltip>
          </div>
        }
      />
      <div className="relative border-t border-line bg-grid px-4 py-7 sm:px-6">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-surface/60 via-transparent to-surface/80" />
        <div className="relative mb-4 flex items-center gap-2 sm:hidden">
          <Select inputSize="sm" value={serviceId} onChange={(e) => setServiceId(e.target.value)} options={(services ?? []).map((s) => ({ value: s.id, label: s.name }))} className="flex-1" />
          <Button size="sm" variant="secondary" onClick={() => setPaused((p) => !p)}>
            {paused ? 'Resume' : 'Pause'}
          </Button>
        </div>
        {!service ? (
          <Skeleton className="h-[260px] rounded-xl" />
        ) : (
          <div className="relative">
            {/* Row 1 — decision */}
            <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_40px_minmax(0,1fr)_40px_minmax(0,1fr)] lg:items-stretch">
              <Stage status={statusOf(0)} icon={<Inbox />} label="Incoming order" title={service.name} sub={<span className="font-mono">{inputText || `${service.id} · Reseller API`}</span>} leading={<ServiceIcon icon={service.icon} category={service.category} size="sm" />} />
              <FlowConnector dim={step < 1} />
              <Stage
                status={statusOf(1)}
                icon={<Sparkles />}
                label="Rules"
                title={`${scoped.length} rule${scoped.length === 1 ? '' : 's'} in scope`}
                sub={excluded.length ? <span className="line-clamp-1">{excluded.map((e) => e.name).join(', ')} skipped · degraded</span> : scoped[0] ? <span className="line-clamp-1">{scoped[0].name}</span> : 'None apply'}
              />
              <FlowConnector dim={step < 2} />
              <Stage status={statusOf(2)} icon={<S.icon />} label="Strategy" title={S.label} sub={S.tagline} accent={S.color} />
            </div>
            <FlowConnector dim={step < 3} color={ROLE_META.primary.color} className="lg:hidden" />
            <ElbowConnector active={step >= 3} />
            {/* Row 2 — execution & failover */}
            <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_40px_minmax(0,1fr)_40px_minmax(0,1fr)] lg:items-stretch">
              {ROLES.map((role, i) => {
                const m = chain[i]
                const p = m ? providers.get(m.providerId) : undefined
                return (
                  <Fragment key={role}>
                    {i > 0 && <FlowConnector dim={!(failover && i === 1 && step >= 5)} color={ROLE_META[role].color} />}
                    <ProviderStage role={role} provider={p} status={statusOf(3 + i)} cost={m?.cost} externalId={m?.externalId} failLabel={m ? `Timeout ${ms(m.timeoutMs)}` : undefined} />
                  </Fragment>
                )
              })}
            </div>
          </div>
        )}
        <div className="relative mt-6 flex items-center gap-3 rounded-xl border border-line bg-surface/90 px-4 py-2.5 shadow-card backdrop-blur">
          <span className="font-mono text-[11px] text-fg-3 tabular">{String(step + 1).padStart(2, '0')}/09</span>
          <span className="h-4 w-px bg-line" />
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={`${tick}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }} className="min-w-0 flex-1 text-[12.5px] text-fg-2 sm:truncate">
              {narrative}
            </motion.span>
          </AnimatePresence>
          <Badge tone={failover ? 'warning' : 'success'} className="hidden sm:inline-flex">
            {failover ? 'Failover scenario' : 'Happy path'}
          </Badge>
        </div>
      </div>
    </Card>
  )
}

/** Connects the end of row 1 (strategy) to the start of row 2 (primary) on wide screens. */
function ElbowConnector({ active }: { active: boolean }) {
  const [ref, { width }] = useMeasure<HTMLDivElement>()
  const h = 44
  const col = (width - 80) / 3
  const x1 = width - col / 2
  const x2 = col / 2
  const r = 10
  const d = width ? `M${x1},0 L${x1},${h / 2 - r} Q${x1},${h / 2} ${x1 - r},${h / 2} L${x2 + r},${h / 2} Q${x2},${h / 2} ${x2},${h / 2 + r} L${x2},${h}` : ''
  const color = ROLE_META.primary.color
  return (
    <div ref={ref} className="relative hidden lg:block" style={{ height: h }} aria-hidden>
      {width > 0 && (
        <svg width={width} height={h} className="absolute inset-0 overflow-visible">
          <path d={d} fill="none" stroke={color} strokeOpacity={active ? 0.45 : 0.18} strokeWidth={1.5} strokeLinejoin="round" />
          {active &&
            [0, 0.7].map((b) => (
              <circle key={b} r={3} fill={color} opacity={0}>
                <animateMotion dur="1.4s" begin={`${b}s`} repeatCount="indefinite" path={d} />
                <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.85;1" dur="1.4s" begin={`${b}s`} repeatCount="indefinite" />
              </circle>
            ))}
          <path d={`M${x2 - 4},${h - 6} L${x2},${h} L${x2 + 4},${h - 6}`} fill="none" stroke={color} strokeOpacity={active ? 0.7 : 0.3} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  )
}

function Stage({ status, icon, label, title, sub, leading, accent }: { status: StageStatus; icon: ReactNode; label: string; title: ReactNode; sub?: ReactNode; leading?: ReactNode; accent?: string }) {
  const active = status === 'active'
  return (
    <motion.div
      animate={{ scale: active ? 1.025 : 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className={cn(
        'relative min-w-0 flex-1 rounded-xl border bg-surface p-3.5 shadow-card transition-[border-color,box-shadow] duration-300',
        active ? 'border-accent/50 shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent)_10%,transparent)]' : status === 'done' ? 'border-line-strong' : 'border-line',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="mono-label flex items-center gap-1.5 [&_svg]:size-3" style={accent ? { color: accent } : undefined}>
          {icon}
          {label}
        </span>
        {status === 'done' && <CircleCheck className="size-3.5 text-success" />}
        {active && <span className="size-1.5 animate-pulse rounded-full bg-accent" />}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {leading}
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold">{title}</div>
          {sub && <div className="truncate text-[11.5px] text-fg-3">{sub}</div>}
        </div>
      </div>
    </motion.div>
  )
}

function ProviderStage({ role, provider: p, status, cost, externalId, failLabel }: { role: ChainRole; provider?: Provider; status: StageStatus; cost?: number; externalId?: string; failLabel?: string }) {
  const meta = ROLE_META[role]
  const active = status === 'active'
  return (
    <motion.div
      animate={{ scale: active ? 1.025 : 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className={cn(
        'relative min-w-0 flex-1 overflow-hidden rounded-xl border bg-surface p-3.5 shadow-card transition-[border-color,box-shadow] duration-300',
        status === 'ok' ? 'border-success/50 shadow-[0_0_0_4px_color-mix(in_oklab,var(--success)_10%,transparent)]' : status === 'fail' ? 'border-danger/45' : active ? 'border-accent/50 shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent)_10%,transparent)]' : 'border-line',
        !p && 'border-dashed opacity-60',
      )}
    >
      <span className="absolute inset-x-0 top-0 h-[2px]" style={{ background: meta.color, opacity: role === 'primary' ? 1 : 0.55 }} />
      <div className="flex items-center justify-between gap-2">
        <span className="mono-label" style={{ color: meta.ink }}>
          {meta.label}
        </span>
        <AnimatePresence mode="wait" initial={false}>
          {status === 'ok' ? (
            <motion.span key="ok" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-1 text-[11px] font-medium text-success">
              <CircleCheck className="size-3.5" /> {ms(p?.latencyP50 ?? 0)}
            </motion.span>
          ) : status === 'fail' ? (
            <motion.span key="fail" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-1 text-[11px] font-medium text-danger">
              <Timer className="size-3.5" /> {failLabel}
            </motion.span>
          ) : active ? (
            <motion.span key="a" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1 text-[11px] text-accent-ink">
              <span className="size-1.5 animate-pulse rounded-full bg-accent" /> submitting
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>
      {p ? (
        <div className="mt-2 flex items-center gap-2.5">
          <ProviderMark id={p.id} name={p.name} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold">{p.name}</div>
            <div className="truncate text-[11.5px] text-fg-3">
              {p.shortName} #{externalId} · {cost != null ? money(cost) : '—'}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-2 text-[12px] text-fg-3">No supplier at this depth</div>
      )}
      {p && p.status !== 'operational' && (
        <Tooltip content={`${p.name} is ${p.status}. Health rules may skip it until it recovers.`}>
          <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-warning/10 px-1.5 py-0.5 text-[10.5px] font-medium text-warning">
            <TriangleAlert className="size-3" /> {p.status} · {pct(p.successRate)}
          </span>
        </Tooltip>
      )}
    </motion.div>
  )
}

/* ------------------------------------------------------------------------- */
/*  (b) Strategies explained                                                 */
/* ------------------------------------------------------------------------- */

const STRATEGY_CARDS: { key: RoutingStrategy; title: string }[] = [
  { key: 'priority', title: 'Priority' },
  { key: 'lowest_cost', title: 'Price' },
  { key: 'health_weighted', title: 'Availability' },
  { key: 'fastest', title: 'Response time' },
  { key: 'round_robin', title: 'Load spread' },
]

function StrategiesSection({ services, rules }: { services: Service[] | undefined; rules: RoutingRule[] | undefined }) {
  const list = services ?? []
  const by = (s: RoutingStrategy) => list.filter((x) => x.routingStrategy === s)
  const regionRules = (rules ?? []).filter((r) => r.conditions.some((c) => c.field === 'order.country'))
  const countries = [...new Set(regionRules.flatMap((r) => r.conditions.filter((c) => c.field === 'order.country').flatMap((c) => (Array.isArray(c.value) ? c.value : [String(c.value)]))))]
  const typeRules = (rules ?? []).filter((r) => r.scope.serviceIds !== 'all' || r.scope.categories?.length || r.conditions.some((c) => c.field === 'service.category'))
  const { map: svcMap } = useServiceMap()
  const total = list.length || 1

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Routing strategies</h2>
          <p className="mt-0.5 text-[12.5px] text-fg-3">Each service picks one strategy; carrier-region and category routing are expressed as rules on top.</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STRATEGY_CARDS.map(({ key, title }, i) => {
          const S = STRATEGIES[key]
          const using = by(key)
          return (
            <motion.div key={key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <StrategyCard
                icon={<S.icon />}
                color={S.color}
                title={title}
                aka={S.label}
                description={S.description}
                count={`${using.length} service${using.length === 1 ? '' : 's'}`}
                share={using.length / total}
                footer={using.length ? <Tooltip content={using.map((s) => s.name).join(', ')}><span className="truncate">{using.slice(0, 2).map((s) => s.name).join(', ')}{using.length > 2 ? ` +${using.length - 2}` : ''}</span></Tooltip> : 'Not used yet'}
              />
            </motion.div>
          )
        })}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <StrategyCard
            icon={<Globe />}
            color="var(--fg-2)"
            title="Carrier region"
            aka="Rule-based"
            description="Route by the order’s carrier country — EU unlocks to one supplier, APAC codes to another — with order.country conditions."
            count={`${regionRules.length} rule${regionRules.length === 1 ? '' : 's'}`}
            footer={
              <span className="flex flex-wrap gap-1">
                {countries.slice(0, 7).map((c) => (
                  <span key={c} className="rounded bg-surface-3 px-1 font-mono text-[10.5px] text-fg-2">
                    {c}
                  </span>
                ))}
                {countries.length > 7 && <span className="text-[10.5px]">+{countries.length - 7}</span>}
              </span>
            }
          />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
          <StrategyCard
            icon={<Layers />}
            color="var(--fg-2)"
            title="Service category"
            aka="Rule-based"
            description="Scope rules to categories or specific services — e.g. hold high-value unlock orders or tighten timeouts on instant IMEI checks."
            count={`${typeRules.length} rule${typeRules.length === 1 ? '' : 's'}`}
            footer={<span className="truncate">{typeRules.slice(0, 2).map((r) => scopeText(r.scope, svcMap)).join(' · ') || '—'}</span>}
          />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
          <Card className="flex h-full flex-col p-4">
            <div className="mono-label">Strategy mix</div>
            <div className="mt-2 flex flex-1 items-center gap-4">
              <Donut
                size={104}
                thickness={12}
                segments={STRATEGY_CARDS.map(({ key }) => ({ key, label: STRATEGIES[key].label, value: by(key).length, color: STRATEGIES[key].color })).filter((s) => s.value > 0)}
                center={
                  <div>
                    <div className="font-display text-lg font-semibold tabular">{list.length}</div>
                    <div className="text-[10px] text-fg-3">services</div>
                  </div>
                }
              />
              <ul className="min-w-0 flex-1 space-y-1">
                {STRATEGY_CARDS.map(({ key }) => (
                  <li key={key} className="flex items-center gap-1.5 text-[11.5px]">
                    <span className="size-2 rounded-sm" style={{ background: STRATEGIES[key].color }} />
                    <span className="flex-1 truncate text-fg-2">{STRATEGIES[key].label}</span>
                    <span className="text-fg tabular">{by(key).length}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}

function StrategyCard({ icon, color, title, aka, description, count, share, footer }: { icon: ReactNode; color: string; title: string; aka: string; description: string; count: string; share?: number; footer: ReactNode }) {
  return (
    <Card className="group flex h-full flex-col p-4 transition-colors hover:border-line-strong">
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-9 place-items-center rounded-lg [&_svg]:size-4" style={{ color, background: `color-mix(in oklab, ${color} 12%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 24%, transparent)` }}>
          {icon}
        </span>
        <span className="text-[12px] font-medium text-fg-2 tabular">{count}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-[14px] font-semibold tracking-[-0.01em]">{title}</span>
        <span className="text-[11.5px] text-fg-3">{aka}</span>
      </div>
      <p className="mt-1.5 flex-1 text-[12.5px] leading-relaxed text-fg-2">{description}</p>
      {share != null && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-fg/[0.06]">
          <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${share * 100}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
        </div>
      )}
      <div className="mt-3 min-h-[18px] border-t border-line pt-2.5 text-[11.5px] text-fg-3">{footer}</div>
    </Card>
  )
}

/* ------------------------------------------------------------------------- */
/*  (c) Rules                                                                */
/* ------------------------------------------------------------------------- */

function RulesSection({ rules, loading, providers, onEdit, onNew }: { rules: RoutingRule[] | undefined; loading: boolean; providers: Map<string, Provider>; onEdit: (r: RoutingRule) => void; onNew: () => void }) {
  const [order, setOrder] = useState<string[]>([])
  const orderRef = useRef(order)
  orderRef.current = order
  const dragging = useRef(false)
  const [deleting, setDeleting] = useState<RoutingRule | null>(null)
  const { map: services } = useServiceMap()

  const serverOrder = useMemo(() => (rules ?? []).map((r) => r.id), [rules])
  useEffect(() => {
    if (!dragging.current) setOrder(serverOrder)
  }, [serverOrder])
  const byId = useMemo(() => new Map((rules ?? []).map((r) => [r.id, r])), [rules])
  const maxHits = Math.max(1, ...(rules ?? []).map((r) => r.hits24h))

  const reorder = useInstMutation((ids: string[]) => routingService.reorderRules(ids), { success: 'Rule order saved' })
  const toggle = useInstMutation((v: { id: string; enabled: boolean }) => routingService.updateRule(v.id, { enabled: v.enabled }), { success: (d) => `${d.name} ${d.enabled ? 'enabled' : 'disabled'}` })
  const remove = useInstMutation((id: string) => routingService.deleteRule(id), { success: 'Routing rule deleted', onSuccess: () => setDeleting(null) })

  const commit = () => {
    dragging.current = false
    const ids = orderRef.current
    if (ids.join() !== serverOrder.join()) reorder.mutate(ids)
  }
  const move = (id: string, dir: -1 | 1) => {
    const ids = order.slice()
    const i = ids.indexOf(id)
    const j = i + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
    setOrder(ids)
    reorder.mutate(ids)
  }

  return (
    <Card className="mb-6 overflow-hidden">
      <CardHeader
        icon={<Sparkles />}
        title="Routing rules"
        description="Evaluated top to bottom for every order, before the service strategy — skip degraded suppliers, prefer by carrier region, hold high-value unlocks. Drag the handle or use the arrows to reorder."
        actions={
          <Button size="sm" variant="secondary" leading={<Plus />} onClick={onNew}>
            New rule
          </Button>
        }
      />
      <div className="border-t border-line bg-surface-2/30 p-3 sm:p-4">
        {loading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[112px] rounded-xl" />
            ))}
          </div>
        ) : !order.length ? (
          <EmptyState icon={<Sparkles />} title="No routing rules" description="Without rules every service follows its strategy. Add a rule to prefer, exclude or hold suppliers by health, carrier region or amount." action={<Button size="sm" variant="primary" leading={<Plus />} onClick={onNew}>Create first rule</Button>} />
        ) : (
          <Reorder.Group axis="y" values={order} onReorder={setOrder} className="space-y-2.5">
            {order.map((id, i) => {
              const r = byId.get(id)
              if (!r) return null
              return (
                <RuleItem
                  key={id}
                  rule={r}
                  index={i}
                  count={order.length}
                  maxHits={maxHits}
                  providers={providers}
                  scope={scopeText(r.scope, services)}
                  busy={reorder.isPending}
                  onDragStart={() => (dragging.current = true)}
                  onDragEnd={commit}
                  onMove={(d) => move(id, d)}
                  onToggle={(v) => toggle.mutate({ id, enabled: v })}
                  onEdit={() => onEdit(r)}
                  onDelete={() => setDeleting(r)}
                />
              )
            })}
          </Reorder.Group>
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-line px-5 py-3 text-[12px] text-fg-3">
        <ArrowRight className="size-3.5" />
        After rules, the service strategy orders what remains. Disabled and outage suppliers are always skipped.
        <Link to="/admin/mappings" className="ml-auto hidden text-accent-ink hover:underline sm:inline">
          Mappings
        </Link>
      </div>
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        loading={remove.isPending}
        tone="danger"
        confirmLabel="Delete rule"
        title={`Delete “${deleting?.name}”?`}
        description="New orders stop being affected immediately. Orders already routed keep their chain. This is recorded in the audit log."
      />
    </Card>
  )
}

function RuleItem({
  rule: r,
  index,
  count,
  maxHits,
  providers,
  scope,
  busy,
  onDragStart,
  onDragEnd,
  onMove,
  onToggle,
  onEdit,
  onDelete,
}: {
  rule: RoutingRule
  index: number
  count: number
  maxHits: number
  providers: Map<string, Provider>
  scope: string
  busy: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onMove: (dir: -1 | 1) => void
  onToggle: (v: boolean) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const controls = useDragControls()
  return (
    <Reorder.Item value={r.id} dragListener={false} dragControls={controls} onDragStart={onDragStart} onDragEnd={onDragEnd} className="relative list-none" whileDrag={{ scale: 1.012, zIndex: 10 }}>
      <div className={cn('group flex gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-card transition-colors hover:border-line-strong sm:p-4', !r.enabled && 'bg-surface/70')}>
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <button type="button" onPointerDown={(e) => controls.start(e)} className="grid h-6 w-5 cursor-grab touch-none place-items-center rounded text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg active:cursor-grabbing" aria-label="Drag to reorder">
            <GripVertical className="size-4" />
          </button>
          <span className={cn('grid size-6 place-items-center rounded-md border font-mono text-[11px] font-semibold tabular', r.enabled ? 'border-line-strong bg-surface-2 text-fg' : 'border-transparent bg-surface-3 text-fg-3')}>{index + 1}</span>
        </div>
        <div className={cn('min-w-0 flex-1', !r.enabled && 'opacity-60')}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-semibold tracking-[-0.01em]">{r.name}</span>
            {!r.enabled && <Badge>Disabled</Badge>}
            <span className="font-mono text-[10.5px] text-fg-3">{r.id}</span>
          </div>
          {r.description && <p className="mt-0.5 text-[12.5px] leading-snug text-fg-3">{r.description}</p>}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 text-[10.5px] font-medium tracking-wider text-fg-3 uppercase">When</span>
            {r.conditions.length ? (
              r.conditions.map((c, i) => (
                <span key={i} className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-fg">
                  {conditionText(c)}
                </span>
              ))
            ) : (
              <span className="text-[11.5px] text-fg-2">always</span>
            )}
            <span className="mx-0.5 text-[10.5px] font-medium tracking-wider text-fg-3 uppercase">Then</span>
            <ActionPill action={r.action} providers={providers} />
            <span className="mx-0.5 text-[10.5px] font-medium tracking-wider text-fg-3 uppercase">Scope</span>
            <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[11.5px] text-fg-2">{scope}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end justify-between gap-2">
          <div className="flex items-center gap-1">
            <div className="hidden items-center sm:flex">
              <Button size="xs" variant="ghost" icon aria-label="Move up" disabled={index === 0 || busy} onClick={() => onMove(-1)}>
                <ChevronUp />
              </Button>
              <Button size="xs" variant="ghost" icon aria-label="Move down" disabled={index === count - 1 || busy} onClick={() => onMove(1)}>
                <ChevronDown />
              </Button>
            </div>
            <Switch size="sm" checked={r.enabled} onChange={onToggle} label={r.enabled ? 'Disable rule' : 'Enable rule'} />
            <Popover
              placement="bottom-end"
              trigger={({ toggle, open }) => (
                <Button size="xs" variant="ghost" icon aria-label="Rule actions" onClick={toggle} className={cn(open && 'bg-surface-2')}>
                  <MoreHorizontal />
                </Button>
              )}
            >
              {(close) => (
                <>
                  <MenuItem
                    icon={<Pencil />}
                    onClick={() => {
                      close()
                      onEdit()
                    }}
                  >
                    Edit rule
                  </MenuItem>
                  <MenuItem
                    icon={<ChevronUp />}
                    disabled={index === 0}
                    onClick={() => {
                      close()
                      onMove(-1)
                    }}
                  >
                    Move up
                  </MenuItem>
                  <MenuItem
                    icon={<ChevronDown />}
                    disabled={index === count - 1}
                    onClick={() => {
                      close()
                      onMove(1)
                    }}
                  >
                    Move down
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem
                    danger
                    icon={<Trash2 />}
                    onClick={() => {
                      close()
                      onDelete()
                    }}
                  >
                    Delete rule
                  </MenuItem>
                </>
              )}
            </Popover>
          </div>
          <Tooltip content="Orders whose routing this rule changed in the last 24 hours">
            <div className="w-[88px] text-right">
              <div className="text-[13px] font-semibold tabular">{num(r.hits24h)}</div>
              <div className="text-[10.5px] text-fg-3">hits · 24h</div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-fg/[0.06]">
                <div className="ml-auto h-full rounded-full bg-fg-3/60" style={{ width: `${(r.hits24h / maxHits) * 100}%` }} />
              </div>
            </div>
          </Tooltip>
        </div>
      </div>
    </Reorder.Item>
  )
}
