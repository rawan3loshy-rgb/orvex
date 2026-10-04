import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Repeat, ScrollText } from 'lucide-react'
import { useApiKeys, useApiLogStats, useApiLogs, useDhru } from '@/hooks/installation'
import { Badge, Card, CardBody, CardHeader, DataTable, EmptyState, KpiCard, PageHeader, Pagination, SearchInput, Segmented, Select, Skeleton, type Column } from '@/components/ui'
import { BarList } from '@/components/charts'
import { cn } from '@/lib/cn'
import { ms, num, pct, time } from '@/lib/format'
import { DhruChip, LatencyBar, MethodBadge, QueryError, StatusCode, type LogRow } from './shared'
import { LogDrawer } from './logs/LogDrawer'

type Protocol = '' | 'native' | 'dhru'
type StatusF = '' | 'ok' | 'error'

export default function ApiLogsPage() {
  const [params, setParams] = useSearchParams()
  const protocol = (['native', 'dhru'].includes(params.get('protocol') ?? '') ? params.get('protocol') : '') as Protocol
  const status = (['ok', 'error'].includes(params.get('status') ?? '') ? params.get('status') : '') as StatusF
  const accountId = params.get('account') ?? ''
  const urlSearch = params.get('search') ?? ''
  const [search, setSearch] = useState(urlSearch)
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
    setPage(1)
  }

  // Debounce the search box into the URL.
  const commitSearch = useEffectEvent((value: string) => update({ search: value.trim() || null }))
  useEffect(() => {
    if (search === urlSearch) return
    const t = setTimeout(() => commitSearch(search), 300)
    return () => clearTimeout(t)
  }, [search, urlSearch])
  // The URL wins when it changes underneath us (back/forward, links) — synced during render, not in an effect.
  const [syncedUrlSearch, setSyncedUrlSearch] = useState(urlSearch)
  if (urlSearch !== syncedUrlSearch) {
    setSyncedUrlSearch(urlSearch)
    setSearch(urlSearch)
  }

  const logs = useApiLogs({ protocol: protocol || undefined, status: status || undefined, accountId: accountId || undefined, search: urlSearch || undefined, page, pageSize: 40 })
  const stats = useApiLogStats()
  const keys = useApiKeys()
  const dhru = useDhru()
  const accounts = useMemo(() => [...new Map((keys.data ?? []).map((k) => [k.accountId, k.accountName])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [keys.data])
  const selected = logs.data?.items.find((l) => l.id === selectedId)
  const s = stats.data

  const columns: Column<LogRow>[] = [
    { key: 'time', header: 'Time', cell: (l) => <span className="font-mono text-[12px] whitespace-nowrap text-fg-2">{time(l.at, true)}</span> },
    { key: 'proto', header: 'Protocol', hideBelow: 'md', cell: (l) => (l.protocol === 'dhru' ? <DhruChip /> : <span className="font-mono text-[11px] text-fg-3">native</span>) },
    {
      key: 'endpoint',
      header: 'Endpoint',
      cell: (l) => (
        <span className="flex min-w-0 items-center gap-2">
          <MethodBadge method={l.method} size="xs" />
          <span className="truncate font-mono text-[12px] text-fg">{l.protocol === 'dhru' ? l.endpoint.replace(/^POST /, '') : l.path}</span>
        </span>
      ),
    },
    { key: 'status', header: 'Status', cell: (l) => (l.protocol === 'dhru' && l.errorCode ? <span className="inline-flex items-center gap-1.5"><StatusCode status={l.status} /><span className="font-mono text-[10.5px] text-warning">ERROR</span></span> : <StatusCode status={l.status} />) },
    { key: 'latency', header: 'Latency', align: 'right', hideBelow: 'sm', cell: (l) => <LatencyBar value={l.latencyMs} /> },
    { key: 'account', header: 'Account', hideBelow: 'lg', cell: (l) => <span className="block max-w-[150px] truncate text-[12.5px] text-fg-2">{l.accountName ?? <span className="text-fg-3">—</span>}</span> },
    { key: 'key', header: 'Key', hideBelow: 'xl', cell: (l) => <span className="font-mono text-[11.5px] text-fg-3">{l.keyPrefix ?? '—'}</span> },
    {
      key: 'idem',
      header: 'Idempotency-Key',
      hideBelow: 'xl',
      cell: (l) =>
        l.idempotencyKey ? (
          <span className="flex items-center gap-1.5">
            <span className="block max-w-[170px] truncate font-mono text-[11.5px] text-fg-2">{l.idempotencyKey}</span>
            {l.replayed && (
              <Badge tone="info" icon={<Repeat />}>
                replay
              </Badge>
            )}
          </span>
        ) : (
          <span className="text-fg-3">—</span>
        ),
    },
    { key: 'error', header: 'Error', hideBelow: 'md', cell: (l) => (l.errorCode ? <code className="font-mono text-[11.5px] text-warning">{l.errorCode}</code> : <span className="text-fg-3">—</span>) },
  ]

  const total = s ? s.byProtocol.native + s.byProtocol.dhru : 0

  return (
    <div>
      <PageHeader icon={<ScrollText />} title="API logs" description="Every Native API and DHRU-compatible request — authenticated or not — with request/response bodies, idempotency keys and replay flags." />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Requests · 24h" value={s ? num(s.requests24h) : '—'} loading={stats.isLoading} footer={s ? `${num(s.errors24h)} errors` : undefined} />
        <KpiCard label="Error rate" value={s ? <span className={s.errorRate > 5 ? 'text-warning' : undefined}>{pct(s.errorRate)}</span> : '—'} loading={stats.isLoading} footer="4xx/5xx + DHRU ERROR" onClick={() => update({ status: 'error' })} />
        <KpiCard label="Latency p50 · p95" value={s ? `${ms(s.p50)} · ${ms(s.p95)}` : '—'} loading={stats.isLoading} footer="Server-side" />
        <KpiCard
          label="Native · DHRU"
          value={s ? `${num(s.byProtocol.native)} · ${num(s.byProtocol.dhru)}` : '—'}
          loading={stats.isLoading}
          footer={
            s && total ? (
              <span className="flex h-1.5 w-full overflow-hidden rounded-full bg-fg/[0.07]">
                <span className="h-full bg-accent" style={{ width: `${(s.byProtocol.native / total) * 100}%` }} />
                <span className="h-full bg-fg-3/60" style={{ width: `${(s.byProtocol.dhru / total) * 100}%` }} />
              </span>
            ) : undefined
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="min-w-0 overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:flex-wrap lg:items-center">
            <SearchInput value={search} onChange={setSearch} placeholder="Path, request id, idempotency key, prefix, error…" className="lg:w-[320px]" />
            <Segmented<Protocol>
              value={protocol}
              onChange={(v) => update({ protocol: v || null })}
              items={[
                { value: '', label: 'All' },
                { value: 'native', label: 'Native' },
                { value: 'dhru', label: 'DHRU' },
              ]}
            />
            <Segmented<StatusF>
              value={status}
              onChange={(v) => update({ status: v || null })}
              items={[
                { value: '', label: 'Any' },
                { value: 'ok', label: 'OK' },
                { value: 'error', label: 'Errors' },
              ]}
            />
            <Select inputSize="sm" className="w-[180px] lg:ml-auto" value={accountId} onChange={(e) => update({ account: e.target.value || null })} options={[{ value: '', label: 'All accounts' }, ...accounts.map(([id, name]) => ({ value: id, label: name }))]} />
          </div>
          {logs.isError ? (
            <QueryError error={logs.error} onRetry={() => logs.refetch()} />
          ) : (
            <>
              <DataTable
                columns={columns}
                rows={logs.data?.items}
                loading={logs.isLoading}
                rowKey={(l) => l.id}
                onRowClick={(l) => setSelectedId(l.id)}
                selectedKey={selectedId}
                dense
                minWidth={720}
                rowClassName={(l) => cn(l.replayed && 'bg-info/[0.04]', (l.status >= 400 || l.errorCode) && 'bg-warning/[0.03]')}
                empty={<EmptyState compact icon={<ScrollText />} title="No requests match" description={urlSearch ? `Nothing found for “${urlSearch}”.` : 'Adjust the filters.'} />}
              />
              {logs.data && logs.data.total > logs.data.pageSize && <Pagination page={page} pageSize={logs.data.pageSize} total={logs.data.total} onPage={setPage} />}
            </>
          )}
        </Card>

        <Card className="self-start">
          <CardHeader title="Top endpoints" description="Last 24 hours" />
          <CardBody>
            {stats.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="h-5" />
                ))}
              </div>
            ) : s && s.byEndpoint.length ? (
              <BarList items={s.byEndpoint.slice(0, 8).map((e) => ({ key: e.endpoint, label: <span className="font-mono text-[11.5px]">{e.endpoint}</span>, value: e.count }))} format={(v) => num(v)} />
            ) : (
              <p className="text-[12.5px] text-fg-3">No traffic yet.</p>
            )}
            <div className="mt-4 border-t border-line pt-3 text-[12px] text-fg-3">
              Idempotency keys are searchable — try{' '}
              <button type="button" className="font-mono text-accent-ink hover:underline" onClick={() => update({ search: 'mh-batch-20261004-0042' })}>
                mh-batch-20261004-0042
              </button>
            </div>
          </CardBody>
        </Card>
      </div>

      <LogDrawer entry={selected} open={!!selected} onClose={() => setSelectedId(null)} dhruEndpoint={dhru.data?.endpoint} />
    </div>
  )
}
