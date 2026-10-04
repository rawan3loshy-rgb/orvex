import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { Activity, Gauge, PlugZap, Plus, Puzzle, ServerCog, TriangleAlert, Wallet } from 'lucide-react'
import { ProviderMark, categoryColor } from '@/components/brand'
import { UptimeBars } from '@/components/charts'
import { Badge, Button, Card, DemoTag, Dot, PageHeader, Skeleton, StatusBadge, Tooltip } from '@/components/ui'
import { useMappings, useProviders, useRoutingRules } from '@/hooks/installation'
import { cn } from '@/lib/cn'
import { dateShort, money, ms, num, pct, plural, relative } from '@/lib/format'
import type { Provider, ServiceCategory } from '@/types/installation'
import { ConnectProviderDrawer } from './components/ConnectProviderDrawer'
import { CATEGORIES, Callout, MetricStrip, balanceState, useServiceMap } from './components/shared'

interface Footprint {
  categories: { c: ServiceCategory; n: number }[]
  primary: number
  fallback: number
  /** Active services that would lose their P1 supplier if this one went down. */
  primaryNames: string[]
}

export default function ProvidersPage() {
  const navigate = useNavigate()
  const q = useProviders()
  const rules = useRoutingRules()
  const mappings = useMappings()
  const { map: services } = useServiceMap()
  const [connecting, setConnecting] = useState(false)
  const list = q.data ?? []

  // What each supplier actually fulfils — derived from the service ↔ supplier mappings.
  const footprint = useMemo(() => {
    const out = new Map<string, Footprint>()
    for (const m of mappings.data ?? []) {
      const s = services.get(m.serviceId)
      if (!s) continue
      const f = out.get(m.providerId) ?? { categories: [], primary: 0, fallback: 0, primaryNames: [] }
      const c = f.categories.find((x) => x.c === s.category)
      if (c) c.n++
      else f.categories.push({ c: s.category, n: 1 })
      if (m.enabled && m.priority === 1) {
        f.primary++
        f.primaryNames.push(s.name)
      } else if (m.enabled) f.fallback++
      out.set(m.providerId, f)
    }
    for (const f of out.values()) f.categories.sort((a, b) => b.n - a.n || CATEGORIES.indexOf(a.c) - CATEGORIES.indexOf(b.c))
    return out
  }, [mappings.data, services])

  const stats = useMemo(() => {
    const operational = list.filter((p) => p.status === 'operational').length
    const degraded = list.filter((p) => p.status === 'degraded').length
    const outage = list.filter((p) => p.status === 'outage').length
    const disabled = list.filter((p) => p.status === 'disabled').length
    const active = list.filter((p) => p.status !== 'disabled')
    const p50 = active.length ? active.reduce((a, p) => a + p.latencyP50, 0) / active.length : 0
    const p95 = active.length ? active.reduce((a, p) => a + p.latencyP95, 0) / active.length : 0
    const balance = list.reduce((a, p) => a + p.balance, 0)
    const low = list.filter((p) => balanceState(p).tone !== 'success').length
    const custom = list.filter((p) => p.adapterId.startsWith('ext.')).length
    const adapters = new Set(list.map((p) => p.adapterId)).size
    return { operational, degraded, outage, disabled, p50, p95, balance, low, custom, adapters }
  }, [list])

  const degraded = list.filter((p) => p.status === 'degraded' || p.status === 'outage')
  const skipRule = rules.data?.find((r) => r.enabled && r.action.type === 'exclude_provider' && r.conditions.some((c) => c.field === 'provider.health'))

  return (
    <div>
      <PageHeader
        icon={<PlugZap />}
        title="Providers"
        description="GSM supplier APIs — unlock, IMEI-check, code and server-service suppliers — connected through adapter extensions. Credentials are encrypted at rest and never leave this installation."
        actions={
          <Button variant="accent" leading={<Plus />} onClick={() => setConnecting(true)}>
            Connect provider
          </Button>
        }
      />

      <MetricStrip
        className="mb-5"
        cols="grid-cols-2 lg:grid-cols-4"
        loading={q.isLoading}
        items={[
          { label: 'Connected suppliers', icon: <ServerCog />, value: list.length, sub: `${plural(stats.adapters, 'adapter')} · ${stats.custom} custom extension` },
          {
            label: 'Operational vs degraded',
            icon: <Activity />,
            value: (
              <span>
                <span className="text-success">{stats.operational}</span>
                <span className="mx-1.5 text-[16px] text-fg-3">/</span>
                <span className={stats.degraded + stats.outage ? 'text-warning' : 'text-fg-3'}>{stats.degraded + stats.outage}</span>
              </span>
            ),
            sub: stats.disabled ? `${stats.disabled} disabled` : stats.degraded ? `${stats.degraded} degraded right now` : 'All systems normal',
          },
          { label: 'Avg latency · p50', icon: <Gauge />, value: ms(stats.p50), sub: `p95 average ${ms(stats.p95)}` },
          { label: 'Supplier credit', icon: <Wallet />, value: money(stats.balance, { compact: true }), sub: stats.low ? `${stats.low} supplier${stats.low === 1 ? '' : 's'} near or below threshold` : 'All prepaid balances funded', tone: stats.low ? 'warning' : undefined },
        ]}
      />

      {degraded.map((p) => (
        <Callout
          key={p.id}
          tone="warning"
          className="mb-5"
          title={`${p.name} is ${p.status}${p.id === 'prv_gsmsolutions' ? ' — elevated timeouts on its XML gateway in the last 36h' : ''}`}
          action={
            <Button size="sm" variant="secondary" to={`/admin/providers/${p.id}?tab=health`}>
              Investigate
            </Button>
          }
        >
          Success rate {pct(p.successRate)} · p50 {ms(p.latencyP50)}
          {footprint.get(p.id) ? ` · mapped to ${plural(footprint.get(p.id)!.primary + footprint.get(p.id)!.fallback, 'service')} (P1 for ${footprint.get(p.id)!.primary})` : ''}.{' '}
          {skipRule ? (
            <>
              Routing rule <Link to="/admin/routing" className="font-medium text-fg hover:underline">“{skipRule.name}”</Link> is failing its unlock and code orders over to healthy suppliers automatically.
            </>
          ) : (
            'Consider lowering its priority in affected services.'
          )}
        </Callout>
      ))}

      <div className="grid gap-4 lg:grid-cols-2">
        {q.isLoading
          ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[330px] rounded-xl" />)
          : list.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}>
                <ProviderCard provider={p} footprint={footprint.get(p.id)} onOpen={() => navigate(`/admin/providers/${p.id}`)} />
              </motion.div>
            ))}
        {!q.isLoading && (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: list.length * 0.05 + 0.1 }}
            onClick={() => setConnecting(true)}
            className="group flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-surface/40 p-6 text-center transition-colors hover:border-accent/50 hover:bg-accent/[0.03]"
          >
            <span className="grid size-11 place-items-center rounded-xl border border-dashed border-line-strong text-fg-3 transition-colors group-hover:border-accent/50 group-hover:text-accent-ink">
              <Plus className="size-5" />
            </span>
            <span className="mt-3 text-[14px] font-semibold">{list.length ? 'Connect another supplier' : 'Connect your first supplier'}</span>
            <span className="mt-1 max-w-xs text-[12.5px] text-fg-3">REST / JSON, DHRU-compatible XML, GraphQL or a custom adapter extension — Core stays untouched.</span>
          </motion.button>
        )}
      </div>

      {!q.isLoading && (
        <p className="mt-4 flex items-center gap-2 text-[11.5px] text-fg-3">
          <DemoTag /> Suppliers, balances and hostnames are fictional demo data.
        </p>
      )}

      <ConnectProviderDrawer open={connecting} onClose={() => setConnecting(false)} />
    </div>
  )
}

function ProviderCard({ provider: p, footprint, onOpen }: { provider: Provider; footprint?: Footprint; onOpen: () => void }) {
  const bal = balanceState(p)
  const custom = p.adapterId.startsWith('ext.')
  const ratio = Math.min(1, p.balance / (p.lowBalanceThreshold * 4))
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} className="h-full">
      <Card interactive onClick={onOpen} role="link" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()} className="group flex h-full flex-col overflow-hidden">
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60" style={{ background: `linear-gradient(90deg, transparent, ${p.color}, transparent)` }} />
        <div className="flex items-start gap-3.5 p-5 pb-4">
          <ProviderMark id={p.id} name={p.name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em]">{p.name}</h3>
              {custom && (
                <Tooltip content={`Custom adapter extension ${p.adapterId}`}>
                  <Badge variant="outline" icon={<Puzzle />}>
                    Custom adapter
                  </Badge>
                </Tooltip>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-fg-3">
              <span>{p.protocol === 'SOAP / XML' ? 'DHRU-compatible XML' : p.protocol}</span>
              <span>·</span>
              <span className="font-mono text-[11.5px]">{p.adapterId}</span>
              <span>·</span>
              <span>{p.region}</span>
            </div>
          </div>
          <StatusBadge status={p.status} size="md" />
        </div>

        <p className="-mt-1 line-clamp-2 px-5 text-[12.5px] leading-snug text-fg-2">{p.description}</p>

        <div className="flex flex-wrap items-center gap-1.5 px-5 pt-3 pb-4">
          {footprint?.categories.length ? (
            footprint.categories.map((c) => (
              <span key={c.c} className="inline-flex h-6 items-center gap-1.5 rounded-md border border-line bg-surface-2/60 px-2 text-[11.5px] text-fg-2">
                <span className="size-1.5 rounded-full" style={{ background: categoryColor(c.c) }} />
                {c.c}
                <span className="font-mono text-[10.5px] text-fg-3 tabular">{c.n}</span>
              </span>
            ))
          ) : (
            <span className="text-[12px] text-fg-3">Not mapped to any service yet</span>
          )}
          {footprint && footprint.primary > 0 && (
            <Tooltip content={`Primary supplier for ${footprint.primaryNames.join(', ')}`}>
              <span className="ml-auto inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11.5px] text-fg-3">
                P1 for <span className="font-medium text-fg tabular">{footprint.primary}</span> · fallback for <span className="font-medium text-fg tabular">{footprint.fallback}</span>
              </span>
            </Tooltip>
          )}
        </div>

        <div className="grid grid-cols-3 gap-y-3 px-5 pb-4 sm:grid-cols-5">
          <Metric label="Uptime 30d" value={pct(p.uptime30d, 2)} tone={p.uptime30d >= 99.9 ? 'text-success' : p.uptime30d >= 99 ? 'text-fg' : 'text-warning'} />
          <Metric label="Latency p50" value={num(p.latencyP50)} unit="ms" tone={p.latencyP50 > 600 ? 'text-warning' : undefined} />
          <Metric label="Success" value={pct(p.successRate)} tone={p.successRate < 95 ? 'text-warning' : undefined} />
          <Metric label="Orders 24h" value={num(p.orders24h)} />
          <Metric label="Services" value={num(p.servicesCount)} />
        </div>

        <div className="px-5 pb-4">
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-fg-3">
            <span>90-day uptime</span>
            <span className="tabular">{pct(p.uptimeHistory.reduce((a, h) => a + h.uptime, 0) / Math.max(1, p.uptimeHistory.length), 2)} avg</span>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <UptimeBars height={26} items={p.uptimeHistory.map((h) => ({ label: dateShort(h.date), value: h.uptime, status: h.status }))} />
          </div>
          <div className="mt-1 flex justify-between font-mono text-[10px] text-fg-3">
            <span>90 days ago</span>
            <span>Today</span>
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-3 border-t border-line bg-surface-2/40 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[12px]">
              <Wallet className="size-3.5 text-fg-3" />
              <span className="text-fg-3">Credit</span>
              <span className="font-semibold text-fg tabular">{money(p.balance)}</span>
              {bal.tone !== 'success' && (
                <Badge tone={bal.tone} icon={<TriangleAlert />}>
                  {bal.label}
                </Badge>
              )}
            </div>
            <div className="relative mt-1.5 h-1 w-full max-w-[260px] overflow-hidden rounded-full bg-fg/[0.07]">
              <span className={cn('absolute inset-y-0 left-0 rounded-full', bal.tone === 'success' ? 'bg-success/70' : bal.tone === 'warning' ? 'bg-warning' : 'bg-danger')} style={{ width: `${ratio * 100}%` }} />
              <span className="absolute inset-y-[-2px] w-px bg-fg-2" style={{ left: '25%' }} title={`Low-balance threshold ${money(p.lowBalanceThreshold)}`} />
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 text-[11.5px] text-fg-3">
            <Dot tone={p.status === 'operational' ? 'success' : p.status === 'degraded' ? 'warning' : 'danger'} pulse />
            Health check {relative(p.lastCheckAt)}
          </span>
        </div>
      </Card>
    </motion.div>
  )
}

function Metric({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[11px] text-fg-3">{label}</div>
      <div className={cn('mt-0.5 truncate text-[14px] font-semibold tabular', tone ?? 'text-fg')}>
        {value}
        {unit && <span className="ml-0.5 text-[11px] font-normal text-fg-3">{unit}</span>}
      </div>
    </div>
  )
}
