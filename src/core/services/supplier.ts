/**
 * SupplierService — health, circuit breaker and outcome classification.
 *
 * Classification is the heart of safe routing:
 *   accepted                  → success path (result now or later)
 *   rejected (mapped safe)    → rejected_failover_safe  → next offer allowed
 *   rejected (default)        → rejected_terminal       → order rejected
 *   rate limited / insufficient supplier funds / auth failed / connection refused
 *                             → not_accepted            → the supplier provably did not take the order → next offer allowed
 *   timeout / unusable response after the request was sent
 *                             → unknown                 → needs_review, failover BLOCKED (could duplicate the order)
 */
import type { Micros } from '../money'
import type { CoreContext, SubmitResponse } from '../ports'
import type { AttemptClassification, Supplier, SupplierHealth, SupplierMetrics } from '../domain'
import { expectedSupplierBalance } from './ledger'

export function classify(supplier: Supplier, res: SubmitResponse): AttemptClassification {
  switch (res.kind) {
    case 'accepted':
      return { kind: 'success', code: 'accepted', message: res.message, failoverSafe: false, mappingId: null }
    case 'rejected': {
      const m = supplier.errorMappings.find((x) => res.message.toLowerCase().includes(x.match.toLowerCase()) || res.code.toLowerCase() === x.match.toLowerCase())
      if (m) return { kind: m.classifyAs, code: res.code, message: res.message, failoverSafe: m.classifyAs !== 'rejected_terminal', mappingId: m.id }
      return { kind: 'rejected_terminal', code: res.code, message: res.message, failoverSafe: false, mappingId: null }
    }
    case 'rate_limited':
      return { kind: 'not_accepted', code: 'rate_limited', message: res.message, failoverSafe: true, mappingId: null }
    case 'insufficient_funds':
      return { kind: 'not_accepted', code: 'supplier_insufficient_funds', message: res.message, failoverSafe: true, mappingId: null }
    case 'auth_failed':
      return { kind: 'not_accepted', code: 'supplier_auth_failed', message: res.message, failoverSafe: true, mappingId: null }
    case 'connect_error':
      return { kind: 'not_accepted', code: 'connection_refused', message: res.message, failoverSafe: true, mappingId: null }
    case 'timeout':
      return { kind: 'unknown', code: 'supplier_timeout', message: res.message, failoverSafe: false, mappingId: null }
    case 'bad_response':
      return { kind: 'unknown', code: `supplier_http_${res.httpStatus}`, message: res.message, failoverSafe: false, mappingId: null }
  }
}

/** Move an open circuit to half-open once its cooldown has elapsed. */
export function refreshCircuit(ctx: CoreContext, s: Supplier) {
  if (s.circuit.state === 'open' && s.circuit.openedAt && ctx.clock.now() - new Date(s.circuit.openedAt).getTime() >= s.circuit.cooldownSec * 1000) {
    s.circuit.state = 'half_open'
  }
}

/** Reason a supplier cannot receive orders, or null when routable. */
export function routableReason(_ctx: CoreContext, s: Supplier): string | null {
  if (!s.enabled) return 'Supplier disabled'
  if (s.maintenance.active) return 'Supplier in maintenance'
  if (s.auth.status === 'failed') return 'Supplier authentication failing'
  if (s.circuit.state === 'open') return 'Circuit open'
  return null
}

export function supplierMetrics(ctx: CoreContext, supplierId: string, windowDays = 7): SupplierMetrics {
  const now = ctx.clock.now()
  const since = now - windowDays * 86400_000
  const since24 = now - 86400_000
  const lat: number[] = []
  let attempts = 0
  let attempts24h = 0
  let ok = 0
  let unknown = 0
  for (const o of ctx.repo.orders.recent()) {
    const t = new Date(o.createdAt).getTime()
    if (t < since) break
    for (const a of o.attempts) {
      if (a.supplierId !== supplierId || a.state === 'sending') continue
      attempts++
      if (t >= since24) attempts24h++
      const k = a.classification?.kind
      // Terminal rejections are correct answers (bad input); failover-safe rejections,
      // non-acceptance and unknown outcomes are supplier-side failures.
      if (k === 'success' || k === 'rejected_terminal') ok++
      if (k === 'unknown') unknown++
      if (a.latencyMs != null && k !== 'unknown') lat.push(a.latencyMs)
    }
  }
  lat.sort((a, b) => a - b)
  const q = (p: number) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * p))]! : 0)
  return { windowDays, attempts, attempts24h, successRate: attempts ? +((ok / attempts) * 100).toFixed(1) : 100, unknown, latencyP50: q(0.5), latencyP95: q(0.95) }
}

export function supplierHealth(ctx: CoreContext, s: Supplier, metrics?: SupplierMetrics): SupplierHealth {
  refreshCircuit(ctx, s)
  if (!s.enabled) return 'disabled'
  if (s.maintenance.active) return 'maintenance'
  if (s.auth.status === 'failed') return 'auth_error'
  if (s.circuit.state === 'open') return 'circuit_open'
  if (s.circuit.state === 'half_open') return 'half_open'
  if (s.reportedBalance < s.lowBalanceThreshold) return 'low_balance'
  const m = metrics ?? supplierMetrics(ctx, s.id)
  if (m.attempts >= 8 && (m.successRate < 94 || m.latencyP95 > s.profile.latencyMs * 3 + 1000)) return 'degraded'
  return 'healthy'
}

/** Update circuit-breaker state after an attempt outcome. Returns a transition, if any. */
export function recordOutcome(ctx: CoreContext, s: Supplier, c: AttemptClassification): 'opened' | 'closed' | null {
  const failure = c.kind === 'unknown' || (c.kind === 'not_accepted' && c.code !== 'rate_limited')
  if (c.code === 'supplier_auth_failed') {
    s.auth = { status: 'failed', checkedAt: ctx.clock.iso(), message: c.message }
  }
  if (failure) {
    s.circuit.consecutiveFailures++
    if (s.circuit.state === 'half_open' || (s.circuit.state === 'closed' && s.circuit.consecutiveFailures >= s.circuit.threshold)) {
      s.circuit.state = 'open'
      s.circuit.openedAt = ctx.clock.iso()
      return 'opened'
    }
    return null
  }
  s.circuit.consecutiveFailures = 0
  if (s.circuit.state === 'half_open') {
    s.circuit.state = 'closed'
    s.circuit.openedAt = null
    return 'closed'
  }
  return null
}

/**
 * External reconciliation of a supplier's prepaid balance.
 *   ledger     balance of supplier_prepaid:<id> (top-ups − settled costs + supplier credits)
 *   inFlight   costs of orders the supplier has accepted but we have not settled yet
 *   expected   ledger − inFlight  (what the supplier should report right now)
 *   actual     balance reported by the supplier (driver getBalance)
 *   drift      actual − expected
 * Unknown-outcome attempts are deliberately NOT in inFlight: if the supplier did
 * process them, the drift shows exactly that amount — a signal to resolve reviews.
 */
export function supplierDrift(ctx: CoreContext, s: Supplier) {
  const ledger = expectedSupplierBalance(ctx, s.id)
  let inFlight = 0
  const unknown: { orderId: string; orderRef: string; cost: Micros }[] = []
  for (const o of ctx.repo.orders.all()) {
    if (o.status !== 'processing' && o.status !== 'needs_review') continue
    for (const a of o.attempts) {
      if (a.supplierId !== s.id) continue
      if (a.state === 'accepted') inFlight += a.cost
      if (a.state === 'unknown') unknown.push({ orderId: o.id, orderRef: o.ref, cost: a.cost })
    }
  }
  const expected = (ledger - inFlight) as typeof ledger
  return { ledger, inFlight: inFlight as typeof ledger, expected, actual: s.reportedBalance, drift: (s.reportedBalance - expected) as typeof ledger, unknown }
}
