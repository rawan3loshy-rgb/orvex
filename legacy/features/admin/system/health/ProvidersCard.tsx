import { Link } from 'react-router'
import { ArrowRight, PlugZap } from 'lucide-react'
import { Badge, Card, CardHeader, Skeleton, StatusBadge, Tooltip } from '@/components/ui'
import { ProviderMark } from '@/components/brand'
import { useProviders } from '@/hooks/installation'
import { cn } from '@/lib/cn'
import { dateShort, ms, pct } from '@/lib/format'
import type { Provider } from '@/types/installation'
import { SUPPLIER_ROLE } from './meta'

const DAYS = 21

const TICK: Record<Provider['status'], string> = {
  operational: 'bg-success/55',
  degraded: 'bg-warning',
  outage: 'bg-danger',
  disabled: 'bg-line-strong',
}

/**
 * Supplier connectivity. External supplier health is deliberately kept out of
 * installation health: a degraded supplier is routed around, it does not make
 * Core unhealthy.
 */
export function ProvidersCard() {
  const providers = useProviders()
  const list = providers.data ?? []
  const active = list.filter((p) => p.status !== 'disabled')
  const affected = active.filter((p) => p.status !== 'operational')
  const up = active.length - affected.length

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        icon={<PlugZap />}
        title="Supplier connectivity"
        description={
          providers.isLoading
            ? 'Checking supplier APIs…'
            : affected.length
              ? `${affected.map((p) => p.shortName).join(', ')} ${affected.length === 1 ? 'is' : 'are'} degraded — routing fails over to the next supplier automatically.`
              : 'All connected suppliers are answering normally.'
        }
        actions={
          list.length > 0 && (
            <Badge tone={affected.length ? 'warning' : 'success'} dot>
              {up}/{active.length} up
            </Badge>
          )
        }
      />
      <div className="flex-1 px-2 pb-2">
        {providers.isLoading
          ? Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <Skeleton className="size-7 rounded-md" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="h-3 w-48 max-w-full" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            ))
          : list.map((p) => {
              const ticks = p.uptimeHistory.slice(-DAYS)
              return (
                <Link
                  key={p.id}
                  to={`/admin/providers/${p.id}`}
                  className={cn('group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-2', p.status === 'degraded' && 'bg-warning/5 hover:bg-warning/8')}
                >
                  <ProviderMark id={p.id} name={p.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-fg">{p.name}</p>
                    <p className="truncate text-[11.5px] text-fg-3">
                      {SUPPLIER_ROLE[p.id] ?? p.protocol}
                      <span className="text-fg-3/60"> · </span>
                      <span className="font-mono tabular">
                        {pct(p.uptime30d, 2)} · p50 {ms(p.latencyP50)}
                      </span>
                    </p>
                  </div>
                  {ticks.length > 0 && (
                    <Tooltip content={`Daily uptime · last ${ticks.length} days (${dateShort(ticks[0]!.date)} – ${dateShort(ticks.at(-1)!.date)})`}>
                      <span aria-hidden className="hidden h-5 items-end gap-px sm:flex">
                        {ticks.map((t) => (
                          <span key={t.date} className={cn('w-0.75 rounded-[1px]', TICK[t.status])} style={{ height: `${Math.max(30, Math.min(100, (t.uptime - 97) * 33))}%` }} />
                        ))}
                      </span>
                    </Tooltip>
                  )}
                  <StatusBadge status={p.status} />
                </Link>
              )
            })}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-[12px] text-fg-3">
        <span>Monitored per supplier — never counted in installation health.</span>
        <Link to="/admin/providers" className="inline-flex shrink-0 items-center gap-1 font-medium text-accent-ink hover:underline">
          Providers <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </Card>
  )
}
