import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { motion } from 'motion/react'
import { KeyRound, ScrollText, Webhook } from 'lucide-react'
import { useApiLogStats, useApiLogs, useResellers, useServices } from '@/hooks/installation'
import type { ApiLogEntry } from '@/types/installation'
import { Button, Card, CardBody, CardHeader, DataTable, DemoTag, Dot, EmptyState, PageHeader, Pagination, SearchInput, Segmented, Select, Skeleton, Switch, Tooltip, type Column } from '@/components/ui'
import { BarList } from '@/components/charts'
import { cn } from '@/lib/cn'
import { dateTime, ms, num, pct, time, truncateMiddle } from '@/lib/format'
import { LatencyBar, LoadError, MethodBadge, StatusCode, endpointLabel, orderedServiceId } from './shared'
import { LogDrawer } from './logs/LogDrawer'

type StatusClass = 'all' | '2xx' | '4xx' | '5xx'
type FilterKey = 'status' | 'method' | 'reseller' | 'endpoint' | 'search'
const PAGE_SIZE = 50
const STATUS_VALUES: readonly string[] = ['2xx', '4xx', '5xx']
const METHOD_VALUES: readonly string[] = ['GET', 'POST']

/**
 * Filters live in the URL so other screens can deep-link (e.g. the dashboard's "Rejected at API" →
 * `?status=4xx`). Supported params: status, method, reseller (alias clientId), endpoint, search.
 */
function readFilters(p: URLSearchParams) {
  const status = p.get('status') ?? ''
  const method = (p.get('method') ?? '').toUpperCase()
  return {
    statusClass: (STATUS_VALUES.includes(status) ? status : 'all') as StatusClass,
    method: METHOD_VALUES.includes(method) ? method : 'all',
    clientId: p.get('reseller') || p.get('clientId') || 'all',
    endpoint: p.get('endpoint') || 'all',
  }
}

export default function ApiLogsPage() {
  const [params, setParams] = useSearchParams()
  const { statusClass, method, clientId, endpoint } = readFilters(params)
  const urlSearch = params.get('search') ?? ''
  const [search, setSearch] = useState(urlSearch)
  const [page, setPage] = useState(1)
  const [live, setLive] = useState(false)
  const [drawer, setDrawer] = useState<{ entry: ApiLogEntry; open: boolean } | null>(null)
  const q = useDeferredValue(search)

  /** Writes filter changes to the URL; 'all' / '' remove the param. */
  const setFilters = (patch: Partial<Record<FilterKey, string | null>>) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(patch)) {
          if (!v || v === 'all') next.delete(k)
          else next.set(k, v)
          if (k === 'reseller') next.delete('clientId')
        }
        return next
      },
      { replace: true },
    )
  }

  // Search is typed into local state (smooth input) and mirrored to ?search= after a short pause.
  const written = useRef<string | null>(null)
  useEffect(() => {
    if (urlSearch === written.current) return // echo of our own write
    written.current = null
    setSearch(urlSearch) // navigated here with ?search= (keys, resellers, orders, dashboard)
  }, [urlSearch])
  useEffect(() => {
    if (search === urlSearch) return
    const t = setTimeout(() => {
      written.current = search
      setFilters({ search })
    }, 300)
    return () => clearTimeout(t)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  // Any filter change — from the controls or an incoming deep link — starts at page 1.
  useEffect(() => {
    setPage(1)
  }, [statusClass, method, clientId, endpoint, q])

  const updateSearch = (v: string) => setSearch(v)

  const stats = useApiLogStats()
  const resellers = useResellers()
  const services = useServices()
  const logs = useApiLogs({ page, pageSize: PAGE_SIZE, method, status: statusClass, clientId, endpoint, search: q || undefined }, { live })
  const serviceName = useMemo(() => new Map((services.data ?? []).map((s) => [s.id, s.name])), [services.data])

  // Highlight rows that arrive while live tail is on.
  const seen = useRef<Set<string> | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  useEffect(() => {
    seen.current = null
  }, [method, statusClass, clientId, endpoint, q, page])
  useEffect(() => {
    const items = logs.data?.items
    if (!items) return
    if (!live || !seen.current) {
      seen.current = new Set(items.map((l) => l.id))
      setFresh(new Set())
      return
    }
    const added = items.filter((l) => !seen.current!.has(l.id)).map((l) => l.id)
    added.forEach((id) => seen.current!.add(id))
    if (added.length) setFresh(new Set(added))
  }, [logs.data, live])

  const filtersActive = method !== 'all' || statusClass !== 'all' || clientId !== 'all' || endpoint !== 'all' || !!search
  const reset = () => {
    written.current = ''
    setSearch('')
    setFilters({ status: null, method: null, reseller: null, endpoint: null, search: null })
  }

  const endpointOptions = useMemo(() => [{ value: 'all', label: 'All endpoints' }, ...(stats.data?.endpoints ?? []).map((e) => ({ value: e.endpoint, label: `${e.endpoint.replace('/api/v1', '')} · ${endpointLabel(e.endpoint)}` }))], [stats.data])
  const clientOptions = useMemo(() => [{ value: 'all', label: 'All resellers' }, ...(resellers.data ?? []).map((r) => ({ value: r.id, label: r.name })), { value: 'internal', label: 'Internal · UnlockDesk Ops' }], [resellers.data])
  const maxLatency = useMemo(() => Math.max(150, ...(logs.data?.items ?? []).map((l) => l.latencyMs)), [logs.data])
  const selectedId = drawer?.open ? drawer.entry.id : null

  // Fits a 1440px viewport with the expanded sidebar (~1144px content) without scrolling:
  // compact 12px cell padding, /api/v1 prefix moved into the header, short request IDs (full ID in tooltip + drawer).
  const tight = { className: 'px-3', headerClassName: 'px-3' }
  const columns: Column<ApiLogEntry>[] = [
    {
      key: 'time',
      header: 'Time',
      width: 'w-[88px]',
      ...tight,
      cell: (l) => (
        <Tooltip content={dateTime(l.at)}>
          <span className="font-mono text-[12px] text-fg-3 tabular">{time(l.at, true)}</span>
        </Tooltip>
      ),
    },
    { key: 'method', header: 'Method', width: 'w-[64px]', ...tight, cell: (l) => <MethodBadge method={l.method} size="xs" /> },
    {
      key: 'path',
      header: (
        <span className="inline-flex items-baseline gap-1.5">
          Endpoint <span className="font-mono text-[10.5px] font-normal tracking-normal text-fg-3/70">/api/v1</span>
        </span>
      ),
      ...tight,
      cell: (l) => (
        <Tooltip content={<span className="font-mono text-[11.5px]">{l.path}</span>}>
          <span className="block max-w-[260px] truncate font-mono text-[12px] text-fg">{l.path.replace('/api/v1', '')}</span>
        </Tooltip>
      ),
    },
    {
      key: 'op',
      header: 'Operation',
      hideBelow: 'lg',
      ...tight,
      cell: (l) => {
        const svc = orderedServiceId(l)
        return (
          <span className="block max-w-[220px] truncate text-[12px]" title={svc ? `${endpointLabel(l.endpoint)} · ${svc} ${serviceName.get(svc) ?? ''}` : undefined}>
            <span className="text-fg-2">{endpointLabel(l.endpoint)}</span>
            {svc && (
              <span className="text-fg-3">
                {' '}
                · <span className="font-mono text-[11px]">{svc}</span> {serviceName.get(svc) ?? ''}
              </span>
            )}
          </span>
        )
      },
    },
    { key: 'status', header: 'Status', width: 'w-[68px]', ...tight, cell: (l) => <StatusCode status={l.status} /> },
    { key: 'latency', header: 'Latency', align: 'right', ...tight, cell: (l) => <LatencyBar value={l.latencyMs} max={maxLatency} highlight={selectedId === l.id} /> },
    {
      key: 'client',
      header: 'Reseller',
      hideBelow: 'md',
      ...tight,
      cell: (l) => (
        <span className="flex max-w-[150px] min-w-0 flex-col">
          <span className="truncate text-[12.5px] text-fg-2">{l.clientName}</span>
          <span className="truncate font-mono text-[10.5px] text-fg-3">{l.apiKeyPrefix}</span>
        </span>
      ),
    },
    {
      key: 'request',
      header: 'Request ID',
      hideBelow: 'xl',
      ...tight,
      cell: (l) => (
        <Tooltip content={<span className="font-mono text-[11.5px]">{l.requestId}</span>}>
          <span className="font-mono text-[11.5px] whitespace-nowrap text-fg-3">{truncateMiddle(l.requestId.replace(/^req_/, ''), 4, 4)}</span>
        </Tooltip>
      ),
    },
  ]

  const s = stats.data
  return (
    <div>
      <PageHeader
        icon={<ScrollText />}
        title="API logs"
        description="Every Reseller API call — IMEI checks and unlock orders, result polls, catalog and balance reads — with headers, bodies and a latency breakdown. Retained for 30 days in UnlockDesk’s own database."
        actions={
          <>
            <Button variant="ghost" to="/admin/developer/keys" leading={<KeyRound />}>
              API keys
            </Button>
            <Button variant="ghost" to="/admin/developer/webhooks" leading={<Webhook />}>
              Webhooks
            </Button>
          </>
        }
      />

      {/* Stats */}
      <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="overflow-hidden">
          <div className="grid h-full grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-5">
            <StatCell loading={!s} label="Requests · 24h" value={s ? num(s.requests24h) : ''} sub={s ? `All keys · ≈ ${num(Math.round(s.requests24h / 24))}/h` : ''} accent />
            <StatCell loading={!s} label="Error rate" value={s ? pct(s.errorRate, 2) : ''} tone={s && s.errorRate > 5 ? 'danger' : s && s.errorRate > 1 ? 'warning' : undefined} sub="4xx + 5xx · incl. invalid IMEIs" />
            <StatCell loading={!s} label="p50" value={s ? ms(s.p50) : ''} sub="Median latency" />
            <StatCell loading={!s} label="p95" value={s ? ms(s.p95) : ''} sub="95th percentile" />
            <StatCell loading={!s} label="p99" value={s ? ms(s.p99) : ''} tone={s && s.p99 > 400 ? 'warning' : undefined} sub="99th percentile" className="col-span-2 lg:col-span-1" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Top endpoints" description="All key traffic, last 24 hours · click to filter" className="pb-2" actions={<DemoTag />} />
          <CardBody className="pb-4">
            {s ? (
              <BarList
                color="var(--c2)"
                items={s.endpoints.slice(0, 4).map((e) => {
                  const on = endpoint === e.endpoint
                  return {
                    key: e.endpoint,
                    color: on ? 'var(--accent)' : undefined,
                    label: (
                      <button type="button" onClick={() => setFilters({ endpoint: on ? null : e.endpoint })} className={cn('flex min-w-0 items-center gap-2 font-mono text-[12px] hover:text-accent-ink', on && 'text-accent-ink')}>
                        <MethodBadge method={e.endpoint.split(' ')[0]!} size="xs" />
                        <span className="truncate">{e.endpoint.split(' ')[1]!.replace('/api/v1', '')}</span>
                        <span className="hidden truncate font-sans text-[11.5px] text-fg-3 sm:inline">{endpointLabel(e.endpoint)}</span>
                      </button>
                    ),
                    value: e.count,
                    sub: pct((e.count / Math.max(1, s.requests24h)) * 100, 0),
                  }
                })}
                format={(v) => num(v)}
              />
            ) : (
              <div className="space-y-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-7" />
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Log table */}
      <Card className="overflow-hidden">
        <div className="space-y-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <SearchInput value={search} onChange={updateSearch} placeholder="Request ID, path, IP, key prefix or reseller…" className="lg:w-[340px]" />
            <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
              <Segmented<StatusClass>
                value={statusClass}
                onChange={(v) => setFilters({ status: v })}
                items={[
                  { value: 'all', label: 'All' },
                  { value: '2xx', label: '2xx', icon: <Dot tone="success" /> },
                  { value: '4xx', label: '4xx', icon: <Dot tone="warning" /> },
                  { value: '5xx', label: '5xx', icon: <Dot tone="danger" /> },
                ]}
              />
            </div>
            <label className={cn('flex h-8 shrink-0 cursor-pointer items-center gap-2.5 rounded-lg border px-3 text-[12.5px] font-medium transition-colors lg:ml-auto', live ? 'border-accent/35 bg-accent/[0.06] text-fg' : 'border-line text-fg-2 hover:border-line-strong')}>
              <Dot tone={live ? 'accent' : 'neutral'} pulse={live} />
              Live tail
              <Switch
                size="sm"
                checked={live}
                onChange={(v) => {
                  setLive(v)
                  if (v) setPage(1)
                }}
                label="Live tail"
              />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Select
              inputSize="sm"
              value={method}
              aria-label="Method"
              onChange={(e) => setFilters({ method: e.target.value })}
              options={[
                { value: 'all', label: 'All methods' },
                { value: 'GET', label: 'GET · reads' },
                { value: 'POST', label: 'POST · orders' },
              ]}
            />
            <Select
              inputSize="sm"
              value={clientId}
              aria-label="Reseller"
              onChange={(e) => setFilters({ reseller: e.target.value })}
              options={clientOptions}
            />
            <Select
              inputSize="sm"
              value={endpoint}
              aria-label="Endpoint"
              onChange={(e) => setFilters({ endpoint: e.target.value })}
              options={endpointOptions}
            />
          </div>
          <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-fg-3">
            <span className="mt-[5px] size-1 shrink-0 rounded-full bg-fg-3/70" />
            <span>
              The table lists detailed entries — headers, bodies, timings — for recent calls{logs.data ? ` (${num(logs.data.total)} matching)` : ''}. Volume figures above count all API-key traffic{s ? ` (${num(s.requests24h)} requests in 24h)` : ''}; error rate and latency are measured on the detailed entries.
            </span>
          </p>
        </div>

        {logs.isError ? (
          <LoadError what="API logs" onRetry={() => logs.refetch()} />
        ) : (
          <DataTable
            columns={columns}
            rows={logs.data?.items}
            loading={logs.isLoading}
            rowKey={(l) => l.id}
            onRowClick={(l) => setDrawer({ entry: l, open: true })}
            selectedKey={selectedId}
            dense
            minWidth={720}
            skeletonRows={14}
            rowClassName={(l) => (fresh.has(l.id) ? 'animate-fade-up bg-accent/[0.05]' : l.status >= 500 ? 'bg-danger/[0.03]' : undefined)}
            empty={
              <EmptyState
                icon={<ScrollText />}
                title={filtersActive ? 'No requests match' : 'No API traffic yet'}
                description={filtersActive ? 'Nothing in the last 24 hours matches these filters.' : 'Requests appear here as soon as a reseller’s shop or panel calls the API.'}
                action={
                  filtersActive && (
                    <Button size="sm" onClick={reset}>
                      Clear filters
                    </Button>
                  )
                }
              />
            }
          />
        )}
        {logs.data && logs.data.total > 0 && (
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={logs.data.total}
            onPage={(p) => {
              setPage(p)
              if (p > 1) setLive(false)
            }}
          />
        )}
      </Card>

      <LogDrawer entry={drawer?.entry} open={!!drawer?.open} serviceName={serviceName} onClose={() => setDrawer((d) => (d ? { ...d, open: false } : d))} />
      {live && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="pointer-events-none fixed right-6 bottom-16 z-30 hidden items-center gap-2 rounded-full border border-accent/25 bg-surface/95 px-3 py-1.5 text-[12px] text-fg-2 shadow-pop backdrop-blur sm:flex">
          <Dot tone="accent" pulse /> Tailing · refreshes every 5s
        </motion.div>
      )}
    </div>
  )
}

function StatCell({ label, value, sub, loading, tone, className, accent }: { label: string; value: ReactNode; sub: ReactNode; loading?: boolean; tone?: 'warning' | 'danger'; className?: string; accent?: boolean }) {
  return (
    <div className={cn('relative min-w-0 bg-surface px-4 py-4 sm:px-5 xl:px-4', className)}>
      {accent && <span className="absolute top-4 left-0 h-4 w-[2px] rounded-r-full bg-accent" />}
      <div className="mono-label truncate whitespace-nowrap" title={label}>
        {label}
      </div>
      {loading ? <Skeleton className="mt-2.5 h-6 w-16" /> : <div className={cn('mt-2 font-display text-[24px] leading-none font-semibold tracking-[-0.025em] tabular', tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-fg')}>{value}</div>}
      <div className="mt-2 truncate text-[12px] text-fg-3">{loading ? <Skeleton className="h-3 w-20" /> : sub}</div>
    </div>
  )
}
