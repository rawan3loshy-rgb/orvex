/**
 * LedgerService — the only writer of money movements.
 *
 * Posting rules (DR = debit, CR = credit):
 *   top-up            DR Gateway Clearing           CR Customer Available
 *   order hold        DR Customer Available         CR Customer Held
 *   hold release      DR Customer Held              CR Customer Available
 *   settlement        DR Customer Held (price)      CR Revenue (price)
 *                     DR Cost of Sales (cost)       CR Supplier Prepaid (cost)
 *   refund → wallet   DR Refunds                    CR Customer Available
 *   refund → card     DR Refunds                    CR Gateway Clearing
 *   chargeback        DR Customer Available         CR Gateway Clearing   (+ fee: DR Chargeback Fees / CR Gateway Clearing)
 *   goodwill credit   DR Goodwill                   CR Customer Available
 *   supplier top-up   DR Supplier Prepaid           CR Bank
 *   gateway payout    DR Bank                       CR Gateway Clearing
 * Balances are projections of these entries.
 */
import { add, sub, ZERO, type Micros } from '../money'
import type { CoreContext } from '../ports'
import type { AccountBalance, Actor, EntryDirection, LedgerEntry, LedgerTransaction, LedgerTxKind, Order, PaymentMethodKind, WalletLine } from '../domain'
import { invalid } from '../errors'

export const LA = {
  available: (accountId: string) => `customer_available:${accountId}`,
  held: (accountId: string) => `customer_held:${accountId}`,
  clearing: (method: PaymentMethodKind) => `gateway_clearing:${method}`,
  supplier: (supplierId: string) => `supplier_prepaid:${supplierId}`,
  bank: 'bank',
  revenue: 'revenue',
  refunds: 'refunds',
  cost: 'cost_of_sales',
  chargebackFees: 'chargeback_fees',
  goodwill: 'goodwill',
} as const

export interface PostingLine {
  account: string
  dir: EntryDirection
  amount: Micros
}

export interface PostingInput {
  kind: LedgerTxKind
  description: string
  lines: PostingLine[]
  idempotencyKey: string
  actor: Actor
  orderId?: string | null
  accountId?: string | null
  supplierId?: string | null
  paymentIntentId?: string | null
  refundId?: string | null
  reason?: string | null
  at?: number
}

/** Post a balanced transaction. Idempotent: the same key returns the original transaction. */
export function post(ctx: CoreContext, input: PostingInput): LedgerTransaction {
  const existing = ctx.repo.ledger.byIdempotencyKey(input.idempotencyKey)
  if (existing) return existing
  const lines = input.lines.filter((l) => l.amount !== 0)
  for (const l of lines) if (l.amount < 0) throw invalid(`Negative posting amount on ${l.account}`)
  const id = ctx.ids.id('ltx')
  const entries: LedgerEntry[] = lines.map((l, i) => ({ id: `${id}_${i + 1}`, txId: id, account: l.account, direction: l.dir, amount: l.amount }))
  const tx: LedgerTransaction = {
    id,
    ref: ctx.ids.ref('LTX', 7),
    at: ctx.clock.iso(input.at),
    kind: input.kind,
    description: input.description,
    entries,
    orderId: input.orderId ?? null,
    accountId: input.accountId ?? null,
    supplierId: input.supplierId ?? null,
    paymentIntentId: input.paymentIntentId ?? null,
    refundId: input.refundId ?? null,
    idempotencyKey: input.idempotencyKey,
    actor: input.actor,
    reason: input.reason ?? null,
  }
  return ctx.repo.ledger.post(tx)
}

/* ------------------------------------------------------------------------- */
/*  Projections                                                              */
/* ------------------------------------------------------------------------- */
export function walletBalance(ctx: CoreContext, accountId: string): AccountBalance {
  const acct = ctx.repo.accounts.get(accountId)
  const available = ctx.repo.ledger.balance(LA.available(accountId)).balance
  const held = ctx.repo.ledger.balance(LA.held(accountId)).balance
  const creditLimit = acct?.creditLimit ?? ZERO
  return { accountId, available, held, creditLimit, spendable: add(available, creditLimit) }
}

/** Net amount currently held for one order. */
export function heldForOrder(ctx: CoreContext, order: Order): Micros {
  const held = LA.held(order.accountId)
  let net = 0
  for (const tx of ctx.repo.ledger.forOrder(order.id)) {
    for (const e of tx.entries) if (e.account === held) net += e.direction === 'credit' ? e.amount : -e.amount
  }
  return net as Micros
}

/** Expected supplier balance = ledger projection of the prepaid account. */
export function expectedSupplierBalance(ctx: CoreContext, supplierId: string): Micros {
  return ctx.repo.ledger.balance(LA.supplier(supplierId)).balance
}

/** Wallet statement for an account (oldest → newest, with running balances). */
export function walletLines(ctx: CoreContext, accountId: string): WalletLine[] {
  const av = LA.available(accountId)
  const hd = LA.held(accountId)
  const txs = ctx.repo.ledger.transactions((t) => t.accountId === accountId || t.entries.some((e) => e.account === av || e.account === hd)).slice().reverse()
  let a = 0
  let h = 0
  const out: WalletLine[] = []
  for (const t of txs) {
    let da = 0
    let dh = 0
    for (const e of t.entries) {
      const s = e.direction === 'credit' ? e.amount : -e.amount
      if (e.account === av) da += s
      if (e.account === hd) dh += s
    }
    if (da === 0 && dh === 0) continue
    a += da
    h += dh
    const order = t.orderId ? ctx.repo.orders.get(t.orderId) : undefined
    out.push({ txId: t.id, ref: t.ref, at: t.at, kind: t.kind, description: t.description, orderId: t.orderId, orderRef: order?.ref ?? null, available: da as Micros, held: dh as Micros, availableAfter: a as Micros, heldAfter: h as Micros })
  }
  return out.reverse()
}

/* ------------------------------------------------------------------------- */
/*  Posting helpers                                                          */
/* ------------------------------------------------------------------------- */
export function fundWallet(ctx: CoreContext, p: { accountId: string; amount: Micros; method: PaymentMethodKind; paymentIntentId: string; paymentRef: string; actor: Actor; at?: number }) {
  return post(ctx, {
    kind: 'top_up',
    description: `Wallet funded · ${p.paymentRef}`,
    lines: [
      { account: LA.clearing(p.method), dir: 'debit', amount: p.amount },
      { account: LA.available(p.accountId), dir: 'credit', amount: p.amount },
    ],
    idempotencyKey: `payment:${p.paymentIntentId}:capture`,
    actor: p.actor,
    accountId: p.accountId,
    paymentIntentId: p.paymentIntentId,
    at: p.at,
  })
}

export function holdForOrder(ctx: CoreContext, order: Order, actor: Actor) {
  const amount = order.price.amount
  return post(ctx, {
    kind: 'order_hold',
    description: `Hold · ${order.ref}`,
    lines: [
      { account: LA.available(order.accountId), dir: 'debit', amount },
      { account: LA.held(order.accountId), dir: 'credit', amount },
    ],
    idempotencyKey: `order:${order.id}:hold`,
    actor,
    orderId: order.id,
    accountId: order.accountId,
  })
}

export function releaseHold(ctx: CoreContext, order: Order, actor: Actor, reason: string) {
  const amount = heldForOrder(ctx, order)
  if (amount <= 0) return null
  return post(ctx, {
    kind: 'order_release',
    description: `Hold released · ${order.ref}`,
    lines: [
      { account: LA.held(order.accountId), dir: 'debit', amount },
      { account: LA.available(order.accountId), dir: 'credit', amount },
    ],
    idempotencyKey: `order:${order.id}:release`,
    actor,
    orderId: order.id,
    accountId: order.accountId,
    reason,
  })
}

export function settleOrder(ctx: CoreContext, order: Order, cost: Micros, supplierId: string, actor: Actor) {
  const price = heldForOrder(ctx, order)
  if (price <= 0) throw invalid(`Order ${order.ref} has no held funds to settle`)
  return post(ctx, {
    kind: 'order_settlement',
    description: `Settlement · ${order.ref}`,
    lines: [
      { account: LA.held(order.accountId), dir: 'debit', amount: price },
      { account: LA.cost, dir: 'debit', amount: cost },
      { account: LA.revenue, dir: 'credit', amount: price },
      { account: LA.supplier(supplierId), dir: 'credit', amount: cost },
    ],
    idempotencyKey: `order:${order.id}:settle`,
    actor,
    orderId: order.id,
    accountId: order.accountId,
    supplierId,
  })
}

export function refundPosting(
  ctx: CoreContext,
  p: { refundId: string; refundRef: string; accountId: string; amount: Micros; destination: 'wallet' | 'original_method'; method: PaymentMethodKind | null; orderId: string | null; paymentIntentId: string | null; actor: Actor; reason: string; idempotencyKey: string },
) {
  const creditAccount = p.destination === 'wallet' || !p.method ? LA.available(p.accountId) : LA.clearing(p.method)
  return post(ctx, {
    kind: 'refund',
    description: `Refund ${p.refundRef} → ${p.destination === 'wallet' ? 'wallet' : 'original payment method'}`,
    lines: [
      { account: LA.refunds, dir: 'debit', amount: p.amount },
      { account: creditAccount, dir: 'credit', amount: p.amount },
    ],
    idempotencyKey: p.idempotencyKey,
    actor: p.actor,
    orderId: p.orderId,
    accountId: p.accountId,
    paymentIntentId: p.paymentIntentId,
    refundId: p.refundId,
    reason: p.reason,
  })
}

export function adjustWallet(ctx: CoreContext, p: { accountId: string; amount: Micros; reason: string; actor: Actor; idempotencyKey: string; at?: number }) {
  const credit = p.amount > 0
  const amount = (credit ? p.amount : -p.amount) as Micros
  return post(ctx, {
    kind: 'adjustment',
    description: credit ? 'Goodwill credit' : 'Manual debit',
    lines: credit
      ? [
          { account: LA.goodwill, dir: 'debit', amount },
          { account: LA.available(p.accountId), dir: 'credit', amount },
        ]
      : [
          { account: LA.available(p.accountId), dir: 'debit', amount },
          { account: LA.goodwill, dir: 'credit', amount },
        ],
    idempotencyKey: p.idempotencyKey,
    actor: p.actor,
    accountId: p.accountId,
    reason: p.reason,
    at: p.at,
  })
}

export function supplierTopUp(ctx: CoreContext, p: { supplierId: string; amount: Micros; actor: Actor; idempotencyKey: string; note?: string; at?: number }) {
  return post(ctx, {
    kind: 'supplier_top_up',
    description: p.note ?? 'Supplier prepaid top-up',
    lines: [
      { account: LA.supplier(p.supplierId), dir: 'debit', amount: p.amount },
      { account: LA.bank, dir: 'credit', amount: p.amount },
    ],
    idempotencyKey: p.idempotencyKey,
    actor: p.actor,
    supplierId: p.supplierId,
    at: p.at,
  })
}

export function chargebackPosting(ctx: CoreContext, p: { chargebackId: string; accountId: string; amount: Micros; fee: Micros; method: PaymentMethodKind; paymentIntentId: string; actor: Actor; at?: number }) {
  return post(ctx, {
    kind: 'chargeback',
    description: 'Chargeback — funds reclaimed by card network',
    lines: [
      { account: LA.available(p.accountId), dir: 'debit', amount: p.amount },
      { account: LA.chargebackFees, dir: 'debit', amount: p.fee },
      { account: LA.clearing(p.method), dir: 'credit', amount: add(p.amount, p.fee) },
    ],
    idempotencyKey: `chargeback:${p.chargebackId}`,
    actor: p.actor,
    accountId: p.accountId,
    paymentIntentId: p.paymentIntentId,
    at: p.at,
  })
}

export function gatewayPayout(ctx: CoreContext, p: { method: PaymentMethodKind; amount: Micros; actor: Actor; idempotencyKey: string; at?: number }) {
  return post(ctx, {
    kind: 'gateway_payout',
    description: `Gateway payout to bank · ${p.method}`,
    lines: [
      { account: LA.bank, dir: 'debit', amount: p.amount },
      { account: LA.clearing(p.method), dir: 'credit', amount: p.amount },
    ],
    idempotencyKey: p.idempotencyKey,
    actor: p.actor,
    at: p.at,
  })
}

/** Signed effect of a transaction on one account (credit-positive). */
export function effectOn(tx: LedgerTransaction, account: string): Micros {
  let n = ZERO
  for (const e of tx.entries) if (e.account === account) n = e.direction === 'credit' ? add(n, e.amount) : sub(n, e.amount)
  return n
}
