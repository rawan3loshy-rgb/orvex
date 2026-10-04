import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { ArrowRight, Bot, GitCompareArrows, KeyRound, Lock, ScrollText, ShieldCheck, User, Users } from 'lucide-react'
import { Avatar, Badge, Card, CodeBlock, DataTable, Drawer, EmptyState, MonoValue, PageHeader, Pagination, SearchInput, Select, type Column } from '@/components/ui'
import { PermissionHint } from '@/components/domain'
import { useAudit, usePermissionCatalog, useUsers } from '@/hooks/installation'
import { dateTime, time } from '@/lib/format'
import type { AuditEvent, AuditSeverity, Tone } from '@/types/installation'
import { ChipFilter, QueryError } from './shared'

const SEVERITY_TONE: Record<AuditSeverity, Tone> = { info: 'neutral', notice: 'info', warning: 'warning', critical: 'danger' }
const ACTOR_TYPES = ['admin', 'member', 'api_key', 'dhru', 'guest', 'system', 'supplier', 'gateway'] as const
const ACTOR_LABEL: Record<string, string> = { admin: 'Operator', member: 'Portal member', api_key: 'API key', dhru: 'DHRU client', guest: 'Guest', system: 'System', supplier: 'Supplier', gateway: 'Payment gateway' }
const TARGET_TYPES = ['order', 'account', 'supplier', 'service', 'pricing_rule', 'payment', 'user', 'settings', 'license', 'system', 'extension', 'webhook', 'supplier_product', 'storefront', 'storefront_page', 'migration']

export default function AuditPage() {
  const [params] = useSearchParams()
  const [severity, setSeverity] = useState<AuditSeverity | 'all'>('all')
  const [actorType, setActorType] = useState('all')
  const [targetType, setTargetType] = useState('all')
  const [range, setRange] = useState<'24h' | '7d' | 'all'>(params.get('search') ? 'all' : '7d')
  const [search, setSearch] = useState(params.get('search') ?? '')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<AuditEvent | null>(null)
  const pageSize = 40
  // Back to page 1 whenever a filter changes (adjusted during render, not in an effect).
  const filterKey = JSON.stringify([severity, actorType, targetType, range, search])
  const [pagedFor, setPagedFor] = useState(filterKey)
  if (pagedFor !== filterKey) {
    setPagedFor(filterKey)
    setPage(1)
  }
  const audit = useAudit({ severity, actorType, targetType, range, search: search || undefined, page, pageSize })
  const users = useUsers()
  const color = (id: string) => users.data?.find((u) => u.id === id)?.color

  const columns: Column<AuditEvent>[] = [
    { key: 'at', header: 'Time', width: 'w-[120px]', cell: (r) => <span className="font-mono text-[12px] text-fg-2 tabular">{dateTime(r.at)}</span> },
    {
      key: 'actor',
      header: 'Actor',
      width: 'w-[190px]',
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-2">
          {r.actor.type === 'admin' ? <Avatar name={r.actor.name} color={color(r.actor.id)} size="sm" /> : <span className="grid size-6 place-items-center rounded-full bg-surface-3 text-fg-3">{r.actor.type === 'system' ? <Bot className="size-3.5" /> : r.actor.type === 'api_key' || r.actor.type === 'dhru' ? <KeyRound className="size-3.5" /> : <User className="size-3.5" />}</span>}
          <div className="min-w-0">
            <p className="truncate text-[13px] text-fg">{r.actor.name}</p>
            <p className="truncate text-[11px] text-fg-3">{r.actor.role ?? ACTOR_LABEL[r.actor.type] ?? r.actor.type}</p>
          </div>
        </div>
      ),
    },
    { key: 'action', header: 'Action', width: 'w-[170px]', cell: (r) => <span className="font-mono text-[12px] text-fg">{r.action}</span> },
    {
      key: 'target',
      header: 'Target · summary',
      cell: (r) => (
        <div className="min-w-0 max-w-[380px]">
          <p className="truncate text-[13px] text-fg">{r.summary}</p>
          <p className="truncate text-[11.5px] text-fg-3">
            <span className="font-mono">{r.target.type}</span> · {r.target.label}
            {r.reason ? <span className="text-fg-2"> · “{r.reason}”</span> : null}
          </p>
        </div>
      ),
    },
    { key: 'ip', header: 'IP · device', hideBelow: 'xl', width: 'w-[170px]', cell: (r) => <div className="min-w-0"><p className="font-mono text-[12px] text-fg-2">{r.ip}</p><p className="truncate text-[11px] text-fg-3">{r.device}</p></div> },
    { key: 'sev', header: 'Severity', width: 'w-[100px]', align: 'right', cell: (r) => <Badge tone={SEVERITY_TONE[r.severity]} dot>{r.severity}</Badge> },
  ]

  return (
    <div className="space-y-4">
      <PageHeader icon={<ScrollText />} eyebrow="System" title="Audit log" description="Append-only record of every sensitive action — who, with which role and permission, from where, and what changed." actions={<PermissionHint permission="audit.read" />} />
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <ChipFilter
          value={severity}
          onChange={setSeverity}
          items={[
            { value: 'all', label: 'All severities' },
            { value: 'info', label: 'Info' },
            { value: 'notice', label: 'Notice' },
            { value: 'warning', label: 'Warning' },
            { value: 'critical', label: 'Critical' },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select inputSize="sm" value={actorType} onChange={(e) => setActorType(e.target.value)} options={[{ value: 'all', label: 'All actors' }, ...ACTOR_TYPES.map((a) => ({ value: a, label: ACTOR_LABEL[a]! }))]} className="w-[150px]" />
          <Select inputSize="sm" value={targetType} onChange={(e) => setTargetType(e.target.value)} options={[{ value: 'all', label: 'All targets' }, ...TARGET_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, ' ') }))]} className="w-[160px]" />
          <Select inputSize="sm" value={range} onChange={(e) => setRange(e.target.value as typeof range)} options={[{ value: '24h', label: 'Last 24 h' }, { value: '7d', label: 'Last 7 days' }, { value: 'all', label: 'All time' }]} className="w-[130px]" />
          <SearchInput value={search} onChange={setSearch} placeholder="Action, actor, target, reason…" className="w-full sm:w-[240px]" />
        </div>
      </div>
      {audit.isError && !audit.data ? (
        <QueryError onRetry={() => audit.refetch()} />
      ) : (
        <Card className="overflow-hidden">
          <DataTable
            columns={columns}
            rows={audit.data?.items}
            rowKey={(r) => r.id}
            loading={audit.isLoading}
            onRowClick={setOpen}
            selectedKey={open?.id}
            minWidth={900}
            empty={<EmptyState compact icon={<ScrollText />} title="No audit events match" description="Widen the range or clear filters." />}
          />
          {audit.data && audit.data.total > 0 && <Pagination page={page} pageSize={pageSize} total={audit.data.total} onPage={setPage} />}
        </Card>
      )}
      <AuditDrawer event={open} onClose={() => setOpen(null)} color={open ? color(open.actor.id) : undefined} />
    </div>
  )
}

function AuditDrawer({ event, onClose, color }: { event: AuditEvent | null; onClose: () => void; color?: string }) {
  const catalog = usePermissionCatalog()
  const [last, setLast] = useState(event)
  if (event && event !== last) setLast(event)
  const e = event ?? last
  const perm = e?.permission ? catalog.data?.[e.permission] : undefined
  return (
    <Drawer open={!!event} onClose={onClose} width="md" icon={<ScrollText />} title={e?.summary} description={e ? `${dateTime(e.at)} · ${time(e.at, true)}` : undefined}>
      {e && (
        <div className="space-y-6">
          <div className="flex items-center gap-3.5 rounded-xl border border-line bg-surface-2/40 p-4">
            {e.actor.type === 'admin' ? <Avatar name={e.actor.name} color={color} size="lg" /> : <span className="grid size-10 place-items-center rounded-full bg-surface-3 text-fg-3"><Users className="size-4" /></span>}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-fg">{e.actor.name}</p>
              <p className="truncate text-[12.5px] text-fg-3">
                {ACTOR_LABEL[e.actor.type] ?? e.actor.type}
                {e.actor.role ? ` · ${e.actor.role}` : ''}
              </p>
            </div>
            <Badge tone={SEVERITY_TONE[e.severity]} dot>
              {e.severity}
            </Badge>
          </div>

          <section className="grid grid-cols-2 gap-2 text-[12.5px]">
            {[
              ['Action', <MonoValue key="a" value={e.action} className="text-fg" />],
              ['Target', `${e.target.type} · ${e.target.label}`],
              ['Target ID', <MonoValue key="t" value={e.target.id} className="text-fg" />],
              ['IP address', <MonoValue key="i" value={e.ip} className="text-fg" />],
              ['Device', e.device],
              ['Event ID', <MonoValue key="e" value={e.id} className="text-fg" />],
            ].map(([k, v], i) => (
              <div key={i} className="min-w-0 rounded-lg border border-line px-3 py-2">
                <div className="mono-label">{k}</div>
                <div className="mt-0.5 truncate text-fg">{v}</div>
              </div>
            ))}
          </section>

          <section>
            <h3 className="mono-label mb-2">Reason</h3>
            <p className={e.reason ? 'rounded-lg border border-line bg-surface-2/50 px-3.5 py-2.5 text-[13px] text-fg' : 'text-[12.5px] text-fg-3'}>{e.reason ?? 'No reason recorded.'}</p>
          </section>

          <section>
            <h3 className="mono-label mb-2 flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" /> Permission used
            </h3>
            {e.permission ? (
              <div className="flex items-start gap-3 rounded-lg border border-line px-3.5 py-2.5">
                <Lock className="mt-0.5 size-3.5 text-fg-3" />
                <div className="min-w-0">
                  <p className="text-[13px] text-fg">
                    {perm?.label ?? e.permission} <span className="font-mono text-[11.5px] text-fg-3">{e.permission}</span> {perm?.sensitive && <Badge tone="warning" className="ml-1">sensitive</Badge>}
                  </p>
                  {perm && <p className="text-[12px] text-fg-3">{perm.description}</p>}
                </div>
              </div>
            ) : (
              <p className="text-[12.5px] text-fg-3">No permission check — system or customer-initiated action.</p>
            )}
          </section>

          <section>
            <h3 className="mono-label mb-2 flex items-center gap-1.5">
              <GitCompareArrows className="size-3.5" /> Changes
            </h3>
            {e.changes.length ? (
              <div className="overflow-hidden rounded-xl border border-line">
                <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_16px_minmax(0,1fr)] items-center gap-3 border-b border-line bg-surface-2/60 px-3.5 py-2 text-[11px] font-medium text-fg-3">
                  <span>Field</span>
                  <span>From</span>
                  <span />
                  <span>To</span>
                </div>
                {e.changes.map((c, i) => (
                  <div key={`${c.field}-${i}`} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_16px_minmax(0,1fr)] items-center gap-3 border-b border-line px-3.5 py-2.5 last:border-0">
                    <span className="truncate font-mono text-[12px] text-fg-2" title={c.field}>
                      {c.field}
                    </span>
                    <span className="truncate rounded-md bg-danger/[0.07] px-2 py-1 font-mono text-[12px] text-danger line-through decoration-danger/40" title={c.from}>
                      {c.from}
                    </span>
                    <ArrowRight className="size-3.5 text-fg-3" />
                    <span className="truncate rounded-md bg-success/[0.08] px-2 py-1 font-mono text-[12px] text-success" title={c.to}>
                      {c.to}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-line-strong px-4 py-3 text-[12.5px] text-fg-3">No field-level changes recorded for this action.</p>
            )}
          </section>

          <section>
            <h3 className="mono-label mb-2">Raw event</h3>
            <CodeBlock lang="json" code={JSON.stringify(e, null, 2)} maxHeight={240} />
          </section>
        </div>
      )}
    </Drawer>
  )
}
