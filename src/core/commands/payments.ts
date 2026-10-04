/**
 * Payment commands. Gateways are simulated; their notifications flow through
 * `handleGatewayEvent` exactly as real webhooks would — signature check,
 * de-duplication by event id, then an idempotent ledger posting.
 */
import { formatMoney, usd, type Micros } from '../money'
import type { CoreContext, SimulatedPaymentOutcome } from '../ports'
import type { Actor, GatewayEvent, Order, PaymentIntent, PaymentMethodKind } from '../domain'
import { conflict, invalid } from '../errors'
import { chargebackPosting, fundWallet, post, LA } from '../services/ledger'
import { addEvent } from '../services/orderMachine'
import { notify } from '../services/notifications'
import { audit } from '../services/audit'
import { requirePermission } from '../services/access'
import { cancelOrder, fundAndQueue } from './orders'

const GATEWAY_ACTOR: Actor = { type: 'gateway', id: 'gateway', name: 'Payment gateway (simulated)' }

function methodConfig(ctx: CoreContext, method: PaymentMethodKind) {
  const m = ctx.repo.paymentMethods.get(method)
  if (!m || !m.enabled) throw invalid(`Payment method ${method} is not enabled`)
  return m
}

function newIntent(ctx: CoreContext, p: { accountId: string; orderId: string | null; purpose: 'order' | 'top_up'; amount: Micros; method: PaymentMethodKind }): PaymentIntent {
  methodConfig(ctx, p.method)
  const now = ctx.clock.iso()
  const intent: PaymentIntent = {
    id: ctx.ids.id('pi'),
    ref: ctx.ids.ref('PAY'),
    accountId: p.accountId,
    orderId: p.orderId,
    purpose: p.purpose,
    amount: p.amount,
    method: p.method,
    status: 'requires_payment',
    gatewayRef: '',
    failureReason: null,
    createdAt: now,
    updatedAt: now,
    events: [{ at: now, type: 'created', detail: `${p.purpose === 'order' ? 'Order payment' : 'Wallet top-up'} · ${formatMoney(p.amount)}` }],
    ledgerTxId: null,
    refundedTotal: 0 as Micros,
    chargebackId: null,
  }
  intent.gatewayRef = ctx.gateway.createIntent(intent).gatewayRef
  return ctx.repo.payments.insert(intent)
}

export function createOrderPayment(ctx: CoreContext, order: Order, method: PaymentMethodKind, _actor: Actor) {
  return newIntent(ctx, { accountId: order.accountId, orderId: order.id, purpose: 'order', amount: order.price.amount, method })
}

/** A new attempt to pay an order whose previous payment failed. */
export function retryOrderPayment(ctx: CoreContext, p: { orderId: string; method: PaymentMethodKind }) {
  const order = ctx.repo.orders.byRef(p.orderId) ?? ctx.repo.orders.require(p.orderId)
  if (order.status !== 'awaiting_payment') throw conflict('not_awaiting_payment', `Order ${order.ref} is ${order.status}`)
  const intent = newIntent(ctx, { accountId: order.accountId, orderId: order.id, purpose: 'order', amount: order.price.amount, method: p.method })
  order.paymentIntentId = intent.id
  addEvent(ctx, order, { type: 'payment_pending', title: 'New payment attempt', detail: `${intent.ref} · ${p.method.replace('_', ' ')}`, tone: 'warning', ref: { kind: 'payment', id: intent.id } })
  return intent
}

export function createTopUp(ctx: CoreContext, p: { accountId: string; amount: Micros; method: PaymentMethodKind; actor: Actor }) {
  if (p.amount < usd(5)) throw invalid('Minimum top-up is $5.00')
  if (p.amount > usd(25_000)) throw invalid('Maximum single top-up is $25,000.00')
  ctx.repo.accounts.require(p.accountId)
  return newIntent(ctx, { accountId: p.accountId, orderId: null, purpose: 'top_up', amount: p.amount, method: p.method })
}

/** Simulate the payer finishing checkout at the gateway. */
export function completePayment(ctx: CoreContext, p: { intentId: string; outcome: SimulatedPaymentOutcome }) {
  const intent = ctx.repo.payments.require(p.intentId)
  if (intent.status === 'succeeded' || intent.status === 'cancelled') return intent
  const events = ctx.gateway.complete(intent, p.outcome)
  for (const ev of events) handleGatewayEvent(ctx, ev)
  return ctx.repo.payments.require(p.intentId)
}

/** Inbound gateway webhook: verify, de-duplicate, apply. */
export function handleGatewayEvent(ctx: CoreContext, ev: GatewayEvent): GatewayEvent {
  const intent = ctx.repo.payments.get(ev.paymentIntentId)
  const gatewayName = intent ? (ctx.repo.paymentMethods.get(intent.method)?.gateway ?? ev.gateway) : ev.gateway
  const duplicate = ctx.repo.gatewayEvents.find((x) => x.id === ev.id && x.status === 'processed')
  const recorded: GatewayEvent = { ...ev, receivedAt: ctx.clock.iso(), status: ev.signature !== 'valid' ? 'rejected' : duplicate ? 'duplicate_ignored' : 'processed', duplicateOf: duplicate ? duplicate.id : null }
  ctx.repo.gatewayEvents.insert({ ...recorded, id: duplicate || ctx.repo.gatewayEvents.get(ev.id) ? `${ev.id}~${ctx.ids.token(4)}` : ev.id })
  ctx.repo.inboundWebhooks.insert({
    id: ctx.ids.id('inb'),
    source: 'payment_gateway',
    sourceId: intent?.method ?? 'unknown',
    sourceName: gatewayName,
    receivedAt: recorded.receivedAt,
    type: ev.type,
    signature: ev.signature,
    status: recorded.status,
    note: recorded.status === 'duplicate_ignored' ? `Duplicate of ${ev.id} — ignored (ledger posting is idempotent)` : recorded.status === 'rejected' ? 'Signature verification failed' : 'Applied',
    payload: ev.payload,
    orderId: intent?.orderId ?? null,
    paymentIntentId: ev.paymentIntentId,
  })
  if (recorded.status !== 'processed' || !intent) {
    if (intent && recorded.status === 'duplicate_ignored') intent.events.push({ at: recorded.receivedAt, type: 'duplicate_webhook', detail: `${ev.type} received again (${ev.id}) — ignored` })
    return recorded
  }

  if (ev.type === 'payment.succeeded') {
    if (intent.status === 'succeeded') return recorded
    intent.status = 'succeeded'
    intent.updatedAt = ctx.clock.iso()
    intent.events.push({ at: intent.updatedAt, type: 'succeeded', detail: `Gateway confirmed ${ev.id}` })
    const tx = fundWallet(ctx, { accountId: intent.accountId, amount: intent.amount, method: intent.method, paymentIntentId: intent.id, paymentRef: intent.ref, actor: GATEWAY_ACTOR })
    intent.ledgerTxId = tx.id
    if (intent.orderId) {
      const order = ctx.repo.orders.get(intent.orderId)
      if (order && order.status === 'awaiting_payment') {
        ctx.scheduler.cancel((j) => j.kind === 'order.expire_payment' && j.payload.orderId === order.id)
        addEvent(ctx, order, { type: 'payment_succeeded', title: 'Payment confirmed', detail: `${intent.ref} · ${formatMoney(intent.amount)} · ${gatewayName}`, tone: 'success', ref: { kind: 'payment', id: intent.id } })
        addEvent(ctx, order, { type: 'wallet_funded', title: 'Wallet funded', detail: 'DR Gateway Clearing · CR Customer Available', tone: 'neutral', ref: { kind: 'ledger', id: tx.id } })
        fundAndQueue(ctx, order, GATEWAY_ACTOR)
      } else if (order) {
        intent.events.push({ at: intent.updatedAt, type: 'note', detail: `Order already ${order.status} — funds kept in the customer wallet` })
      }
    } else {
      notify(ctx, { template: 'payment.received', accountId: intent.accountId, vars: { amount: formatMoney(intent.amount), ref: intent.ref, method: intent.method.replace('_', ' ') } })
    }
  } else if (ev.type === 'payment.failed') {
    intent.status = 'failed'
    intent.updatedAt = ctx.clock.iso()
    intent.failureReason = 'Card declined by issuer (simulated)'
    intent.events.push({ at: intent.updatedAt, type: 'failed', detail: intent.failureReason })
    const order = intent.orderId ? ctx.repo.orders.get(intent.orderId) : undefined
    if (order && order.status === 'awaiting_payment') addEvent(ctx, order, { type: 'payment_failed', title: 'Payment failed', detail: `${intent.ref} · ${intent.failureReason}. The customer can retry.`, tone: 'danger', ref: { kind: 'payment', id: intent.id } })
  } else if (ev.type === 'payment.pending') {
    intent.status = 'pending'
    intent.updatedAt = ctx.clock.iso()
    intent.events.push({ at: intent.updatedAt, type: 'pending', detail: intent.method === 'bank_transfer' ? 'Awaiting bank transfer — operator confirms receipt' : 'Awaiting gateway confirmation' })
  }
  return recorded
}

/** Operator confirms a bank transfer arrived. */
export function confirmBankTransfer(ctx: CoreContext, p: { intentId: string; actor: Actor }) {
  requirePermission(ctx, p.actor, 'payments.manage')
  const intent = ctx.repo.payments.require(p.intentId)
  if (intent.method !== 'bank_transfer' && intent.method !== 'manual') throw conflict('not_manual', 'Only bank transfers and manual payments are confirmed by an operator')
  if (intent.status !== 'pending' && intent.status !== 'requires_payment') throw conflict('not_pending', `Payment is ${intent.status}`)
  if (intent.status === 'requires_payment') completePayment(ctx, { intentId: intent.id, outcome: 'pending' })
  const out = completePayment(ctx, { intentId: intent.id, outcome: 'succeed' })
  audit(ctx, { actor: p.actor, action: 'payment.confirmed', target: { type: 'payment', id: intent.id, label: intent.ref }, summary: `Confirmed ${intent.method.replace('_', ' ')} of ${formatMoney(intent.amount)}`, severity: 'notice', permission: 'payments.manage' })
  return out
}

/** Re-send the last gateway notification for an intent (duplicated webhook). */
export function replayGatewayWebhook(ctx: CoreContext, intentId: string) {
  const last = ctx.repo.gatewayEvents.filter((e) => e.paymentIntentId === intentId && e.status === 'processed').pop()
  if (!last) throw conflict('no_event', 'No processed gateway event to duplicate')
  return handleGatewayEvent(ctx, { ...last, status: 'processed', duplicateOf: null })
}

export function openChargeback(ctx: CoreContext, p: { intentId: string; reason: string; at?: number }) {
  const intent = ctx.repo.payments.require(p.intentId)
  if (intent.status !== 'succeeded') throw conflict('not_captured', 'Only succeeded payments can be charged back')
  if (intent.chargebackId) return ctx.repo.chargebacks.require(intent.chargebackId)
  const fee = usd(15)
  const cb = ctx.repo.chargebacks.insert({
    id: ctx.ids.id('cbk'),
    ref: ctx.ids.ref('CBK'),
    paymentIntentId: intent.id,
    accountId: intent.accountId,
    amount: intent.amount,
    fee,
    reason: p.reason,
    status: 'open',
    openedAt: ctx.clock.iso(p.at),
    resolvedAt: null,
    ledgerTxIds: [],
  })
  const tx = chargebackPosting(ctx, { chargebackId: cb.id, accountId: intent.accountId, amount: intent.amount, fee, method: intent.method, paymentIntentId: intent.id, actor: GATEWAY_ACTOR, at: p.at })
  cb.ledgerTxIds.push(tx.id)
  intent.chargebackId = cb.id
  intent.events.push({ at: cb.openedAt, type: 'chargeback', detail: `${cb.ref} opened — ${p.reason}` })
  audit(ctx, { actor: GATEWAY_ACTOR, action: 'chargeback.opened', target: { type: 'payment', id: intent.id, label: intent.ref }, summary: `Chargeback ${formatMoney(intent.amount)} + ${formatMoney(fee)} fee`, reason: p.reason, severity: 'warning', at: p.at })
  return cb
}

export function resolveChargeback(ctx: CoreContext, p: { chargebackId: string; outcome: 'won' | 'lost'; actor: Actor }) {
  requirePermission(ctx, p.actor, 'payments.manage')
  const cb = ctx.repo.chargebacks.require(p.chargebackId)
  if (cb.status !== 'open') throw conflict('already_resolved', `Chargeback is ${cb.status}`)
  const intent = ctx.repo.payments.require(cb.paymentIntentId)
  cb.status = p.outcome
  cb.resolvedAt = ctx.clock.iso()
  if (p.outcome === 'won') {
    const tx = post(ctx, {
      kind: 'chargeback',
      description: `Chargeback ${cb.ref} won — funds returned`,
      lines: [
        { account: LA.clearing(intent.method), dir: 'debit', amount: cb.amount },
        { account: LA.available(cb.accountId), dir: 'credit', amount: cb.amount },
      ],
      idempotencyKey: `chargeback:${cb.id}:won`,
      actor: p.actor,
      accountId: cb.accountId,
      paymentIntentId: intent.id,
    })
    cb.ledgerTxIds.push(tx.id)
  }
  audit(ctx, { actor: p.actor, action: 'chargeback.resolved', target: { type: 'payment', id: intent.id, label: intent.ref }, summary: `Chargeback ${cb.ref} ${p.outcome}`, severity: 'notice', permission: 'payments.manage' })
  return cb
}

/** Job: an order whose payment never completed is cancelled after 30 minutes. */
export function expirePayment(ctx: CoreContext, orderId: string) {
  const order = ctx.repo.orders.get(orderId)
  if (!order || order.status !== 'awaiting_payment') return
  cancelOrder(ctx, { orderId, actor: { type: 'system', id: 'system', name: 'ORVEX Core' }, reason: 'Payment not completed within 30 minutes' })
}
