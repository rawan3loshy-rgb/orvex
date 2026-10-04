import type { LucideIcon } from 'lucide-react'
import { ArrowDownLeft, Building, CreditCard, PenLine, PlugZap, ShoppingCart, SlidersHorizontal, Undo2, Wallet, Landmark } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Transaction, TransactionType } from '@/types/installation'

/** Coral = order charges (the revenue flow), graphite / stone for secondary flows, ochre for money leaving to suppliers. */
export const TYPE_META: Record<TransactionType, { label: string; plural: string; icon: LucideIcon; color: string; hint: string }> = {
  order_charge: { label: 'Order charge', plural: 'Order charges', icon: ShoppingCart, color: 'var(--c1)', hint: 'Debited from a reseller balance when an IMEI check, unlock or code order is placed' },
  top_up: { label: 'Top-up', plural: 'Top-ups', icon: ArrowDownLeft, color: 'var(--success)', hint: 'Funds added to a reseller’s prepaid balance' },
  refund: { label: 'Refund', plural: 'Refunds', icon: Undo2, color: 'var(--c2)', hint: 'Released for a failed unlock or check, or refunded by an operator' },
  adjustment: { label: 'Adjustment', plural: 'Adjustments', icon: SlidersHorizontal, color: 'var(--c6)', hint: 'Manual credit or debit by an administrator' },
  provider_settlement: { label: 'Supplier settlement', plural: 'Supplier settlements', icon: Landmark, color: 'var(--c4)', hint: 'Prepaid credit sent to a supplier wallet' },
}

export const METHOD_META: Record<Transaction['method'], { label: string; icon: LucideIcon }> = {
  balance: { label: 'Balance', icon: Wallet },
  card: { label: 'Card', icon: CreditCard },
  bank_transfer: { label: 'Bank transfer', icon: Building },
  manual: { label: 'Manual', icon: PenLine },
  provider_wallet: { label: 'Supplier wallet', icon: PlugZap },
}

/** Refunds come in two flavours: automatic release of a failed order, or an operator refund. */
export function refundKind(t: Pick<Transaction, 'type' | 'description'>) {
  if (t.type !== 'refund') return null
  return /^Released/i.test(t.description) ? 'Failed order released' : 'Operator refund'
}

export function TypeIcon({ type, size = 'sm', className }: { type: TransactionType; size?: 'sm' | 'lg'; className?: string }) {
  const m = TYPE_META[type]
  const Icon = m.icon
  return (
    <span
      className={cn('inline-grid shrink-0 place-items-center', size === 'lg' ? 'size-11 rounded-xl [&_svg]:size-5' : 'size-7 rounded-md [&_svg]:size-3.5', className)}
      style={{ color: `color-mix(in oklab, ${m.color} 85%, var(--fg))`, background: `color-mix(in oklab, ${m.color} 12%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${m.color} 24%, transparent)` }}
      aria-hidden
    >
      <Icon />
    </span>
  )
}

/** Bare type icon in the type's color (for headers that provide their own tile). */
export function TypeGlyph({ type }: { type: TransactionType }) {
  const m = TYPE_META[type]
  const Icon = m.icon
  return <Icon style={{ color: m.color }} />
}

/** Orders are referenced as ord_<number>. */
export const orderNumber = (orderId: string) => orderId.replace(/^ord_/, '')
