import { formatBps, formatMoney } from '@/core/money'
import type { PriceQuote } from '@/types/installation'
import { Badge } from '@/components/ui'
import { cn } from '@/lib/cn'

const GUARD: Record<PriceQuote['guard'], { tone: 'success' | 'warning' | 'danger' | 'neutral'; label: string }> = {
  ok: { tone: 'success', label: 'Margin healthy' },
  low_margin: { tone: 'warning', label: 'Low margin' },
  negative_margin: { tone: 'danger', label: 'Negative margin' },
  no_cost: { tone: 'neutral', label: 'No supplier cost' },
}

export function MarginGuardBadge({ guard, className }: { guard: PriceQuote['guard']; className?: string }) {
  const g = GUARD[guard]
  return (
    <Badge tone={g.tone} dot className={className}>
      {g.label}
    </Badge>
  )
}

/** "Why this price?" — the PricingEngine's step-by-step explanation. */
export function PriceSteps({ quote, className, compact }: { quote: PriceQuote; className?: string; compact?: boolean }) {
  return (
    <div className={cn('rounded-lg border border-line bg-surface-2/40', className)}>
      {!compact && (
        <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
          <div className="text-[12.5px] font-semibold">Why this price? · {quote.tierName}</div>
          <MarginGuardBadge guard={quote.guard} />
        </div>
      )}
      <ol className="divide-y divide-line/70">
        {quote.steps.map((s, i) => {
          const final = s.label === 'Final price'
          return (
            <li key={i} className={cn('flex items-baseline justify-between gap-4 px-3.5 py-2', final && 'bg-surface-2/60')}>
              <div className="min-w-0">
                <div className={cn('text-[12.5px]', final ? 'font-semibold text-fg' : 'text-fg-2')}>{s.label}</div>
                {s.detail && <div className="truncate text-[11.5px] text-fg-3">{s.detail}</div>}
              </div>
              {s.amount != null && <div className={cn('shrink-0 font-mono text-[12.5px] tabular', final ? 'font-semibold text-fg' : s.label === 'Margin' && s.amount < 0 ? 'text-danger' : 'text-fg-2')}>{s.label === 'Markup' ? '+' : ''}{formatMoney(s.amount)}</div>}
            </li>
          )
        })}
      </ol>
      {!compact && <div className="border-t border-line px-3.5 py-2 text-[11.5px] text-fg-3">Calculated live from the pricing rules and the supplier cost — never copied. Orders snapshot this quote{quote.marginBps != null ? ` · margin ${formatBps(quote.marginBps)}` : ''}.</div>}
    </div>
  )
}
