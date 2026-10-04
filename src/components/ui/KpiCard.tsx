import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Sparkline } from '@/components/charts/Mini'
import { Skeleton } from './Display'

export interface KpiCardProps {
  label: ReactNode
  value: ReactNode
  /** Percent change vs comparison period. */
  delta?: number | null
  /** When true, a negative delta is good (e.g. failures). */
  invertDelta?: boolean
  deltaLabel?: string
  spark?: number[]
  sparkColor?: string
  icon?: ReactNode
  footer?: ReactNode
  loading?: boolean
  className?: string
  onClick?: () => void
}

export function KpiCard({ label, value, delta, invertDelta, deltaLabel = 'vs yesterday', spark, sparkColor = 'var(--accent)', icon, footer, loading, className, onClick }: KpiCardProps) {
  const good = delta == null ? null : invertDelta ? delta <= 0 : delta >= 0
  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface p-4 shadow-card transition-[border-color,box-shadow] duration-200',
        onClick && 'cursor-pointer hover:border-line-strong hover:shadow-pop',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[12.5px] font-medium text-fg-2 [&_svg]:size-3.5 [&_svg]:text-fg-3">
          {icon}
          {label}
        </span>
        {delta != null && !loading && (
          <span className={cn('inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular', good ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger')}>
            {delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        {loading ? <Skeleton className="h-7 w-24" /> : <div className="shrink-0 font-display text-[22px] leading-none font-semibold tracking-[-0.025em] whitespace-nowrap text-fg tabular sm:text-[26px]">{value}</div>}
        {spark && spark.length > 1 && !loading && <Sparkline values={spark} color={sparkColor} height={30} className="hidden max-w-[96px] min-w-0 flex-1 opacity-90 min-[520px]:block" />}
      </div>
      <div className="mt-2.5 min-h-[18px] text-[12px] text-fg-3">{footer ?? (delta != null ? deltaLabel : null)}</div>
    </div>
  )
}
