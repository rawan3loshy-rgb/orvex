/**
 * Shared building blocks for the catalog / suppliers / pricing / routing
 * screens (owned together). Domain-level components live in
 * `@/components/domain` — this file only holds what these screens share.
 * Non-component helpers (labels, driver metadata, payload formatting) live in `./helpers`.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CircleCheck, CircleX, Loader2, RefreshCw, TriangleAlert } from 'lucide-react'
import { Button, Card, EmptyState, Skeleton, Tooltip } from '@/components/ui'
import { cn } from '@/lib/cn'
import { dateTime, ms as fmtMs, relative } from '@/lib/format'
import { DEFAULT_STEP_LABELS } from './helpers'

/* ------------------------------------------------------------------------- */
/*  Small visual pieces                                                      */
/* ------------------------------------------------------------------------- */

/** Supplier glyph — monogram on the supplier's identity colour. */
export function SupplierMark({ name, color, size = 'md', className }: { name: string; color?: string; size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string }) {
  const words = name
    .replace(/^DHRU\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
  const mono = (words.length > 1 ? words[0]![0]! + words[1]![0]! : (words[0] ?? '?').slice(0, 2)).toUpperCase()
  const c = color ?? 'var(--c6)'
  const s = size === 'xs' ? 'size-5 text-[8.5px] rounded-[5px]' : size === 'sm' ? 'size-6 text-[9.5px] rounded-md' : size === 'lg' ? 'size-11 text-[15px] rounded-xl' : 'size-8 text-[11px] rounded-lg'
  return (
    <span
      className={cn('inline-grid shrink-0 place-items-center font-mono leading-none font-semibold tracking-[-0.02em]', s, className)}
      style={{ color: `color-mix(in oklab, ${c} 75%, var(--fg))`, background: `color-mix(in oklab, ${c} 13%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${c} 30%, transparent)` }}
      aria-hidden
    >
      {mono}
    </span>
  )
}

export function RelTime({ iso, className }: { iso: string | null | undefined; className?: string }) {
  if (!iso) return <span className={cn('text-fg-3', className)}>—</span>
  return (
    <Tooltip content={dateTime(iso)}>
      <span className={cn('tabular', className)}>{relative(iso)}</span>
    </Tooltip>
  )
}

export function ErrorPanel({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const message = error instanceof Error ? error.message : 'The request failed.'
  return (
    <Card className={className}>
      <EmptyState
        icon={<TriangleAlert />}
        title="Could not load this data"
        description={message}
        action={
          onRetry && (
            <Button size="sm" leading={<RefreshCw />} onClick={onRetry}>
              Retry
            </Button>
          )
        }
      />
    </Card>
  )
}

export function LoadingCards({ count = 3, className, height = 'h-28' }: { count?: number; className?: string; height?: string }) {
  return (
    <div className={cn('grid gap-4', className)}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={cn('rounded-xl', height)} />
      ))}
    </div>
  )
}

/** Compact key/value line used in dense panels. */
export function KV({ label, children, mono, className }: { label: ReactNode; children: ReactNode; mono?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-1.5 text-[12.5px]', className)}>
      <span className="shrink-0 text-fg-3">{label}</span>
      <span className={cn('min-w-0 truncate text-right text-fg', mono && 'font-mono text-[12px]')}>{children}</span>
    </div>
  )
}

/** Inline explanatory callout. */
export function Callout({ tone = 'neutral', icon, title, children, className }: { tone?: 'neutral' | 'warning' | 'danger' | 'success' | 'accent'; icon?: ReactNode; title?: ReactNode; children?: ReactNode; className?: string }) {
  const cls = {
    neutral: 'border-line bg-surface-2/50',
    warning: 'border-warning/30 bg-warning/[0.06]',
    danger: 'border-danger/30 bg-danger/[0.06]',
    success: 'border-success/30 bg-success/[0.06]',
    accent: 'border-accent/30 bg-accent/[0.05]',
  }[tone]
  const ink = { neutral: 'text-fg-2', warning: 'text-warning', danger: 'text-danger', success: 'text-success', accent: 'text-accent-ink' }[tone]
  return (
    <div className={cn('flex gap-3 rounded-lg border px-3.5 py-3 text-[12.5px]', cls, className)}>
      {icon && <span className={cn('mt-px shrink-0 [&_svg]:size-4', ink)}>{icon}</span>}
      <div className="min-w-0">
        {title && <div className={cn('font-semibold', tone === 'neutral' ? 'text-fg' : ink)}>{title}</div>}
        {children && <div className={cn('text-fg-2', title && 'mt-0.5')}>{children}</div>}
      </div>
    </div>
  )
}

/** Horizontal meter: reported balance against the low-balance threshold. */
export function BalanceMeter({ value, threshold, className }: { value: number; threshold: number; className?: string }) {
  // Scale: threshold sits at 40% of the bar so both sides are readable.
  const scaleMax = Math.max(threshold * 2.5, value * 1.05, 1)
  const pct = Math.max(0, Math.min(100, (value / scaleMax) * 100))
  const tpct = Math.min(100, (threshold / scaleMax) * 100)
  const low = value < threshold
  return (
    <div className={cn('relative h-1.5 w-full overflow-visible rounded-full bg-fg/[0.07]', className)}>
      <div className={cn('h-full rounded-full transition-[width] duration-700', low ? 'bg-warning' : 'bg-success/70')} style={{ width: `${pct}%` }} />
      <span className="absolute -top-1 h-3.5 w-px bg-fg-3" style={{ left: `${tpct}%` }} title="Low-balance threshold" />
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/*  Connection test steps (animated)                                         */
/* ------------------------------------------------------------------------- */
export interface TestStep {
  label: string
  ms: number
  ok: boolean
}

/**
 * Sequential connection-test visual. Steps reveal one by one paced by their
 * timings; `pending` spins the first step while the request is in flight.
 */
export function ConnectionSteps({ steps, pending, runKey, onDone, className }: { steps: TestStep[] | null; pending?: boolean; runKey: number; onDone?: (ok: boolean) => void; className?: string }) {
  const [revealed, setRevealed] = useState(0)
  // A new run (new steps or runKey) starts hidden again — reset during render, not in the effect.
  const [run, setRun] = useState({ steps, runKey })
  if (run.steps !== steps || run.runKey !== runKey) {
    setRun({ steps, runKey })
    setRevealed(0)
  }
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  })

  useEffect(() => {
    if (!steps) return
    let i = 0
    let t: ReturnType<typeof setTimeout>
    const next = () => {
      const step = steps[i]
      if (!step) {
        doneRef.current?.(steps.every((s) => s.ok))
        return
      }
      t = setTimeout(
        () => {
          i++
          setRevealed(i)
          if (!step.ok) {
            doneRef.current?.(false)
            return
          }
          next()
        },
        Math.min(900, Math.max(260, step.ms * 0.9)),
      )
    }
    next()
    return () => clearTimeout(t)
  }, [steps, runKey])

  const labels = steps?.map((s) => s.label) ?? DEFAULT_STEP_LABELS
  const max = Math.max(1, ...(steps?.map((s) => Math.log10(s.ms + 1)) ?? [1]))
  const failedAt = steps ? steps.findIndex((s) => !s.ok) : -1

  return (
    <ol className={cn('relative space-y-1', className)}>
      {labels.map((label, i) => {
        const step = steps?.[i]
        const done = !!step && i < revealed
        const active = (pending && !steps && i === 0) || (!!steps && i === revealed && (failedAt < 0 || i <= failedAt))
        return (
          <li key={label + i} className={cn('relative flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors', active && 'bg-surface-2/70', done && !step.ok && 'bg-danger/[0.05]')}>
            {i < labels.length - 1 && <span className={cn('absolute top-[30px] left-[21px] h-[calc(100%-16px)] w-px transition-colors duration-500', done && step.ok ? 'bg-success/40' : 'bg-line')} />}
            <span className="relative z-[1] grid size-[18px] shrink-0 place-items-center rounded-full bg-surface">
              <AnimatePresence mode="wait" initial={false}>
                {done ? (
                  <motion.span key="d" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}>
                    {step.ok ? <CircleCheck className="size-[18px] text-success" /> : <CircleX className="size-[18px] text-danger" />}
                  </motion.span>
                ) : active ? (
                  <motion.span key="a" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Loader2 className="size-[18px] animate-spin text-accent-ink" />
                  </motion.span>
                ) : (
                  <motion.span key="p" className="block size-2.5 rounded-full border border-line-strong" />
                )}
              </AnimatePresence>
            </span>
            <span className={cn('flex-1 text-[13px]', done || active ? 'text-fg' : 'text-fg-3')}>{label}</span>
            <span className="hidden w-[110px] sm:block">
              {done && (
                <span className="block h-1 overflow-hidden rounded-full bg-fg/[0.06]">
                  <motion.span className={cn('block h-full rounded-full', step.ok ? 'bg-success/70' : 'bg-danger/70')} initial={{ width: 0 }} animate={{ width: `${(Math.log10(step.ms + 1) / max) * 100}%` }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />
                </span>
              )}
            </span>
            <span className={cn('w-[60px] text-right font-mono text-[12px] tabular', done ? (step.ok ? 'text-fg-2' : 'text-danger') : 'text-fg-3')}>{done ? (step.ms ? fmtMs(step.ms) : '—') : active ? '…' : ''}</span>
          </li>
        )
      })}
    </ol>
  )
}
