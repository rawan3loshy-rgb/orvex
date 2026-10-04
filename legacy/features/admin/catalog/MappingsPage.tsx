import { Fragment, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { motion } from 'motion/react'
import { ArrowUpRight, ChevronLeft, ChevronRight, Grid3x3, List, Pencil, Plus, Scale, ShieldAlert, Spline, TriangleAlert, Workflow } from 'lucide-react'
import { ProviderMark, ServiceIcon, categoryColor } from '@/components/brand'
import { Badge, Button, Card, DataTable, Dot, EmptyState, PageHeader, SearchInput, Segmented, Select, Skeleton, Switch, Tooltip, type Column } from '@/components/ui'
import { useInstMutation, useMappings, useServices } from '@/hooks/installation'
import { mappingsService } from '@/services/installation'
import { cn } from '@/lib/cn'
import { money, num, pct } from '@/lib/format'
import type { Provider, Service, ServiceMapping } from '@/types/installation'
import { MappingDrawer, type MappingDrawerState } from './components/MappingDrawer'
import { FlowSkeleton, ServiceMappingEditor } from './components/ServiceMappingEditor'
import { CATEGORIES, MetricStrip, PRIORITY_COLORS, PriorityChip, ROLE_META, groupBy, margin, priorityColor, priorityInk, useProviderMap } from './components/shared'

type View = 'matrix' | 'visual' | 'list'

export default function MappingsPage() {
  const [params, setParams] = useSearchParams()
  const view = (['matrix', 'visual', 'list'].includes(params.get('view') ?? '') ? params.get('view') : 'matrix') as View
  const selected = params.get('service') ?? 'SVC-1001'
  const setQuery = (patch: Record<string, string | null>) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        for (const [k, v] of Object.entries(patch)) {
          if (v == null) n.delete(k)
          else n.set(k, v)
        }
        return n
      },
      { replace: true },
    )

  const services = useServices()
  const mappings = useMappings()
  const { map: providers, data: providerList } = useProviderMap()
  const [drawer, setDrawer] = useState<MappingDrawerState>(null)

  const byService = useMemo(() => groupBy(mappings.data, (m) => m.serviceId), [mappings.data])

  const totals = useMemo(() => {
    const svc = services.data ?? []
    const maps = mappings.data ?? []
    const enabled = maps.filter((m) => m.enabled)
    const covered = svc.filter((s) => (byService.get(s.id) ?? []).some((m) => m.enabled))
    const single = svc.filter((s) => (byService.get(s.id) ?? []).filter((m) => m.enabled).length === 1)
    const unmapped = svc.filter((s) => !(byService.get(s.id) ?? []).some((m) => m.enabled))
    const spreads = svc
      .map((s) => (byService.get(s.id) ?? []).filter((m) => m.enabled).map((m) => m.cost))
      .filter((c) => c.length > 1)
      .map((c) => ({ abs: Math.max(...c) - Math.min(...c), rel: (Math.max(...c) - Math.min(...c)) / Math.min(...c) }))
    const avgAbs = spreads.length ? spreads.reduce((a, s) => a + s.abs, 0) / spreads.length : 0
    const avgRel = spreads.length ? (spreads.reduce((a, s) => a + s.rel, 0) / spreads.length) * 100 : 0
    const pairs = svc.length * (providerList?.length ?? 0)
    return { total: maps.length, enabled: enabled.length, covered: covered.length, coverage: svc.length ? (covered.length / svc.length) * 100 : 0, single, unmapped, avgAbs, avgRel, pairs, density: pairs ? (maps.length / pairs) * 100 : 0 }
  }, [services.data, mappings.data, byService, providerList])

  const loading = services.isLoading || mappings.isLoading || !providers.size
  const focus = services.data?.find((s) => s.id === selected) ?? services.data?.[0]

  return (
    <div>
      <PageHeader
        icon={<Workflow />}
        title="Service mapping"
        description="Connect every internal service to one or more supplier service IDs — e.g. iPhone Unlock — USA Carriers ↔ Global Unlock #312. Priorities define the failover chain the routing engine walks."
        actions={
          <Button variant="accent" leading={<Plus />} onClick={() => setDrawer({ mode: 'create' })}>
            New mapping
          </Button>
        }
      />

      <MetricStrip
        className="mb-5"
        cols="grid-cols-2 lg:grid-cols-4"
        loading={loading}
        items={[
          { label: 'Mappings', icon: <Spline />, value: num(totals.total), sub: `${num(totals.enabled)} enabled · ${num(totals.total - totals.enabled)} disabled` },
          { label: 'Service coverage', icon: <Grid3x3 />, value: pct(totals.coverage, 0), sub: `${totals.covered} of ${services.data?.length ?? 0} services routable · ${pct(totals.density, 0)} matrix density`, tone: totals.coverage === 100 ? 'success' : 'warning' },
          { label: 'Single-supplier risk', icon: <ShieldAlert />, value: totals.single.length, sub: totals.single.length ? 'Services with no failover supplier' : 'Every service can fail over', tone: totals.single.length ? 'warning' : 'success' },
          { label: 'Avg supplier cost spread', icon: <Scale />, value: pct(totals.avgRel, 0), sub: `${money(totals.avgAbs)} between cheapest and priciest supplier` },
        ]}
      />

      {!loading && totals.single.length > 0 && (
        <div className="mb-5 flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/[0.05] px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5 text-[13px]">
            <TriangleAlert className="size-4 shrink-0 text-warning" />
            <span className="font-medium text-fg">{totals.single.length} services rely on a single supplier</span>
            <span className="hidden text-fg-3 md:inline">— an outage there fails (and refunds) every order.</span>
          </div>
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto sm:ml-auto">
            {totals.single.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setQuery({ view: 'visual', service: s.id })}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] text-fg-2 transition-colors hover:border-warning/40 hover:text-fg"
              >
                <span className="size-1.5 rounded-full" style={{ background: categoryColor(s.category) }} />
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between gap-3">
        <Segmented
          size="md"
          value={view}
          onChange={(v) => setQuery({ view: v === 'matrix' ? null : v })}
          items={[
            { value: 'matrix', label: 'Matrix', icon: <Grid3x3 /> },
            { value: 'visual', label: 'Visual', icon: <Workflow /> },
            { value: 'list', label: 'List', icon: <List /> },
          ]}
        />
        {view === 'matrix' && <PriorityLegend className="hidden md:flex" />}
      </div>

      {loading ? (
        view === 'visual' ? (
          <Card className="p-8">
            <FlowSkeleton />
          </Card>
        ) : (
          <Skeleton className="h-[560px] rounded-xl" />
        )
      ) : view === 'matrix' ? (
        <MatrixView services={services.data ?? []} providers={providerList ?? []} byService={byService} onCell={setDrawer} />
      ) : view === 'visual' ? (
        <VisualView services={services.data ?? []} byService={byService} focus={focus} onSelect={(id) => setQuery({ service: id })} />
      ) : (
        <ListView mappings={mappings.data ?? []} services={services.data ?? []} providers={providers} onEdit={(m) => setDrawer({ mode: 'edit', mapping: m })} />
      )}

      <MappingDrawer state={drawer} onClose={() => setDrawer(null)} />
    </div>
  )
}

function PriorityLegend({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 text-[11.5px] text-fg-3', className)}>
      {(['primary', 'fallback', 'emergency'] as const).map((r, i) => (
        <span key={r} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: `color-mix(in oklab, ${PRIORITY_COLORS[i]} 40%, transparent)`, boxShadow: `inset 0 0 0 1px ${PRIORITY_COLORS[i]}` }} />
          P{i + 1} · {ROLE_META[r].label.toLowerCase()}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[3px] border border-dashed border-fg-3" />
        Disabled
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/*  Matrix                                                                   */
/* ------------------------------------------------------------------------- */

function MatrixView({ services, providers, byService, onCell }: { services: Service[]; providers: Provider[]; byService: Map<string, ServiceMapping[]>; onCell: (s: MappingDrawerState) => void }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [hover, setHover] = useState<{ s: string; p: string } | null>(null)
  const filtered = services.filter((s) => (!category || s.category === category) && (!search || `${s.name} ${s.id}`.toLowerCase().includes(search.toLowerCase())))
  const groups = CATEGORIES.map((c) => ({ c, items: filtered.filter((s) => s.category === c) })).filter((g) => g.items.length)

  const colStats = providers.map((p) => {
    const ms = services.flatMap((s) => (byService.get(s.id) ?? []).filter((m) => m.providerId === p.id))
    return { p, count: ms.length, primary: ms.filter((m) => m.priority === 1).length, avg: ms.length ? ms.reduce((a, m) => a + m.cost, 0) / ms.length : 0 }
  })

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Filter services…" className="sm:w-[260px] [&_input]:h-8" />
        <Select inputSize="sm" value={category} onChange={(e) => setCategory(e.target.value)} options={[{ value: '', label: 'All categories' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]} className="sm:w-[170px]" />
        <span className="text-[12px] text-fg-3 sm:ml-auto">
          {filtered.length} services × {providers.length} suppliers · cells show priority, supplier cost and supplier service ID
        </span>
      </div>
      {filtered.length === 0 ? (
        <EmptyState compact icon={<Grid3x3 />} title="No services match" description="Clear the filter to see the full matrix." />
      ) : (
        <div className="overflow-x-auto" onMouseLeave={() => setHover(null)}>
          <table className="w-full min-w-[920px] border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-[3] w-[220px] border-r border-b border-line bg-surface px-3 py-3 text-left text-[11.5px] font-medium text-fg-3 sm:w-[260px] sm:px-4">Internal service</th>
                {colStats.map(({ p, count, primary }) => (
                  <th key={p.id} className={cn('border-b border-line px-2 py-3 text-left font-normal transition-colors', hover?.p === p.id && 'bg-surface-2/70')}>
                    <Link to={`/admin/providers/${p.id}`} className="group flex items-center gap-2 px-1">
                      <ProviderMark id={p.id} size="sm" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-fg group-hover:underline">
                          {p.shortName}
                          {p.status !== 'operational' && (
                            <Tooltip content={`${p.name} is ${p.status}`}>
                              <Dot tone={p.status === 'degraded' ? 'warning' : 'danger'} pulse />
                            </Tooltip>
                          )}
                        </div>
                        <div className="text-[11px] text-fg-3 tabular">
                          {count} mapped · {primary} P1
                        </div>
                      </div>
                    </Link>
                  </th>
                ))}
                <th className="border-b border-l border-line px-4 py-3 text-right text-[11.5px] font-medium text-fg-3">Chain</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.c}>
                  <tr>
                    <td colSpan={providers.length + 2} className="border-b border-line bg-surface-2/50 px-4 py-1.5">
                      <span className="sticky left-4 flex items-center gap-2 text-[11px] font-medium tracking-wide text-fg-3 uppercase">
                        <span className="size-1.5 rounded-full" style={{ background: categoryColor(g.c) }} />
                        {g.c}
                        <span className="font-normal normal-case">· {g.items.length}</span>
                      </span>
                    </td>
                  </tr>
                  {g.items.map((s) => {
                    const ms = byService.get(s.id) ?? []
                    const enabled = ms.filter((m) => m.enabled)
                    const risk = enabled.length === 1
                    const none = enabled.length === 0
                    return (
                      <tr key={s.id} className="group/row">
                        <th scope="row" className={cn('sticky left-0 z-[2] max-w-[220px] border-r border-b border-line bg-surface px-3 py-2 text-left font-normal transition-colors sm:max-w-[260px] sm:px-4', hover?.s === s.id && 'bg-surface-2')}>
                          <Link to={`/admin/services/${s.id}?tab=mappings`} className="group flex items-center gap-2.5">
                            <ServiceIcon icon={s.icon} category={s.category} size="sm" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[13px] font-medium text-fg group-hover:underline">{s.name}</div>
                              <div className="font-mono text-[10.5px] text-fg-3">{s.id}</div>
                            </div>
                            {(risk || none) && (
                              <Tooltip content={none ? 'No enabled supplier — orders fail' : 'Single supplier — no failover'}>
                                <TriangleAlert className={cn('size-3.5 shrink-0', none ? 'text-danger' : 'text-warning')} />
                              </Tooltip>
                            )}
                          </Link>
                        </th>
                        {providers.map((p) => {
                          const m = ms.find((x) => x.providerId === p.id)
                          const hl = hover?.s === s.id || hover?.p === p.id
                          return (
                            <td key={p.id} className={cn('border-b border-line px-1.5 py-1.5 transition-colors', hl && 'bg-surface-2/60')} onMouseEnter={() => setHover({ s: s.id, p: p.id })}>
                              {m ? <MatrixCell m={m} price={s.price} onClick={() => onCell({ mode: 'edit', mapping: m })} /> : <EmptyCell onClick={() => onCell({ mode: 'create', serviceId: s.id, providerId: p.id })} label={`Map ${s.name} to ${p.name}`} />}
                            </td>
                          )
                        })}
                        <td className={cn('border-b border-l border-line px-4 py-2 text-right', hover?.s === s.id && 'bg-surface-2/60')}>
                          <span className="inline-flex items-center gap-1">
                            {ms
                              .slice()
                              .sort((a, b) => a.priority - b.priority)
                              .map((m) => (
                                <span key={m.id} className={cn('h-4 w-1.5 rounded-full', !m.enabled && 'opacity-30')} style={{ background: priorityColor(m.priority) }} />
                              ))}
                            <span className={cn('ml-1.5 text-[12px] tabular', none ? 'text-danger' : risk ? 'text-warning' : 'text-fg-2')}>{enabled.length}</span>
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="sticky left-0 z-[2] border-r border-line bg-surface-2 px-4 py-2.5 text-[11.5px] font-medium text-fg-3">Avg supplier cost</td>
                {colStats.map(({ p, avg, count }) => (
                  <td key={p.id} className={cn('bg-surface-2 px-3 py-2.5 text-[12px] text-fg-2 tabular', hover?.p === p.id && 'bg-surface-3')}>
                    {count ? money(avg) : '—'}
                  </td>
                ))}
                <td className="border-l border-line bg-surface-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  )
}

function MatrixCell({ m, price, onClick }: { m: ServiceMapping; price: number; onClick: () => void }) {
  const color = priorityColor(m.priority)
  const mm = margin(price, m.cost)
  return (
    <Tooltip
      content={
        <span className="block">
          <span className="font-medium">Supplier service #{m.externalId}</span> · {m.externalName}
          <br />
          {money(m.cost)} supplier cost · {money(mm.abs)} margin ({pct(mm.pct, 0)}){m.enabled ? '' : ' · disabled'}
        </span>
      }
      className="flex w-full"
    >
      <motion.button
        type="button"
        onClick={onClick}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.98 }}
        className={cn('flex h-12 w-full min-w-[104px] flex-col justify-center gap-0.5 rounded-lg px-2.5 text-left', !m.enabled && 'border border-dashed border-line-strong')}
        style={
          m.enabled
            ? { background: `color-mix(in oklab, ${color} ${m.priority === 1 ? 13 : 8}%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} ${m.priority === 1 ? 36 : 22}%, transparent)` }
            : undefined
        }
      >
        <span className="flex w-full items-center justify-between gap-2">
          <span className={cn('font-mono text-[11px] font-semibold', !m.enabled && 'text-fg-3')} style={m.enabled ? { color: priorityInk(m.priority) } : undefined}>
            P{m.priority}
          </span>
          <span className={cn('text-[12.5px] font-medium tabular', m.enabled ? 'text-fg' : 'text-fg-3 line-through')}>{money(m.cost)}</span>
        </span>
        <span className="block w-full truncate font-mono text-[10px] text-fg-3">#{m.externalId}</span>
      </motion.button>
    </Tooltip>
  )
}

function EmptyCell({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="group grid h-12 w-full min-w-[104px] place-items-center rounded-lg border border-dashed border-transparent text-fg-3/50 transition-colors hover:border-accent/40 hover:bg-accent/[0.04] hover:text-accent-ink">
      <Plus className="size-3.5 opacity-40 transition-opacity group-hover:opacity-100" />
    </button>
  )
}

/* ------------------------------------------------------------------------- */
/*  Visual                                                                   */
/* ------------------------------------------------------------------------- */

function VisualView({ services, byService, focus, onSelect }: { services: Service[]; byService: Map<string, ServiceMapping[]>; focus: Service | undefined; onSelect: (id: string) => void }) {
  const idx = services.findIndex((s) => s.id === focus?.id)
  const go = (d: -1 | 1) => {
    if (!services.length) return
    const next = services[(idx + d + services.length) % services.length]
    if (next) onSelect(next.id)
  }
  const ms = focus ? (byService.get(focus.id) ?? []) : []
  const enabled = ms.filter((m) => m.enabled).length
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 shadow-card sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button size="sm" variant="ghost" icon aria-label="Previous service" onClick={() => go(-1)}>
            <ChevronLeft />
          </Button>
          {focus && <ServiceIcon icon={focus.icon} category={focus.category} size="sm" />}
          <Select value={focus?.id ?? ''} onChange={(e) => onSelect(e.target.value)} options={services.map((s) => ({ value: s.id, label: `${s.name} · ${s.id}` }))} className="min-w-0 flex-1 sm:max-w-[360px]" />
          <Button size="sm" variant="ghost" icon aria-label="Next service" onClick={() => go(1)}>
            <ChevronRight />
          </Button>
          <span className="hidden font-mono text-[11px] text-fg-3 tabular md:inline">
            {idx + 1} / {services.length}
          </span>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          {enabled <= 1 && (
            <Badge tone={enabled ? 'warning' : 'danger'} icon={<TriangleAlert />}>
              {enabled ? 'Single supplier' : 'No supplier'}
            </Badge>
          )}
          <span className="flex -space-x-1">
            {ms
              .slice()
              .sort((x, y) => x.priority - y.priority)
              .map((m) => (
                <ProviderMark key={m.id} id={m.providerId} size="xs" className={cn('ring-2 ring-surface', !m.enabled && 'opacity-40')} />
              ))}
          </span>
          {focus && (
            <Button size="sm" variant="secondary" to={`/admin/services/${focus.id}`} trailing={<ArrowUpRight />}>
              Open service
            </Button>
          )}
        </div>
      </div>
      {focus ? (
        <motion.div key={focus.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <ServiceMappingEditor
            service={focus}
            title={
              <span className="flex items-center gap-2">
                {focus.name}
                <span className="font-mono text-[11.5px] font-normal text-fg-3">{focus.id}</span>
              </span>
            }
          />
        </motion.div>
      ) : (
        <Card>
          <EmptyState icon={<Workflow />} title="Pick a service" />
        </Card>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/*  List                                                                     */
/* ------------------------------------------------------------------------- */

interface ListRow {
  m: ServiceMapping
  s?: Service
  p?: Provider
}

function ListView({ mappings, services, providers, onEdit }: { mappings: ServiceMapping[]; services: Service[]; providers: Map<string, Provider>; onEdit: (m: ServiceMapping) => void }) {
  const [search, setSearch] = useState('')
  const [providerId, setProviderId] = useState('')
  const [state, setState] = useState<'all' | 'enabled' | 'disabled'>('all')
  const svc = useMemo(() => new Map(services.map((s) => [s.id, s])), [services])
  const toggle = useInstMutation((v: { id: string; enabled: boolean }) => mappingsService.update(v.id, { enabled: v.enabled }), { success: (_, v) => (v.enabled ? 'Mapping enabled' : 'Mapping disabled') })

  const rows: ListRow[] = mappings
    .map((m) => ({ m, s: svc.get(m.serviceId), p: providers.get(m.providerId) }))
    .filter(({ m, s, p }) => (!providerId || m.providerId === providerId) && (state === 'all' || (state === 'enabled') === m.enabled) && (!search || `${s?.name} ${m.serviceId} ${p?.name} ${m.externalId} ${m.externalName}`.toLowerCase().includes(search.toLowerCase())))

  const columns: Column<ListRow>[] = [
    {
      key: 'service',
      header: 'Service',
      sortValue: (r) => r.s?.name ?? '',
      cell: ({ s, m }) => (
        <div className="flex items-center gap-2.5">
          {s && <ServiceIcon icon={s.icon} category={s.category} size="sm" />}
          <div className="min-w-0">
            <div className="truncate font-medium">{s?.name ?? m.serviceId}</div>
            <div className="font-mono text-[10.5px] text-fg-3">{m.serviceId}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'provider',
      header: 'Supplier',
      sortValue: (r) => r.p?.name ?? '',
      cell: ({ p, m }) => (
        <span className="flex items-center gap-2 whitespace-nowrap">
          <ProviderMark id={m.providerId} size="xs" />
          <span className="text-fg-2">{p?.shortName}</span>
          {p && p.status !== 'operational' && <Dot tone={p.status === 'degraded' ? 'warning' : 'danger'} pulse />}
        </span>
      ),
    },
    {
      key: 'ext',
      header: 'Supplier service ID',
      hideBelow: 'md',
      sortValue: (r) => r.m.externalId,
      cell: ({ m }) => (
        <div className="min-w-0">
          <div className="font-mono text-[12px]">#{m.externalId}</div>
          <div className="max-w-[200px] truncate text-[11px] text-fg-3">{m.externalName}</div>
        </div>
      ),
    },
    { key: 'priority', header: 'Priority', sortValue: (r) => r.m.priority, cell: ({ m }) => <PriorityChip priority={m.priority} /> },
    { key: 'cost', header: 'Supplier cost', align: 'right', sortValue: (r) => r.m.cost, cell: ({ m }) => money(m.cost) },
    { key: 'price', header: 'Price', align: 'right', hideBelow: 'lg', sortValue: (r) => r.s?.price ?? 0, cell: ({ s }) => <span className="text-fg-2">{s ? money(s.price) : '—'}</span> },
    {
      key: 'margin',
      header: 'Margin',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (r) => (r.s ? margin(r.s.price, r.m.cost).pct : 0),
      cell: ({ s, m }) => {
        if (!s) return '—'
        const mm = margin(s.price, m.cost)
        return <span className={cn('font-medium', mm.abs < 0 ? 'text-danger' : mm.pct >= 40 ? 'text-success' : 'text-fg')}>{pct(mm.pct, 0)}</span>
      },
    },
    { key: 'success', header: 'Success', align: 'right', hideBelow: 'lg', sortValue: (r) => r.m.successRate30d, cell: ({ m }) => <span className="text-fg-2">{m.successRate30d ? pct(m.successRate30d) : '—'}</span> },
    {
      key: 'enabled',
      header: 'Enabled',
      align: 'center',
      sortValue: (r) => (r.m.enabled ? 1 : 0),
      cell: ({ m }) => (
        <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
          <Switch size="sm" checked={m.enabled} disabled={toggle.isPending} onChange={(v) => toggle.mutate({ id: m.id, enabled: v })} label="Enabled" />
        </span>
      ),
    },
    {
      key: 'edit',
      header: '',
      align: 'right',
      width: 'w-[52px]',
      cell: ({ m }) => (
        <Button
          size="xs"
          variant="ghost"
          icon
          aria-label="Edit mapping"
          onClick={(e) => {
            e.stopPropagation()
            onEdit(m)
          }}
        >
          <Pencil />
        </Button>
      ),
    },
  ]

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-line px-4 py-3 lg:flex-row lg:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search service, supplier or service ID…" className="lg:w-[320px] [&_input]:h-8" />
        <div className="flex gap-2">
          <Select inputSize="sm" value={providerId} onChange={(e) => setProviderId(e.target.value)} options={[{ value: '', label: 'All suppliers' }, ...[...providers.values()].map((p) => ({ value: p.id, label: p.name }))]} className="flex-1 lg:w-[170px] lg:flex-none" />
          <Segmented value={state} onChange={setState} items={[{ value: 'all', label: 'All' }, { value: 'enabled', label: 'Enabled' }, { value: 'disabled', label: 'Disabled' }]} />
        </div>
        <span className="text-[12px] text-fg-3 tabular lg:ml-auto">{num(rows.length)} mappings</span>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.m.id}
        onRowClick={(r) => onEdit(r.m)}
        minWidth={760}
        dense
        defaultSort={{ key: 'service', dir: 'asc' }}
        empty={<EmptyState compact icon={<List />} title="No mappings match" description="Adjust the filters or create a new mapping." />}
      />
      <div className="flex items-center gap-2 border-t border-line px-5 py-2.5 text-[11.5px] text-fg-3">
        <Badge tone="neutral">Tip</Badge> Reorder supplier priorities visually in the <span className="font-medium text-fg-2">Visual</span> view.
      </div>
    </Card>
  )
}
