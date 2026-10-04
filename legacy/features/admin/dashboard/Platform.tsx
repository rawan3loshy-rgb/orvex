import { useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { ArrowRight, CloudDownload, Database, Gauge, HardDrive, Inbox, KeyRound, Layers, PlugZap, ReceiptText, Server, ShieldCheck, Tags, UserRound, Users, Webhook, Workflow } from 'lucide-react'
import { useActivity, useHealth, useOrders, useProviders, useServices } from '@/hooks/installation'
import { Button, Card, CardHeader, Dot, EmptyState, Skeleton, StatusBadge, Tooltip } from '@/components/ui'
import { ProviderMark, ServiceIcon } from '@/components/brand'
import { cn } from '@/lib/cn'
import { ago, money, num, pct, relative, titleCase } from '@/lib/format'
import type { ActivityItem, HealthComponent } from '@/types/installation'
import { deviceId, MiniFact } from './parts'

/* ------------------------------------------------------------------------- */
/*  System health                                                            */
/* ------------------------------------------------------------------------- */
const HEALTH_ICON: Record<HealthComponent['id'], ReactNode> = {
  application: <Layers />,
  api: <Gauge />,
  database: <Database />,
  queue: <Server />,
  webhooks: <Webhook />,
  storage: <HardDrive />,
  license: <ShieldCheck />,
  updates: <CloudDownload />,
}

const HEALTH_ORDER: HealthComponent['id'][] = ['api', 'database', 'queue', 'webhooks', 'license', 'updates']

export function SystemHealthCard({ className }: { className?: string }) {
  const health = useHealth()
  const navigate = useNavigate()
  const h = health.data
  const comps = HEALTH_ORDER.map((id) => h?.components.find((c) => c.id === id)).filter(Boolean) as HealthComponent[]
  const overall = h?.overall ?? 'healthy'
  const openIncidents = h?.incidents.filter((i) => i.status !== 'resolved').length ?? 0
  return (
    <Card className={cn('flex flex-col overflow-hidden', className)}>
      <CardHeader
        title="System health"
        description={h ? `ORVEX Core · checked ${relative(h.checkedAt)}` : 'Running checks…'}
        actions={
          <Button size="xs" variant="ghost" to="/admin/system/health" trailing={<ArrowRight />}>
            Details
          </Button>
        }
      >
        {h && (
          <div className="mt-2">
            <StatusBadge status={overall} label={overall === 'healthy' ? 'All components healthy' : undefined} noPulse />
          </div>
        )}
      </CardHeader>
      <div className="grid grid-cols-2 gap-px border-y border-line bg-line">
        {health.isLoading &&
          Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="bg-surface px-4 py-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2 h-4 w-20" />
              <Skeleton className="mt-1.5 h-2.5 w-12" />
            </div>
          ))}
        {comps.map((c) => {
          const label =
            c.id === 'license'
              ? 'Valid'
              : c.id === 'updates'
                ? c.status === 'attention'
                  ? 'Update ready'
                  : 'Up to date'
                : c.status === 'healthy'
                  ? 'Healthy'
                  : c.status === 'degraded'
                    ? 'Degraded'
                    : c.status === 'attention'
                      ? 'Attention'
                      : 'Down'
          const tone = c.status === 'healthy' ? 'success' : c.status === 'attention' ? 'accent' : c.status === 'degraded' ? 'warning' : 'danger'
          // A short operational detail per component (latency, depth, plan, target version…).
          const detail = c.id === 'license' ? (c.summary.split(' · ')[1] ?? c.metric) : c.id === 'updates' ? c.summary : c.metric
          return (
            <Tooltip key={c.id} content={c.summary} className="flex">
              <button
                type="button"
                onClick={() => navigate(c.id === 'updates' ? '/admin/system/updates' : c.id === 'license' ? '/admin/system/license' : '/admin/system/health')}
                className="flex min-w-0 flex-1 items-start gap-2.5 bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-2"
              >
                <span className="mt-px shrink-0 text-fg-3 [&_svg]:size-3.5">{HEALTH_ICON[c.id]}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11.5px] text-fg-3">{c.name}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[13px] font-medium text-fg">
                    <Dot tone={tone} pulse={c.status === 'degraded' || c.status === 'down'} />
                    <span className="truncate">{label}</span>
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[10.5px] text-fg-3">{detail}</div>
                </div>
              </button>
            </Tooltip>
          )
        })}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
          <span className="mono-label">Incidents</span>
          {h && <span className="text-[11px] text-fg-3 tabular">{openIncidents ? `${openIncidents} open` : 'none open'}</span>}
        </div>
        <div className="flex-1 px-1.5 pb-2">
          {health.isLoading && <Skeleton className="mx-2.5 my-2 h-8 w-auto" />}
          {h && h.incidents.length === 0 && <p className="px-2.5 py-2 text-[12px] text-fg-3">No incidents in the last 30 days.</p>}
          {h?.incidents.slice(0, 4).map((inc) => (
            <button key={inc.id} type="button" onClick={() => navigate('/admin/system/health')} className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-surface-2">
              <Dot tone={inc.status === 'resolved' ? 'success' : inc.status === 'monitoring' ? 'warning' : 'danger'} className="mt-[7px]" />
              <span className="min-w-0 flex-1">
                <span className={cn('line-clamp-2 text-[12px] leading-snug', inc.status === 'resolved' ? 'text-fg-3' : 'text-fg')}>{inc.title}</span>
                <span className="block truncate text-[10.5px] text-fg-3">{inc.status === 'resolved' ? `Resolved ${relative(inc.resolvedAt)}` : `${titleCase(inc.status)} · ${ago(inc.startedAt)}`}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-line border-t border-line text-center">
        <MiniFact className="px-2" label="DB pool" value={h ? `${h.metrics.dbConnections.active}/${h.metrics.dbConnections.max}` : '—'} />
        <MiniFact className="px-2" label="CPU" value={h ? pct(h.metrics.cpu, 0) : '—'} />
        <MiniFact className="px-2" label="Memory" value={h ? pct((h.metrics.memory.usedMb / h.metrics.memory.totalMb) * 100, 0) : '—'} />
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------------- */
/*  Live orders                                                              */
/* ------------------------------------------------------------------------- */
const CHANNEL_LABEL = {
  api: 'Reseller API',
  website: 'Website',
  admin: 'Admin',
} as const

export function LiveOrdersCard({ className }: { className?: string }) {
  const orders = useOrders({ pageSize: 8 }, { live: true })
  const services = useServices()
  const providers = useProviders()
  const navigate = useNavigate()
  const svc = useMemo(() => new Map(services.data?.map((s) => [s.id, s]) ?? []), [services.data])
  const shortName = useMemo(() => new Map(providers.data?.map((p) => [p.id, p.shortName]) ?? []), [providers.data])
  const items = orders.data?.items ?? []

  return (
    <Card className={cn('flex flex-col overflow-hidden', className)}>
      <CardHeader
        title="Live orders"
        description="Streaming from the order engine · newest first"
        actions={
          <Button size="xs" variant="ghost" to="/admin/orders" trailing={<ArrowRight />}>
            Open orders
          </Button>
        }
      />
      {/* Fixed layout: fits the card from 600px up; only narrower screens scroll. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] table-fixed text-[13px]">
          <colgroup>
            <col className="w-[132px]" />
            <col />
            <col className="w-[132px]" />
            <col className="w-[108px]" />
            <col className="w-[96px]" />
          </colgroup>
          <thead>
            <tr className="border-t border-line bg-surface-2/40 text-left">
              <th className="py-2 pr-3 pl-5 font-normal">
                <span className="mono-label">Order · client</span>
              </th>
              <th className="px-3 py-2 font-normal">
                <span className="mono-label">Service · device</span>
              </th>
              <th className="px-3 py-2 font-normal">
                <span className="mono-label">Supplier</span>
              </th>
              <th className="px-3 py-2 font-normal">
                <span className="mono-label">Status</span>
              </th>
              <th className="py-2 pr-5 pl-3 text-right font-normal">
                <span className="mono-label">Price</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.isLoading &&
              Array.from({ length: 6 }, (_, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="px-5 py-3.5" colSpan={5}>
                    <Skeleton className="h-4" />
                  </td>
                </tr>
              ))}
            {!orders.isLoading && items.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EmptyState compact icon={<Inbox />} title="No orders yet" description="New IMEI checks, unlocks and server jobs stream in here as they arrive." />
                </td>
              </tr>
            )}
            {items.map((o) => {
              const s = svc.get(o.serviceId)
              const device = deviceId(o.input)
              const fallbacks = o.attempts.length - 1
              return (
                <motion.tr
                  key={o.id}
                  layout="position"
                  initial={{
                    opacity: 0,
                    backgroundColor: 'color-mix(in oklab, var(--accent) 9%, transparent)',
                  }}
                  animate={{
                    opacity: 1,
                    backgroundColor: 'color-mix(in oklab, var(--accent) 0%, transparent)',
                  }}
                  transition={{ duration: 1.2 }}
                  onClick={() => navigate(`/admin/orders/${o.id}`)}
                  className="cursor-pointer border-t border-line transition-colors hover:bg-surface-2/60"
                >
                  <td className="py-2.5 pr-3 pl-5">
                    <span className="block truncate font-mono text-[12.5px] text-fg">#{o.number}</span>
                    <span className="block truncate text-[11px] text-fg-3">{o.resellerName ?? CHANNEL_LABEL[o.channel]}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex min-w-0 items-center gap-2.5">
                      {s ? <ServiceIcon icon={s.icon} category={s.category} size="sm" /> : <span className="size-7 shrink-0 rounded-md bg-surface-3" />}
                      <span className="min-w-0">
                        <span className="block truncate text-fg">{o.serviceName}</span>
                        <span className="block truncate font-mono text-[11px] text-fg-3">{device ?? '—'}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {o.providerId ? (
                      <span className="flex min-w-0 items-center gap-2 text-fg-2">
                        <ProviderMark id={o.providerId} size="xs" />
                        <span className="truncate">{shortName.get(o.providerId) ?? o.providerName}</span>
                        {fallbacks > 0 && (
                          <Tooltip content={`${o.attempts.length} attempts — automatic fallback`}>
                            <span className="shrink-0 rounded bg-warning/10 px-1 text-[10.5px] text-warning tabular">↻ {fallbacks}</span>
                          </Tooltip>
                        )}
                      </span>
                    ) : o.error?.code === 'held_for_review' ? (
                      <span className="block truncate text-[12px] text-warning">Held for review</span>
                    ) : (
                      <span className="text-fg-3">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="py-2.5 pr-5 pl-3 text-right tabular">
                    <span className="block font-medium text-fg">{money(o.price)}</span>
                    <span className="block text-[11px] text-fg-3">{ago(o.createdAt)} ago</span>
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {orders.data && (
        <div className="mt-auto flex items-center justify-between border-t border-line px-5 py-3 text-[12px] text-fg-3">
          <span className="tabular">{num(orders.data.total)} orders in the database</span>
          <span className="flex items-center gap-1.5">
            <Dot tone="accent" pulse /> refreshes every 5s
          </span>
        </div>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------------- */
/*  Activity                                                                 */
/* ------------------------------------------------------------------------- */
const ACTIVITY_ICON: Record<ActivityItem['kind'], ReactNode> = {
  order: <ReceiptText />,
  provider: <PlugZap />,
  api_key: <KeyRound />,
  mapping: <Workflow />,
  reseller: <Users />,
  system: <Server />,
  webhook: <Webhook />,
  pricing: <Tags />,
  user: <UserRound />,
}

const toneRing: Record<ActivityItem['tone'], string> = {
  neutral: 'text-fg-3 bg-surface-2',
  success: 'text-success bg-success/10',
  warning: 'text-warning bg-warning/10',
  danger: 'text-danger bg-danger/10',
  accent: 'text-accent-ink bg-accent/10',
}

export function ActivityCard({ className }: { className?: string }) {
  const activity = useActivity(9)
  const navigate = useNavigate()
  return (
    <Card className={cn('flex flex-col overflow-hidden', className)}>
      <CardHeader
        title="Recent activity"
        description="Orders, supplier and configuration events"
        actions={
          <Button size="xs" variant="ghost" to="/admin/system/activity" trailing={<ArrowRight />}>
            Audit log
          </Button>
        }
      />
      <div className="flex-1 px-2 pb-3">
        {activity.isLoading &&
          Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex gap-3 px-3 py-2.5">
              <Skeleton className="size-7 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-2.5 w-28" />
              </div>
            </div>
          ))}
        {activity.data?.length === 0 && <EmptyState compact icon={<Inbox />} title="No recent activity" description="Orders, provider changes and configuration edits appear here." />}
        {activity.data?.map((a) => (
          <button key={a.id} type="button" onClick={() => a.href && navigate(a.href)} className={cn('flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors', a.href ? 'hover:bg-surface-2' : 'cursor-default')}>
            <span className={cn('grid size-7 shrink-0 place-items-center rounded-lg [&_svg]:size-3.5', toneRing[a.tone])}>{ACTIVITY_ICON[a.kind]}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-fg">{a.title}</p>
              <p className="truncate text-[11.5px] text-fg-3">{a.detail}</p>
            </div>
            <span className="shrink-0 pt-0.5 text-[11px] text-fg-3 tabular">{ago(a.at)}</span>
          </button>
        ))}
      </div>
    </Card>
  )
}
