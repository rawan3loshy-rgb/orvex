/**
 * RoutingEngine — V1 priority routing with guarded failover.
 *
 *  1. Offers are tried strictly in priority order.
 *  2. An offer is skipped when it is disabled, its product was removed, its
 *     supplier is not routable (disabled, maintenance, auth failing, circuit
 *     open) or its cost breaks the margin guard (cost > order price, or above
 *     the offer's max cost).
 *  3. Failover to the next offer happens only after a definitive outcome that
 *     is classified failover-safe (rejected_failover_safe or not_accepted).
 *     An UNKNOWN outcome never fails over — the order goes to needs_review.
 *
 * No weighted / round-robin / scoring strategies in V1: they need measured data
 * first, and every additional strategy makes outcomes harder to explain.
 */
import { formatMoney, type Micros } from '../money'
import type { CoreContext } from '../ports'
import type { Offer, Order, Service, Supplier, SupplierProduct } from '../domain'
import { refreshCircuit, routableReason } from './supplier'

export interface RankedOffer {
  offer: Offer
  product: SupplierProduct | null
  supplier: Supplier | null
  cost: Micros
  routable: boolean
  /** Why the offer cannot be used right now. */
  reasons: string[]
}

export function rankOffers(ctx: CoreContext, serviceId: string): RankedOffer[] {
  return ctx.repo.offers
    .filter((o) => o.serviceId === serviceId)
    .sort((a, b) => a.priority - b.priority)
    .map((offer) => {
      const product = ctx.repo.products.get(offer.supplierProductId) ?? null
      const supplier = ctx.repo.suppliers.get(offer.supplierId) ?? null
      if (supplier) refreshCircuit(ctx, supplier)
      const cost = (product?.cost ?? 0) as Micros
      const reasons: string[] = []
      if (!offer.enabled) reasons.push(offer.disabledReason ?? 'Offer disabled')
      if (!product || product.status === 'removed') reasons.push('Product removed by supplier')
      if (!supplier) reasons.push('Supplier missing')
      else {
        const r = routableReason(ctx, supplier)
        if (r) reasons.push(r)
      }
      if (offer.maxCost != null && cost > offer.maxCost) reasons.push(`Cost ${formatMoney(cost)} exceeds max cost ${formatMoney(offer.maxCost)}`)
      return { offer, product, supplier, cost, routable: reasons.length === 0, reasons }
    })
}

export interface RouteCandidate extends RankedOffer {
  eligible: boolean
  role: 'primary' | 'failover'
  attempted: boolean
  marginBlocked: boolean
}

/** Candidate chain for an order at its snapshotted price. */
export function candidatesFor(ctx: CoreContext, order: Order): RouteCandidate[] {
  const attempted = new Set(order.attempts.map((a) => a.offerId))
  return rankOffers(ctx, order.serviceId).map((r, i) => {
    const marginBlocked = r.cost > order.price.amount
    const reasons = [...r.reasons]
    if (marginBlocked) reasons.push(`Margin guard: cost ${formatMoney(r.cost)} > price ${formatMoney(order.price.amount)}`)
    const isAttempted = attempted.has(r.offer.id)
    return { ...r, reasons, marginBlocked, attempted: isAttempted, eligible: r.routable && !marginBlocked && !isAttempted, role: i === 0 ? 'primary' : 'failover' }
  })
}

export function nextCandidate(ctx: CoreContext, order: Order): RouteCandidate | null {
  return candidatesFor(ctx, order).find((c) => c.eligible) ?? null
}

export interface Availability {
  available: boolean
  reason: string | null
  routableOffers: number
  totalOffers: number
}

/** Can this service accept an order right now at the given price? */
export function availability(ctx: CoreContext, service: Service, price: Micros | null): Availability {
  const ranked = rankOffers(ctx, service.id)
  const routable = ranked.filter((r) => r.routable && (price == null || r.cost <= price))
  if (service.status !== 'active') return { available: false, reason: `Service is ${service.status}`, routableOffers: routable.length, totalOffers: ranked.length }
  if (ranked.length === 0) return { available: false, reason: 'No supplier offer mapped', routableOffers: 0, totalOffers: 0 }
  if (routable.length === 0) {
    const anyRoutable = ranked.some((r) => r.routable)
    return { available: false, reason: anyRoutable ? 'Every routable offer costs more than the price (margin guard)' : 'All supplier offers are unavailable', routableOffers: 0, totalOffers: ranked.length }
  }
  return { available: true, reason: null, routableOffers: routable.length, totalOffers: ranked.length }
}
