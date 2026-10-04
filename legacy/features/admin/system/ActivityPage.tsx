import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowRight, Database, Download, FileClock, LoaderCircle, Lock, RotateCcw, ScrollText } from 'lucide-react'
import { Button, Card, EmptyState, PageHeader, Pagination, SearchInput, Segmented, Select, Skeleton, Tooltip } from '@/components/ui'
import { useAudit, useInstallation, useSettings, useUsers } from '@/hooks/installation'
import { toast } from '@/stores/toast'
import { cn } from '@/lib/cn'
import { date, num, relative, time } from '@/lib/format'
import type { AuditEntityType, AuditEntry, AuditSeverity } from '@/types/installation'
import { downloadCsv, fileDate, toCsv } from '../commerce/reports/csv'
import { AuditDrawer } from './activity/AuditDrawer'
import { ActorAvatar, ENTITY, EntityChip, SEVERITY, SeverityBadge, dayKey, dayLabel } from './activity/meta'

const PAGE_SIZE = 30
type Range = '24h' | '7d' | 'all'

function useDebounced<T>(value: T, delay = 250) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

export default function ActivityPage() {
  const [search, setSearch] = useState('')
  const [actor, setActor] = useState('')
  const [entity, setEntity] = useState('')
  const [severity, setSeverity] = useState('')
  const [range, setRange] = useState<Range>('all')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<AuditEntry | null>(null)
  const q = useDebounced(search.trim())

  const users = useUsers()
  const settings = useSettings()
  const installation = useInstallation()
  const audit = useAudit({ page, pageSize: PAGE_SIZE, search: q || undefined, actor: actor || undefined, entity: entity || undefined, severity: severity || undefined, range: range === 'all' ? undefined : range })

  const filterBy = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setPage(1)
  }
  const activeFilters = [q, actor, entity, severity, range !== 'all' ? range : ''].filter(Boolean).length
  const clear = () => {
    setSearch('')
    setActor('')
    setEntity('')
    setSeverity('')
    setRange('all')
    setPage(1)
  }

  const actorOptions = useMemo(() => {
    const names = (users.data ?? []).filter((u) => u.status !== 'invited').map((u) => u.name)
    return [{ value: '', label: 'All actors' }, ...names.map((n) => ({ value: n, label: n })), { value: 'Admin', label: 'Admin (shared account)' }, { value: 'System', label: 'System' }]
  }, [users.data])

  const groups = useMemo(() => {
    const out: { key: string; label: string; items: AuditEntry[] }[] = []
    for (const a of audit.data?.items ?? []) {
      const k = dayKey(a.at)
      const g = out.at(-1)
      if (g && g.key === k) g.items.push(a)
      else out.push({ key: k, label: dayLabel(new Date(a.at)), items: [a] })
    }
    return out
  }, [audit.data])

  const exportPage = () => {
    const items = audit.data?.items ?? []
    const rows = [
      ['id', 'timestamp', 'actor', 'actor_type', 'action', 'summary', 'entity_type', 'entity_label', 'entity_id', 'severity', 'ip', 'changes'],
      ...items.map((a) => [a.id, a.at, a.actor.name, a.actor.type, a.action, a.summary, a.entity.type, a.entity.label, a.entity.id, a.severity, a.ip, (a.changes ?? []).map((c) => `${c.field}: ${c.from} -> ${c.to}`).join('; ')]),
    ]
    const file = `audit-log-p${page}-${fileDate()}.csv`
    downloadCsv(file, toCsv(rows))
    toast.success('Audit log exported', `${items.length} events · ${file}`)
  }

  const retention = settings.data?.security.auditRetentionDays
  const db = installation.data?.database
  const total = audit.data?.total ?? 0

  return (
    <div>
      <PageHeader
        icon={<ScrollText />}
        title="Activity"
        description="An append-only audit trail of this installation — service prices, supplier credentials, reseller balances, API keys and system events. Who changed what, when and from where."
        actions={
          <Button variant="secondary" leading={<Download />} onClick={exportPage} disabled={!audit.data?.items.length}>
            Export
          </Button>
        }
      />

      <Card>
        {/* Toolbar */}
        <div className="flex flex-col gap-2.5 border-b border-line p-3 sm:p-4">
          <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center">
            <SearchInput value={search} onChange={filterBy(setSearch)} placeholder="Search services, suppliers, resellers, people…" className="xl:w-[300px]" />
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <Select inputSize="sm" aria-label="Actor" className="sm:w-[170px]" value={actor} onChange={(e) => filterBy(setActor)(e.target.value)} options={actorOptions} />
              <Select
                inputSize="sm"
                aria-label="Entity type"
                className="sm:w-[160px]"
                value={entity}
                onChange={(e) => filterBy(setEntity)(e.target.value)}
                options={[{ value: '', label: 'All entities' }, ...(Object.keys(ENTITY) as AuditEntityType[]).map((k) => ({ value: k, label: ENTITY[k].label }))]}
              />
              <Select
                inputSize="sm"
                aria-label="Severity"
                className="col-span-2 sm:w-[140px]"
                value={severity}
                onChange={(e) => filterBy(setSeverity)(e.target.value)}
                options={[{ value: '', label: 'All severities' }, ...(Object.keys(SEVERITY) as AuditSeverity[]).map((k) => ({ value: k, label: SEVERITY[k].label }))]}
              />
            </div>
            <Segmented
              className="self-start xl:ml-auto xl:self-auto"
              value={range}
              onChange={filterBy(setRange)}
              items={[
                { value: '24h', label: '24h' },
                { value: '7d', label: '7 days' },
                { value: 'all', label: 'All' },
              ]}
            />
          </div>
          <div className="flex min-h-5 items-center justify-between gap-3 text-[12px] text-fg-3">
            <span className="flex items-center gap-1.5 tabular">
              {audit.isFetching && !audit.isLoading && <LoaderCircle className="size-3.5 animate-spin" />}
              {audit.data ? `${num(total)} event${total === 1 ? '' : 's'}` : 'Loading events…'}
            </span>
            {activeFilters > 0 && (
              <button type="button" onClick={clear} className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg">
                <RotateCcw className="size-3" />
                Clear {activeFilters} filter{activeFilters === 1 ? '' : 's'}
              </button>
            )}
          </div>
        </div>

        {/* Feed */}
        <div className={cn('transition-opacity', audit.isPlaceholderData && 'opacity-60')}>
          {audit.isLoading ? (
            <FeedSkeleton />
          ) : groups.length === 0 ? (
            <EmptyState
              icon={<FileClock />}
              title="No activity matches"
              description={activeFilters ? 'Nothing was recorded for these filters. Widen the date range or clear filters.' : 'Administrative actions will appear here as they happen.'}
              action={
                activeFilters ? (
                  <Button size="sm" variant="secondary" leading={<RotateCcw />} onClick={clear}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            groups.map((g, gi) => (
              <section key={g.key} aria-label={g.label}>
                <div className={cn('sticky top-14 z-[2] flex items-center justify-between gap-3 border-b border-line bg-surface/90 px-5 py-2 backdrop-blur-md', gi > 0 && 'border-t')}>
                  <h3 className="text-[12.5px] font-semibold text-fg">{g.label}</h3>
                  <span className="text-[11.5px] text-fg-3 tabular">
                    {g.items.length} event{g.items.length === 1 ? '' : 's'}
                  </span>
                </div>
                <ul>
                  {g.items.map((a, i) => (
                    <motion.li key={a.id} className="border-b border-line last:border-0" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.018, ease: [0.16, 1, 0.3, 1] }}>
                      <AuditRow entry={a} users={users.data} selected={selected?.id === a.id} onOpen={() => setSelected(a)} />
                    </motion.li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        {total > 0 && <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />}

        <div className="flex flex-col gap-1.5 rounded-b-xl border-t border-line bg-surface-2/40 px-5 py-3 text-[12px] text-fg-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2">
            <Lock className="size-3.5" />
            Retained {retention ? `${num(retention)} days` : '365 days'} · append-only, tamper-evident
          </span>
          <span className="flex items-center gap-2">
            <Database className="size-3.5" />
            Stored in your database{db ? ` · ${db.engine} ${db.version} · ${db.name}` : ''}
          </span>
        </div>
      </Card>

      <AuditDrawer entry={selected} onClose={() => setSelected(null)} users={users.data} />
    </div>
  )
}

function AuditRow({ entry: a, users, selected, onOpen }: { entry: AuditEntry; users?: Parameters<typeof ActorAvatar>[0]['users']; selected: boolean; onOpen: () => void }) {
  const first = a.changes?.[0]
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group flex w-full items-start gap-3.5 px-5 py-3.5 text-left transition-colors hover:bg-surface-2/60 focus-visible:bg-surface-2/60 focus-visible:outline-none',
        selected && 'bg-accent/[0.06] hover:bg-accent/[0.08]',
        a.severity === 'critical' && 'shadow-[inset_2px_0_0_var(--danger)]',
        a.severity === 'warning' && 'shadow-[inset_2px_0_0_color-mix(in_oklab,var(--warning)_70%,transparent)]',
      )}
    >
      <ActorAvatar actor={a.actor} users={users} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="text-[13.5px] font-medium text-fg">{a.summary}</span>
          <EntityChip entity={a.entity} />
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-fg-3">
          <span className="font-medium text-fg-2">{a.actor.name}</span>
          <span className="text-fg-3/50">·</span>
          <span className="font-mono text-[11.5px]">{a.action}</span>
          <span className="hidden text-fg-3/50 md:inline">·</span>
          <span className="hidden font-mono text-[11.5px] md:inline">{a.ip}</span>
          {first && (
            <span className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-md bg-fg/[0.04] px-1.5 py-px font-mono text-[11px]">
              <span className="truncate text-fg-3">{first.field}</span>
              <span className="truncate text-fg-2 line-through decoration-fg-3/50">{first.from}</span>
              <ArrowRight className="size-3 shrink-0" />
              <span className="truncate text-fg">{first.to}</span>
              {a.changes!.length > 1 && <span className="text-fg-3">+{a.changes!.length - 1}</span>}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <SeverityBadge severity={a.severity} />
        <Tooltip content={`${date(a.at)} · ${time(a.at, true)}`} placement="left">
          <span className="text-[12px] whitespace-nowrap text-fg-3">{relative(a.at)}</span>
        </Tooltip>
      </div>
    </button>
  )
}

function FeedSkeleton() {
  return (
    <div>
      <div className="border-b border-line px-5 py-2.5">
        <Skeleton className="h-3.5 w-20" />
      </div>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-start gap-3.5 border-b border-line px-5 py-3.5 last:border-0">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className={cn('h-3.5', i % 2 ? 'w-1/2' : 'w-2/3')} />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <div className="space-y-2">
            <Skeleton className="ml-auto h-4 w-14 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}
