import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowRight, Check, ChevronRight, CloudDownload, Info, Link2, PackageSearch, Scale, ScrollText, ShieldCheck } from 'lucide-react'
import { Badge, Button, Card, CardBody, CardHeader, CodeBlock, DataTable, EmptyState, SecretField, Segmented, Stat, StatusBadge, type Column } from '@/components/ui'
import { TimeChart, UptimeBars } from '@/components/charts'
import { Guarded, Money, SimulatedBadge } from '@/components/domain'
import { sub, type Micros } from '@/core/money'
import type { DriverCall, SupplierDetail, SyncChange } from '@/types/installation'
import { cn } from '@/lib/cn'
import { dateTime, ms, num, time } from '@/lib/format'
import { BalanceMeter, KV, RelTime } from '../../catalog/kit'
import { CLASS_LABEL, DRIVER_OPERATIONS, OUTCOMES, payloadLang, prettyPayload } from '../../catalog/helpers'
import { MapProductModal } from './MapProductModal'

/* ------------------------------- Overview ------------------------------- */
export function OverviewTab({ d }: { d: SupplierDetail }) {
  const s = d.supplier
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardBody className="grid grid-cols-2 gap-5 pt-5 md:grid-cols-4">
          <Stat label="Success 7d" value={`${d.metrics.successRate.toFixed(1)}%`} tone={d.metrics.successRate < 94 ? 'warning' : undefined} sub={`${num(d.metrics.attempts)} attempts`} />
          <Stat label="Latency p50" value={d.metrics.latencyP50 ? ms(d.metrics.latencyP50) : '—'} sub={`p95 ${d.metrics.latencyP95 ? ms(d.metrics.latencyP95) : '—'}`} />
          <Stat label="Unknown outcomes" value={num(d.metrics.unknown)} tone={d.metrics.unknown ? 'danger' : undefined} sub="sent to review, never failed over" />
          <Stat label="Attempts 24h" value={num(d.metrics.attempts24h)} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Balance" description="Reported by getBalance() vs low-balance threshold" />
        <CardBody>
          <Money value={s.reportedBalance} className={cn('font-display text-[26px] font-semibold', s.reportedBalance < s.lowBalanceThreshold && 'text-warning')} />
          <BalanceMeter value={s.reportedBalance} threshold={s.lowBalanceThreshold} className="mt-2" />
          <div className="mt-2 flex justify-between text-[11.5px] text-fg-3">
            <span>
              threshold <Money value={s.lowBalanceThreshold} />
            </span>
            <span>
              checked <RelTime iso={s.balanceCheckedAt} />
            </span>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Connection" description={<span className="inline-flex items-center gap-1.5">Environment: simulated <SimulatedBadge /></span>} />
        <CardBody className="space-y-3">
          <div className="divide-y divide-line">
            <KV label="URL" mono>
              {s.connection.url}
            </KV>
            <KV label="Username" mono>
              {s.connection.username ?? '—'}
            </KV>
            <KV label="Region">{s.region}</KV>
            <KV label="Callback">{s.callback.url ? `${s.callback.signing === 'hmac_sha256' ? 'HMAC-SHA256 signed' : 'unsigned'}` : 'Polling only'}</KV>
            <KV label="Connected">{dateTime(s.connectedAt)}</KV>
          </div>
          {s.connection.credentials.map((c) => (
            <div key={c.key}>
              <div className="mb-1 text-[11.5px] text-fg-3">{c.label}</div>
              <SecretField masked={c.masked} label={c.label} />
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Driver" description={`${d.driver.name} v${d.driver.version}`} />
        <CardBody>
          <p className="mb-3 rounded-md bg-surface-2 px-2.5 py-1.5 font-mono text-[11.5px] text-fg-2">{d.driver.protocol}</p>
          <ul className="space-y-1">
            {DRIVER_OPERATIONS.map((o) => (
              <li key={o.op} className="flex items-start gap-2 text-[12px]">
                <Check className="mt-0.5 size-3.5 shrink-0 text-success" />
                <span>
                  <span className="font-mono text-fg">{o.label}</span> <span className="text-fg-3">— {o.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Safety limits" />
        <CardBody className="divide-y divide-line pt-0">
          <KV label="Circuit breaker">
            <StatusBadge status={s.circuit.state === 'closed' ? 'healthy' : s.circuit.state === 'open' ? 'circuit_open' : 'half_open'} label={s.circuit.state.replace('_', '-')} />
          </KV>
          <KV label="Failure threshold">
            {s.circuit.consecutiveFailures}/{s.circuit.threshold} consecutive
          </KV>
          <KV label="Cooldown">{s.circuit.cooldownSec}s → half-open</KV>
          <KV label="Auth">
            {s.auth.status === 'ok' ? <Badge tone="success">OK</Badge> : <Badge tone="danger">Failed</Badge>} <span className="text-fg-3">· <RelTime iso={s.auth.checkedAt} /></span>
          </KV>
          {s.auth.message && <div className="py-1.5 text-[11.5px] text-danger">{s.auth.message}</div>}
          <KV label="Timeout">{ms(s.timeoutMs)} → outcome UNKNOWN</KV>
          <KV label="Rate limit">
            {s.rateLimit.requests} req / {s.rateLimit.perSeconds}s
          </KV>
          <KV label="Maintenance">{s.maintenance.active ? 'Active' : 'Off'}</KV>
        </CardBody>
      </Card>
    </div>
  )
}

/* ------------------------------- Products ------------------------------- */
type ProductItem = SupplierDetail['productList'][number]
type ProductFilter = 'all' | 'mapped' | 'unmapped' | 'removed'
const PRODUCT_FILTERS: ProductFilter[] = ['all', 'mapped', 'unmapped', 'removed']
const productMatches = (p: ProductItem, f: ProductFilter) => (f === 'all' ? true : f === 'mapped' ? p.offerCount > 0 : f === 'unmapped' ? p.offerCount === 0 && p.status === 'available' : p.status === 'removed')

export function ProductsTab({ d }: { d: SupplierDetail }) {
  const [params] = useSearchParams()
  const [filter, setFilter] = useState<ProductFilter>(() => PRODUCT_FILTERS.find((f) => f === params.get('filter')) ?? 'all')
  const [mapping, setMapping] = useState<ProductItem | null>(null)
  const rows = d.productList.filter((p) => productMatches(p, filter))
  const columns: Column<ProductItem>[] = [
    {
      key: 'name',
      header: 'Product',
      sortValue: (p) => p.name,
      cell: (p) => (
        <div className={cn(p.status === 'removed' && 'opacity-70')}>
          <div className="font-medium">
            {p.name} {p.status === 'removed' && <Badge tone="danger">removed</Badge>}
          </div>
          <div className="text-[11.5px] text-fg-3">
            <span className="font-mono">#{p.externalId}</span> · {p.groupName} · {p.processingHint}
          </div>
        </div>
      ),
    },
    { key: 'fields', header: 'Remote fields', hideBelow: 'lg', cell: (p) => <span className="font-mono text-[11.5px] text-fg-2">{p.remoteFields.join(', ') || '—'}</span> },
    {
      key: 'cost',
      header: 'Cost',
      align: 'right',
      sortValue: (p) => p.cost,
      cell: (p) => (
        <div>
          <Money value={p.cost} className="font-mono" />
          {p.previousCost != null && (
            <div className={cn('text-[11px]', p.cost > p.previousCost ? 'text-warning' : 'text-success')}>
              was <Money value={p.previousCost} />
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'services',
      header: 'Mapped services',
      sortValue: (p) => p.offerCount,
      cell: (p) =>
        p.services.length ? (
          <div className="flex flex-col gap-0.5">
            {p.services.map((s) => (
              <Link key={s.id} to={`/admin/services/${s.id}?tab=offers`} className="truncate text-[12px] hover:underline">
                <span className="mr-1 font-mono text-fg-3">P{s.priority}</span>
                {s.name}
              </Link>
            ))}
          </div>
        ) : (
          <span className="text-[12px] text-fg-3">not mapped</span>
        ),
    },
    { key: 'seen', header: 'Last seen', hideBelow: 'xl', cell: (p) => <RelTime iso={p.lastSeenAt} className="text-[12px] text-fg-3" /> },
    {
      key: 'map',
      header: '',
      align: 'right',
      cell: (p) =>
        p.status === 'available' ? (
          <Guarded permission="catalog.manage">
            {(ok) => (
              <Button size="xs" variant={p.offerCount ? 'ghost' : 'secondary'} leading={<Link2 />} disabled={!ok} onClick={() => setMapping(p)}>
                {p.offerCount ? 'Map again' : 'Map to service'}
              </Button>
            )}
          </Guarded>
        ) : null,
    },
  ]
  return (
    <Card>
      <CardHeader
        title="Supplier products"
        description="The provider’s catalog as synced — source data, not ORVEX services. The product owns the cost; mapping it to an ORVEX service creates an offer."
        actions={
          <Segmented
            size="xs"
            value={filter}
            onChange={setFilter}
            items={PRODUCT_FILTERS.map((f) => ({ value: f, label: f[0]!.toUpperCase() + f.slice(1), count: d.productList.filter((p) => productMatches(p, f)).length }))}
          />
        }
      />
      <DataTable columns={columns} rows={rows} rowKey={(p) => p.id} dense minWidth={820} empty={<EmptyState compact icon={<PackageSearch />} title="No products" description="Run a catalog sync to import the supplier’s products." />} />
      <MapProductModal product={mapping} supplierName={d.supplier.name} onClose={() => setMapping(null)} />
    </Card>
  )
}

/* ------------------------------- Sync ------------------------------- */
const KIND_LABEL: Record<SyncChange['kind'], string> = { new: 'New', price: 'Price', removed: 'Removed', fields: 'Fields', warning: 'Warnings' }

export function SyncTab({ d }: { d: SupplierDetail }) {
  const pending = d.changes.filter((c) => c.decision === 'pending')
  const byKind = (k: SyncChange['kind']) => pending.filter((c) => c.kind === k).length
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <CardHeader title="Sync runs" description="syncCatalog() diffs the remote list against stored products. Changes are reviewed — never applied silently (removals are auto-applied for safety)." icon={<CloudDownload />} />
        {d.syncRuns.length === 0 ? (
          <EmptyState compact title="No sync runs yet" />
        ) : (
          <div className="divide-y divide-line border-t border-line">
            {d.syncRuns.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
                <div className="w-40">
                  <div className="text-[12.5px]">{dateTime(r.startedAt)}</div>
                  <div className="text-[11px] text-fg-3">
                    {r.trigger} · {r.remoteProducts} remote
                  </div>
                </div>
                <StatusBadge status={r.status} />
                <div className="flex flex-1 flex-wrap gap-1">
                  {(Object.keys(KIND_LABEL) as SyncChange['kind'][]).map((k) =>
                    r.counts[k] ? (
                      <Badge key={k} tone={k === 'removed' ? 'danger' : k === 'price' || k === 'warning' ? 'warning' : 'neutral'} variant="outline">
                        {r.counts[k]} {KIND_LABEL[k].toLowerCase()}
                      </Badge>
                    ) : null,
                  )}
                  {r.error && <span className="text-[11.5px] text-danger">{r.error}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card>
        <CardHeader title="Pending review" description={`${pending.length} changes waiting`} />
        <CardBody className="space-y-2">
          {(Object.keys(KIND_LABEL) as SyncChange['kind'][]).map((k) => (
            <div key={k} className="flex items-center justify-between text-[12.5px]">
              <span className="text-fg-2">{KIND_LABEL[k]}</span>
              <span className={cn('font-mono tabular', byKind(k) ? 'text-fg' : 'text-fg-3')}>{byKind(k)}</span>
            </div>
          ))}
          <Link to={`/admin/catalog/sync?supplier=${d.supplier.id}`} className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-accent-ink hover:underline">
            Open change review <ArrowRight className="size-3.5" />
          </Link>
        </CardBody>
      </Card>
    </div>
  )
}

/* ------------------------------- Health ------------------------------- */
export function HealthTab({ d }: { d: SupplierDetail }) {
  const samples = useMemo(() => d.samples.slice().sort((a, b) => (a.at < b.at ? -1 : 1)), [d.samples])
  const last = samples.slice(-90)
  const okPct = samples.length ? (samples.filter((x) => x.ok).length / samples.length) * 100 : null
  const failures = samples.filter((x) => !x.ok).slice(-8).reverse()
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader title="Health checks" description={`${samples.length} probes · ${okPct != null ? okPct.toFixed(2) : '—'}% OK`} icon={<ShieldCheck />} />
        <CardBody>
          {last.length ? (
            <>
              <UptimeBars height={36} items={last.map((x) => ({ label: `${dateTime(x.at)} · ${x.ok ? 'OK' : x.note || 'failed'} · ${ms(x.latencyMs)}`, value: x.ok ? 100 : 0, status: x.ok ? (x.latencyMs > d.supplier.timeoutMs / 3 ? 'degraded' : 'operational') : 'outage' }))} />
              <div className="mt-1.5 flex justify-between text-[11px] text-fg-3">
                <span>{dateTime(last[0]!.at)}</span>
                <span>now</span>
              </div>
            </>
          ) : (
            <EmptyState compact title="No health samples yet" />
          )}
        </CardBody>
      </Card>
      {last.length > 1 && (
        <Card>
          <CardHeader title="Latency" description="Per probe, milliseconds" />
          <CardBody>
            <TimeChart data={last.map((x) => ({ t: x.at, latency: x.latencyMs }))} x={(p) => p.t} series={[{ key: 'latency', label: 'Latency', color: 'var(--c1)' }]} kind="area" height={180} yFormat={(v) => `${Math.round(v)}ms`} xFormat={(l) => time(l)} tooltipFormat={(v) => ms(v)} />
          </CardBody>
        </Card>
      )}
      {failures.length > 0 && (
        <Card>
          <CardHeader title="Recent failed probes" />
          <div className="divide-y divide-line border-t border-line">
            {failures.map((f, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-5 py-2 text-[12.5px]">
                <span className="text-fg-2">{f.note || 'Probe failed'}</span>
                <span className="text-[11.5px] text-fg-3">{dateTime(f.at)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

/* ------------------------------- Driver log ------------------------------- */
export function LogTab({ d }: { d: SupplierDetail }) {
  const [sel, setSel] = useState<string | null>(d.calls[0]?.id ?? null)
  const [op, setOp] = useState('all')
  const ops = Array.from(new Set(d.calls.map((c) => c.operation)))
  const calls = d.calls.filter((c) => op === 'all' || c.operation === op)
  const call = d.calls.find((c) => c.id === sel) ?? null
  const columns: Column<DriverCall>[] = [
    { key: 'at', header: 'Time', cell: (c) => <span className="font-mono text-[11.5px] text-fg-3">{time(c.at, true)}</span> },
    { key: 'op', header: 'Operation', cell: (c) => <span className="font-mono text-[12px]">{c.operation}()</span> },
    { key: 'ep', header: 'Request', hideBelow: 'lg', cell: (c) => <span className="truncate font-mono text-[11.5px] text-fg-2">{c.method} {c.endpoint}</span> },
    {
      key: 'status',
      header: 'Outcome',
      cell: (c) => (
        <span className="flex items-center gap-1.5">
          <Badge tone={c.ok ? 'success' : 'danger'}>{c.httpStatus ?? 'no response'}</Badge>
          <span className="truncate text-[11.5px] text-fg-3">{c.outcome}</span>
        </span>
      ),
    },
    { key: 'lat', header: 'Latency', align: 'right', cell: (c) => <span className="font-mono text-[12px] text-fg-2">{ms(c.latencyMs)}</span> },
  ]
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader
          title="Driver calls"
          description={`Wire-level record (simulated) · last ${d.calls.length}`}
          icon={<ScrollText />}
          actions={
            <select value={op} onChange={(e) => setOp(e.target.value)} className="h-7 rounded-md border border-line bg-surface px-2 text-[12px]">
              <option value="all">All operations</option>
              {ops.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          }
        />
        <DataTable columns={columns} rows={calls} rowKey={(c) => c.id} dense minWidth={520} selectedKey={sel} onRowClick={(c) => setSel(c.id)} empty={<EmptyState compact title="No driver calls recorded" />} />
      </Card>
      <div className="grid content-start gap-3">
        {call ? (
          <>
            <Card>
              <CardBody className="grid grid-cols-2 gap-x-6 pt-4 sm:grid-cols-3">
                <KV label="Operation" mono>
                  {call.operation}
                </KV>
                <KV label="HTTP">{call.httpStatus ?? '—'}</KV>
                <KV label="Latency">{ms(call.latencyMs)}</KV>
                <KV label="Outcome">{call.outcome}</KV>
                <KV label="Order">{call.orderId ? <Link to={`/admin/orders/${call.orderId}`} className="text-accent-ink hover:underline">open</Link> : '—'}</KV>
                <KV label="At">{dateTime(call.at)}</KV>
              </CardBody>
            </Card>
            <CodeBlock title={`request · ${call.method} ${call.endpoint}`} lang={payloadLang(call.request)} code={prettyPayload(call.request)} maxHeight={260} wrap />
            <CodeBlock title="response" lang={payloadLang(call.response)} code={prettyPayload(call.response) || '(no response — connection closed or timed out)'} maxHeight={300} wrap />
            {d.supplier.driver === 'dhru_fusion' && (
              <p className="flex items-start gap-1.5 text-[11.5px] text-fg-3">
                <Info className="mt-0.5 size-3.5 shrink-0" /> DHRU Fusion: HTTP form-POST (username, apiaccesskey, action, parameters) with a JSON response. Numeric statuses 0/1/3/4 are translated at the driver edge and never reach the order model.
              </p>
            )}
          </>
        ) : (
          <Card>
            <EmptyState compact title="Select a call" description="Request and response payloads appear here." />
          </Card>
        )}
      </div>
    </div>
  )
}

/* ------------------------------- Error mappings ------------------------------- */
export function ErrorMappingsTab({ d }: { d: SupplierDetail }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Card>
        <CardHeader title="Error mappings" description="Supplier message or code (case-insensitive substring) → classification. Unmapped rejections are terminal by default — the safe choice." />
        {d.supplier.errorMappings.length === 0 ? (
          <EmptyState compact title="No mappings" description="Every rejection from this supplier is treated as terminal (no failover)." />
        ) : (
          <div className="divide-y divide-line border-t border-line">
            {d.supplier.errorMappings.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
                <span className="min-w-[180px] flex-1 font-mono text-[12px]">“{m.match}”</span>
                <ChevronRight className="size-3.5 text-fg-3" />
                <Badge tone={CLASS_LABEL[m.classifyAs]!.tone}>{CLASS_LABEL[m.classifyAs]!.label}</Badge>
                <span className="w-full text-[11.5px] text-fg-3 sm:w-auto sm:flex-1">{m.note}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card>
        <CardHeader title="What each class means" />
        <div className="divide-y divide-line border-t border-line">
          {OUTCOMES.map((o) => (
            <div key={o.cls} className="px-4 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <Badge tone={o.tone}>{o.label}</Badge>
                <span className={cn('text-[11.5px] font-medium', o.failover === 'yes' ? 'text-success' : 'text-fg-3')}>{o.failover === 'yes' ? 'fails over' : 'no failover'}</span>
              </div>
              <div className="mt-1 text-[11.5px] text-fg-2">{o.examples}</div>
              <div className="text-[11.5px] text-fg-3">→ {o.then}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

/* ------------------------------- Reconciliation ------------------------------- */
export function ReconciliationTab({ d }: { d: SupplierDetail }) {
  const r = d.reconciliation
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Card>
        <CardHeader title="Expected vs actual" description="Ledger says what the supplier should hold; getBalance() says what it reports." icon={<Scale />} />
        <CardBody>
          <div className="divide-y divide-line rounded-lg border border-line">
            <Line label="Ledger · supplier prepaid" hint="top-ups − settled costs + credits" value={r.ledger} />
            <Line label="− In flight" hint="accepted, not yet settled" value={sub(0 as Micros, r.inFlight)} />
            <Line label="= Expected" value={r.expected} strong />
            <Line label="Actual (reported)" hint={`getBalance() · ${dateTime(d.supplier.balanceCheckedAt)}`} value={r.actual} strong />
            <Line label="Drift" value={r.drift} drift />
          </div>
          <p className="mt-3 text-[12px] text-fg-3">Unknown-outcome attempts are deliberately not in flight: if the supplier did process them, the drift shows exactly that amount — a signal to resolve the review.</p>
          <Link to={`/admin/finance/reconciliation?supplier=${d.supplier.id}`} className="mt-2 inline-flex items-center gap-1 text-[12.5px] text-accent-ink hover:underline">
            Finance reconciliation <ArrowRight className="size-3.5" />
          </Link>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Unknown-outcome orders" description="Possibly processed by the supplier" />
        {r.unknown.length === 0 ? (
          <EmptyState compact title="None" description="No attempts with an unknown outcome." />
        ) : (
          <div className="divide-y divide-line border-t border-line">
            {r.unknown.map((u) => (
              <Link key={u.orderId} to={`/admin/orders/${u.orderId}`} className="flex items-center justify-between px-4 py-2 hover:bg-surface-2/50">
                <span className="font-mono text-[12.5px]">{u.orderRef}</span>
                <Money value={u.cost as Micros} className="font-mono text-[12.5px]" />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function Line({ label, hint, value, strong, drift }: { label: string; hint?: string; value: Micros; strong?: boolean; drift?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 px-3.5 py-2.5', drift && value !== 0 && 'bg-warning/[0.06]')}>
      <div>
        <div className={cn('text-[12.5px]', strong || drift ? 'font-medium text-fg' : 'text-fg-2')}>{label}</div>
        {hint && <div className="text-[11px] text-fg-3">{hint}</div>}
      </div>
      <Money value={value} sign={drift} className={cn('font-mono text-[13px]', strong && 'font-semibold', drift && (value === 0 ? 'text-success' : 'text-warning'))} />
    </div>
  )
}
