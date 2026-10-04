import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Inbox, LoaderCircle, Plus, ReceiptText, RotateCcw, X } from 'lucide-react'
import { ServiceIcon, categoryColor } from '@/components/brand'
import { Button, Card, DataTable, Dot, EmptyState, PageHeader, Pagination, SearchInput, Segmented, Select, StatusBadge, Tabs, Tooltip, type Column } from '@/components/ui'
import { useOrderStats, useOrders, useProviders, useResellers, useServices } from '@/hooks/installation'
import { cn } from '@/lib/cn'
import { dateTime, money, num, relative } from '@/lib/format'
import type { OrderChannel, OrderQuery, OrderRow, OrderStatus, ServiceCategory } from '@/types/installation'
import { CreateOrderModal } from './CreateOrderModal'
import { CATEGORY_ORDER, deviceOf, marginOf, useArrivals, useDebounced } from './lib'
import { ClientCell, DeviceCell, LivePill, ProviderCell } from './parts'

/** `held` is a client preset: pending orders whose error code is `held_for_review`. */
type StatusTab = 'all' | 'in_flight' | 'held' | 'success' | 'failed' | 'refunded' | 'cancelled'
type Range = '24h' | '7d' | '30d' | 'all'

const PAGE_SIZE = 25
/** Pending orders are few; one capped page of them is enough to derive the held view with exact paging. */
const HELD_SCAN = 200
const TAB_DEFS: { value: StatusTab; label: string }[] = [
  { value: 'all', label: 'All orders' },
  { value: 'in_flight', label: 'In progress' },
  { value: 'held', label: 'Held for review' },
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'cancelled', label: 'Cancelled' },
]
const CATEGORIES = [{ value: '', label: 'All categories' }, ...CATEGORY_ORDER.map((c) => ({ value: c, label: c }))]

/** URL → status tab. Raw in-flight statuses (created / processing / pending) collapse into "In progress". */
function parseTab(v: string | null): StatusTab {
  if (!v) return 'all'
  if (v === 'created' || v === 'processing' || v === 'pending') return 'in_flight'
  return TAB_DEFS.some((t) => t.value === v) ? (v as StatusTab) : 'all'
}
const parseRange = (v: string | null): Range => (v === '24h' || v === '7d' || v === '30d' ? v : 'all')
const parseCategory = (v: string | null) => (v && (CATEGORY_ORDER as string[]).includes(v) ? (v as ServiceCategory) : '')
const parseChannel = (v: string | null) => (v === 'api' || v === 'website' || v === 'admin' ? v : '')

/** Filters mirrored in the URL (dashboard deep links read and write these). */
type FilterKey = 'status' | 'range' | 'category' | 'serviceId' | 'providerId' | 'resellerId' | 'channel' | 'fallback' | 'search'
const FILTER_KEYS: FilterKey[] = ['status', 'range', 'category', 'serviceId', 'providerId', 'resellerId', 'channel', 'fallback', 'search']

/** A pasted IMEI is usually grouped (`35 693803 564380 9`) — search on the bare digits. */
const normalizeSearch = (s: string) => (/^[\d\s-]{8,}$/.test(s) ? s.replace(/[\s-]/g, '') : s)
const RANGES: { value: Range; label: string }[] = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: 'all', label: 'All' },
]
const CHANNELS = [
  { value: '', label: 'All channels' },
  { value: 'api', label: 'Reseller API' },
  { value: 'website', label: 'Website' },
  { value: 'admin', label: 'Admin' },
]

export default function OrdersPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  /* ---- Filters live in the URL so dashboard deep links (and back/forward) restore the view. ---- */
  const tab = parseTab(params.get('status'))
  const range = parseRange(params.get('range'))
  const category = parseCategory(params.get('category'))
  const serviceId = params.get('serviceId') ?? ''
  const providerId = params.get('providerId') ?? ''
  /** Orders that needed more than one supplier attempt (`fallback=1`). */
  const fallback = params.get('fallback') === '1' || params.get('fallback') === 'true'
  const resellerId = params.get('resellerId') ?? ''
  const channel = parseChannel(params.get('channel'))
  const urlSearch = params.get('search') ?? ''

  /** Write one or more filters to the URL; defaults are removed to keep links short. */
  const setFilters = (patch: Partial<Record<FilterKey, string>>) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        for (const [k, v] of Object.entries(patch)) {
          if (!v || v === 'all') next.delete(k)
          else next.set(k, v)
        }
        return next
      },
      { replace: true },
    )
  const setFilter = (key: FilterKey) => (v: string) => setFilters({ [key]: v })

  // Search is typed locally and mirrored to the URL once debounced.
  const [search, setSearch] = useState(urlSearch)
  const q = useDebounced(normalizeSearch(search.trim()), 250)
  const written = useRef(urlSearch)
  useEffect(() => {
    if (q === urlSearch) return
    written.current = q
    setFilters({ search: q })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])
  useEffect(() => {
    // Our own debounced write coming back — keep whatever the user has typed since.
    if (urlSearch === written.current) return
    // External navigation (e.g. a dashboard link) replaced the search — adopt it.
    written.current = urlSearch
    setSearch(urlSearch)
  }, [urlSearch])

  // Page resets whenever the filter set changes (no stale-page request in between).
  const filterKey = FILTER_KEYS.map((k) => (k === 'search' ? urlSearch : (params.get(k) ?? ''))).join('|')
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 })
  const page = pageState.key === filterKey ? pageState.page : 1
  const setPage = (p: number) => setPageState({ key: filterKey, page: p })

  const [live, setLive] = useState(true)
  const held = tab === 'held'

  const filters = useMemo(
    (): OrderQuery => ({
      search: urlSearch || undefined,
      // A specific service always wins over its category.
      category: !serviceId && category ? category : undefined,
      serviceId: serviceId || undefined,
      providerId: providerId || undefined,
      resellerId: resellerId || undefined,
      channel: (channel || undefined) as OrderChannel | undefined,
      range: range === 'all' ? undefined : range,
      fallback: fallback || undefined,
    }),
    [urlSearch, category, serviceId, providerId, resellerId, channel, range, fallback],
  )
  // "Held for review" has no server status of its own: scan the (small) pending set with every
  // other filter applied server-side, then filter and page it here — totals stay exact.
  const query = useMemo(
    (): OrderQuery =>
      held
        ? { ...filters, status: 'pending', page: 1, pageSize: HELD_SCAN }
        : { ...filters, status: (tab === 'all' ? undefined : tab) as OrderStatus | 'in_flight' | undefined, page, pageSize: PAGE_SIZE },
    [filters, held, tab, page],
  )

  const orders = useOrders(query, { live })
  const heldCount = useOrders({ status: 'pending', page: 1, pageSize: HELD_SCAN }, { live: live && held })
  const stats = useOrderStats()
  const services = useServices()
  const providers = useProviders()
  const resellers = useResellers()

  const shortName = useMemo(() => new Map((providers.data ?? []).map((p) => [p.id, p.shortName])), [providers.data])
  const serviceOptions = useMemo(
    () => (services.data ?? []).filter((s) => !category || s.category === category).map((s) => ({ value: s.id, label: s.name })),
    [services.data, category],
  )

  const heldRows = useMemo(() => (held ? (orders.data?.items ?? []).filter((o) => o.error?.code === 'held_for_review') : null), [held, orders.data])
  const rows = held ? (orders.data ? heldRows!.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : undefined) : orders.data?.items
  const total = held ? (heldRows?.length ?? 0) : (orders.data?.total ?? 0)
  const heldTotal = heldCount.data ? heldCount.data.items.filter((o) => o.error?.code === 'held_for_review').length : undefined

  const arrivals = useArrivals(rows, (o) => o.id, { enabled: live && page === 1, scope: JSON.stringify({ ...query, tab, page: 0 }), placeholder: orders.isPlaceholderData })

  const pickCategory = (c: string) =>
    // Keep the selected service only if it belongs to the new category.
    setFilters({ category: c, ...(c && serviceId && services.data?.find((s) => s.id === serviceId)?.category !== c ? { serviceId: '' } : {}) })
  const activeFilters = [urlSearch, category, serviceId, providerId, resellerId, channel, range !== 'all' ? range : '', fallback ? '1' : ''].filter(Boolean).length
  const clearFilters = () => {
    setSearch('')
    setFilters({ search: '', category: '', serviceId: '', providerId: '', resellerId: '', channel: '', range: '', fallback: '' })
  }

  const createOpen = params.get('create') === '1'
  const setCreate = (open: boolean) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        if (open) next.set('create', '1')
        else next.delete('create')
        return next
      },
      { replace: !open },
    )

  const columns: Column<OrderRow>[] = useMemo(
    () => [
      {
        key: 'order',
        header: 'Order',
        width: 'w-[150px]',
        cell: (o) => (
          <div className="min-w-0">
            <div className="font-mono text-[12.5px] font-medium text-fg">#{o.number}</div>
            <div className="truncate font-mono text-[11px] text-fg-3">{o.clientReference ?? 'no reference'}</div>
          </div>
        ),
      },
      {
        key: 'service',
        header: 'Service',
        cell: (o) => {
          const s = services.data?.find((x) => x.id === o.serviceId)
          const d = deviceOf(o.input)
          return (
            <span className="flex min-w-0 items-center gap-2.5">
              <ServiceIcon icon={s?.icon ?? 'box'} category={o.serviceCategory} size="sm" />
              <span className="min-w-0">
                <span className="block truncate font-medium text-fg">{o.serviceName}</span>
                {/* Below lg the device column is hidden — keep the IMEI under the service name. */}
                {d && <span className="block truncate font-mono text-[11px] text-fg-3 tabular lg:hidden">{d.display}</span>}
              </span>
            </span>
          )
        },
      },
      { key: 'device', header: 'Device', hideBelow: 'lg', width: 'w-[210px]', cell: (o) => <DeviceCell input={o.input} /> },
      { key: 'status', header: 'Status', width: 'w-[120px]', cell: (o) => <StatusBadge status={o.status} /> },
      { key: 'provider', header: 'Supplier', cell: (o) => <ProviderCell order={o} label={o.providerId ? shortName.get(o.providerId) : undefined} />, hideBelow: 'md' },
      { key: 'client', header: 'Client', cell: (o) => <ClientCell order={o} />, hideBelow: 'xl' },
      { key: 'price', header: 'Price', align: 'right', sortValue: (o) => o.price, cell: (o) => <span className="font-medium text-fg">{money(o.price)}</span> },
      {
        key: 'margin',
        header: 'Margin',
        align: 'right',
        hideBelow: 'xl',
        sortValue: (o) => marginOf(o) ?? -Infinity,
        cell: (o) => {
          const m = marginOf(o)
          return m == null ? <span className="text-fg-3/60">—</span> : <span className={cn('text-fg-3', m < 0 && 'text-danger/80')}>{money(m)}</span>
        },
      },
      {
        key: 'created',
        header: 'Created',
        align: 'right',
        width: 'w-[140px]',
        sortValue: (o) => new Date(o.createdAt).getTime(),
        cell: (o) => (
          <Tooltip content={relative(o.createdAt)} placement="left">
            <span className="text-[12.5px] whitespace-nowrap text-fg-2">{dateTime(o.createdAt)}</span>
          </Tooltip>
        ),
      },
    ],
    [services.data, shortName],
  )

  const counts = stats.data
  const tabs = TAB_DEFS.map((t) => ({
    value: t.value,
    label: t.label,
    count: t.value === 'held' ? (heldTotal != null ? num(heldTotal) : undefined) : counts ? num(counts[t.value] ?? 0) : undefined,
    icon: t.value === 'in_flight' && (counts?.in_flight ?? 0) > 0 ? <Dot tone="accent" pulse /> : t.value === 'held' && (heldTotal ?? 0) > 0 ? <Dot tone="warning" /> : undefined,
  }))

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Every IMEI check, unlock and code request handled by your order engine — validated, priced, routed to a supplier and fulfilled."
        actions={
          <>
            <LivePill live={live} onToggle={() => setLive((v) => !v)} />
            <Button variant="accent" leading={<Plus />} onClick={() => setCreate(true)}>
              Create test order
            </Button>
          </>
        }
      />

      <Tabs items={tabs} value={tab} onChange={setFilter('status')} className="mb-4" />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:p-4">
          <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center">
            <SearchInput value={search} onChange={setSearch} placeholder="Order #, IMEI, reference, reseller…" className="xl:w-[280px] xl:shrink-0" />
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <Select inputSize="sm" aria-label="Category" className="sm:w-[150px]" value={category} onChange={(e) => pickCategory(e.target.value)} options={CATEGORIES} />
              <Select
                inputSize="sm"
                aria-label="Service"
                className="sm:w-[170px]"
                value={serviceId}
                onChange={(e) => setFilter('serviceId')(e.target.value)}
                options={[{ value: '', label: category ? `All in ${category}` : 'All services' }, ...serviceOptions]}
              />
              <Select
                inputSize="sm"
                aria-label="Supplier"
                className="sm:w-[150px]"
                value={providerId}
                onChange={(e) => setFilter('providerId')(e.target.value)}
                options={[{ value: '', label: 'All suppliers' }, ...(providers.data ?? []).map((p) => ({ value: p.id, label: p.shortName }))]}
              />
              <Select
                inputSize="sm"
                aria-label="Reseller"
                className="sm:w-[160px]"
                value={resellerId}
                onChange={(e) => setFilter('resellerId')(e.target.value)}
                options={[{ value: '', label: 'All resellers' }, ...(resellers.data ?? []).map((r) => ({ value: r.id, label: r.name }))]}
              />
              <Select inputSize="sm" aria-label="Channel" className="col-span-2 sm:w-[140px]" value={channel} onChange={(e) => setFilter('channel')(e.target.value)} options={CHANNELS} />
            </div>
            <div className="flex items-center justify-between gap-2 xl:ml-auto">
              <Segmented items={RANGES} value={range} onChange={setFilter('range')} />
            </div>
          </div>
          <div className="flex min-h-5 items-center justify-between gap-3 text-[12px] text-fg-3">
            <span className="flex items-center gap-2 tabular">
              {orders.isPlaceholderData ? <LoaderCircle className="size-3.5 animate-spin" /> : <Dot tone={live ? 'success' : 'neutral'} pulse={live} />}
              {orders.data ? `${num(total)} ${total === 1 ? 'order' : 'orders'}` : 'Loading orders…'}
              {category && !serviceId && (
                <span className="inline-flex items-center gap-1.5 text-fg-2">
                  · <span className="size-1.5 rounded-full" style={{ background: categoryColor(category) }} />
                  {category}
                </span>
              )}
              {held && orders.data && orders.data.total > HELD_SCAN && <span className="text-warning">· among the latest {HELD_SCAN} pending</span>}
              {fallback && (
                <Tooltip content="Only orders that failed over to another supplier (more than one attempt). Click to remove.">
                  <button
                    type="button"
                    onClick={() => setFilters({ fallback: '' })}
                    className="inline-flex h-5.5 items-center gap-1 rounded-md bg-warning/10 pr-1 pl-1.5 font-mono text-[10.5px] text-warning ring-1 ring-warning/25 transition-colors ring-inset hover:bg-warning/15"
                    aria-label="Remove auto-fallback filter"
                  >
                    Auto-fallback
                    <X className="size-3" />
                  </button>
                </Tooltip>
              )}
              <span className="hidden sm:inline">{live ? '· refreshing every 5s' : '· live updates paused'}</span>
            </span>
            {activeFilters > 0 && (
              <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg">
                <RotateCcw className="size-3" />
                Clear {activeFilters} filter{activeFilters === 1 ? '' : 's'}
              </button>
            )}
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(o) => o.id}
          loading={orders.isLoading}
          onRowClick={(o) => navigate(`/admin/orders/${o.id}`)}
          minWidth={680}
          skeletonRows={10}
          className={cn('transition-opacity', orders.isPlaceholderData && 'opacity-60')}
          rowClassName={(o) => {
            const phase = arrivals[o.id]
            if (phase === 'new') return 'bg-accent/[0.075] [&>td:first-child]:shadow-[inset_2px_0_0_var(--accent)]'
            if (phase === 'fading') return 'duration-[1600ms] [&>td:first-child]:shadow-[inset_2px_0_0_transparent] [&>td:first-child]:transition-shadow [&>td:first-child]:duration-[1600ms]'
            return undefined
          }}
          empty={
            <EmptyState
              icon={activeFilters || tab !== 'all' ? <Inbox /> : <ReceiptText />}
              title={activeFilters || tab !== 'all' ? 'No orders match this view' : 'No orders yet'}
              description={
                activeFilters || tab !== 'all'
                  ? 'Try a wider date range or clear some filters — search works on order number, full IMEI or client reference. New orders appear here automatically while live.'
                  : 'IMEI checks, unlocks and code orders from your website, admin and resellers appear here as soon as they arrive.'
              }
              action={
                activeFilters ? (
                  <Button size="sm" variant="secondary" leading={<RotateCcw />} onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" leading={<Plus />} onClick={() => setCreate(true)}>
                    Create test order
                  </Button>
                )
              }
            />
          }
        />
        {total > 0 && <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />}
      </Card>

      <CreateOrderModal open={createOpen} onClose={() => setCreate(false)} />
    </div>
  )
}
