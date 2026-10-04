/**
 * PricingEngine — prices are calculated, never copied.
 *
 *   price = rule(tier, service | category | all)(reference supplier cost)
 *
 * Rule precedence inside a tier: service → category → all. A tier with no
 * matching rule inherits the default (Retail) tier. The reference cost is the
 * cost of the first routable offer in priority order. The storefront, portal,
 * native API, DHRU endpoint and PlaceOrder all call `quote`; PlaceOrder
 * snapshots the result on the order so later changes never alter it.
 */
import { add, bpsOf, formatBps, formatMoney, ofBps, roundTo, sub, type Micros } from '../money'
import type { CoreContext } from '../ports'
import type { PriceQuote, PriceStep, PricingRule, PricingTier, Service } from '../domain'
import { notFound } from '../errors'
import { rankOffers } from './routing'

/** Margin below which a quote is flagged `low_margin` (when the rule sets none). */
export const DEFAULT_MIN_MARGIN_BPS = 800

export function defaultTier(ctx: CoreContext): PricingTier {
  return ctx.repo.tiers.find((t) => t.isDefault) ?? ctx.repo.tiers.all()[0]!
}

function scopeRank(rule: PricingRule, service: Service): number {
  if (rule.scope.kind === 'service') return rule.scope.serviceId === service.id ? 3 : 0
  if (rule.scope.kind === 'category') return rule.scope.categoryId === service.categoryId ? 2 : 0
  return 1
}

export function resolveRule(ctx: CoreContext, service: Service, tierId: string): { rule: PricingRule | null; tier: PricingTier; inheritedFrom: PricingTier | null } {
  const tier = ctx.repo.tiers.get(tierId) ?? defaultTier(ctx)
  const best = (tid: string) =>
    ctx.repo.rules
      .filter((r) => r.enabled && r.tierId === tid)
      .map((r) => ({ r, rank: scopeRank(r, service) }))
      .filter((x) => x.rank > 0)
      .sort((a, b) => b.rank - a.rank)[0]?.r ?? null
  const own = best(tier.id)
  if (own) return { rule: own, tier, inheritedFrom: null }
  const def = defaultTier(ctx)
  if (def.id !== tier.id) {
    const inherited = best(def.id)
    if (inherited) return { rule: inherited, tier, inheritedFrom: def }
  }
  return { rule: null, tier, inheritedFrom: null }
}

export function ruleLabel(ctx: CoreContext, rule: PricingRule | null): string {
  if (!rule) return 'No pricing rule'
  const tier = ctx.repo.tiers.get(rule.tierId)?.name ?? rule.tierId
  const scope =
    rule.scope.kind === 'service'
      ? (ctx.repo.services.get(rule.scope.serviceId)?.name ?? 'service')
      : rule.scope.kind === 'category'
        ? (ctx.repo.categories.get(rule.scope.categoryId)?.name ?? 'category')
        : 'all services'
  const how =
    rule.method === 'fixed' ? `fixed ${formatMoney(rule.value as Micros)}` : rule.method === 'cost_plus_percent' ? `cost + ${formatBps(rule.value, rule.value % 100 ? 1 : 0)}` : `cost + ${formatMoney(rule.value as Micros)}`
  return `${tier} · ${scope} · ${how}`
}

export function quote(ctx: CoreContext, serviceId: string, tierId: string): PriceQuote {
  const service = ctx.repo.services.get(serviceId)
  if (!service) throw notFound('Service', serviceId)
  const { rule, tier, inheritedFrom } = resolveRule(ctx, service, tierId)
  const ranked = rankOffers(ctx, service.id)
  const ref = ranked.find((c) => c.routable) ?? ranked[0] ?? null
  const cost = ref ? ref.cost : null
  const steps: PriceStep[] = []
  const supplierName = ref ? (ctx.repo.suppliers.get(ref.offer.supplierId)?.name ?? ref.offer.supplierId) : null

  if (cost != null) steps.push({ label: 'Supplier cost', detail: `${supplierName} · priority ${ref!.offer.priority}${ref!.routable ? '' : ' (not routable)'}`, amount: cost })
  else steps.push({ label: 'Supplier cost', detail: 'No mapped offer' })

  let amount = 0 as Micros
  if (!rule) {
    steps.push({ label: 'No pricing rule', detail: `No rule for ${tier.name} or the default tier` })
  } else if (rule.method === 'fixed') {
    amount = rule.value as Micros
    steps.push({ label: 'Fixed price', detail: ruleLabel(ctx, rule) + (inheritedFrom ? ` (inherited from ${inheritedFrom.name})` : ''), amount })
  } else if (cost == null) {
    steps.push({ label: 'Cannot price', detail: 'Cost-based rule but no supplier cost' })
  } else {
    const markup = rule.method === 'cost_plus_percent' ? ofBps(cost, rule.value) : (rule.value as Micros)
    const raw = add(cost, markup)
    steps.push({ label: 'Markup', detail: `${rule.method === 'cost_plus_percent' ? formatBps(rule.value, rule.value % 100 ? 1 : 0) : 'fixed'} · ${ruleLabel(ctx, rule)}${inheritedFrom ? ` (inherited from ${inheritedFrom.name})` : ''}`, amount: markup })
    steps.push({ label: 'Subtotal', amount: raw })
    amount = roundTo(raw, rule.rounding.increment, rule.rounding.mode)
    steps.push({ label: 'Rounding', detail: `${rule.rounding.mode === 'up' ? 'Up' : rule.rounding.mode === 'down' ? 'Down' : 'Nearest'} to ${formatMoney(rule.rounding.increment)}`, amount })
  }

  const margin = cost != null && amount > 0 ? sub(amount, cost) : null
  const marginBps = margin != null ? bpsOf(margin, amount) : null
  const minMargin = rule?.minMarginBps ?? DEFAULT_MIN_MARGIN_BPS
  const guard: PriceQuote['guard'] = cost == null ? 'no_cost' : margin! < 0 ? 'negative_margin' : marginBps! < minMargin ? 'low_margin' : 'ok'
  if (margin != null) steps.push({ label: 'Margin', detail: `${formatBps(marginBps)}${guard === 'negative_margin' ? ' — negative' : guard === 'low_margin' ? ` — below ${formatBps(minMargin, 0)} target` : ''}`, amount: margin })
  steps.push({ label: 'Final price', amount })

  return {
    serviceId: service.id,
    tierId: tier.id,
    tierName: tier.name,
    amount,
    ruleId: rule?.id ?? null,
    ruleLabel: ruleLabel(ctx, rule),
    method: rule?.method ?? 'fixed',
    referenceCost: cost,
    referenceOfferId: ref?.offer.id ?? null,
    referenceSupplierId: ref?.offer.supplierId ?? null,
    margin,
    marginBps,
    guard,
    steps,
    inheritedFrom: inheritedFrom?.name ?? null,
  }
}

/** Quotes for every tier — powers the service pricing matrix. */
export function quoteAllTiers(ctx: CoreContext, serviceId: string): PriceQuote[] {
  return ctx.repo.tiers
    .all()
    .sort((a, b) => a.sort - b.sort)
    .map((t) => quote(ctx, serviceId, t.id))
}
