/**
 * ResolveReview — operator actions on needs_review orders.
 *
 *   Lookup supplier            ask the supplier for the order (by reference or our order ref)
 *   Confirm not received       operator confirms the supplier has no record → failover allowed again
 *   Enter supplier reference   operator found the order at the supplier → resume status polling
 *   Resolve manually           operator decides completed / rejected
 * Every action requires `orders.review`, a reason (except lookups) and writes an audit event.
 */
import type { CoreContext } from '../ports'
import type { Actor, Order, OrderResult, ReviewAction } from '../domain'
import { conflict, invalid } from '../errors'
import { requirePermission } from '../services/access'
import { addEvent, transition } from '../services/orderMachine'
import { audit } from '../services/audit'
import { cancelOrder, rejectOrder, settleOrder } from './orders'
import { dispatch } from './worker'

function reviewOrder(ctx: CoreContext, orderId: string) {
  const order = ctx.repo.orders.byRef(orderId) ?? ctx.repo.orders.require(orderId)
  if (order.status !== 'needs_review' || !order.review) throw conflict('not_in_review', `Order ${order.ref} is not awaiting review`)
  const attempt = order.attempts.find((a) => a.id === order.review!.attemptId) ?? order.attempts.at(-1)
  if (!attempt) throw conflict('no_attempt', 'Order has no supplier attempt')
  return { order, attempt }
}

function needReason(reason: string | undefined) {
  if (!reason || reason.trim().length < 4) throw invalid('A reason is required for manual review actions (min. 4 characters)')
}

function closeReview(ctx: CoreContext, order: Order, action: ReviewAction, reason: string, actor: Actor) {
  order.review!.resolvedAt = ctx.clock.iso()
  order.review!.resolution = { action, reason, by: actor }
}

export function lookupSupplier(ctx: CoreContext, p: { orderId: string; actor: Actor }) {
  requirePermission(ctx, p.actor, 'orders.review')
  const { order, attempt } = reviewOrder(ctx, p.orderId)
  const supplier = ctx.repo.suppliers.require(attempt.supplierId)
  const res = ctx.drivers.get(supplier.driver).getStatus(supplier, order, attempt.externalRef)
  ctx.repo.driverCalls.insert({ ...res.call, orderId: order.id, attemptId: attempt.id })
  const st = res.value
  const outcome = st.state === 'completed' ? 'found_completed' : st.state === 'processing' || st.state === 'pending' ? 'found_processing' : st.state === 'rejected' ? 'found_rejected' : 'not_found'
  order.review!.lookups.push({ at: ctx.clock.iso(), outcome, detail: st.message })
  addEvent(ctx, order, { type: 'review_action', title: 'Supplier lookup', detail: `${supplier.name}: ${st.message}`, tone: outcome === 'not_found' ? 'warning' : 'info', actor: p.actor, ref: { kind: 'attempt', id: attempt.id } })
  audit(ctx, { actor: p.actor, action: 'order.review.lookup', target: { type: 'order', id: order.id, label: order.ref }, summary: `Looked up order at ${supplier.name}: ${outcome.replace('_', ' ')}`, permission: 'orders.review' })

  if (st.state === 'completed' && st.result) {
    attempt.state = 'succeeded'
    attempt.externalRef = st.externalRef ?? attempt.externalRef
    closeReview(ctx, order, 'lookup_supplier', 'Supplier confirmed the order was fulfilled', p.actor)
    transition(ctx, order, 'processing')
    settleOrder(ctx, order, attempt, st.result, p.actor)
  } else if (st.state === 'processing' || st.state === 'pending') {
    attempt.state = 'accepted'
    attempt.externalRef = st.externalRef ?? attempt.externalRef
    closeReview(ctx, order, 'lookup_supplier', 'Supplier has the order and is processing it', p.actor)
    transition(ctx, order, 'processing')
    addEvent(ctx, order, { type: 'processing', title: 'Processing at supplier', detail: `Reference ${attempt.externalRef} — polling resumed`, tone: 'neutral' })
    ctx.scheduler.schedule('attempt.poll', { orderId: order.id, attemptId: attempt.id }, ctx.clock.now() + (st.retryAfterMs ?? 60_000))
  } else if (st.state === 'rejected') {
    attempt.state = 'rejected'
    closeReview(ctx, order, 'lookup_supplier', 'Supplier reports the order as rejected', p.actor)
    transition(ctx, order, 'processing')
    rejectOrder(ctx, order, { code: 'supplier_rejected', message: st.message }, p.actor)
  }
  return order
}

export function confirmNotReceived(ctx: CoreContext, p: { orderId: string; reason: string; then: 'retry' | 'cancel'; actor: Actor }) {
  requirePermission(ctx, p.actor, 'orders.review')
  needReason(p.reason)
  const { order, attempt } = reviewOrder(ctx, p.orderId)
  attempt.state = 'confirmed_not_received'
  if (attempt.classification) attempt.classification = { ...attempt.classification, failoverSafe: true }
  closeReview(ctx, order, 'confirm_not_received', p.reason, p.actor)
  addEvent(ctx, order, { type: 'review_action', title: 'Operator confirmed supplier did not receive the order', detail: p.reason, tone: 'info', actor: p.actor })
  audit(ctx, { actor: p.actor, action: 'order.review.confirm_not_received', target: { type: 'order', id: order.id, label: order.ref }, summary: `Confirmed ${ctx.repo.suppliers.get(attempt.supplierId)?.name} has no record — ${p.then === 'retry' ? 'failover allowed' : 'cancel'}`, reason: p.reason, severity: 'warning', permission: 'orders.review' })
  if (p.then === 'cancel') {
    transition(ctx, order, 'queued')
    return cancelOrder(ctx, { orderId: order.id, actor: p.actor, reason: p.reason })
  }
  transition(ctx, order, 'processing')
  dispatch(ctx, order.id)
  return order
}

export function enterSupplierReference(ctx: CoreContext, p: { orderId: string; externalRef: string; reason: string; actor: Actor }) {
  requirePermission(ctx, p.actor, 'orders.review')
  needReason(p.reason)
  if (!p.externalRef.trim()) throw invalid('Supplier reference is required')
  const { order, attempt } = reviewOrder(ctx, p.orderId)
  attempt.externalRef = p.externalRef.trim()
  attempt.state = 'accepted'
  closeReview(ctx, order, 'enter_supplier_reference', p.reason, p.actor)
  transition(ctx, order, 'processing')
  addEvent(ctx, order, { type: 'review_action', title: 'Supplier reference entered', detail: `${attempt.externalRef} · ${p.reason}`, tone: 'info', actor: p.actor })
  audit(ctx, { actor: p.actor, action: 'order.review.reference_entered', target: { type: 'order', id: order.id, label: order.ref }, summary: `Linked supplier reference ${attempt.externalRef}`, reason: p.reason, severity: 'notice', permission: 'orders.review' })
  ctx.scheduler.schedule('attempt.poll', { orderId: order.id, attemptId: attempt.id }, ctx.clock.now() + 1500)
  return order
}

export function resolveManually(ctx: CoreContext, p: { orderId: string; outcome: 'completed' | 'rejected'; reason: string; result?: Record<string, string>; actor: Actor }) {
  requirePermission(ctx, p.actor, 'orders.review')
  needReason(p.reason)
  const { order, attempt } = reviewOrder(ctx, p.orderId)
  closeReview(ctx, order, p.outcome === 'completed' ? 'resolve_completed' : 'resolve_rejected', p.reason, p.actor)
  addEvent(ctx, order, { type: 'review_action', title: `Resolved manually: ${p.outcome}`, detail: p.reason, tone: 'info', actor: p.actor })
  audit(ctx, { actor: p.actor, action: 'order.review.resolved_manually', target: { type: 'order', id: order.id, label: order.ref }, summary: `Manually marked ${p.outcome}`, reason: p.reason, severity: 'critical', permission: 'orders.review', changes: [{ field: 'status', from: 'needs_review', to: p.outcome }] })
  transition(ctx, order, 'processing')
  if (p.outcome === 'completed') {
    attempt.state = 'succeeded'
    const fields = p.result && Object.keys(p.result).length ? p.result : { note: 'Confirmed manually by operator' }
    const result: OrderResult = { fields, summary: Object.values(fields).join(' · '), receivedAt: ctx.clock.iso(), source: 'manual' }
    settleOrder(ctx, order, attempt, result, p.actor)
  } else {
    attempt.state = 'rejected'
    rejectOrder(ctx, order, { code: 'resolved_rejected', message: p.reason }, p.actor)
  }
  return order
}
