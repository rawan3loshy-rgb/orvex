import { Link, useNavigate } from 'react-router'
import { ArrowRight, Boxes, Cable, History, Layers, Puzzle, ShieldCheck } from 'lucide-react'
import { Badge, Card, CardBody, CardHeader, DataTable, EmptyState, Skeleton, StatusBadge, type Column } from '@/components/ui'
import { HealthBadge, Money } from '@/components/domain'
import { useDrivers, useService, useSuppliers, useSyncRuns } from '@/hooks/installation'
import type { SupplierView } from '@/types/installation'
import { cn } from '@/lib/cn'
import { dateTime, num } from '@/lib/format'
import { ErrorPanel, RelTime, SupplierMark } from '../catalog/kit'
import { DRIVER_META } from '../catalog/helpers'
import { MethodBadge } from '../developer/shared'

/* ------------------------------------------------------------------------- */
/*  Adapter contract                                                         */
/* ------------------------------------------------------------------------- */
const REST_CONTRACT: { op: string; method: string; path: string; purpose: string }[] = [
  { op: 'testConnection', method: 'GET', path: '/v1/account', purpose: 'Authenticate, reachability' },
  { op: 'getBalance', method: 'GET', path: '/v1/account/balance', purpose: 'Prepaid credit at the provider' },
  { op: 'syncCatalog', method: 'GET', path: '/v1/products', purpose: 'Full service catalog (fields, cost)' },
  { op: 'submit', method: 'POST', path: '/v1/orders', purpose: 'Place an order for one product' },
  { op: 'getStatus', method: 'GET', path: '/v1/orders/{ref}', purpose: 'Order status and result' },
  { op: 'parseCallback', method: 'POST', path: '→ /hooks/suppliers/{id}', purpose: 'Signed result callback (HMAC-SHA256)' },
  { op: 'cancel', method: 'POST', path: '/v1/orders/{ref}/cancel', purpose: 'Cancel when the provider allows it' },
]

export function AdapterCard() {
  const drivers = useDrivers()
  return (
    <Card className="self-start">
      <CardHeader icon={<Cable />} title="Adapter contract" description="Providers connect through structured adapters — not a generic “connect any API” builder." />
      <CardBody className="pt-0">
        <div className="mb-2 flex items-center justify-between text-[12px]">
          <span className="font-medium">ORVEX REST adapter</span>
          <span className="text-fg-3">API key · Bearer header</span>
        </div>
        <div className="divide-y divide-line overflow-hidden rounded-lg border border-line">
          {REST_CONTRACT.map((c) => (
            <div key={c.op} className="grid grid-cols-[116px_minmax(0,1fr)] gap-2 px-3 py-2">
              <span className="font-mono text-[11px] break-all text-fg">{c.op}()</span>
              <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-1.5">
                  <MethodBadge method={c.method} size="xs" />
                  <span className="truncate font-mono text-[11.5px] text-fg-2">{c.path}</span>
                </span>
                <span className="block text-[11.5px] text-fg-3">{c.purpose}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 mb-1.5 text-[12px] font-medium">Installed adapters</div>
        <div className="space-y-1.5">
          {drivers.isLoading && <Skeleton className="h-16" />}
          {drivers.data?.map((d) => (
            <div key={d.id} className="flex items-start justify-between gap-3 rounded-lg bg-surface-2/60 px-3 py-2">
              <div className="min-w-0">
                <div className="text-[12.5px] font-medium">
                  {d.name} <span className="font-mono text-[11px] text-fg-3">v{d.version}</span>
                </div>
                <div className="truncate text-[11.5px] text-fg-3">{d.protocol}</div>
              </div>
              <span className="shrink-0 text-[11.5px] text-fg-3 tabular">{d.suppliers} connected</span>
            </div>
          ))}
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-[11.5px] text-fg-3">
          <Puzzle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Each adapter implements the same driver contract, so routing, failover and the ledger never see a provider’s protocol. New protocols ship as adapter{' '}
            <Link to="/admin/system/extensions" className="text-accent-ink hover:underline">
              extensions
            </Link>
            .
          </span>
        </p>
      </CardBody>
    </Card>
  )
}

/* ------------------------------------------------------------------------- */
/*  ORVEX service ⇄ supplier offers                                          */
/* ------------------------------------------------------------------------- */
export function CatalogMappingCard({ serviceId }: { serviceId: string }) {
  const q = useService(serviceId)
  const d = q.data
  const retail = d?.quotes.find((x) => x.tierId === 'tier_retail') ?? d?.quotes[0]
  return (
    <Card>
      <CardHeader
        icon={<Layers />}
        title="One ORVEX service, many supplier offers"
        description="The customer-facing service is ORVEX’s: its name, input fields and price. Provider products are source data — each mapped product is one offer, ranked for routing."
        actions={
          d && (
            <Link to={`/admin/services/${d.service.id}?tab=offers`} className="inline-flex shrink-0 items-center gap-1 text-[12.5px] text-accent-ink hover:underline">
              Offers <ArrowRight className="size-3.5" />
            </Link>
          )
        }
      />
      <CardBody className="pt-0">
        {q.isError ? (
          <ErrorPanel error={q.error} onRetry={() => q.refetch()} />
        ) : !d ? (
          <Skeleton className="h-56" />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)] lg:items-start">
            <div className="relative rounded-xl border border-line bg-surface p-4 shadow-card">
              <span className="absolute top-3 bottom-3 left-0 w-[2px] rounded-full bg-accent" />
              <div className="mono-label">ORVEX service · customer-facing</div>
              <div className="mt-1 text-[16px] font-semibold tracking-[-0.01em]">{d.service.name}</div>
              <div className="mt-0.5 font-mono text-[11.5px] text-fg-3">service #{d.service.code} · rev {d.revision.number}</div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
                <div>
                  <div className="text-fg-3">Retail price</div>
                  <Money value={retail?.amount} className="font-mono text-[14px] font-semibold" />
                </div>
                <div>
                  <div className="text-fg-3">Input fields</div>
                  <div className="font-mono text-fg-2">{d.revision.fields.map((f) => f.key).join(', ')}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {(['storefront', 'portal', 'api'] as const).map((k) => (
                  <Badge key={k} tone={d.service.visibility[k] ? 'success' : 'neutral'} variant="outline">
                    {k === 'api' ? 'Reseller API' : k}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-line">
              <div className="grid grid-cols-[28px_minmax(0,1fr)_76px_64px] gap-2 border-b border-line bg-surface-2/50 px-3 py-1.5 text-[11px] text-fg-3">
                <span>#</span>
                <span>Supplier offer → external product</span>
                <span className="text-right">Cost</span>
                <span className="text-right">Route</span>
              </div>
              {d.offers.map((o) => (
                <div key={o.offer.id} className="grid grid-cols-[28px_minmax(0,1fr)_76px_64px] items-center gap-2 border-b border-line px-3 py-2 last:border-0">
                  <span className="font-mono text-[12px] text-fg-3">P{o.offer.priority}</span>
                  <div className="min-w-0">
                    <Link to={`/admin/suppliers/${o.supplier.id}`} className="block truncate text-[12.5px] font-medium hover:underline">
                      {o.supplier.name}
                    </Link>
                    <div className="truncate text-[11.5px] text-fg-3">
                      <span className="font-mono">product #{o.product?.externalId ?? '—'}</span> · {o.product?.name ?? 'missing product'}
                    </div>
                  </div>
                  <Money value={o.cost} className="text-right font-mono text-[12.5px]" />
                  <span className="text-right">{o.routable ? <Badge tone="success">ready</Badge> : <Badge tone="warning">skip</Badge>}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

/* ------------------------------------------------------------------------- */
/*  Providers + sync history                                                 */
/* ------------------------------------------------------------------------- */
export function ProvidersCard() {
  const navigate = useNavigate()
  const q = useSuppliers()
  const columns: Column<SupplierView>[] = [
    {
      key: 'name',
      header: 'Provider',
      sortValue: (v) => v.supplier.name,
      cell: (v) => (
        <div className="flex items-center gap-2.5">
          <SupplierMark name={v.supplier.name} color={v.supplier.color} size="sm" />
          <div className="min-w-0">
            <div className="truncate font-medium">{v.supplier.name}</div>
            <div className="truncate text-[11px] text-fg-3">
              {DRIVER_META[v.supplier.driver].label} · <span className="font-mono">{v.supplier.connection.url.replace(/^https:\/\//, '')}</span>
            </div>
          </div>
        </div>
      ),
    },
    { key: 'catalog', header: 'Catalog', align: 'right', sortValue: (v) => v.products, cell: (v) => <span className="tabular">{num(v.products)}</span> },
    { key: 'mapped', header: 'Mapped', align: 'right', hideBelow: 'lg', sortValue: (v) => v.offers, cell: (v) => <span className="text-[12.5px] whitespace-nowrap text-fg-2 tabular">{v.offers} offers</span> },
    {
      key: 'sync',
      header: 'Last sync',
      hideBelow: 'md',
      cell: (v) => (
        <span className="text-[12px] whitespace-nowrap">
          <RelTime iso={v.lastSync?.finishedAt ?? v.supplier.lastSyncAt} className="text-fg-2" />
          {v.pendingChanges > 0 && (
            <Link to={`/admin/catalog/sync?supplier=${v.supplier.id}`} onClick={(e) => e.stopPropagation()} className="ml-1.5 text-warning hover:underline">
              {v.pendingChanges} to review
            </Link>
          )}
        </span>
      ),
    },
    { key: 'health', header: 'Connection', cell: (v) => <HealthBadge health={v.health} /> },
  ]
  return (
    <Card className="min-w-0">
      <CardHeader icon={<Boxes />} title="Connected providers" description="Every supplier API ORVEX consumes — credentials, health and catalog per provider." />
      {q.isError ? (
        <ErrorPanel error={q.error} onRetry={() => q.refetch()} className="m-4" />
      ) : (
        <DataTable columns={columns} rows={q.data} loading={q.isLoading} rowKey={(v) => v.supplier.id} onRowClick={(v) => navigate(`/admin/suppliers/${v.supplier.id}`)} dense minWidth={680} />
      )}
    </Card>
  )
}

export function SyncHistoryCard() {
  const q = useSyncRuns()
  const runs = (q.data ?? []).slice(0, 9)
  return (
    <Card className="self-start">
      <CardHeader icon={<History />} title="Sync history" description="Recent catalog syncs across providers" />
      {q.isLoading ? (
        <div className="space-y-2 px-5 pb-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <EmptyState compact title="No syncs yet" />
      ) : (
        <div className="divide-y divide-line border-t border-line">
          {runs.map((r) => {
            const changes = r.counts.new + r.counts.price + r.counts.fields + r.counts.removed + r.counts.warning
            return (
              <div key={r.id} className="px-4 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12.5px] font-medium">{r.supplierName}</span>
                  <StatusBadge status={r.status} />
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2 text-[11.5px] text-fg-3">
                  <span className="truncate">
                    {dateTime(r.startedAt)} · {r.trigger} · {num(r.remoteProducts)} services · {changes ? `${changes} change${changes === 1 ? '' : 's'}` : 'no changes'}
                  </span>
                  <Link to={`/admin/suppliers/${r.supplierId}?tab=log`} className={cn('shrink-0 hover:text-fg hover:underline')}>
                    logs
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div className="flex items-center gap-1.5 border-t border-line px-4 py-2.5 text-[11.5px] text-fg-3">
        <ShieldCheck className="size-3.5" /> Changes are reviewed — removals are auto-applied for safety.
      </div>
    </Card>
  )
}
