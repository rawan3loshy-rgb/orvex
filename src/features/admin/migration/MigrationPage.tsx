import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleCheck,
  CircleX,
  CloudDownload,
  Database,
  FileArchive,
  FlaskConical,
  GitCompare,
  KeyRound,
  ListChecks,
  Play,
  PlugZap,
  ScanSearch,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import { useDhru, useInstMutation, useMigration } from '@/hooks/installation'
import { migrationService, type MigrationSource } from '@/services/installation'
import { Badge, Button, Card, CardBody, CardHeader, Checkbox, CopyButton, EmptyState, PageHeader, Progress, Skeleton, StatusBadge } from '@/components/ui'
import { Guarded, Money, PermissionHint, SimulatedBadge } from '@/components/domain'
import { formatMoney } from '@/core/money'
import { cn } from '@/lib/cn'
import { dateTime, num, time } from '@/lib/format'
import { QueryError } from '@/features/admin/developer/shared'

const STEPS = [
  { id: 'scan', label: 'Scan', icon: <ScanSearch />, desc: 'Read the DHRU export and count what is there.' },
  { id: 'dry_run', label: 'Dry run', icon: <FlaskConical />, desc: 'Map everything to ORVEX without writing — collect warnings.' },
  { id: 'diff', label: 'Diff', icon: <GitCompare />, desc: 'What would be created, updated or skipped.' },
  { id: 'review', label: 'Review', icon: <ListChecks />, desc: 'Resolve what needs a human decision.' },
  { id: 'import', label: 'Import', icon: <CloudDownload />, desc: 'Apply the plan (simulated).' },
  { id: 'validate', label: 'Validate', icon: <ShieldCheck />, desc: 'Reconcile and check the result.' },
] as const

type StepId = (typeof STEPS)[number]['id']

export default function MigrationPage() {
  const mig = useMigration()
  const [step, setStep] = useState(0)
  const [done, setDone] = useState<Set<StepId>>(new Set())
  const [runs, setRuns] = useState<{ step: string; at: string }[]>([])
  const run = useInstMutation((s: StepId) => migrationService.run(s), { onSuccess: (r) => setRuns((cur) => [{ step: r.step, at: r.at }, ...cur]) })

  const complete = async (id: StepId) => {
    await run.mutateAsync(id)
    setDone((d) => new Set(d).add(id))
  }
  const current = STEPS[step]!

  return (
    <div>
      <PageHeader
        icon={<CloudDownload />}
        title="DHRU migration"
        description="Bring a legacy DHRU Fusion panel into this installation: Scan → Dry run → Diff → Review → Import → Validate."
        eyebrow={<SimulatedBadge label="Simulation" />}
        actions={<PermissionHint permission="system.manage" />}
      />

      <div className="relative mb-5 overflow-hidden rounded-xl border border-dashed border-warning/50 bg-warning/[0.04] px-4 py-3 text-[13px] text-fg-2">
        <div className="pointer-events-none absolute inset-0 bg-hatch opacity-40" />
        <div className="relative flex items-start gap-2.5">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <p>
            <strong className="text-fg">Simulation — no external data is imported.</strong> The wizard runs against a fictional DHRU export bundled with the demo. Each step is recorded in the audit log so the flow is traceable, but no services, accounts or balances are written.
          </p>
        </div>
      </div>

      {mig.isError ? (
        <Card>
          <QueryError error={mig.error} onRetry={() => mig.refetch()} />
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <div className="space-y-4">
            <SourcePanel m={mig.data} />
            <Card>
              <CardHeader title="Audit trail" description="Each step run is written to the audit log" />
              <CardBody>
                {runs.length === 0 ? (
                  <p className="text-[12.5px] text-fg-3">No steps run yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {runs.map((r, i) => (
                      <li key={i} className="flex items-center gap-2 text-[12.5px]">
                        <Check className="size-3.5 text-success" />
                        <code className="font-mono text-fg">migration.{r.step}</code>
                        <span className="ml-auto font-mono text-[11px] text-fg-3">{time(r.at, true)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link to="/admin/system/audit?search=migration" className="mt-3 inline-flex items-center gap-1 text-[12.5px] text-accent-ink hover:underline">
                  Open audit log <ArrowUpRight className="size-3" />
                </Link>
              </CardBody>
            </Card>
          </div>

          <div className="min-w-0 space-y-4">
            <Stepper step={step} done={done} onStep={setStep} />
            <Card className="min-h-[420px]">
              <CardHeader icon={current.icon} title={`${step + 1}. ${current.label}`} description={current.desc} actions={done.has(current.id) && <Badge tone="success" icon={<Check />}>Done</Badge>} />
              <CardBody>
                {!mig.data ? (
                  <div className="space-y-3">
                    {Array.from({ length: 6 }, (_, i) => (
                      <Skeleton key={i} className="h-10" />
                    ))}
                  </div>
                ) : (
                  <AnimatePresence mode="wait">
                    <motion.div key={current.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                      {current.id === 'scan' && <ScanStep m={mig.data} done={done.has('scan')} pending={run.isPending} onRun={() => complete('scan')} />}
                      {current.id === 'dry_run' && <DryRunStep m={mig.data} done={done.has('dry_run')} pending={run.isPending} onRun={() => complete('dry_run')} />}
                      {current.id === 'diff' && <DiffStep m={mig.data} done={done.has('diff')} pending={run.isPending} onRun={() => complete('diff')} />}
                      {current.id === 'review' && <ReviewStep m={mig.data} done={done.has('review')} pending={run.isPending} onRun={() => complete('review')} />}
                      {current.id === 'import' && <ImportStep m={mig.data} done={done.has('import')} onRun={() => complete('import')} />}
                      {current.id === 'validate' && <ValidateStep m={mig.data} done={done.has('validate')} pending={run.isPending} onRun={() => complete('validate')} />}
                    </motion.div>
                  </AnimatePresence>
                )}
              </CardBody>
              <div className="flex items-center justify-between border-t border-line px-5 py-3">
                <Button variant="ghost" size="sm" leading={<ArrowLeft />} disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
                  Back
                </Button>
                {step < STEPS.length - 1 && (
                  <Button variant="primary" size="sm" trailing={<ArrowRight />} disabled={!done.has(current.id)} onClick={() => setStep((s) => s + 1)}>
                    Next: {STEPS[step + 1]!.label}
                  </Button>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------------- */

function Stepper({ step, done, onStep }: { step: number; done: Set<StepId>; onStep: (i: number) => void }) {
  return (
    <ol className="no-scrollbar flex items-center gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1.5 shadow-card">
      {STEPS.map((s, i) => {
        const reachable = i === 0 || done.has(STEPS[i - 1]!.id)
        const isDone = done.has(s.id)
        const active = i === step
        return (
          <li key={s.id} className="flex min-w-0 flex-1 items-center">
            <button
              type="button"
              disabled={!reachable}
              onClick={() => onStep(i)}
              className={cn('flex w-full min-w-[104px] items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors disabled:opacity-40', active ? 'bg-surface-3' : 'hover:bg-surface-2')}
            >
              <span className={cn('grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold', isDone ? 'bg-success text-white' : active ? 'bg-accent text-white' : 'border border-line-strong text-fg-3')}>
                {isDone ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className={cn('truncate text-[12.5px] font-medium', active ? 'text-fg' : 'text-fg-2')}>{s.label}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

function SourcePanel({ m }: { m: MigrationSource | undefined }) {
  return (
    <Card>
      <CardHeader icon={<Database />} title="Source panel" description={m?.panel ?? '…'} />
      <CardBody className="space-y-2.5 text-[12.5px]">
        {m ? (
          <>
            <Row label="Host">
              <span className="font-mono text-[12px]">{m.host}</span>
            </Row>
            <Row label="Database">{m.database}</Row>
            <Row label="Exported">{dateTime(m.exportedAt)}</Row>
            <div className="flex items-start gap-2 rounded-lg border border-line bg-surface-2/50 p-2.5">
              <FileArchive className="mt-0.5 size-4 shrink-0 text-fg-3" />
              <span className="min-w-0 font-mono text-[11.5px] break-all text-fg-2">{m.exportFile}</span>
            </div>
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-4" />)
        )}
      </CardBody>
    </Card>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-fg-3">{label}</span>
      <span className="min-w-0 truncate text-right text-fg">{children}</span>
    </div>
  )
}

function RunButton({ label, done, pending, onRun }: { label: string; done: boolean; pending?: boolean; onRun: () => void }) {
  return (
    <Guarded permission="system.manage">
      {(ok) => (
        <Button variant={done ? 'secondary' : 'accent'} leading={<Play />} disabled={!ok} loading={pending} onClick={onRun}>
          {done ? `Run ${label.toLowerCase()} again` : label}
        </Button>
      )}
    </Guarded>
  )
}

/** Counts up from 0 once `active` turns true. */
function useCountUp(target: number, active: boolean, duration = 900) {
  const [v, setV] = useState(active ? target : 0)
  const raf = useRef(0)
  // Back to 0 when deactivated (adjusted during render, not in the effect).
  const [wasActive, setWasActive] = useState(active)
  if (active !== wasActive) {
    setWasActive(active)
    if (!active) setV(0)
  }
  useEffect(() => {
    if (!active) return
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, active, duration])
  return v
}

function ScanStat({ label, value, sub, active, money }: { label: string; value: number; sub?: string; active: boolean; money?: boolean }) {
  const v = useCountUp(value, active)
  return (
    <div className="rounded-xl border border-line bg-surface-2/30 p-3.5">
      <div className="mono-label">{label}</div>
      <div className="mt-1.5 font-display text-[22px] leading-none font-semibold tracking-[-0.02em] tabular">{active ? (money ? formatMoney(v as never) : num(v)) : '—'}</div>
      {sub && <div className="mt-1 text-[11.5px] text-fg-3">{active ? sub : ' '}</div>}
    </div>
  )
}

function ScanStep({ m, done, pending, onRun }: { m: MigrationSource; done: boolean; pending: boolean; onRun: () => void }) {
  const s = m.scan
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <ScanStat label="Services" value={s.services} sub={`${num(s.activeServices)} active · ${s.categories} groups`} active={done} />
        <ScanStat label="Clients" value={s.clients} sub={`${num(s.activeClients)} active`} active={done} />
        <ScanStat label="Supplier connections" value={s.supplierConnections} sub="API connections" active={done} />
        <ScanStat label="Price groups" value={s.priceGroups} active={done} />
        <ScanStat label="Historical orders" value={s.orders} sub="Archive only" active={done} />
        <ScanStat label="Credit balances" value={s.creditBalances} sub="Client credits" active={done} money />
        <ScanStat label="DHRU API resellers" value={s.dhruApiResellers} sub="Use the DHRU API today" active={done} />
        <ScanStat label="Categories" value={s.categories} sub="DHRU service groups" active={done} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <RunButton label="Run scan" done={done} pending={pending} onRun={onRun} />
        <span className="text-[12.5px] text-fg-3">Read-only. Reads the export file; nothing in the legacy panel is touched.</span>
      </div>
    </div>
  )
}

function DryRunStep({ m, done, pending, onRun }: { m: MigrationSource; done: boolean; pending: boolean; onRun: () => void }) {
  const [open, setOpen] = useState<string | null>(m.warnings[0]?.id ?? null)
  if (!done)
    return (
      <EmptyState
        icon={<FlaskConical />}
        title="Map the export without writing anything"
        description="Every service, client, price group and connection is translated to ORVEX entities in memory. Anything that cannot be mapped cleanly becomes a warning with a suggested resolution."
        action={<RunButton label="Run dry run" done={false} pending={pending} onRun={onRun} />}
      />
    )
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-fg-2">
        <TriangleAlert className="size-4 text-warning" />
        <strong className="text-fg">{m.warnings.reduce((a, w) => a + w.count, 0)} items</strong> need attention in {m.warnings.length} groups. Nothing blocks the import.
      </div>
      {m.warnings.map((w) => (
        <div key={w.id} className="overflow-hidden rounded-xl border border-line">
          <button type="button" onClick={() => setOpen(open === w.id ? null : w.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/50">
            <span className="grid h-6 min-w-8 place-items-center rounded-md bg-warning/12 px-1.5 font-mono text-[12px] font-semibold text-warning tabular">{w.count}</span>
            <span className="min-w-0 flex-1 text-[13px] font-medium text-fg">{w.title}</span>
            <code className="hidden font-mono text-[11px] text-fg-3 sm:inline">{w.kind}</code>
            <ArrowRight className={cn('size-4 text-fg-3 transition-transform', open === w.id && 'rotate-90')} />
          </button>
          {open === w.id && (
            <div className="overflow-x-auto border-t border-line">
              <table className="w-full min-w-[560px] text-[12.5px]">
                <thead>
                  <tr className="bg-surface-2/50 text-left text-[11.5px] text-fg-3">
                    <th className="px-4 py-2 font-medium">Sample</th>
                    <th className="px-4 py-2 font-medium">Problem</th>
                    <th className="px-4 py-2 font-medium">Suggested resolution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {w.samples.map((s) => (
                    <tr key={s.ref} className="align-top">
                      <td className="px-4 py-2.5 text-fg">{s.ref}</td>
                      <td className="px-4 py-2.5 text-fg-2">{s.detail}</td>
                      <td className="px-4 py-2.5 text-success">{s.suggestion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {w.count > w.samples.length && <p className="border-t border-line px-4 py-2 text-[11.5px] text-fg-3">+ {w.count - w.samples.length} more of the same kind</p>}
            </div>
          )}
        </div>
      ))}
      <div className="pt-1">
        <RunButton label="Run dry run" done pending={pending} onRun={onRun} />
      </div>
    </div>
  )
}

function DiffStep({ m, done, pending, onRun }: { m: MigrationSource; done: boolean; pending: boolean; onRun: () => void }) {
  const totals = m.diff.reduce((a, d) => ({ create: a.create + d.create, update: a.update + d.update, skip: a.skip + d.skip }), { create: 0, update: 0, skip: 0 })
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[640px] text-[12.5px]">
          <thead>
            <tr className="border-b border-line bg-surface-2/50 text-left text-[11.5px] text-fg-3">
              <th className="px-4 py-2 font-medium">Entity</th>
              <th className="px-3 py-2 text-right font-medium">Create</th>
              <th className="px-3 py-2 text-right font-medium">Update</th>
              <th className="px-3 py-2 text-right font-medium">Skip</th>
              <th className="px-4 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {m.diff.map((d) => (
              <tr key={d.entity} className="align-top hover:bg-surface-2/30">
                <td className="px-4 py-2.5 font-medium whitespace-nowrap text-fg">{d.entity}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular">{d.create ? <span className="text-success">+{num(d.create)}</span> : <span className="text-fg-3">0</span>}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular">{d.update ? <span className="text-warning">~{num(d.update)}</span> : <span className="text-fg-3">0</span>}</td>
                <td className="px-3 py-2.5 text-right font-mono text-fg-3 tabular">{num(d.skip)}</td>
                <td className="px-4 py-2.5 text-fg-3">{d.note}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line-strong bg-surface-2/40 font-medium">
              <td className="px-4 py-2.5">Total</td>
              <td className="px-3 py-2.5 text-right font-mono text-success tabular">+{num(totals.create)}</td>
              <td className="px-3 py-2.5 text-right font-mono tabular">{num(totals.update)}</td>
              <td className="px-3 py-2.5 text-right font-mono text-fg-3 tabular">{num(totals.skip)}</td>
              <td className="px-4 py-2.5 text-[12px] font-normal text-fg-3">Opening balances post through the ledger (DR Migration Clearing / CR Customer Available).</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <RunButton label={done ? 'Recompute diff' : 'Confirm diff'} done={done} pending={pending} onRun={onRun} />
        <span className="text-[12.5px] text-fg-3">The installation is empty for these entities, so the plan only creates.</span>
      </div>
    </div>
  )
}

function ReviewStep({ m, done, pending, onRun }: { m: MigrationSource; done: boolean; pending: boolean; onRun: () => void }) {
  const [acks, setAcks] = useState({ creds: done, passwords: done, pricing: done, history: done })
  const all = Object.values(acks).every(Boolean)
  const needCreds = m.suppliers.filter((s) => s.status === 'needs_credentials')
  return (
    <div className="space-y-5">
      <section>
        <h4 className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
          <KeyRound className="size-3.5 text-fg-3" /> Supplier connections needing credentials
        </h4>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[520px] text-[12.5px]">
            <thead>
              <tr className="border-b border-line bg-surface-2/50 text-left text-[11.5px] text-fg-3">
                <th className="px-4 py-2 font-medium">Connection</th>
                <th className="px-3 py-2 font-medium">Driver</th>
                <th className="px-3 py-2 text-right font-medium">Services</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {m.suppliers.map((s) => (
                <tr key={s.name}>
                  <td className="px-4 py-2.5">
                    <div className="text-fg">{s.name}</div>
                    <div className="font-mono text-[11px] text-fg-3">{s.url}</div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[12px] text-fg-2">{s.driver}</td>
                  <td className="px-3 py-2.5 text-right tabular">{num(s.services)}</td>
                  <td className="px-4 py-2.5">{s.status === 'needs_credentials' ? <Badge tone="warning" dot>Needs credentials</Badge> : <StatusBadge status="connected" label="Mapped" noPulse />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1.5 text-[12px] text-fg-3">
          {needCreds.length} shown of {m.scan.supplierConnections} connections. DHRU never exports supplier API keys — re-enter them under Suppliers after import (they are stored encrypted, write-only).
        </p>
      </section>
      <section className="space-y-2.5">
        <h4 className="text-[13px] font-semibold">Acknowledge before importing</h4>
        <Checkbox checked={acks.creds} onChange={(v) => setAcks({ ...acks, creds: v })} label="Supplier credentials will be re-entered after import" description="Imported connections stay disabled until credentials are provided and a health probe passes." />
        <Checkbox checked={acks.passwords} onChange={(v) => setAcks({ ...acks, passwords: v })} label="Client passwords are not imported" description="Members receive a set-password invitation; MFA is offered on first login." />
        <Checkbox checked={acks.pricing} onChange={(v) => setAcks({ ...acks, pricing: v })} label="Apply the suggested pricing conversions" description="4 price-group rules are converted (cost-plus) and negative-margin overrides are flagged for review." />
        <Checkbox checked={acks.history} onChange={(v) => setAcks({ ...acks, history: v })} label="Order history goes to a read-only archive" description={`${num(m.scan.orders)} historical orders are not replayed through the live order engine.`} />
      </section>
      <RunButton label={done ? 'Re-confirm review' : 'Approve plan'} done={done} pending={pending} onRun={() => all && onRun()} />
      {!all && <p className="text-[12px] text-warning">Tick all four to approve the plan.</p>}
    </div>
  )
}

function ImportStep({ m, done, onRun }: { m: MigrationSource; done: boolean; onRun: () => Promise<void> }) {
  const entities = m.diff.filter((d) => d.create > 0)
  const [progress, setProgress] = useState<number[]>(() => entities.map(() => (done ? 100 : 0)))
  const [running, setRunning] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearInterval(timer.current), [])

  const overallOf = (p: number[]) => p.reduce((a, b) => a + b, 0) / Math.max(1, entities.length)

  const start = () => {
    setRunning(true)
    const next = entities.map(() => 0)
    setProgress(next.slice())
    let i = 0
    timer.current = window.setInterval(() => {
      next[i] = Math.min(100, (next[i] ?? 0) + 9 + Math.random() * 14)
      if (next[i]! >= 100) i++
      if (i >= entities.length) window.clearInterval(timer.current)
      setProgress(next.slice())
      // Record the step once every entity reached 100% (in the timer callback, outside any state updater).
      if (overallOf(next) >= 100) {
        setRunning(false)
        onRun()
      }
    }, 90)
  }
  const overall = overallOf(progress)

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-xl border border-dashed border-warning/50 bg-warning/[0.04] px-3.5 py-2.5 text-[12.5px] font-medium text-warning">
        <div className="pointer-events-none absolute inset-0 bg-hatch opacity-40" />
        <span className="relative">Simulation — no external data is imported</span>
      </div>
      <div>
        <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
          <span className="text-fg-2">{done ? 'Simulated import complete' : running ? 'Importing (simulated)…' : 'Ready'}</span>
          <span className="font-mono tabular">{Math.round(overall)}%</span>
        </div>
        <Progress value={overall} tone={done ? 'success' : 'accent'} />
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        {entities.map((e, i) => {
          const p = progress[i] ?? 0
          return (
            <li key={e.entity} className="flex items-center gap-3 px-4 py-2.5">
              <span className={cn('grid size-5 shrink-0 place-items-center rounded-full', p >= 100 ? 'bg-success text-white' : p > 0 ? 'bg-accent/15 text-accent-ink' : 'border border-line-strong')}>{p >= 100 && <Check className="size-3" />}</span>
              <span className="w-[150px] shrink-0 truncate text-[13px] text-fg">{e.entity}</span>
              <Progress value={p} size="sm" tone={p >= 100 ? 'success' : 'accent'} className="flex-1" />
              <span className="w-[86px] shrink-0 text-right font-mono text-[12px] text-fg-2 tabular">
                {num(Math.round((e.create * p) / 100))}/{num(e.create)}
              </span>
            </li>
          )
        })}
      </ul>
      <Guarded permission="system.manage">
        {(ok) => (
          <Button variant="accent" leading={<Play />} disabled={!ok || running} loading={running} onClick={start}>
            {done ? 'Run simulation again' : 'Start simulated import'}
          </Button>
        )}
      </Guarded>
    </div>
  )
}

function ValidateStep({ m, done, pending, onRun }: { m: MigrationSource; done: boolean; pending: boolean; onRun: () => void }) {
  const dhru = useDhru()
  const endpoint = dhru.data?.endpoint ?? 'https://portal.unlockdesk-demo.com/api/dhru'
  if (!done)
    return <EmptyState icon={<ShieldCheck />} title="Reconcile the result" description="Balances, offers, schemas, logins, credentials and the DHRU-compatible endpoint are checked." action={<RunButton label="Run validation" done={false} pending={pending} onRun={onRun} />} />
  const icon = { pass: <CircleCheck className="size-4 text-success" />, warn: <TriangleAlert className="size-4 text-warning" />, fail: <CircleX className="size-4 text-danger" /> }
  return (
    <div className="space-y-5">
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        {m.validation.map((v) => (
          <li key={v.id} className="flex items-start gap-3 px-4 py-3">
            <span className="mt-0.5 shrink-0">{icon[v.status]}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-fg">{v.label}</div>
              <div className="text-[12.5px] text-fg-3">{v.detail}</div>
            </div>
            <StatusBadge status={v.status} noPulse />
          </li>
        ))}
      </ul>

      <div className="relative overflow-hidden rounded-xl border border-line bg-surface-2/30 p-4">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
        <div className="relative space-y-3">
          <div className="flex items-center gap-2">
            <PlugZap className="size-4 text-accent-ink" />
            <h4 className="text-[14px] font-semibold">Existing DHRU resellers keep their integration</h4>
          </div>
          <p className="text-[13px] text-fg-2">
            The {m.scan.dhruApiResellers} resellers who call the old panel’s DHRU API only change the URL. They get a new ORVEX API key with DHRU compatibility, their <code className="font-mono">username</code> stays their account email, and <code className="font-mono">accountinfo</code> / <code className="font-mono">imeiservicelist</code> / <code className="font-mono">placeimeiorder</code> / <code className="font-mono">getimeiorder</code> keep working — translated at the edge into the same PlaceOrder command, with statuses mapped back to 0 / 1 / 3 / 4.
          </p>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
            <span className="mono-label">New endpoint</span>
            <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-fg">{endpoint}</code>
            <CopyButton value={endpoint} />
          </div>
          <div className="grid gap-2 text-[12.5px] sm:grid-cols-3">
            <Summary label="Opening balances" value={<Money value={m.scan.creditBalances} />} />
            <Summary label="Services created" value={num(m.diff.find((d) => d.entity === 'Services')?.create ?? 0)} />
            <Summary label="Accounts created" value={num(m.diff.find((d) => d.entity === 'Accounts')?.create ?? 0)} />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="primary" trailing={<ArrowUpRight />} to="/admin/developer/dhru">
              DHRU compatibility
            </Button>
            <Button size="sm" variant="secondary" to="/admin/developer/keys?create=1">
              Issue a DHRU key
            </Button>
            <Button size="sm" variant="ghost" to="/admin/suppliers">
              Re-enter supplier credentials
            </Button>
          </div>
        </div>
      </div>
      <RunButton label="Run validation" done pending={pending} onRun={onRun} />
    </div>
  )
}

function Summary({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2">
      <div className="mono-label">{label}</div>
      <div className="mt-1 font-display text-[17px] font-semibold tabular">{value}</div>
    </div>
  )
}
