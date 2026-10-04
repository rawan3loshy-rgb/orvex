import { useId, useMemo, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/cn'
import { useMeasure } from '@/lib/useMeasure'
import { Tooltip } from '@/components/ui/Popover'
import { arcPath, monotonePath } from './geometry'

/** Tiny trend line with soft gradient fill. */
export function Sparkline({ values, color = 'var(--accent)', height = 32, className, fill = true, strokeWidth = 1.5 }: { values: number[]; color?: string; height?: number; className?: string; fill?: boolean; strokeWidth?: number }) {
  const [ref, { width }] = useMeasure<HTMLDivElement>()
  const id = useId().replace(/:/g, '')
  const d = useMemo(() => {
    if (!width || values.length < 2) return null
    const max = Math.max(...values)
    const min = Math.min(...values)
    const range = max - min || 1
    const pts: [number, number][] = values.map((v, i) => [(i / (values.length - 1)) * width, 2 + (height - 4) * (1 - (v - min) / range)])
    const line = monotonePath(pts)
    return { line, area: `${line}L${width},${height}L0,${height}Z`, last: pts[pts.length - 1]! }
  }, [values, width, height])
  return (
    <div ref={ref} className={cn('w-full', className)} style={{ height }}>
      {d && (
        <svg width={width} height={height} className="overflow-visible">
          <defs>
            <linearGradient id={`sp-${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity={0.25} />
              <stop offset="1" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {fill && <path d={d.area} fill={`url(#sp-${id})`} />}
          <motion.path d={d.line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} />
          <circle cx={d.last[0]} cy={d.last[1]} r={2.5} fill={color} />
        </svg>
      )}
    </div>
  )
}

export interface DonutSegment {
  key: string
  label: string
  value: number
  color: string
}

export function Donut({ segments, size = 160, thickness = 18, center, className }: { segments: DonutSegment[]; size?: number; thickness?: number; center?: ReactNode; className?: string }) {
  const [hover, setHover] = useState<string | null>(null)
  const total = segments.reduce((a, s) => a + s.value, 0) || 1
  const r = size / 2
  const gap = segments.length > 1 ? 0.025 : 0
  // Each arc starts where the previous one ended (running sum of sweeps).
  const arcs = segments.reduce<{ s: DonutSegment; start: number; end: number; next: number }[]>((acc, s) => {
    const a = acc[acc.length - 1]?.next ?? 0
    const sweep = (s.value / total) * Math.PI * 2
    return [...acc, { s, start: a + gap / 2, end: a + sweep - gap / 2, next: a + sweep }]
  }, [])
  const hovered = segments.find((s) => s.key === hover)
  return (
    <div className={cn('relative inline-grid place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {arcs.map(({ s, start, end }) => {
          if (end <= start) return null
          return (
            <path
              key={s.key}
              d={arcPath(r, r, r - (hover === s.key ? 0 : 2), r - thickness, start, end)}
              fill={s.color}
              opacity={hover && hover !== s.key ? 0.35 : 1}
              className="cursor-pointer transition-opacity duration-150"
              onMouseEnter={() => setHover(s.key)}
              onMouseLeave={() => setHover(null)}
            />
          )
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        {hovered ? (
          <div>
            <div className="font-display text-xl font-semibold tabular">{((hovered.value / total) * 100).toFixed(1)}%</div>
            <div className="max-w-[100px] truncate text-[11.5px] text-fg-3">{hovered.label}</div>
          </div>
        ) : (
          center
        )}
      </div>
    </div>
  )
}

/** Status-page style bars (e.g. 90 days of uptime). */
export function UptimeBars({ items, className, height = 28 }: { items: { label: string; value: number; status: 'operational' | 'degraded' | 'outage' | 'disabled' | string }[]; className?: string; height?: number }) {
  const color = (s: string) => (s === 'operational' ? 'var(--success)' : s === 'degraded' ? 'var(--warning)' : s === 'outage' ? 'var(--danger)' : 'var(--fg-3)')
  return (
    <div className={cn('flex w-full items-end gap-[2px]', className)} style={{ height }}>
      {items.map((it, i) => (
        <Tooltip
          key={i}
          className="h-full flex-1"
          content={
            <span>
              <span className="font-medium">{it.label}</span> · {it.value.toFixed(2)}%
            </span>
          }
        >
          <span className="block h-full w-full rounded-[2px] transition-opacity hover:opacity-70" style={{ background: color(it.status), opacity: it.status === 'operational' ? 0.85 : 1 }} />
        </Tooltip>
      ))}
    </div>
  )
}

/** Horizontal ranking bars. */
export function BarList({ items, format = (v) => String(v), className, color = 'var(--accent)' }: { items: { key: string; label: ReactNode; value: number; sub?: ReactNode; color?: string }[]; format?: (v: number) => string; className?: string; color?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <div className={cn('space-y-1.5', className)}>
      {items.map((it) => (
        <div key={it.key} className="group relative flex items-center justify-between gap-3 overflow-hidden rounded-md px-2.5 py-1.5">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-md"
            style={{ background: `color-mix(in oklab, ${it.color ?? color} 13%, transparent)` }}
            initial={{ width: 0 }}
            animate={{ width: `${(it.value / max) * 100}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
          <span className="relative z-[1] min-w-0 truncate text-[13px] text-fg">{it.label}</span>
          <span className="relative z-[1] shrink-0 text-[12.5px] font-medium text-fg tabular">
            {format(it.value)}
            {it.sub && <span className="ml-2 font-normal text-fg-3">{it.sub}</span>}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Day × hour heatmap. */
export function Heatmap({ grid, rowLabels, className }: { grid: number[][]; rowLabels: string[]; className?: string }) {
  const max = Math.max(1, ...grid.flat())
  return (
    <div className={cn('w-full', className)}>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `28px repeat(${grid[0]?.length ?? 24}, minmax(0, 1fr))` }}>
        {grid.map((row, r) => (
          <div key={r} className="contents">
            <span className="self-center font-mono text-[10px] text-fg-3">{rowLabels[r]}</span>
            {row.map((v, c) => (
              <Tooltip key={c} content={`${rowLabels[r]} ${String(c).padStart(2, '0')}:00 · ${v} orders`} className="block">
                <span className="block aspect-square w-full rounded-[3px]" style={{ background: v === 0 ? 'var(--surface-3)' : `color-mix(in oklab, var(--accent) ${12 + (v / max) * 88}%, var(--surface-2))` }} />
              </Tooltip>
            ))}
          </div>
        ))}
        <span />
        {Array.from({ length: grid[0]?.length ?? 24 }, (_, c) => (
          <span key={c} className="text-center font-mono text-[9.5px] text-fg-3">
            {c % 6 === 0 ? String(c).padStart(2, '0') : ''}
          </span>
        ))}
      </div>
    </div>
  )
}
