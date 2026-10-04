/**
 * Order commands — the single entry point for every channel.
 *
 * Storefront checkout, reseller portal, native API, DHRU-compatible endpoint
 * and admin-created orders all call `placeOrder`. There is no second path.
 *
 *   PlaceOrder   validate → price (snapshot) → hold funds (or await payment) → queue
 *   SettleOrder  result received → capture (revenue + cost of sales) → notify
 *   RejectOrder  definitive failure → release hold → notify
 *   CancelOrder  before any supplier has the order → release hold / void payment
 *   RefundOrder  captured money back to wallet or original method (capped, audited, idempotent)
 */
import { formatMoney, sub, ZERO, type Micros } from '../money'
import type { CoreContext } from '../ports'
import type { Account, Actor, Attempt, Order, OrderChannel, OrderResult, PaymentMethodKind, Refund, Service } from '../domain'
import { OPEN_STATUSES, WORKER } from '../domain'
import { DomainError, conflict, forbidden, invalid, notFound, paymentRequired } from '../errors'
import { fingerprint } from '../ids'
import { validateInput } from '../fields'
import { quote } from '../services/pricing'
import { availability } from '../services/routing'
import { heldForOrder, holdForOrder, refundPosting, releaseHold, settleOrder as postSettlement, walletBalance } from '../services/ledger'
import { addEvent, setFinancial, transition } from '../services/orderMachine'
import { notify } from '../services/notifications'
import { emit } from '../services/webhooks'
import { apiMoney, apiOrder } from '../services/presenters'
import { audit } from '../services/audit'
import { requirePermission } from '../services/access'
import { createOrderPayment } from './payments'

const CHANNEL_LABEL: Record<OrderChannel, string> = {
  storefront: 'Storefront checkout',
  portal: 'Reseller portal',
  api: 'Native API v1',
  dhru: 'DHRU-compatible endpoint',
  admin: 'Admin console',
}

export interface PlaceOrderInput {
  accountId: string
  serviceId: string
  input: Record<string, string>
  channel: OrderChannel
  actor: Actor
  idempotencyKey?: string | null
  clientReference?: string | null
  /** `wallet` holds funds immediately; `external` creates a payment intent first. */
  payment: { mode: 'wallet' } | { mode: 'external'; method: PaymentMethodKind }
  scenario?: string | null
  /** Storefront orders get a private tracking token. */
  tracking?: boolean
}

export interface PlaceOrderResult {
  order: Order
  replayed: boolean
  paymentIntentId: string | null
}

function channelAllowed(account: Account, channel: OrderChannel) {
  if (channel === 'admin') return true
  return account.channels[channel]
}

function serviceVisible(service: Service, channel: OrderChannel) {
  if (channel === 'admin') return true
  if (channel === 'storefront') return service.visibility.storefront
  if (channel === 'portal') return service.visibility.portal
  return service.visibility.api
}

function serviceAllowed(account: Account, service: Service) {
  const a = account.serviceAccess
  if (a.mode === 'all') return true
  if (a.mode === 'categories') return a.categoryIds.includes(service.categoryId)
  return a.serviceIds.includes(service.id)
}

export function placeOrder(ctx: CoreContext, p: PlaceOrderInput): PlaceOrderResult {
  const account = ctx.repo.accounts.get(p.accountId)
  if (!account) throw notFound('Account', p.accountId)
  if (account.status === 'frozen') throw forbidden('account_frozen', `Account ${account.name} is frozen${account.statusReason ? `: ${account.statusReason}` : ''}`)
  if (account.status !== 'active') throw forbidden('account_inactive', `Account ${account.name} is ${account.status}`)
  if (!channelAllowed(account, p.channel)) throw forbidden('channel_not_enabled', `${CHANNEL_LABEL[p.channel]} is not enabled for ${account.name}`)

  /* Idempotency — scoped to the account, across every channel and API key. */
  const requestHash = fingerprint({ s: p.serviceId, i: p.input, c: p.clientReference ?? null })
  if (p.idempotencyKey) {
    const rec = ctx.repo.idempotency.get(account.id, p.idempotencyKey)
    if (rec && new Date(rec.expiresAt).getTime() > ctx.clock.now()) {
      if (rec.requestHash !== requestHash) throw conflict('idempotency_conflict', `Idempotency-Key "${p.idempotencyKey}" was already used with a different request`, { orderId: rec.orderId })
      const existing = rec.orderId ? ctx.repo.orders.get(rec.orderId) : undefined
      if (existing) {
        rec.replays++
        addEvent(ctx, existing, { type: 'idempotent_replay', title: 'Duplicate request replayed', detail: `Idempotency-Key ${p.idempotencyKey} · ${CHANNEL_LABEL[p.channel]} · no second order or charge`, tone: 'info', actor: p.actor })
        return { order: existing, replayed: true, paymentIntentId: existing.paymentIntentId }
      }
    }
  }

  const service = ctx.repo.services.get(p.serviceId)
  if (!service) throw notFound('Service', p.serviceId)
  if (!serviceVisible(service, p.channel)) throw forbidden('service_not_available_on_channel', `${service.name} is not offered on this channel`)
  if (!serviceAllowed(account, service)) throw forbidden('service_not_allowed', `${account.name} is not allowed to order ${service.name}`)
  const revision = ctx.repo.revisions.require(service.revisionId)

  const v = validateInput(revision.fields, p.input)
  if (!v.ok) throw invalid('Input validation failed', { fields: v.errors })

  const price = quote(ctx, service.id, account.pricingTierId)
  if (price.amount <= 0) throw new DomainError('not_priced', `${service.name} has no price for ${price.tierName}`, 409)
  const avail = availability(ctx, service, price.amount)
  if (!avail.available) throw new DomainError('service_unavailable', `${service.name} is temporarily unavailable: ${avail.reason}`, 409)

  if (price.amount > account.limits.maxOrderValue) throw new DomainError('limit_exceeded', `Order value ${formatMoney(price.amount)} exceeds the account limit of ${formatMoney(account.limits.maxOrderValue)}`, 429)
  const open = ctx.repo.orders.count((o) => o.accountId === account.id && OPEN_STATUSES.includes(o.status) && o.status !== 'awaiting_payment')
  if (open >= account.limits.maxConcurrent) throw new DomainError('limit_exceeded', `${open} open orders — concurrency limit is ${account.limits.maxConcurrent}`, 429)

  if (p.payment.mode === 'wallet') {
    const bal = walletBalance(ctx, account.id)
    if (bal.spendable < price.amount) throw paymentRequired(`Insufficient balance: ${formatMoney(bal.spendable)} spendable, ${formatMoney(price.amount)} required`, { spendable: apiMoney(bal.spendable), required: apiMoney(price.amount) })
  }

  const now = ctx.clock.now()
  const order: Order = {
    id: ctx.ids.id('ord'),
    ref: ctx.ids.ref('ORD'),
    accountId: account.id,
    channel: p.channel,
    placedBy: p.actor,
    serviceId: service.id,
    serviceRevisionId: revision.id,
    serviceRevision: revision.number,
    serviceName: service.name,
    input: v.values,
    price,
    supplierCost: null,
    status: p.payment.mode === 'wallet' ? 'queued' : 'awaiting_payment',
    financialStatus: 'none',
    attempts: [],
    result: null,
    rejection: null,
    review: null,
    idempotencyKey: p.idempotencyKey ?? null,
    clientReference: p.clientReference ?? null,
    trackingToken: p.tracking ? ctx.ids.token(32) : null,
    paymentIntentId: null,
    refundedTotal: ZERO,
    verificationIds: [],
    events: [],
    createdAt: ctx.clock.iso(now),
    updatedAt: ctx.clock.iso(now),
    completedAt: null,
    scenario: p.scenario ?? null,
  }
  addEvent(ctx, order, { type: 'created', title: 'Order created', detail: `${CHANNEL_LABEL[p.channel]} · ${service.name} · ${formatMoney(price.amount)} (${price.tierName})`, tone: 'neutral', actor: p.actor })
  ctx.repo.orders.insert(order)

  let paymentIntentId: string | null = null
  if (p.payment.mode === 'wallet') {
    fundAndQueue(ctx, order, p.actor)
  } else {
    const intent = createOrderPayment(ctx, order, p.payment.method, p.actor)
    paymentIntentId = intent.id
    order.paymentIntentId = intent.id
    addEvent(ctx, order, { type: 'payment_pending', title: 'Awaiting payment', detail: `${intent.ref} · ${formatMoney(intent.amount)} by ${intent.method.replace('_', ' ')} (simulated gateway)`, tone: 'warning', ref: { kind: 'payment', id: intent.id } })
    ctx.scheduler.schedule('order.expire_payment', { orderId: order.id }, now + 30 * 60_000)
  }

  if (p.idempotencyKey) {
    ctx.repo.idempotency.put({ accountId: account.id, key: p.idempotencyKey, requestHash, orderId: order.id, channel: p.channel, createdAt: order.createdAt, expiresAt: ctx.clock.iso(now + 24 * 3600_000), replays: 0 })
  }
  account.lastActiveAt = order.createdAt
  if (p.channel === 'admin') {
    audit(ctx, { actor: p.actor, action: 'order.created', target: { type: 'order', id: order.id, label: order.ref }, summary: `Created order for ${account.name}`, permission: 'orders.manage' })
  }
  emit(ctx, { event: 'order.created', accountId: account.id, orderId: order.id, data: apiOrder(ctx, order) })
  return { order, replayed: false, paymentIntentId }
}

/** Funds are available in the wallet: hold them and queue the order for the worker. */
export function fundAndQueue(ctx: CoreContext, order: Order, actor: Actor) {
  const tx = holdForOrder(ctx, order, actor)
  setFinancial(ctx, order, 'held')
  addEvent(ctx, order, { type: 'hold_created', title: 'Wallet hold created', detail: `${formatMoney(order.price.amount)} moved from available to held`, tone: 'neutral', ref: { kind: 'ledger', id: tx.id } })
  if (order.status === 'awaiting_payment') transition(ctx, order, 'queued')
  addEvent(ctx, order, { type: 'queued', title: 'Queued for routing', detail: 'Waiting for a worker', tone: 'neutral' })
  ctx.scheduler.schedule('order.dispatch', { orderId: order.id }, ctx.clock.now() + 250)
}

/* ------------------------------------------------------------------------- */
/*  Settle / reject                                                          */
/* ------------------------------------------------------------------------- */
export function settleOrder(ctx: CoreContext, order: Order, attempt: Attempt, result: OrderResult, actor: Actor = WORKER) {
  order.result = result
  order.supplierCost = attempt.cost
  addEvent(ctx, order, { type: 'result_received', title: 'Result received', detail: result.summary, tone: 'neutral', ref: { kind: 'attempt', id: attempt.id } })
  transition(ctx, order, 'completed')
  addEvent(ctx, order, { type: 'completed', title: 'Order completed', detail: `Fulfilled by ${ctx.repo.suppliers.get(attempt.supplierId)?.name ?? attempt.supplierId}`, tone: 'success', actor: actor.type === 'admin' ? actor : undefined })
  const tx = postSettlement(ctx, order, attempt.cost, attempt.supplierId, actor)
  setFinancial(ctx, order, 'captured')
  addEvent(ctx, order, { type: 'ledger_settled', title: 'Ledger settled', detail: `Revenue ${formatMoney(order.price.amount)} · cost of sales ${formatMoney(attempt.cost)} · margin ${formatMoney(sub(order.price.amount, attempt.cost))}`, tone: 'neutral', ref: { kind: 'ledger', id: tx.id } })
  const sent = notify(ctx, { template: 'order.completed', orderId: order.id })
  if (sent.length) addEvent(ctx, order, { type: 'notification', title: 'Customer notified', detail: sent.map((n) => `${n.channel} → ${n.recipient}`).join(' · '), tone: 'neutral', ref: { kind: 'notification', id: sent[0]!.id } })
  const hooks = emit(ctx, { event: 'order.completed', accountId: order.accountId, orderId: order.id, data: apiOrder(ctx, order) })
  if (hooks.length) addEvent(ctx, order, { type: 'webhook', title: 'Webhook queued', detail: `order.completed → ${hooks.length} endpoint${hooks.length > 1 ? 's' : ''}`, tone: 'neutral', ref: { kind: 'webhook', id: hooks[0]!.id } })
}

export function rejectOrder(ctx: CoreContext, order: Order, rejection: { code: string; message: string }, actor: Actor = WORKER) {
  order.rejection = rejection
  transition(ctx, order, 'rejected')
  addEvent(ctx, order, { type: 'rejected', title: 'Order rejected', detail: rejection.message, tone: 'danger', actor: actor.type === 'admin' ? actor : undefined })
  releaseFunds(ctx, order, actor, rejection.message)
  const sent = notify(ctx, { template: 'order.rejected', orderId: order.id })
  if (sent.length) addEvent(ctx, order, { type: 'notification', title: 'Customer notified', detail: sent.map((n) => `${n.channel} → ${n.recipient}`).join(' · '), tone: 'neutral', ref: { kind: 'notification', id: sent[0]!.id } })
  emit(ctx, { event: 'order.rejected', accountId: order.accountId, orderId: order.id, data: apiOrder(ctx, order) })
}

function releaseFunds(ctx: CoreContext, order: Order, actor: Actor, reason: string) {
  if (order.financialStatus !== 'held') return
  const tx = releaseHold(ctx, order, actor, reason)
  setFinancial(ctx, order, 'released')
  if (tx) addEvent(ctx, order, { type: 'hold_released', title: 'Hold released', detail: `${formatMoney(order.price.amount)} returned to available balance`, tone: 'neutral', ref: { kind: 'ledger', id: tx.id } })
}

/* ------------------------------------------------------------------------- */
/*  Cancel                                                                   */
/* ------------------------------------------------------------------------- */
export function cancelOrder(ctx: CoreContext, p: { orderId: string; actor: Actor; reason: string }) {
  const order = ctx.repo.orders.byRef(p.orderId) ?? ctx.repo.orders.require(p.orderId)
  if (p.actor.type === 'admin') requirePermission(ctx, p.actor, 'orders.manage')
  if (order.status === 'awaiting_payment') {
    const intent = order.paymentIntentId ? ctx.repo.payments.get(order.paymentIntentId) : undefined
    if (intent && (intent.status === 'requires_payment' || intent.status === 'pending')) {
      intent.status = 'cancelled'
      intent.updatedAt = ctx.clock.iso()
      intent.events.push({ at: intent.updatedAt, type: 'cancelled', detail: 'Order cancelled before payment' })
    }
  } else if (order.status === 'queued') {
    if (order.attempts.some((a) => a.state === 'sending' || a.state === 'accepted')) throw conflict('cannot_cancel_in_flight', 'A supplier already has this order')
  } else {
    throw conflict('cannot_cancel', `Orders that are ${order.status.replace('_', ' ')} cannot be cancelled${order.status === 'processing' ? ' — the supplier already has the order' : ''}`)
  }
  ctx.scheduler.cancel((j) => (j.kind === 'order.dispatch' || j.kind === 'order.expire_payment') && j.payload.orderId === order.id)
  transition(ctx, order, 'cancelled')
  addEvent(ctx, order, { type: 'cancelled', title: 'Order cancelled', detail: p.reason, tone: 'warning', actor: p.actor })
  releaseFunds(ctx, order, p.actor, p.reason)
  if (p.actor.type === 'admin') audit(ctx, { actor: p.actor, action: 'order.cancelled', target: { type: 'order', id: order.id, label: order.ref }, summary: 'Cancelled order', reason: p.reason, severity: 'notice', permission: 'orders.manage' })
  emit(ctx, { event: 'order.cancelled', accountId: order.accountId, orderId: order.id, data: apiOrder(ctx, order) })
  return order
}

/* ------------------------------------------------------------------------- */
/*  Refund                                                                   */
/* ------------------------------------------------------------------------- */
export interface RefundInput {
  orderId: string
  amount: Micros
  destination: 'wallet' | 'original_method'
  reason: string
  actor: Actor
  idempotencyKey: string
  verificationId?: string | null
}

export function refundOrder(ctx: CoreContext, p: RefundInput): Refund {
  requirePermission(ctx, p.actor, 'refunds.create')
  const existing = ctx.repo.refunds.find((r) => r.idempotencyKey === p.idempotencyKey)
  if (existing) return existing
  const order = ctx.repo.orders.byRef(p.orderId) ?? ctx.repo.orders.require(p.orderId)
  if (!p.reason.trim()) throw invalid('A refund reason is required')
  if (order.financialStatus === 'held') throw conflict('not_refundable', 'Funds are only held — cancel or reject the order instead of refunding')
  if (order.financialStatus !== 'captured' && order.financialStatus !== 'partially_refunded') throw conflict('not_refundable', `Nothing captured to refund (financial status: ${order.financialStatus})`)
  if (p.amount <= 0) throw invalid('Refund amount must be positive')
  const refundable = sub(order.price.amount, order.refundedTotal)
  if (p.amount > refundable) throw invalid(`Refund exceeds the refundable amount (${formatMoney(refundable)})`, { refundable: apiMoney(refundable) })

  const intent = order.paymentIntentId ? ctx.repo.payments.get(order.paymentIntentId) : undefined
  if (p.destination === 'original_method') {
    if (!intent || intent.status !== 'succeeded') throw conflict('no_original_payment', 'This order was paid from the wallet — refund to wallet instead')
    const res = ctx.gateway.refund(intent, p.amount)
    if (!res.ok) throw new DomainError('gateway_refund_failed', res.message, 502)
  }

  const refund: Refund = {
    id: ctx.ids.id('rfd'),
    ref: ctx.ids.ref('RFD'),
    orderId: order.id,
    paymentIntentId: p.destination === 'original_method' ? (intent?.id ?? null) : null,
    accountId: order.accountId,
    amount: p.amount,
    destination: p.destination,
    reason: p.reason,
    status: 'succeeded',
    idempotencyKey: p.idempotencyKey,
    verificationId: p.verificationId ?? null,
    createdAt: ctx.clock.iso(),
    actor: p.actor,
    ledgerTxIds: [],
  }
  const tx = refundPosting(ctx, {
    refundId: refund.id,
    refundRef: refund.ref,
    accountId: order.accountId,
    amount: p.amount,
    destination: p.destination,
    method: intent?.method ?? null,
    orderId: order.id,
    paymentIntentId: refund.paymentIntentId,
    actor: p.actor,
    reason: p.reason,
    idempotencyKey: `refund:${p.idempotencyKey}`,
  })
  refund.ledgerTxIds.push(tx.id)
  ctx.repo.refunds.insert(refund)
  if (intent && p.destination === 'original_method') intent.refundedTotal = (intent.refundedTotal + p.amount) as Micros

  const prevFinancial = order.financialStatus
  order.refundedTotal = (order.refundedTotal + p.amount) as Micros
  const full = order.refundedTotal >= order.price.amount
  setFinancial(ctx, order, full ? 'refunded' : 'partially_refunded')
  addEvent(ctx, order, { type: 'refund', title: full ? 'Refunded in full' : 'Partial refund', detail: `${refund.ref} · ${formatMoney(p.amount)} → ${p.destination === 'wallet' ? 'wallet' : 'original payment method'} · ${p.reason}`, tone: 'warning', actor: p.actor, ref: { kind: 'refund', id: refund.id } })
  audit(ctx, { actor: p.actor, action: 'refund.created', target: { type: 'order', id: order.id, label: order.ref }, summary: `Refunded ${formatMoney(p.amount)} to ${p.destination === 'wallet' ? 'wallet' : 'original method'}`, reason: p.reason, severity: 'warning', permission: 'refunds.create', changes: [{ field: 'financial_status', from: prevFinancial, to: order.financialStatus }] })
  notify(ctx, { template: 'refund.issued', orderId: order.id, vars: { amount: formatMoney(p.amount), destination: p.destination === 'wallet' ? 'wallet' : 'original payment method' } })
  emit(ctx, { event: 'order.refunded', accountId: order.accountId, orderId: order.id, data: { ...apiOrder(ctx, order), refund: { id: refund.ref, amount: apiMoney(p.amount), destination: p.destination } } })
  return refund
}

/** Amount still held for an order (exposed for review screens). */
export function orderHeld(ctx: CoreContext, order: Order) {
  return heldForOrder(ctx, order)
}
