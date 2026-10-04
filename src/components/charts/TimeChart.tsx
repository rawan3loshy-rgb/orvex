import { useId, useMemo, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { useMeasure } from '@/lib/useMeasure'
import { cn } from '@/lib/cn'
import { linearPath, monotonePath, niceMax, ticks } from './geometry'

export interface ChartSeries<K extends string = string> {
  key: K
  label: string
  color: string
  /** Defaults to the chart kind. */
  type?: 'area' | 'line' | 'bar'
  dashed?: boolean
}

export interface TimeChartProps<T> {
  data: T[]
  series: ChartSeries[]
  /** Accessor for the x label of a datum. */
  x: (d: T) => string
  kind?: 'area' | 'line' | 'bar'
  stacked?: boolean
  height?: number
  yFormat?: (v: number) => string
  xFormat?: (label: string, i: number) => string
  tooltipTitle?: (d: T) => ReactNode
  tooltipFormat?: (v: number, key: string) => string
  tooltipExtra?: (d: T) => ReactNode
  yTicks?: number
  hideYAxis?: boolean
  hideXAxis?: boolean
  className?: string
  curve?: 'smooth' | 'linear'
  /** Max visible x labels. */
  xLabelCount?: number
  minY?: number
  maxY?: number
}

const PAD = { top: 10, right: 8, bottom: 24, left: 44 }

const values = <T,>(d: T, key: string) => Number((d as Record<string, unknown>)[key] ?? 0)

/**
 * Responsive time-series chart: stacked/unstacked area, line or bar series,
 * with crosshair tooltip. Pure SVG — no charting dependency.
 */
export function TimeChart<T>({
  data,
  series,
  x,
  kind = 'area',
  stacked,
  height = 240,
  yFormat = (v) => String(Math.round(v)),
  xFormat = (l) => l,
  tooltipTitle,
  tooltipFormat,
  tooltipExtra,
  yTicks = 4,
  hideYAxis,
  hideXAxis,
  className,
  curve = 'smooth',
  xLabelCount = 6,
  minY = 0,
  maxY,
}: TimeChartProps<T>) {
  const [ref, { width }] = useMeasure<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const uid = useId().replace(/:/g, '')
  const pad = { ...PAD, left: hideYAxis ? 4 : PAD.left, bottom: hideXAxis ? 4 : PAD.bottom }
  const w = Math.max(0, width - pad.left - pad.right)
  const h = height - pad.top - pad.bottom
  const n = data.length

  const { max, stacks } = useMemo(() => {
    const st: number[][] = data.map(() => [])
    let mx = 0
    data.forEach((d, i) => {
      let acc = 0
      series.forEach((s, j) => {
        const v = values(d, s.key)
        if (stacked) {
          acc += v
          st[i]![j] = acc
          mx = Math.max(mx, acc)
        } else {
          st[i]![j] = v
          mx = Math.max(mx, v)
        }
      })
    })
    return { max: maxY ?? niceMax(mx * 1.08), stacks: st }
  },[data, series, stacked, maxY])

  const isBar = kind === 'bar'
  const band = n ? w / n : 0
  const xAt = (i: number) => (isBar ? band * i + band / 2 : n <= 1 ? w / 2 : (w / (n - 1)) * i)
  const yAt = (v: number) => h - ((v - minY) / (max - minY || 1)) * h

  const pathFor = (j: number) => {
    const pts: [number, number][] = data.map((_, i) => [xAt(i), yAt(stacks[i]![j]!)])
    return curve === 'smooth' ? monotonePath(pts) : linearPath(pts)
  }
  const areaFor = (j: number) => {
    const top: [number, number][] = data.map((_, i) => [xAt(i), yAt(stacks[i]![j]!)])
    const base: [number, number][] = data.map((_, i): [number, number] => [xAt(i), yAt(stacked && j > 0 ? stacks[i]![j - 1]! : minY)]).reverse()
    const topPath = curve === 'smooth' ? monotonePath(top) : linearPath(top)
    const basePath = stacked && j > 0 ? (curve === 'smooth' ? monotonePath(base) : linearPath(base)).replace(/^M/, 'L') : `L${base[0]![0]},${base[0]![1]}L${base[base.length - 1]![0]},${base[base.length - 1]![1]}`
    return `${topPath}${basePath}Z`
  }

  const labelEvery = Math.max(1, Math.ceil(n / xLabelCount))
  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const i = isBar ? Math.floor(px / band) : Math.round((px / (w || 1)) * (n - 1))
    setHover(Math.max(0, Math.min(n - 1, i)))
  }

  const hd = hover != null ? data[hover] : null
  const tipLeft = hover != null ? pad.left + xAt(hover) : 0
  const tipRight = tipLeft > width * 0.6

  return (
    <div ref={ref} className={cn('relative w-full select-none', className)} style={{ height }}>
      {width > 0 && n > 0 && (
        <svg width={width} height={height} className="overflow-visible">
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`g-${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={stacked ? 0.5 : 0.28} />
                <stop offset="100%" stopColor={s.color} stopOpacity={stacked ? 0.12 : 0} />
              </linearGradient>
            ))}
            <clipPath id={`clip-${uid}`}>
              <motion.rect x={0} y={-10} height={h + 20} initial={{ width: 0 }} animate={{ width: w + 10 }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
            </clipPath>
          </defs>
          <g transform={`translate(${pad.left},${pad.top})`}>
            {/* grid + y axis */}
            {ticks(max - minY, yTicks).map((tv, i) => {
              const v = tv + minY
              return (
                <g key={i} transform={`translate(0,${yAt(v)})`}>
                  <line x1={0} x2={w} stroke="var(--line)" strokeDasharray={i === 0 ? undefined : '2 4'} />
                  {!hideYAxis && (
                    <text x={-10} dy="0.32em" textAnchor="end" className="fill-fg-3 font-mono text-[10.5px] tabular">
                      {yFormat(v)}
                    </text>
                  )}
                </g>
              )
            })}
            {/* x labels */}
            {!hideXAxis &&
              data.map((d, i) => {
                const lastShown = Math.floor((n - 1) / labelEvery) * labelEvery
                const show = i % labelEvery === 0 || (i === n - 1 && n - 1 - lastShown >= labelEvery * 0.7)
                if (!show) return null
                return (
                  <text key={i} x={xAt(i)} y={h + 17} textAnchor={i === 0 && !isBar ? 'start' : i === n - 1 && !isBar ? 'end' : 'middle'} className="fill-fg-3 font-mono text-[10.5px]">
                    {xFormat(x(d), i)}
                  </text>
                )
              })}
            <g clipPath={`url(#clip-${uid})`}>
              {/* bars */}
              {series.map((s, j) =>
                (s.type ?? kind) === 'bar'
                  ? data.map((_, i) => {
                      const top = stacks[i]![j]!
                      const bottom = stacked && j > 0 ? stacks[i]![j - 1]! : minY
                      const bw = Math.max(1, Math.min(28, band * 0.62))
                      const bx = xAt(i) - bw / 2
                      const y0 = yAt(top)
                      const bh = Math.max(0, yAt(bottom) - y0)
                      const isTop = !stacked || j === series.length - 1
                      return <rect key={`${s.key}-${i}`} x={bx} y={y0} width={bw} height={bh} rx={isTop ? Math.min(3, bw / 3) : 0} fill={s.color} opacity={hover == null || hover === i ? 0.92 : 0.45} className="transition-opacity duration-150" />
                    })
                  : null,
              )}
              {/* areas */}
              {series.map((s, j) => ((s.type ?? kind) === 'area' ? <path key={`a-${s.key}`} d={areaFor(j)} fill={`url(#g-${uid}-${s.key})`} /> : null))}
              {/* lines */}
              {series.map((s, j) =>
                (s.type ?? kind) !== 'bar' ? <path key={`l-${s.key}`} d={pathFor(j)} fill="none" stroke={s.color} strokeWidth={1.75} strokeDasharray={s.dashed ? '4 4' : undefined} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" /> : null,
              )}
            </g>
            {/* crosshair */}
            {hover != null && (
              <g pointerEvents="none">
                {!isBar && <line x1={xAt(hover)} x2={xAt(hover)} y1={0} y2={h} stroke="var(--fg-3)" strokeOpacity={0.5} strokeDasharray="3 3" />}
                {isBar && <rect x={xAt(hover) - band / 2} y={0} width={band} height={h} fill="var(--fg)" opacity={0.035} />}
                {!isBar &&
                  series.map((s, j) =>
                    (s.type ?? kind) !== 'bar' ? <circle key={s.key} cx={xAt(hover)} cy={yAt(stacks[hover]![j]!)} r={3.5} fill="var(--surface)" stroke={s.color} strokeWidth={2} /> : null,
                  )}
              </g>
            )}
            <rect x={0} y={0} width={w} height={h} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
          </g>
        </svg>
      )}
      {hd && (
        <div
          className="pointer-events-none absolute top-1 z-10 min-w-[150px] rounded-lg border border-line bg-surface/95 px-3 py-2 shadow-pop backdrop-blur"
          style={tipRight ? { right: width - tipLeft + 12 } : { left: tipLeft + 12 }}
        >
          <div className="mb-1.5 text-[11.5px] font-medium text-fg-2">{tooltipTitle ? tooltipTitle(hd) : x(hd)}</div>
          <div className="space-y-1">
            {series
              .slice()
              .reverse()
              .map((s) => (
                <div key={s.key} className="flex items-center justify-between gap-4 text-[12px]">
                  <span className="flex items-center gap-1.5 text-fg-2">
                    <span className="size-2 rounded-[3px]" style={{ background: s.color }} />
                    {s.label}
                  </span>
                  <span className="font-medium text-fg tabular">{tooltipFormat ? tooltipFormat(values(hd, s.key), s.key) : yFormat(values(hd, s.key))}</span>
                </div>
              ))}
          </div>
          {tooltipExtra && <div className="mt-1.5 border-t border-line pt-1.5">{tooltipExtra(hd)}</div>}
        </div>
      )}
    </div>
  )
}

export function ChartLegend({ items, className }: { items: { label: string; color: string; value?: ReactNode }[]; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-[12px] text-fg-2">
          <span className="size-2 rounded-[3px]" style={{ background: it.color }} />
          {it.label}
          {it.value != null && <span className="font-medium text-fg tabular">{it.value}</span>}
        </span>
      ))}
    </div>
  )
}
