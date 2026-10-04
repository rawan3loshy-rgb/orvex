import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRight, ArrowUpRight, Boxes, CloudDownload, Cog, PlugZap, Server, Workflow } from 'lucide-react'
import { useDhru } from '@/hooks/installation'
import type { ApiLogEntry, DhruOverview, OrderStatus } from '@/types/installation'
import { Badge, Button, Card, CardBody, CardHeader, CopyButton, DataTable, EmptyState, KpiCard, PageHeader, StatusBadge, type Column } from '@/components/ui'
import { OrderStatusBadge } from '@/components/domain'
import { num, time } from '@/lib/format'
import { QueryError, StatusCode, type LogRow } from '@/features/admin/developer/shared'
import { sinceShort } from '@/features/admin/developer/helpers'
import { LogDrawer } from '@/features/admin/developer/logs/LogDrawer'
import { DhruConsole } from './DhruConsole'

const ACTIONS: Record<string, { core: string; desc: string }> = {
  accountinfo: { core: 'Wallet projection (ledger)', desc: 'Returns credit (available), held funds and credit limit.' },
  imeiservicelist: { core: 'Catalog + PricingEngine', desc: 'Services grouped by category with the account’s tier price and availability.' },
  placeimeiorder: { core: 'PlaceOrder (channel “dhru”)', desc: 'XML parameters mapped to the service field schema (IMEI, MODELID, PROVIDERID, SN). REFERENCE → account-scoped idempotency.' },
  getimeiorder: { core: 'Order read + status mapping', desc: 'Named status translated to DHRU 0/1/3/4 at the edge; result summary in CODE.' },
}

export default function DhruPage() {
  const dhru = useDhru()
  const d = dhru.data
  const [selected, setSelected] = useState<ApiLogEntry | null>(null)

  return (
    <div>
      <PageHeader
        icon={<PlugZap />}
        title="DHRU compatibility"
        description="Existing DHRU Fusion reseller clients keep working unchanged. Translation to ORVEX happens only at this edge — Core never sees numeric statuses."
        eyebrow={d && <Badge tone={d.enabled ? 'success' : 'neutral'} dot>{d.enabled ? 'Endpoint enabled' : 'Endpoint disabled'}</Badge>}
        actions={
          <Button variant="secondary" leading={<CloudDownload />} to="/admin/migration">
            DHRU migration importer
          </Button>
        }
      />

      {dhru.isError ? (
        <Card>
          <QueryError error={dhru.error} onRetry={() => dhru.refetch()} />
        </Card>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-card">
            <span className="mono-label">Endpoint</span>
            <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-fg">{d?.endpoint ?? '…'}</code>
            {d && <CopyButton value={d.endpoint} label="Copy endpoint URL" className="size-7" />}
            <span className="hidden text-[12px] text-fg-3 md:inline">POST · form fields · JSON response · apiversion 6.1</span>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Requests · 24h" value={d ? num(d.requests24h) : '—'} loading={dhru.isLoading} footer="All DHRU actions" />
            <KpiCard label="Errors · 24h" value={d ? <span className={d.errors24h ? 'text-warning' : undefined}>{num(d.errors24h)}</span> : '—'} loading={dhru.isLoading} footer="{ERROR:[…]} responses" />
            <KpiCard label="Orders today via DHRU" value={d ? num(d.ordersToday) : '—'} loading={dhru.isLoading} footer="Same order engine" />
            <KpiCard label="Connected accounts" value={d ? num(d.connectedAccounts.length) : '—'} loading={dhru.isLoading} footer="Active DHRU-enabled keys" />
          </div>

          <FlowDiagram />

          <div className="grid gap-5 xl:grid-cols-2">
            <ConnectedAccounts d={d} loading={dhru.isLoading} />
            <MappingTable d={d} />
          </div>

          <Card>
            <CardHeader title="Supported actions" description="Everything else returns {ERROR:[{MESSAGE:'Unsupported action …'}]}" />
            <CardBody className="grid gap-3 sm:grid-cols-2">
              {(d?.actions ?? Object.keys(ACTIONS)).map((a) => (
                <div key={a} className="rounded-xl border border-line p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <code className="font-mono text-[13px] font-semibold text-fg">{a}</code>
                    <span className="text-[11.5px] text-fg-3">→ {ACTIONS[a]?.core ?? 'Core'}</span>
                  </div>
                  <p className="mt-1 text-[12.5px] text-fg-3">{ACTIONS[a]?.desc}</p>
                </div>
              ))}
            </CardBody>
          </Card>

          <DhruConsole overview={d} />

          <RecentRequests rows={d?.recent} loading={dhru.isLoading} onOpen={setSelected} />

          <Card className="relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
            <CardBody className="relative flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-[14px] font-semibold">Moving from a DHRU Fusion panel?</h3>
                <p className="mt-0.5 max-w-xl text-[12.5px] text-fg-3">The migration importer scans a DHRU export (services, clients, price groups, supplier connections, balances) and shows exactly what would be created — existing resellers keep their integration through this endpoint.</p>
              </div>
              <Button variant="primary" trailing={<ArrowUpRight />} to="/admin/migration">
                Open importer
              </Button>
            </CardBody>
          </Card>
        </div>
      )}

      <LogDrawer entry={selected ? ({ ...selected, accountName: d?.connectedAccounts.find((a) => a.id === selected.accountId)?.name ?? null, orderRef: null } as LogRow) : undefined} open={!!selected} onClose={() => setSelected(null)} dhruEndpoint={d?.endpoint} />
    </div>
  )
}

function FlowNode({ icon, title, sub, accent, children }: { icon: ReactNode; title: string; sub: string; accent?: boolean; children?: ReactNode }) {
  return (
    <div className={accent ? 'relative min-w-0 flex-1 rounded-xl border border-accent/40 bg-accent/[0.05] p-3.5' : 'relative min-w-0 flex-1 rounded-xl border border-line bg-surface p-3.5'}>
      <div className="flex items-center gap-2">
        <span className={accent ? 'grid size-7 place-items-center rounded-lg bg-accent/15 text-accent-ink [&_svg]:size-3.5' : 'grid size-7 place-items-center rounded-lg border border-line bg-surface-2 text-fg-2 [&_svg]:size-3.5'}>{icon}</span>
        <span className="text-[13px] font-semibold text-fg">{title}</span>
      </div>
      <p className="mt-1.5 text-[12px] leading-snug text-fg-3">{sub}</p>
      {children}
    </div>
  )
}

function Arrow({ label }: { label: string }) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center gap-1 px-1 py-1 lg:py-0">
      <span className="font-mono text-[10px] text-fg-3">{label}</span>
      <ArrowRight className="size-4 rotate-90 text-fg-3 lg:rotate-0" />
    </div>
  )
}

function FlowDiagram() {
  return (
    <Card>
      <CardHeader icon={<Workflow />} title="How a DHRU request becomes an ORVEX order" description="Protocol translation exists only at the edge — one order engine behind every channel." />
      <CardBody>
        <div className="flex flex-col items-stretch gap-1 lg:flex-row">
          <FlowNode icon={<Server />} title="DHRU client" sub="Reseller’s existing DHRU Fusion panel or POS. Unchanged.">
            <code className="mt-2 block truncate font-mono text-[10.5px] text-fg-3">action=placeimeiorder</code>
          </FlowNode>
          <Arrow label="form POST" />
          <FlowNode icon={<PlugZap />} title="DHRU-compatible endpoint" sub="Edge translation: username + apiaccesskey → account + key; XML params → field input; status → 0/1/3/4." accent />
          <Arrow label="command" />
          <FlowNode icon={<Cog />} title="PlaceOrder" sub="Same command as storefront, portal, Native API and admin: validate, price, hold funds, idempotency." />
          <Arrow label="" />
          <FlowNode icon={<Boxes />} title="Same order engine" sub="Ledger, priority routing + guarded failover, suppliers, webhooks, notifications." />
        </div>
      </CardBody>
    </Card>
  )
}

function ConnectedAccounts({ d, loading }: { d: DhruOverview | undefined; loading: boolean }) {
  type Row = DhruOverview['connectedAccounts'][number]
  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'Account',
      sortValue: (r) => r.name,
      cell: (r) => (
        <Link to={`/admin/accounts/${r.id}`} className="font-medium text-fg hover:text-accent-ink">
          {r.name}
        </Link>
      ),
    },
    { key: 'user', header: 'username', cell: (r) => <span className="block max-w-[200px] truncate font-mono text-[12px] text-fg-2">{r.username}</span> },
    { key: 'key', header: 'Key', hideBelow: 'md', cell: (r) => <span className="font-mono text-[11.5px] text-fg-3">{r.keyPrefix}</span> },
    { key: 'last', header: 'Last used', hideBelow: 'sm', sortValue: (r) => (r.lastUsedAt ? new Date(r.lastUsedAt).getTime() : 0), cell: (r) => <span className="text-[12.5px] whitespace-nowrap text-fg-2">{sinceShort(r.lastUsedAt)}</span> },
    { key: 'orders', header: 'Orders · 7d', align: 'right', sortValue: (r) => r.orders7d, cell: (r) => <span className="tabular">{num(r.orders7d)}</span> },
  ]
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Connected accounts" description="Accounts with an active DHRU-compatible key" />
      <DataTable columns={columns} rows={d?.connectedAccounts} loading={loading} rowKey={(r) => r.id} dense minWidth={480} skeletonRows={5} empty={<EmptyState compact icon={<PlugZap />} title="No DHRU clients" description="Enable DHRU compatibility on an account’s API key." />} />
    </Card>
  )
}

function MappingTable({ d }: { d: DhruOverview | undefined }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Status mapping" description="Applied on the way out in getimeiorder — ORVEX keeps named statuses internally" />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[460px] text-[12.5px]">
          <thead>
            <tr className="border-y border-line bg-surface-2/50 text-left text-[11.5px] text-fg-3">
              <th className="px-5 py-2 font-medium">DHRU</th>
              <th className="px-3 py-2 font-medium">ORVEX status</th>
              <th className="px-5 py-2 font-medium">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(d?.mapping ?? []).map((m) => (
              <tr key={m.dhru} className="align-top">
                <td className="px-5 py-3">
                  <span className="flex items-center gap-2">
                    <span className="grid size-7 place-items-center rounded-lg border border-line bg-surface-2 font-mono text-[13px] font-semibold text-fg">{m.dhru}</span>
                    <span className="text-fg-2">{m.label}</span>
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span className="flex flex-wrap gap-1">
                    {m.orvex.map((s) => (
                      <OrderStatusBadge key={s} status={s as OrderStatus} />
                    ))}
                  </span>
                </td>
                <td className="px-5 py-3 text-fg-3">{m.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function RecentRequests({ rows, loading, onOpen }: { rows: ApiLogEntry[] | undefined; loading: boolean; onOpen: (l: ApiLogEntry) => void }) {
  const columns: Column<ApiLogEntry>[] = [
    { key: 'time', header: 'Time', cell: (l) => <span className="font-mono text-[12px] text-fg-2">{time(l.at, true)}</span> },
    { key: 'action', header: 'Action', cell: (l) => <code className="font-mono text-[12px] text-fg">{l.endpoint.match(/\((\w+)\)/)?.[1] ?? l.endpoint}</code> },
    { key: 'status', header: 'HTTP', cell: (l) => <StatusCode status={l.status} /> },
    { key: 'result', header: 'Result', cell: (l) => <StatusBadge status={l.errorCode ? 'error' : 'success'} label={l.errorCode ? 'ERROR' : 'SUCCESS'} noPulse /> },
    { key: 'key', header: 'Key', hideBelow: 'md', cell: (l) => <span className="font-mono text-[11.5px] text-fg-3">{l.keyPrefix ?? '—'}</span> },
    { key: 'ip', header: 'IP', hideBelow: 'lg', cell: (l) => <span className="font-mono text-[11.5px] text-fg-3">{l.ip}</span> },
  ]
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Recent DHRU requests"
        description="Latest 30 — every request is also in API logs"
        actions={
          <Button size="sm" variant="ghost" trailing={<ArrowUpRight />} to="/admin/developer/logs?protocol=dhru">
            All DHRU logs
          </Button>
        }
      />
      <DataTable columns={columns} rows={rows} loading={loading} rowKey={(l) => l.id} onRowClick={onOpen} dense minWidth={560} skeletonRows={6} empty={<EmptyState compact icon={<PlugZap />} title="No DHRU traffic yet" />} />
    </Card>
  )
}
