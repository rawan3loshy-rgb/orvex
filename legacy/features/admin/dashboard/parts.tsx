import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Re-render on an interval (for "updated 3s ago" style labels). */
export function useNow(interval = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval)
    return () => clearInterval(id)
  }, [interval])
  return now
}

/** Editorial section divider: index · title ———— aside. */
export function SectionLabel({ index, title, aside, className }: { index: string; title: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 pt-3', className)}>
      <span className="mono-label text-fg-3/80">{index}</span>
      <h2 className="text-[12.5px] font-semibold tracking-[-0.005em] whitespace-nowrap text-fg-2">{title}</h2>
      <span className="h-px min-w-6 flex-1 bg-line" />
      {aside && <div className="flex shrink-0 items-center gap-2 text-[12px] text-fg-3">{aside}</div>}
    </div>
  )
}

export function MiniFact({ label, value, hint, className }: { label: ReactNode; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 px-4 py-3', className)}>
      <div className="truncate font-display text-[15.5px] font-semibold tracking-[-0.01em] tabular">{value}</div>
      <div className="mt-0.5 truncate text-[11px] text-fg-3">{label}</div>
      {hint && <div className="mt-0.5 truncate text-[10.5px] text-fg-3/80">{hint}</div>}
    </div>
  )
}

export function HeadlineStat({ label, value, dot, dashed }: { label: string; value: string; dot?: string; dashed?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[11.5px] text-fg-3">
        {dot && (dashed ? <span className="h-0 w-2.5 border-t-[1.5px] border-dashed" style={{ borderColor: dot }} /> : <span className="size-1.5 rounded-full" style={{ background: dot }} />)}
        {label}
      </div>
      <div className="mt-0.5 truncate font-display text-[19px] font-semibold tracking-[-0.02em] tabular">{value}</div>
    </div>
  )
}

/** Ten-tick load meter (graphite, amber ≥ 70 %, crimson ≥ 90 %). */
export function TickMeter({ ratio, className, ticks = 10 }: { ratio: number; className?: string; ticks?: number }) {
  const filled = ratio <= 0 ? 0 : Math.min(ticks, Math.max(1, Math.round(ratio * ticks)))
  const color = ratio >= 0.9 ? 'var(--danger)' : ratio >= 0.7 ? 'var(--warning)' : 'var(--c2)'
  return (
    <div className={cn('flex h-1.5 gap-[2px]', className)} aria-hidden>
      {Array.from({ length: ticks }, (_, i) => (
        <span
          key={i}
          className="flex-1 rounded-[1px] transition-colors duration-500"
          style={{
            background: i < filled ? color : 'color-mix(in oklab, var(--fg) 9%, transparent)',
          }}
        />
      ))}
    </div>
  )
}

/** Mask a device identifier for compact display: TAC + last digits. */
export function deviceId(input: Record<string, string>) {
  const v = input.imei ?? input.serial_number ?? input.phone_number
  if (!v) return null
  if (/^\d{15}$/.test(v)) return `${v.slice(0, 8)}·${v.slice(8, 12).replace(/\d/g, '•')}${v.slice(12)}`
  return v
}
