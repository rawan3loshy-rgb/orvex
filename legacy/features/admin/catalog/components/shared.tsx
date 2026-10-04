/**
 * Shared vocabulary, derivations and small presentational atoms for the
 * catalog area (services, providers, mappings, routing).
 */
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeft, CircleDollarSign, Hand, HeartPulse, Info, ListOrdered, Repeat, ShieldCheck, Timer, TriangleAlert, Zap } from 'lucide-react'
import { useProviders, useServices } from '@/hooks/installation'
import { cn } from '@/lib/cn'
import { duration, money, num } from '@/lib/format'
import { Skeleton } from '@/components/ui'
import type { Tone } from '@/types/common'
import type {
  DeliveryType,
  Provider,
  RoutingAction,
  RoutingCondition,
  RoutingConditionField,
  RoutingRule,
  RoutingStrategy,
  Service,
  ServiceCategory,
  ServiceMapping,
  ServiceStatus,
} from '@/types/installation'

/* ------------------------------------------------------------------------- */
/*  Vocabulary                                                               */
/* ------------------------------------------------------------------------- */

export const CATEGORIES: ServiceCategory[] = ['IMEI Services', 'Unlocking', 'Server Services', 'Codes', 'Other Services']

/** What each GSM category covers — used for section headers and hints. */
export const CATEGORY_META: Record<ServiceCategory, { blurb: string; delivery: DeliveryType }> = {
  'IMEI Services': { blurb: 'Instant IMEI intelligence — GSMA blacklist, carrier & SIM-lock, iCloud/FMI and warranty.', delivery: 'instant' },
  Unlocking: { blurb: 'Carrier network unlocks for iPhone, Samsung and Xiaomi — US, UK and EU networks.', delivery: 'async' },
  'Server Services': { blurb: 'Supplier-side processing — Samsung FRP, Xiaomi Mi Account, Apple GSX and MDM.', delivery: 'async' },
  Codes: { blurb: 'Unlock codes — NCK, MCK, SP and Subnet, calculated or supplier-issued.', delivery: 'async' },
  'Other Services': { blurb: 'Multi-brand warranty, HLR carrier lookup, band compatibility and serial checks.', delivery: 'instant' },
}

export const SERVICE_STATUSES: ServiceStatus[] = ['active', 'paused', 'draft', 'deprecated']

export const STATUS_META: Record<ServiceStatus, { label: string; description: string }> = {
  active: { label: 'Active', description: 'Accepting orders on the website and the Reseller API.' },
  paused: { label: 'Paused', description: 'Temporarily rejects new orders. In-flight orders complete.' },
  draft: { label: 'Draft', description: 'Hidden everywhere while you configure it.' },
  deprecated: { label: 'Deprecated', description: 'API only, flagged for removal. Hidden from the website.' },
}

export const DELIVERY: Record<DeliveryType, { label: string; description: string; icon: LucideIcon }> = {
  instant: { label: 'Instant', description: 'Result inside the API response in seconds — IMEI checks, calculators, lookups.', icon: Zap },
  async: { label: 'Async', description: 'Accepted immediately; the supplier processes it in minutes to hours. Result via webhook or polling.', icon: Timer },
  manual: { label: 'Manual', description: 'Fulfilled by an operator from the order queue.', icon: Hand },
}

/** "2s – 8s" for instant services, "1h – 6h" for async ones — always with the delivery label. */
export function deliveryLabel(s: Pick<Service, 'delivery' | 'turnaround'>) {
  return `${DELIVERY[s.delivery].label} · ${turnaroundLabel(s.turnaround)}`
}

export const STRATEGY_ORDER: RoutingStrategy[] = ['priority', 'lowest_cost', 'fastest', 'health_weighted', 'round_robin']

export const STRATEGIES: Record<RoutingStrategy, { label: string; tagline: string; description: string; icon: LucideIcon; color: string }> = {
  priority: {
    label: 'Priority',
    tagline: 'Fixed order with failover',
    description: 'Always submit to the P1 supplier first. On error or timeout Core fails over to P2, then P3.',
    icon: ListOrdered,
    color: 'var(--c2)',
  },
  lowest_cost: {
    label: 'Lowest cost',
    tagline: 'Maximise margin',
    description: 'Pick the cheapest healthy supplier for every order. Remaining suppliers become fallbacks, cheapest first.',
    icon: CircleDollarSign,
    color: 'var(--c3)',
  },
  fastest: {
    label: 'Fastest',
    tagline: 'Lowest response time',
    description: 'Rank suppliers by live p50 latency so instant IMEI checks answer as quickly as possible.',
    icon: Zap,
    color: 'var(--c4)',
  },
  health_weighted: {
    label: 'Health weighted',
    tagline: 'Availability first',
    description: 'Score suppliers on success rate, status and p95 latency. Degraded suppliers sink to the end of the chain.',
    icon: HeartPulse,
    color: 'var(--c5)',
  },
  round_robin: {
    label: 'Round robin',
    tagline: 'Spread the load',
    description: 'Rotate traffic evenly across healthy suppliers to keep several supplier accounts warm.',
    icon: Repeat,
    color: 'var(--c6)',
  },
}

export type Region = 'North America' | 'UK' | 'EU' | 'Europe' | 'APAC' | 'Middle East' | 'LATAM'

/** Carrier / order countries used by routing conditions and the simulator. */
export const COUNTRIES: { code: string; name: string; region: Region }[] = [
  { code: 'US', name: 'United States', region: 'North America' },
  { code: 'CA', name: 'Canada', region: 'North America' },
  { code: 'GB', name: 'United Kingdom', region: 'UK' },
  { code: 'DE', name: 'Germany', region: 'EU' },
  { code: 'FR', name: 'France', region: 'EU' },
  { code: 'NL', name: 'Netherlands', region: 'EU' },
  { code: 'ES', name: 'Spain', region: 'EU' },
  { code: 'IT', name: 'Italy', region: 'EU' },
  { code: 'SE', name: 'Sweden', region: 'EU' },
  { code: 'PL', name: 'Poland', region: 'EU' },
  { code: 'CH', name: 'Switzerland', region: 'Europe' },
  { code: 'TR', name: 'Türkiye', region: 'Europe' },
  { code: 'AE', name: 'United Arab Emirates', region: 'Middle East' },
  { code: 'SG', name: 'Singapore', region: 'APAC' },
  { code: 'BR', name: 'Brazil', region: 'LATAM' },
]

export const REGIONS = [
  'EU-West · Frankfurt',
  'EU-North · Stockholm',
  'EU-West · Dublin',
  'US-East · Virginia',
  'US-West · Oregon',
  'AP-Southeast · Singapore',
  'AP-Northeast · Tokyo',
  'ME-Central · Dubai',
]

/* ------------------------------------------------------------------------- */
/*  Chain / role derivations (mirror Core's routing engine)                  */
/* ------------------------------------------------------------------------- */

export type ChainRole = 'primary' | 'fallback' | 'emergency'
export const ROLES: ChainRole[] = ['primary', 'fallback', 'emergency']

/**
 * Chain colour sequence: coral marks the live primary path, graphite ink the
 * fallback, then sage and stone. `color` is for fills/strokes, `ink` for text
 * (coral text always uses the text-safe accent-ink).
 */
export const ROLE_META: Record<ChainRole, { label: string; color: string; ink: string; description: string }> = {
  primary: { label: 'Primary', color: 'var(--accent)', ink: 'var(--accent-ink)', description: 'Receives the order first.' },
  fallback: { label: 'Fallback', color: 'var(--accent-2)', ink: 'var(--accent-2)', description: 'Used if the primary fails or times out.' },
  emergency: { label: 'Emergency', color: 'var(--c3)', ink: 'var(--c3)', description: 'Last resort before the order fails.' },
}

export const PRIORITY_COLORS = ['var(--accent)', 'var(--accent-2)', 'var(--c3)', 'var(--c6)']
const PRIORITY_INK = ['var(--accent-ink)', 'var(--accent-2)', 'var(--c3)', 'var(--fg-3)']
const pIndex = (p: number) => Math.min(PRIORITY_COLORS.length - 1, Math.max(0, p - 1))
export const priorityColor = (p: number) => PRIORITY_COLORS[pIndex(p)]!
export const priorityInk = (p: number) => PRIORITY_INK[pIndex(p)]!

export function healthScore(p: Provider) {
  return p.successRate - (p.status === 'degraded' ? 30 : 0) - p.latencyP95 / 1000
}

export function isRoutable(p: Provider | undefined) {
  return !!p && p.status !== 'disabled' && p.status !== 'outage'
}

/** Order the eligible provider chain for a service the same way Core does. */
export function effectiveChain(mappings: ServiceMapping[], strategy: RoutingStrategy, providers: Map<string, Provider>) {
  const maps = mappings.filter((m) => m.enabled && isRoutable(providers.get(m.providerId)))
  const p = (m: ServiceMapping) => providers.get(m.providerId)!
  const sorted = maps.slice()
  switch (strategy) {
    case 'lowest_cost':
      sorted.sort((a, b) => a.cost - b.cost)
      break
    case 'fastest':
      sorted.sort((a, b) => p(a).latencyP50 - p(b).latencyP50)
      break
    case 'health_weighted':
      sorted.sort((a, b) => healthScore(p(b)) - healthScore(p(a)) || a.priority - b.priority)
      break
    default:
      sorted.sort((a, b) => a.priority - b.priority)
  }
  return sorted
}

export function roleOf(chain: ServiceMapping[], mappingId: string): ChainRole | 'standby' | null {
  const i = chain.findIndex((m) => m.id === mappingId)
  if (i < 0) return null
  return ROLES[i] ?? 'standby'
}

export function balanceState(p: Provider) {
  if (p.balance < p.lowBalanceThreshold) return { tone: 'danger' as const, label: 'Below threshold' }
  if (p.balance < p.lowBalanceThreshold * 1.5) return { tone: 'warning' as const, label: 'Near threshold' }
  return { tone: 'success' as const, label: 'Healthy' }
}

export function margin(price: number, cost: number) {
  const abs = price - cost
  return { abs, pct: price > 0 ? (abs / price) * 100 : 0, markup: cost > 0 ? (abs / cost) * 100 : 0 }
}

export function marginTone(p: number): Tone {
  return p >= 50 ? 'success' : p >= 25 ? 'neutral' : p > 0 ? 'warning' : 'danger'
}

export function turnaroundLabel(t: { min: number; max: number }) {
  return t.min === t.max ? duration(t.min) : `${duration(t.min)} – ${duration(t.max)}`
}

/* ------------------------------------------------------------------------- */
/*  Routing rule text                                                        */
/* ------------------------------------------------------------------------- */

export const CONDITION_FIELDS: Record<RoutingConditionField, { label: string; kind: 'number' | 'list'; unit?: '%' | 'ms' | '$' | 'h'; hint: string }> = {
  'provider.health': { label: 'Supplier health', kind: 'number', unit: '%', hint: 'Rolling 15-minute success rate' },
  'provider.latency_p95': { label: 'Supplier p95 latency', kind: 'number', unit: 'ms', hint: 'Milliseconds' },
  'provider.balance': { label: 'Supplier balance', kind: 'number', unit: '$', hint: 'Prepaid supplier credit in USD' },
  'order.country': { label: 'Order country', kind: 'list', hint: 'Carrier / device country, ISO codes, comma separated' },
  'order.amount': { label: 'Order amount', kind: 'number', unit: '$', hint: 'Order price in USD — e.g. high-value unlocks' },
  'reseller.group': { label: 'Reseller group', kind: 'list', hint: 'Pricing group ids — grp_standard, grp_professional, grp_enterprise' },
  'service.category': { label: 'Service category', kind: 'list', hint: 'IMEI Services, Unlocking, Server Services, Codes…' },
  'time.hour': { label: 'Hour of day', kind: 'number', unit: 'h', hint: '0–23, installation timezone' },
}

export const OPERATORS: Record<RoutingCondition['operator'], { symbol: string; label: string }> = {
  lt: { symbol: '<', label: 'less than' },
  gt: { symbol: '>', label: 'greater than' },
  eq: { symbol: '=', label: 'equals' },
  neq: { symbol: '≠', label: 'not equal' },
  in: { symbol: 'in', label: 'is one of' },
}

export function conditionValueText(c: RoutingCondition) {
  const meta = CONDITION_FIELDS[c.field]
  if (Array.isArray(c.value)) {
    const v = c.value
    return v.length > 4 ? `${v.slice(0, 3).join(', ')} +${v.length - 3}` : v.join(', ')
  }
  const n = Number(c.value)
  if (meta.unit === '%') return `${c.value}%`
  if (meta.unit === 'ms') return `${num(n)}ms`
  if (meta.unit === '$') return money(n).replace('.00', '')
  if (meta.unit === 'h') return `${String(n).padStart(2, '0')}:00`
  return String(c.value)
}

export function conditionText(c: RoutingCondition) {
  return `${c.field} ${OPERATORS[c.operator].symbol} ${conditionValueText(c)}`
}

export const ACTIONS: Record<RoutingAction['type'], { label: string; description: string }> = {
  prefer_provider: { label: 'Prefer supplier', description: 'Move a supplier to the front of the chain.' },
  exclude_provider: { label: 'Exclude supplier', description: 'Remove matching suppliers from the chain.' },
  set_strategy: { label: 'Set strategy', description: 'Override the service routing strategy.' },
  hold_for_review: { label: 'Hold for review', description: 'Park the order for manual approval.' },
  set_timeout: { label: 'Set timeout', description: 'Fail over sooner than the supplier default.' },
}

export function actionText(a: RoutingAction, providers?: Map<string, Provider>) {
  const name = a.providerId ? (providers?.get(a.providerId)?.shortName ?? a.providerId) : null
  switch (a.type) {
    case 'prefer_provider':
      return `Prefer ${name ?? 'supplier'}`
    case 'exclude_provider':
      return name ? `Exclude ${name}` : 'Exclude matching supplier'
    case 'set_strategy':
      return `Strategy → ${a.strategy ? STRATEGIES[a.strategy].label : '—'}`
    case 'hold_for_review':
      return 'Hold for manual review'
    case 'set_timeout':
      return `Timeout → ${((a.value ?? 0) / 1000).toFixed(a.value && a.value % 1000 ? 1 : 0)}s`
  }
}

const ACTION_TONE: Record<RoutingAction['type'], string> = {
  prefer_provider: 'bg-accent/10 text-accent-ink',
  exclude_provider: 'bg-danger/10 text-danger',
  hold_for_review: 'bg-warning/12 text-warning',
  set_strategy: 'bg-fg/6 text-fg',
  set_timeout: 'bg-fg/6 text-fg',
}

/** Rule outcome chip — coral only when the rule steers the live route to a supplier. */
export function ActionPill({ action, providers, className }: { action: RoutingAction; providers?: Map<string, Provider>; className?: string }) {
  return <span className={cn('rounded-md px-1.5 py-0.5 text-[11.5px] font-medium whitespace-nowrap', ACTION_TONE[action.type], className)}>{actionText(action, providers)}</span>
}

export function scopeText(scope: RoutingRule['scope'], services?: Map<string, Service>) {
  if (scope.serviceIds === 'all') return scope.categories?.length ? `All ${scope.categories.join(' & ')} services` : 'All services'
  if (scope.serviceIds.length === 1) return services?.get(scope.serviceIds[0]!)?.name ?? scope.serviceIds[0]!
  return `${scope.serviceIds.length} services`
}

/** Does a rule apply to a given service (scope only, ignoring conditions)? */
export function ruleInScope(r: RoutingRule, s: Service) {
  if (r.scope.serviceIds === 'all') return !r.scope.categories?.length || r.scope.categories.includes(s.category)
  return r.scope.serviceIds.includes(s.id)
}

/* ------------------------------------------------------------------------- */
/*  Lookups                                                                  */
/* ------------------------------------------------------------------------- */

export function useProviderMap() {
  const q = useProviders()
  const map = useMemo(() => new Map((q.data ?? []).map((p) => [p.id, p])), [q.data])
  return { ...q, map }
}

export function useServiceMap() {
  const q = useServices()
  const map = useMemo(() => new Map((q.data ?? []).map((s) => [s.id, s])), [q.data])
  return { ...q, map }
}

export function groupBy<T, K>(items: T[] | undefined, key: (t: T) => K) {
  const m = new Map<K, T[]>()
  for (const it of items ?? []) {
    const k = key(it)
    const arr = m.get(k)
    if (arr) arr.push(it)
    else m.set(k, [it])
  }
  return m
}

/* ------------------------------------------------------------------------- */
/*  Atoms                                                                    */
/* ------------------------------------------------------------------------- */

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-1.5 text-[12.5px] text-fg-3 transition-colors hover:text-fg">
      <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
      {children}
    </Link>
  )
}

export function PriorityChip({ priority, className }: { priority: number; className?: string }) {
  const color = priorityColor(priority)
  return (
    <span
      className={cn('inline-flex h-5 items-center rounded-md px-1.5 font-mono text-[10.5px] font-semibold tabular', className)}
      style={{ color: priorityInk(priority), background: `color-mix(in oklab, ${color} 12%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 28%, transparent)` }}
    >
      P{priority}
    </span>
  )
}

export function RoleBadge({ role, className }: { role: ChainRole | 'standby'; className?: string }) {
  const meta = role === 'standby' ? { label: 'Standby', color: 'var(--fg-3)', ink: 'var(--fg-3)' } : ROLE_META[role]
  return (
    <span
      className={cn('inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-[11px] font-medium whitespace-nowrap', className)}
      style={{ color: meta.ink, background: `color-mix(in oklab, ${meta.color} 11%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${meta.color} 24%, transparent)` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  )
}

export interface MetricItem {
  label: ReactNode
  value: ReactNode
  sub?: ReactNode
  tone?: Tone
  icon?: ReactNode
}

const toneText: Record<Tone, string> = { neutral: 'text-fg', accent: 'text-accent-ink', success: 'text-success', warning: 'text-warning', danger: 'text-danger', info: 'text-info' }

/** A single card with evenly divided metric cells. */
export function MetricStrip({ items, loading, className, cols }: { items: MetricItem[]; loading?: boolean; className?: string; cols?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-line bg-surface shadow-card', className)}>
      <div className={cn('-mr-px -mb-px grid', cols ?? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5')}>
        {items.map((it, i) => (
          <div key={i} className="min-w-0 border-r border-b border-line px-4 py-3.5 sm:px-5 sm:py-4">
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-fg-3 [&_svg]:size-3.5">
              {it.icon}
              <span className="truncate">{it.label}</span>
            </div>
            {loading ? (
              <Skeleton className="mt-2.5 h-6 w-20" />
            ) : (
              <div className={cn('mt-1.5 truncate font-display text-[22px] leading-tight font-semibold tracking-[-0.02em] tabular', toneText[it.tone ?? 'neutral'])}>{it.value}</div>
            )}
            {it.sub && !loading && <div className="mt-0.5 truncate text-[12px] text-fg-3">{it.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

const calloutTone: Record<Tone, string> = {
  neutral: 'border-line bg-surface-2/60 [&_.ci]:text-fg-3',
  accent: 'border-accent/25 bg-accent/[0.05] [&_.ci]:text-accent-ink',
  info: 'border-info/25 bg-info/[0.05] [&_.ci]:text-info',
  success: 'border-success/25 bg-success/[0.05] [&_.ci]:text-success',
  warning: 'border-warning/30 bg-warning/[0.06] [&_.ci]:text-warning',
  danger: 'border-danger/25 bg-danger/[0.05] [&_.ci]:text-danger',
}

export function Callout({ tone = 'neutral', title, children, icon, className, action }: { tone?: Tone; title?: ReactNode; children?: ReactNode; icon?: ReactNode; className?: string; action?: ReactNode }) {
  const Icon = tone === 'warning' || tone === 'danger' ? TriangleAlert : tone === 'success' ? ShieldCheck : Info
  return (
    <div className={cn('flex items-start gap-3 rounded-xl border px-4 py-3', calloutTone[tone], className)}>
      <span className="ci mt-0.5 shrink-0 [&_svg]:size-4">{icon ?? <Icon />}</span>
      <div className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-fg-2">
        {title && <div className="mb-0.5 text-[13px] font-medium text-fg">{title}</div>}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/** Cost vs margin split of a price — a tiny proportional bar. */
export function MarginBar({ price, cost, className, height = 6 }: { price: number; cost: number; className?: string; height?: number }) {
  const c = price > 0 ? Math.min(100, (cost / price) * 100) : 100
  const neg = cost > price
  return (
    <div className={cn('flex w-full overflow-hidden rounded-full bg-fg/6', className)} style={{ height }}>
      <div className="h-full bg-fg/25 transition-[width] duration-700" style={{ width: `${c}%` }} />
      {!neg && <div className="h-full bg-success/80 transition-[width] duration-700" style={{ width: `${100 - c}%` }} />}
    </div>
  )
}

/** Small label/value pair used inside dense cards. */
export function MiniStat({ label, value, className, tone }: { label: ReactNode; value: ReactNode; className?: string; tone?: Tone }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="truncate text-[11px] text-fg-3">{label}</div>
      <div className={cn('truncate text-[13px] font-medium tabular', toneText[tone ?? 'neutral'])}>{value}</div>
    </div>
  )
}

export function KeyValue({ k, v, mono, className }: { k: ReactNode; v: ReactNode; mono?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-4 py-2 text-[12.5px]', className)}>
      <span className="text-fg-3">{k}</span>
      <span className={cn('min-w-0 truncate text-right text-fg', mono && 'font-mono text-[12px]')}>{v}</span>
    </div>
  )
}

/** Deterministic 0..1 noise from a string (stable demo variance without randomness). */
export function hashUnit(s: string, salt = 0) {
  let h = 2166136261 ^ salt
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}
