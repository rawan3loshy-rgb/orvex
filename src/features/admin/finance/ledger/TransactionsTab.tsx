import { Fragment, useDeferredValue, useEffect, useEffectEvent, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { BookOpen, ChevronRight, X } from 'lucide-react'
import { LEDGER_GROUPS, type LedgerGroup } from '@/core/domain'
import type { LedgerTxKind, Micros } from '@/types/installation'
import type { LedgerTxRow } from '@/services/installation'
import { useLedgerTransactions } from '@/hooks/installation'
import { LedgerEntries, Money, ledgerAccountName, ledgerKindLabel } from '@/components/domain'
import { Badge, Card, EmptyState, Pagination, SearchInput, Select, Skeleton } from '@/components/ui'
import { dateTime } from '@/lib/format'
import { cn } from '@/lib/cn'
import { LoadError } from '../shared'
import { useSupplierNames } from '../helpers'

const KINDS: LedgerTxKind[] = ['top_up', 'order_hold', 'order_release', 'order_settlement', 'refund', 'chargeback', 'adjustment', 'supplier_top_up', 'gateway_payout', 'supplier_credit']
const PAGE_SIZE = 30

const KIND_TONE: Partial<Record<LedgerTxKind, 'success' | 'warning' | 'danger' | 'info' | 'accent'>> = {
  top_up: 'success',
  order_hold: 'warning',
  order_settlement: 'accent',
  refund: 'info',
  chargeback: 'danger',
  adjustment: 'warning',
}

export function TransactionsTab() {
  const [params, setParams] = useSearchParams()
  const kind = params.get('kind') ?? ''
  const account = params.get('account') ?? ''
  const accountId = params.get('accountId') ?? ''
  const orderId = params.get('orderId') ?? ''
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1)
  const [search, setSearch] = useState(params.get('search') ?? '')
  const q = useDeferredValue(search.trim())
  const [open, setOpen] = useState<Set<string>>(new Set())

  const update = (patch: Record<string, string | null>, keepPage = false) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (!v) next.delete(k)
      else next.set(k, v)
    }
    if (!keepPage) next.delete('page')
    setParams(next, { replace: true })
  }
  const syncSearchToUrl = useEffectEvent((value: string) => {
    if ((params.get('search') ?? '') !== value) update({ search: value || null })
  })
  useEffect(() => {
    syncSearchToUrl(q)
  }, [q])

  const list = useLedgerTransactions({ kind: kind || undefined, account: account || undefined, accountId: accountId || undefined, orderId: orderId || undefined, search: q || undefined, page, pageSize: PAGE_SIZE })
  const items = list.data?.items
  const names = useSupplierNames()
  const allNames = useMemo(() => {
    const m: Record<string, string> = { ...names }
    for (const t of items ?? []) if (t.accountId && t.accountName) m[t.accountId] = t.accountName
    return m
  }, [names, items])

  // Expand the single result automatically (e.g. arriving from an order or a wallet line) — adjusted during render, not in an effect.
  const [expandedFor, setExpandedFor] = useState<typeof items>(undefined)
  if (items !== expandedFor) {
    setExpandedFor(items)
    if (items && items.length === 1) setOpen(new Set([items[0]!.id]))
  }

  const toggle = (id: string) => setOpen((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })

  const groupKeys = Object.keys(LEDGER_GROUPS) as LedgerGroup[]
  const accountOptions = [{ value: '', label: 'Any ledger account' }, ...groupKeys.map((g) => ({ value: g, label: `${LEDGER_GROUPS[g].name} (${g})` }))]
  if (account && !groupKeys.includes(account as LedgerGroup)) accountOptions.push({ value: account, label: ledgerAccountName(account, allNames) })

  const accountLabel = accountId ? (items?.find((t) => t.accountId === accountId)?.accountName ?? accountId) : ''
  const orderLabel = orderId ? (items?.find((t) => t.orderId === orderId)?.orderRef ?? orderId) : ''
  const filtered = !!(kind || account || accountId || orderId || q)

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:px-5 lg:flex-row lg:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search LTX ref, order ref, description, idempotency key, actor…" className="lg:w-[360px]" />
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <Select inputSize="sm" className="w-[180px]" value={kind} onChange={(e) => update({ kind: e.target.value || null })} options={[{ value: '', label: 'All kinds' }, ...KINDS.map((k) => ({ value: k, label: ledgerKindLabel(k) }))]} />
          <Select inputSize="sm" className="w-[240px]" value={account} onChange={(e) => update({ account: e.target.value || null })} options={accountOptions} />
        </div>
      </div>
      {(accountId || orderId) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2/40 px-5 py-2 text-[12px]">
          <span className="text-fg-3">Scoped to</span>
          {accountId && <FilterChip label={<>Account · <Link to={`/admin/accounts/${accountId}`} className="text-accent-ink hover:underline">{accountLabel}</Link></>} onClear={() => update({ accountId: null })} />}
          {orderId && <FilterChip label={<>Order · <Link to={`/admin/orders/${orderId}`} className="font-mono text-accent-ink hover:underline">{orderLabel}</Link></>} onClear={() => update({ orderId: null })} />}
        </div>
      )}

      {list.isError ? (
        <LoadError what="ledger transactions" onRetry={() => list.refetch()} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr className="text-left text-[11.5px] tracking-wide text-fg-3">
                <th className="w-8 border-b border-line py-2.5 pl-4" />
                <th className="border-b border-line px-3 py-2.5 font-medium">When / ref</th>
                <th className="border-b border-line px-3 py-2.5 font-medium">Transaction</th>
                <th className="border-b border-line px-3 py-2.5 font-medium">Linked</th>
                <th className="border-b border-line px-3 py-2.5 text-right font-medium">Lines</th>
                <th className="border-b border-line px-3 py-2.5 text-right font-medium">Amount (Σ DR)</th>
                <th className="border-b border-line py-2.5 pr-5 pl-3 text-right font-medium">Check</th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading && !items
                ? Array.from({ length: 10 }, (_, i) => (
                    <tr key={i}>
                      <td className="border-b border-line py-3 pl-4" />
                      {Array.from({ length: 6 }, (__, j) => (
                        <td key={j} className="border-b border-line px-3 py-3">
                          <Skeleton className={cn('h-3.5', j === 1 ? 'w-48' : 'w-20', j >= 3 && 'ml-auto')} />
                        </td>
                      ))}
                    </tr>
                  ))
                : items?.map((t) => <TxRow key={t.id} t={t} open={open.has(t.id)} onToggle={() => toggle(t.id)} names={allNames} />)}
            </tbody>
          </table>
          {!list.isLoading && items && items.length === 0 && (
            <EmptyState icon={<BookOpen />} title={filtered ? 'No transactions match' : 'No transactions yet'} description={filtered ? 'Try another kind, ledger account or search term.' : 'Postings appear as payments, orders and refunds happen.'} />
          )}
        </div>
      )}
      {list.data && list.data.total > 0 && <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={(p) => update({ page: String(p) }, true)} />}
    </Card>
  )
}

function FilterChip({ label, onClear }: { label: ReactNode; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface py-0.5 pr-1 pl-2.5 text-[12px]">
      {label}
      <button type="button" onClick={onClear} className="grid size-4.5 place-items-center rounded-full text-fg-3 hover:bg-surface-3 hover:text-fg" aria-label="Clear filter">
        <X className="size-3" />
      </button>
    </span>
  )
}

function TxRow({ t, open, onToggle, names }: { t: LedgerTxRow; open: boolean; onToggle: () => void; names: Record<string, string> }) {
  const debits = t.entries.filter((e) => e.direction === 'debit').reduce((a, e) => a + e.amount, 0) as Micros
  const credits = t.entries.filter((e) => e.direction === 'credit').reduce((a, e) => a + e.amount, 0) as Micros
  const balanced = debits === credits
  const tone = KIND_TONE[t.kind]
  return (
    <Fragment>
      <tr onClick={onToggle} className={cn('group cursor-pointer transition-colors hover:bg-surface-2/60', open && 'bg-surface-2/50')}>
        <td className="border-b border-line py-2.5 pl-4 align-middle">
          <ChevronRight className={cn('size-4 text-fg-3 transition-transform', open && 'rotate-90 text-fg')} />
        </td>
        <td className="border-b border-line px-3 py-2.5 align-middle">
          <div className="text-[12.5px] whitespace-nowrap text-fg-2">{dateTime(t.at)}</div>
          <div className="font-mono text-[11px] text-fg-3">{t.ref}</div>
        </td>
        <td className="border-b border-line px-3 py-2.5 align-middle">
          <div className="flex items-center gap-2">
            <Badge tone={tone ?? 'neutral'} variant={tone ? 'soft' : 'outline'}>
              {ledgerKindLabel(t.kind)}
            </Badge>
          </div>
          <div className="mt-0.5 max-w-[340px] truncate text-[11.5px] text-fg-3">{t.description}</div>
        </td>
        <td className="border-b border-line px-3 py-2.5 align-middle text-[12px]" onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-col gap-0.5">
            {t.orderId && (
              <Link to={`/admin/orders/${t.orderId}`} className="font-mono text-accent-ink hover:underline">
                {t.orderRef ?? 'Order'}
              </Link>
            )}
            {t.accountId && (
              <Link to={`/admin/accounts/${t.accountId}`} className="truncate text-fg-2 hover:text-accent-ink hover:underline">
                {t.accountName ?? t.accountId}
              </Link>
            )}
            {t.supplierId && (
              <Link to={`/admin/finance/reconciliation?supplier=${t.supplierId}`} className="truncate text-fg-2 hover:text-accent-ink hover:underline">
                {names[t.supplierId] ?? t.supplierId}
              </Link>
            )}
            {!t.orderId && !t.accountId && !t.supplierId && <span className="text-fg-3">—</span>}
          </div>
        </td>
        <td className="border-b border-line px-3 py-2.5 text-right align-middle font-mono text-[12px] text-fg-3 tabular">{t.entries.length}</td>
        <td className="border-b border-line px-3 py-2.5 text-right align-middle">
          <Money value={debits} className="font-mono text-[12.5px] font-medium" />
        </td>
        <td className="border-b border-line py-2.5 pr-5 pl-3 text-right align-middle">
          <Badge tone={balanced ? 'success' : 'danger'}>{balanced ? 'Balanced' : 'Unbalanced'}</Badge>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} className="border-b border-line bg-surface-2/30 px-4 py-3 sm:px-6">
            <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
              <LedgerEntries tx={t} names={names} showHeader={false} className="bg-surface" />
              <dl className="grid content-start gap-1.5 text-[12px]">
                <Meta label="Idempotency key" value={<span className="font-mono break-all">{t.idempotencyKey}</span>} />
                <Meta label="Actor" value={`${t.actor.name}${t.actor.role ? ` · ${t.actor.role}` : ''} (${t.actor.type})`} />
                {t.reason && <Meta label="Reason" value={t.reason} />}
                {t.paymentIntentId && (
                  <Meta
                    label="Payment"
                    value={
                      <Link to={`/admin/finance/payments?intent=${t.paymentIntentId}`} className="font-mono text-accent-ink hover:underline">
                        {t.paymentIntentId}
                      </Link>
                    }
                  />
                )}
                {t.refundId && <Meta label="Refund" value={<span className="font-mono">{t.refundId}</span>} />}
                <Meta label="Debits / credits" value={<span className="font-mono tabular"><Money value={debits} /> = <Money value={credits} /></span>} />
              </dl>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  )
}

function Meta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-fg-3">{label}</dt>
      <dd className="min-w-0 text-fg-2">{value}</dd>
    </div>
  )
}
