import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Layers, PackageSearch, Plus } from 'lucide-react'
import { Button, Card, DataTable, EmptyState, PageHeader, Pagination, SearchInput, Segmented, Skeleton, type Column } from '@/components/ui'
import { ChannelBadge, Money } from '@/components/domain'
import { usePortalOrders } from '@/hooks/installation'
import type { PortalOrder } from '@/types/installation'
import { dateTime, relative } from '@/lib/format'
import { ErrorCard, PortalStatus } from '../kit'
import { PORTAL_STATUS_FILTERS, usePortalSession } from '../kitUtils'

const PAGE_SIZE = 25

export default function OrdersPage() {
  const { can } = usePortalSession()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? 'all'
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [page, setPage] = useState(1)
  const q = { status: status === 'all' ? undefined : status, search: search.trim() || undefined, page, pageSize: PAGE_SIZE }
  const orders = usePortalOrders(q)

  const setStatus = (s: string) => {
    setPage(1)
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        if (s === 'all') n.delete('status')
        else n.set('status', s)
        return n
      },
      { replace: true },
    )
  }

  const columns: Column<PortalOrder>[] = [
    {
      key: 'order',
      header: 'Order',
      cell: (o) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium">{o.serviceName}</div>
          <div className="font-mono text-[11.5px] text-fg-3">{o.ref}</div>
        </div>
      ),
    },
    { key: 'input', header: 'Device', cell: (o) => <span className="font-mono text-[12px] text-fg-2">{Object.values(o.input)[0] ?? '—'}</span> },
    { key: 'ref', header: 'Your reference', hideBelow: 'xl', cell: (o) => <span className="text-[12.5px] text-fg-2">{o.clientReference ?? <span className="text-fg-3">—</span>}</span> },
    { key: 'channel', header: 'Channel', hideBelow: 'lg', cell: (o) => <ChannelBadge channel={o.channel} /> },
    { key: 'status', header: 'Status', cell: (o) => <PortalStatus status={o.status} detail={o.statusDetail} /> },
    { key: 'price', header: 'Price', align: 'right', cell: (o) => <Money value={o.price} className="font-medium" /> },
    { key: 'created', header: 'Placed', align: 'right', cell: (o) => <span className="text-[12px] whitespace-nowrap text-fg-3" title={dateTime(o.createdAt)}>{relative(o.createdAt)}</span> },
  ]

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Every order on your account — from this portal, your API keys and your DHRU connection. Updates live."
        actions={
          can.order && (
            <>
              <Button to="/portal/bulk" leading={<Layers />}>
                Bulk
              </Button>
              <Button to="/portal/order" variant="accent" leading={<Plus />}>
                Place order
              </Button>
            </>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <Segmented items={PORTAL_STATUS_FILTERS.map((f) => ({ value: f.value, label: f.label }))} value={status} onChange={setStatus} />
        </div>
        <SearchInput
          className="md:w-[320px]"
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Order ref, IMEI, service or your reference"
        />
      </div>

      {orders.error ? (
        <ErrorCard error={orders.error} onRetry={() => orders.refetch()} />
      ) : (
        <Card className="overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block">
            <DataTable
              columns={columns}
              rows={orders.data?.items}
              rowKey={(o) => o.id}
              loading={orders.isLoading}
              onRowClick={(o) => navigate(`/portal/orders/${o.ref}`)}
              minWidth={720}
              empty={<Empty filtered={status !== 'all' || !!search} canOrder={can.order} />}
            />
          </div>
          {/* Mobile list */}
          <div className="md:hidden">
            {orders.isLoading && !orders.data ? (
              <div className="space-y-3 p-4">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)}</div>
            ) : orders.data?.items.length ? (
              <ul className="divide-y divide-line">
                {orders.data.items.map((o) => (
                  <li key={o.id}>
                    <Link to={`/portal/orders/${o.ref}`} className="flex items-start gap-3 px-4 py-3 active:bg-surface-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-medium">{o.serviceName}</div>
                        <div className="mt-0.5 truncate font-mono text-[11.5px] text-fg-3">
                          {o.ref} · {Object.values(o.input)[0] ?? ''}
                        </div>
                        <div className="mt-1.5">
                          <PortalStatus status={o.status} detail={o.statusDetail} />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <Money value={o.price} className="text-[13.5px] font-semibold" />
                        <div className="mt-0.5 text-[11px] text-fg-3">{relative(o.createdAt)}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty filtered={status !== 'all' || !!search} canOrder={can.order} />
            )}
          </div>
          {orders.data && orders.data.total > 0 && <Pagination page={orders.data.page} pageSize={orders.data.pageSize} total={orders.data.total} onPage={setPage} />}
        </Card>
      )}
    </div>
  )
}

function Empty({ filtered, canOrder }: { filtered: boolean; canOrder: boolean }) {
  return filtered ? (
    <EmptyState icon={<PackageSearch />} title="No orders match" description="Try another status or search term." />
  ) : (
    <EmptyState icon={<PackageSearch />} title="No orders yet" description="Orders from the portal, the API and DHRU all show up here." action={canOrder && <Button to="/portal/order" size="sm" variant="accent">Place your first order</Button>} />
  )
}
