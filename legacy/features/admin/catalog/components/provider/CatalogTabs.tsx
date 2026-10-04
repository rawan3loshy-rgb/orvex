import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, Boxes, Pencil, Workflow } from 'lucide-react'
import { ServiceIcon } from '@/components/brand'
import { Badge, Button, Card, CardHeader, DataTable, EmptyState, Skeleton, type Column } from '@/components/ui'
import { useMappings } from '@/hooks/installation'
import { cn } from '@/lib/cn'
import { money, pct, relative } from '@/lib/format'
import type { Provider, Service, ServiceMapping } from '@/types/installation'
import { MappingDrawer, type MappingDrawerState } from '../MappingDrawer'
import { MarginBar, PriorityChip, margin, useServiceMap } from '../shared'

interface Row {
  m: ServiceMapping
  s: Service | undefined
}

export function ProviderServicesTab({ provider: p }: { provider: Provider }) {
  const navigate = useNavigate()
  const mappings = useMappings({ providerId: p.id })
  const { map: services } = useServiceMap()
  const rows = useMemo<Row[] | undefined>(() => mappings.data?.map((m) => ({ m, s: services.get(m.serviceId) })), [mappings.data, services])

  const columns: Column<Row>[] = [
    {
      key: 'service',
      header: 'Internal service',
      sortValue: (r) => r.s?.name ?? r.m.serviceId,
      cell: ({ s, m }) => (
        <div className="flex items-center gap-2.5">
          {s && <ServiceIcon icon={s.icon} category={s.category} size="sm" />}
          <div className="min-w-0">
            <div className="truncate font-medium">{s?.name ?? m.serviceId}</div>
            <div className="font-mono text-[11px] text-fg-3">{m.serviceId}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'ext',
      header: `${p.shortName} service ID`,
      sortValue: (r) => r.m.externalId,
      cell: ({ m }) => (
        <div className="min-w-0">
          <div className="font-mono text-[12px] text-fg">#{m.externalId}</div>
          <div className="max-w-[220px] truncate text-[11.5px] text-fg-3">{m.externalName}</div>
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      sortValue: (r) => r.m.priority,
      cell: ({ m }) => (
        <span className="flex items-center gap-1.5">
          <PriorityChip priority={m.priority} />
          {!m.enabled && <Badge>Disabled</Badge>}
        </span>
      ),
    },
    { key: 'cost', header: 'Supplier cost', align: 'right', sortValue: (r) => r.m.cost, cell: ({ m }) => money(m.cost) },
    { key: 'price', header: 'Our price', align: 'right', sortValue: (r) => r.s?.price ?? 0, cell: ({ s }) => <span className="text-fg-2">{s ? money(s.price) : '—'}</span> },
    {
      key: 'margin',
      header: 'Margin',
      align: 'right',
      sortValue: (r) => (r.s ? margin(r.s.price, r.m.cost).pct : 0),
      cell: ({ s, m }) => {
        if (!s) return '—'
        const mm = margin(s.price, m.cost)
        return (
          <span className={cn('font-medium', mm.abs < 0 ? 'text-danger' : mm.pct >= 40 ? 'text-success' : 'text-fg')}>
            {money(mm.abs)} <span className="font-normal text-fg-3">· {pct(mm.pct, 0)}</span>
          </span>
        )
      },
    },
    { key: 'split', header: 'Split', hideBelow: 'lg', width: 'w-[140px]', cell: ({ s, m }) => (s ? <MarginBar price={s.price} cost={m.cost} /> : null) },
    { key: 'success', header: 'Success 30d', align: 'right', hideBelow: 'md', sortValue: (r) => r.m.successRate30d, cell: ({ m }) => (m.successRate30d ? pct(m.successRate30d) : '—') },
  ]

  return (
    <Card className="overflow-hidden">
      <CardHeader icon={<Boxes />} title="Mapped services" description={`Internal services ${p.name} can fulfil — each linked to one of ${p.shortName}’s own service IDs.`} actions={<Button size="sm" variant="ghost" to="/admin/mappings" trailing={<ArrowRight />}>Mapping matrix</Button>} />
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.m.id}
        loading={mappings.isLoading}
        onRowClick={(r) => navigate(`/admin/services/${r.m.serviceId}?tab=mappings`)}
        minWidth={760}
        defaultSort={{ key: 'priority', dir: 'asc' }}
        empty={<EmptyState compact icon={<Workflow />} title="No services mapped" description={`Sync ${p.shortName}’s service list, then map its service IDs to internal services from the Mappings page.`} action={<Button size="sm" variant="secondary" to="/admin/mappings">Open mappings</Button>} />}
      />
    </Card>
  )
}

export function ProviderFieldMapsTab({ provider: p }: { provider: Provider }) {
  const mappings = useMappings({ providerId: p.id })
  const { map: services } = useServiceMap()
  const [drawer, setDrawer] = useState<MappingDrawerState>(null)
  if (mappings.isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    )
  }
  const list = (mappings.data ?? []).slice().sort((a, b) => a.serviceId.localeCompare(b.serviceId))
  if (!list.length) {
    return (
      <Card>
        <EmptyState icon={<Workflow />} title="No field maps yet" description={`Field maps appear once ${p.name} is mapped to a service.`} />
      </Card>
    )
  }
  const renamed = list.reduce((a, m) => a + Object.entries(m.fieldMap).filter(([k, v]) => k !== v).length, 0)
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-fg-3">
        How {p.adapterName} renames Core’s normalised input keys (imei, network, model…) before submitting to {p.shortName}
        {p.protocol === 'SOAP / XML' ? ' — DHRU-style XML gateways expect upper-case keys' : p.protocol === 'GraphQL' ? ' — GraphQL variables use camelCase' : ''}. {renamed ? `${renamed} keys are transformed.` : 'All keys pass through unchanged.'}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {list.map((m) => {
          const s = services.get(m.serviceId)
          const entries = Object.entries(m.fieldMap)
          return (
            <Card key={m.id} className="overflow-hidden">
              <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                {s && <ServiceIcon icon={s.icon} category={s.category} size="sm" />}
                <div className="min-w-0 flex-1">
                  <Link to={`/admin/services/${m.serviceId}?tab=mappings`} className="block truncate text-[13px] font-semibold hover:underline">
                    {s?.name ?? m.serviceId}
                  </Link>
                  <div className="truncate font-mono text-[11px] text-fg-3">
                    {m.serviceId} → {p.shortName} #{m.externalId}
                  </div>
                </div>
                <Button size="xs" variant="ghost" leading={<Pencil />} onClick={() => setDrawer({ mode: 'edit', mapping: m })}>
                  Edit
                </Button>
              </div>
              <div className="px-4 py-2">
                <div className="grid grid-cols-[minmax(0,1fr)_16px_minmax(0,1fr)] gap-x-2 pb-1 text-[10.5px] tracking-wide text-fg-3 uppercase">
                  <span>Core key</span>
                  <span />
                  <span>{p.shortName} key</span>
                </div>
                {entries.length ? (
                  entries.map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[minmax(0,1fr)_16px_minmax(0,1fr)] items-center gap-x-2 border-t border-line py-1.5 font-mono text-[12px]">
                      <span className="truncate text-fg-2">{k}</span>
                      <ArrowRight className="size-3 text-fg-3" />
                      <span className={cn('truncate', k !== v ? 'font-medium text-fg' : 'text-fg-3')}>{v}</span>
                    </div>
                  ))
                ) : (
                  <p className="py-2 text-[12px] text-fg-3">No input fields.</p>
                )}
              </div>
              <div className="border-t border-line px-4 py-2 text-[11px] text-fg-3">Synced {relative(m.lastSyncedAt)}</div>
            </Card>
          )
        })}
      </div>
      <MappingDrawer state={drawer} onClose={() => setDrawer(null)} />
    </div>
  )
}
