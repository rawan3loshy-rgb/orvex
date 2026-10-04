import { useMemo, useState } from 'react'
import { Clock, PackageSearch, Plus } from 'lucide-react'
import { Badge, Button, Card, CopyButton, DataTable, Drawer, EmptyState, PageHeader, SearchInput, Select, Skeleton, type Column } from '@/components/ui'
import { Money } from '@/components/domain'
import { usePortalServices } from '@/hooks/installation'
import type { PortalService } from '@/types/installation'
import { cn } from '@/lib/cn'
import { CategoryGlyph, ErrorCard, InfoRow } from '../kit'
import { PROCESSING_LABEL, savingPct, turnaroundLabel, usePortalSession } from '../kitUtils'

export default function ServicesPage() {
  const { me, can } = usePortalSession()
  const services = usePortalServices()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [open, setOpen] = useState<PortalService | null>(null)

  const all = useMemo(() => services.data ?? [], [services.data])
  const categories = useMemo(() => [...new Map(all.map((s) => [s.categoryId, s.categoryName])).entries()], [all])
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((s) => (!category || s.categoryId === category) && (!q || [s.name, s.code, ...s.tags].some((x) => x.toLowerCase().includes(q))))
  }, [all, search, category])

  const columns: Column<PortalService>[] = [
    {
      key: 'name',
      header: 'Service',
      sortValue: (s) => s.name,
      cell: (s) => (
        <div className="flex items-center gap-3">
          <CategoryGlyph categoryId={s.categoryId} size="sm" />
          <div className="min-w-0">
            <div className="truncate font-medium">{s.name}</div>
            <div className="text-[11.5px] text-fg-3">{s.categoryName}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'code',
      header: 'Service ID',
      hideBelow: 'lg',
      cell: (s) => (
        <span className="inline-flex items-center gap-1 font-mono text-[12px] text-fg-2" onClick={(e) => e.stopPropagation()}>
          {s.code}
          <CopyButton value={s.code} label="Copy service ID" />
        </span>
      ),
    },
    { key: 'turnaround', header: 'Turnaround', hideBelow: 'md', cell: (s) => <span className="text-[12.5px] text-fg-2">{turnaroundLabel(s)}</span> },
    { key: 'fields', header: 'Required', hideBelow: 'xl', cell: (s) => <span className="text-[12px] text-fg-3">{s.fields.filter((f) => f.required).map((f) => f.label).join(', ')}</span> },
    { key: 'status', header: 'Availability', cell: (s) => (s.available ? <Badge tone="success" dot>Available</Badge> : <Badge tone="warning" dot title={s.unavailableReason ?? undefined}>Unavailable</Badge>) },
    { key: 'retail', header: 'Retail', align: 'right', hideBelow: 'md', sortValue: (s) => s.retailPrice, cell: (s) => <Money value={s.retailPrice} className="text-fg-3" /> },
    {
      key: 'price',
      header: 'Your price',
      align: 'right',
      sortValue: (s) => s.price,
      cell: (s) => (
        <span>
          <Money value={s.price} className="font-semibold" />
          {savingPct(s.price, s.retailPrice) > 0 && <span className="ml-1.5 text-[11px] font-medium text-success">−{savingPct(s.price, s.retailPrice)}%</span>}
        </span>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Services"
        description={me ? `Your ${me.tierName} prices, calculated live. Use the service ID in the native API and your DHRU connection.` : 'Your prices, calculated live.'}
        actions={can.order && <Button to="/portal/order" variant="accent" leading={<Plus />}>Place order</Button>}
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <SearchInput className="sm:max-w-[360px] sm:flex-1" value={search} onChange={setSearch} placeholder="Search name, service ID or tag" />
        <Select className="sm:w-[220px]" value={category} onChange={(e) => setCategory(e.target.value)} options={[{ value: '', label: 'All categories' }, ...categories.map(([id, name]) => ({ value: id, label: name }))]} />
      </div>

      {services.error ? (
        <ErrorCard error={services.error} onRetry={() => services.refetch()} />
      ) : (
        <>
          <Card className="hidden overflow-hidden md:block">
            <DataTable columns={columns} rows={services.data ? rows : undefined} rowKey={(s) => s.id} loading={services.isLoading} onRowClick={setOpen} minWidth={680} defaultSort={{ key: 'name', dir: 'asc' }} empty={<EmptyState icon={<PackageSearch />} title="No services match" />} />
          </Card>
          <div className="space-y-2 md:hidden">
            {services.isLoading
              ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[76px] rounded-xl" />)
              : rows.map((s) => (
                  <button key={s.id} type="button" onClick={() => setOpen(s)} className={cn('flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 text-left shadow-card', !s.available && 'opacity-70')}>
                    <CategoryGlyph categoryId={s.categoryId} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-semibold">{s.name}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-fg-3">
                        <span className="font-mono">{s.code}</span>
                        <span>· {turnaroundLabel(s)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <Money value={s.price} className="text-[14px] font-semibold" />
                      <div className="text-[11px] text-fg-3 line-through">
                        <Money value={s.retailPrice} />
                      </div>
                    </div>
                  </button>
                ))}
            {!services.isLoading && !rows.length && <EmptyState icon={<PackageSearch />} title="No services match" />}
          </div>
        </>
      )}

      <Drawer
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.name}
        description={open?.categoryName}
        footer={
          open &&
          can.order && (
            <Button to={`/portal/order?service=${open.id}`} variant="accent" leading={<Plus />} disabled={!open.available}>
              Order this service
            </Button>
          )
        }
      >
        {open && <ServiceDetail s={open} />}
      </Drawer>
    </div>
  )
}

function ServiceDetail({ s }: { s: PortalService }) {
  return (
    <div className="space-y-5">
      <p className="text-[13.5px] leading-relaxed text-fg-2">{s.summary}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-line bg-surface-2/60 p-3.5">
          <div className="mono-label">Your price</div>
          <Money value={s.price} className="mt-1 block font-display text-[22px] font-semibold" />
        </div>
        <div className="rounded-xl border border-line p-3.5">
          <div className="mono-label">Retail</div>
          <Money value={s.retailPrice} className="mt-1 block font-display text-[22px] font-semibold text-fg-3" />
          {savingPct(s.price, s.retailPrice) > 0 && <div className="text-[11.5px] font-medium text-success">You save {savingPct(s.price, s.retailPrice)}%</div>}
        </div>
      </div>
      <dl>
        <InfoRow label="Service ID (API / DHRU)" mono>
          <span className="inline-flex items-center gap-1">
            {s.code}
            <CopyButton value={s.code} />
          </span>
        </InfoRow>
        <InfoRow label="Availability">{s.available ? <Badge tone="success" dot>Available</Badge> : <span className="text-warning">{s.unavailableReason ?? 'Unavailable'}</span>}</InfoRow>
        <InfoRow label="Processing">{PROCESSING_LABEL[s.processing] ?? s.processing}</InfoRow>
        <InfoRow label="Turnaround">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5 text-fg-3" />
            {turnaroundLabel(s)}
          </span>
        </InfoRow>
        <InfoRow label="Form revision">v{s.revision}</InfoRow>
      </dl>
      <div>
        <div className="mb-2 mono-label">Order fields</div>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {s.fields.map((f) => (
            <li key={f.key} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <div className="min-w-0">
                <div className="text-[13px] font-medium">{f.label}</div>
                {f.help && <div className="text-[11.5px] text-fg-3">{f.help}</div>}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <code className="font-mono text-[11px] text-fg-3">{f.key}</code>
                <Badge tone={f.required ? 'accent' : 'neutral'}>{f.required ? 'Required' : 'Optional'}</Badge>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {s.resultSchema.length > 0 && (
        <div>
          <div className="mb-2 mono-label">You receive</div>
          <div className="flex flex-wrap gap-1.5">
            {s.resultSchema.map((r) => (
              <Badge key={r.key} tone="neutral" variant="outline">
                {r.label}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
