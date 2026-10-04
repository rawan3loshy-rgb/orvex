import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Code2, ExternalLink, Globe, LayoutDashboard, PlugZap, Receipt } from 'lucide-react'
import { Badge, Button, Card, CardBody, CardHeader, CodeBlock, DataTable, EmptyState, MonoValue, Stat, type Column } from '@/components/ui'
import { ChannelBadge, FinancialBadge, Money, OrderStatusBadge, ScenarioTag } from '@/components/domain'
import { useSettings } from '@/hooks/installation'
import { fieldType } from '@/core/fields'
import type { OrderRow, ServiceDetail } from '@/types/installation'
import { dateTime, num } from '@/lib/format'

function sampleValue(type: string, key: string) {
  const t = fieldType(type)
  if (type === 'gsm.imei') return '356938035643809'
  return t.example || key
}

export function ChannelsTab({ d }: { d: ServiceDetail }) {
  const settings = useSettings()
  const s = d.service
  const base = settings.data?.api.baseUrl ?? 'https://portal.example.com/v1'
  const dhruEndpoint = settings.data?.api.dhruEndpoint ?? 'https://portal.example.com/api/dhru'
  const input = Object.fromEntries(d.revision.fields.filter((f) => f.required).map((f) => [f.key, sampleValue(f.type, f.key)]))
  const nativeReq = `curl -X POST ${base}/orders \\
  -H "Authorization: Bearer orx_live_••••••••" \\
  -H "Idempotency-Key: 7f9c2e1a-…" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({ service: s.code, input, client_reference: 'POS-1042' })}'`
  const dhruParams = Object.fromEntries([['ID', s.code], ...d.dhruMapping.filter((m) => m.dhruParam && input[m.field]).map((m) => [m.dhruParam!, input[m.field]!])])
  const dhruReq = `POST ${dhruEndpoint}
Content-Type: application/x-www-form-urlencoded

username=abcgsm
apiaccesskey=••••-••••-••••-••••
action=placeimeiorder
requestformat=JSON
parameters=${JSON.stringify(dhruParams)}`

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChannelCard icon={<Globe />} title="Storefront" on={s.visibility.storefront && s.status === 'active'} description="Catalog-driven website. Form, price and availability are read live.">
        <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2/50 px-3 py-2">
          <MonoValue value={`/site/services/${s.slug}`} />
          <Button size="xs" variant="ghost" leading={<ExternalLink />} to={`/site/services/${s.slug}`}>
            Open
          </Button>
        </div>
        <p className="mt-2 text-[12px] text-fg-3">{s.visibility.storefront ? (s.status === 'active' ? 'Listed in the catalog, search and featured blocks that match.' : `Service is ${s.status} — not orderable until activated.`) : 'Hidden from the storefront (Overview → Visibility).'}</p>
      </ChannelCard>

      <ChannelCard icon={<LayoutDashboard />} title="Reseller portal" on={s.visibility.portal && s.status === 'active'} description="Accounts order manually or in bulk at their tier price.">
        <div className="grid grid-cols-2 gap-2 text-[12.5px]">
          {d.quotes.map((q) => (
            <div key={q.tierId} className="flex items-center justify-between rounded-md border border-line px-2.5 py-1.5">
              <span className="text-fg-3">{q.tierName}</span>
              <Money value={q.amount} className="font-mono" />
            </div>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-fg-3">Bulk paste validates every IMEI (15 digits + Luhn) before any money is held.</p>
      </ChannelCard>

      <ChannelCard icon={<Code2 />} title="Native API v1" on={s.visibility.api && s.status === 'active'} description={<>Service id is the code <span className="font-mono text-fg">{s.code}</span>. Input follows the revision’s JSON schema.</>}>
        <CodeBlock lang="bash" code={nativeReq} wrap />
      </ChannelCard>

      <ChannelCard icon={<PlugZap />} title="DHRU-compatible endpoint" on={s.visibility.api && s.status === 'active'} description="For resellers whose panels speak DHRU Fusion. Same PlaceOrder command as every channel.">
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[12px]">
          <span className="text-fg-3">SERVICEID</span>
          <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono">{s.code}</span>
          <span className="ml-2 text-fg-3">parameters</span>
          {d.dhruMapping.map((m) => (
            <span key={m.field} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono" title={`${m.field} (${m.type})`}>
              {m.dhruParam ?? `${m.field.toUpperCase()}*`}
            </span>
          ))}
        </div>
        <CodeBlock lang="http" code={dhruReq} wrap />
        <p className="mt-2 text-[11.5px] text-fg-3">Form-POST + JSON response (DHRU numeric statuses appear only at this edge). * no standard DHRU parameter — sent by key.</p>
      </ChannelCard>
    </div>
  )
}

function ChannelCard({ icon, title, on, description, children }: { icon: ReactNode; title: string; on: boolean; description: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader
        icon={icon}
        title={title}
        description={description}
        actions={
          on ? (
            <Badge tone="success" dot>
              Orderable
            </Badge>
          ) : (
            <Badge tone="neutral" dot>
              Off
            </Badge>
          )
        }
      />
      <CardBody>{children}</CardBody>
    </Card>
  )
}

export function OrdersTab({ d }: { d: ServiceDetail }) {
  const columns: Column<OrderRow>[] = [
    {
      key: 'ref',
      header: 'Order',
      cell: (o) => (
        <div>
          <Link to={`/admin/orders/${o.id}`} className="font-mono text-[12.5px] font-medium hover:underline">
            {o.ref}
          </Link>
          {o.scenario && <ScenarioTag id={o.scenario} className="ml-1.5" />}
          <div className="text-[11.5px] text-fg-3">{dateTime(o.createdAt)}</div>
        </div>
      ),
    },
    { key: 'account', header: 'Account', cell: (o) => <span className="text-fg-2">{o.accountName}</span>, hideBelow: 'md' },
    { key: 'channel', header: 'Channel', cell: (o) => <ChannelBadge channel={o.channel} />, hideBelow: 'lg' },
    {
      key: 'status',
      header: 'Status',
      cell: (o) => (
        <div className="flex flex-wrap gap-1">
          <OrderStatusBadge status={o.status} />
          <FinancialBadge status={o.financialStatus} />
        </div>
      ),
    },
    { key: 'supplier', header: 'Supplier', cell: (o) => <span className="text-[12px] text-fg-2">{o.supplierName ?? '—'}{o.failover && <Badge tone="warning" className="ml-1.5">failover</Badge>}</span>, hideBelow: 'lg' },
    { key: 'price', header: 'Price', align: 'right', cell: (o) => <Money value={o.price} className="font-mono" /> },
  ]
  const s = d.stats
  return (
    <div className="grid gap-4">
      <Card>
        <CardBody className="grid grid-cols-2 gap-5 pt-5 md:grid-cols-5">
          <Stat label="Orders 30d" value={num(s.orders30d)} />
          <Stat label="Completed" value={num(s.completed30d)} tone="success" />
          <Stat label="Rejected" value={num(s.rejected30d)} tone={s.rejected30d ? 'warning' : undefined} />
          <Stat label="Revenue" value={<Money value={s.revenue30d} compact />} />
          <Stat label="Margin" value={<Money value={s.margin30d} compact />} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          title="Recent orders"
          icon={<Receipt />}
          actions={
            <Button size="sm" variant="ghost" trailing={<ArrowRight />} to={`/admin/orders?serviceId=${d.service.id}`}>
              All orders for this service
            </Button>
          }
        />
        <DataTable columns={columns} rows={d.recentOrders} rowKey={(o) => o.id} dense minWidth={640} empty={<EmptyState compact icon={<Receipt />} title="No orders yet" description="Orders from every channel appear here." />} />
      </Card>
    </div>
  )
}
