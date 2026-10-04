import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { motion } from 'motion/react'
import { Boxes, CircleSlash, LayoutGrid, Plus, Rows3, ShieldAlert, Store, TriangleAlert } from 'lucide-react'
import { Badge, Button, Card, DataTable, EmptyState, PageHeader, SearchInput, Segmented, Select, Skeleton, StatusBadge, Tooltip, type Column } from '@/components/ui'
import { ServiceIcon } from '@/components/brand'
import { Guarded, MarginGuardBadge, Money } from '@/components/domain'
import { useCategories, useServices, useSuppliers } from '@/hooks/installation'
import type { ServiceRow } from '@/types/installation'
import { cn } from '@/lib/cn'
import { num } from '@/lib/format'
import { ErrorPanel } from '../catalog/kit'
import { PROCESSING_LABEL, turnaroundLabel } from '../catalog/helpers'
import { NewServiceModal } from './NewServiceModal'

type View = 'table' | 'grid'

export default function ServicesPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(false)
  const categoryId = params.get('category') ?? ''
  const status = params.get('status') ?? ''
  const availability = params.get('availability') ?? ''
  const supplierId = params.get('supplier') ?? ''
  const search = params.get('q') ?? ''
  const view = (params.get('view') as View) || 'table'

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }

  const categories = useCategories()
  const suppliers = useSuppliers()
  const q = useMemo(() => ({ categoryId: categoryId || undefined, status: status || undefined, availability: availability || undefined, supplierId: supplierId || undefined, search: search || undefined }), [categoryId, status, availability, supplierId, search])
  const services = useServices(q)
  const all = useServices()

  const rows = services.data
  const totals = useMemo(() => {
    const a = all.data ?? []
    return {
      total: a.length,
      active: a.filter((r) => r.service.status === 'active').length,
      unavailable: a.filter((r) => !r.available && r.service.status === 'active').length,
      margin: a.filter((r) => r.retail.guard === 'negative_margin' || r.retail.guard === 'low_margin').length,
      drafts: a.filter((r) => r.service.status === 'draft').length,
    }
  }, [all.data])

  const columns: Column<ServiceRow>[] = [
    {
      key: 'name',
      header: 'Service',
      sortValue: (r) => r.service.name,
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          <ServiceIcon icon={r.service.icon} size="sm" />
          <div className="min-w-0">
            <div className="truncate font-medium text-fg">{r.service.name}</div>
            <div className="flex items-center gap-1.5 text-[11.5px] text-fg-3">
              <span className="font-mono">#{r.service.code}</span>
              <span>·</span>
              <span className="truncate">{r.categoryName}</span>
              {r.service.status !== 'active' && <StatusBadge status={r.service.status} className="ml-1" />}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'processing',
      header: 'Processing',
      hideBelow: 'lg',
      cell: (r) => (
        <div className="text-[12.5px]">
          <div className="text-fg-2">{PROCESSING_LABEL[r.service.processing]}</div>
          <div className="text-[11.5px] text-fg-3">{turnaroundLabel(r.service.turnaround)}</div>
        </div>
      ),
    },
    {
      key: 'offers',
      header: 'Offers',
      align: 'center',
      sortValue: (r) => r.routableOffers,
      cell: (r) => <OfferPips routable={r.routableOffers} total={r.offers} />,
    },
    {
      key: 'availability',
      header: 'Availability',
      sortValue: (r) => (r.available ? 1 : 0),
      cell: (r) =>
        r.available ? (
          <Badge tone="success" dot>
            Available
          </Badge>
        ) : (
          <div className="max-w-[220px]">
            <Badge tone={r.service.status === 'active' ? 'danger' : 'neutral'} dot>
              Unavailable
            </Badge>
            <div className="mt-0.5 truncate text-[11.5px] text-fg-3" title={r.unavailableReason ?? ''}>
              {r.unavailableReason}
            </div>
          </div>
        ),
    },
    {
      key: 'retail',
      header: 'Retail price',
      align: 'right',
      sortValue: (r) => r.retail.amount,
      cell: (r) => (
        <div className="flex flex-col items-end gap-0.5">
          <Money value={r.retail.amount} className="font-medium text-fg" />
          {r.retail.guard !== 'ok' ? <MarginGuardBadge guard={r.retail.guard} /> : <span className="text-[11px] text-fg-3">cost <Money value={r.retail.referenceCost} /></span>}
        </div>
      ),
    },
    {
      key: 'orders',
      header: 'Orders 30d',
      align: 'right',
      hideBelow: 'md',
      sortValue: (r) => r.orders30d,
      cell: (r) => <span className="text-fg-2">{num(r.orders30d)}</span>,
    },
  ]

  return (
    <div>
      <PageHeader
        title="Services"
        description="What you sell. Each service has a versioned field schema, priority-ordered supplier offers and calculated tier prices."
        actions={
          <Guarded permission="catalog.manage">
            {(ok) => (
              <Button variant="accent" leading={<Plus />} disabled={!ok} onClick={() => setCreating(true)}>
                New service
              </Button>
            )}
          </Guarded>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryTile label="Services" value={totals.total} sub={`${totals.active} active · ${totals.drafts} draft`} icon={<Boxes />} loading={all.isLoading} />
        <SummaryTile label="Unavailable" value={totals.unavailable} sub="Active, but no routable offer" tone={totals.unavailable ? 'danger' : undefined} icon={<CircleSlash />} loading={all.isLoading} onClick={() => set('availability', availability === 'unavailable' ? '' : 'unavailable')} active={availability === 'unavailable'} />
        <SummaryTile label="Margin warnings" value={totals.margin} sub="Retail price below target" tone={totals.margin ? 'warning' : undefined} icon={<ShieldAlert />} loading={all.isLoading} to="/admin/pricing?guard=negative_margin" />
        <SummaryTile label="On storefront" value={(all.data ?? []).filter((r) => r.service.visibility.storefront && r.service.status === 'active').length} sub="Visible on the website" icon={<Store />} loading={all.isLoading} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[208px_minmax(0,1fr)]">
        {/* Category rail */}
        <nav className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          <RailItem active={!categoryId} onClick={() => set('category', '')} label="All services" count={categories.data?.reduce((a, c) => a + c.services, 0)} />
          <div className="mono-label mt-3 mb-1 hidden px-2.5 lg:block">Categories</div>
          {categories.isLoading && Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-8 w-40 rounded-md lg:w-full" />)}
          {categories.data
            ?.slice()
            .sort((a, b) => a.sort - b.sort)
            .map((c) => <RailItem key={c.id} active={categoryId === c.id} onClick={() => set('category', c.id)} label={c.name} count={c.services} icon={<ServiceIcon icon={c.icon} size="sm" className="size-5! [&_svg]:size-3!" />} />)}
        </nav>

        <div className="min-w-0">
          <Card>
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
              <SearchInput value={search} onChange={(v) => set('q', v)} placeholder="Search name, code or tag…" className="w-full sm:w-64" />
              <Select
                inputSize="sm"
                className="w-[130px]"
                value={status}
                onChange={(e) => set('status', e.target.value)}
                options={[
                  { value: '', label: 'Any status' },
                  { value: 'active', label: 'Active' },
                  { value: 'draft', label: 'Draft' },
                  { value: 'paused', label: 'Paused' },
                  { value: 'archived', label: 'Archived' },
                ]}
              />
              <Select
                inputSize="sm"
                className="w-[150px]"
                value={availability}
                onChange={(e) => set('availability', e.target.value)}
                options={[
                  { value: '', label: 'Any availability' },
                  { value: 'available', label: 'Available' },
                  { value: 'unavailable', label: 'Unavailable' },
                ]}
              />
              <Select inputSize="sm" className="w-[190px]" value={supplierId} onChange={(e) => set('supplier', e.target.value)} options={[{ value: '', label: 'Any supplier' }, ...(suppliers.data ?? []).map((s) => ({ value: s.supplier.id, label: s.supplier.name }))]} />
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[12px] text-fg-3 tabular">{rows ? `${rows.length} shown` : ''}</span>
                <Segmented
                  size="xs"
                  value={view}
                  onChange={(v) => set('view', v === 'table' ? '' : v)}
                  items={[
                    { value: 'table', label: 'Table', icon: <Rows3 /> },
                    { value: 'grid', label: 'Cards', icon: <LayoutGrid /> },
                  ]}
                />
              </div>
            </div>

            {services.isError ? (
              <ErrorPanel error={services.error} onRetry={() => services.refetch()} className="m-4" />
            ) : view === 'table' ? (
              <DataTable
                columns={columns}
                rows={rows}
                rowKey={(r) => r.service.id}
                loading={services.isLoading}
                onRowClick={(r) => navigate(`/admin/services/${r.service.id}`)}
                rowClassName={(r) => (!r.available && r.service.status === 'active' ? 'bg-danger/[0.025]' : undefined)}
                minWidth={760}
                dense
                empty={<NoResults onClear={() => setParams(new URLSearchParams(), { replace: true })} />}
              />
            ) : (
              <div className="p-4">
                {services.isLoading ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }, (_, i) => (
                      <Skeleton key={i} className="h-36 rounded-xl" />
                    ))}
                  </div>
                ) : rows && rows.length === 0 ? (
                  <NoResults onClear={() => setParams(new URLSearchParams(), { replace: true })} />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {rows?.map((r, i) => <ServiceCard key={r.service.id} row={r} index={i} />)}
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      <NewServiceModal open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}

function RailItem({ active, onClick, label, count, icon }: { active: boolean; onClick: () => void; label: string; count?: number; icon?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex h-8 shrink-0 items-center gap-2 rounded-md px-2.5 text-left text-[13px] whitespace-nowrap transition-colors', active ? 'bg-surface-2 font-medium text-fg shadow-[inset_2px_0_0_var(--accent)]' : 'text-fg-2 hover:bg-surface-2/60 hover:text-fg')}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {count != null && <span className="text-[11.5px] text-fg-3 tabular">{count}</span>}
    </button>
  )
}

function SummaryTile({ label, value, sub, icon, tone, loading, onClick, to, active }: { label: string; value: number; sub: string; icon: ReactNode; tone?: 'danger' | 'warning'; loading?: boolean; onClick?: () => void; to?: string; active?: boolean }) {
  const body = (
    <div className={cn('h-full rounded-xl border bg-surface p-3.5 shadow-card transition-colors', active ? 'border-accent/50' : 'border-line', (onClick || to) && 'hover:border-line-strong')}>
      <div className="flex items-center gap-2 text-[12px] text-fg-3 [&_svg]:size-3.5">
        {icon}
        {label}
      </div>
      {loading ? <Skeleton className="mt-2 h-6 w-12" /> : <div className={cn('mt-1.5 font-display text-[22px] leading-none font-semibold tabular', tone === 'danger' && value ? 'text-danger' : tone === 'warning' && value ? 'text-warning' : 'text-fg')}>{num(value)}</div>}
      <div className="mt-1 truncate text-[11.5px] text-fg-3">{sub}</div>
    </div>
  )
  if (to) return <Link to={to}>{body}</Link>
  if (onClick)
    return (
      <button type="button" onClick={onClick} className="text-left">
        {body}
      </button>
    )
  return body
}

function OfferPips({ routable, total }: { routable: number; total: number }) {
  if (!total) return <span className="text-[12px] text-danger">none</span>
  return (
    <Tooltip content={`${routable} of ${total} offers routable at the retail price`}>
      <span className="inline-flex flex-col items-center gap-1">
        <span className="font-mono text-[12px] tabular">
          <span className={routable ? 'text-fg' : 'text-danger'}>{routable}</span>
          <span className="text-fg-3">/{total}</span>
        </span>
        <span className="flex gap-0.5">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={cn('h-1 w-2.5 rounded-full', i < routable ? 'bg-success/80' : 'bg-fg/15')} />
          ))}
        </span>
      </span>
    </Tooltip>
  )
}

function ServiceCard({ row: r, index }: { row: ServiceRow; index: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 12) * 0.02 }}>
      <Link to={`/admin/services/${r.service.id}`} className={cn('flex h-full flex-col rounded-xl border bg-surface p-4 shadow-card transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-pop', !r.available && r.service.status === 'active' ? 'border-danger/30' : 'border-line')}>
        <div className="flex items-start gap-3">
          <ServiceIcon icon={r.service.icon} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-semibold">{r.service.name}</div>
            <div className="text-[11.5px] text-fg-3">
              <span className="font-mono">#{r.service.code}</span> · {r.categoryName}
            </div>
          </div>
          {r.service.status !== 'active' && <StatusBadge status={r.service.status} />}
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <div className="mono-label">Retail</div>
            <Money value={r.retail.amount} className="font-display text-[20px] font-semibold" />
          </div>
          <OfferPips routable={r.routableOffers} total={r.offers} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
          {r.available ? (
            <Badge tone="success" dot>
              Available
            </Badge>
          ) : (
            <Badge tone="danger" dot icon={<TriangleAlert />} title={r.unavailableReason ?? ''}>
              {r.unavailableReason ?? 'Unavailable'}
            </Badge>
          )}
          {r.retail.guard !== 'ok' && <MarginGuardBadge guard={r.retail.guard} />}
          <span className="ml-auto text-[11.5px] text-fg-3">
            {PROCESSING_LABEL[r.service.processing]} · {num(r.orders30d)} orders
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

function NoResults({ onClear }: { onClear: () => void }) {
  return (
    <EmptyState
      icon={<Boxes />}
      title="No services match"
      description="Try another category or clear the filters."
      action={
        <Button size="sm" onClick={onClear}>
          Clear filters
        </Button>
      }
    />
  )
}
