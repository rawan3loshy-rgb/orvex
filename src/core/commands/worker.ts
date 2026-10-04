/**
 * Order worker — routing, supplier attempts, guarded failover.
 *
 *   dispatch        pick the next eligible offer (priority order) and send an attempt
 *   onResponse      classify the supplier's answer:
 *                     success                → settle now (instant) or poll later (async)
 *                     rejected_terminal      → reject the order
 *                     failover-safe          → guarded failover to the next offer
 *                     unknown                → NEEDS REVIEW, failover blocked, funds stay held
 *   poll            async results (DHRU-style status polling)
 *
 * An UNKNOWN outcome (timeout or unusable response after the request was sent)
 * never fails over: the first supplier may have accepted the order, and a second
 * submission could fulfil — and charge for — the same order twice.
 */
import { formatMoney, sub } from '../money'
import type { CoreContext, SubmitResponse } from '../ports'
import type { Attempt, AttemptClassification, Order, ReviewReason } from '../domain'
import { WORKER } from '../domain'
import { candidatesFor } from '../services/routing'
import { classify, recordOutcome } from '../services/supplier'
import { addEvent, transition } from '../services/orderMachine'
import { notify } from '../services/notifications'
import { emit } from '../services/webhooks'
import { audit } from '../services/audit'
import { apiOrder } from '../services/presenters'
import { rejectOrder, settleOrder } from './orders'

export function mapFields(mapping: Record<string, string>, input: Record<string, string>) {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(input)) out[mapping[k] ?? k] = v
  return out
}

export function dispatch(ctx: CoreContext, orderId: string) {
  const order = ctx.repo.orders.get(orderId)
  if (!order || (order.status !== 'queued' && order.status !== 'processing')) return
  if (order.attempts.some((a) => a.state === 'sending' || a.state === 'accepted')) return

  const chain = candidatesFor(ctx, order)
  const chosen = chain.find((c) => c.eligible) ?? null
  const before = chain.slice(0, chosen ? chain.indexOf(chosen) : chain.length)
  for (const s of before) {
    if (s.attempted || order.events.some((e) => e.ref?.kind === 'supplier' && e.ref.id === s.offer.id)) continue
    const name = s.supplier?.name ?? s.offer.supplierId
    if (s.marginBlocked && s.routable) addEvent(ctx, order, { type: 'margin_guard', title: `Margin guard skipped ${name}`, detail: `Cost ${formatMoney(s.cost)} is above the order price ${formatMoney(order.price.amount)} — routing there would lose money`, tone: 'warning', ref: { kind: 'supplier', id: s.offer.id } })
    else addEvent(ctx, order, { type: 'routed', title: `Skipped ${name}`, detail: `Priority ${s.offer.priority} · ${s.reasons.join(' · ')}`, tone: 'warning', ref: { kind: 'supplier', id: s.offer.id } })
  }

  if (!chosen) {
    const last = order.attempts.at(-1)
    const anyMargin = chain.some((c) => c.marginBlocked && c.routable && !c.attempted)
    const message = last?.classification
      ? `No further eligible supplier after ${ctx.repo.suppliers.get(last.supplierId)?.name ?? 'the supplier'}: ${last.classification.message}`
      : anyMargin
        ? 'Every available supplier costs more than the order price (margin guard)'
        : 'No routable supplier for this service'
    rejectOrder(ctx, order, { code: order.attempts.length ? 'all_suppliers_declined' : 'no_route', message })
    return
  }

  const supplier = chosen.supplier!
  const product = chosen.product!
  const margin = sub(order.price.amount, chosen.cost)
  if (order.attempts.length === 0) {
    addEvent(ctx, order, { type: 'routed', title: `${supplier.name} selected`, detail: `Priority ${chosen.offer.priority} · cost ${formatMoney(chosen.cost)} · margin ${formatMoney(margin)}`, tone: 'accent', ref: { kind: 'supplier', id: supplier.id } })
  } else {
    addEvent(ctx, order, { type: 'failover', title: `Guarded failover → ${supplier.name}`, detail: `Previous outcome was definitive and failover-safe · priority ${chosen.offer.priority} · cost ${formatMoney(chosen.cost)} · margin guard ok (${formatMoney(margin)})`, tone: 'accent', ref: { kind: 'supplier', id: supplier.id } })
  }
  if (order.status === 'queued') {
    transition(ctx, order, 'processing')
    addEvent(ctx, order, { type: 'processing', title: 'Processing', tone: 'neutral' })
  }

  const service = ctx.repo.services.require(order.serviceId)
  const revision = ctx.repo.revisions.get(order.serviceRevisionId) ?? ctx.repo.revisions.require(service.revisionId)
  const attempt: Attempt = {
    id: ctx.ids.id('att'),
    orderId: order.id,
    n: order.attempts.length + 1,
    supplierId: supplier.id,
    offerId: chosen.offer.id,
    supplierProductId: product.id,
    cost: chosen.cost,
    state: 'sending',
    sentAt: ctx.clock.iso(),
    respondedAt: null,
    latencyMs: null,
    externalRef: null,
    classification: null,
    simulated: 'auto',
  }
  order.attempts.push(attempt)
  const driver = ctx.drivers.get(supplier.driver)
  const res = driver.submit({ order, attemptId: attempt.id, attemptNo: attempt.n, supplier, product, offer: chosen.offer, service, revision, mappedFields: mapFields(chosen.offer.fieldMapping, order.input) })
  attempt.simulated = res.call.outcome
  ctx.repo.driverCalls.insert(res.call)
  addEvent(ctx, order, { type: 'attempt_sent', title: 'Supplier attempt recorded', detail: `Attempt ${attempt.n} · ${driver.name} · ${res.call.method} ${res.call.endpoint}`, tone: 'neutral', ref: { kind: 'attempt', id: attempt.id } })
  ctx.scheduler.schedule('attempt.response', { orderId: order.id, attemptId: attempt.id, response: JSON.stringify(res.value) }, ctx.clock.now() + res.latencyMs)
}

export function onAttemptResponse(ctx: CoreContext, orderId: string, attemptId: string, res: SubmitResponse) {
  const order = ctx.repo.orders.get(orderId)
  const attempt = order?.attempts.find((a) => a.id === attemptId)
  if (!order || !attempt || attempt.state !== 'sending') return
  if (order.status !== 'processing') return
  const supplier = ctx.repo.suppliers.require(attempt.supplierId)
  attempt.respondedAt = ctx.clock.iso()
  attempt.latencyMs = ctx.clock.now() - new Date(attempt.sentAt).getTime()
  const c = classify(supplier, res)
  attempt.classification = c
  supplierSideEffects(ctx, order, supplier.id, c)

  switch (c.kind) {
    case 'success': {
      if (res.kind !== 'accepted') return
      attempt.state = 'accepted'
      attempt.externalRef = res.externalRef
      addEvent(ctx, order, { type: 'attempt_accepted', title: 'Supplier accepted', detail: `${supplier.name} reference ${res.externalRef} · ${attempt.latencyMs} ms`, tone: 'success', ref: { kind: 'attempt', id: attempt.id } })
      if (res.result) {
        attempt.state = 'succeeded'
        settleOrder(ctx, order, attempt, res.result)
      } else {
        addEvent(ctx, order, { type: 'processing', title: 'Processing at supplier', detail: 'Waiting for the supplier to finish — status is polled automatically', tone: 'neutral' })
        emit(ctx, { event: 'order.processing', accountId: order.accountId, orderId: order.id, data: apiOrder(ctx, order) })
        ctx.scheduler.schedule('attempt.poll', { orderId: order.id, attemptId: attempt.id }, ctx.clock.now() + (res.etaMs ?? 5 * 60_000))
      }
      return
    }
    case 'rejected_terminal':
      attempt.state = 'rejected'
      addEvent(ctx, order, { type: 'attempt_rejected', title: `${supplier.name} rejected the order`, detail: `${c.message} · classified terminal — another supplier would give the same answer`, tone: 'danger', ref: { kind: 'attempt', id: attempt.id } })
      rejectOrder(ctx, order, { code: c.code, message: c.message })
      return
    case 'rejected_failover_safe':
    case 'not_accepted':
      attempt.state = c.kind === 'not_accepted' ? 'not_accepted' : 'rejected'
      addEvent(ctx, order, {
        type: c.kind === 'not_accepted' ? 'attempt_not_accepted' : 'attempt_rejected',
        title: c.kind === 'not_accepted' ? `${supplier.name} did not accept the order` : `${supplier.name} rejected the order`,
        detail: `${c.message} · definitive and failover-safe${c.mappingId ? ' (error mapping)' : ''}`,
        tone: 'warning',
        ref: { kind: 'attempt', id: attempt.id },
      })
      dispatch(ctx, order.id)
      return
    case 'unknown':
      attempt.state = 'unknown'
      openReview(ctx, order, attempt, 'unknown_outcome', c)
      return
  }
}

export function pollAttempt(ctx: CoreContext, orderId: string, attemptId: string) {
  const order = ctx.repo.orders.get(orderId)
  const attempt = order?.attempts.find((a) => a.id === attemptId)
  if (!order || !attempt || attempt.state !== 'accepted' || order.status !== 'processing') return
  const supplier = ctx.repo.suppliers.require(attempt.supplierId)
  const res = ctx.drivers.get(supplier.driver).getStatus(supplier, order, attempt.externalRef)
  ctx.repo.driverCalls.insert({ ...res.call, orderId: order.id, attemptId: attempt.id })
  const st = res.value
  if (st.state === 'completed' && st.result) {
    attempt.state = 'succeeded'
    settleOrder(ctx, order, attempt, st.result)
  } else if (st.state === 'rejected') {
    const c = classify(supplier, { kind: 'rejected', code: 'rejected_after_acceptance', message: st.message })
    attempt.classification = c
    attempt.state = 'rejected'
    const safe = c.kind === 'rejected_failover_safe'
    addEvent(ctx, order, { type: 'attempt_rejected', title: `${supplier.name} rejected the order`, detail: `${st.message} · ${safe ? 'failover-safe — supplier refunded its charge' : 'terminal'}`, tone: safe ? 'warning' : 'danger', ref: { kind: 'attempt', id: attempt.id } })
    if (safe) dispatch(ctx, order.id)
    else rejectOrder(ctx, order, { code: c.code, message: c.message })
  } else if (st.state === 'not_found') {
    openReview(ctx, order, attempt, 'conflicting_result', { kind: 'unknown', code: 'reference_not_found', message: `Supplier no longer recognises reference ${attempt.externalRef}`, failoverSafe: false, mappingId: null })
  } else {
    ctx.scheduler.schedule('attempt.poll', { orderId: order.id, attemptId: attempt.id }, ctx.clock.now() + (st.retryAfterMs ?? 10 * 60_000))
  }
}

export function openReview(ctx: CoreContext, order: Order, attempt: Attempt, reason: ReviewReason, c: AttemptClassification) {
  const supplier = ctx.repo.suppliers.get(attempt.supplierId)
  order.review = { reason, openedAt: ctx.clock.iso(), attemptId: attempt.id, message: c.message, lookups: [], resolvedAt: null, resolution: null }
  transition(ctx, order, 'needs_review')
  addEvent(ctx, order, {
    type: 'attempt_unknown',
    title: reason === 'unknown_outcome' ? 'Supplier outcome UNKNOWN' : 'Conflicting supplier result',
    detail: `${c.message} — the request reached ${supplier?.name ?? 'the supplier'}, but we cannot tell whether it was accepted`,
    tone: 'danger',
    ref: { kind: 'attempt', id: attempt.id },
  })
  addEvent(ctx, order, { type: 'failover_blocked', title: 'Automatic failover blocked', detail: 'Supplier outcome is unknown. Automatic failover is blocked to prevent duplicate supplier orders.', tone: 'warning' })
  addEvent(ctx, order, { type: 'needs_review', title: 'Moved to Needs Review', detail: `Funds remain held (${formatMoney(order.price.amount)}) until an operator resolves the outcome`, tone: 'warning' })
  notify(ctx, { template: 'order.needs_review', orderId: order.id, supplierId: attempt.supplierId, vars: { supplier: supplier?.name ?? '' } })
  emit(ctx, { event: 'order.needs_review', accountId: null, orderId: order.id, data: apiOrder(ctx, order) })
}

/** Supplier-level consequences of an attempt outcome (circuit, auth, balance alerts). */
function supplierSideEffects(ctx: CoreContext, order: Order, supplierId: string, c: AttemptClassification) {
  const s = ctx.repo.suppliers.require(supplierId)
  const authWasOk = s.auth.status === 'ok'
  const change = recordOutcome(ctx, s, c)
  const recently = (template: string) => ctx.repo.notifications.find((n) => n.supplierId === s.id && n.template === template && ctx.clock.now() - new Date(n.at).getTime() < 3600_000)
  if (change === 'opened') {
    notify(ctx, { template: 'supplier.circuit_open', supplierId: s.id, vars: { failures: String(s.circuit.consecutiveFailures) } })
    audit(ctx, { actor: WORKER, action: 'supplier.circuit_opened', target: { type: 'supplier', id: s.id, label: s.name }, summary: `Circuit opened after ${s.circuit.consecutiveFailures} consecutive failures (order ${order.ref})`, severity: 'warning' })
  }
  if (change === 'closed') audit(ctx, { actor: WORKER, action: 'supplier.circuit_closed', target: { type: 'supplier', id: s.id, label: s.name }, summary: 'Half-open probe succeeded — circuit closed', severity: 'info' })
  if (c.code === 'supplier_auth_failed' && authWasOk) notify(ctx, { template: 'supplier.auth_error', supplierId: s.id, vars: { message: c.message } })
  if (c.code === 'supplier_insufficient_funds' && !recently('supplier.low_balance')) notify(ctx, { template: 'supplier.low_balance', supplierId: s.id, vars: { balance: formatMoney(s.reportedBalance), threshold: formatMoney(s.lowBalanceThreshold) } })
}
