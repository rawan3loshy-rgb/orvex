import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import type { PriceRow, ServiceCategory } from '@/types/installation'
import { Skeleton, Tooltip } from '@/components/ui'
import { categoryColor } from '@/components/brand'
import { cn } from '@/lib/cn'
import { money, pct } from '@/lib/format'
import { LOW_MARGIN } from './shared'

/**
 * Margin % per service, sorted high → low. Coral is the key series (healthy margin), amber flags
 * margins below the floor, a graphite rule marks the average and a thin tick under each bar keeps
 * the service category readable. Hovering a category in the legend highlights its services.
 */
export function MarginChart({ rows, loading, height = 210 }: { rows: PriceRow[]; loading?: boolean; height?: number }) {
  const [focus, setFocus] = useState<ServiceCategory | null>(null)
  const sorted = useMemo(() => rows.slice().sort((a, b) => b.marginPercent - a.marginPercent), [rows])
  const top = Math.max(80, Math.ceil(Math.max(0, ...rows.map((r) => r.marginPercent)) / 20) * 20)
  const avg = rows.length ? rows.reduce((a, r) => a + r.marginPercent, 0) / rows.length : 0
  const categories = useMemo(() => [...new Set(sorted.map((r) => r.category))], [sorted])

  if (loading) return <Skeleton className="h-[240px] w-full rounded-lg" />

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(top * t))
  return (
    <div>
      <div className="relative pl-9" style={{ height }}>
        {/* grid */}
        {ticks.map((t) => (
          <div key={t} className="absolute right-0 left-9 flex items-center" style={{ bottom: `${(t / top) * 100}%` }}>
            <span className="absolute -left-9 w-7 -translate-y-1/2 text-right font-mono text-[10px] text-fg-3 tabular">{t}%</span>
            <span className={t === 0 ? 'h-px w-full bg-line-strong' : 'w-full border-t border-dashed border-line'} />
          </div>
        ))}
        {/* low-margin zone */}
        <div className="absolute right-0 bottom-0 left-9 bg-hatch bg-warning/[0.05]" style={{ height: `${(LOW_MARGIN / top) * 100}%` }} />
        {/* average */}
        {rows.length > 0 && (
          <div className="pointer-events-none absolute right-0 left-9 z-[2] border-t border-dashed border-accent-2/60" style={{ bottom: `${(avg / top) * 100}%` }}>
            <span className="absolute -top-[18px] right-0 rounded bg-surface-2 px-1.5 font-mono text-[10px] text-fg-2 ring-1 ring-line">avg {pct(avg)}</span>
          </div>
        )}
        {/* bars */}
        <div className="absolute inset-y-0 right-0 left-9 z-[1] flex items-end gap-[3px] px-1">
          {sorted.map((r, i) => {
            const low = r.marginPercent < LOW_MARGIN
            const dim = focus != null && r.category !== focus
            return (
              <Tooltip
                key={r.serviceId}
                className="h-full min-w-0 flex-1 items-end"
                content={
                  <span className="block">
                    <span className="block font-medium">{r.serviceName}</span>
                    <span className="block text-fg-3">{r.category}</span>
                    <span className="block text-fg-2">
                      Margin {pct(r.marginPercent)} · {money(r.margin)} per order
                    </span>
                    <span className="block text-fg-3">
                      {money(r.cost)} supplier cost → {money(r.groupPrice)} price{r.overridden ? ' (contract)' : ''}
                    </span>
                  </span>
                }
              >
                <motion.span
                  className={cn('block w-full rounded-t-[3px] transition-opacity duration-200 hover:opacity-80', dim && 'opacity-25')}
                  style={{
                    backgroundColor: low ? 'var(--warning)' : 'var(--c1)',
                    backgroundImage: r.overridden ? 'repeating-linear-gradient(135deg, transparent 0 3px, rgb(255 255 255 / 0.28) 3px 5px)' : undefined,
                  }}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(1, (Math.max(0, r.marginPercent) / top) * 100)}%` }}
                  transition={{ duration: 0.7, delay: i * 0.015, ease: [0.16, 1, 0.3, 1] }}
                />
              </Tooltip>
            )
          })}
        </div>
      </div>
      {/* category ticks */}
      <div className="mt-1 flex gap-[3px] pr-1 pl-10" aria-hidden>
        {sorted.map((r) => (
          <span key={r.serviceId} className={cn('h-[3px] min-w-0 flex-1 rounded-full transition-opacity', focus != null && r.category !== focus && 'opacity-20')} style={{ background: categoryColor(r.category) }} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pl-9">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] text-fg-3">
          <Key swatch="var(--c1)" label="Margin" />
          <Key swatch="var(--warning)" label={`Below ${LOW_MARGIN}%`} />
          <Key swatch="repeating-linear-gradient(135deg, var(--c1) 0 2px, transparent 2px 4px)" label="Contract price" />
        </div>
        <div className="flex flex-wrap items-center gap-1" onMouseLeave={() => setFocus(null)}>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onMouseEnter={() => setFocus(c)}
              onFocus={() => setFocus(c)}
              onBlur={() => setFocus(null)}
              onClick={() => setFocus((f) => (f === c ? null : c))}
              className={cn('inline-flex h-6 items-center gap-1.5 rounded-md px-1.5 text-[11.5px] transition-colors', focus === c ? 'bg-surface-3 text-fg' : 'text-fg-3 hover:text-fg-2')}
            >
              <span className="h-[3px] w-2.5 rounded-full" style={{ background: categoryColor(c) }} />
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Key({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2 rounded-[3px]" style={{ background: swatch }} />
      {label}
    </span>
  )
}
