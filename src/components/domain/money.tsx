import { formatBps, formatMoney, type Micros, type MoneyFormat } from '@/core/money'
import { cn } from '@/lib/cn'

/** Money display — always from integer micros. Negative values can be toned. */
export function Money({ value, className, tone, ...fmt }: { value: Micros | null | undefined; className?: string; tone?: 'auto' | 'none' } & MoneyFormat) {
  const neg = value != null && value < 0
  return <span className={cn('tabular', tone === 'auto' && neg && 'text-danger', tone === 'auto' && value != null && value > 0 && fmt.sign && 'text-success', className)}>{formatMoney(value, fmt)}</span>
}

export function Bps({ value, className }: { value: number | null | undefined; className?: string }) {
  return <span className={cn('tabular', className)}>{formatBps(value)}</span>
}
