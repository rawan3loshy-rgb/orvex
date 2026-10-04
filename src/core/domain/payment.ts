/**
 * Payments — always simulated in the prototype.
 *
 * Every successful payment funds a wallet (DR Gateway Clearing / CR Customer
 * Available). A storefront checkout is "payment → wallet → hold → order", so
 * the order engine only ever deals with wallet holds, whatever the channel.
 */
import type { Micros } from '../money'
import type { Actor, ISODate } from './common'

export type PaymentMethodKind = 'card' | 'paypal' | 'bank_transfer' | 'manual'

export interface PaymentMethodConfig {
  id: PaymentMethodKind
  name: string
  /** e.g. "Demo Card Gateway" — never a real processor name. */
  gateway: string
  enabled: boolean
  mode: 'simulated'
  /** Fee charged by the gateway: basis points + fixed. */
  fee: { bps: number; fixed: Micros }
  settlement: 'instant' | 'async' | 'manual_confirmation'
  customerFacing: boolean
  instructions: string
}

export type PaymentIntentStatus = 'requires_payment' | 'pending' | 'succeeded' | 'failed' | 'cancelled'

export interface PaymentIntent {
  id: string
  ref: string
  accountId: string
  orderId: string | null
  purpose: 'order' | 'top_up'
  amount: Micros
  method: PaymentMethodKind
  status: PaymentIntentStatus
  gatewayRef: string
  failureReason: string | null
  createdAt: ISODate
  updatedAt: ISODate
  events: { at: ISODate; type: string; detail: string }[]
  /** Top-up ledger transaction created when the payment succeeded. */
  ledgerTxId: string | null
  refundedTotal: Micros
  chargebackId: string | null
}

export type RefundDestination = 'wallet' | 'original_method'

export interface Refund {
  id: string
  ref: string
  orderId: string | null
  paymentIntentId: string | null
  accountId: string
  amount: Micros
  destination: RefundDestination
  reason: string
  status: 'succeeded' | 'pending' | 'failed'
  idempotencyKey: string
  verificationId: string | null
  createdAt: ISODate
  actor: Actor
  ledgerTxIds: string[]
}

export interface Chargeback {
  id: string
  ref: string
  paymentIntentId: string
  accountId: string
  amount: Micros
  fee: Micros
  reason: string
  status: 'open' | 'won' | 'lost'
  openedAt: ISODate
  resolvedAt: ISODate | null
  ledgerTxIds: string[]
}

/** Inbound gateway notification (webhook). Duplicates are recorded and ignored. */
export interface GatewayEvent {
  id: string
  gateway: string
  type: 'payment.succeeded' | 'payment.pending' | 'payment.failed' | 'refund.succeeded' | 'chargeback.opened'
  receivedAt: ISODate
  paymentIntentId: string
  signature: 'valid' | 'invalid'
  status: 'processed' | 'duplicate_ignored' | 'rejected'
  duplicateOf: string | null
  payload: string
}
