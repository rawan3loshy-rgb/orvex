import { Fragment, useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { Boxes, Layers, LayoutGrid, PackageSearch, Plus, Rows3, SlidersHorizontal, Timer, TrendingUp, Zap } from 'lucide-react'
import { ProviderMark, ServiceIcon, categoryColor } from '@/components/brand'
import { Button, Card, DataTable, DemoTag, EmptyState, PageHeader, SearchInput, Segmented, Select, Skeleton, StatusBadge, Tooltip, type Column } from '@/components/ui'
import { useMappings, useServices } from '@/hooks/installation'
import { cn } from '@/lib/cn'
import { money, num, pct, plural } from '@/lib/format'
import type { DeliveryType, Service, ServiceCategory, ServiceMapping } from '@/types/installation'
import { NewServiceModal } from './components/ServiceForms'
import { CATEGORIES, CATEGORY_META, DELIVERY, MarginBar, MetricStrip, SERVICE_STATUSES, STATUS_META, groupBy, margin, turnaroundLabel, useProviderMap } from './components/shared'

type View = 'grid' | 'table'

function readView(): View {
  try {
    return (localStorage.getItem('orvex.services.view') as View) || 'grid'
  } catch {
    return 'grid'
  }
}

/** Turnaround span and delivery mode across a set of services (for group headers / KPIs). */
function deliverySpan(list: Service[]) {
  if (!list.length) return null
  const modes = new Set(list.map((s) => s.delivery))
  const min = Math.min(...list.map((s) => s.turnaround.min))
  const max = Math.max(...list.map((s) => s.turnaround.max))
  const mode = modes.size === 1 ? DELIVERY[list[0]!.delivery].label : 'Mixed'
  return { mode, range: turnaroundLabel({ min, max }), icon: modes.size === 1 && list[0]!.delivery === 'instant' ? Zap : Timer }
}

function avgMargin(list: Service[]) {
  const ms = list.filter((s) => s.primaryCost > 0).map((s) => margin(s.price, s.primaryCost).pct)
  return ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : null
}

export default function ServicesPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [providerId, setProviderId] = useState('')
  const [delivery, setDelivery] = useState('')
  const [view, setViewState] = useState<View>(readView)
  const [creating, setCreating] = useState(false)
  const q = useDeferredValue(search)

  const setView = (v: View) => {
    setViewState(v)
    try {
      localStorage.setItem('orvex.services.view', v)
    } catch {
      /* storage unavailable */
    }
  }

  const all = useServices()
  const filtered = useServices({ search: q || undefined, category: category || undefined, status: status || undefined, providerId: providerId || undefined, delivery: delivery || undefined })
  const mappings = useMappings()
  const { map: providers, data: providerList } = useProviderMap()
  const byService = useMemo(() => groupBy(mappings.data, (m) => m.serviceId), [mappings.data])

  const activeFilters = [category, status, providerId, delivery].filter(Boolean).length + (search ? 1 : 0)
  const clear = () => {
    setSearch('')
    setCategory('')
    setStatus('')
    setProviderId('')
    setDelivery('')
  }

  const summary = useMemo(() => {
    const list = all.data ?? []
    const active = list.filter((s) => s.status === 'active')
    const avg = avgMargin(active) ?? 0
    const orders = list.reduce((a, s) => a + s.orders30d, 0)
    const weighted = orders ? list.reduce((a, s) => a + margin(s.price, s.primaryCost).pct * s.orders30d, 0) / orders : 0
    const cats = CATEGORIES.map((c) => {
      const items = list.filter((s) => s.category === c)
      return { c, n: items.length, orders: items.reduce((a, s) => a + s.orders30d, 0), margin: avgMargin(items) }
    })
    const instant = list.filter((s) => s.delivery === 'instant')
    const queued = list.filter((s) => s.delivery !== 'instant')
    return { list, active, avg, orders, weighted, cats, instant, queued, asyncSpan: deliverySpan(queued) }
  }, [all.data])

  const rows = filtered.data
  const loading = filtered.isLoading || !providers.size
  const groups = useMemo(() => CATEGORIES.map((c) => ({ c, items: (rows ?? []).filter((s) => s.category === c) })).filter((g) => g.items.length), [rows])
  const shortName = (id: string) => providers.get(id)?.shortName ?? id

  return (
    <div>
      <PageHeader
        icon={<Boxes />}
        title="Service catalog"
        description="Every GSM service your customers can order — IMEI checks, unlocks, server services and codes — priced, validated and routed to one or more suppliers."
        actions={
          <Button variant="accent" leading={<Plus />} onClick={() => setCreating(true)}>
            New service
          </Button>
        }
      />

      <MetricStrip
        className="mb-5"
        cols="grid-cols-2 lg:grid-cols-4"
        loading={all.isLoading}
        items={[
          {
            label: 'Active services',
            icon: <Layers />,
            value: (
              <span>
                {summary.active.length}
                <span className="text-[15px] font-medium text-fg-3"> / {summary.list.length}</span>
              </span>
            ),
            sub: `${summary.list.filter((s) => s.status === 'paused').length} paused · ${summary.list.filter((s) => s.status === 'draft').length} draft · ${summary.list.filter((s) => s.status === 'deprecated').length} deprecated`,
          },
          { label: 'Avg margin vs supplier cost', icon: <TrendingUp />, value: pct(summary.avg), sub: `Order-weighted ${pct(summary.weighted)}`, tone: 'success' },
          { label: 'Orders · 30d', icon: <Boxes />, value: num(summary.orders), sub: `Across ${plural(summary.list.filter((s) => s.orders30d > 0).length, 'service')}` },
          {
            label: 'Delivery mix',
            icon: <Timer />,
            value: (
              <span>
                {summary.instant.length}
                <span className="mx-1 text-[13px] font-medium text-fg-3">instant ·</span>
                {summary.queued.length}
                <span className="ml-1 text-[13px] font-medium text-fg-3">async</span>
              </span>
            ),
            sub: summary.asyncSpan ? `Async turnaround ${summary.asyncSpan.range}` : 'No async services',
          },
        ]}
      />

      <CategoryRail cats={summary.cats} total={summary.list.length} orders={summary.orders} value={category} onChange={setCategory} loading={all.isLoading} />

      {/* Toolbar */}
      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search IMEI checks, unlocks, codes…" className="xl:w-[300px]" />
        <div className="grid flex-1 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <FilterSelect value={status} onChange={setStatus} label="Status" options={SERVICE_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))} />
          <FilterSelect value={providerId} onChange={setProviderId} label="Supplier" options={(providerList ?? []).map((p) => ({ value: p.id, label: p.name }))} />
          <FilterSelect value={delivery} onChange={setDelivery} label="Delivery" options={(Object.keys(DELIVERY) as DeliveryType[]).map((d) => ({ value: d, label: DELIVERY[d].label }))} />
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" onClick={clear} className="col-span-2 sm:col-span-1">
              Clear {activeFilters > 1 ? `${activeFilters} filters` : 'filter'}
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12.5px] text-fg-3 tabular xl:hidden">{rows ? plural(rows.length, 'service') : ''}</span>
          <div className="flex items-center gap-3">
            <span className="hidden text-[12.5px] text-fg-3 tabular xl:inline">{rows ? plural(rows.length, 'service') : ''}</span>
            <Segmented
              value={view}
              onChange={setView}
              items={[
                { value: 'grid', label: 'Grid', icon: <LayoutGrid /> },
                { value: 'table', label: 'Table', icon: <Rows3 /> },
              ]}
            />
          </div>
        </div>
      </div>

      {loading && !rows ? (
        view === 'grid' ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-[280px] rounded-xl" />
            ))}
          </div>
        ) : (
          <Card className="overflow-hidden">
            <ServicesTable rows={undefined} byService={byService} onOpen={() => undefined} loading />
          </Card>
        )
      ) : rows && rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<PackageSearch />}
            title="No services match"
            description={search ? `Nothing in the catalog matches “${search}” with the current filters.` : 'Try a different combination of category, supplier or delivery.'}
            action={
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" leading={<SlidersHorizontal />} onClick={clear}>
                  Reset filters
                </Button>
                <Button variant="ghost" size="sm" leading={<Plus />} onClick={() => setCreating(true)}>
                  New service
                </Button>
              </div>
            }
          />
        </Card>
      ) : view === 'grid' ? (
        <div className={cn('space-y-9', filtered.isFetching && 'opacity-80 transition-opacity')}>
          {groups.map((g, gi) => (
            <CategorySection key={g.c} category={g.c} items={g.items} offset={groups.slice(0, gi).reduce((a, x) => a + x.items.length, 0)}>
              {(s, i) => <ServiceCard service={s} index={i} mappings={byService.get(s.id) ?? []} onOpen={() => navigate(`/admin/services/${s.id}`)} providerName={shortName} />}
            </CategorySection>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <ServicesTable rows={rows} byService={byService} onOpen={(s) => navigate(`/admin/services/${s.id}`)} />
        </Card>
      )}

      <NewServiceModal open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/*  Category rail                                                            */
/* ------------------------------------------------------------------------- */

function CategoryRail({
  cats,
  total,
  orders,
  value,
  onChange,
  loading,
}: {
  cats: { c: ServiceCategory; n: number; orders: number; margin: number | null }[]
  total: number
  orders: number
  value: string
  onChange: (v: string) => void
  loading?: boolean
}) {
  if (loading) {
    return (
      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto sm:grid sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[92px] min-w-[160px] rounded-xl" />
        ))}
      </div>
    )
  }
  return (
    <div role="radiogroup" aria-label="Filter by category" className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 xl:grid-cols-6">
      <RailTile active={!value} onClick={() => onChange('')} label="All services" count={total} orders={orders} bar={<StackBar cats={cats} total={orders} />} icon={<LayoutGrid className="size-3.5 text-fg-3" />} />
      {cats.map((c) => (
        <RailTile
          key={c.c}
          active={value === c.c}
          onClick={() => onChange(value === c.c ? '' : c.c)}
          label={c.c}
          count={c.n}
          orders={c.orders}
          hint={c.margin != null ? `${pct(c.margin, 0)} avg margin` : undefined}
          icon={<span className="size-2 rounded-full" style={{ background: categoryColor(c.c) }} />}
          bar={
            <span className="block h-1 overflow-hidden rounded-full bg-fg/6">
              <motion.span className="block h-full rounded-full" style={{ background: categoryColor(c.c) }} initial={{ width: 0 }} animate={{ width: `${(c.orders / Math.max(1, orders)) * 100}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
            </span>
          }
        />
      ))}
    </div>
  )
}

function StackBar({ cats, total }: { cats: { c: ServiceCategory; orders: number }[]; total: number }) {
  return (
    <Tooltip content={cats.map((c) => `${c.c} ${pct((c.orders / Math.max(1, total)) * 100, 0)}`).join(' · ')} className="flex w-full">
      <span className="flex h-1 w-full gap-px overflow-hidden rounded-full">
        {cats.map((c) => (
          <span key={c.c} className="h-full" style={{ width: `${(c.orders / Math.max(1, total)) * 100}%`, background: categoryColor(c.c) }} />
        ))}
      </span>
    </Tooltip>
  )
}

function RailTile({ active, onClick, label, count, orders, hint, icon, bar }: { active: boolean; onClick: () => void; label: string; count: number; orders: number; hint?: string; icon: ReactNode; bar: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'group flex min-w-[164px] shrink-0 flex-col rounded-xl border bg-surface px-3.5 py-3 text-left shadow-card transition-[border-color,background-color,box-shadow] duration-200 sm:min-w-0',
        active ? 'border-accent/55 bg-accent/[0.035] ring-3 ring-accent/10' : 'border-line hover:border-line-strong hover:bg-surface-2/40',
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] font-medium text-fg">
          {icon}
          <span className="truncate">{label}</span>
        </span>
        <span className={cn('font-mono text-[11px] tabular', active ? 'text-accent-ink' : 'text-fg-3')}>{count}</span>
      </span>
      <span className="mt-2 flex items-baseline gap-1.5">
        <span className="font-display text-[19px] leading-none font-semibold tracking-[-0.02em] tabular">{num(orders)}</span>
        <span className="text-[11px] text-fg-3">orders · 30d</span>
      </span>
      <span className="mt-2.5 block">{bar}</span>
      <span className="mt-1.5 block truncate text-[11px] text-fg-3">{hint ?? 'Share of orders by category'}</span>
    </button>
  )
}

/* ------------------------------------------------------------------------- */
/*  Grouped grid                                                             */
/* ------------------------------------------------------------------------- */

function CategorySection({ category, items, offset, children }: { category: ServiceCategory; items: Service[]; offset: number; children: (s: Service, i: number) => ReactNode }) {
  const span = deliverySpan(items)
  const m = avgMargin(items)
  const orders = items.reduce((a, s) => a + s.orders30d, 0)
  const color = categoryColor(category)
  return (
    <section aria-label={category}>
      <div className="mb-3.5 flex flex-col gap-2 border-b border-line pb-3 md:flex-row md:items-end md:justify-between md:gap-6">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]">
            <span className="h-3.5 w-1 rounded-full" style={{ background: color }} />
            {category}
            <span className="font-mono text-[11.5px] font-normal text-fg-3 tabular">{items.length}</span>
          </h2>
          <p className="mt-0.5 text-[12.5px] text-fg-3">{CATEGORY_META[category].blurb}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-fg-3">
          {span && (
            <span className="flex items-center gap-1.5">
              <span.icon className="size-3.5" />
              {span.mode} · <span className="text-fg-2 tabular">{span.range}</span>
            </span>
          )}
          <span>
            Avg margin <span className={cn('font-medium tabular', m == null ? 'text-fg-3' : m >= 40 ? 'text-success' : 'text-fg')}>{m == null ? '—' : pct(m, 0)}</span>
          </span>
          <span>
            <span className="font-medium text-fg tabular">{num(orders)}</span> orders · 30d
          </span>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((s, i) => <Fragment key={s.id}>{children(s, offset + i)}</Fragment>)}</div>
    </section>
  )
}

function FilterSelect({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: { value: string; label: string }[] }) {
  return (
    <Select
      inputSize="sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      options={[{ value: '', label: `${label}: All` }, ...options]}
      className={cn('sm:w-auto sm:min-w-[140px]', value && '[&_select]:border-accent/40 [&_select]:bg-accent/[0.04] [&_select]:text-fg')}
    />
  )
}

function ProviderStack({ mappings, providerName }: { mappings: ServiceMapping[]; providerName: (id: string) => string }) {
  const sorted = mappings.slice().sort((a, b) => a.priority - b.priority)
  if (!sorted.length) return <span className="text-[12px] text-warning">No supplier mapped</span>
  return (
    <Tooltip content={sorted.map((m) => `P${m.priority} ${providerName(m.providerId)} #${m.externalId}${m.enabled ? '' : ' (disabled)'}`).join(' · ')}>
      <span className="flex min-w-0 items-center gap-2">
        <span className="flex shrink-0 -space-x-1.5">
          {sorted.slice(0, 4).map((m) => (
            <ProviderMark key={m.id} id={m.providerId} size="xs" className={cn('ring-2 ring-surface', !m.enabled && 'opacity-40 grayscale')} />
          ))}
        </span>
        <span className="truncate text-[12px] text-fg-2">{sorted.length === 1 ? providerName(sorted[0]!.providerId) : plural(sorted.length, 'supplier')}</span>
      </span>
    </Tooltip>
  )
}

function ServiceCard({ service: s, index, mappings, onOpen, providerName }: { service: Service; index: number; mappings: ServiceMapping[]; onOpen: () => void; providerName: (id: string) => string }) {
  const m = margin(s.price, s.primaryCost)
  const D = DELIVERY[s.delivery]
  const color = categoryColor(s.category)
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: Math.min(index, 14) * 0.022, ease: [0.16, 1, 0.3, 1] }} className="h-full">
      <motion.div whileHover={{ y: -2 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} className="h-full">
        <Card interactive onClick={onOpen} className="group flex h-full flex-col overflow-hidden" role="link" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity group-hover:opacity-100" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
          <div className="flex items-start gap-3 p-4 pb-2.5">
            <ServiceIcon icon={s.icon} category={s.category} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold tracking-[-0.01em] text-fg">{s.name}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-fg-3">
                <span className="font-mono text-[11.5px]">{s.id}</span>
                <span>·</span>
                <span className="truncate">{s.category}</span>
              </div>
            </div>
            <StatusBadge status={s.status} noPulse />
          </div>
          <p className="line-clamp-2 min-h-[34px] px-4 text-[12.5px] leading-snug text-fg-3">{s.description}</p>
          <div className="mt-3 flex items-center justify-between gap-2 px-4 pb-3.5">
            <ProviderStack mappings={mappings} providerName={providerName} />
            <Tooltip content={`${D.label} delivery · expected turnaround ${turnaroundLabel(s.turnaround)}`}>
              <span className={cn('flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] tabular', s.delivery === 'instant' ? 'bg-fg/6 text-fg-2' : 'bg-surface-3 text-fg-2')}>
                <D.icon className="size-3.5 text-fg-3" />
                {D.label} · {turnaroundLabel(s.turnaround)}
              </span>
            </Tooltip>
          </div>
          <div className="mt-auto border-t border-line px-4 py-3.5">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="text-[11px] text-fg-3">Price</div>
                <div className="font-display text-[17px] font-semibold tracking-[-0.01em] tabular">{money(s.price)}</div>
              </div>
              <div>
                <div className="text-[11px] text-fg-3">Supplier cost</div>
                <div className="font-display text-[17px] font-semibold tracking-[-0.01em] text-fg-2 tabular">{s.primaryCost ? money(s.primaryCost) : '—'}</div>
              </div>
              <div>
                <div className="text-[11px] text-fg-3">Margin</div>
                <div className={cn('font-display text-[17px] font-semibold tracking-[-0.01em] tabular', s.primaryCost ? (m.pct >= 40 ? 'text-success' : m.pct > 0 ? 'text-fg' : 'text-danger') : 'text-fg-3')}>{s.primaryCost ? pct(m.pct, 0) : '—'}</div>
              </div>
            </div>
            <MarginBar price={s.price} cost={s.primaryCost || s.price} className="mt-3" />
          </div>
          <div className="flex items-center justify-between border-t border-line bg-surface-2/40 px-4 py-2.5 text-[12px]">
            <span className="text-fg-3">
              <span className="font-medium text-fg tabular">{num(s.orders30d)}</span> orders · 30d
            </span>
            <span className="text-fg-3">
              <span className={cn('font-medium tabular', !s.orders30d ? 'text-fg-3' : s.successRate30d >= 95 ? 'text-success' : s.successRate30d >= 90 ? 'text-warning' : 'text-danger')}>{s.orders30d ? pct(s.successRate30d) : '—'}</span> success
            </span>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  )
}

/* ------------------------------------------------------------------------- */
/*  Table                                                                    */
/* ------------------------------------------------------------------------- */

function ServicesTable({ rows, byService, onOpen, loading }: { rows: Service[] | undefined; byService: Map<string, ServiceMapping[]>; onOpen: (s: Service) => void; loading?: boolean }) {
  const columns: Column<Service>[] = [
    {
      key: 'name',
      header: 'Service',
      sortValue: (s) => s.name,
      cell: (s) => (
        <div className="flex items-center gap-3">
          <ServiceIcon icon={s.icon} category={s.category} size="sm" />
          <div className="min-w-0">
            <div className="truncate font-medium text-fg">{s.name}</div>
            <div className="font-mono text-[11px] text-fg-3">{s.id}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      sortValue: (s) => CATEGORIES.indexOf(s.category),
      hideBelow: 'md',
      cell: (s) => (
        <span className="flex items-center gap-1.5 whitespace-nowrap text-fg-2">
          <span className="size-1.5 rounded-full" style={{ background: categoryColor(s.category) }} />
          {s.category}
        </span>
      ),
    },
    { key: 'status', header: 'Status', sortValue: (s) => s.status, cell: (s) => <StatusBadge status={s.status} noPulse /> },
    {
      key: 'delivery',
      header: 'Delivery',
      sortValue: (s) => s.turnaround.max,
      hideBelow: 'lg',
      cell: (s) => (
        <span className="whitespace-nowrap text-fg-2 tabular">
          {DELIVERY[s.delivery].label} <span className="text-fg-3">· {turnaroundLabel(s.turnaround)}</span>
        </span>
      ),
    },
    {
      key: 'providers',
      header: 'Suppliers',
      sortValue: (s) => s.providersCount,
      hideBelow: 'md',
      cell: (s) => (
        <span className="flex -space-x-1.5">
          {(byService.get(s.id) ?? [])
            .slice()
            .sort((a, b) => a.priority - b.priority)
            .map((m) => (
              <ProviderMark key={m.id} id={m.providerId} size="xs" className={cn('ring-2 ring-surface', !m.enabled && 'opacity-40 grayscale')} />
            ))}
        </span>
      ),
    },
    { key: 'price', header: 'Price', align: 'right', sortValue: (s) => s.price, cell: (s) => <span className="font-medium">{money(s.price)}</span> },
    { key: 'cost', header: 'Supplier cost', align: 'right', sortValue: (s) => s.primaryCost, hideBelow: 'sm', cell: (s) => <span className="text-fg-2">{s.primaryCost ? money(s.primaryCost) : '—'}</span> },
    {
      key: 'margin',
      header: 'Margin',
      align: 'right',
      sortValue: (s) => margin(s.price, s.primaryCost).pct,
      cell: (s) => {
        const m = margin(s.price, s.primaryCost)
        return <span className={cn('font-medium', s.primaryCost ? (m.pct >= 40 ? 'text-success' : 'text-fg') : 'text-fg-3')}>{s.primaryCost ? pct(m.pct) : '—'}</span>
      },
    },
    { key: 'orders', header: 'Orders 30d', align: 'right', sortValue: (s) => s.orders30d, hideBelow: 'lg', cell: (s) => num(s.orders30d) },
    { key: 'success', header: 'Success', align: 'right', sortValue: (s) => s.successRate30d, hideBelow: 'xl', cell: (s) => <span className="text-fg-2">{s.orders30d ? pct(s.successRate30d) : '—'}</span> },
  ]
  return (
    <>
      <DataTable columns={columns} rows={rows} rowKey={(s) => s.id} onRowClick={onOpen} loading={loading} minWidth={560} defaultSort={{ key: 'orders', dir: 'desc' }} />
      {!loading && (
        <div className="flex items-center gap-2 border-t border-line px-5 py-2.5 text-[11.5px] text-fg-3">
          <DemoTag /> Prices and supplier costs are demo figures in USD.
        </div>
      )}
    </>
  )
}
