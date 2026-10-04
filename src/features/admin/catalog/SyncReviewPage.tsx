import { useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowRight, Check, CheckCheck, CloudDownload, Equal, History, PackageMinus, PackagePlus, RefreshCw, ShieldAlert, Tags, TriangleAlert, X } from 'lucide-react'
import { Badge, Button, Card, CardHeader, Checkbox, EmptyState, PageHeader, Segmented, Select, Skeleton, StatusBadge, Tabs } from '@/components/ui'
import { Guarded, HealthBadge, Money, PermissionHint, SimulatedBadge, useCan } from '@/components/domain'
import { useInstMutation, useSuppliers, useSyncChanges, useSyncRuns } from '@/hooks/installation'
import { suppliersService, type SyncChangeRow } from '@/services/installation'
import { formatMoney, sub } from '@/core/money'
import { summarizeSyncRun } from '@/core/services/catalogSync'
import type { SyncChange } from '@/types/installation'
import { cn } from '@/lib/cn'
import { dateTime } from '@/lib/format'
import { Callout, ErrorPanel, RelTime } from './kit'

type TabId = 'new' | 'changed' | 'removed' | 'warnings'
const TAB_KINDS: Record<TabId, SyncChange['kind'][]> = { new: ['new'], changed: ['price', 'fields'], removed: ['removed'], warnings: ['warning'] }
const isTab = (v: string | null): v is TabId => !!v && v in TAB_KINDS
const TONE_BADGE: Record<SyncChange['impact']['tone'], 'neutral' | 'warning' | 'danger' | 'success'> = { neutral: 'neutral', warning: 'warning', danger: 'danger', success: 'success' }

export default function SyncReviewPage() {
  const [params, setParams] = useSearchParams()
  const supplierId = params.get('supplier') || 'sup_alpha'
  const [tab, setTab] = useState<TabId>(() => {
    const t = params.get('tab')
    return isTab(t) ? t : 'changed'
  })
  const [decision, setDecision] = useState<'pending' | 'all'>('pending')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const can = useCan('suppliers.manage')

  const suppliers = useSuppliers()
  const changes = useSyncChanges({ supplierId })
  const runs = useSyncRuns()
  const sup = suppliers.data?.find((s) => s.supplier.id === supplierId)
  const supplierRuns = useMemo(() => (runs.data ?? []).filter((r) => r.supplierId === supplierId), [runs.data, supplierId])
  const lastRun = supplierRuns[0] ?? null

  const all = changes.data ?? []
  const pending = all.filter((c) => c.decision === 'pending')
  const scope = decision === 'pending' ? all.filter((c) => c.decision === 'pending' || (c.kind === 'removed' && c.runId === lastRun?.id)) : all
  const rows = scope.filter((c) => TAB_KINDS[tab].includes(c.kind))
  const countOf = (kinds: SyncChange['kind'][]) => scope.filter((c) => kinds.includes(c.kind)).length
  const runCount = (k: SyncChange['kind']) => (lastRun ? lastRun.counts[k] : all.filter((c) => c.kind === k && c.decision === 'pending').length)
  const unchanged = lastRun && lastRun.status !== 'failed' ? summarizeSyncRun(lastRun, all).unchanged : null

  const decide = useInstMutation((v: { ids: string[]; decision: 'applied' | 'ignored' }) => suppliersService.decide(v.ids, v.decision), {
    success: (r, v) => `${r.length} change${r.length === 1 ? '' : 's'} ${v.decision === 'applied' ? 'applied' : 'ignored'}`,
    onSuccess: () => setSelected(new Set()),
  })
  const sync = useInstMutation(() => suppliersService.sync(supplierId), { success: (r) => (r.status === 'review_required' ? 'Sync complete — changes need review' : r.status === 'failed' ? `Sync failed${r.error ? `: ${r.error}` : ''}` : 'Catalog already in sync') })

  const selectable = rows.filter((c) => c.decision === 'pending')
  const allSel = selectable.length > 0 && selectable.every((c) => selected.has(c.id))
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <div>
      <PageHeader
        eyebrow="Provider API · inbound"
        title="Catalog sync review"
        description="syncCatalog() compares the provider’s service list with the supplier products ORVEX stores. Nothing changes silently: price, field and new-product changes wait for a decision; removals are applied immediately for safety. ORVEX services are never created or changed by a sync."
        actions={
          <>
            {pending.length > 0 && (
              <Guarded permission="suppliers.manage">
                {(ok) => (
                  <Button leading={<CheckCheck />} disabled={!ok} loading={decide.isPending && decide.variables?.ids.length === pending.length} onClick={() => decide.mutate({ ids: pending.map((c) => c.id), decision: 'applied' })}>
                    Apply sync ({pending.length})
                  </Button>
                )}
              </Guarded>
            )}
            <Guarded permission="suppliers.manage">
              {(ok) => (
                <Button variant="accent" leading={<RefreshCw />} disabled={!ok} loading={sync.isPending} onClick={() => sync.mutate()}>
                  Sync now
                </Button>
              )}
            </Guarded>
          </>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <Select
            className="w-[260px]"
            value={supplierId}
            onChange={(e) => {
              setParams({ supplier: e.target.value }, { replace: true })
              setSelected(new Set())
            }}
            options={(suppliers.data ?? [{ supplier: { id: supplierId, name: supplierId }, pendingChanges: 0 }]).map((s) => ({ value: s.supplier.id, label: `${s.supplier.name}${s.pendingChanges ? ` · ${s.pendingChanges} pending` : ''}` }))}
          />
          {sup && <HealthBadge health={sup.health} />}
          {sup && <span className="text-[12.5px] text-fg-3">{sup.driver.name}</span>}
          <SimulatedBadge />
          <div className="ml-auto text-[12.5px] text-fg-3">
            Last sync <RelTime iso={lastRun?.finishedAt ?? sup?.supplier.lastSyncAt} className="font-medium text-fg" />
            {lastRun && <> · {lastRun.trigger} · {lastRun.remoteProducts} remote products · <StatusBadge status={lastRun.status} className="ml-1" /></>}
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-line sm:grid-cols-3 lg:grid-cols-6">
          <CountTile icon={<Equal />} label="Unchanged" value={unchanged ?? 0} />
          <CountTile icon={<PackagePlus />} label="New products" value={runCount('new')} onClick={() => setTab('new')} />
          <CountTile icon={<Tags />} label="Price changes" value={runCount('price')} tone="warning" onClick={() => setTab('changed')} />
          <CountTile icon={<PackageMinus />} label="Removed" value={runCount('removed')} tone="danger" onClick={() => setTab('removed')} />
          <CountTile icon={<CloudDownload />} label="Field changes" value={runCount('fields')} onClick={() => setTab('changed')} />
          <CountTile icon={<TriangleAlert />} label="Warnings" value={runCount('warning')} tone="warning" onClick={() => setTab('warnings')} />
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-2">
            <Tabs
              className="border-0"
              value={tab}
              onChange={(t) => {
                setTab(t)
                setSelected(new Set())
              }}
              items={[
                { value: 'new', label: 'New', count: countOf(['new']) },
                { value: 'changed', label: 'Changed', count: countOf(['price', 'fields']) },
                { value: 'removed', label: 'Removed', count: countOf(['removed']) },
                { value: 'warnings', label: 'Warnings', count: countOf(['warning']) },
              ]}
            />
            <Segmented
              size="xs"
              value={decision}
              onChange={setDecision}
              items={[
                { value: 'pending', label: 'Needs decision', count: pending.length },
                { value: 'all', label: 'History' },
              ]}
            />
          </div>

          {tab === 'removed' && (
            <Callout tone="warning" icon={<ShieldAlert />} title="Auto-applied for safety" className="mx-4 mt-3">
              A removed product can no longer be ordered, so its offers are disabled immediately with a warning and routing continues with the next priority. Removed products never disappear silently — they stay listed here and on the supplier’s product list.
            </Callout>
          )}

          {selectable.length > 0 && (
            <div className="mx-4 mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2/50 px-3 py-2">
              <Checkbox checked={allSel} disabled={!can} onChange={(v) => setSelected(v ? new Set(selectable.map((c) => c.id)) : new Set())} label={<span className="text-[12.5px]">{selected.size ? `${selected.size} selected` : 'Select all'}</span>} />
              <div className="ml-auto flex items-center gap-2">
                {!can && <PermissionHint permission="suppliers.manage" />}
                <Button size="sm" variant="ghost" leading={<X />} disabled={!selected.size || !can} loading={decide.isPending && decide.variables?.decision === 'ignored'} onClick={() => decide.mutate({ ids: [...selected], decision: 'ignored' })}>
                  Ignore selected
                </Button>
                <Button size="sm" variant="primary" leading={<Check />} disabled={!selected.size || !can} loading={decide.isPending && decide.variables?.decision === 'applied'} onClick={() => decide.mutate({ ids: [...selected], decision: 'applied' })}>
                  Apply selected
                </Button>
              </div>
            </div>
          )}

          <div className="mt-3 border-t border-line">
            {changes.isError ? (
              <ErrorPanel error={changes.error} onRetry={() => changes.refetch()} className="m-4" />
            ) : changes.isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <EmptyState icon={<Check />} title={decision === 'pending' ? 'Nothing waiting here' : 'No changes recorded'} description={decision === 'pending' ? 'Every change in this group has a decision. Switch to History to see past decisions.' : 'Run a sync to compare the catalog.'} />
            ) : (
              rows.map((c) => <ChangeRow key={c.id} c={c} checked={selected.has(c.id)} onCheck={() => toggle(c.id)} can={can} busy={decide.isPending} onDecide={(dec) => decide.mutate({ ids: [c.id], decision: dec })} />)
            )}
          </div>
        </Card>

        <Card className="self-start">
          <CardHeader title="Run history" icon={<History />} description="This supplier" />
          {runs.isLoading ? (
            <div className="space-y-2 px-5 pb-5">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : supplierRuns.length === 0 ? (
            <EmptyState compact title="No runs yet" />
          ) : (
            <div className="divide-y divide-line border-t border-line">
              {supplierRuns.slice(0, 12).map((r) => (
                <div key={r.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px]">{dateTime(r.startedAt)}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-fg-3">
                    {r.trigger} · {r.counts.new} new · {r.counts.price} price · {r.counts.removed} removed · {r.counts.fields} fields · {r.counts.warning} warn
                  </div>
                  {r.error && <div className="text-[11.5px] text-danger">{r.error}</div>}
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-line px-4 py-2.5">
            <Link to={`/admin/suppliers/${supplierId}?tab=sync`} className="inline-flex items-center gap-1 text-[12px] text-accent-ink hover:underline">
              Supplier sync tab <ArrowRight className="size-3" />
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}

function CountTile({ icon, label, value, tone, onClick }: { icon: ReactNode; label: string; value: number; tone?: 'warning' | 'danger'; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className="border-line px-4 py-3 text-left transition-colors not-last:border-r enabled:hover:bg-surface-2/50 max-lg:border-b">
      <div className="flex items-center gap-1.5 text-[11.5px] text-fg-3 [&_svg]:size-3.5">
        {icon}
        {label}
      </div>
      <div className={cn('mt-1 font-display text-[22px] leading-none font-semibold tabular', value && tone === 'warning' ? 'text-warning' : value && tone === 'danger' ? 'text-danger' : 'text-fg')}>{value}</div>
    </button>
  )
}

function ChangeRow({ c, checked, onCheck, can, busy, onDecide }: { c: SyncChangeRow; checked: boolean; onCheck: () => void; can: boolean; busy: boolean; onDecide: (d: 'applied' | 'ignored') => void }) {
  const before = c.before?.cost
  const after = c.after?.cost
  const delta = before != null && after != null ? sub(after, before) : null
  const pend = c.decision === 'pending'
  return (
    <div className={cn('flex flex-col gap-3 border-b border-line px-4 py-3 last:border-0 lg:flex-row lg:items-center', checked && 'bg-accent/[0.04]')}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="pt-0.5">{pend ? <Checkbox checked={checked} disabled={!can} onChange={onCheck} /> : <span className="block size-4" />}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[13px] font-medium">{c.after?.name ?? c.name}</span>
            <span className="font-mono text-[11.5px] text-fg-3">#{c.externalId}</span>
            <Badge tone="neutral" variant="outline">
              {c.kind === 'warning' ? 'warning' : c.kind}
            </Badge>
          </div>
          {/* Diff */}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px]">
            {c.kind === 'price' && before != null && after != null && (
              <span className="inline-flex items-center gap-1.5 font-mono">
                <span className="text-fg-3 line-through">{formatMoney(before)}</span>
                <ArrowRight className="size-3 text-fg-3" />
                <span className="font-semibold text-fg">{formatMoney(after)}</span>
                {delta != null && <span className={cn('text-[11px]', delta > 0 ? 'text-warning' : 'text-success')}>({formatMoney(delta, { sign: true })})</span>}
              </span>
            )}
            {c.kind === 'new' && after != null && (
              <span className="text-fg-2">
                cost <Money value={after} className="font-mono" />
                {c.after?.groupName && <span className="text-fg-3"> · {c.after.groupName}</span>}
                {c.after?.fields && <span className="font-mono text-fg-3"> · {c.after.fields.join(', ')}</span>}
              </span>
            )}
            {c.kind === 'fields' && (
              <span className="inline-flex flex-wrap items-center gap-1 font-mono text-[11.5px]">
                {(c.before?.fields ?? []).map((f) => (
                  <span key={`b${f}`} className={cn('rounded px-1', c.after?.fields?.includes(f) ? 'bg-surface-2 text-fg-3' : 'bg-danger/10 text-danger line-through')}>
                    {f}
                  </span>
                ))}
                <ArrowRight className="size-3 text-fg-3" />
                {(c.after?.fields ?? []).map((f) => (
                  <span key={`a${f}`} className={cn('rounded px-1', c.before?.fields?.includes(f) ? 'bg-surface-2 text-fg-2' : 'bg-success/10 text-success')}>
                    {f}
                  </span>
                ))}
              </span>
            )}
            {c.before?.name && c.after?.name && c.before.name !== c.after.name && (
              <span className="text-fg-3">
                renamed from <span className="text-fg-2">“{c.before.name}”</span>
              </span>
            )}
            {c.kind === 'removed' && before != null && (
              <span className="text-fg-3">
                last cost <Money value={before} className="font-mono" />
              </span>
            )}
          </div>
          {/* Impact */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone={TONE_BADGE[c.impact.tone]} dot>
              {c.impact.summary}
            </Badge>
            {c.impact.marginBefore != null && c.impact.marginAfter != null && (
              <span className="text-[11.5px] text-fg-3">
                margin <Money value={c.impact.marginBefore} /> → <Money value={c.impact.marginAfter} tone="auto" />
              </span>
            )}
            {c.services.map((s) => (
              <Link key={s.id} to={`/admin/services/${s.id}?tab=offers`} className="rounded-md border border-line px-1.5 py-0.5 text-[11.5px] text-fg-2 hover:border-line-strong hover:text-fg">
                {s.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 pl-7 lg:pl-0">
        {pend ? (
          <>
            <Button size="sm" variant="ghost" disabled={!can || busy} onClick={() => onDecide('ignored')}>
              Ignore
            </Button>
            <Button size="sm" variant="primary" leading={<Check />} disabled={!can || busy} onClick={() => onDecide('applied')}>
              Apply
            </Button>
          </>
        ) : (
          <div className="text-right">
            <StatusBadge status={c.decision} label={c.kind === 'removed' && c.decision === 'applied' ? 'Auto-applied' : undefined} />
            {c.decidedAt && (
              <div className="mt-0.5 text-[11px] text-fg-3">
                {c.decidedBy ?? 'system'} · <RelTime iso={c.decidedAt} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
