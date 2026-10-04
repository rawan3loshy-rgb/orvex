import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Check, ChevronDown, CircleCheck, CircleX, Layers, LoaderCircle, Lock, Maximize2, Minimize2, RotateCcw, ShieldCheck, Sparkles, TriangleAlert } from 'lucide-react'
import { Badge, Button, Checkbox, DemoTag, Modal, Progress } from '@/components/ui'
import { cn } from '@/lib/cn'
import { duration, time } from '@/lib/format'
import type { Release } from '@/types/release'
import { mb } from './lib'
import { runProgress, useUpdateRun, type LogLine } from './store'
import { SPEED, STEP_ICONS, buildSteps, totalDuration, type RunParams, type StepDef } from './steps'

/* ------------------------------------------------------------------ */
/*  Modal host                                                         */
/* ------------------------------------------------------------------ */
export function UpdateRunModal({ prepare, onViewNotes }: { prepare: () => RunParams | null; onViewNotes: (r: Release) => void }) {
  const status = useUpdateRun((s) => s.status)
  const minimized = useUpdateRun((s) => s.minimized)
  const dismiss = useUpdateRun((s) => s.dismiss)
  const open = status !== 'idle' && !minimized

  return (
    <>
      <Modal open={open} onClose={dismiss} size="xl" hideClose>
        {status === 'confirm' && <ConfirmView prepare={prepare} />}
        {(status === 'running' || status === 'committing') && <RunView />}
        {status === 'complete' && <SuccessView onViewNotes={onViewNotes} />}
        {status === 'failed' && <FailedView />}
      </Modal>
      <MinimizedDock />
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  1 · Confirm                                                        */
/* ------------------------------------------------------------------ */
function ConfirmView({ prepare }: { prepare: () => RunParams | null }) {
  const dismiss = useUpdateRun((s) => s.dismiss)
  const start = useUpdateRun((s) => s.start)
  const params = prepare()
  const [ack, setAck] = useState(false)
  if (!params) return null
  const steps = buildSteps(params)
  const rel = params.release
  const needsAck = params.incompatible.length > 0

  return (
    <div className="space-y-5 pt-1">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-accent-ink">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <h2 className="flex flex-wrap items-center gap-2 text-[16px] font-semibold tracking-[-0.01em]">
              Back up & update to {params.to} <DemoTag />
            </h2>
            <p className="mt-0.5 text-[13px] text-fg-3">{rel.title}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={dismiss}>
          Cancel
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Fact label="Version" value={`${params.from} → ${params.to}`} />
        <Fact label="Database" value={rel.migration ? `schema ${rel.migration.from} → ${rel.migration.to}` : 'no migration'} />
        <Fact label="Package" value={`${mb(rel.package.sizeBytes)} · signed`} />
      </div>

      <div>
        <div className="mono-label mb-2">Sequence</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {steps.map((s, i) => (
            <span key={s.id} className="flex items-center gap-1.5">
              <span className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 text-[12px] text-fg-2 [&_svg]:size-3.5">
                <s.icon />
                {s.label}
              </span>
              {i < steps.length - 1 && <ArrowRight className="size-3 text-fg-3" />}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-line bg-surface-2/40 p-4">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 grid size-4 place-items-center rounded-[5px] border border-accent bg-accent text-white">
            <Check className="size-3" strokeWidth={3} />
          </span>
          <div className="min-w-0 text-[13px]">
            <p className="flex items-center gap-2 text-fg">
              Create a full backup first <Lock className="size-3 text-fg-3" />
            </p>
            <p className="text-[12px] text-fg-3">Always required — pg_dump of {params.dbName} ({params.backupSizeGb.toFixed(2)} GB) plus config & extensions snapshot.</p>
          </div>
        </div>
        {needsAck && (
          <div className="rounded-lg border border-warning/30 bg-warning/[0.06] p-3">
            <Checkbox
              checked={ack}
              onChange={setAck}
              label={
                <span>
                  I understand <span className="font-medium">{params.incompatible.map((e) => e.name).join(', ')}</span> will be disabled
                </span>
              }
              description={`Declares ${params.incompatible.map((e) => e.coreRange).join(', ')} — not compatible with ${params.to}. Routing falls back to your standard rules until a compatible version is installed.`}
            />
          </div>
        )}
        <p className="flex items-start gap-2 text-[12px] text-fg-3">
          <Layers className="mt-0.5 size-3.5 shrink-0" />
          {params.awaitingCallbacks > 0 ? `${params.awaitingCallbacks} unlock and server jobs already at suppliers keep running` : 'Jobs already at suppliers keep running'} — their callbacks are buffered and replayed after restart.
        </p>
        <p className="flex items-start gap-2 text-[12px] text-fg-3">
          <RotateCcw className="mt-0.5 size-3.5 shrink-0" />
          If the post-update health check fails, Core restores the backup and the previous images automatically.
        </p>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12px] text-fg-3">Estimated ~{duration(Math.round((totalDuration(steps) * SPEED) / 1000))} on your server · ~20 s Reseller API write pause. Prototype: simulated, nothing on a server changes.</p>
        <Button variant="accent" disabled={needsAck && !ack} onClick={() => start(params)} leading={<ShieldCheck />} className="shrink-0">
          Start backup & update
        </Button>
      </div>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line px-3.5 py-3">
      <div className="mono-label">{label}</div>
      <div className="mt-1 font-mono text-[13px] text-fg">{value}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  2 · Running                                                        */
/* ------------------------------------------------------------------ */
function RunView() {
  const { steps, elapsed, status, params, logs, minimize } = useUpdateRun()
  const { index, stepProgress, overall } = runProgress(steps, elapsed, status)
  const step = steps[index]
  const simElapsed = (elapsed * SPEED) / 1000
  const simTotal = (totalDuration(steps) * SPEED) / 1000

  return (
    <div className="space-y-5 pt-1">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="relative grid size-10 shrink-0 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-accent-ink">
            <LoaderCircle className="size-5 animate-spin" />
          </span>
          <div className="min-w-0">
            <h2 className="flex flex-wrap items-center gap-2 text-[16px] font-semibold tracking-[-0.01em]">
              Updating ORVEX Core
              <span className="font-mono text-[13px] font-normal text-fg-2">
                {params?.from} → {params?.to}
              </span>
            </h2>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p key={step?.id ?? 'x'} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="mt-0.5 text-[13px] text-fg-3">
                Step {Math.min(index + 1, steps.length)} of {steps.length} · {status === 'committing' ? 'Recording result in update history…' : step?.active}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={minimize} leading={<Minimize2 />}>
          <span className="hidden sm:inline">Minimize</span>
        </Button>
      </div>

      <div>
        <div className="mb-2 flex items-end justify-between gap-3">
          <span className="font-display text-[28px] leading-none font-semibold tracking-[-0.025em] tabular">{Math.floor(overall * 100)}%</span>
          <span className="font-mono text-[11.5px] text-fg-3 tabular">
            {clock(simElapsed)} elapsed · ~{clock(Math.max(0, simTotal - simElapsed))} left
          </span>
        </div>
        <div className="relative h-2 overflow-hidden rounded-full bg-hatch shadow-[inset_0_0_0_1px_var(--line)]">
          <motion.div className="absolute inset-y-0 left-0 rounded-full bg-accent" animate={{ width: `${overall * 100}%` }} transition={{ ease: 'linear', duration: 0.1 }} />
        </div>
      </div>

      {/* Compact step indicator on small screens */}
      <div className="md:hidden">
        <div className="flex gap-1">
          {steps.map((s, i) => (
            <span key={s.id} className={cn('h-1 flex-1 rounded-full transition-colors', i < index ? 'bg-success' : i === index ? 'animate-pulse bg-accent' : 'bg-fg/10')} />
          ))}
        </div>
        {step && (
          <div className="mt-3 rounded-xl border border-line bg-surface-2/50 px-3.5 py-3">
            <p className="flex items-center gap-2 text-[13px] font-medium text-fg">
              <LoaderCircle className="size-3.5 animate-spin text-accent-ink" />
              {step.label}
            </p>
            <p className="mt-0.5 text-[12px] text-fg-3 tabular">{step.detail(Math.min(1, stepProgress))}</p>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-[230px_minmax(0,1fr)]">
        <div className="hidden md:block">
          <StepList steps={steps} index={index} stepProgress={stepProgress} status={status} />
        </div>
        <Terminal logs={logs} live />
      </div>

      <p className="flex items-center gap-2 border-t border-line pt-4 text-[12px] text-fg-3">
        <ShieldCheck className="size-3.5 shrink-0" />
        The update runs on your server — closing or minimizing this window doesn’t interrupt it.
      </p>
    </div>
  )
}

function StepList({ steps, index, stepProgress, status }: { steps: StepDef[]; index: number; stepProgress: number; status: string }) {
  const CompleteIcon = STEP_ICONS.complete
  const done = status === 'complete'
  return (
    <ol className="relative space-y-0.5">
      {steps.map((s, i) => {
        const state = i < index || done ? 'done' : i === index ? 'active' : 'pending'
        return (
          <li key={s.id} className={cn('relative rounded-lg px-2.5 py-2 transition-colors', state === 'active' && 'bg-surface-2')}>
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-full ring-1 [&_svg]:size-3.5',
                  state === 'done' && 'bg-success/15 text-success ring-success/30',
                  state === 'active' && 'bg-accent/15 text-accent-ink ring-accent/30',
                  state === 'pending' && 'bg-surface-2 text-fg-3 ring-line',
                )}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {state === 'done' ? (
                    <motion.span key="d" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}>
                      <Check strokeWidth={3} />
                    </motion.span>
                  ) : state === 'active' ? (
                    <motion.span key="a" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <LoaderCircle className="animate-spin" />
                    </motion.span>
                  ) : (
                    <motion.span key="p">
                      <s.icon />
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <span className={cn('flex-1 truncate text-[13px]', state === 'pending' ? 'text-fg-3' : 'font-medium text-fg')}>{s.label}</span>
              {state === 'done' && <span className="font-mono text-[10.5px] text-fg-3 tabular">{((s.duration * SPEED) / 1000).toFixed(0)}s</span>}
            </div>
            <AnimatePresence initial={false}>
              {state === 'active' && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pl-[34px]">
                  <p className="mt-1 text-[11.5px] leading-snug text-fg-3 tabular">{s.detail(Math.min(1, stepProgress))}</p>
                  <Progress value={stepProgress * 100} size="sm" className="mt-1.5 [&>div]:transition-none" />
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        )
      })}
      <li className={cn('flex items-center gap-2.5 rounded-lg px-2.5 py-2', done ? 'text-fg' : 'text-fg-3')}>
        <span className={cn('grid size-6 shrink-0 place-items-center rounded-full ring-1 [&_svg]:size-3.5', done ? 'bg-success text-white ring-success' : 'bg-surface-2 ring-line')}>
          {done ? <Check strokeWidth={3} /> : <CompleteIcon />}
        </span>
        <span className={cn('text-[13px]', done && 'font-medium')}>Complete</span>
      </li>
    </ol>
  )
}

const toneClass: Record<LogLine['tone'], string> = {
  default: 'text-fg',
  muted: 'text-fg-3',
  ok: 'text-success',
  warn: 'text-warning',
  accent: 'text-accent-ink',
}

function Terminal({ logs, live, className, height }: { logs: LogLine[]; live?: boolean; className?: string; height?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [stick, setStick] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (el && stick) el.scrollTop = el.scrollHeight
  }, [logs.length, stick])

  return (
    <div className={cn('flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-bg-subtle', className)}>
      <div className="flex items-center justify-between border-b border-line bg-surface/60 px-3 py-2">
        <span className="font-mono text-[11.5px] text-fg-3">/var/log/orvex/update.log</span>
        {live ? (
          <Badge tone="accent" dot pulse>
            streaming
          </Badge>
        ) : (
          <span className="font-mono text-[11px] text-fg-3">{logs.length} lines</span>
        )}
      </div>
      <div
        ref={ref}
        onScroll={(e) => {
          const el = e.currentTarget
          setStick(el.scrollHeight - el.scrollTop - el.clientHeight < 24)
        }}
        className={cn('overflow-y-auto px-3 py-2.5 font-mono text-[11.5px] leading-[1.75]', !height && 'h-[220px] md:h-[340px]')}
        style={height ? { height } : undefined}
      >
        {logs.map((l) => (
          <motion.div key={l.id} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }} className="flex gap-3 whitespace-pre-wrap">
            <span className="shrink-0 text-fg-3/70 select-none tabular">{time(l.t, true)}</span>
            <span className={cn('min-w-0 break-words', toneClass[l.tone])}>{l.text}</span>
          </motion.div>
        ))}
        {live && (
          <div className="flex gap-3">
            <span className="text-fg-3/70 select-none">{logs.length ? time(logs[logs.length - 1]!.t, true) : '--:--:--'}</span>
            <span className="inline-block h-[14px] w-[7px] translate-y-[3px] animate-pulse bg-fg-2" />
          </div>
        )}
      </div>
    </div>
  )
}

function clock(sec: number) {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/* ------------------------------------------------------------------ */
/*  3 · Complete                                                       */
/* ------------------------------------------------------------------ */
function SuccessView({ onViewNotes }: { onViewNotes: (r: Release) => void }) {
  const { params, durationSec, logs, steps, dismiss } = useUpdateRun()
  const [showLog, setShowLog] = useState(false)
  if (!params) return null
  const rel = params.release
  const backupId = `bkp_pre_${rel.version.replace(/\./g, '')}`

  return (
    <div className="space-y-5 pt-2">
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          <motion.span className="absolute inset-0 rounded-full bg-success/25" initial={{ scale: 0.6, opacity: 0.8 }} animate={{ scale: 2.2, opacity: 0 }} transition={{ duration: 1.2, ease: 'easeOut' }} />
          <motion.span
            className="relative grid size-16 place-items-center rounded-full bg-success/15 text-success ring-1 ring-success/30"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 18 }}
          >
            <CircleCheck className="size-8" />
          </motion.span>
        </div>
        <motion.h2 initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-4 font-display text-[24px] font-semibold tracking-[-0.025em]">
          ORVEX Core {params.to} is live
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="mt-1 max-w-md text-[13.5px] text-fg-2">
          Updated from {params.from} in {duration(durationSec)}. All health checks are passing and the rollback point is retained.
        </motion.p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Fact label="Duration" value={duration(durationSec)} />
        <Fact label="Schema" value={rel.migration ? `${rel.migration.from} → ${rel.migration.to}` : params.schemaFrom} />
        <Fact label="Backup" value={backupId} />
        <Fact label="Steps" value={`${steps.length} / ${steps.length} passed`} />
      </div>

      {params.incompatible.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-warning/30 bg-warning/[0.06] p-3.5 text-[12.5px] sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-start gap-2 text-fg-2">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
            {params.incompatible.map((e) => e.name).join(', ')} was disabled as incompatible with {params.to}.
          </span>
          <Link to="/admin/system/extensions" onClick={dismiss} className="shrink-0 font-medium text-accent-ink hover:underline">
            Review extensions →
          </Link>
        </div>
      )}

      <div>
        <button type="button" onClick={() => setShowLog(!showLog)} className="flex items-center gap-1.5 text-[12.5px] font-medium text-fg-2 hover:text-fg">
          <ChevronDown className={cn('size-3.5 transition-transform', !showLog && '-rotate-90')} />
          {showLog ? 'Hide' : 'Show'} update log ({logs.length} lines)
        </button>
        <AnimatePresence initial={false}>
          {showLog && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <Terminal logs={logs} className="mt-2" height={240} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={dismiss}>
          Done
        </Button>
        <Button
          variant="primary"
          leading={<Sparkles />}
          onClick={() => {
            dismiss()
            onViewNotes(rel)
          }}
        >
          View what’s new
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Failure (commit error)                                             */
/* ------------------------------------------------------------------ */
function FailedView() {
  const { error, logs, dismiss } = useUpdateRun()
  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-danger/10 text-danger">
          <CircleX className="size-5" />
        </span>
        <div>
          <h2 className="text-[16px] font-semibold">Update could not be recorded</h2>
          <p className="mt-0.5 text-[13px] text-fg-3">{error ?? 'Unknown error'} — the installation stays on the previous version.</p>
        </div>
      </div>
      <Terminal logs={logs} height={200} />
      <div className="flex justify-end">
        <Button variant="secondary" onClick={dismiss}>
          Close
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Minimized dock                                                     */
/* ------------------------------------------------------------------ */
function MinimizedDock() {
  const { status, minimized, steps, elapsed, params, expand } = useUpdateRun()
  const show = minimized && (status === 'running' || status === 'committing' || status === 'complete')
  const { index, overall } = runProgress(steps, elapsed, status)
  const step = steps[index]
  const done = status === 'complete'
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          className="fixed bottom-4 left-1/2 z-40 w-[min(440px,calc(100vw-32px))] -translate-x-1/2"
        >
          <button type="button" onClick={expand} className="glass group w-full overflow-hidden rounded-2xl border border-line-strong text-left shadow-pop">
            <div className="flex items-center gap-3 px-4 py-3">
              <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', done ? 'bg-success/15 text-success' : 'bg-accent/12 text-accent-ink')}>
                {done ? <CircleCheck className="size-4" /> : <LoaderCircle className="size-4 animate-spin" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-fg">{done ? `ORVEX Core ${params?.to} is live` : `Updating to ${params?.to} · ${step?.active ?? 'Finalising'}`}</p>
                <p className="truncate text-[11.5px] text-fg-3">{done ? 'Update complete — open for details' : `Step ${Math.min(index + 1, steps.length)} of ${steps.length} · ${Math.floor(overall * 100)}%`}</p>
              </div>
              <span className="grid size-7 place-items-center rounded-md text-fg-3 transition-colors group-hover:bg-surface-3 group-hover:text-fg">
                <Maximize2 className="size-3.5" />
              </span>
            </div>
            <div className="h-0.5 bg-fg/[0.06]">
              <div className={cn('h-full transition-[width] duration-150', done ? 'bg-success' : 'bg-accent')} style={{ width: `${overall * 100}%` }} />
            </div>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
