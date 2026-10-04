/**
 * Orders.
 *
 * Fulfilment status and financial status are separate dimensions:
 *   status           awaiting_payment → queued → processing → completed | rejected | cancelled
 *                                                     ↘ needs_review ↗
 *   financialStatus  none → held → captured → partially_refunded → refunded
 *                               ↘ released
 * "refunded" is never a fulfilment status: a completed order stays completed
 * when money is returned.
 */
import type { Micros } from '../money'
import type { PriceQuote } from './catalog'
import type { AttemptClass } from './supplier'
import type { Actor, ISODate, Tone } from './common'

export type OrderStatus = 'awaiting_payment' | 'queued' | 'processing' | 'needs_review' | 'completed' | 'rejected' | 'cancelled'

/** `none` = nothing held yet (awaiting payment). */
export type FinancialStatus = 'none' | 'held' | 'captured' | 'released' | 'partially_refunded' | 'refunded'

export type OrderChannel = 'storefront' | 'portal' | 'api' | 'dhru' | 'admin'

export const TERMINAL_STATUSES: readonly OrderStatus[] = ['completed', 'rejected', 'cancelled']
export const OPEN_STATUSES: readonly OrderStatus[] = ['awaiting_payment', 'queued', 'processing', 'needs_review']

export type AttemptState = 'sending' | 'accepted' | 'succeeded' | 'rejected' | 'not_accepted' | 'unknown' | 'confirmed_not_received'

export interface AttemptClassification {
  kind: AttemptClass
  /** Normalised code, e.g. `supplier_timeout`, `insufficient_funds`, `source_unavailable`. */
  code: string
  message: string
  /** May the router move on to the next offer? Never true for `unknown`. */
  failoverSafe: boolean
  /** Which error mapping produced the classification, if any. */
  mappingId: string | null
}

export interface Attempt {
  id: string
  orderId: string
  n: number
  supplierId: string
  offerId: string
  supplierProductId: string
  cost: Micros
  state: AttemptState
  sentAt: ISODate
  respondedAt: ISODate | null
  latencyMs: number | null
  externalRef: string | null
  classification: AttemptClassification | null
  /** Demo: simulator behaviour that produced this attempt. */
  simulated: string
}

export interface OrderResult {
  fields: Record<string, string | number | boolean>
  summary: string
  receivedAt: ISODate
  source: 'supplier' | 'manual'
}

export type ReviewReason = 'unknown_outcome' | 'conflicting_result' | 'manual_hold'

export type ReviewAction = 'lookup_supplier' | 'confirm_not_received' | 'enter_supplier_reference' | 'resolve_completed' | 'resolve_rejected'

export interface OrderReview {
  reason: ReviewReason
  openedAt: ISODate
  attemptId: string | null
  message: string
  lookups: { at: ISODate; outcome: 'found_completed' | 'found_processing' | 'found_rejected' | 'not_found' | 'unreachable'; detail: string }[]
  resolvedAt: ISODate | null
  resolution: { action: ReviewAction; reason: string; by: Actor } | null
}

export type OrderEventType =
  | 'created'
  | 'payment_pending'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'wallet_funded'
  | 'hold_created'
  | 'queued'
  | 'routed'
  | 'attempt_sent'
  | 'attempt_accepted'
  | 'attempt_rejected'
  | 'attempt_not_accepted'
  | 'attempt_unknown'
  | 'failover'
  | 'failover_blocked'
  | 'margin_guard'
  | 'processing'
  | 'result_received'
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'hold_released'
  | 'ledger_settled'
  | 'needs_review'
  | 'review_action'
  | 'refund'
  | 'verification'
  | 'notification'
  | 'webhook'
  | 'idempotent_replay'

export interface OrderEvent {
  id: string
  at: ISODate
  type: OrderEventType
  title: string
  detail?: string
  tone: Tone
  actor?: Actor
  /** Link to the record that explains the event. */
  ref?: { kind: 'attempt' | 'ledger' | 'payment' | 'refund' | 'notification' | 'webhook' | 'verification' | 'audit' | 'supplier'; id: string }
}

export interface Order {
  id: string
  /** Public, random, non-sequential: ORD-7K3P9Q. */
  ref: string
  accountId: string
  channel: OrderChannel
  placedBy: Actor
  serviceId: string
  serviceRevisionId: string
  serviceRevision: number
  /** Snapshot for display — the catalog may rename the service later. */
  serviceName: string
  input: Record<string, string>
  /** Price snapshot (incl. "why this price"). Later catalog changes never alter it. */
  price: PriceQuote
  /** Cost of the attempt that fulfilled the order. */
  supplierCost: Micros | null
  status: OrderStatus
  financialStatus: FinancialStatus
  attempts: Attempt[]
  result: OrderResult | null
  rejection: { code: string; message: string } | null
  review: OrderReview | null
  idempotencyKey: string | null
  clientReference: string | null
  /** Private tracking token for guest/storefront orders (random, 32 chars). */
  trackingToken: string | null
  paymentIntentId: string | null
  refundedTotal: Micros
  verificationIds: string[]
  events: OrderEvent[]
  createdAt: ISODate
  updatedAt: ISODate
  completedAt: ISODate | null
  /** Demo scenario tag (A–L) for discoverability. */
  scenario: string | null
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_payment: 'Awaiting payment',
  queued: 'Queued',
  processing: 'Processing',
  needs_review: 'Needs review',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

export const FINANCIAL_STATUS_LABEL: Record<FinancialStatus, string> = {
  none: 'Not funded',
  held: 'Held',
  captured: 'Captured',
  released: 'Released',
  partially_refunded: 'Partially refunded',
  refunded: 'Refunded',
}
