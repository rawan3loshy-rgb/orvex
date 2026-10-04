import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Check, ChevronDown, CircleCheck, CircleX, Layers, LoaderCircle, Lock, Maximize2, Minimize2, RotateCcw, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Badge, Button, Checkbox, DemoTag, Modal, Progress } from '@/components/ui'
import { cn } from '@/lib/cn'
import { duration, time } from '@/lib/format'
import { runProgress, useUpdateRun, type LogLine } from './store'
import { SPEED, STEP_META, buildSteps, migrationVersion, totalDuration, type RunParams, type StepDef } from './steps'
import { Fact } from '../shared'

/* ------------------------------------------------------------------ */
/*  Host                                                               */
/* ------------------------------------------------------------------ */
export function UpdateRunModal({ prepare, onStart }: { prepare: () => RunParams | null; onStart: (p: RunParams) => void }) {
  const status = useUpdateRun((s) => s.status)
  const minimized = useUpdateRun((s) => s.minimized)
  const dismiss = useUpdateRun((s) => s.dismiss)
  const open = status !== 'idle' && !minimized
  return (
    <>
      <Modal open={open} onClose={dismiss} size="xl" hideClose>
        {status === 'confirm' && <ConfirmView prepare={prepare} onStart={onStart} />}
        {(status === 'running' || status === 'committing') && <RunView />}
        {status === 'complete' && <SuccessView />}
        {status === 'failed' && <FailedView />}
      </Modal>
      <MinimizedDock />
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  1 · Confirm                                                        */
/* ------------------------------------------------------------------ */
function ConfirmView({ prepare, onStart }: { prepare: () => RunParams | null; onStart: (p: RunParams) => void }) {
  const dismiss = useUpdateRun((s) => s.dismiss)
  const [ack, setAck] = useState(false)
  const params = prepare()
  if (!params) return null
  const steps = buildSteps(params)
  const rel = params.release
  const needsAck = params.incompatible.length > 0
  const mig = params.pendingMigrations
  const schemaTo = mig.length ? migrationVersion(mig[mig.length - 1]!) : params.schemaFrom

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
        <Fact label="Schema" value={mig.length ? `${params.schemaFrom} → ${schemaTo} · expand-only` : 'no migration'} />
        <Fact label="Package" value={`${(rel.package.sizeBytes / 1024 / 1024).toFixed(1)} MB · signed`} />
      </div>

      <div>
        <div className="mono-label mb-2">Sequence</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {STEP_META.map((s, i) => (
            <span key={s.id} className="flex items-center gap-1.5">
              <span className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 text-[12px] text-fg-2 [&_svg]:size-3.5">
                <s.icon />
                {s.label}
              </span>
              {i < STEP_META.length - 1 && <ArrowRight className="size-3 text-fg-3" />}
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
              Full backup first <Lock className="size-3 text-fg-3" />
            </p>
            <p className="text-[12px] text-fg-3">Always taken — pg_dump of {params.dbName} (~{(params.backupSizeMb / 1024).toFixed(2)} GB) plus .env, Caddyfile and extensions.</p>
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
              description={`Declares ${params.incompatible.map((e) => e.coreRange).join(', ')} — not declared compatible with ${params.to}. It stays installed and can be re-enabled once a compatible version is available.`}
            />
          </div>
        )}
        <p className="flex items-start gap-2 text-[12px] text-fg-3">
          <Layers className="mt-0.5 size-3.5 shrink-0" />
          Orders keep being accepted. Jobs waiting at suppliers stay in the PostgreSQL queue — nothing is resent to a supplier.
        </p>
        <p className="flex items-start gap-2 text-[12px] text-fg-3">
          <RotateCcw className="mt-0.5 size-3.5 shrink-0" />
          If the health check fails, the previous images are restored. Expand-only migrations mean {params.from} runs on the new schema.
        </p>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12px] text-fg-3">Estimated ~{duration(Math.round((totalDuration(steps) * SPEED) / 1000))} on your server. Prototype: simulated — no container or database is touched.</p>
        <Button variant="accent" disabled={needsAck && !ack} onClick={() => onStart(params)} leading={<ShieldCheck />} className="shrink-0">
          Start backup & update
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  2 · Running                                                        */
/* ------------------------------------------------------------------ */
function RunView() {
  const { steps, elapsed, status, params, logs, minimize } = useUpdateRun()
  const { index, stepProgress, overall } = runProgress(steps, elapsed, status)
  const [focus, setFocus] = useState<string | null>(null)
  const step = steps[index]
  const simElapsed = (elapsed * SPEED) / 1000
  const simTotal = (totalDuration(steps) * SPEED) / 1000
  const activeLabel = status === 'committing' ? 'Recording result in update history…' : step?.active

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
              <DemoTag />
            </h2>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p key={activeLabel ?? 'x'} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="mt-0.5 text-[13px] text-fg-3">
                Step {Math.min(index + 1, STEP_META.length)} of {STEP_META.length} · {activeLabel}
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

      <div className="md:hidden">
        <div className="flex gap-1">
          {STEP_META.map((s, i) => (
            <span key={s.id} className={cn('h-1 flex-1 rounded-full transition-colors', i < index ? 'bg-success' : i === index ? 'animate-pulse bg-accent' : 'bg-fg/10')} />
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
        <div className="hidden md:block">
          <StepList steps={steps} index={index} stepProgress={stepProgress} focus={focus} onFocus={setFocus} />
        </div>
        <Terminal logs={focus ? logs.filter((l) => l.step === focus) : logs} live focus={focus} onClearFocus={() => setFocus(null)} />
      </div>

      <p className="flex items-center gap-2 border-t border-line pt-4 text-[12px] text-fg-3">
        <ShieldCheck className="size-3.5 shrink-0" />
        The update runs on your server — closing or minimising this window doesn’t interrupt it. Select a step to see its log.
      </p>
    </div>
  )
}

function StepList({ steps, index, stepProgress, focus, onFocus }: { steps: StepDef[]; index: number; stepProgress: number; focus: string | null; onFocus: (id: string | null) => void }) {
  const items = [...steps.map((s) => ({ id: s.id as string, label: s.label, icon: s.icon, sec: (s.duration * SPEED) / 1000, detail: s.detail })), { id: 'complete', label: 'Complete', icon: STEP_META[6]!.icon, sec: 0, detail: () => 'Recording in update history…' }]
  return (
    <ol className="relative space-y-0.5">
      {items.map((s, i) => {
        const state = i < index ? 'done' : i === index ? 'active' : 'pending'
        const Icon = s.icon
        return (
          <li key={s.id}>
            <button
              type="button"
              disabled={state === 'pending'}
              onClick={() => onFocus(focus === s.id ? null : s.id)}
              className={cn('relative w-full rounded-lg px-2.5 py-2 text-left transition-colors', state === 'active' && 'bg-surface-2', focus === s.id && 'ring-1 ring-accent/40', state !== 'pending' && 'hover:bg-surface-2')}
            >
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
                        <Icon />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
                <span className={cn('flex-1 truncate text-[13px]', state === 'pending' ? 'text-fg-3' : 'font-medium text-fg')}>{s.label}</span>
                {state === 'done' && s.sec > 0 && <span className="font-mono text-[10.5px] text-fg-3 tabular">{s.sec.toFixed(0)}s</span>}
              </div>
              <AnimatePresence initial={false}>
                {state === 'active' && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pl-[34px]">
                    <p className="mt-1 text-[11.5px] leading-snug text-fg-3 tabular">{s.detail(Math.min(1, stepProgress))}</p>
                    <Progress value={stepProgress * 100} size="sm" className="mt-1.5 [&>div]:transition-none" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

const toneClass: Record<LogLine['tone'], string> = { default: 'text-fg', muted: 'text-fg-3', ok: 'text-success', warn: 'text-warning', accent: 'text-accent-ink' }

function Terminal({ logs, live, className, height, focus, onClearFocus }: { logs: LogLine[]; live?: boolean; className?: string; height?: number; focus?: string | null; onClearFocus?: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [stick, setStick] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (el && stick) el.scrollTop = el.scrollHeight
  }, [logs.length, stick])
  const focusLabel = focus ? (STEP_META.find((s) => s.id === focus)?.label ?? focus) : null
  return (
    <div className={cn('flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-bg-subtle', className)}>
      <div className="flex items-center justify-between gap-2 border-b border-line bg-surface/60 px-3 py-2">
        <span className="truncate font-mono text-[11.5px] text-fg-3">/var/log/orvex/update.log{focusLabel ? ` · ${focusLabel}` : ''}</span>
        <div className="flex items-center gap-2">
          {focusLabel && onClearFocus && (
            <button type="button" onClick={onClearFocus} className="text-[11.5px] text-accent-ink hover:underline">
              Show all
            </button>
          )}
          {live ? (
            <Badge tone="accent" dot pulse>
              streaming
            </Badge>
          ) : (
            <span className="font-mono text-[11px] text-fg-3">{logs.length} lines</span>
          )}
        </div>
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
            <span className="shrink-0 text-fg-3/70 tabular select-none">{time(l.t, true)}</span>
            <span className={cn('min-w-0 break-words', toneClass[l.tone])}>{l.text}</span>
          </motion.div>
        ))}
        {live && !focus && (
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
function SuccessView() {
  const { params, durationSec, logs, dismiss } = useUpdateRun()
  const [showLog, setShowLog] = useState(false)
  if (!params) return null
  const mig = params.pendingMigrations
  const schemaTo = mig.length ? migrationVersion(mig[mig.length - 1]!) : params.schemaFrom

  return (
    <div className="space-y-5 pt-2">
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          <motion.span className="absolute inset-0 rounded-full bg-success/25" initial={{ scale: 0.6, opacity: 0.8 }} animate={{ scale: 2.2, opacity: 0 }} transition={{ duration: 1.2, ease: 'easeOut' }} />
          <motion.span className="relative grid size-16 place-items-center rounded-full bg-success/15 text-success ring-1 ring-success/30" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 18 }}>
            <CircleCheck className="size-8" />
          </motion.span>
        </div>
        <motion.h2 initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-4 font-display text-[24px] font-semibold tracking-[-0.025em]">
          ORVEX Core {params.to} is running
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="mt-1 max-w-md text-[13.5px] text-fg-2">
          Updated from {params.from} in {duration(durationSec)} (simulated). Health checks passed and the rollback point is retained.
        </motion.p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Fact label="Duration" value={duration(durationSec)} />
        <Fact label="Schema" value={`${params.schemaFrom} → ${schemaTo}`} />
        <Fact label="Backup" value={`bkp_pre_${params.to}`} />
        <Fact label="Steps" value={`${STEP_META.length} / ${STEP_META.length}`} />
      </div>

      {params.incompatible.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-warning/30 bg-warning/[0.06] p-3.5 text-[12.5px] sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-start gap-2 text-fg-2">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
            {params.incompatible.map((e) => e.name).join(', ')} should be disabled until a version compatible with {params.to} is installed.
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

      <div className="flex justify-end border-t border-line pt-4">
        <Button variant="primary" onClick={dismiss}>
          Done
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Failure (commit refused, e.g. entitlement expired mid-run)         */
/* ------------------------------------------------------------------ */
function FailedView() {
  const { error, logs, dismiss, params } = useUpdateRun()
  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-danger/10 text-danger">
          <CircleX className="size-5" />
        </span>
        <div>
          <h2 className="text-[16px] font-semibold">Update was not applied</h2>
          <p className="mt-0.5 text-[13px] text-fg-3">
            {error ?? 'Unknown error'} — the installation keeps running {params?.from}. Operations are not affected.
          </p>
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
/*  Minimised dock                                                     */
/* ------------------------------------------------------------------ */
function MinimizedDock() {
  const { status, minimized, steps, elapsed, params, expand } = useUpdateRun()
  const show = minimized && (status === 'running' || status === 'committing' || status === 'complete' || status === 'failed')
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
              <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', done ? 'bg-success/15 text-success' : status === 'failed' ? 'bg-danger/10 text-danger' : 'bg-accent/12 text-accent-ink')}>
                {done ? <CircleCheck className="size-4" /> : status === 'failed' ? <CircleX className="size-4" /> : <LoaderCircle className="size-4 animate-spin" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-fg">{done ? `ORVEX Core ${params?.to} is running` : status === 'failed' ? 'Update was not applied' : `Updating to ${params?.to} · ${step?.active ?? 'Recording result'}`}</p>
                <p className="truncate text-[11.5px] text-fg-3">{done || status === 'failed' ? 'Open for details' : `Step ${Math.min(index + 1, STEP_META.length)} of ${STEP_META.length} · ${Math.floor(overall * 100)}%`}</p>
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
