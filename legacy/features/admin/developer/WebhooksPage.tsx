import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { motion } from 'motion/react'
import { BookOpen, Building, Plus, TriangleAlert, Webhook } from 'lucide-react'
import { useResellers, useWebhookDeliveries, useWebhooks } from '@/hooks/installation'
import type { WebhookDelivery, WebhookEndpoint } from '@/types/installation'
import { Button, Card, CardBody, CardHeader, DataTable, DemoTag, EmptyState, PageHeader, Skeleton, StatusBadge, Tooltip, type Column } from '@/components/ui'
import { ChartLegend, TimeChart } from '@/components/charts'
import { cn } from '@/lib/cn'
import { dateTime, ms, num, pct, time } from '@/lib/format'
import { ResellerAvatar } from '@/features/admin/commerce/resellers/shared'
import { AddEndpointModal } from './webhooks/AddEndpointModal'
import { EndpointDrawer } from './webhooks/EndpointDrawer'
import { EventCatalog } from './webhooks/EventCatalog'
import { EventChip, LoadError, sinceShort } from './shared'

const HOUR = 3600_000

/** Recent deliveries across all endpoints (several pages, newest first) for the 24h chart. */
function useRecentDeliveries() {
  const p1 = useWebhookDeliveries({ page: 1, pageSize: 200 })
  const p2 = useWebhookDeliveries({ page: 2, pageSize: 200 })
  const p3 = useWebhookDeliveries({ page: 3, pageSize: 200 })
  const p4 = useWebhookDeliveries({ page: 4, pageSize: 200 })
  const items = useMemo(() => [p1, p2, p3, p4].flatMap((p) => p.data?.items ?? []), [p1.data, p2.data, p3.data, p4.data]) // eslint-disable-line react-hooks/exhaustive-deps
  return { items, loading: p1.isLoading }
}

function bucketByHour(items: WebhookDelivery[]) {
  const now = Date.now()
  const start = Math.floor(now / HOUR) * HOUR - 23 * HOUR
  const buckets = Array.from({ length: 24 }, (_, i) => ({ t: new Date(start + i * HOUR).toISOString(), delivered: 0, failed: 0 }))
  for (const d of items) {
    const i = Math.floor((new Date(d.at).getTime() - start) / HOUR)
    if (i < 0 || i > 23) continue
    if (d.status === 'delivered') buckets[i]!.delivered++
    else if (d.status !== 'pending') buckets[i]!.failed++
  }
  return buckets
}

export default function WebhooksPage() {
  const [params, setParams] = useSearchParams()
  const webhooks = useWebhooks()
  const resellers = useResellers()
  const recent = useRecentDeliveries()
  const [drawer, setDrawer] = useState<{ id: string; open: boolean } | null>(null)

  const resellerById = useMemo(() => new Map((resellers.data ?? []).map((r) => [r.id, r])), [resellers.data])
  const createOpen = params.get('create') === '1'
  const setCreate = (open: boolean) => {
    const next = new URLSearchParams(params)
    if (open) next.set('create', '1')
    else next.delete('create')
    setParams(next, { replace: true })
  }

  const list = webhooks.data ?? []
  const chart = useMemo(() => bucketByHour(recent.items), [recent.items])
  const summary = useMemo(() => {
    const deliveries = list.reduce((a, w) => a + w.deliveries24h, 0)
    const weightedOk = list.reduce((a, w) => a + (w.successRate24h / 100) * w.deliveries24h, 0)
    const latency = deliveries ? list.reduce((a, w) => a + w.avgLatencyMs * w.deliveries24h, 0) / deliveries : 0
    const failedChart = chart.reduce((a, b) => a + b.failed, 0)
    const okChart = chart.reduce((a, b) => a + b.delivered, 0)
    return {
      active: list.filter((w) => w.status === 'active').length,
      failing: list.filter((w) => w.status === 'failing'),
      disabled: list.filter((w) => w.status === 'disabled').length,
      deliveries,
      success: deliveries ? (weightedOk / deliveries) * 100 : 100,
      latency,
      failedChart,
      okChart,
    }
  }, [list, chart])

  const selected = drawer ? list.find((w) => w.id === drawer.id) : undefined
  const selectedId = drawer?.open ? drawer.id : null
  const retrying = recent.items.filter((d) => d.status === 'retrying')

  // Fits a 1440px viewport with the expanded sidebar (~1144px content): compact padding,
  // last delivery shown under the 24h delivery count.
  const tight = { className: 'px-3', headerClassName: 'px-3' }
  const columns: Column<WebhookEndpoint>[] = [
    {
      key: 'url',
      header: 'Endpoint',
      sortValue: (w) => w.url,
      ...tight,
      cell: (w) => {
        const u = new URL(w.url)
        return (
          <div className="min-w-0 max-w-[270px]" title={w.url}>
            <div className="truncate font-mono text-[12.5px]">
              <span className="text-fg-3">https://</span>
              <span className="font-medium text-fg">{u.host}</span>
              <span className="text-fg-2">{u.pathname}</span>
            </div>
            <div className="truncate text-[12px] text-fg-3">{w.description || 'No description'}</div>
          </div>
        )
      },
    },
    {
      key: 'owner',
      header: 'Owner',
      hideBelow: 'md',
      sortValue: (w) => (w.resellerId ? (resellerById.get(w.resellerId)?.name ?? '') : '0'),
      ...tight,
      cell: (w) => {
        const r = w.resellerId ? resellerById.get(w.resellerId) : null
        return r ? (
          <span className="inline-flex max-w-[150px] items-center gap-2" title={r.name}>
            <ResellerAvatar reseller={r} size="xs" />
            <span className="truncate text-fg-2">{r.name}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 text-fg-2">
            <span className="grid size-5 place-items-center rounded-full border border-line bg-surface-2">
              <Building className="size-3 text-fg-3" />
            </span>
            Internal
          </span>
        )
      },
    },
    {
      key: 'events',
      header: 'Events',
      hideBelow: 'lg',
      ...tight,
      cell: (w) => (
        <div className="flex max-w-[260px] flex-wrap gap-1">
          {w.events.slice(0, 2).map((e) => (
            <EventChip key={e} event={e} />
          ))}
          {w.events.length > 2 && (
            <Tooltip content={w.events.slice(2).join(' · ')}>
              <span className="inline-flex h-5 items-center px-1 font-mono text-[10.5px] text-fg-3">+{w.events.length - 2}</span>
            </Tooltip>
          )}
        </div>
      ),
    },
    { key: 'status', header: 'Status', sortValue: (w) => w.status, ...tight, cell: (w) => <StatusBadge status={w.status} /> },
    {
      key: 'success',
      header: 'Success 24h',
      align: 'right',
      sortValue: (w) => w.successRate24h,
      ...tight,
      cell: (w) => (
        <span className="inline-flex items-center justify-end gap-2">
          <span className="hidden h-[5px] w-9 overflow-hidden rounded-[2px] bg-fg/[0.06] xl:block">
            <span className={cn('block h-full rounded-[2px]', w.successRate24h < 90 ? 'bg-danger' : w.successRate24h < 99 ? 'bg-warning' : selectedId === w.id ? 'bg-accent' : 'bg-fg-2/50')} style={{ width: `${w.successRate24h}%` }} />
          </span>
          <span className={cn('tabular', w.successRate24h < 90 ? 'text-danger' : w.successRate24h < 99 ? 'text-warning' : 'text-fg')}>{pct(w.successRate24h)}</span>
        </span>
      ),
    },
    {
      key: 'latency',
      header: 'Avg latency',
      align: 'right',
      hideBelow: 'xl',
      sortValue: (w) => w.avgLatencyMs,
      ...tight,
      cell: (w) => <span className={cn('font-mono text-[12px] tabular', w.avgLatencyMs > 2000 ? 'text-danger' : w.avgLatencyMs > 350 ? 'text-accent-ink' : 'text-fg-2')}>{ms(w.avgLatencyMs)}</span>,
    },
    {
      key: 'deliveries',
      header: 'Deliveries 24h',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (w) => w.deliveries24h,
      ...tight,
      cell: (w) => (
        <span className="flex flex-col items-end gap-0.5 leading-tight whitespace-nowrap">
          <span className="font-mono text-[12px] text-fg tabular">{num(w.deliveries24h)}</span>
          <Tooltip content={w.lastDeliveryAt ? `Last delivery ${dateTime(w.lastDeliveryAt)}` : 'No deliveries yet'}>
            <span className="text-[11px] text-fg-3">{w.lastDeliveryAt ? `last ${sinceShort(w.lastDeliveryAt)}` : 'never delivered'}</span>
          </Tooltip>
        </span>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        icon={<Webhook />}
        title="Webhooks"
        description="Signed, retried HTTPS callbacks so resellers’ shops and unlock panels learn the moment an unlock completes, a code is ready or a check is rejected — instead of polling. Also feeds UnlockDesk’s own ops systems."
        actions={
          <>
            <Button variant="ghost" leading={<BookOpen />} onClick={() => document.getElementById('event-catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Event catalog
            </Button>
            <Button variant="accent" leading={<Plus />} onClick={() => setCreate(true)}>
              Add endpoint
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile loading={webhooks.isLoading} label="Endpoints" value={`${summary.active}/${list.length}`} sub={summary.failing.length ? <span className="text-danger">{summary.failing.length} failing</span> : `${summary.disabled} disabled`} />
        <Tile loading={webhooks.isLoading} label="Deliveries · 24h" value={num(summary.deliveries)} sub={`≈ ${num(Math.round(summary.deliveries / 24))} per hour`} />
        <Tile loading={webhooks.isLoading} label="Success rate · 24h" value={pct(summary.success)} tone={summary.success < 97 ? 'warning' : 'success'} sub="2xx within 10s" accent />
        <Tile loading={webhooks.isLoading} label="Avg latency" value={ms(summary.latency)} sub="Weighted by volume" />
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader
            title="Deliveries · last 24 hours"
            description={recent.loading ? 'Loading…' : `${num(summary.okChart)} delivered · ${num(summary.failedChart)} failed or retrying`}
            actions={
              <span className="flex items-center gap-3">
                <ChartLegend
                  items={[
                    { label: 'Delivered', color: 'var(--c2)' },
                    { label: 'Failed', color: 'var(--danger)' },
                  ]}
                />
                <DemoTag />
              </span>
            }
          />
          <CardBody>
            {recent.loading ? (
              <Skeleton className="h-[220px] w-full rounded-lg" />
            ) : (
              <TimeChart
                data={chart}
                x={(d) => d.t}
                kind="bar"
                stacked
                height={220}
                series={[
                  { key: 'delivered', label: 'Delivered', color: 'var(--c2)' },
                  { key: 'failed', label: 'Failed / retrying', color: 'var(--danger)' },
                ]}
                xFormat={(l) => time(l)}
                tooltipTitle={(d) => `${time(d.t)} – ${time(new Date(new Date(d.t).getTime() + HOUR))}`}
                xLabelCount={6}
              />
            )}
          </CardBody>
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="Needs attention" description="Failing endpoints and pending retries" />
          <CardBody className="flex-1 space-y-2.5">
            {webhooks.isLoading ? (
              <Skeleton className="h-24 rounded-lg" />
            ) : summary.failing.length === 0 && retrying.length === 0 ? (
              <EmptyState compact icon={<Webhook />} title="All endpoints healthy" description="Every delivery in the last 24 hours succeeded or is on schedule." />
            ) : (
              <>
                {summary.failing.map((w) => (
                  <button key={w.id} type="button" onClick={() => setDrawer({ id: w.id, open: true })} className="w-full rounded-xl border border-danger/25 bg-danger/[0.04] p-3 text-left transition-colors hover:bg-danger/[0.07]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-[12px] text-fg">{new URL(w.url).host}</span>
                      <StatusBadge status="failing" />
                    </div>
                    <p className="mt-1 text-[12px] text-fg-3">
                      {pct(w.successRate24h)} success · {num(w.deliveries24h)} deliveries · {w.resellerId ? resellerById.get(w.resellerId)?.name : 'Internal'}
                    </p>
                  </button>
                ))}
                {retrying.length > 0 && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning/[0.05] p-3 text-[12.5px]">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
                    <span className="text-fg-2">
                      <span className="font-medium text-fg">{retrying.length} deliveries retrying.</span> Unlock and code results are re-sent with exponential backoff (30s → 6h, 8 attempts) and stay available via the API meanwhile.
                    </span>
                  </div>
                )}
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mb-5 overflow-hidden">
        <CardHeader title="Endpoints" description={`${list.length} endpoints · click one to inspect deliveries, send a signed test event or replay a missed unlock result.`} />
        {webhooks.isError ? (
          <LoadError what="webhook endpoints" onRetry={() => webhooks.refetch()} />
        ) : (
          <DataTable
            columns={columns}
            rows={webhooks.data}
            loading={webhooks.isLoading}
            rowKey={(w) => w.id}
            onRowClick={(w) => setDrawer({ id: w.id, open: true })}
            selectedKey={drawer?.open ? drawer.id : null}
            minWidth={760}
            defaultSort={{ key: 'deliveries', dir: 'desc' }}
            rowClassName={(w) => (w.status === 'disabled' ? 'opacity-60 hover:opacity-100' : undefined)}
            empty={
              <EmptyState
                icon={<Webhook />}
                title="No webhook endpoints"
                description="Add an endpoint so shops receive unlock results, codes and check reports instead of polling."
                action={
                  <Button size="sm" variant="accent" leading={<Plus />} onClick={() => setCreate(true)}>
                    Add endpoint
                  </Button>
                }
              />
            }
          />
        )}
      </Card>

      <EventCatalog endpoints={list} />

      <AddEndpointModal open={createOpen} onClose={() => setCreate(false)} />
      <EndpointDrawer endpoint={selected} open={!!drawer?.open} owner={selected?.resellerId ? resellerById.get(selected.resellerId) : undefined} onClose={() => setDrawer((d) => (d ? { ...d, open: false } : d))} />
    </div>
  )
}

function Tile({ label, value, sub, loading, tone, accent }: { label: string; value: ReactNode; sub: ReactNode; loading?: boolean; tone?: 'warning' | 'success'; accent?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="relative overflow-hidden rounded-xl border border-line bg-surface p-4 shadow-card">
      {accent && <span className="absolute top-4 left-0 h-4 w-[2px] rounded-r-full bg-accent" />}
      <div className="mono-label">{label}</div>
      {loading ? <Skeleton className="mt-2.5 h-6 w-20" /> : <div className={cn('mt-2 font-display text-[24px] leading-none font-semibold tracking-[-0.025em] tabular', tone === 'warning' ? 'text-warning' : 'text-fg')}>{value}</div>}
      <div className="mt-2 truncate text-[12px] text-fg-3">{loading ? <Skeleton className="h-3 w-28" /> : sub}</div>
    </motion.div>
  )
}
