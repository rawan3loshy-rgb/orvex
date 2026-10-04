/** Account detail — read-mostly tabs: Orders, API access, Payments & refunds, DHRU. */
import { Link, useNavigate } from 'react-router'
import { ChevronRight, CodeXml, CreditCard, FileSearch, KeyRound, PlugZap, ReceiptText, Undo2, Webhook } from 'lucide-react'
import type { AccountDetail, ApiKey, OrderRow, PaymentIntent, Refund, VerificationRequest, WebhookEndpoint } from '@/types/installation'
import { useDhru } from '@/hooks/installation'
import { ChannelBadge, FinancialBadge, Money, OrderStatusBadge, ScenarioTag, SimulatedBadge } from '@/components/domain'
import { Badge, Button, Card, CardBody, CardHeader, DataTable, DescriptionList, EmptyState, MonoValue, StatusBadge, type Column } from '@/components/ui'
import { dateTime, relative } from '@/lib/format'
import { cn } from '@/lib/cn'

/* ------------------------------ Orders ------------------------------ */
export function OrdersTab({ d }: { d: AccountDetail }) {
  const navigate = useNavigate()
  const a = d.account
  const columns: Column<OrderRow>[] = [
    {
      key: 'ref',
      header: 'Order',
      cell: (o) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[12.5px] font-medium">{o.ref}</span>
            {o.scenario && <ScenarioTag id={o.scenario} />}
          </div>
          <div className="truncate text-[11.5px] text-fg-3">{o.serviceName}</div>
        </div>
      ),
    },
    { key: 'channel', header: 'Channel', hideBelow: 'md', cell: (o) => <ChannelBadge channel={o.channel} /> },
    { key: 'status', header: 'Status', cell: (o) => <OrderStatusBadge status={o.status} /> },
    { key: 'fin', header: 'Money', hideBelow: 'sm', cell: (o) => <FinancialBadge status={o.financialStatus} /> },
    { key: 'price', header: 'Price', align: 'right', cell: (o) => <Money value={o.price} className="font-mono text-[12.5px]" /> },
    { key: 'refunded', header: 'Refunded', align: 'right', hideBelow: 'lg', cell: (o) => (o.refundedTotal ? <Money value={o.refundedTotal} className="font-mono text-[12.5px] text-info" /> : <span className="text-fg-3">—</span>) },
    { key: 'at', header: 'Created', align: 'right', hideBelow: 'md', cell: (o) => <span className="text-[12.5px] whitespace-nowrap text-fg-2">{relative(o.createdAt)}</span> },
  ]
  return (
    <Card className="overflow-hidden">
      <CardHeader
        icon={<ReceiptText />}
        title="Recent orders"
        description={`Latest ${d.recentOrders.length} orders from every channel · ${d.orders30d} in the last 30 days · ${d.openOrders} open`}
        actions={
          <Button size="sm" variant="ghost" to={`/admin/orders?accountId=${a.id}`} trailing={<ChevronRight />}>
            All orders
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={d.recentOrders}
        rowKey={(o) => o.id}
        dense
        minWidth={680}
        onRowClick={(o) => navigate(`/admin/orders/${o.id}`)}
        empty={<EmptyState compact icon={<ReceiptText />} title="No orders yet" description={a.kind === 'guest' ? 'Guest accounts usually hold one storefront order.' : 'Orders placed on any channel — storefront, portal, API, DHRU or admin — show up here.'} />}
      />
    </Card>
  )
}

/* ------------------------------ API access ------------------------------ */
export function ApiTab({ d }: { d: AccountDetail }) {
  const a = d.account
  const noApiExpected = a.kind === 'guest' || a.tier === 'retail'
  const keyCols: Column<ApiKey>[] = [
    {
      key: 'name',
      header: 'Key',
      cell: (k) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[13px] font-medium">
            {k.name}
            <Badge tone={k.environment === 'live' ? 'accent' : 'neutral'} variant="outline">
              {k.environment}
            </Badge>
          </div>
          <div className="font-mono text-[11.5px] text-fg-3">
            {k.prefix}…{k.last4}
          </div>
        </div>
      ),
    },
    { key: 'hash', header: 'Stored hash', hideBelow: 'lg', cell: (k) => <MonoValue value={k.hash} display={`${k.hash.slice(0, 18)}…`} className="text-[11.5px] text-fg-3" /> },
    {
      key: 'scopes',
      header: 'Scopes',
      hideBelow: 'md',
      cell: (k) => (
        <div className="flex max-w-[260px] flex-wrap gap-1">
          {k.scopes.map((s) => (
            <span key={s} className="rounded bg-fg/[0.06] px-1.5 py-0.5 font-mono text-[10.5px] text-fg-2">
              {s}
            </span>
          ))}
        </div>
      ),
    },
    { key: 'dhru', header: 'DHRU', align: 'center', hideBelow: 'sm', cell: (k) => (k.dhruCompat ? <Badge tone="info">Compatible</Badge> : <span className="text-fg-3">—</span>) },
    { key: 'ip', header: 'IP allowlist', hideBelow: 'xl', cell: (k) => <span className="font-mono text-[11.5px] text-fg-2">{k.ipAllowlist.length ? k.ipAllowlist.join(', ') : 'Any'}</span> },
    { key: 'used', header: 'Last used', hideBelow: 'md', cell: (k) => <span className="text-[12.5px] text-fg-2">{k.lastUsedAt ? relative(k.lastUsedAt) : 'Never'}</span> },
    { key: 'status', header: 'Status', align: 'right', cell: (k) => <StatusBadge status={k.status} /> },
  ]
  return (
    <div className="space-y-4">
      {noApiExpected && d.apiKeys.length === 0 && (
        <div className="rounded-xl border border-line bg-surface-2/50 px-4 py-3 text-[12.5px] text-fg-2">
          {a.kind === 'guest' ? 'Guest accounts cannot hold API keys.' : 'Retail customers usually have no API access — they buy on the storefront.'} Switch the tier to Reseller or API-only and enable the API channel to integrate.
        </div>
      )}
      <Card className="overflow-hidden">
        <CardHeader
          icon={<KeyRound />}
          title="API keys"
          description={`Native API v1${a.channels.dhru ? ' + DHRU-compatible endpoint' : ''}. Only the prefix and a hash are stored — secrets are shown once at creation.`}
          actions={
            <Button size="sm" variant="ghost" to={`/admin/developer/keys?accountId=${a.id}`} trailing={<ChevronRight />}>
              Manage keys
            </Button>
          }
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-5 pb-3 text-[12px] text-fg-3">
          <span>
            API channel: <span className={a.channels.api ? 'text-success' : 'text-fg-2'}>{a.channels.api ? 'enabled' : 'disabled'}</span>
          </span>
          <span>
            Rate limit: <span className="font-mono text-fg-2">{a.limits.ordersPerMinute}/min orders</span>
          </span>
          <span>Idempotency scope: account + key, across all channels</span>
        </div>
        <DataTable columns={keyCols} rows={d.apiKeys} rowKey={(k) => k.id} dense minWidth={680} rowClassName={(k) => (k.status === 'revoked' ? 'opacity-60' : undefined)} empty={<EmptyState compact icon={<CodeXml />} title="No API keys" description="Create keys in Developer → API keys. The account’s members with the developer role can also create them in the portal." />} />
      </Card>
      <Card className="overflow-hidden">
        <CardHeader
          icon={<Webhook />}
          title="Webhook endpoints"
          description="Order status events signed with Standard Webhooks headers (webhook-id, webhook-timestamp, webhook-signature)."
          actions={
            <Button size="sm" variant="ghost" to="/admin/developer/webhooks" trailing={<ChevronRight />}>
              Deliveries
            </Button>
          }
        />
        {d.webhooks.length === 0 ? (
          <EmptyState compact icon={<Webhook />} title="No webhook endpoints" description="Without webhooks the integration polls order status." />
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {d.webhooks.map((w: WebhookEndpoint) => (
              <li key={w.id} className="flex flex-col gap-1.5 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="truncate font-mono text-[12.5px]">{w.url}</div>
                  <div className="mt-0.5 truncate text-[11.5px] text-fg-3">
                    {w.description || 'No description'} · {w.events.length} events · secret <span className="font-mono">{w.secretMasked}</span>
                  </div>
                </div>
                <StatusBadge status={w.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

/* ------------------------------ Payments & refunds ------------------------------ */
export function PaymentsTab({ d }: { d: AccountDetail }) {
  const navigate = useNavigate()
  const payCols: Column<PaymentIntent>[] = [
    {
      key: 'ref',
      header: 'Payment',
      cell: (p) => (
        <div>
          <div className="font-mono text-[12.5px] font-medium">{p.ref}</div>
          <div className="text-[11.5px] text-fg-3">{p.purpose === 'top_up' ? 'Wallet top-up' : 'Order payment'}</div>
        </div>
      ),
    },
    { key: 'method', header: 'Method', hideBelow: 'sm', cell: (p) => <span className="text-[12.5px] text-fg-2">{p.method.replace('_', ' ')}</span> },
    { key: 'status', header: 'Status', cell: (p) => <StatusBadge status={p.status} /> },
    { key: 'amount', header: 'Amount', align: 'right', cell: (p) => <Money value={p.amount} className="font-mono text-[12.5px]" /> },
    { key: 'refunded', header: 'Refunded', align: 'right', hideBelow: 'md', cell: (p) => (p.refundedTotal ? <Money value={p.refundedTotal} className="font-mono text-[12.5px] text-info" /> : <span className="text-fg-3">—</span>) },
    { key: 'cb', header: '', hideBelow: 'md', cell: (p) => (p.chargebackId ? <Badge tone="danger">Chargeback</Badge> : null) },
    { key: 'at', header: 'Created', align: 'right', hideBelow: 'lg', cell: (p) => <span className="text-[12.5px] whitespace-nowrap text-fg-2">{dateTime(p.createdAt)}</span> },
  ]
  const refundCols: Column<Refund>[] = [
    { key: 'ref', header: 'Refund', cell: (r) => <span className="font-mono text-[12.5px] font-medium">{r.ref}</span> },
    {
      key: 'order',
      header: 'Order',
      hideBelow: 'sm',
      cell: (r) =>
        r.orderId ? (
          <Link to={`/admin/orders/${r.orderId}`} className="font-mono text-[12px] text-accent-ink hover:underline">
            Open order
          </Link>
        ) : (
          <span className="text-fg-3">—</span>
        ),
    },
    { key: 'dest', header: 'Destination', cell: (r) => <Badge tone="neutral" variant="outline">{r.destination === 'wallet' ? 'Wallet' : 'Original method'}</Badge> },
    { key: 'reason', header: 'Reason', hideBelow: 'md', cell: (r) => <span className="line-clamp-1 text-[12.5px] text-fg-2">{r.reason}</span> },
    { key: 'actor', header: 'By', hideBelow: 'lg', cell: (r) => <span className="text-[12.5px] text-fg-2">{r.actor.name}</span> },
    { key: 'amount', header: 'Amount', align: 'right', cell: (r) => <Money value={r.amount} className="font-mono text-[12.5px]" /> },
    { key: 'status', header: 'Status', align: 'right', hideBelow: 'sm', cell: (r) => <StatusBadge status={r.status} /> },
  ]
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader
          icon={<CreditCard />}
          title="Payments"
          description="Card, PayPal, bank transfer and manual payments — all simulated in the prototype. Each succeeded payment funds the wallet exactly once."
          actions={
            <Button size="sm" variant="ghost" to="/admin/finance/payments" trailing={<ChevronRight />}>
              Finance → Payments
            </Button>
          }
        />
        <DataTable columns={payCols} rows={d.payments} rowKey={(p) => p.id} dense minWidth={640} onRowClick={(p) => navigate(`/admin/finance/payments?intent=${p.id}`)} empty={<EmptyState compact icon={<CreditCard />} title="No payments" description="Wallet-funded resellers often top up by bank transfer — record one from the Wallet tab." />} />
      </Card>
      <Card className="overflow-hidden">
        <CardHeader icon={<Undo2 />} title="Refunds" description="Capped at what was paid, idempotent and audited. Wallet refunds post DR Refunds / CR Customer Available." />
        <DataTable columns={refundCols} rows={d.refunds} rowKey={(r) => r.id} dense minWidth={640} empty={<EmptyState compact icon={<Undo2 />} title="No refunds" />} />
      </Card>
      <Card className="overflow-hidden">
        <CardHeader
          icon={<FileSearch />}
          title="Verification requests"
          description="After-care claims (code not working, wrong result) raised by this account."
          actions={
            <Button size="sm" variant="ghost" to="/admin/verifications" trailing={<ChevronRight />}>
              Verifications
            </Button>
          }
        />
        {d.verifications.length === 0 ? (
          <EmptyState compact icon={<FileSearch />} title="No verification requests" />
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {d.verifications.map((v: VerificationRequest) => (
              <li key={v.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12.5px] font-medium">{v.ref}</span>
                    <span className="text-[12px] text-fg-3">{v.reason.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="truncate text-[11.5px] text-fg-3">{v.message}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link to={`/admin/orders/${v.orderId}`} className="text-[12px] text-accent-ink hover:underline">
                    Order
                  </Link>
                  <StatusBadge status={v.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

/* ------------------------------ DHRU ------------------------------ */
export function DhruTab({ d }: { d: AccountDetail }) {
  const a = d.account
  const dhru = useDhru()
  const conn = dhru.data?.connectedAccounts.find((c) => c.id === a.id)
  const compatKeys = d.apiKeys.filter((k) => k.dhruCompat && k.status === 'active')
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <Card>
        <CardHeader icon={<PlugZap />} title="DHRU-compatible access" description="For resellers whose POS or panel still speaks the DHRU Fusion API. Orders enter the same PlaceOrder command as every other channel." actions={<SimulatedBadge label="Edge adapter" />} />
        <CardBody>
          <DescriptionList
            items={[
              { label: 'Channel', value: a.channels.dhru ? <Badge tone="success" dot>Enabled</Badge> : <Badge tone="neutral">Disabled</Badge> },
              { label: 'DHRU username', value: d.dhruUsername ? <MonoValue value={d.dhruUsername} /> : '—', hint: 'Always the account email' },
              { label: 'API access key', value: compatKeys.length ? compatKeys.map((k) => `${k.prefix}…${k.last4}`).join(', ') : <span className="text-warning">No DHRU-compatible key</span>, mono: compatKeys.length > 0 },
              { label: 'Endpoint', value: dhru.data ? <MonoValue value={dhru.data.endpoint} /> : '…' },
              { label: 'Orders (7 days)', value: conn ? conn.orders7d : '—' },
              { label: 'Last used', value: conn?.lastUsedAt ? relative(conn.lastUsedAt) : 'Never' },
            ]}
          />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="How DHRU clients see this account" />
        <CardBody className="space-y-3 text-[12.5px] leading-relaxed text-fg-2">
          <p>
            The DHRU client authenticates with <span className="font-mono">username</span> + <span className="font-mono">apiaccesskey</span>. Balance requests (<span className="font-mono">accountinfo</span>) return this account’s <strong>available</strong> balance — the same ledger projection shown above.
          </p>
          <p>ORVEX statuses are mapped to DHRU numbers (0 pending · 1 in process · 3 rejected · 4 success) only at the edge; an order under review appears as “in process”.</p>
          <div className={cn('rounded-lg border px-3 py-2 text-[12px]', a.channels.dhru ? 'border-line bg-surface-2/50 text-fg-3' : 'border-warning/30 bg-warning/6 text-warning')}>{a.channels.dhru ? 'Disable the channel in Overview → Channels to block DHRU requests instantly.' : 'The DHRU channel is disabled — requests with this username are refused.'}</div>
          <Button size="sm" variant="ghost" to="/admin/developer/dhru" trailing={<ChevronRight />}>
            DHRU console & mapping
          </Button>
        </CardBody>
      </Card>
    </div>
  )
}
