import { useDeferredValue, useEffect, useEffectEvent, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { motion } from 'motion/react'
import { Landmark, Plus, Snowflake, TriangleAlert, Users, Wallet } from 'lucide-react'
import type { AccountRow, AccountTier } from '@/types/installation'
import { useAccounts, useAccountsSummary, usePricing } from '@/hooks/installation'
import { Guarded, Money } from '@/components/domain'
import { Button, Card, Checkbox, DataTable, EmptyState, PageHeader, Pagination, SearchInput, Select, Skeleton, Tabs, type Column } from '@/components/ui'
import { num } from '@/lib/format'
import { cn } from '@/lib/cn'
import { CreateAccountModal } from './CreateAccountModal'
import { AccountStatus, LoadError, LowBalanceFlag, PricingTierChip, TierBadge } from './shared'
import { GUEST_META, TIER_META, tierColor } from './helpers'

type TabKey = 'all' | AccountTier | 'guests'
const TAB_KEYS: TabKey[] = ['all', 'retail', 'reseller', 'business', 'api_only', 'guests']
const PAGE_SIZE = 25

const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'frozen', label: 'Frozen' },
  { value: 'pending', label: 'Pending' },
  { value: 'closed', label: 'Closed' },
]

export default function AccountsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab') as TabKey | null
  const tab: TabKey = tabParam && TAB_KEYS.includes(tabParam) ? tabParam : 'all'
  const status = params.get('status') ?? ''
  const pricingTierId = params.get('pricingTierId') ?? ''
  const attention = params.get('attention') === '1'
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1)
  const createOpen = params.get('create') === '1'

  const [search, setSearch] = useState(params.get('search') ?? '')
  const q = useDeferredValue(search.trim())

  const update = (patch: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '') next.delete(k)
      else next.set(k, v)
    }
    if (resetPage && !('page' in patch)) next.delete('page')
    setParams(next, { replace: true })
  }

  const syncSearchToUrl = useEffectEvent((value: string) => {
    if ((params.get('search') ?? '') !== value) update({ search: value || null })
  })
  useEffect(() => {
    syncSearchToUrl(q)
  }, [q])

  const summary = useAccountsSummary()
  const pricing = usePricing()
  const tiers = pricing.data?.tiers

  const query = {
    kind: tab === 'guests' ? 'guest' : tab === 'all' ? undefined : 'customer',
    tier: tab !== 'all' && tab !== 'guests' ? tab : undefined,
    status: status || undefined,
    pricingTierId: pricingTierId || undefined,
    attention: attention || undefined,
    search: q || undefined,
    page,
    pageSize: PAGE_SIZE,
  }
  const list = useAccounts(query)

  const s = summary.data
  const customers = s ? Object.values(s.byTier).reduce((a, b) => a + b, 0) : 0
  const tabItems = TAB_KEYS.map((k) => ({
    value: k,
    label: k === 'all' ? 'All' : k === 'guests' ? 'Guests' : TIER_META[k].label,
    count: s ? (k === 'all' ? s.total : k === 'guests' ? s.guests : (s.byTier[k] ?? 0)) : undefined,
  }))

  const filtered = !!(status || pricingTierId || attention || q)

  const columns: Column<AccountRow>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Account',
        cell: (r) => (
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-fg">{r.account.name}</span>
            </div>
            <div className="truncate font-mono text-[11.5px] text-fg-3">
              {r.account.number} <span className="font-sans">· {r.account.email}</span>
            </div>
          </div>
        ),
      },
      { key: 'tier', header: 'Tier', cell: (r) => <TierBadge account={r.account} /> },
      { key: 'pricing', header: 'Pricing', hideBelow: 'md', cell: (r) => <PricingTierChip name={r.tierName} color={tierColor(tiers, r.account.pricingTierId)} /> },
      {
        key: 'available',
        header: 'Available',
        align: 'right',
        cell: (r) => (
          <div className="flex items-center justify-end gap-2">
            {r.lowBalance && <LowBalanceFlag threshold={<Money value={r.account.lowBalanceAlert} />} />}
            <Money value={r.balance.available} tone="auto" className={cn('font-mono text-[12.5px]', r.lowBalance && 'text-warning')} />
          </div>
        ),
      },
      { key: 'held', header: 'Held', align: 'right', hideBelow: 'sm', cell: (r) => <Money value={r.balance.held} className={cn('font-mono text-[12.5px]', r.balance.held ? 'text-fg-2' : 'text-fg-3')} /> },
      { key: 'credit', header: 'Credit', align: 'right', hideBelow: 'lg', cell: (r) => (r.balance.creditLimit ? <Money value={r.balance.creditLimit} className="font-mono text-[12.5px] text-fg-2" /> : <span className="text-[12px] text-fg-3">Prepaid</span>) },
      { key: 'spendable', header: 'Spendable', align: 'right', hideBelow: 'md', cell: (r) => <Money value={r.balance.spendable} className="font-mono text-[12.5px] font-medium" /> },
      { key: 'orders', header: 'Orders 30d', align: 'right', hideBelow: 'lg', cell: (r) => <span className="tabular text-fg-2">{num(r.orders30d)}</span> },
      { key: 'spend', header: 'Spend 30d', align: 'right', hideBelow: 'xl', cell: (r) => (r.spend30d ? <Money value={r.spend30d} className="font-mono text-[12.5px] text-fg-2" /> : <span className="text-fg-3">—</span>) },
      { key: 'open', header: 'Open', align: 'right', hideBelow: 'xl', cell: (r) => <span className={cn('tabular', r.openOrders ? 'text-fg' : 'text-fg-3')}>{r.openOrders}</span> },
      { key: 'status', header: 'Status', align: 'right', cell: (r) => <AccountStatus account={r.account} /> },
    ],
    [tiers],
  )

  return (
    <div>
      <PageHeader
        icon={<Users />}
        title="Accounts"
        description="One Account model for every buyer — retail customers, resellers, businesses, API-only integrations and guest checkouts. Each has a pricing tier, a ledger-backed wallet, members, API access, channels and limits."
        actions={
          <Guarded permission="accounts.manage">
            {(allowed) => (
              <Button variant="accent" leading={<Plus />} disabled={!allowed} onClick={() => update({ create: '1' }, false)}>
                Create account
              </Button>
            )}
          </Guarded>
        }
      />

      {/* Summary */}
      <div className="mb-5 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="mono-label">Accounts by tier</span>
            <span className="text-[12px] text-fg-3 tabular">{s ? `${num(customers)} customers · ${num(s.guests)} guests` : <Skeleton className="h-3 w-28" />}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(['retail', 'reseller', 'business', 'api_only'] as AccountTier[]).map((t) => (
              <TierTile key={t} icon={TIER_META[t].icon} label={TIER_META[t].label} value={s?.byTier[t] ?? 0} loading={summary.isLoading} active={tab === t} onClick={() => update({ tab: t })} />
            ))}
            <TierTile icon={GUEST_META.icon} label="Guests" value={s?.guests ?? 0} loading={summary.isLoading} active={tab === 'guests'} onClick={() => update({ tab: 'guests' })} />
          </div>
          <p className="mt-3 text-[11.5px] text-fg-3">Same entity, same wallet, same order pipeline — the tier only changes defaults, channels and pricing.</p>
        </Card>
        <Card className="grid grid-cols-2">
          <SummaryCell className="border-r border-b" icon={<Wallet />} label="Wallet liability" loading={summary.isLoading} value={<Money value={s?.walletLiability} />} sub="Σ Customer Available (owed to customers)" />
          <SummaryCell className="border-b" icon={<Landmark />} label="Held for open orders" loading={summary.isLoading} value={<Money value={s?.held} />} sub="Σ Customer Held" />
          <SummaryCell
            className="border-r"
            icon={<Snowflake />}
            label="Frozen"
            loading={summary.isLoading}
            value={num(s?.frozen ?? 0)}
            tone={s?.frozen ? 'danger' : undefined}
            sub={
              <button type="button" className="text-accent-ink hover:underline" onClick={() => update({ status: 'frozen', tab: null })}>
                Show frozen
              </button>
            }
          />
          <SummaryCell
            icon={<TriangleAlert />}
            label="Pending approval"
            loading={summary.isLoading}
            value={num(s?.pending ?? 0)}
            tone={s?.pending ? 'warning' : undefined}
            sub={
              <button type="button" className="text-accent-ink hover:underline" onClick={() => update({ status: 'pending', tab: null })}>
                Show pending
              </button>
            }
          />
        </Card>
      </div>

      <Card className="overflow-hidden">
        <Tabs<TabKey> className="px-3 sm:px-4" items={tabItems} value={tab} onChange={(v) => update({ tab: v === 'all' ? null : v })} />
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:px-5 lg:flex-row lg:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, email, account number, contact…" className="lg:w-[320px]" />
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <Checkbox checked={attention} onChange={(v) => update({ attention: v ? '1' : null })} label="Needs attention" description="Low balance or frozen" className="mr-2" />
            <Select inputSize="sm" className="w-[150px]" value={status} onChange={(e) => update({ status: e.target.value || null })} options={STATUS_OPTIONS} />
            <Select
              inputSize="sm"
              className="w-[170px]"
              value={pricingTierId}
              onChange={(e) => update({ pricingTierId: e.target.value || null })}
              options={[{ value: '', label: 'Any pricing tier' }, ...[...(tiers ?? [])].sort((a, b) => a.sort - b.sort).map((t) => ({ value: t.id, label: `${t.name} · ${t.accounts}` }))]}
            />
          </div>
        </div>

        {list.isError ? (
          <LoadError what="accounts" onRetry={() => list.refetch()} />
        ) : (
          <DataTable
            columns={columns}
            rows={list.data?.items}
            loading={list.isLoading}
            rowKey={(r) => r.account.id}
            onRowClick={(r) => navigate(`/admin/accounts/${r.account.id}`)}
            minWidth={820}
            dense
            rowClassName={(r) => (r.account.status === 'frozen' || r.account.status === 'closed' ? 'opacity-75 hover:opacity-100' : undefined)}
            empty={
              <EmptyState
                icon={<Users />}
                title={filtered ? 'No accounts match these filters' : tab === 'guests' ? 'No guest accounts yet' : 'No accounts in this tier yet'}
                description={filtered ? 'Try a different search, status or pricing tier.' : tab === 'guests' ? 'Guest checkout on the storefront creates a lightweight account so the payment still funds a wallet.' : 'Create an account to give a buyer a wallet, pricing tier and channels.'}
                action={
                  filtered ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSearch('')
                        update({ status: null, pricingTierId: null, attention: null, search: null })
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            }
          />
        )}
        {list.data && list.data.total > 0 && <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={(p) => update({ page: String(p) }, false)} />}
      </Card>

      <p className="mt-3 text-[11.5px] text-fg-3">Balances are projections of the double-entry ledger, recomputed from postings — never a stored number. Spendable = available + credit limit.</p>

      <CreateAccountModal open={createOpen} onClose={() => update({ create: null }, false)} />
    </div>
  )
}

function TierTile({ icon: Icon, label, value, loading, active, onClick }: { icon: typeof Users; label: string; value: number; loading?: boolean; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('rounded-lg border px-3 py-2.5 text-left transition-colors', active ? 'border-accent/50 bg-accent/[0.06]' : 'border-line hover:border-line-strong hover:bg-surface-2')}
    >
      <div className="flex items-center gap-1.5 text-[12px] text-fg-3">
        <Icon className={cn('size-3.5', active && 'text-accent-ink')} />
        {label}
      </div>
      {loading ? <Skeleton className="mt-2 h-5 w-8" /> : <div className="mt-1 font-display text-[20px] leading-tight font-semibold tabular">{num(value)}</div>}
    </button>
  )
}

function SummaryCell({ label, value, sub, loading, className, icon, tone }: { label: string; value: ReactNode; sub?: ReactNode; loading?: boolean; className?: string; icon?: ReactNode; tone?: 'danger' | 'warning' }) {
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className={cn('min-w-0 border-line px-4 py-3.5 sm:px-5', className)}>
      <div className="flex items-center gap-1.5 text-fg-3 [&_svg]:size-3.5">
        {icon}
        <span className="mono-label">{label}</span>
      </div>
      {loading ? <Skeleton className="mt-2.5 h-6 w-24" /> : <div className={cn('mt-2 font-display text-[21px] leading-none font-semibold tracking-[-0.02em] tabular', tone === 'danger' && 'text-danger', tone === 'warning' && 'text-warning')}>{value}</div>}
      <div className="mt-1.5 truncate text-[11.5px] text-fg-3">{sub}</div>
    </motion.div>
  )
}
