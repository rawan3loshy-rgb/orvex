import { useState } from 'react'
import { Link } from 'react-router'
import { Repeat2, ScrollText } from 'lucide-react'
import { Badge, Card, CodeBlock, DataTable, Drawer, EmptyState, Pagination, Skeleton, type Column } from '@/components/ui'
import { usePortalApiLogs } from '@/hooks/installation'
import type { ApiLogEntry } from '@/types/installation'
import { dateTime, ms, relative } from '@/lib/format'
import { cn } from '@/lib/cn'
import { ApiSectionHeader, ErrorCard, InfoRow, NoAccess } from '../kit'
import { usePortalSession } from '../kitUtils'

const statusTone = (s: number) => (s < 300 ? 'success' : s < 500 ? 'warning' : 'danger') as 'success' | 'warning' | 'danger'

export default function ApiLogsPage() {
  const { me, can, role } = usePortalSession()
  const [page, setPage] = useState(1)
  const logs = usePortalApiLogs({ page })
  const [sel, setSel] = useState<ApiLogEntry | null>(null)

  const header = <ApiSectionHeader title="API logs" description="Every request your keys made to the native API and the DHRU endpoint — useful for debugging your integration. Replayed requests returned the original order thanks to the idempotency key." />
  if (me && !can.api)
    return (
      <div>
        {header}
        <NoAccess need="api" role={role} />
      </div>
    )

  const columns: Column<ApiLogEntry>[] = [
    { key: 'at', header: 'Time', cell: (l) => <span className="text-[12px] whitespace-nowrap text-fg-2" title={dateTime(l.at)}>{relative(l.at)}</span> },
    { key: 'status', header: 'Status', cell: (l) => <Badge tone={statusTone(l.status)} variant="outline">{l.status}</Badge> },
    {
      key: 'endpoint',
      header: 'Endpoint',
      cell: (l) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12px]">{l.endpoint}</span>
          {l.protocol === 'dhru' && <Badge tone="info">DHRU</Badge>}
        </div>
      ),
    },
    { key: 'latency', header: 'Latency', align: 'right', hideBelow: 'md', cell: (l) => <span className="text-[12px] text-fg-2">{ms(l.latencyMs)}</span> },
    {
      key: 'idem',
      header: 'Idempotency key',
      hideBelow: 'lg',
      cell: (l) =>
        l.idempotencyKey ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="max-w-[160px] truncate font-mono text-[11.5px] text-fg-2">{l.idempotencyKey}</span>
            {l.replayed && (
              <Badge tone="accent" icon={<Repeat2 />}>
                replayed
              </Badge>
            )}
          </span>
        ) : (
          <span className="text-fg-3">—</span>
        ),
    },
    { key: 'key', header: 'Key', hideBelow: 'xl', cell: (l) => <span className="font-mono text-[11.5px] text-fg-3">{l.keyPrefix ?? '—'}</span> },
  ]

  return (
    <div>
      {header}
      {logs.error ? (
        <ErrorCard error={logs.error} onRetry={() => logs.refetch()} />
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden md:block">
            <DataTable columns={columns} rows={logs.data?.items} rowKey={(l) => l.id} loading={logs.isLoading} onRowClick={setSel} dense minWidth={680} empty={<EmptyState icon={<ScrollText />} title="No API requests yet" description="Requests made with your API keys appear here." />} />
          </div>
          <div className="md:hidden">
            {logs.isLoading && !logs.data ? (
              <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-11" />)}</div>
            ) : logs.data?.items.length ? (
              <ul className="divide-y divide-line">
                {logs.data.items.map((l) => (
                  <li key={l.id}>
                    <button type="button" onClick={() => setSel(l)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left">
                      <Badge tone={statusTone(l.status)} variant="outline">{l.status}</Badge>
                      <span className="min-w-0 flex-1 truncate font-mono text-[12px]">{l.endpoint}</span>
                      {l.replayed && <Repeat2 className="size-3.5 text-accent-ink" />}
                      <span className="text-[11px] text-fg-3">{relative(l.at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<ScrollText />} title="No API requests yet" />
            )}
          </div>
          {logs.data && logs.data.total > 0 && <Pagination page={logs.data.page} pageSize={logs.data.pageSize} total={logs.data.total} onPage={setPage} />}
        </Card>
      )}

      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.endpoint} description={sel && `${sel.requestId} · ${dateTime(sel.at)}`} icon={<ScrollText />} width="lg">
        {sel && (
          <div className="space-y-5">
            <dl>
              <InfoRow label="Status">
                <Badge tone={statusTone(sel.status)}>{sel.status}</Badge>
                {sel.errorCode && <span className="ml-2 font-mono text-[12px] text-danger">{sel.errorCode}</span>}
              </InfoRow>
              <InfoRow label="Protocol">{sel.protocol === 'dhru' ? 'DHRU-compatible' : 'Native API v1'}</InfoRow>
              <InfoRow label="Latency">{ms(sel.latencyMs)}</InfoRow>
              <InfoRow label="Key" mono>
                {sel.keyPrefix ?? '—'}
              </InfoRow>
              <InfoRow label="IP" mono>
                {sel.ip}
              </InfoRow>
              <InfoRow label="Idempotency key" mono>
                {sel.idempotencyKey ?? '—'}
              </InfoRow>
              <InfoRow label="Replayed">{sel.replayed ? <span className="text-accent-ink">Yes — original response returned, no new order</span> : 'No'}</InfoRow>
              {sel.orderId && (
                <InfoRow label="Order">
                  <OrderLink body={sel.responseBody} />
                </InfoRow>
              )}
            </dl>
            {sel.requestBody && <CodeBlock title="Request" lang={sel.protocol === 'dhru' ? 'text' : 'json'} code={pretty(sel.requestBody)} maxHeight={240} wrap />}
            <CodeBlock title="Response" lang="json" code={pretty(sel.responseBody)} maxHeight={320} wrap />
          </div>
        )}
      </Drawer>
    </div>
  )
}

function pretty(s: string) {
  try {
    return JSON.stringify(JSON.parse(s), null, 2)
  } catch {
    return s
  }
}

function OrderLink({ body }: { body: string }) {
  const ref = /ORD-[A-Z0-9]+/.exec(body)?.[0]
  if (!ref) return <span className="text-fg-3">linked</span>
  return (
    <Link to={`/portal/orders/${ref}`} className={cn('font-mono text-[12px] text-accent-ink hover:underline')}>
      {ref} →
    </Link>
  )
}
