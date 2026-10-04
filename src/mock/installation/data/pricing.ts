/**
 * DEMO DATA — pricing tiers and rules.
 *
 *   Retail    fixed list price per service (what storefront visitors and guests pay)
 *   Silver    cost + 25%   (+ category overrides)
 *   Gold      cost + 30%   (+ negotiated service prices)
 *   Platinum  cost + 15%   (+ contract prices, e.g. iPhone 15 Carrier Check $0.82)
 * Rounding: up to the next cent unless stated.
 */
import { usd, type Micros } from '@/core/money'
import type { PricingRule, PricingTier } from '@/core/domain'
import { SERVICE_SPECS } from './catalog'

export const TIERS: PricingTier[] = [
  { id: 'tier_retail', name: 'Retail', description: 'Storefront list prices — guests and retail customers.', color: 'var(--c6)', sort: 0, isDefault: true },
  { id: 'tier_silver', name: 'Silver', description: 'Repair shops and small resellers.', color: 'var(--c3)', sort: 1, isDefault: false },
  { id: 'tier_gold', name: 'Gold', description: 'Established resellers with monthly volume.', color: 'var(--c4)', sort: 2, isDefault: false },
  { id: 'tier_platinum', name: 'Platinum', description: 'Distributors and API partners under contract.', color: 'var(--c2)', sort: 3, isDefault: false },
]

const CENT = usd(0.01)
const up = { increment: CENT, mode: 'up' as const }

export function buildRules(now: number): PricingRule[] {
  const at = (d: number) => new Date(now - d * 86400_000).toISOString()
  const rules: PricingRule[] = []
  const r = (id: string, p: Omit<PricingRule, 'id' | 'updatedAt' | 'updatedBy' | 'enabled' | 'note' | 'minMarginBps'> & { note?: string; minMarginBps?: number | null; days?: number; by?: string }) =>
    rules.push({ id, tierId: p.tierId, scope: p.scope, method: p.method, value: p.value, rounding: p.rounding, minMarginBps: p.minMarginBps ?? null, enabled: true, note: p.note ?? '', updatedAt: at(p.days ?? 40), updatedBy: p.by ?? 'Alex Morgan' })

  for (const s of SERVICE_SPECS) {
    r(`prl_retail_${s.code}`, { tierId: 'tier_retail', scope: { kind: 'service', serviceId: `svc_${s.code}` }, method: 'fixed', value: usd(s.retail), rounding: { increment: CENT, mode: 'nearest' }, note: 'List price', days: 30 + (Number(s.code) % 50) })
  }
  r('prl_silver_all', { tierId: 'tier_silver', scope: { kind: 'all' }, method: 'cost_plus_percent', value: 2500, rounding: up, minMarginBps: 1000, note: 'Silver default', days: 120 })
  r('prl_gold_all', { tierId: 'tier_gold', scope: { kind: 'all' }, method: 'cost_plus_percent', value: 3000, rounding: up, minMarginBps: 1000, note: 'Gold default', days: 120 })
  r('prl_platinum_all', { tierId: 'tier_platinum', scope: { kind: 'all' }, method: 'cost_plus_percent', value: 1500, rounding: up, minMarginBps: 600, note: 'Platinum default', days: 120 })

  r('prl_silver_warranty', { tierId: 'tier_silver', scope: { kind: 'category', categoryId: 'cat_warranty' }, method: 'cost_plus_percent', value: 3500, rounding: up, note: 'Small-ticket items carry more markup', days: 60 })
  r('prl_silver_device', { tierId: 'tier_silver', scope: { kind: 'category', categoryId: 'cat_device' }, method: 'cost_plus_percent', value: 3500, rounding: up, days: 60 })
  r('prl_silver_unlock', { tierId: 'tier_silver', scope: { kind: 'category', categoryId: 'cat_unlock' }, method: 'cost_plus_percent', value: 2000, rounding: { increment: usd(0.05), mode: 'up' }, note: 'Unlock codes rounded to 5 cents', days: 60 })
  r('prl_gold_warranty', { tierId: 'tier_gold', scope: { kind: 'category', categoryId: 'cat_warranty' }, method: 'cost_plus_percent', value: 4000, rounding: up, days: 55 })
  r('prl_gold_serial', { tierId: 'tier_gold', scope: { kind: 'category', categoryId: 'cat_serial' }, method: 'cost_plus_percent', value: 4000, rounding: up, days: 55 })
  r('prl_platinum_unlock', { tierId: 'tier_platinum', scope: { kind: 'category', categoryId: 'cat_unlock' }, method: 'cost_plus_percent', value: 1200, rounding: { increment: usd(0.05), mode: 'up' }, minMarginBps: 500, days: 50 })
  r('prl_platinum_carrier', { tierId: 'tier_platinum', scope: { kind: 'category', categoryId: 'cat_carrier' }, method: 'cost_plus_fixed', value: usd(0.12), rounding: up, note: 'Flat margin on network checks', days: 50 })

  r('prl_platinum_4001', { tierId: 'tier_platinum', scope: { kind: 'service', serviceId: 'svc_4001' }, method: 'fixed', value: usd(0.82), rounding: { increment: CENT, mode: 'nearest' }, minMarginBps: 500, note: 'Contract price — MobileHub & TechRepair Pro (until 2027-03)', days: 21 })
  r('prl_platinum_4011', { tierId: 'tier_platinum', scope: { kind: 'service', serviceId: 'svc_4011' }, method: 'fixed', value: usd(0.4), rounding: { increment: CENT, mode: 'nearest' }, note: 'Contract price set before Gamma raised its cost', days: 64 })
  r('prl_gold_4037', { tierId: 'tier_gold', scope: { kind: 'service', serviceId: 'svc_4037' }, method: 'fixed', value: usd(18), rounding: { increment: CENT, mode: 'nearest' }, note: 'Negotiated with ABC GSM', days: 33 })
  r('prl_gold_4006', { tierId: 'tier_gold', scope: { kind: 'service', serviceId: 'svc_4006' }, method: 'fixed', value: usd(0.15), rounding: { increment: CENT, mode: 'nearest' }, note: 'Volume blacklist price', days: 18 })
  return rules
}

export const CENT_MICROS: Micros = CENT
