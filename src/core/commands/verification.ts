/**
 * VerifyOrder — after-care is part of the order lifecycle.
 *
 * A customer reports a problem with a completed order ("code does not work").
 * The operator can recheck the supplier, request a supplier verification,
 * approve a refund (wallet or original method) or reject the request.
 */
import { formatMoney, type Micros } from '../money'
import type { CoreContext } from '../ports'
import type { Actor, VerificationReason, VerificationRequest } from '../domain'
import { conflict, invalid } from '../errors'
import { requirePermission } from '../services/access'
import { addEvent } from '../services/orderMachine'
import { audit } from '../services/audit'
import { notify } from '../services/notifications'
import { post, LA } from '../services/ledger'
import { refundOrder } from './orders'

const WINDOW_DAYS = 30

export function openVerification(ctx: CoreContext, p: { orderId: string; reason: VerificationReason; message: string; actor: Actor; at?: number }) {
  const order = ctx.repo.orders.byRef(p.orderId) ?? ctx.repo.orders.require(p.orderId)
  if (order.status !== 'completed') throw conflict('not_completed', 'Only completed orders can be verified')
  if (ctx.clock.now() - new Date(order.completedAt!).getTime() > WINDOW_DAYS * 86400_000) throw conflict('window_closed', `Verification window (${WINDOW_DAYS} days) has closed`)
  if (order.verificationIds.some((id) => ['open', 'awaiting_supplier'].includes(ctx.repo.verifications.get(id)?.status ?? ''))) throw conflict('already_open', 'A verification request is already open for this order')
  if (!p.message.trim()) throw invalid('Describe the problem')
  const at = ctx.clock.iso(p.at)
  const v: VerificationRequest = {
    id: ctx.ids.id('ver'),
    ref: ctx.ids.ref('VER', 5),
    orderId: order.id,
    accountId: order.accountId,
    reason: p.reason,
    message: p.message,
    status: 'open',
    createdAt: at,
    updatedAt: at,
    supplierTicket: null,
    resolution: null,
    events: [{ at, title: 'Request opened', detail: p.message, actor: p.actor }],
  }
  ctx.repo.verifications.insert(v)
  order.verificationIds.push(v.id)
  addEvent(ctx, order, { type: 'verification', title: 'Verification requested', detail: `${v.ref} · “${p.message}”`, tone: 'warning', actor: p.actor, ref: { kind: 'verification', id: v.id }, at: p.at })
  return v
}

function load(ctx: CoreContext, id: string) {
  const v = ctx.repo.verifications.require(id)
  const order = ctx.repo.orders.require(v.orderId)
  return { v, order }
}

function touch(ctx: CoreContext, v: VerificationRequest, title: string, detail: string, actor: Actor) {
  v.updatedAt = ctx.clock.iso()
  v.events.push({ at: v.updatedAt, title, detail, actor })
}

export function recheckSupplier(ctx: CoreContext, p: { verificationId: string; actor: Actor }) {
  requirePermission(ctx, p.actor, 'orders.review')
  const { v, order } = load(ctx, p.verificationId)
  const attempt = order.attempts.find((a) => a.state === 'succeeded')
  if (!attempt) throw conflict('no_supplier', 'Order has no fulfilling supplier attempt')
  const supplier = ctx.repo.suppliers.require(attempt.supplierId)
  const res = ctx.drivers.get(supplier.driver).getStatus(supplier, order, attempt.externalRef)
  ctx.repo.driverCalls.insert({ ...res.call, orderId: order.id, attemptId: attempt.id })
  touch(ctx, v, 'Supplier rechecked', `${supplier.name}: ${res.value.message}`, p.actor)
  return v
}

export function requestSupplierVerification(ctx: CoreContext, p: { verificationId: string; actor: Actor }) {
  requirePermission(ctx, p.actor, 'orders.review')
  const { v, order } = load(ctx, p.verificationId)
  if (v.status !== 'open') throw conflict('not_open', `Request is ${v.status}`)
  const attempt = order.attempts.find((a) => a.state === 'succeeded')
  const supplier = attempt ? ctx.repo.suppliers.get(attempt.supplierId) : undefined
  v.status = 'awaiting_supplier'
  v.supplierTicket = `VRF-${ctx.ids.hex(6).toUpperCase()}`
  touch(ctx, v, 'Verification requested from supplier', `${supplier?.name ?? 'Supplier'} ticket ${v.supplierTicket}`, p.actor)
  ctx.scheduler.schedule('verification.supplier_reply', { verificationId: v.id }, ctx.clock.now() + 45_000)
  return v
}

/** Job: the supplier answers the verification request (simulated). */
export function supplierVerificationReply(ctx: CoreContext, verificationId: string, confirmedFaulty: boolean) {
  const { v, order } = load(ctx, verificationId)
  if (v.status !== 'awaiting_supplier') return
  const attempt = order.attempts.find((a) => a.state === 'succeeded')
  const supplier = attempt ? ctx.repo.suppliers.get(attempt.supplierId) : undefined
  const supplierActor: Actor = { type: 'supplier', id: supplier?.id ?? 'supplier', name: supplier?.name ?? 'Supplier' }
  v.status = 'open'
  if (confirmedFaulty && attempt && supplier) {
    const tx = post(ctx, {
      kind: 'supplier_credit',
      description: `Supplier credit · ${order.ref} (${v.ref})`,
      lines: [
        { account: LA.supplier(supplier.id), dir: 'debit', amount: attempt.cost },
        { account: LA.cost, dir: 'credit', amount: attempt.cost },
      ],
      idempotencyKey: `verification:${v.id}:supplier_credit`,
      actor: supplierActor,
      orderId: order.id,
      supplierId: supplier.id,
    })
    // The supplier credits its own balance; the next getBalance() reports it (reconciliation stays exact).
    touch(ctx, v, 'Supplier confirmed the result was faulty', `${supplier.name} credited ${formatMoney(attempt.cost)} (${tx.ref}). Refund recommended.`, supplierActor)
  } else {
    touch(ctx, v, 'Supplier confirmed the result is valid', 'The supplier re-verified the result. Share the instructions with the customer or reject the request.', supplierActor)
  }
}

export function approveVerificationRefund(ctx: CoreContext, p: { verificationId: string; amount: Micros; destination: 'wallet' | 'original_method'; note: string; actor: Actor }) {
  requirePermission(ctx, p.actor, 'refunds.create')
  const { v, order } = load(ctx, p.verificationId)
  if (v.status === 'approved' || v.status === 'rejected') throw conflict('closed', `Request is ${v.status}`)
  const refund = refundOrder(ctx, { orderId: order.id, amount: p.amount, destination: p.destination, reason: `${v.ref}: ${p.note || 'verification approved'}`, actor: p.actor, idempotencyKey: `verification:${v.id}:refund`, verificationId: v.id })
  v.status = 'approved'
  v.resolution = { action: 'refund_approved', note: p.note, by: p.actor, at: ctx.clock.iso(), refundId: refund.id }
  touch(ctx, v, 'Refund approved', `${refund.ref} · ${formatMoney(p.amount)} → ${p.destination === 'wallet' ? 'wallet' : 'original payment method'}`, p.actor)
  notify(ctx, { template: 'verification.updated', orderId: order.id, vars: { ref: v.ref, message: `Your request was approved and ${formatMoney(p.amount)} was refunded.` } })
  return v
}

export function rejectVerification(ctx: CoreContext, p: { verificationId: string; note: string; actor: Actor }) {
  requirePermission(ctx, p.actor, 'orders.review')
  if (!p.note.trim()) throw invalid('Explain why the request is rejected')
  const { v, order } = load(ctx, p.verificationId)
  if (v.status === 'approved' || v.status === 'rejected') throw conflict('closed', `Request is ${v.status}`)
  v.status = 'rejected'
  v.resolution = { action: 'rejected', note: p.note, by: p.actor, at: ctx.clock.iso(), refundId: null }
  touch(ctx, v, 'Request rejected', p.note, p.actor)
  audit(ctx, { actor: p.actor, action: 'verification.rejected', target: { type: 'order', id: order.id, label: `${order.ref} · ${v.ref}` }, summary: 'Rejected verification request', reason: p.note, severity: 'notice', permission: 'orders.review' })
  notify(ctx, { template: 'verification.updated', orderId: order.id, vars: { ref: v.ref, message: p.note } })
  return v
}
