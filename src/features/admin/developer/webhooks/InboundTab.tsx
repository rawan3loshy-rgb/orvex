import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowUpRight, Copy, CreditCard, Inbox, Truck } from 'lucide-react'
import { useInboundWebhooks } from '@/hooks/installation'
import type { InboundWebhook } from '@/types/installation'
import { Badge, Card, CodeBlock, DataTable, Drawer, EmptyState, Pagination, Segmented, StatusBadge, type Column } from '@/components/ui'
import { ScenarioTag, SimulatedBadge } from '@/components/domain'
import { cn } from '@/lib/cn'
import { dateTime } from '@/lib/format'
import { Cell, QueryError } from '../shared'
import { prettyJson } from '../helpers'

type InboundRow = InboundWebhook & { orderRef: string | null; paymentRef: string | null }

const SIG_STATUS: Record<InboundWebhook['signature'], string> = { valid: 'valid', invalid: 'invalid', unsigned: 'none' }

export function InboundTab() {
  const [source, setSource] = useState<'' | 'supplier' | 'payment_gateway'>('')
  const [status, setStatus] = useState<'' | 'processed' | 'duplicate_ignored' | 'rejected'>('')
  const [page, setPage] = useState(1)
  const list = useInboundWebhooks({ source: source || undefined, status: status || undefined, page, pageSize: 25 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = list.data?.items.find((x) => x.id === selectedId)

  const columns: Column<InboundRow>[] = [
    { key: 'time', header: 'Received', cell: (w) => <span className="font-mono text-[12px] whitespace-nowrap text-fg-2">{dateTime(w.receivedAt)}</span> },
    {
      key: 'source',
      header: 'Source',
      cell: (w) => (
        <span className="flex items-center gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-md border border-line bg-surface-2 text-fg-3 [&_svg]:size-3.5">{w.source === 'supplier' ? <Truck /> : <CreditCard />}</span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] text-fg">{w.sourceName}</span>
            <span className="block text-[11px] text-fg-3">{w.source === 'supplier' ? 'Supplier callback' : 'Payment gateway'}</span>
          </span>
        </span>
      ),
    },
    { key: 'type', header: 'Type', cell: (w) => <code className="font-mono text-[12px] text-fg-2">{w.type}</code> },
    { key: 'sig', header: 'Signature', cell: (w) => <StatusBadge status={SIG_STATUS[w.signature]} label={w.signature === 'unsigned' ? 'Unsigned' : undefined} noPulse /> },
    {
      key: 'status',
      header: 'Result',
      cell: (w) => (
        <span className="flex items-center gap-1.5">
          <StatusBadge status={w.status} noPulse />
          {w.status === 'duplicate_ignored' && w.source === 'payment_gateway' && <ScenarioTag id="I" />}
        </span>
      ),
    },
    {
      key: 'link',
      header: 'Linked',
      hideBelow: 'md',
      cell: (w) => (
        <span className="flex flex-col font-mono text-[12px]">
          {w.orderRef && <span className="text-fg-2">{w.orderRef}</span>}
          {w.paymentRef && <span className="text-fg-3">{w.paymentRef}</span>}
          {!w.orderRef && !w.paymentRef && <span className="text-fg-3">—</span>}
        </span>
      ),
    },
    { key: 'note', header: 'Note', hideBelow: 'xl', cell: (w) => <span className="block max-w-[260px] truncate text-[12px] text-fg-3">{w.note}</span> },
  ]

  const dupes = list.data?.items.filter((w) => w.status === 'duplicate_ignored').length ?? 0

  return (
    <>
      {dupes > 0 && !status && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-line bg-surface p-3.5 text-[13px] shadow-card">
          <Copy className="mt-0.5 size-4 shrink-0 text-accent-ink" />
          <div className="min-w-0 flex-1 text-fg-2">
            <p className="font-medium text-fg">Duplicate deliveries are recorded and ignored</p>
            <p className="mt-0.5">The gateway sent <code className="font-mono">payment.succeeded</code> twice for the same event id. The second copy was logged as <em>duplicate ignored</em> — the ledger posting is idempotent, so the wallet was funded exactly once.</p>
          </div>
          <button type="button" className="shrink-0 text-[12.5px] text-accent-ink hover:underline" onClick={() => setStatus('duplicate_ignored')}>
            Show duplicates
          </button>
        </div>
      )}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <Segmented<'' | 'supplier' | 'payment_gateway'>
            value={source}
            onChange={(v) => {
              setSource(v)
              setPage(1)
            }}
            items={[
              { value: '', label: 'All sources' },
              { value: 'payment_gateway', label: 'Payment gateways' },
              { value: 'supplier', label: 'Suppliers' },
            ]}
          />
          <Segmented<'' | 'processed' | 'duplicate_ignored' | 'rejected'>
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
            items={[
              { value: '', label: 'Any result' },
              { value: 'processed', label: 'Processed' },
              { value: 'duplicate_ignored', label: 'Duplicates' },
              { value: 'rejected', label: 'Rejected' },
            ]}
          />
          <SimulatedBadge className="ml-auto" label="Senders simulated" />
        </div>
        {list.isError ? (
          <QueryError error={list.error} onRetry={() => list.refetch()} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={list.data?.items}
              loading={list.isLoading}
              rowKey={(w) => w.id}
              onRowClick={(w) => setSelectedId(w.id)}
              selectedKey={selectedId}
              dense
              minWidth={780}
              rowClassName={(w) => cn(w.status === 'duplicate_ignored' && 'bg-accent/[0.05] shadow-[inset_2px_0_0_var(--accent)]', w.status === 'rejected' && 'bg-danger/[0.03]')}
              empty={<EmptyState compact icon={<Inbox />} title="No inbound webhooks match" description="Supplier callbacks and payment-gateway notifications appear here as they arrive." />}
            />
            {list.data && list.data.total > list.data.pageSize && <Pagination page={page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />}
          </>
        )}
      </Card>

      <Drawer open={!!selected} onClose={() => setSelectedId(null)} width="lg" icon={selected?.source === 'supplier' ? <Truck /> : <CreditCard />} title={selected?.type} description={selected?.sourceName}>
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
              <Cell label="Signature">
                <StatusBadge status={SIG_STATUS[selected.signature]} label={selected.signature === 'unsigned' ? 'Unsigned' : undefined} noPulse />
              </Cell>
              <Cell label="Result">
                <StatusBadge status={selected.status} noPulse />
              </Cell>
              <Cell label="Received">{dateTime(selected.receivedAt)}</Cell>
              <Cell label="Order">
                {selected.orderRef ? (
                  <Link to={`/admin/orders/${selected.orderRef}`} className="inline-flex items-center gap-1 font-mono text-[12px] hover:text-accent-ink">
                    {selected.orderRef} <ArrowUpRight className="size-3" />
                  </Link>
                ) : (
                  '—'
                )}
              </Cell>
              <Cell label="Payment" className="sm:col-span-2">
                {selected.paymentRef ? (
                  <Link to={`/admin/finance/payments?intent=${selected.paymentIntentId}`} className="inline-flex items-center gap-1 font-mono text-[12px] hover:text-accent-ink">
                    {selected.paymentRef} <ArrowUpRight className="size-3" />
                  </Link>
                ) : (
                  '—'
                )}
              </Cell>
            </div>
            <div className={cn('rounded-xl border p-3 text-[12.5px]', selected.status === 'duplicate_ignored' ? 'border-accent/30 bg-accent/[0.05] text-fg-2' : 'border-line bg-surface-2/40 text-fg-2')}>
              {selected.status === 'duplicate_ignored' && (
                <Badge tone="accent" className="mb-1.5">
                  Idempotent handling
                </Badge>
              )}
              <p>{selected.note}</p>
            </div>
            <CodeBlock lang="json" title="Payload as received" code={prettyJson(selected.payload)} maxHeight={420} />
          </div>
        )}
      </Drawer>
    </>
  )
}
