/**
 * Double-entry ledger.
 *
 * Balances are projections of entries — there is no mutable balance column.
 * Every transaction balances (Σ debits = Σ credits) and carries an
 * idempotency key so retried commands and duplicated webhooks can never post
 * twice.
 *
 * Chart of accounts (codes are `group` or `group:subjectId`):
 *   asset      gateway_clearing:<method>   money collected by a payment gateway, not yet paid out
 *   asset      bank                        operator bank account
 *   asset      supplier_prepaid:<supplier> prepaid credit held at a supplier
 *   liability  customer_available:<acct>   customer wallet — spendable
 *   liability  customer_held:<acct>        customer funds reserved for open orders
 *   revenue    revenue                     order revenue
 *   revenue    refunds                     contra-revenue (refunds issued)
 *   expense    cost_of_sales               supplier cost of fulfilled orders
 *   expense    chargeback_fees             gateway chargeback fees
 *   expense    goodwill                    manual credits granted to customers
 */
import type { Micros } from '../money'
import type { Actor, ISODate } from './common'

export type LedgerAccountType = 'asset' | 'liability' | 'revenue' | 'expense'

export type LedgerGroup =
  | 'gateway_clearing'
  | 'bank'
  | 'supplier_prepaid'
  | 'customer_available'
  | 'customer_held'
  | 'revenue'
  | 'refunds'
  | 'cost_of_sales'
  | 'chargeback_fees'
  | 'goodwill'

export const LEDGER_GROUPS: Record<LedgerGroup, { name: string; type: LedgerAccountType }> = {
  gateway_clearing: { name: 'Gateway Clearing', type: 'asset' },
  bank: { name: 'Bank', type: 'asset' },
  supplier_prepaid: { name: 'Supplier Prepaid', type: 'asset' },
  customer_available: { name: 'Customer Available', type: 'liability' },
  customer_held: { name: 'Customer Held', type: 'liability' },
  revenue: { name: 'Revenue', type: 'revenue' },
  refunds: { name: 'Refunds (contra-revenue)', type: 'revenue' },
  cost_of_sales: { name: 'Cost of Sales', type: 'expense' },
  chargeback_fees: { name: 'Chargeback Fees', type: 'expense' },
  goodwill: { name: 'Goodwill Credits', type: 'expense' },
}

export type EntryDirection = 'debit' | 'credit'

export interface LedgerEntry {
  id: string
  txId: string
  /** e.g. `customer_available:acc_k3p9q2m8x1` */
  account: string
  direction: EntryDirection
  amount: Micros
}

export type LedgerTxKind =
  | 'top_up'
  | 'order_hold'
  | 'order_release'
  | 'order_settlement'
  | 'refund'
  | 'chargeback'
  | 'adjustment'
  | 'supplier_top_up'
  | 'gateway_payout'
  | 'supplier_credit'

export interface LedgerTransaction {
  id: string
  /** Human reference: LTX-…  */
  ref: string
  at: ISODate
  kind: LedgerTxKind
  description: string
  entries: LedgerEntry[]
  orderId: string | null
  accountId: string | null
  supplierId: string | null
  paymentIntentId: string | null
  refundId: string | null
  idempotencyKey: string
  actor: Actor
  reason: string | null
}

export interface LedgerAccountBalance {
  account: string
  group: LedgerGroup
  subjectId: string | null
  name: string
  type: LedgerAccountType
  debits: Micros
  credits: Micros
  /** Signed in the account's normal direction (assets/expenses debit, others credit). */
  balance: Micros
  entries: number
}

export type IntegrityStatus = 'pass' | 'warn' | 'fail'

export interface IntegrityCheck {
  id: string
  label: string
  description: string
  status: IntegrityStatus
  detail: string
  /** Records needing attention (order ids, tx ids…). */
  items: { id: string; label: string; href?: string }[]
}

export interface IntegrityReport {
  checkedAt: ISODate
  status: IntegrityStatus
  totals: { transactions: number; entries: number; debits: Micros; credits: Micros }
  checks: IntegrityCheck[]
}
