import type { PriceRow, PricingGroup } from '@/types/installation'

export const round2 = (v: number) => Math.round(v * 100) / 100

/** Price produced by the group rule alone (public price minus group discount). */
export function rulePrice(publicPrice: number, discountPercent: number) {
  return round2(publicPrice * (1 - discountPercent / 100))
}

/** Re-derive a price row for a hypothetical group discount (live preview while editing). */
export function previewRow(row: PriceRow, discountPercent: number): PriceRow {
  if (row.overridden) return row
  const groupPrice = rulePrice(row.publicPrice, discountPercent)
  const margin = round2(groupPrice - row.cost)
  return {
    ...row,
    groupPrice,
    margin,
    marginPercent: groupPrice ? +((margin / groupPrice) * 100).toFixed(1) : 0,
    markupPercent: row.cost ? +((margin / row.cost) * 100).toFixed(1) : 0,
  }
}

export const LOW_MARGIN = 30

export function groupSummary(rows: PriceRow[], group?: PricingGroup) {
  const n = rows.length || 1
  const avgMargin = rows.reduce((a, r) => a + r.marginPercent, 0) / n
  const avgMarkup = rows.reduce((a, r) => a + r.markupPercent, 0) / n
  const lowest = rows.reduce<PriceRow | null>((m, r) => (!m || r.marginPercent < m.marginPercent ? r : m), null)
  const belowCost = rows.filter((r) => r.margin < 0)
  const lowMargin = rows.filter((r) => r.marginPercent < LOW_MARGIN)
  return { avgMargin, avgMarkup, lowest, belowCost, lowMargin, overrides: group?.overrides.length ?? rows.filter((r) => r.overridden).length }
}
