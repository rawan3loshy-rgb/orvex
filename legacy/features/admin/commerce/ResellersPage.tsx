import { useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { motion } from 'motion/react'
import { BookOpen, KeyRound, Plus, TriangleAlert, Users } from 'lucide-react'
import { usePricingGroups, useResellers } from '@/hooks/installation'
import type { Reseller, ResellerStatus } from '@/types/installation'
import { Button, Card, DataTable, DemoTag, EmptyState, PageHeader, SearchInput, Segmented, Select, Skeleton, StatusBadge, Tooltip, type Column } from '@/components/ui'
import { money, num, relative } from '@/lib/format'
import { cn } from '@/lib/cn'
import { LoadError } from '@/features/admin/developer/shared'
import { CreateResellerModal } from './resellers/CreateResellerModal'
import { CountryTag, GroupChip, LOW_BALANCE, ResellerAvatar, STATUS_OPTIONS, SuccessRate, discountLabel, isLowBalance } from './resellers/shared'

type StatusFilter = 'all' | ResellerStatus

export default function ResellersPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [groupId, setGroupId] = useState('all')
  const q = useDeferredValue(search)

  const groups = usePricingGroups()
  const all = useResellers()
  const list = useResellers({ search: q || undefined, status, groupId })
  const groupById = useMemo(() => new Map((groups.data ?? []).map((g) => [g.id, g])), [groups.data])

  const createOpen = params.get('create') === '1'
  const setCreate = (open: boolean) => {
    const next = new URLSearchParams(params)
    if (open) next.set('create', '1')
    else next.delete('create')
    setParams(next, { replace: true })
  }

  const summary = useMemo(() => {
    const rs = all.data ?? []
    return {
      active: rs.filter((r) => r.status === 'active').length,
      pending: rs.filter((r) => r.status === 'pending').length,
      suspended: rs.filter((r) => r.status === 'suspended').length,
      total: rs.length,
      balances: rs.reduce((a, r) => a + r.balance, 0),
      low: rs.filter(isLowBalance).length,
      spend30d: rs.reduce((a, r) => a + r.spend30d, 0),
      orders30d: rs.reduce((a, r) => a + r.orders30d, 0),
      credit: rs.reduce((a, r) => a + r.creditLimit, 0),
    }
  }, [all.data])

  const counts: Record<StatusFilter, number> = { all: summary.total, active: summary.active, pending: summary.pending, suspended: summary.suspended }
  const filtered = search || status !== 'all' || groupId !== 'all'

  const columns: Column<Reseller>[] = [
    {
      key: 'name',
      header: 'Reseller',
      sortValue: (r) => r.name,
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          <ResellerAvatar reseller={r} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-fg">{r.name}</span>
              <CountryTag code={r.country} short className="hidden sm:inline-flex" />
            </div>
            <div className="truncate text-[12px] text-fg-3">{r.email}</div>
          </div>
        </div>
      ),
    },
    { key: 'status', header: 'Status', sortValue: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
    { key: 'group', header: 'Pricing group', hideBelow: 'md', sortValue: (r) => groupById.get(r.pricingGroupId)?.name ?? '', cell: (r) => <GroupChip group={groupById.get(r.pricingGroupId)} /> },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      sortValue: (r) => r.balance,
      cell: (r) => {
        const low = isLowBalance(r)
        return (
          <div className="flex flex-col items-end">
            <span className={cn('inline-flex items-center gap-1.5 font-medium tabular', low ? 'text-warning' : r.balance < 0 ? 'text-danger' : 'text-fg')}>
              {low && (
                <Tooltip content={`Below the ${money(LOW_BALANCE)} low-balance threshold`}>
                  <TriangleAlert className="size-3.5" />
                </Tooltip>
              )}
              {money(r.balance)}
            </span>
            <span className="text-[11.5px] text-fg-3 tabular">{r.creditLimit ? `${money(r.creditLimit, { compact: true })} credit` : 'Prepaid only'}</span>
          </div>
        )
      },
    },
    {
      key: 'orders',
      header: 'Orders',
      align: 'right',
      hideBelow: 'lg',
      sortValue: (r) => r.orders30d,
      cell: (r) => (
        <div className="flex flex-col items-end">
          <span className="tabular text-fg">{num(r.orders30d)}</span>
          <span className="text-[11.5px] text-fg-3 tabular">{num(r.ordersTotal)} total</span>
        </div>
      ),
    },
    { key: 'spend', header: 'Spend 30d', align: 'right', sortValue: (r) => r.spend30d, hideBelow: 'sm', cell: (r) => <span className="tabular">{r.spend30d ? money(r.spend30d) : <span className="text-fg-3">—</span>}</span> },
    { key: 'success', header: 'Success', align: 'right', hideBelow: 'lg', sortValue: (r) => r.successRate30d, cell: (r) => <SuccessRate value={r.successRate30d} /> },
    {
      key: 'keys',
      header: 'Keys',
      align: 'right',
      hideBelow: 'xl',
      sortValue: (r) => r.apiKeysCount,
      cell: (r) => (
        <span className={cn('inline-flex items-center gap-1 tabular', r.apiKeysCount ? 'text-fg-2' : 'text-fg-3')}>
          <KeyRound className="size-3 text-fg-3" />
          {r.apiKeysCount}
        </span>
      ),
    },
    { key: 'active', header: 'Last active', align: 'right', hideBelow: 'md', sortValue: (r) => new Date(r.lastActiveAt).getTime(), cell: (r) => <span className="text-[12.5px] whitespace-nowrap text-fg-2">{relative(r.lastActiveAt)}</span> },
  ]

  return (
    <div>
      <PageHeader
        icon={<Users />}
        title="Resellers"
        description="GSM shops, repair chains and distributors ordering IMEI checks, unlocks and codes through the Reseller API — each with a prepaid balance, pricing group, limits and keys."
        actions={
          <>
            <Button variant="ghost" to="/admin/developer/api" leading={<BookOpen />}>
              API reference
            </Button>
            <Button variant="accent" leading={<Plus />} onClick={() => setCreate(true)}>
              Add reseller
            </Button>
          </>
        }
      />

      {/* Summary strip */}
      <Card className="mb-5 grid grid-cols-2 lg:grid-cols-4">
        <SummaryItem className="border-r border-b lg:border-b-0" loading={all.isLoading} label="Active resellers" value={num(summary.active)} sub={`${summary.pending} pending · ${summary.suspended} suspended`} />
        <SummaryItem
          className="border-b lg:border-r lg:border-b-0"
          loading={all.isLoading}
          label="Total balances"
          value={money(summary.balances, { compact: true })}
          sub={
            summary.low ? (
              <span className="inline-flex items-center gap-1 text-warning">
                <TriangleAlert className="size-3" /> {summary.low} below {money(LOW_BALANCE)}
              </span>
            ) : (
              `${money(summary.credit, { compact: true })} credit extended`
            )
          }
        />
        <SummaryItem className="border-r" loading={all.isLoading} label="Spend · 30 days" value={money(summary.spend30d, { compact: true })} sub="Completed orders, after group pricing" demo />
        <SummaryItem loading={all.isLoading} label="Orders · 30 days" value={num(summary.orders30d)} sub={`${num(Math.round(summary.orders30d / 30))} per day on average`} />
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:px-5 lg:flex-row lg:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Search shop, email, reseller ID or country…" className="lg:w-[300px]" />
          <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
            <Segmented<StatusFilter> value={status} onChange={setStatus} items={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label, count: all.data ? counts[o.value] : undefined }))} />
          </div>
          <Select inputSize="sm" className="lg:ml-auto lg:w-[200px]" value={groupId} onChange={(e) => setGroupId(e.target.value)} options={[{ value: 'all', label: 'All pricing groups' }, ...(groups.data ?? []).map((g) => ({ value: g.id, label: `${g.name} · ${discountLabel(g.discountPercent)}` }))]} />
        </div>
        {list.isError ? (
          <LoadError what="resellers" onRetry={() => list.refetch()} />
        ) : (
          <DataTable
            columns={columns}
            rows={list.data}
            loading={list.isLoading}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/admin/resellers/${r.id}`)}
            minWidth={760}
            defaultSort={{ key: 'spend', dir: 'desc' }}
            rowClassName={(r) => (r.status === 'suspended' ? 'opacity-70 hover:opacity-100' : undefined)}
            empty={
              <EmptyState
                icon={<Users />}
                title={filtered ? 'No resellers match these filters' : 'No resellers yet'}
                description={filtered ? 'Try a different search term, status or pricing group.' : 'Add your first GSM shop or distributor to give them Reseller API access with their own balance and pricing.'}
                action={
                  filtered ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSearch('')
                        setStatus('all')
                        setGroupId('all')
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : (
                    <Button size="sm" variant="accent" leading={<Plus />} onClick={() => setCreate(true)}>
                      Add reseller
                    </Button>
                  )
                }
              />
            }
          />
        )}
        {list.data && list.data.length > 0 && (
          <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[12.5px] text-fg-3">
            <span className="tabular">
              {list.data.length} of {summary.total} resellers
            </span>
            <span className="hidden sm:inline">Click a reseller to manage balance, API keys, allowed services and limits</span>
          </div>
        )}
      </Card>

      <CreateResellerModal open={createOpen} onClose={() => setCreate(false)} />
    </div>
  )
}

function SummaryItem({ label, value, sub, loading, className, demo }: { label: string; value: ReactNode; sub?: ReactNode; loading?: boolean; className?: string; demo?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className={cn('min-w-0 border-line px-4 py-4 sm:px-5', className)}>
      <div className="flex items-center gap-2">
        <span className="mono-label">{label}</span>
        {demo && <DemoTag className="hidden sm:inline-flex" />}
      </div>
      {loading ? <Skeleton className="mt-2.5 h-6 w-24" /> : <div className="mt-2 font-display text-[22px] leading-none font-semibold tracking-[-0.02em] text-fg tabular sm:text-[24px]">{value}</div>}
      <div className="mt-2 truncate text-[12px] text-fg-3">{loading ? <Skeleton className="h-3 w-32" /> : sub}</div>
    </motion.div>
  )
}
