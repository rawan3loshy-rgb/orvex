import { Link } from 'react-router'
import { ArrowUpRight, Copy, Repeat } from 'lucide-react'
import { Badge, Button, CodeBlock, CopyButton, Drawer } from '@/components/ui'
import { cn } from '@/lib/cn'
import { dateTime, ms } from '@/lib/format'
import { toast } from '@/stores/toast'
import { Cell, DhruChip, HeaderTable, MethodBadge, StatusCode, type LogRow } from '../shared'
import { CRITICAL_MS, SLOW_MS, curlFromLog, prettyJson } from '../helpers'

export function LogDrawer({ entry: l, open, onClose, dhruEndpoint }: { entry: LogRow | undefined; open: boolean; onClose: () => void; dhruEndpoint?: string }) {
  const curl = l ? curlFromLog(l, dhruEndpoint) : ''
  const reqHeaders: Record<string, string> = l
    ? {
        ...(l.protocol === 'native' ? { authorization: `Bearer ${l.keyPrefix ?? '—'}_••••` } : { 'content-type': 'application/x-www-form-urlencoded' }),
        ...(l.idempotencyKey ? { 'idempotency-key': l.idempotencyKey } : {}),
        'user-agent': l.userAgent,
        'x-forwarded-for': l.ip,
      }
    : {}
  const resHeaders: Record<string, string> = l ? { 'x-request-id': l.requestId, ...(l.replayed ? { 'idempotent-replayed': 'true' } : {}), 'content-type': 'application/json' } : {}

  return (
    <Drawer
      open={open && !!l}
      onClose={onClose}
      width="xl"
      title={
        l && (
          <span className="flex min-w-0 items-center gap-2.5">
            <MethodBadge method={l.method} />
            <span className="truncate font-mono text-[14px]">{l.path}</span>
            {l.protocol === 'dhru' && <DhruChip />}
          </span>
        )
      }
      description={
        l && (
          <span className="inline-flex items-center gap-1 font-mono text-[11.5px]">
            {l.requestId}
            <CopyButton value={l.requestId} label="Copy request ID" className="size-5" />
          </span>
        )
      }
      actions={
        <Button
          size="sm"
          variant="secondary"
          leading={<Copy />}
          className="mr-1"
          onClick={() => {
            navigator.clipboard?.writeText(curl).catch(() => undefined)
            toast.success('Copied as cURL', 'The key is referenced as $ORVEX_API_KEY')
          }}
        >
          cURL
        </Button>
      }
    >
      {l && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
            <Cell label="Status">
              <StatusCode status={l.status} phrase />
            </Cell>
            <Cell label="Latency">
              <span className={cn('font-mono text-[13px]', l.latencyMs > CRITICAL_MS ? 'text-danger' : l.latencyMs > SLOW_MS ? 'text-accent-ink' : 'text-fg')}>{ms(l.latencyMs)}</span>
            </Cell>
            <Cell label="Account">
              {l.accountId ? (
                <Link to={`/admin/accounts/${l.accountId}`} className="hover:text-accent-ink">
                  {l.accountName ?? l.accountId}
                </Link>
              ) : (
                <span className="text-fg-3">Unauthenticated</span>
              )}
            </Cell>
            <Cell label="Time">{dateTime(l.at)}</Cell>
            <Cell label="Key prefix">
              <span className="font-mono text-[12px]">{l.keyPrefix ?? '—'}</span>
            </Cell>
            <Cell label="IP">
              <span className="font-mono text-[12px]">{l.ip}</span>
            </Cell>
            <Cell label="Endpoint" className="col-span-2">
              <span className="font-mono text-[12px]">{l.endpoint}</span>
            </Cell>
            {(l.errorCode || l.idempotencyKey) && (
              <>
                <Cell label="Error code">{l.errorCode ? <code className="font-mono text-[12px] text-warning">{l.errorCode}</code> : '—'}</Cell>
                <Cell label="Idempotency-Key" className="col-span-1 sm:col-span-3">
                  {l.idempotencyKey ? (
                    <span className="flex items-center gap-2">
                      <span className="truncate font-mono text-[12px]">{l.idempotencyKey}</span>
                      {l.replayed && (
                        <Badge tone="info" icon={<Repeat />}>
                          replayed
                        </Badge>
                      )}
                    </span>
                  ) : (
                    '—'
                  )}
                </Cell>
              </>
            )}
          </div>

          {l.orderRef && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2/50 px-4 py-3 text-[13px]">
              <span className="text-fg-2">
                {l.replayed ? 'Replayed original order' : 'Linked order'} <span className="font-mono text-fg">{l.orderRef}</span>
              </span>
              <Button size="sm" variant="ghost" trailing={<ArrowUpRight />} to={`/admin/orders/${l.orderRef}`}>
                Open order
              </Button>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <section>
              <h4 className="mb-2 text-[13px] font-semibold">Request headers</h4>
              <HeaderTable headers={reqHeaders} />
            </section>
            <section>
              <h4 className="mb-2 text-[13px] font-semibold">Response headers</h4>
              <HeaderTable headers={resHeaders} />
            </section>
          </div>

          {l.requestBody && <CodeBlock lang={l.protocol === 'dhru' ? 'text' : 'json'} title={l.protocol === 'dhru' ? 'Form fields' : 'Request body'} code={l.protocol === 'dhru' ? l.requestBody : prettyJson(l.requestBody)} maxHeight={260} />}
          <CodeBlock lang="json" title="Response body" code={prettyJson(l.responseBody)} maxHeight={360} />
          <CodeBlock lang="bash" title="cURL reconstruction" code={curl} />
        </div>
      )}
    </Drawer>
  )
}
