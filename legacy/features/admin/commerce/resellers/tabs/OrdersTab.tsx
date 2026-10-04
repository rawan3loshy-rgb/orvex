import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowUpRight, ReceiptText } from 'lucide-react'
import { useOrders, useProviders, useServices } from '@/hooks/installation'
import type { OrderRow, OrderStatus, Reseller } from '@/types/installation'
import { Button, Card, CardHeader, DataTable, EmptyState, Pagination, Segmented, StatusBadge, type Column } from '@/components/ui'
import { ServiceIcon } from '@/components/brand'
import { dateTime, money } from '@/lib/format'
import { deviceOf } from '@/features/admin/orders/lib'
import { DeviceCell, ProviderCell } from '@/features/admin/orders/parts'

type Filter = 'all' | 'in_flight' | 'success' | 'failed' | 'refunded'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'in_flight', label: 'In progress' },
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
]

export function OrdersTab({ reseller }: { reseller: Reseller }) {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<Filter>('all')
  const orders = useOrders({ resellerId: reseller.id, pageSize: 15, page, status: status as OrderStatus | 'all' | 'in_flight' })
  const services = useServices()
  const providers = useProviders()
  const iconOf = new Map((services.data ?? []).map((s) => [s.id, s.icon]))
  const shortName = new Map((providers.data ?? []).map((p) => [p.id, p.shortName]))

  const columns: Column<OrderRow>[] = [
    {
      key: 'order',
      header: 'Order',
      width: 'w-[130px]',
      cell: (o) => (
        <div className="min-w-0">
          <div className="font-mono text-[12.5px] font-medium text-fg">#{o.number}</div>
          <div className="truncate font-mono text-[10.5px] text-fg-3">{o.clientReference ?? 'no reference'}</div>
        </div>
      ),
    },
    {
      key: 'service',
      header: 'Service',
      cell: (o) => {
        const d = deviceOf(o.input)
        return (
          <div className="flex min-w-0 items-center gap-2.5">
            <ServiceIcon icon={iconOf.get(o.serviceId) ?? 'box'} category={o.serviceCategory} size="sm" />
            <span className="min-w-0">
              <span className="block truncate">{o.serviceName}</span>
              {d && <span className="block truncate font-mono text-[11px] text-fg-3 tabular md:hidden">{d.display}</span>}
            </span>
          </div>
        )
      },
    },
    { key: 'device', header: 'Device', hideBelow: 'md', cell: (o) => <DeviceCell input={o.input} /> },
    { key: 'status', header: 'Status', cell: (o) => <StatusBadge status={o.status} /> },
    { key: 'provider', header: 'Supplier', hideBelow: 'lg', cell: (o) => <ProviderCell order={o} label={o.providerId ? shortName.get(o.providerId) : undefined} compact /> },
    {
      key: 'price',
      header: 'Charged',
      align: 'right',
      cell: (o) => <span className={o.status === 'refunded' || o.status === 'failed' || o.status === 'cancelled' ? 'text-fg-3 line-through decoration-fg-3/50' : 'text-fg'}>{money(o.price)}</span>,
    },
    { key: 'created', header: 'Created', align: 'right', hideBelow: 'sm', cell: (o) => <span className="text-[12.5px] whitespace-nowrap text-fg-2">{dateTime(o.createdAt)}</span> },
  ]

  return (
    <Card className="overflow-hidden">
      <CardHeader
        icon={<ReceiptText />}
        title="Orders"
        description={`IMEI checks, unlocks and codes placed by ${reseller.name} through the Reseller API. Failed orders are released, never charged.`}
        actions={
          <div className="flex items-center gap-2">
            <div className="no-scrollbar max-w-[60vw] overflow-x-auto">
              <Segmented<Filter>
                value={status}
                onChange={(v) => {
                  setStatus(v)
                  setPage(1)
                }}
                size="xs"
                items={FILTERS}
              />
            </div>
            <Button size="sm" variant="ghost" to={`/admin/orders?resellerId=${reseller.id}`} trailing={<ArrowUpRight />} className="hidden lg:inline-flex">
              All orders
            </Button>
          </div>
        }
      />
      <DataTable
        columns={columns}
        rows={orders.data?.items}
        loading={orders.isLoading}
        rowKey={(o) => o.id}
        onRowClick={(o) => navigate(`/admin/orders/${o.id}`)}
        minWidth={640}
        skeletonRows={10}
        empty={
          <EmptyState
            compact
            icon={<ReceiptText />}
            title={status === 'all' ? 'No orders yet' : `No ${FILTERS.find((f) => f.value === status)?.label.toLowerCase()} orders`}
            description={status === 'all' ? 'Orders appear here as soon as the shop calls POST /orders with an IMEI.' : 'Try another status filter.'}
          />
        }
      />
      {orders.data && orders.data.total > 0 && <Pagination page={page} pageSize={15} total={orders.data.total} onPage={setPage} />}
    </Card>
  )
}
