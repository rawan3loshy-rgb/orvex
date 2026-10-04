import { useMemo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Activity, BadgeCheck, CircleCheck, Database, DatabaseBackup, Loader2, Package, RotateCcw, ShieldCheck, Undo2, type LucideIcon } from 'lucide-react'
import { DemoTag } from '@/components/ui'
import { createRng } from '@/lib/random'
import { num } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Container, Reveal, Section, SectionHeader } from './shared'
import { EASE, useAutoStep } from './sharedUtils'
import { brand } from '@/config/brand'

const STEPS: { label: string; icon: LucideIcon; detail: string; log: string }[] = [
  { label: 'Download & verify', icon: BadgeCheck, detail: 'Ed25519 · valid', log: `core-2.5.0 pulled from releases.${brand.domain} — signature valid (orvex-release-2026)` },
  { label: 'Preflight', icon: ShieldCheck, detail: '7 checks', log: 'Preflight: entitlement ✓ upgrade path ✓ disk ✓ PostgreSQL 16.4 ✓ extensions: 1 warning' },
  { label: 'Backup', icon: DatabaseBackup, detail: 'pg_dump · 1.3 GB', log: 'Pre-update backup written (1.3 GB) — restore point kept' },
  { label: 'Migrate (expand)', icon: Database, detail: 'schema 019 → 022', log: 'Applied 020_order_review_lookups, 021_webhook_message_ids, 022_pricing_rule_min_margin (additive)' },
  { label: 'Drain workers', icon: Package, detail: 'in-flight jobs finish', log: 'core-worker drained — 0 jobs in flight, supplier polling paused' },
  { label: 'Swap containers', icon: RotateCcw, detail: 'api · worker · scheduler', log: 'core-api, core-worker, core-scheduler now on registry.orvex.io/core:2.5.0' },
  { label: 'Health check', icon: Activity, detail: '14 / 14 checks', log: 'Health check passed — 14/14 (db, queue, drivers, ledger integrity, license)' },
  { label: 'Complete', icon: CircleCheck, detail: 'Core 2.5.0 live', log: `Update complete — ${brand.coreProduct} 2.5.0 is live` },
]

const stamp = (i: number) => `09:41:${String(2 + i * 3).padStart(2, '0')}`

function Pipeline() {
  const total = STEPS.length + 1
  const { ref, step } = useAutoStep<HTMLDivElement>(total, (s) => (s === STEPS.length ? 3200 : s === 0 ? 900 : 1100))
  // step k: steps < k are done; step k is running (k < STEPS.length); k === STEPS.length → all done
  const doneCount = Math.min(step, STEPS.length)
  const running = step < STEPS.length ? step : -1
  const progress = step >= STEPS.length ? 1 : step / (STEPS.length - 1)

  return (
    <div ref={ref} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="text-[14px] font-semibold text-fg">Update to 2.5.0</span>
          <span className="font-mono text-[11px] text-fg-3">portal.unlockdesk-demo.com</span>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={step >= STEPS.length ? 'done' : 'run'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={cn('flex items-center gap-1.5 text-[12px] font-medium', step >= STEPS.length ? 'text-success' : 'text-accent-ink')}>
            {step >= STEPS.length ? <CircleCheck className="size-3.5" /> : <Loader2 className="size-3.5 animate-spin" />}
            {step >= STEPS.length ? 'Completed in 21s' : `Step ${step + 1} of ${STEPS.length}`}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* stepper */}
      <div className="relative px-4 pt-6 pb-5 sm:px-6">
        <div className="absolute top-[42px] hidden h-px bg-line-strong lg:block" style={{ left: 'calc((100% - 104px) / 16 + 24px)', right: 'calc((100% - 104px) / 16 + 24px)' }}>
          <motion.div className="h-full origin-left bg-accent" animate={{ scaleX: progress }} transition={{ duration: 0.6, ease: EASE }} />
        </div>
        <ol className="relative grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4 lg:grid-cols-8 lg:gap-x-2">
          {STEPS.map((s, i) => {
            const state = i < doneCount ? 'done' : i === running ? 'run' : 'todo'
            return (
              <li key={s.label} className="flex items-center gap-3 lg:flex-col lg:gap-2.5 lg:text-center">
                <span
                  className={cn(
                    'relative grid size-9 shrink-0 place-items-center rounded-full border transition-colors duration-300',
                    state === 'done' ? 'border-success/40 bg-success/12 text-success' : state === 'run' ? 'border-accent bg-surface text-accent-ink' : 'border-line bg-surface text-fg-3',
                  )}
                >
                  {state === 'run' && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-accent/30" />}
                  {state === 'done' ? <CircleCheck className="size-4" /> : <s.icon className="size-4" />}
                </span>
                <div className="min-w-0">
                  <div className={cn('text-[12.5px] font-medium transition-colors', state === 'todo' ? 'text-fg-3' : 'text-fg')}>{s.label}</div>
                  <div className="truncate font-mono text-[10px] text-fg-3 lg:whitespace-normal">{s.detail}</div>
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      {/* log */}
      <div className="border-t border-line bg-bg-subtle/70 px-4 py-3.5 sm:px-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="mono-label">Update log</span>
          <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-fg-3">
            <Undo2 className="size-3" /> auto-rollback if health check fails
          </span>
        </div>
        <div className="h-[132px] overflow-hidden font-mono text-[11.5px] leading-[1.75]">
          <AnimatePresence initial={false}>
            {STEPS.slice(0, doneCount)
              .map((s, i) => ({ s, i }))
              .slice(-5)
              .map(({ s, i }) => (
                <motion.div key={`${i}-${s.label}`} layout initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="flex gap-3 truncate">
                  <span className="shrink-0 text-fg-3">{stamp(i)}</span>
                  <span className={cn('shrink-0', i === STEPS.length - 1 || i === 0 || i === 6 ? 'text-success' : 'text-accent-ink')}>{i === STEPS.length - 1 || i === 0 || i === 6 ? '✓' : '▸'}</span>
                  <span className="truncate text-fg-2">{s.log}</span>
                </motion.div>
              ))}
          </AnimatePresence>
          {running >= 0 && (
            <div className="flex gap-3 text-fg-3">
              <span>{stamp(running)}</span>
              <span className="text-accent-ink">▸</span>
              <span className="animate-pulse">{STEPS[running]!.label}…</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const FLEET = 144

function Fleet() {
  const order = useMemo(() => createRng(42).shuffle(Array.from({ length: FLEET }, (_, i) => i)), [])
  const { ref, step } = useAutoStep<HTMLDivElement>(10_000, 480)
  const updated = Math.min(FLEET - 9, 61 + step * 2)
  const rank = useMemo(() => {
    const r = new Array<number>(FLEET)
    order.forEach((idx, pos) => (r[idx] = pos))
    return r
  }, [order])
  const updating = 3
  return (
    <div ref={ref} className="flex h-full flex-col rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[14px] font-semibold text-fg">Independent installations</div>
          <div className="mt-0.5 text-[12.5px] text-fg-3">Each customer updates on its own schedule — through the identical pipeline.</div>
        </div>
        <DemoTag />
      </div>
      <div className="mt-4 grid flex-1 grid-cols-[repeat(16,minmax(0,1fr))] content-start gap-[5px]">
        {Array.from({ length: FLEET }, (_, i) => {
          const pos = rank[i]!
          const state = pos < updated ? 'new' : pos < updated + updating ? 'updating' : 'old'
          return (
            <span
              key={i}
              className={cn(
                'aspect-square rounded-[4px] transition-colors duration-500',
                state === 'new' ? 'bg-fg/70' : state === 'updating' ? 'animate-pulse bg-accent' : 'bg-fg/[0.09]',
              )}
            />
          )
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-fg-2">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-[3px] bg-fg/70" />
          2.5.0 <span className="text-fg-3 tabular">{num(updated)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-[3px] bg-accent" />
          Updating <span className="text-fg-3 tabular">{num(updating)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-[3px] bg-fg/20" />
          2.4.x <span className="text-fg-3 tabular">{num(FLEET - updated - updating)}</span>
        </span>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-lg bg-fg/[0.04] px-3 py-2 text-[12px] text-fg-2">
        <ShieldCheck className="size-3.5 shrink-0 text-success" />
        Same signed artifact, same checks, every time.
      </div>
    </div>
  )
}

export function UpdatesSection() {
  return (
    <Section id="updates">
      <Container>
        <SectionHeader
          index="14"
          eyebrow="Update system"
          title="Signed updates that land the same way on every installation."
          description="Each installation updates itself, on its own schedule, through the same verified pipeline — preflight, backup, expand-only migration, worker drain, container swap, health check. Updates are available while your update entitlement runs; when it ends, your installation simply keeps running the version it has."
        />
        <div className="mt-12 grid items-stretch gap-4 lg:mt-14 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Reveal>
            <Pipeline />
          </Reveal>
          <Reveal delay={0.08}>
            <Fleet />
          </Reveal>
        </div>
      </Container>
    </Section>
  )
}
