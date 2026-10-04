/**
 * OrderStateMachine — the only place order status and financial status change.
 * Invalid transitions throw, so a bug can never silently move an order into an
 * impossible state (e.g. completed → processing, or released → captured).
 */
import type { CoreContext } from '../ports'
import type { FinancialStatus, Order, OrderEvent, OrderStatus } from '../domain'
import { conflict } from '../errors'

const STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  awaiting_payment: ['queued', 'cancelled'],
  queued: ['processing', 'cancelled', 'rejected'],
  processing: ['processing', 'completed', 'rejected', 'needs_review'],
  needs_review: ['queued', 'processing', 'completed', 'rejected', 'cancelled'],
  completed: [],
  rejected: [],
  cancelled: [],
}

const FINANCIAL_TRANSITIONS: Record<FinancialStatus, readonly FinancialStatus[]> = {
  none: ['held'],
  held: ['captured', 'released'],
  captured: ['partially_refunded', 'refunded'],
  partially_refunded: ['partially_refunded', 'refunded'],
  released: [],
  refunded: [],
}

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return STATUS_TRANSITIONS[from].includes(to)
}

export function transition(ctx: CoreContext, order: Order, to: OrderStatus) {
  if (order.status === to && to !== 'processing') return
  if (!canTransition(order.status, to)) throw conflict('invalid_transition', `Order ${order.ref} cannot move from ${order.status} to ${to}`)
  order.status = to
  order.updatedAt = ctx.clock.iso()
  if (to === 'completed' || to === 'rejected' || to === 'cancelled') order.completedAt = order.updatedAt
}

export function setFinancial(ctx: CoreContext, order: Order, to: FinancialStatus) {
  if (order.financialStatus === to) return
  if (!FINANCIAL_TRANSITIONS[order.financialStatus].includes(to)) throw conflict('invalid_financial_transition', `Order ${order.ref} financial status cannot move from ${order.financialStatus} to ${to}`)
  order.financialStatus = to
  order.updatedAt = ctx.clock.iso()
}

export function addEvent(ctx: CoreContext, order: Order, e: Omit<OrderEvent, 'id' | 'at'> & { at?: number }): OrderEvent {
  const { at, ...rest } = e
  const ev: OrderEvent = { id: `${order.id}_e${order.events.length + 1}`, at: ctx.clock.iso(at), ...rest }
  order.events.push(ev)
  order.updatedAt = ev.at
  return ev
}
