import { LEDGER_GROUPS, type LedgerGroup } from '@/core/domain'

const KIND_LABEL: Record<string, string> = {
  top_up: 'Wallet top-up',
  order_hold: 'Order hold',
  order_release: 'Hold released',
  order_settlement: 'Settlement',
  refund: 'Refund',
  chargeback: 'Chargeback',
  adjustment: 'Manual adjustment',
  supplier_top_up: 'Supplier top-up',
  gateway_payout: 'Gateway payout',
  supplier_credit: 'Supplier credit',
}

export const ledgerKindLabel = (k: string) => KIND_LABEL[k] ?? k

/** Human name of a ledger account code; `names` resolves subject ids (account / supplier names). */
export function ledgerAccountName(code: string, names?: Record<string, string>) {
  const [group, subject] = code.split(':') as [LedgerGroup, string | undefined]
  const base = LEDGER_GROUPS[group]?.name ?? group
  return subject ? `${base} · ${names?.[subject] ?? subject.replace(/^(acc|sup)_/, '')}` : base
}
