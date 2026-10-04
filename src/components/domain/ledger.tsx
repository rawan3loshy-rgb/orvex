import { formatMoney } from '@/core/money'
import type { LedgerTransaction } from '@/core/domain'
import { dateTime } from '@/lib/format'
import { cn } from '@/lib/cn'
import { ledgerAccountName, ledgerKindLabel } from './ledgerFormat'

/** Double-entry view of one transaction: DR lines then CR lines, balanced. */
export function LedgerEntries({ tx, names, className, showHeader = true }: { tx: LedgerTransaction; names?: Record<string, string>; className?: string; showHeader?: boolean }) {
  const lines = [...tx.entries].sort((a, b) => (a.direction === b.direction ? 0 : a.direction === 'debit' ? -1 : 1))
  const total = tx.entries.filter((e) => e.direction === 'debit').reduce((a, e) => a + e.amount, 0)
  return (
    <div className={cn('overflow-hidden rounded-lg border border-line', className)}>
      {showHeader && (
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2/50 px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-[12.5px] font-semibold">{ledgerKindLabel(tx.kind)} · {tx.description}</div>
            <div className="font-mono text-[11px] text-fg-3">{tx.ref} · {dateTime(tx.at)}</div>
          </div>
          <span className="shrink-0 rounded-md bg-success/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-success">Balanced</span>
        </div>
      )}
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-left text-[10.5px] tracking-wide text-fg-3 uppercase">
            <th className="w-10 px-3 py-1.5 font-medium">Side</th>
            <th className="px-3 py-1.5 font-medium">Account</th>
            <th className="px-3 py-1.5 text-right font-medium">Debit</th>
            <th className="px-3 py-1.5 text-right font-medium">Credit</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((e) => (
            <tr key={e.id} className="border-t border-line/60">
              <td className="px-3 py-1.5 font-mono text-[11px] font-semibold text-fg-3">{e.direction === 'debit' ? 'DR' : 'CR'}</td>
              <td className={cn('px-3 py-1.5', e.direction === 'credit' && 'pl-7')}>{ledgerAccountName(e.account, names)}</td>
              <td className="px-3 py-1.5 text-right font-mono tabular">{e.direction === 'debit' ? formatMoney(e.amount) : ''}</td>
              <td className="px-3 py-1.5 text-right font-mono tabular">{e.direction === 'credit' ? formatMoney(e.amount) : ''}</td>
            </tr>
          ))}
          <tr className="border-t border-line bg-surface-2/40 text-[11.5px] text-fg-3">
            <td />
            <td className="px-3 py-1.5">Totals</td>
            <td className="px-3 py-1.5 text-right font-mono tabular">{formatMoney(total as never)}</td>
            <td className="px-3 py-1.5 text-right font-mono tabular">{formatMoney(total as never)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
