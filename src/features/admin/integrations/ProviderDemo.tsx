import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Check, CircleCheck, CloudDownload, ExternalLink, KeyRound, PackageMinus, PackagePlus, PencilLine, PlugZap, Equal, TriangleAlert, X } from 'lucide-react'
import { Badge, Button, Card, Skeleton, StatusBadge } from '@/components/ui'
import { Guarded, HealthBadge, Money, PermissionHint, SimulatedBadge, useCan } from '@/components/domain'
import { useInstMutation, useSupplier, useSyncChanges } from '@/hooks/installation'
import { suppliersService, type SyncChangeRow } from '@/services/installation'
import { summarizeSyncRun } from '@/core/services/catalogSync'
import { formatMoney, sub } from '@/core/money'
import type { SupplierDetail, SyncChange, SyncRun } from '@/types/installation'
import { cn } from '@/lib/cn'
import { dateTime, num } from '@/lib/format'
import { Callout, ConnectionSteps, ErrorPanel, SupplierMark, type TestStep } from '../catalog/kit'
import { DRIVER_META } from '../catalog/helpers'

/** The Provider-API walkthrough supplier (see mock data/providerCatalog.ts). */
export const DEMO_PROVIDER_ID = 'sup_global'

const STAGES = ['Connect API', 'Test connection', 'Sync catalog', 'Review changes', 'Apply sync'] as const

export function ProviderDemoCard() {
  const q = useSupplier(DEMO_PROVIDER_ID)
  if (q.isError) return <ErrorPanel error={q.error} onRetry={() => q.refetch()} />
  if (q.isLoading || !q.data) return <Skeleton className="h-[460px] rounded-xl" />
  return <ProviderDemo d={q.data} />
}

function ProviderDemo({ d }: { d: SupplierDetail }) {
  const s = d.supplier
  const can = useCan('suppliers.manage')
  const changesQ = useSyncChanges({ supplierId: s.id })
  const [panel, setPanel] = useState<'none' | 'test' | 'sync'>('none')
  const [steps, setSteps] = useState<TestStep[] | null>(null)
  const [runKey, setRunKey] = useState(0)
  const [animDone, setAnimDone] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [sessionRunId, setSessionRunId] = useState<string | null>(null)

  const available = d.productList.filter((p) => p.status === 'available')
  const mapped = available.filter((p) => p.offerCount > 0).length
  const runs = useMemo(() => d.syncRuns.slice().sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)), [d.syncRuns])
  const allChanges = useMemo(() => changesQ.data ?? [], [changesQ.data])
  const pendingRun = runs.find((r) => allChanges.some((c) => c.runId === r.id && c.decision === 'pending')) ?? null
  // The run under review: the one started here, or one still waiting for decisions (e.g. after a reload).
  const activeRun: SyncRun | null = (sessionRunId ? runs.find((r) => r.id === sessionRunId) : null) ?? (sessionRunId ? null : pendingRun)
  const runChanges = useMemo(() => (activeRun ? allChanges.filter((c) => c.runId === activeRun.id) : []), [activeRun, allChanges])
  const pending = runChanges.filter((c) => c.decision === 'pending')
  const summary = activeRun ? summarizeSyncRun(activeRun, allChanges) : null
  const showResult = !!activeRun && (panel !== 'sync' || animDone)

  const stage = !activeRun ? 2 : pending.length ? 3 : 5
  const lastRun = runs[0] ?? null

  const test = useInstMutation(() => suppliersService.test(s.id), {
    onSuccess: (r) => {
      setSteps(r.steps)
      setTestResult({ ok: r.ok, message: r.message })
      setRunKey((k) => k + 1)
    },
  })
  const sync = useInstMutation((_stored: number) => suppliersService.sync(s.id), {
    onSuccess: (run, stored) => {
      setSessionRunId(run.id)
      setSteps([
        { label: `GET /v1/products — ${num(run.remoteProducts)} services received`, ok: run.status !== 'failed', ms: 520 },
        { label: 'Normalize names, groups, input fields and costs', ok: true, ms: 360 },
        { label: `Compare with ${num(stored)} stored supplier products`, ok: true, ms: 420 },
        { label: 'Classify: unchanged · new · changed · removed', ok: true, ms: 300 },
      ])
      setRunKey((k) => k + 1)
    },
  })
  const decide = useInstMutation((v: { ids: string[]; decision: 'applied' | 'ignored' }) => suppliersService.decide(v.ids, v.decision), {
    success: (r, v) => (v.decision === 'applied' ? `Sync applied — ${r.length} change${r.length === 1 ? '' : 's'} written to supplier products` : `${r.length} change${r.length === 1 ? '' : 's'} ignored`),
  })

  const runTest = () => {
    setPanel('test')
    setSteps(null)
    setTestResult(null)
    setAnimDone(false)
    test.mutate()
  }
  const runSync = () => {
    setPanel('sync')
    setSteps(null)
    setAnimDone(false)
    sync.mutate(available.length)
  }

  return (
    <Card className="overflow-hidden">
      {/* Identity */}
      <div className="flex flex-col gap-4 border-b border-line p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <SupplierMark name={s.name} color={s.color} size="lg" />
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2 text-[12px] text-fg-3">
              Demo provider <SimulatedBadge />
            </div>
            <Link to={`/admin/suppliers/${s.id}`} className="font-display text-[22px] leading-tight font-semibold tracking-[-0.02em] hover:underline">
              {s.name}
            </Link>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge tone={s.auth.status === 'ok' ? 'success' : 'danger'} dot>
                {s.auth.status === 'ok' ? 'Connected' : 'Auth failing'}
              </Badge>
              <HealthBadge health={d.health} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!can && <PermissionHint permission="suppliers.manage" />}
          <Guarded permission="suppliers.manage">
            {(ok) => (
              <Button leading={<PlugZap />} disabled={!ok || sync.isPending} loading={test.isPending} onClick={runTest}>
                Test connection
              </Button>
            )}
          </Guarded>
          <Guarded permission="suppliers.manage">
            {(ok) => (
              <Button variant="accent" leading={<CloudDownload />} disabled={!ok || test.isPending} loading={sync.isPending} onClick={runSync}>
                Sync catalog
              </Button>
            )}
          </Guarded>
        </div>
      </div>

      {/* Facts */}
      <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4 lg:grid-cols-[minmax(0,1.9fr)_repeat(3,minmax(0,1fr))]">
        <Fact label="API" className="col-span-2 sm:col-span-4 lg:col-span-1">
          <span className="block truncate font-mono text-[12.5px]">{s.connection.url}</span>
        </Fact>
        <Fact label="Catalog">{num(available.length)} services</Fact>
        <Fact label="Mapped">{mapped} offers</Fact>
        <Fact label="Last sync" className="col-span-2 sm:col-span-1">
          {lastRun ? dateTime(lastRun.finishedAt) : '—'}
        </Fact>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-5 py-2.5 text-[12px] text-fg-3">
        <span>
          Adapter <span className="text-fg-2">{DRIVER_META[s.driver].label} v{d.driver.version}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <KeyRound className="size-3" /> API key auth · {s.connection.credentials[0]?.masked ?? '—'}
        </span>
        <span>
          <span className="text-fg-2">{mapped}</span> products mapped to <span className="text-fg-2">{d.services}</span> ORVEX services · {num(available.length - mapped)} not on sale
        </span>
        <span>
          Balance <Money value={s.reportedBalance} className="text-fg-2" />
        </span>
        <Link to={`/admin/suppliers/${s.id}`} className="ml-auto inline-flex items-center gap-1 text-accent-ink hover:underline">
          Supplier detail <ExternalLink className="size-3" />
        </Link>
      </div>

      {/* Stepper */}
      <div className="border-t border-line px-5 py-4">
        <ol className="grid grid-cols-5 gap-1.5">
          {STAGES.map((label, i) => {
            const done = i < stage
            const current = i === stage && stage < STAGES.length
            return (
              <li key={label} className="min-w-0">
                <div className={cn('h-1 rounded-full', done ? 'bg-success' : current ? 'bg-accent' : 'bg-line')} />
                <div className={cn('mt-1.5 flex items-center gap-1 truncate text-[11.5px]', done ? 'text-fg-2' : current ? 'font-medium text-fg' : 'text-fg-3')}>
                  {done && <Check className="size-3 shrink-0 text-success" />}
                  <span className="truncate">
                    <span className="hidden sm:inline">{i + 1}. </span>
                    {label}
                  </span>
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      {/* Activity */}
      <div className="border-t border-line bg-bg-subtle/50 px-5 py-4">
        {panel !== 'none' && (
          <div className="mb-4">
            <div className="mb-2 text-[12.5px] font-medium">{panel === 'test' ? 'testConnection() · GET /v1/account' : 'syncCatalog() · GET /v1/products'}</div>
            <ConnectionSteps steps={steps} pending={panel === 'test' ? test.isPending : sync.isPending} runKey={runKey} onDone={() => setAnimDone(true)} />
            {panel === 'test' && animDone && testResult && (
              <Callout tone={testResult.ok ? 'success' : 'danger'} icon={testResult.ok ? <CircleCheck /> : <TriangleAlert />} title={testResult.ok ? 'Connection OK' : 'Connection failed'} className="mt-3">
                {testResult.message}. No order was placed — testConnection() has no side effects.
              </Callout>
            )}
          </div>
        )}

        {!activeRun && panel !== 'sync' && (
          <p className="text-[12.5px] text-fg-2">
            {lastRun ? (
              <>
                Last sync {dateTime(lastRun.finishedAt)} ({lastRun.trigger}) read {num(lastRun.remoteProducts)} services — <StatusBadge status={lastRun.status} className="mx-0.5" />.{' '}
              </>
            ) : null}
            The provider has updated its catalog since then. <b className="font-medium text-fg">Sync catalog</b> fetches the full service list and compares it with the {num(available.length)} stored supplier products.
          </p>
        )}

        <AnimatePresence>
          {showResult && summary && activeRun && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-[13px] font-semibold">
                  Catalog sync result · {num(summary.remote)} services discovered
                </div>
                <div className="text-[11.5px] text-fg-3">
                  {dateTime(activeRun.finishedAt)} · {activeRun.trigger} · <StatusBadge status={activeRun.status} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <ResultTile icon={<Equal />} label="Unchanged" value={summary.unchanged} />
                <ResultTile icon={<PackagePlus />} label="New" value={summary.added} tone="success" />
                <ResultTile icon={<PencilLine />} label="Changed" value={summary.changed} tone="warning" />
                <ResultTile icon={<PackageMinus />} label="Removed" value={summary.removed} tone="danger" />
              </div>

              {runChanges.length > 0 && (
                <div className="mt-4 overflow-hidden rounded-lg border border-line bg-surface">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
                    <div className="text-[12.5px] font-medium">
                      Review · {pending.length ? `${pending.length} waiting for a decision` : 'all changes decided'}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link to={`/admin/catalog/sync?supplier=${s.id}`} className="text-[12px] text-accent-ink hover:underline">
                        Full review
                      </Link>
                      {pending.length > 0 && (
                        <>
                          <Button size="sm" variant="ghost" leading={<X />} disabled={!can || decide.isPending} onClick={() => decide.mutate({ ids: pending.map((c) => c.id), decision: 'ignored' })}>
                            Ignore all
                          </Button>
                          <Button size="sm" variant="primary" leading={<Check />} disabled={!can} loading={decide.isPending} onClick={() => decide.mutate({ ids: pending.map((c) => c.id), decision: 'applied' })}>
                            Apply sync ({pending.length})
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="divide-y divide-line">
                    {sortChanges(runChanges).map((c) => (
                      <ChangeLine key={c.id} c={c} can={can} busy={decide.isPending} onDecide={(decision) => decide.mutate({ ids: [c.id], decision })} />
                    ))}
                  </div>
                </div>
              )}

              {pending.length === 0 && runChanges.some((c) => c.decision === 'applied') && (
                <Callout tone="success" icon={<CircleCheck />} title="Sync applied — supplier products updated" className="mt-3">
                  New products were added as <b>supplier products</b> (source data with their own cost). They are not on sale yet: map them to an ORVEX service as an offer, and customers keep buying the ORVEX service.
                  <div className="mt-2 flex flex-wrap gap-3">
                    <Link to={`/admin/suppliers/${s.id}?tab=products&filter=unmapped`} className="inline-flex items-center gap-1 font-medium text-accent-ink hover:underline">
                      Map new products to services <ArrowRight className="size-3.5" />
                    </Link>
                    <Link to="/admin/services" className="inline-flex items-center gap-1 text-fg-2 hover:underline">
                      ORVEX service catalog <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </Callout>
              )}
              {runChanges.length === 0 && activeRun.status !== 'failed' && <p className="mt-3 text-[12.5px] text-fg-3">Catalog already in sync — nothing to review.</p>}
              {activeRun.error && (
                <Callout tone="danger" icon={<TriangleAlert />} title="Sync failed" className="mt-3">
                  {activeRun.error}
                </Callout>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  )
}

const ORDER: SyncChange['kind'][] = ['new', 'price', 'fields', 'warning', 'removed']
function sortChanges(cs: SyncChangeRow[]) {
  return cs.slice().sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))
}

const KIND: Record<SyncChange['kind'], { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  new: { label: 'New', tone: 'success' },
  price: { label: 'Changed · price', tone: 'warning' },
  fields: { label: 'Changed · fields', tone: 'warning' },
  warning: { label: 'Warning', tone: 'warning' },
  removed: { label: 'Removed', tone: 'danger' },
}

function ChangeLine({ c, can, busy, onDecide }: { c: SyncChangeRow; can: boolean; busy: boolean; onDecide: (d: 'applied' | 'ignored') => void }) {
  const before = c.before?.cost
  const after = c.after?.cost
  const delta = before != null && after != null ? sub(after, before) : null
  return (
    <div className="flex flex-col gap-2 px-3.5 py-2.5 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={KIND[c.kind].tone} variant="outline">
            {KIND[c.kind].label}
          </Badge>
          <span className="truncate text-[13px] font-medium">{c.after?.name ?? c.name}</span>
          <span className="font-mono text-[11.5px] text-fg-3">#{c.externalId}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-fg-3">
          {c.kind === 'new' && after != null && (
            <span>
              cost <Money value={after} className="font-mono text-fg-2" />
              {c.after?.groupName && <> · {c.after.groupName}</>}
            </span>
          )}
          {c.kind === 'price' && before != null && after != null && (
            <span className="inline-flex items-center gap-1 font-mono">
              <span className="line-through">{formatMoney(before)}</span>
              <ArrowRight className="size-3" />
              <span className="font-semibold text-fg">{formatMoney(after)}</span>
              {delta != null && <span className={delta > 0 ? 'text-warning' : 'text-success'}>({formatMoney(delta, { sign: true })})</span>}
            </span>
          )}
          {c.kind === 'fields' && (
            <span className="font-mono">
              {(c.before?.fields ?? []).join(', ')} → <span className="text-fg-2">{(c.after?.fields ?? []).join(', ')}</span>
            </span>
          )}
          <span>{c.impact.summary}</span>
          {c.services.map((sv) => (
            <Link key={sv.id} to={`/admin/services/${sv.id}?tab=offers`} className="rounded-md border border-line px-1.5 py-px text-[11.5px] text-fg-2 hover:border-line-strong hover:text-fg">
              {sv.name}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {c.decision === 'pending' ? (
          <>
            <Button size="xs" variant="ghost" disabled={!can || busy} onClick={() => onDecide('ignored')}>
              Ignore
            </Button>
            <Button size="xs" variant="secondary" leading={<Check />} disabled={!can || busy} onClick={() => onDecide('applied')}>
              Apply
            </Button>
          </>
        ) : (
          <StatusBadge status={c.decision} label={c.kind === 'removed' && c.decision === 'applied' ? 'Auto-applied' : undefined} />
        )}
      </div>
    </div>
  )
}

function Fact({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 bg-surface px-5 py-3', className)}>
      <div className="mono-label">{label}</div>
      <div className="mt-1 truncate text-[13.5px] font-medium text-fg">{children}</div>
    </div>
  )
}

function ResultTile({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone?: 'success' | 'warning' | 'danger' }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-[11.5px] text-fg-3 [&_svg]:size-3.5">
        {icon}
        {label}
      </div>
      <div className={cn('mt-1 font-display text-[24px] leading-none font-semibold tabular', value && tone === 'success' ? 'text-success' : value && tone === 'warning' ? 'text-warning' : value && tone === 'danger' ? 'text-danger' : 'text-fg')}>{num(value)}</div>
    </div>
  )
}
