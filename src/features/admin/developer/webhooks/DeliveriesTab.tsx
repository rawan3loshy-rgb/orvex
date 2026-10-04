import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowUpRight, Repeat, Send } from 'lucide-react'
import { useInstMutation, useWebhookDeliveries, useWebhooks } from '@/hooks/installation'
import { developerService } from '@/services/installation'
import type { WebhookDelivery } from '@/types/installation'
import { Button, Card, CodeBlock, Drawer, EmptyState, Pagination, Select, StatusBadge, DataTable, type Column } from '@/components/ui'
import { Guarded, PermissionHint } from '@/components/domain'
import { cn } from '@/lib/cn'
import { dateTime, ms, relative, time } from '@/lib/format'
import { Cell, HeaderTable, QueryError, StatusCode } from '../shared'
import { MAX_ATTEMPTS, RETRY_DELAYS_SEC, RETRY_LABELS, WEBHOOK_EVENTS, prettyJson } from '../helpers'

type DeliveryRow = WebhookDelivery & { url: string; orderRef: string | null }

export interface DeliveryFilters {
  endpointId: string
  status: string
  event: string
}

export function DeliveriesTab({ filters, onFilters }: { filters: DeliveryFilters; onFilters: (f: Partial<DeliveryFilters>) => void }) {
  const [page, setPage] = useState(1)
  const endpoints = useWebhooks()
  const q = { endpointId: filters.endpointId || undefined, status: filters.status || undefined, event: filters.event || undefined, page, pageSize: 25 }
  const list = useWebhookDeliveries(q)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = list.data?.items.find((d) => d.id === selectedId)

  const set = (f: Partial<DeliveryFilters>) => {
    setPage(1)
    onFilters(f)
  }

  const columns: Column<DeliveryRow>[] = [
    { key: 'time', header: 'Created', cell: (d) => <span className="font-mono text-[12px] whitespace-nowrap text-fg-2" title={dateTime(d.createdAt)}>{dateTime(d.createdAt)}</span> },
    { key: 'event', header: 'Event', cell: (d) => <code className="font-mono text-[12px] text-fg">{d.event}</code> },
    { key: 'url', header: 'Endpoint', hideBelow: 'lg', cell: (d) => <span className="block max-w-[240px] truncate font-mono text-[11.5px] text-fg-3">{d.url}</span> },
    { key: 'order', header: 'Order', hideBelow: 'md', cell: (d) => (d.orderRef ? <span className="font-mono text-[12px] text-fg-2">{d.orderRef}</span> : <span className="text-fg-3">—</span>) },
    {
      key: 'attempts',
      header: 'Attempts',
      align: 'right',
      cell: (d) => (
        <span className={cn('font-mono text-[12px] tabular', d.attempts.length >= MAX_ATTEMPTS ? 'text-danger' : 'text-fg-2')}>
          {d.attempts.length}/{MAX_ATTEMPTS}
        </span>
      ),
    },
    { key: 'http', header: 'Last HTTP', align: 'right', hideBelow: 'md', cell: (d) => <StatusCode status={d.attempts.at(-1)?.httpStatus ?? null} /> },
    { key: 'status', header: 'Status', cell: (d) => <StatusBadge status={d.status} /> },
    { key: 'next', header: 'Next retry', hideBelow: 'lg', cell: (d) => (d.nextRetryAt ? <span className="text-[12px] whitespace-nowrap text-warning">{relative(d.nextRetryAt)}</span> : <span className="text-fg-3">—</span>) },
  ]

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <Select
            inputSize="sm"
            className="w-[260px]"
            value={filters.endpointId}
            onChange={(e) => set({ endpointId: e.target.value })}
            options={[{ value: '', label: 'All endpoints' }, ...(endpoints.data ?? []).map((w) => ({ value: w.id, label: `${w.accountName ?? '—'} · ${w.url.replace(/^https:\/\//, '')}` }))]}
          />
          <Select
            inputSize="sm"
            className="w-[150px]"
            value={filters.status}
            onChange={(e) => set({ status: e.target.value })}
            options={[
              { value: '', label: 'Any status' },
              { value: 'delivered', label: 'Delivered' },
              { value: 'retrying', label: 'Retrying' },
              { value: 'failed', label: 'Failed' },
              { value: 'pending', label: 'Pending' },
            ]}
          />
          <Select inputSize="sm" className="w-[190px]" value={filters.event} onChange={(e) => set({ event: e.target.value })} options={[{ value: '', label: 'Any event' }, ...WEBHOOK_EVENTS.map((e) => ({ value: e.id, label: e.id }))]} />
          {(filters.endpointId || filters.status || filters.event) && (
            <Button size="sm" variant="ghost" onClick={() => set({ endpointId: '', status: '', event: '' })}>
              Clear
            </Button>
          )}
        </div>
        {list.isError ? (
          <QueryError error={list.error} onRetry={() => list.refetch()} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={list.data?.items}
              loading={list.isLoading}
              rowKey={(d) => d.id}
              onRowClick={(d) => setSelectedId(d.id)}
              selectedKey={selectedId}
              dense
              minWidth={760}
              rowClassName={(d) => (d.status === 'failed' ? 'bg-danger/[0.03]' : undefined)}
              empty={<EmptyState compact icon={<Send />} title="No deliveries match" description="Deliveries are created when subscribed events fire." />}
            />
            {list.data && list.data.total > list.data.pageSize && <Pagination page={page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />}
          </>
        )}
      </Card>
      <DeliveryDrawer delivery={selected} open={!!selected} onClose={() => setSelectedId(null)} />
    </>
  )
}

function DeliveryDrawer({ delivery: d, open, onClose }: { delivery: DeliveryRow | undefined; open: boolean; onClose: () => void }) {
  const replay = useInstMutation(developerService.replayDelivery, { success: (r) => (r.status === 'delivered' ? 'Replayed — delivered' : 'Replay attempted — endpoint still failing') })
  return (
    <Drawer
      open={open && !!d}
      onClose={onClose}
      width="lg"
      title={d && <code className="font-mono text-[14px]">{d.event}</code>}
      description={d && <span className="font-mono text-[11.5px]">{d.url}</span>}
      footer={
        d && (
          <>
            <PermissionHint permission="developer.manage" className="mr-auto" />
            <Guarded permission="developer.manage">
              {(ok) => (
                <Button variant="secondary" leading={<Repeat />} disabled={!ok} loading={replay.isPending} onClick={() => replay.mutate(d.id)}>
                  Replay (same webhook-id)
                </Button>
              )}
            </Guarded>
          </>
        )
      }
    >
      {d && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
            <Cell label="Status">
              <StatusBadge status={d.status} />
            </Cell>
            <Cell label="Attempts">
              {d.attempts.length}/{MAX_ATTEMPTS}
            </Cell>
            <Cell label="Order">
              {d.orderRef ? (
                <Link to={`/admin/orders/${d.orderRef}`} className="inline-flex items-center gap-1 font-mono text-[12px] hover:text-accent-ink">
                  {d.orderRef} <ArrowUpRight className="size-3" />
                </Link>
              ) : (
                '—'
              )}
            </Cell>
            <Cell label="Created">{dateTime(d.createdAt)}</Cell>
          </div>

          <section>
            <h4 className="mb-2 text-[13px] font-semibold">Standard Webhooks headers</h4>
            <HeaderTable headers={d.headers} />
            <div className="mt-3 rounded-xl border border-line bg-surface-2/40 p-3 text-[12.5px] text-fg-2">
              <p className="mb-2 font-medium text-fg">How the signature is computed</p>
              <pre className="overflow-x-auto font-mono text-[11.5px] leading-relaxed text-fg-2">
                {`signed  = "${d.headers['webhook-id']}.${d.headers['webhook-timestamp']}." + body\nsig     = base64(HMAC-SHA256(endpoint_secret, signed))\nheader  = "v1," + sig`}
              </pre>
              <p className="mt-2 text-[12px] text-fg-3">
                <code className="font-mono">webhook-id</code> stays the same across retries and replays, so receivers de-duplicate on it. In this prototype the HMAC is simulated and nothing leaves the browser.
              </p>
            </div>
          </section>

          <section>
            <h4 className="mb-2 text-[13px] font-semibold">Retry schedule</h4>
            <RetrySchedule delivery={d} />
          </section>

          <section>
            <h4 className="mb-2 text-[13px] font-semibold">Attempts</h4>
            {d.attempts.length === 0 ? (
              <p className="text-[12.5px] text-fg-3">No attempt yet — the first one is immediate.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-line">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b border-line bg-surface-2/50 text-left text-[11.5px] text-fg-3">
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Time</th>
                      <th className="px-3 py-2 font-medium">HTTP</th>
                      <th className="px-3 py-2 text-right font-medium">Latency</th>
                      <th className="px-3 py-2 font-medium">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {d.attempts.map((a) => (
                      <tr key={a.n}>
                        <td className="px-3 py-2 font-mono text-fg-3">{a.n}</td>
                        <td className="px-3 py-2 font-mono text-fg-2">{time(a.at, true)}</td>
                        <td className="px-3 py-2">
                          <StatusCode status={a.httpStatus} />
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-fg-2">{ms(a.latencyMs)}</td>
                        <td className="px-3 py-2 text-fg-3">{a.error ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <CodeBlock lang="json" title="Payload" code={prettyJson(d.payload)} maxHeight={360} />
        </div>
      )}
    </Drawer>
  )
}

function RetrySchedule({ delivery: d }: { delivery: WebhookDelivery }) {
  const done = d.attempts.length
  const first = new Date(d.createdAt).getTime()
  // Cumulative delay (ms) from creation to each attempt.
  const offsets = RETRY_DELAYS_SEC.map((_, i) => RETRY_DELAYS_SEC.slice(0, i + 1).reduce((sum, sec) => sum + sec * 1000, 0))
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
        {RETRY_LABELS.map((label, i) => {
          const attempt = d.attempts[i]
          const ok = attempt && attempt.httpStatus != null && attempt.httpStatus >= 200 && attempt.httpStatus < 300
          const isNext = i === done && d.status === 'retrying'
          return (
            <div
              key={i}
              className={cn(
                'rounded-lg border px-2 py-1.5 text-center',
                attempt ? (ok ? 'border-success/30 bg-success/[0.06]' : 'border-danger/30 bg-danger/[0.05]') : isNext ? 'border-warning/40 bg-warning/[0.07]' : 'border-line bg-surface-2/30',
              )}
              title={attempt ? `Attempt ${i + 1}: ${attempt.httpStatus ?? 'no response'}` : `~${new Date(first + offsets[i]!).toLocaleTimeString()}`}
            >
              <div className="font-mono text-[10px] text-fg-3">#{i + 1}</div>
              <div className={cn('font-mono text-[11.5px]', attempt ? (ok ? 'text-success' : 'text-danger') : isNext ? 'text-warning' : 'text-fg-3')}>{label}</div>
            </div>
          )
        })}
      </div>
      <p className="text-[12px] text-fg-3">
        {d.status === 'retrying' && d.nextRetryAt ? (
          <>
            Next retry <span className="text-warning">{relative(d.nextRetryAt)}</span> ({dateTime(d.nextRetryAt)}).
          </>
        ) : d.status === 'failed' ? (
          'All attempts exhausted — marked failed and the operator was notified. Replay once the receiver is fixed.'
        ) : d.status === 'delivered' ? (
          'Delivered — no further retries.'
        ) : (
          'Queued for its first attempt.'
        )}
      </p>
    </div>
  )
}
