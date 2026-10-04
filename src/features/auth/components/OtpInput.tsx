import { forwardRef, useImperativeHandle, useRef } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/cn'

export interface OtpInputHandle {
  focus: (index?: number) => void
}

/**
 * Six single-digit boxes that behave like one field: typing advances,
 * backspace steps back, paste fills from the start, arrows move focus.
 */
export const OtpInput = forwardRef<OtpInputHandle, { value: string; onChange: (v: string) => void; length?: number; invalid?: boolean; disabled?: boolean; onComplete?: (v: string) => void }>(function OtpInput(
  { value, onChange, length = 6, invalid, disabled, onComplete },
  ref,
) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const focus = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus()
  useImperativeHandle(ref, () => ({ focus: (i?: number) => focus(i ?? Math.min(value.length, length - 1)) }))

  const commit = (next: string) => {
    const clean = next.replace(/\D/g, '').slice(0, length)
    onChange(clean)
    if (clean.length === length) onComplete?.(clean)
  }

  return (
    <div className="flex items-center justify-between gap-2" role="group" aria-label="Verification code">
      {Array.from({ length }, (_, i) => {
        const digit = value[i] ?? ''
        const active = i === Math.min(value.length, length - 1)
        return (
          <div key={i} className={cn('contents')}>
            {i === length / 2 && <span aria-hidden className="h-px w-3 shrink-0 bg-line-strong" />}
            <motion.div animate={digit ? { scale: [1, 1.08, 1] } : { scale: 1 }} transition={{ duration: 0.22 }} className="min-w-0 flex-1">
              <input
                ref={(el) => {
                  refs.current[i] = el
                }}
                value={digit}
                disabled={disabled}
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                aria-label={`Digit ${i + 1}`}
                maxLength={2}
                onFocus={(e) => {
                  // Keep entry sequential: jump to the first empty box.
                  if (i > value.length) focus(value.length)
                  else e.currentTarget.select()
                }}
                onChange={(e) => {
                  const d = e.target.value.replace(/\D/g, '').slice(-1)
                  if (!d) return
                  const next = value.slice(0, i) + d + value.slice(i + 1)
                  commit(next)
                  if (i < length - 1) focus(i + 1)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace') {
                    e.preventDefault()
                    if (value[i]) commit(value.slice(0, i) + value.slice(i + 1))
                    else if (i > 0) {
                      commit(value.slice(0, i - 1) + value.slice(i))
                      focus(i - 1)
                    }
                  } else if (e.key === 'ArrowLeft') {
                    e.preventDefault()
                    focus(i - 1)
                  } else if (e.key === 'ArrowRight') {
                    e.preventDefault()
                    focus(Math.min(i + 1, value.length))
                  }
                }}
                onPaste={(e) => {
                  e.preventDefault()
                  const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
                  if (!pasted) return
                  commit(pasted)
                  focus(pasted.length >= length ? length - 1 : pasted.length)
                }}
                className={cn(
                  'h-13 w-full rounded-xl border bg-surface text-center font-mono text-[22px] font-medium text-fg caret-accent shadow-[0_1px_0_rgb(0_0_0/0.02)] transition-[border-color,box-shadow,background-color] duration-150 outline-none sm:h-14',
                  'focus:border-accent/60 focus:ring-4 focus:ring-accent/15',
                  invalid ? 'border-danger/60' : digit ? 'border-line-strong' : 'border-line',
                  active && !digit && !disabled && 'border-line-strong',
                  disabled && 'opacity-60',
                )}
              />
            </motion.div>
          </div>
        )
      })}
    </div>
  )
})
