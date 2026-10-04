import { useMemo, useState } from 'react'
import { FlaskConical, MoreHorizontal, Pause, Pencil, Play, Plus, Trash2, Webhook } from 'lucide-react'
import { useInstMutation, useWebhooks } from '@/hooks/installation'
import { developerService, type WebhookEndpointRow } from '@/services/installation'
import type { WebhookEndpoint } from '@/types/installation'
import { Button, Card, ConfirmDialog, DataTable, EmptyState, MenuItem, MenuSeparator, Popover, Progress, Segmented, StatusBadge, Tooltip, type Column } from '@/components/ui'
import { Guarded, useCan } from '@/components/domain'
import { cn } from '@/lib/cn'
import { num } from '@/lib/format'
import { QueryError } from '../shared'
import { EndpointModal } from './EndpointModal'

type StatusFilter = 'all' | 'active' | 'failing' | 'disabled'

export function EndpointsTab({ status, onStatus, onShowDeliveries }: { status: StatusFilter; onStatus: (s: StatusFilter) => void; onShowDeliveries: (endpointId: string, status?: string) => void }) {
  const hooks = useWebhooks()
  const can = useCan('developer.manage')
  const [modal, setModal] = useState<{ open: boolean; endpoint: WebhookEndpointRow | null }>({ open: false, endpoint: null })
  const [deleting, setDeleting] = useState<WebhookEndpointRow | null>(null)

  const update = useInstMutation((v: { id: string; patch: Partial<WebhookEndpoint> }) => developerService.updateWebhook(v.id, v.patch), { success: (_, v) => (v.patch.status === 'disabled' ? 'Endpoint disabled' : 'Endpoint enabled') })
  const remove = useInstMutation(developerService.deleteWebhook, { success: 'Endpoint deleted', onSuccess: () => setDeleting(null) })
  const test = useInstMutation(developerService.testWebhook, { success: (d) => (d ? `Test event queued · ${d.headers['webhook-id']}` : 'Test event sent') })

  const all = useMemo(() => hooks.data ?? [], [hooks.data])
  const rows = useMemo(() => all.filter((w) => status === 'all' || w.status === status), [all, status])
  const count = (s: StatusFilter) => all.filter((w) => w.status === s).length

  const columns: Column<WebhookEndpointRow>[] = [
    {
      key: 'owner',
      header: 'Owner',
      sortValue: (w) => w.accountName ?? '',
      cell: (w) => (
        <div className="min-w-0">
          <div className={cn('truncate text-[13px] font-medium', w.accountId ? 'text-fg' : 'text-accent-ink')}>{w.accountName ?? '—'}</div>
          {w.description && <div className="truncate text-[12px] text-fg-3">{w.description}</div>}
        </div>
      ),
    },
    { key: 'url', header: 'URL', cell: (w) => <span className="block max-w-[280px] truncate font-mono text-[12px] text-fg-2">{w.url}</span> },
    {
      key: 'events',
      header: 'Events',
      hideBelow: 'lg',
      cell: (w) => (
        <Tooltip content={w.events.join(', ')}>
          <span className="flex flex-wrap gap-1">
            {w.events.slice(0, 2).map((e) => (
              <code key={e} className={cn('rounded-[5px] px-1.5 py-px font-mono text-[10.5px] ring-1 ring-inset', e === 'order.needs_review' ? 'bg-warning/10 text-warning ring-warning/25' : 'bg-fg/[0.04] text-fg-2 ring-line')}>
                {e}
              </code>
            ))}
            {w.events.length > 2 && <span className="font-mono text-[10.5px] text-fg-3">+{w.events.length - 2}</span>}
          </span>
        </Tooltip>
      ),
    },
    { key: 'status', header: 'Status', sortValue: (w) => w.status, cell: (w) => <StatusBadge status={w.status} /> },
    {
      key: 'rate',
      header: 'Success · 24h',
      sortValue: (w) => w.successRate24h,
      cell: (w) => (
        <div className="w-[110px]">
          <div className={cn('text-[12.5px] font-medium tabular', w.successRate24h < 90 ? 'text-danger' : w.successRate24h < 99 ? 'text-warning' : 'text-fg')}>{w.deliveries24h ? `${w.successRate24h}%` : '—'}</div>
          <Progress value={w.deliveries24h ? w.successRate24h : 0} size="sm" tone={w.successRate24h < 90 ? 'danger' : w.successRate24h < 99 ? 'warning' : 'success'} className="mt-1" />
        </div>
      ),
    },
    {
      key: 'counts',
      header: 'Deliveries · failed · retrying',
      align: 'right',
      hideBelow: 'md',
      sortValue: (w) => w.deliveries24h,
      cell: (w) => (
        <span className="font-mono text-[12px] tabular">
          <button type="button" className="text-fg hover:text-accent-ink" onClick={(e) => { e.stopPropagation(); onShowDeliveries(w.id) }}>{num(w.deliveries24h)}</button>
          <span className="text-fg-3"> · </span>
          <button type="button" className={w.failed24h ? 'text-danger hover:underline' : 'text-fg-3'} onClick={(e) => { e.stopPropagation(); onShowDeliveries(w.id, 'failed') }}>{num(w.failed24h)}</button>
          <span className="text-fg-3"> · </span>
          <button type="button" className={w.retrying ? 'text-warning hover:underline' : 'text-fg-3'} onClick={(e) => { e.stopPropagation(); onShowDeliveries(w.id, 'retrying') }}>{num(w.retrying)}</button>
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (w) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Popover
            placement="bottom-end"
            trigger={({ toggle }) => (
              <Button size="xs" variant="ghost" icon aria-label="Endpoint actions" onClick={toggle}>
                <MoreHorizontal />
              </Button>
            )}
          >
            {(close) => (
              <div onClick={close}>
            <MenuItem icon={<FlaskConical />} disabled={!can || w.status === 'disabled'} onClick={() => test.mutate(w.id)}>
              Send test event
            </MenuItem>
            <MenuItem icon={<Pencil />} disabled={!can} onClick={() => setModal({ open: true, endpoint: w })}>
              Edit events
            </MenuItem>
            {w.status === 'disabled' ? (
              <MenuItem icon={<Play />} disabled={!can} onClick={() => update.mutate({ id: w.id, patch: { status: 'active' } })}>
                Enable
              </MenuItem>
            ) : (
              <MenuItem icon={<Pause />} disabled={!can} onClick={() => update.mutate({ id: w.id, patch: { status: 'disabled' } })}>
                Disable
              </MenuItem>
            )}
            <MenuItem icon={<Webhook />} onClick={() => onShowDeliveries(w.id)}>
              View deliveries
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Trash2 />} danger disabled={!can} onClick={() => setDeleting(w)}>
              Delete
            </MenuItem>
              </div>
            )}
          </Popover>
        </div>
      ),
    },
  ]

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <Segmented<StatusFilter>
            value={status}
            onChange={onStatus}
            items={[
              { value: 'all', label: 'All', count: all.length },
              { value: 'active', label: 'Active', count: count('active') },
              { value: 'failing', label: 'Failing', count: count('failing') },
              { value: 'disabled', label: 'Disabled', count: count('disabled') },
            ]}
          />
          <Guarded permission="developer.manage">
            {(ok) => (
              <Button variant="accent" size="sm" leading={<Plus />} disabled={!ok} onClick={() => setModal({ open: true, endpoint: null })}>
                Add endpoint
              </Button>
            )}
          </Guarded>
        </div>
        {hooks.isError ? (
          <QueryError error={hooks.error} onRetry={() => hooks.refetch()} />
        ) : (
          <DataTable
            columns={columns}
            rows={hooks.data ? rows : undefined}
            loading={hooks.isLoading}
            rowKey={(w) => w.id}
            onRowClick={(w) => onShowDeliveries(w.id)}
            minWidth={820}
            rowClassName={(w) => (w.status === 'failing' ? 'bg-danger/[0.03]' : w.status === 'disabled' ? 'opacity-60' : undefined)}
            empty={<EmptyState compact icon={<Webhook />} title={status === 'all' ? 'No endpoints yet' : `No ${status} endpoints`} description="Accounts register endpoints in the reseller portal; operators can add installation-level endpoints here." />}
          />
        )}
      </Card>
      <EndpointModal open={modal.open} endpoint={modal.endpoint} onClose={() => setModal({ open: false, endpoint: null })} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        tone="danger"
        title="Delete endpoint?"
        description={deleting?.url}
        confirmLabel="Delete endpoint"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      >
        <p className="text-[13px] text-fg-2">No further events are delivered. Pending retries are dropped; past deliveries stay in the log.</p>
      </ConfirmDialog>
    </>
  )
}
