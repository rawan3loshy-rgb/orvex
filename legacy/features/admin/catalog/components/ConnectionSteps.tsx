import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CircleCheck, CircleX, Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { ms as fmtMs } from '@/lib/format'

export interface TestStep {
  label: string
  ms: number
  ok: boolean
}

export const DEFAULT_STEP_LABELS = ['DNS resolve', 'TLS handshake', 'Authenticate credentials', 'Read credit balance', 'List remote services']

/**
 * Sequential connection-test visual. Steps reveal one by one with a pace
 * proportional to their real timings; `pending` shows the first step spinning
 * while the request is still in flight.
 */
export function ConnectionSteps({ steps, pending, runKey, onDone, className }: { steps: TestStep[] | null; pending?: boolean; runKey: number; onDone?: (ok: boolean) => void; className?: string }) {
  const [revealed, setRevealed] = useState(0)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    setRevealed(0)
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
        Math.min(950, Math.max(260, step.ms * 0.9)),
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
        const skipped = failedAt >= 0 && i > failedAt && i < revealed + 1 && revealed > failedAt
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
                  <motion.span key="p" className={cn('block size-2.5 rounded-full border', skipped ? 'border-line bg-surface-3' : 'border-line-strong')} />
                )}
              </AnimatePresence>
            </span>
            <span className={cn('flex-1 text-[13px]', done || active ? 'text-fg' : 'text-fg-3')}>{label}</span>
            <span className="hidden w-[120px] sm:block">
              {done && (
                <span className="block h-1 overflow-hidden rounded-full bg-fg/[0.06]">
                  <motion.span className={cn('block h-full rounded-full', step.ok ? 'bg-success/70' : 'bg-danger/70')} initial={{ width: 0 }} animate={{ width: `${(Math.log10(step.ms + 1) / max) * 100}%` }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />
                </span>
              )}
            </span>
            <span className={cn('w-[64px] text-right font-mono text-[12px] tabular', done ? (step.ok ? 'text-fg-2' : 'text-danger') : 'text-fg-3')}>{done ? (step.ms ? fmtMs(step.ms) : '—') : active ? '…' : ''}</span>
          </li>
        )
      })}
    </ol>
  )
}
