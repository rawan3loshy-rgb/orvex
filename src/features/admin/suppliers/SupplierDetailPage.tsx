import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, CircleCheck, CloudDownload, KeyRound, Lock, PlugZap, RotateCcw, Wallet, Wrench, TriangleAlert } from 'lucide-react'
import { Badge, Button, Card, Drawer, EmptyState, Field, Input, Modal, SecretField, Skeleton, Tabs, Textarea } from '@/components/ui'
import { Guarded, HealthBadge, Money, PermissionHint, SimulatedBadge } from '@/components/domain'
import { useInstMutation, useSupplier } from '@/hooks/installation'
import { suppliersService } from '@/services/installation'
import type { SupplierDetail } from '@/types/installation'
import { formatMoney } from '@/core/money'
import { Callout, ConnectionSteps, ErrorPanel, RelTime, SupplierMark, type TestStep } from '../catalog/kit'
import { DRIVER_META } from '../catalog/helpers'
import { ErrorMappingsTab, HealthTab, LogTab, OverviewTab, ProductsTab, ReconciliationTab, SyncTab } from './detail/tabs'

type TabId = 'overview' | 'products' | 'sync' | 'health' | 'log' | 'errors' | 'reconciliation'
const TABS: TabId[] = ['overview', 'products', 'sync', 'health', 'log', 'errors', 'reconciliation']

export default function SupplierDetailPage() {
  const { id } = useParams()
  const q = useSupplier(id)
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab') as TabId | null
  const tab: TabId = raw && TABS.includes(raw) ? raw : 'overview'
  const setTab = (t: TabId) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true })

  if (q.isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    )
  if (q.isError || !q.data)
    return (
      <div>
        <Back />
        {q.isError ? <ErrorPanel error={q.error} onRetry={() => q.refetch()} /> : <Card><EmptyState title="Supplier not found" /></Card>}
      </div>
    )

  const d = q.data
  return (
    <div>
      <Back />
      <Header d={d} />
      <Tabs
        className="mb-5"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'overview', label: 'Overview' },
          { value: 'products', label: 'Products', count: d.products },
          { value: 'sync', label: 'Catalog sync', count: d.pendingChanges || undefined },
          { value: 'health', label: 'Health' },
          { value: 'log', label: 'Driver log', count: d.calls.length },
          { value: 'errors', label: 'Error mappings', count: d.supplier.errorMappings.length },
          { value: 'reconciliation', label: 'Reconciliation', count: d.reconciliation.drift !== 0 ? '!' : undefined },
        ]}
      />
      <div key={tab} className="animate-fade-up">
        {tab === 'overview' && <OverviewTab d={d} />}
        {tab === 'products' && <ProductsTab d={d} />}
        {tab === 'sync' && <SyncTab d={d} />}
        {tab === 'health' && <HealthTab d={d} />}
        {tab === 'log' && <LogTab d={d} />}
        {tab === 'errors' && <ErrorMappingsTab d={d} />}
        {tab === 'reconciliation' && <ReconciliationTab d={d} />}
      </div>
    </div>
  )
}

function Back() {
  return (
    <Link to="/admin/suppliers" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] text-fg-3 hover:text-fg">
      <ArrowLeft className="size-3.5" /> Suppliers
    </Link>
  )
}

function Header({ d }: { d: SupplierDetail }) {
  const s = d.supplier
  const [testOpen, setTestOpen] = useState(false)
  const [maint, setMaint] = useState(false)
  const [creds, setCreds] = useState(false)
  const balance = useInstMutation(() => suppliersService.balance(s.id), { success: (r) => (r.ok ? `Balance ${formatMoney(r.balance)} — ${r.message}` : r.message) })
  const sync = useInstMutation(() => suppliersService.sync(s.id), { success: (r) => (r.status === 'review_required' ? `Sync found changes — review required` : r.status === 'failed' ? `Sync failed: ${r.error ?? ''}` : 'Catalog in sync — no changes') })
  const reset = useInstMutation(() => suppliersService.resetCircuit(s.id), { success: 'Circuit reset to closed' })
  const maintOff = useInstMutation(() => suppliersService.maintenance(s.id, { active: false }), { success: 'Maintenance ended — supplier routable again' })

  return (
    <div className="mb-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <SupplierMark name={s.name} color={s.color} size="lg" />
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2 text-[12.5px] text-fg-3">
              <span>
                {DRIVER_META[s.driver].label} driver v{d.driver.version}
              </span>
              <span>·</span>
              <span className="font-mono">{s.connection.url}</span>
              <SimulatedBadge />
            </div>
            <h1 className="font-display text-[26px] leading-tight font-semibold tracking-[-0.025em]">{s.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <HealthBadge health={d.health} />
              <Badge tone="neutral" variant="outline">
                {d.metrics.successRate.toFixed(1)}% success 7d
              </Badge>
              <Badge tone="neutral" variant="outline">
                balance <Money value={s.reportedBalance} />
              </Badge>
              <Badge tone="neutral" variant="outline">
                {d.offers} offers · {d.services} services
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Guarded permission="suppliers.manage">
            {(ok) => (
              <Button size="sm" leading={<PlugZap />} disabled={!ok} onClick={() => setTestOpen(true)}>
                Test connection
              </Button>
            )}
          </Guarded>
          <Guarded permission="suppliers.manage">
            {(ok) => (
              <Button size="sm" leading={<Wallet />} disabled={!ok} loading={balance.isPending} onClick={() => balance.mutate()}>
                Get balance
              </Button>
            )}
          </Guarded>
          <Guarded permission="suppliers.manage">
            {(ok) => (
              <Button size="sm" leading={<CloudDownload />} disabled={!ok} loading={sync.isPending} onClick={() => sync.mutate()}>
                Sync catalog
              </Button>
            )}
          </Guarded>
          <Guarded permission="suppliers.manage">
            {(ok) =>
              s.maintenance.active ? (
                <Button size="sm" leading={<Wrench />} disabled={!ok} loading={maintOff.isPending} onClick={() => maintOff.mutate()}>
                  End maintenance
                </Button>
              ) : (
                <Button size="sm" variant="ghost" leading={<Wrench />} disabled={!ok} onClick={() => setMaint(true)}>
                  Maintenance
                </Button>
              )
            }
          </Guarded>
          {s.circuit.state !== 'closed' && (
            <Guarded permission="suppliers.manage">
              {(ok) => (
                <Button size="sm" variant="ghost" leading={<RotateCcw />} disabled={!ok} loading={reset.isPending} onClick={() => reset.mutate()}>
                  Reset circuit
                </Button>
              )}
            </Guarded>
          )}
          <Guarded permission="suppliers.credentials">
            {(ok) => (
              <Button size="sm" variant={s.auth.status === 'failed' ? 'accent' : 'ghost'} leading={<KeyRound />} disabled={!ok} onClick={() => setCreds(true)}>
                Update credentials
              </Button>
            )}
          </Guarded>
        </div>
      </div>

      {s.auth.status === 'failed' && (
        <Callout tone="danger" icon={<TriangleAlert />} title="Authentication failing — supplier skipped by routing" className="mt-4">
          {s.auth.message ?? 'The supplier rejected the stored credentials.'} Replace the credential with <b>Update credentials</b>, then run <b>Test connection</b>. Orders keep routing to the next offer meanwhile (auth failure = not accepted → failover-safe).
        </Callout>
      )}
      {s.maintenance.active && (
        <Callout icon={<Wrench />} title="In maintenance — skipped by routing" className="mt-4">
          {s.maintenance.note || 'No note.'} {s.maintenance.until && <>Until <RelTime iso={s.maintenance.until} />.</>}
        </Callout>
      )}
      {s.circuit.state !== 'closed' && (
        <Callout tone="warning" icon={<TriangleAlert />} title={s.circuit.state === 'open' ? 'Circuit open — skipped by routing' : 'Circuit half-open — probing with the next order'} className="mt-4">
          {s.circuit.consecutiveFailures} consecutive failures (threshold {s.circuit.threshold}). {s.circuit.state === 'open' ? `Moves to half-open after a ${s.circuit.cooldownSec}s cooldown` : 'One success closes it, one failure re-opens it'}
          {s.circuit.openedAt && <> · opened <RelTime iso={s.circuit.openedAt} /></>}.
        </Callout>
      )}

      <TestModal open={testOpen} onClose={() => setTestOpen(false)} d={d} />
      <MaintenanceModal open={maint} onClose={() => setMaint(false)} d={d} />
      <CredentialsDrawer open={creds} onClose={() => setCreds(false)} d={d} onTest={() => setTestOpen(true)} />
    </div>
  )
}

function TestModal({ open, onClose, d }: { open: boolean; onClose: () => void; d: SupplierDetail }) {
  const [steps, setSteps] = useState<TestStep[] | null>(null)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [runKey, setRunKey] = useState(0)
  const [done, setDone] = useState(false)
  const test = useInstMutation(() => suppliersService.test(d.supplier.id), {
    onSuccess: (r) => {
      setSteps(r.steps)
      setResult(r)
      setRunKey((k) => k + 1)
    },
  })
  const run = () => {
    setSteps(null)
    setResult(null)
    setDone(false)
    test.mutate()
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<PlugZap />}
      title={`Test connection · ${d.supplier.name}`}
      description={<span className="inline-flex items-center gap-2">{d.driver.protocol} <SimulatedBadge /></span>}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="accent" loading={test.isPending} onClick={run}>
            {steps ? 'Run again' : 'Run test'}
          </Button>
        </>
      }
    >
      <ConnectionSteps steps={steps} pending={test.isPending} runKey={runKey} onDone={() => setDone(true)} />
      {done && result && (
        <Callout tone={result.ok ? 'success' : 'danger'} icon={result.ok ? <CircleCheck /> : <TriangleAlert />} title={result.ok ? 'Connection OK' : 'Connection failed'} className="mt-3">
          {result.message}
        </Callout>
      )}
      {!steps && !test.isPending && <p className="mt-2 text-[12px] text-fg-3">testConnection() has no side effects — it never places an order.</p>}
    </Modal>
  )
}

function MaintenanceModal({ open, onClose, d }: { open: boolean; onClose: () => void; d: SupplierDetail }) {
  const [note, setNote] = useState('')
  const [until, setUntil] = useState('')
  const m = useInstMutation(() => suppliersService.maintenance(d.supplier.id, { active: true, note: note.trim(), until: until ? new Date(until).toISOString() : null }), {
    success: 'Maintenance on — routing skips this supplier',
    onSuccess: onClose,
  })
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<Wrench />}
      title="Start maintenance"
      description="Routing skips this supplier; its offers fall through to the next priority. Orders already accepted keep polling."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={m.isPending} onClick={() => m.mutate()}>
            Start maintenance
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Note">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Supplier announced server migration" className="min-h-16" />
        </Field>
        <Field label="Until" optional hint="Informational — end maintenance manually.">
          <Input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

function CredentialsDrawer({ open, onClose, d, onTest }: { open: boolean; onClose: () => void; d: SupplierDetail; onTest: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({})
  const save = useInstMutation(() => suppliersService.credentials(d.supplier.id, Object.entries(values).map(([key, value]) => ({ key, value }))), {
    success: 'Credentials replaced — run Test connection to verify',
    onSuccess: () => {
      setValues({})
      onClose()
      onTest()
    },
  })
  const any = Object.values(values).some((v) => v.trim().length >= 6)
  return (
    <Drawer
      open={open}
      onClose={onClose}
      icon={<KeyRound />}
      title="Update credentials"
      description={d.supplier.name}
      footer={
        <>
          <PermissionHint permission="suppliers.credentials" className="mr-auto" />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" disabled={!any} loading={save.isPending} onClick={() => save.mutate()}>
            Replace &amp; test
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        <Callout icon={<Lock />} title="Secrets are write-only">
          Stored values are encrypted at rest and never returned by the API — only a mask. Enter a new value to replace one; leave a field empty to keep it. The change is audited (severity critical) without the value.
        </Callout>
        {d.supplier.connection.credentials.map((c) => (
          <div key={c.key} className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[12.5px] font-medium">{c.label}</span>
              <span className="text-[11.5px] text-fg-3">
                replaced <RelTime iso={c.updatedAt} />
              </span>
            </div>
            <SecretField masked={c.masked} label={c.label} />
            <Input type="password" mono value={values[c.key] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [c.key]: e.target.value }))} placeholder={`New ${c.label.toLowerCase()}`} autoComplete="new-password" />
          </div>
        ))}
        {d.supplier.connection.credentials.length === 0 && <p className="text-[12.5px] text-fg-3">This supplier has no stored credentials.</p>}
        {d.supplier.auth.status === 'failed' && (
          <Callout tone="danger" icon={<TriangleAlert />}>
            Last auth check failed <RelTime iso={d.supplier.auth.checkedAt} />: {d.supplier.auth.message}
          </Callout>
        )}
      </div>
    </Drawer>
  )
}
