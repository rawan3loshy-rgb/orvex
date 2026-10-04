/** Pricing-rule labels shared by the service Pricing tab and the Pricing screen. */
import { formatBps, formatMoney, type Micros } from '@/core/money'
import type { PricingRule } from '@/types/installation'

export function ruleValueLabel(r: Pick<PricingRule, 'method' | 'value'>) {
  if (r.method === 'fixed') return formatMoney(r.value as Micros)
  if (r.method === 'cost_plus_percent') return `cost + ${formatBps(r.value, r.value % 100 ? 1 : 0)}`
  return `cost + ${formatMoney(r.value as Micros)}`
}

export const METHOD_LABEL: Record<PricingRule['method'], string> = {
  fixed: 'Fixed price',
  cost_plus_percent: 'Cost + %',
  cost_plus_fixed: 'Cost + amount',
}