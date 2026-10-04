import { useMemo, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, Network, Split, TriangleAlert, Wallet } from 'lucide-react'
import { useHealth, useProviders } from '@/hooks/installation'
import { Button, Card, CardHeader, EmptyState, Skeleton, StatusBadge, Tooltip } from '@/components/ui'
import { ProviderMark } from '@/components/brand'
import { cn } from '@/lib/cn'
import { ago, money, ms, num, pct } from '@/lib/format'
import type { HealthSnapshot, Provider } from '@/types/installation'
import { deriveFlow, deriveProviderLoads, useOrderWindow, type ProviderLoad } from './ops'
import { TickMeter } from './parts'

/*
 * The card is a size container. Narrow (hero side panel, phones): two-line rows
 * with labelled metrics. ≥ 620px: one-line table rows under a header.
 */
const COLS = '@min-[620px]:grid-cols-[minmax(0,1.7fr)_minmax(96px,0.8fr)_76px_62px_54px_minmax(104px,1fr)]'

export function ProviderNetwork({ className }: { className?: string }) {
  const providers = useProviders()
  const health = useHealth()
  const { orders } = useOrderWindow()
  const list = useMemo(() => providers.data ?? [], [providers.data])
  const loads = useMemo(() => deriveProviderLoads(list, orders), [list, orders])
  const flow = useMemo(() => deriveFlow(orders), [orders])
  const operational = list.filter((p) => p.status === 'operational').length
  const inFlight = [...loads.values()].reduce((a, l) => a + l.inFlight, 0)

  return (
    <Card className={cn('@container flex flex-col overflow-hidden', className)}>
      <CardHeader
        title="Provider network"
        description={providers.data ? `${operational} of ${list.length} suppliers operational · ${num(inFlight)} orders in flight` : 'Connecting to supplier adapters…'}
        icon={<Network />}
        actions={
          <Button size="xs" variant="ghost" to="/admin/providers" trailing={<ArrowRight />}>
            All
          </Button>
        }
      />
      <div className={cn('hidden items-center gap-x-3 border-t border-line bg-surface-2/40 px-5 py-2 @min-[620px]:grid', COLS)}>
        <span className="mono-label">Provider</span>
        <span className="mono-label">Status</span>
        <span className="mono-label">Latency</span>
        <span className="mono-label text-right">Success</span>
        <span className="mono-label text-right">24h</span>
        <span className="mono-label">Load</span>
      </div>
      <div className="flex-1 divide-y divide-line border-t border-line">
        {providers.isLoading && Array.from({ length: 5 }, (_, i) => <RowSkeleton key={i} />)}
        {providers.data && list.length === 0 && (
          <EmptyState
            compact
            icon={<Network />}
            title="No suppliers connected"
            description="Connect a supplier API to start routing IMEI checks, unlocks and server jobs."
            action={
              <Button size="sm" variant="secondary" to="/admin/providers">
                Connect provider
              </Button>
            }
          />
        )}
        {list.map((p) => (
          <ProviderRow key={p.id} p={p} load={loads.get(p.id)} incident={incidentFor(p, health.data)} />
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-line px-5 py-3 text-[12px] text-fg-3">
        <Link to="/admin/orders?fallback=1&range=24h" className="flex min-w-0 items-center gap-1.5 transition-colors hover:text-fg">
          <Split className="size-3.5 shrink-0" />
          <span className="truncate">
            {num(flow.fallbacks)} auto-fallbacks in 24h · {num(flow.recovered)} recovered
          </span>
        </Link>
        <Link to="/admin/routing" className="flex items-center gap-1 transition-colors hover:text-fg">
          Routing rules <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </Card>
  )
}

function incidentFor(p: Provider, h: HealthSnapshot | undefined) {
  return h?.incidents.find((i) => i.status !== 'resolved' && i.component === p.name) ?? null
}

function ProviderRow({ p, load, incident }: { p: Provider; load: ProviderLoad | undefined; incident: HealthSnapshot['incidents'][number] | null }) {
  const navigate = useNavigate()
  const impaired = p.status === 'degraded' || p.status === 'outage'
  const lowWallet = p.balance < p.lowBalanceThreshold
  const region = p.region.split(' · ')[0]
  return (
    <button
      type="button"
      onClick={() => navigate(`/admin/providers/${p.id}`)}
      aria-label={`${p.name} — ${p.status}. Open provider`}
      className={cn('group relative grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 px-5 py-3 text-left transition-colors hover:bg-surface-2/60 @min-[620px]:gap-y-2', COLS)}
    >
      {impaired && <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-warning/70" />}
      <span className="flex min-w-0 items-center gap-3">
        <ProviderMark id={p.id} name={p.name} />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium text-fg">{p.name}</span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11.5px] text-fg-3">
            <span className="truncate">
              {p.protocol} · {region}
            </span>
            {lowWallet && (
              <Tooltip content={`Supplier wallet ${money(p.balance)} — below the ${money(p.lowBalanceThreshold)} alert threshold`}>
                <span className="inline-flex shrink-0 items-center gap-1 text-warning">
                  <Wallet className="size-3" /> low
                </span>
              </Tooltip>
            )}
          </span>
        </span>
      </span>
      <span className="justify-self-end @min-[620px]:justify-self-start">
        <StatusBadge status={p.status} noPulse />
      </span>
      <span className="col-span-2 grid grid-cols-2 gap-x-4 gap-y-3 @min-[400px]:grid-cols-4 @min-[620px]:contents">
        <Metric label="Latency">
          <span className={cn('block font-mono text-[12.5px] text-fg tabular', p.latencyP50 >= 600 && 'text-warning')}>{ms(p.latencyP50)}</span>
          <span className="block text-[11px] text-fg-3 tabular">p95 {ms(p.latencyP95)}</span>
        </Metric>
        <Metric label="Success" right>
          <span className={cn('block text-[12.5px] font-medium tabular', p.successRate < 95 ? 'text-warning' : 'text-fg')}>{pct(p.successRate)}</span>
          <span className="block text-[11px] text-fg-3 tabular @min-[620px]:hidden">{p.uptime30d.toFixed(2)}% up</span>
        </Metric>
        <Metric label="Orders 24h" right>
          <span className="block text-[12.5px] font-medium text-fg tabular">{num(p.orders24h)}</span>
          <span className="block text-[11px] text-fg-3 tabular @min-[620px]:hidden">{p.servicesCount} services</span>
        </Metric>
        <Metric label="Load">{load ? <LoadCell p={p} load={load} /> : <Skeleton className="h-6 w-full" />}</Metric>
      </span>
      {impaired && (
        <span className="col-span-full flex min-w-0 items-start gap-1.5 text-[11.5px] leading-snug text-fg-3">
          <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning" />
          <span className="min-w-0">
            {incident
              ? `${incident.title
                  .replace(p.name, '')
                  .trim()
                  .replace(/^./, (c) => c.toUpperCase())} · ${incident.status} for ${ago(incident.startedAt)}`
              : 'Reduced capacity'}{' '}
            — health-weighted routing is shifting traffic to fallback suppliers.
          </span>
        </span>
      )}
    </button>
  )
}

function Metric({ label, right, children }: { label: string; right?: boolean; children: ReactNode }) {
  return (
    <span className={cn('block min-w-0', right && '@min-[620px]:text-right')}>
      <span className="mono-label mb-1 block @min-[620px]:hidden">{label}</span>
      {children}
    </span>
  )
}

function LoadCell({ p, load }: { p: Provider; load: ProviderLoad }) {
  const rate = `${num(p.rateLimit.requests)} req/${p.rateLimit.per === 'second' ? 's' : 'min'}`
  const tip = (
    <span>
      <span className="font-medium">{num(load.inFlight)} in flight</span> ({num(load.awaiting)} awaiting reply) · {num(load.submissionsLastHour)} submissions in the last hour.
      <br />
      Capacity {load.slots} concurrent slots from the {rate} rate limit
      {p.status === 'degraded' ? ', halved while degraded' : ''}.
    </span>
  )
  return (
    <Tooltip content={tip} className="flex w-full">
      <span className="block w-full">
        <span className="flex items-baseline justify-between gap-2 text-[11.5px] tabular">
          <span className="font-medium text-fg">{Math.round(load.ratio * 100)}%</span>
          <span className="text-fg-3">
            {num(load.inFlight)}/{load.slots}
          </span>
        </span>
        <TickMeter ratio={load.ratio} className="mt-1" />
      </span>
    </Tooltip>
  )
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <Skeleton className="size-8 rounded-lg" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-2.5 w-24" />
      </div>
      <Skeleton className="h-5 w-20 rounded-full" />
    </div>
  )
}
