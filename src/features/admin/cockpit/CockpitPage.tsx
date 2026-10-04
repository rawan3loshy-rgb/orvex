import { Link } from 'react-router'
import { CloudDownload, CodeXml, Landmark, PackageX, Plus, RefreshCw, ShieldAlert, Users, Webhook } from 'lucide-react'
import { Badge, Button, Card, Dot, EmptyState, PageHeader } from '@/components/ui'
import { Money } from '@/components/domain'
import { useCockpit } from '@/hooks/installation'
import type { CockpitData } from '@/types/installation'
import { cn } from '@/lib/cn'
import { duration, num, relative } from '@/lib/format'
import { age, useNow } from '../orders/helpers'
import { AlertsCard, CheckTile, CockpitSkeleton, FeedCard, ListCard, ListRow, MoneyCard, StripCell, SupplierStrip, ThroughputCard } from './parts'

export default function CockpitPage() {
  const q = useCockpit()
  const now = useNow(1000)
  const d = q.data

  if (q.isLoading) return <CockpitSkeleton />
  if (q.isError || !d)
    return (
      <div>
        <PageHeader title="Operations cockpit" />
        <Card>
          <EmptyState
            icon={<ShieldAlert />}
            title="Could not load the cockpit"
            description={(q.error as Error | null)?.message ?? 'The installation API did not respond.'}
            action={
              <Button size="sm" variant="secondary" leading={<RefreshCw />} onClick={() => q.refetch()}>
                Retry
              </Button>
            }
          />
        </Card>
      </div>
    )

  const secs = Math.max(0, Math.round((now - q.dataUpdatedAt) / 1000))

  return (
    <div>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <Dot tone="accent" pulse />
            <span className="tabular">Live · updated {secs}s ago · refresh 4s</span>
          </span>
        }
        title="Operations cockpit"
        description="Are orders flowing, are suppliers answering, is money moving correctly? Every figure opens the screen that explains it."
        actions={
          <>
            <Button variant="secondary" to="/admin/orders">
              All orders
            </Button>
            <Button variant="accent" leading={<Plus />} to="/admin/orders?create=1">
              Create order
            </Button>
          </>
        }
      />

      <StatusStrip d={d} now={now} />

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 content-start gap-4">
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="min-w-0 lg:col-span-3">
              <ThroughputCard data={d.throughput} />
            </div>
            <div className="min-w-0 lg:col-span-2">
              <MoneyCard m={d.money} />
            </div>
          </div>

          <SupplierStrip suppliers={d.suppliers} />

          <Checks d={d} />

          <div className="grid gap-4 lg:grid-cols-3">
            <ListCard title="Negative margin" description="Prices below the current supplier cost" to="/admin/pricing?guard=negative_margin" toLabel="Pricing" empty="Every tier price covers its supplier cost." count={d.catalog.negativeMargin.length}>
              {d.catalog.negativeMargin.slice(0, 6).map((n) => (
                <ListRow key={`${n.serviceId}_${n.tier}`} to={`/admin/services/${n.serviceId}`} title={n.name} sub={`${n.tier} tier`} right={<Money value={n.margin} className="font-mono text-danger" />} />
              ))}
            </ListCard>
            <ListCard title="Unavailable services" description="No routable supplier offer right now" to="/admin/services?availability=unavailable" toLabel="Services" empty="All active services can be routed." count={d.catalog.unavailable.length}>
              {d.catalog.unavailable.slice(0, 6).map((u) => (
                <ListRow key={u.id} to={`/admin/services/${u.id}`} title={u.name} sub={u.reason || 'No eligible offer'} />
              ))}
            </ListCard>
            <ListCard title="Accounts needing attention" description="Low wallet balance or frozen" to="/admin/accounts?attention=1" toLabel="Accounts" empty="No blocked or low-balance accounts." count={d.accounts.frozen.length + d.accounts.lowBalance.length}>
              {[
                ...d.accounts.frozen.map((a) => <ListRow key={`f_${a.id}`} to={`/admin/accounts/${a.id}`} title={a.name} sub={a.reason ?? 'Frozen'} right={<Badge tone="danger">Frozen</Badge>} />),
                ...d.accounts.lowBalance.map((a) => <ListRow key={`l_${a.id}`} to={`/admin/accounts/${a.id}`} title={a.name} sub="Below low-balance alert" right={<Money value={a.available} className="font-mono text-warning" />} />),
              ].slice(0, 7)}
            </ListCard>
          </div>
        </div>

        <div className="grid min-w-0 content-start gap-4 xl:sticky xl:top-20 xl:self-start">
          <AlertsCard alerts={d.alerts} />
          <FeedCard feed={d.feed} now={now} />
        </div>
      </div>
    </div>
  )
}

function StatusStrip({ d, now }: { d: CockpitData; now: number }) {
  const o = d.orders
  const delta = o.yesterdaySameTime ? ((o.today - o.yesterdaySameTime) / o.yesterdaySameTime) * 100 : null
  const review = o.needsReview > 0
  return (
    <Card className="overflow-hidden">
      <div className="-mr-px -mb-px grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-8">
        <Link
          to="/admin/orders?status=needs_review"
          className={cn(
            'group relative col-span-2 flex min-w-0 flex-col justify-between gap-2 border-r border-b border-line px-5 py-3.5 transition-colors md:col-span-3 xl:col-span-2',
            review ? 'bg-danger/[0.07] hover:bg-danger/10' : 'hover:bg-surface-2/60',
          )}
        >
          {review && <span className="absolute inset-y-0 left-0 w-[3px] bg-danger" />}
          <span className="flex items-center justify-between gap-2">
            <span className={cn('mono-label', review && 'text-danger!')}>Needs review</span>
            {review && (
              <Badge tone="danger" dot pulse>
                Action required
              </Badge>
            )}
          </span>
          <span className="flex items-baseline gap-2">
            <span className={cn('font-display text-[30px] leading-none font-semibold tracking-[-0.03em] tabular', review ? 'text-danger' : 'text-fg')}>{o.needsReview}</span>
            <span className="text-[12px] text-fg-3">{review ? `oldest waiting ${age(o.oldestReviewAt, now)}` : 'nothing waiting'}</span>
          </span>
          <span className="truncate text-[11.5px] text-fg-3">{review ? 'Supplier outcome unknown · failover blocked · funds held' : 'No order has an unknown supplier outcome'}</span>
        </Link>
        <StripCell label="Orders today" value={num(o.today)} to="/admin/orders?range=24h" sub={`${num(o.yesterdaySameTime)} yesterday at this time${delta != null && o.yesterdaySameTime >= 10 ? ` · ${delta >= 0 ? '+' : ''}${delta.toFixed(0)}%` : ''}`} />
        <StripCell label="Success · 24h" value={`${o.successRate24h.toFixed(1)}%`} tone={o.successRate24h < 85 ? 'danger' : o.successRate24h < 95 ? 'warning' : undefined} to="/admin/orders?status=rejected&range=24h" sub={`${num(o.completedToday)} completed · ${num(o.rejectedToday)} rejected today`} />
        <StripCell label="Median processing" value={o.medianProcessingSec ? duration(o.medianProcessingSec) : '—'} to="/admin/orders?status=completed&range=24h" sub="created → completed, 24 h" />
        <StripCell label="In flight" value={num(o.processing + o.queued)} to="/admin/orders?status=open" sub={`${num(o.processing)} processing · ${num(o.queued)} queued`} />
        <StripCell label="Awaiting payment" value={num(o.awaitingPayment)} to="/admin/orders?status=awaiting_payment" sub="checkout started, not paid" />
        <StripCell label="Verifications" value={num(d.verifications.open + d.verifications.awaitingSupplier)} tone={d.verifications.open ? 'warning' : undefined} to="/admin/verifications" sub={`${d.verifications.open} open · ${d.verifications.awaitingSupplier} at supplier`} />
      </div>
    </Card>
  )
}

function Checks({ d }: { d: CockpitData }) {
  const apiTone = d.api.errorRate > 5 ? 'danger' : d.api.errorRate > 2 ? 'warning' : 'success'
  const whTone = d.webhooks.failingEndpoints ? 'danger' : d.webhooks.retrying ? 'warning' : 'success'
  const ledgerTone = d.ledger.status === 'fail' ? 'danger' : d.ledger.status === 'warn' ? 'warning' : 'success'
  const attention = d.accounts.frozen.length + d.accounts.lowBalance.length
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <CheckTile icon={<CodeXml />} label="API error rate · 24h" value={`${d.api.errorRate.toFixed(2)}%`} tone={apiTone} to="/admin/developer/logs?status=error" sub={`${num(d.api.errors24h)} of ${num(d.api.requests24h)} requests · ${num(d.api.dhruRequests24h)} via DHRU endpoint`} />
      <CheckTile icon={<Webhook />} label="Webhook endpoints failing" value={num(d.webhooks.failingEndpoints)} tone={whTone} to="/admin/developer/webhooks?status=failing" sub={`${num(d.webhooks.failed24h)} failed · ${num(d.webhooks.retrying)} retrying · ${num(d.webhooks.delivered24h)} delivered (24 h)`} />
      <CheckTile
        icon={<Landmark />}
        label="Ledger integrity"
        value={d.ledger.status === 'pass' ? 'Balanced' : d.ledger.status === 'warn' ? 'Attention' : 'Failing'}
        tone={ledgerTone}
        to="/admin/finance/integrity"
        sub={`${d.ledger.failures} failing · ${d.ledger.warnings} warnings · checked ${relative(d.ledger.checkedAt)}`}
      />
      <CheckTile icon={<PackageX />} label="Unavailable services" value={num(d.catalog.unavailable.length)} tone={d.catalog.unavailable.length ? 'warning' : 'success'} to="/admin/services?availability=unavailable" sub={d.catalog.unavailable.length ? d.catalog.unavailable.map((u) => u.name).join(', ') : 'Every active service has a routable offer'} />
      <CheckTile icon={<CloudDownload />} label="Pending catalog changes" value={num(d.catalog.pendingSyncChanges)} tone={d.catalog.pendingSyncChanges ? 'warning' : 'neutral'} to="/admin/catalog/sync" sub={`Supplier price / field changes awaiting review · ${d.catalog.lowMargin} low-margin prices`} />
      <CheckTile icon={<Users />} label="Accounts blocked or low" value={num(attention)} tone={d.accounts.frozen.length ? 'danger' : attention ? 'warning' : 'success'} to="/admin/accounts?attention=1" sub={`${d.accounts.frozen.length} frozen · ${d.accounts.lowBalance.length} below low-balance alert`} />
    </div>
  )
}
