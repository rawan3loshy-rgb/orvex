import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, BadgeDollarSign, BookOpen, Boxes, FileCheck2, FormInput, Gauge, KeyRound, Layers, ListChecks, Route, ShoppingCart, Terminal, Wallet, Webhook } from 'lucide-react'
import { Badge, Button, Card, CardBody, CardHeader, DataTable, EmptyState, Skeleton, StatusBadge, type Column } from '@/components/ui'
import { Guarded, Money } from '@/components/domain'
import { useApiLogStats, useApiLogs, useOrder, useOrders, usePricing } from '@/hooks/installation'
import type { ApiLogEntry } from '@/types/installation'
import { cn } from '@/lib/cn'
import { ms, num, pct, time } from '@/lib/format'
import { ApiFlow, DirectionHero } from '../integrations/flow'
import { PricingTierChip } from '../accounts/shared'
import { tierColor } from '../accounts/helpers'
import { MethodBadge, StatusCode } from './shared'
import { sinceShort } from './helpers'
import { useApiClients, type ApiClientRow } from './clients/data'

/**
 * Reseller API (outbound): external businesses consume ORVEX's API.
 * The reseller's system talks to ORVEX only — never to a supplier.
 */
export default function ResellerApiPage() {
  const stats = useApiLogStats()
  const clients = useApiClients()
  const s = stats.data
  return (
    <div>
      <DirectionHero
        direction="outbound"
        title="ORVEX Reseller API"
        description="Give resellers and external applications programmatic access to ORVEX services, pricing and order processing — with their own keys, permissions, prices and limits."
        actions={
          <>
            <Guarded permission="developer.manage">
              {(ok) => (
                <Button variant="accent" leading={<KeyRound />} disabled={!ok} to={ok ? '/admin/developer/keys?create=1' : undefined}>
                  Issue API key
                </Button>
              )}
            </Guarded>
            <Button leading={<BookOpen />} to="/admin/developer/api">
              Documentation
            </Button>
            <Button variant="ghost" leading={<Terminal />} to="/admin/developer/api?view=console">
              API console
            </Button>
          </>
        }
        aside={
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
            <HeroStat label="Clients" value={clients.data ? num(clients.data.length) : null} />
            <HeroStat label="Req · 24h" value={s ? num(s.requests24h) : null} />
            <HeroStat label="Errors" value={s ? pct(s.errorRate, 1) : null} tone={s && s.errorRate > 5 ? 'text-warning' : undefined} />
          </div>
        }
        other={{ to: '/admin/integrations/providers', label: 'Provider integrations', text: 'ORVEX consumes supplier APIs' }}
      >
        <ApiFlow
          nodes={[
            { title: 'ABC GSM website', sub: 'reseller’s own system', side: 'external' },
            { title: 'ORVEX API', sub: 'REST v1 · API key · permissions', side: 'orvex' },
            { title: 'ORVEX service', sub: 'fields · reseller price · access', side: 'orvex' },
            { title: 'Supplier offer', sub: 'routing · guarded failover', side: 'orvex' },
            { title: 'Supplier API', sub: 'provider adapter (inbound side)', side: 'external' },
          ]}
        />
      </DirectionHero>

      <Capabilities />

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ClientsPreview clients={clients.data} loading={clients.isLoading} />
        <OrderTrace />
      </div>
    </div>
  )
}

function HeroStat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="min-w-0 bg-surface/90 px-3 py-2.5">
      <div className="mono-label whitespace-nowrap">{label}</div>
      {value == null ? <Skeleton className="mt-1.5 h-5 w-10" /> : <div className={cn('mt-1 font-display text-[19px] leading-none font-semibold tabular', tone ?? 'text-fg')}>{value}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/*  What a reseller can do                                                    */
/* ------------------------------------------------------------------------- */
const CAPABILITIES: { icon: ReactNode; title: string; call: string; text: string; anchor: string }[] = [
  { icon: <Boxes />, title: 'Available services', call: 'GET /v1/services', text: 'Only the services in the client’s access list.', anchor: 'list-services' },
  { icon: <FormInput />, title: 'Service fields', call: 'GET /v1/services/{id}', text: 'Input fields and validation from the ORVEX revision.', anchor: 'get-service' },
  { icon: <BadgeDollarSign />, title: 'Reseller pricing', call: 'price on every service', text: 'The client’s tier price — supplier cost is never exposed.', anchor: 'list-services' },
  { icon: <ShoppingCart />, title: 'Create orders', call: 'POST /v1/orders', text: 'Idempotent; same order engine as every channel.', anchor: 'create-order' },
  { icon: <ListChecks />, title: 'Order status', call: 'GET /v1/orders/{id}', text: 'One public status model, whatever the supplier.', anchor: 'get-order' },
  { icon: <FileCheck2 />, title: 'Results', call: 'result on the order', text: 'Structured result fields from the ORVEX schema.', anchor: 'get-order' },
  { icon: <Wallet />, title: 'Balance', call: 'GET /v1/account', text: 'Available, held and credit limit — ledger-backed.', anchor: 'get-account' },
  { icon: <Webhook />, title: 'Webhooks', call: 'order.completed …', text: 'Signed pushes with retries and replay.', anchor: 'webhook-events' },
]

const CONTROLS: { icon: ReactNode; title: string; text: string; to: string }[] = [
  { icon: <KeyRound />, title: 'API keys & permissions', text: 'Scopes, IP allow-list, per-key rate limit, test/live', to: '/admin/developer/keys' },
  { icon: <Layers />, title: 'Service access', text: 'All services or selected categories per client', to: '/admin/developer/clients' },
  { icon: <BadgeDollarSign />, title: 'Pricing', text: 'Each client buys at its price tier', to: '/admin/pricing' },
  { icon: <Gauge />, title: 'Rate limits', text: 'Orders/min, daily orders, concurrency, max value', to: '/admin/developer/clients' },
]

function Capabilities() {
  return (
    <Card>
      <CardHeader icon={<Route />} title="What a reseller’s system can do" description="Everything goes through ORVEX: the reseller never sees which supplier fulfils an order." />
      <CardBody className="pt-0">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {CAPABILITIES.map((c) => (
            <Link key={c.title} to={`/admin/developer/api#${c.anchor}`} className="group rounded-lg border border-line px-3.5 py-3 transition-colors hover:border-line-strong hover:bg-surface-2/40">
              <div className="flex items-center gap-2 text-[13px] font-medium [&_svg]:size-3.5 [&_svg]:text-fg-3">
                {c.icon}
                {c.title}
              </div>
              <div className="mt-1 font-mono text-[11.5px] text-accent-ink">{c.call}</div>
              <div className="mt-0.5 text-[11.5px] text-fg-3">{c.text}</div>
            </Link>
          ))}
        </div>
        <div className="mt-4 mb-2 text-[12.5px] font-medium">Controlled per client</div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {CONTROLS.map((c) => (
            <Link key={c.title} to={c.to} className="flex items-start gap-2.5 rounded-lg bg-surface-2/60 px-3 py-2.5 transition-colors hover:bg-surface-2">
              <span className="mt-0.5 text-fg-2 [&_svg]:size-3.5">{c.icon}</span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-medium">{c.title}</span>
                <span className="block text-[11.5px] text-fg-3">{c.text}</span>
              </span>
            </Link>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}

/* ------------------------------------------------------------------------- */
/*  Clients preview                                                          */
/* ------------------------------------------------------------------------- */
function ClientsPreview({ clients, loading }: { clients: ApiClientRow[] | undefined; loading: boolean }) {
  const navigate = useNavigate()
  const pricing = usePricing()
  const columns: Column<ApiClientRow>[] = [
    { key: 'name', header: 'Client', cell: (c) => <span className="font-medium">{c.row.account.name}</span> },
    { key: 'tier', header: 'Price tier', cell: (c) => <PricingTierChip name={c.row.tierName} color={tierColor(pricing.data?.tiers, c.row.account.pricingTierId)} /> },
    { key: 'keys', header: 'Keys', align: 'right', cell: (c) => <span className="tabular">{c.activeKeys}</span> },
    { key: 'req', header: 'Req · 24h', align: 'right', cell: (c) => <span className="tabular">{num(c.requests24h)}</span> },
    { key: 'last', header: 'Last call', hideBelow: 'md', cell: (c) => <span className="text-[12px] text-fg-2">{sinceShort(c.lastUsedAt)}</span> },
  ]
  return (
    <Card className="min-w-0 self-start overflow-hidden">
      <CardHeader
        title="API clients"
        description="Resellers and apps selling ORVEX services from their own systems"
        actions={
          <Link to="/admin/developer/clients" className="inline-flex shrink-0 items-center gap-1 text-[12.5px] text-accent-ink hover:underline">
            All clients <ArrowRight className="size-3.5" />
          </Link>
        }
      />
      <DataTable columns={columns} rows={clients?.slice(0, 7)} loading={loading} rowKey={(c) => c.row.account.id} onRowClick={(c) => navigate(`/admin/developer/clients?client=${c.row.account.id}`)} dense minWidth={420} />
    </Card>
  )
}

/* ------------------------------------------------------------------------- */
/*  One reseller order, end to end                                           */
/* ------------------------------------------------------------------------- */
const TRACE_ACCOUNT = 'acc_abcgsm'

function OrderTrace() {
  // The latest completed order ABC GSM placed through the native API, and the request that created it.
  const orders = useOrders({ channel: 'api', status: 'completed', accountId: TRACE_ACCOUNT, pageSize: 1 })
  const ref = orders.data?.items[0]?.ref
  const logs = useApiLogs({ protocol: 'native', accountId: TRACE_ACCOUNT, status: 'ok', search: '/v1/orders', pageSize: 200 })
  const posts = logs.data?.items.filter((l) => l.method === 'POST' && l.path === '/v1/orders' && l.orderRef)
  const entry = posts?.find((l) => l.orderRef === ref) ?? posts?.[0]
  return (
    <Card className="min-w-0 self-start">
      <CardHeader icon={<Route />} title="A reseller order, end to end" description="The latest API order from ABC GSM — from its website, through ORVEX, to the supplier and back." />
      <CardBody className="pt-0">
        {logs.isLoading || orders.isLoading ? <Skeleton className="h-72" /> : entry ? <Trace entry={entry} /> : <EmptyState compact title="No API orders yet" description="Place one from the API console to see the full path." />}
      </CardBody>
    </Card>
  )
}

function Trace({ entry }: { entry: ApiLogEntry & { accountName: string | null; orderRef: string | null } }) {
  const q = useOrder(entry.orderRef ?? undefined)
  if (!q.data) return <Skeleton className="h-72" />
  const { order, service, webhooks, supplierNames, driverCalls } = q.data
  const attempt = order.attempts[order.attempts.length - 1]
  const submit = attempt ? driverCalls.find((c) => c.attemptId === attempt.id && c.operation === 'submit') : undefined
  const hook = webhooks.find((w) => w.event === 'order.completed') ?? webhooks[0]
  return (
    <ol className="relative space-y-3 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-px before:bg-line">
      <Step n={1} title={entry.accountName ?? 'Reseller'} external>
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <MethodBadge method="POST" size="xs" /> <span className="font-mono">/v1/orders</span> <StatusCode status={entry.status} /> · {ms(entry.latencyMs)} · {time(entry.at, true)}
        </span>
        <span className="block font-mono text-[11px] text-fg-3">
          key {entry.keyPrefix ?? '—'}… {entry.idempotencyKey && <>· Idempotency-Key {entry.idempotencyKey}</>}
        </span>
      </Step>
      <Step n={2} title="ORVEX API">
        Key, scope, service access and limits checked · <Money value={order.price.amount} className="font-mono text-fg" /> ({order.price.tierName} price) held on the wallet
      </Step>
      <Step n={3} title="ORVEX service">
        <Link to={`/admin/services/${service.id}`} className="text-fg hover:underline">
          {service.name}
        </Link>{' '}
        · #{service.code} · rev {q.data.revision.number}
      </Step>
      <Step n={4} title="Supplier offer">
        {attempt ? (
          <>
            Routed to <span className="text-fg">{supplierNames[attempt.supplierId] ?? attempt.supplierId}</span> · cost <Money value={attempt.cost} className="font-mono" />
            {order.attempts.length > 1 && <Badge tone="warning" className="ml-1.5">failover · attempt {attempt.n}</Badge>}
          </>
        ) : (
          'Not routed yet'
        )}
      </Step>
      <Step n={5} title="Supplier API" external>
        {submit ? (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <MethodBadge method={submit.method} size="xs" /> <span className="font-mono">{submit.endpoint}</span> · {submit.outcome}
            {attempt?.externalRef && <span className="font-mono text-fg-3">· ref {attempt.externalRef}</span>}
          </span>
        ) : (
          'Waiting for dispatch'
        )}
      </Step>
      <Step n={6} title="Result back through ORVEX" done={order.status === 'completed'}>
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <StatusBadge status={order.status} />
          {order.result && <span className="text-fg">{order.result.summary}</span>}
        </span>
        <span className="block text-[11.5px] text-fg-3">
          {hook ? (
            <>
              Webhook {hook.event} · {hook.status}
            </>
          ) : (
            'Client polls GET /v1/orders/{id}'
          )}{' '}
          ·{' '}
          <Link to={`/admin/orders/${order.ref}`} className="font-mono text-accent-ink hover:underline">
            {order.ref}
          </Link>
        </span>
      </Step>
    </ol>
  )
}

function Step({ n, title, children, external, done }: { n: number; title: string; children: ReactNode; external?: boolean; done?: boolean }) {
  return (
    <li className="relative flex gap-3">
      <span className={cn('relative z-10 grid size-6 shrink-0 place-items-center rounded-full border font-mono text-[11px]', external ? 'border-dashed border-line-strong bg-surface text-fg-3' : done ? 'border-success/40 bg-success/10 text-success' : 'border-accent/40 bg-accent/[0.08] text-accent-ink')}>{n}</span>
      <div className="min-w-0 pt-0.5">
        <div className="text-[12.5px] font-semibold">
          {title} {external && <span className="ml-1 text-[11px] font-normal text-fg-3">external</span>}
        </div>
        <div className="mt-0.5 text-[12px] text-fg-2">{children}</div>
      </div>
    </li>
  )
}
