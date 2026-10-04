import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { LucideIcon } from 'lucide-react'
import { ArrowUpRight, Bell, Inbox, Mail, MessageCircle, Send, Settings2, Users, UserCog } from 'lucide-react'
import { Badge, Button, Card, CardHeader, Checkbox, DataTable, Drawer, EmptyState, PageHeader, Pagination, SearchInput, Select, StatusBadge, Switch, Tabs, type Column } from '@/components/ui'
import { Guarded, PermissionHint, SimulatedBadge } from '@/components/domain'
import { useInstMutation, useNotificationConfig, useNotifications } from '@/hooks/installation'
import { notificationsService } from '@/services/installation'
import { cn } from '@/lib/cn'
import { dateTime, num, time } from '@/lib/format'
import type { NotificationChannel, NotificationRecord, NotificationRoute, NotificationTemplate } from '@/types/installation'
import { Callout, ChipFilter, QueryError } from './shared'

const CHANNEL: Record<NotificationChannel, { label: string; icon: LucideIcon }> = {
  email: { label: 'Email', icon: Mail },
  telegram: { label: 'Telegram', icon: Send },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle },
}
const CHANNELS: NotificationChannel[] = ['email', 'telegram', 'whatsapp']

const TEMPLATES: NotificationTemplate[] = [
  'order.completed',
  'order.rejected',
  'order.needs_review',
  'payment.received',
  'refund.issued',
  'verification.updated',
  'supplier.low_balance',
  'supplier.auth_error',
  'supplier.circuit_open',
  'api.error_spike',
  'webhook.failing',
  'account.low_balance',
]

type Row = NotificationRecord & { orderRef: string | null }

export default function NotificationsPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'config' ? 'config' : 'log'
  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Bell />}
        eyebrow="System"
        title="Notifications"
        description="Customer and operator messages over email, Telegram and WhatsApp — rendered from templates and recorded here."
        actions={<SimulatedBadge label="All channels simulated" />}
      />
      <Callout tone="neutral" icon={<Inbox />}>
        Nothing is actually sent in this prototype. Each record shows exactly what would have been delivered, to whom and why — the transport is simulated.
      </Callout>
      <Tabs
        items={[
          { value: 'log', label: 'Message log', icon: <Inbox /> },
          { value: 'config', label: 'Channels & routing', icon: <Settings2 /> },
        ]}
        value={tab}
        onChange={(v) => setParams(v === 'config' ? { tab: 'config' } : {}, { replace: true })}
      />
      {tab === 'log' ? <LogTab /> : <ConfigTab />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
function LogTab() {
  const [channel, setChannel] = useState<NotificationChannel | 'all'>('all')
  const [audience, setAudience] = useState<'all' | 'customer' | 'operator'>('all')
  const [template, setTemplate] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<Row | null>(null)
  const pageSize = 25
  // Back to page 1 whenever a filter changes (adjusted during render, not in an effect).
  const filterKey = JSON.stringify([channel, audience, template, search])
  const [pagedFor, setPagedFor] = useState(filterKey)
  if (pagedFor !== filterKey) {
    setPagedFor(filterKey)
    setPage(1)
  }
  const list = useNotifications({ channel, audience, template, search: search || undefined, page, pageSize })

  const columns: Column<Row>[] = [
    { key: 'at', header: 'Time', width: 'w-[120px]', cell: (r) => <span className="font-mono text-[12px] text-fg-2 tabular">{dateTime(r.at)}</span> },
    {
      key: 'channel',
      header: 'Channel',
      width: 'w-[120px]',
      cell: (r) => {
        const C = CHANNEL[r.channel]
        return (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-2">
            <C.icon className="size-3.5 text-fg-3" />
            {C.label}
          </span>
        )
      },
    },
    { key: 'audience', header: 'Audience', width: 'w-[110px]', cell: (r) => <Badge tone={r.audience === 'operator' ? 'info' : 'neutral'} variant="soft" icon={r.audience === 'operator' ? <UserCog /> : <Users />}>{r.audience}</Badge> },
    { key: 'template', header: 'Template', cell: (r) => <span className="font-mono text-[12px] text-fg">{r.template}</span>, hideBelow: 'md' },
    {
      key: 'subject',
      header: 'Recipient · subject',
      cell: (r) => (
        <div className="min-w-0 max-w-[340px]">
          <p className="truncate text-[13px] text-fg">{r.subject}</p>
          <p className="truncate font-mono text-[11.5px] text-fg-3">{r.recipient}</p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', width: 'w-[110px]', cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'order',
      header: 'Order',
      width: 'w-[120px]',
      hideBelow: 'lg',
      cell: (r) =>
        r.orderRef && r.orderId ? (
          <Link to={`/admin/orders/${r.orderId}`} onClick={(e) => e.stopPropagation()} className="font-mono text-[12px] text-accent-ink hover:underline">
            {r.orderRef}
          </Link>
        ) : (
          <span className="text-fg-3">—</span>
        ),
    },
  ]

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <ChipFilter
          value={channel}
          onChange={setChannel}
          items={[{ value: 'all', label: 'All channels' }, ...CHANNELS.map((c) => ({ value: c, label: CHANNEL[c].label, icon: (() => { const I = CHANNEL[c].icon; return <I /> })() }))]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select inputSize="sm" value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)} options={[{ value: 'all', label: 'All audiences' }, { value: 'customer', label: 'Customer' }, { value: 'operator', label: 'Operator' }]} className="w-[150px]" />
          <Select inputSize="sm" value={template} onChange={(e) => setTemplate(e.target.value)} options={[{ value: 'all', label: 'All templates' }, ...TEMPLATES.map((t) => ({ value: t, label: t }))]} className="w-[200px]" />
          <SearchInput value={search} onChange={setSearch} placeholder="Recipient, subject, body…" className="w-full sm:w-[240px]" />
        </div>
      </div>
      {list.isError && !list.data ? (
        <QueryError onRetry={() => list.refetch()} />
      ) : (
        <Card className="overflow-hidden">
          <DataTable
            columns={columns}
            rows={list.data?.items}
            rowKey={(r) => r.id}
            loading={list.isLoading}
            onRowClick={setOpen}
            selectedKey={open?.id}
            minWidth={820}
            empty={<EmptyState compact icon={<Inbox />} title="No messages match" description="Try another channel, audience or template." />}
          />
          {list.data && list.data.total > 0 && <Pagination page={page} pageSize={pageSize} total={list.data.total} onPage={setPage} />}
        </Card>
      )}
      <MessageDrawer row={open} onClose={() => setOpen(null)} />
    </div>
  )
}

function MessageDrawer({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const [last, setLast] = useState(row)
  if (row && row !== last) setLast(row)
  const r = row ?? last
  const C = r ? CHANNEL[r.channel] : null
  return (
    <Drawer
      open={!!row}
      onClose={onClose}
      width="md"
      icon={C ? <C.icon /> : <Bell />}
      title={r?.subject}
      description={r ? `${r.template} · ${dateTime(r.at)}` : undefined}
      footer={
        r?.orderId ? (
          <Button variant="primary" size="sm" to={`/admin/orders/${r.orderId}`} trailing={<ArrowUpRight />}>
            Open order {r.orderRef}
          </Button>
        ) : undefined
      }
    >
      {r && C && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2 text-[12.5px]">
            {[
              ['Channel', C.label],
              ['Audience', r.audience],
              ['Recipient', r.recipient],
              ['Status', r.status],
              ['Template', r.template],
              ['Time', `${dateTime(r.at)} (${time(r.at, true)})`],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0 rounded-lg border border-line px-3 py-2">
                <div className="mono-label">{k}</div>
                <div className="mt-0.5 truncate text-fg">{v}</div>
              </div>
            ))}
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="mono-label">Message</span>
              <SimulatedBadge label="Not delivered — simulated" />
            </div>
            <div className={cn('rounded-xl border border-line p-4', r.channel === 'email' ? 'bg-surface' : 'bg-surface-2/60')}>
              {r.channel === 'email' && (
                <div className="mb-3 space-y-0.5 border-b border-line pb-3 text-[12px] text-fg-3">
                  <p>
                    To: <span className="text-fg-2">{r.recipient}</span>
                  </p>
                  <p>
                    Subject: <span className="font-medium text-fg">{r.subject}</span>
                  </p>
                </div>
              )}
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-fg">{r.body}</p>
            </div>
          </div>
          {r.status === 'suppressed' && <p className="text-[12px] text-fg-3">Suppressed: the routing rule or channel was disabled when this event happened, so the message was recorded but not queued.</p>}
        </div>
      )}
    </Drawer>
  )
}

/* ------------------------------------------------------------------ */
function ConfigTab() {
  const config = useNotificationConfig()
  const updateChannel = useInstMutation((v: { id: string; enabled: boolean }) => notificationsService.updateChannel(v.id, { enabled: v.enabled }), { success: 'Channel updated' })
  const updateRoute = useInstMutation((v: { id: string; patch: Partial<NotificationRoute> }) => notificationsService.updateRoute(v.id, v.patch), { success: 'Routing rule updated' })
  const data = config.data

  if (config.isError && !data) return <QueryError onRetry={() => config.refetch()} />
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <PermissionHint permission="system.manage" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {(data?.channels ?? []).map((c) => {
          const C = CHANNEL[c.channel]
          return (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg border border-line bg-surface-2 text-fg-2">
                    <C.icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-[13.5px] font-semibold text-fg">{C.label}</p>
                    <p className="font-mono text-[11.5px] text-fg-3">{c.target}</p>
                  </div>
                </div>
                <Guarded permission="system.manage">{(allowed) => <Switch checked={c.enabled} disabled={!allowed || updateChannel.isPending} onChange={(enabled) => updateChannel.mutate({ id: c.id, enabled })} label={`Enable ${C.label}`} />}</Guarded>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
                <span className="truncate text-[12px] text-fg-3">{c.transport}</span>
                <SimulatedBadge />
              </div>
            </Card>
          )
        })}
        {!data && Array.from({ length: 3 }, (_, i) => <Card key={i} className="h-[118px] skeleton" />)}
      </div>

      <Card>
        <CardHeader title="Routing rules" description="Which event goes to which audience, over which channels. Operator messages go to the channel targets above; customer messages to the account’s contact." />
        <DataTable
          rows={data?.routes}
          loading={!data}
          rowKey={(r) => r.id}
          minWidth={720}
          columns={[
            { key: 'template', header: 'Template', cell: (r) => <span className="font-mono text-[12.5px] text-fg">{r.template}</span> },
            { key: 'audience', header: 'Audience', width: 'w-[120px]', cell: (r) => <Badge tone={r.audience === 'operator' ? 'info' : 'neutral'}>{r.audience}</Badge> },
            {
              key: 'channels',
              header: 'Channels',
              cell: (r) => (
                <Guarded permission="system.manage">
                  {(allowed) => (
                    <div className="flex flex-wrap gap-3">
                      {CHANNELS.map((ch) => (
                        <Checkbox
                          key={ch}
                          checked={r.channels.includes(ch)}
                          disabled={!allowed || updateRoute.isPending}
                          label={<span className="text-[12.5px]">{CHANNEL[ch].label}</span>}
                          onChange={(on) => {
                            const next = on ? [...r.channels, ch] : r.channels.filter((x) => x !== ch)
                            updateRoute.mutate({ id: r.id, patch: { channels: CHANNELS.filter((x) => next.includes(x)) } })
                          }}
                        />
                      ))}
                    </div>
                  )}
                </Guarded>
              ),
            },
            {
              key: 'enabled',
              header: 'Enabled',
              align: 'right',
              width: 'w-[90px]',
              cell: (r) => <Guarded permission="system.manage">{(allowed) => <Switch size="sm" checked={r.enabled} disabled={!allowed || updateRoute.isPending} onChange={(enabled) => updateRoute.mutate({ id: r.id, patch: { enabled } })} label={`Enable ${r.template}`} />}</Guarded>,
            },
          ]}
        />
        {data && (
          <p className="border-t border-line px-5 py-3 text-[12px] text-fg-3">
            {num(data.routes.filter((r) => r.enabled).length)} of {data.routes.length} rules enabled. A disabled rule or channel records the message as suppressed.
          </p>
        )}
      </Card>
    </div>
  )
}
