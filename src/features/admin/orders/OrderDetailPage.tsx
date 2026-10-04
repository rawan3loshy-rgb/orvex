import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Ban, Eye, Fingerprint, History, RefreshCw, SearchX, Undo2, User } from 'lucide-react'
import { Badge, Button, Card, CardHeader, CopyButton, EmptyState, Skeleton, Tooltip } from '@/components/ui'
import { ChannelBadge, FinancialBadge, Guarded, Money, OrderStatusBadge, OrderTimeline, ScenarioTag } from '@/components/domain'
import { ACCOUNT_TIER_LABEL } from '@/core/domain'
import { formatBps } from '@/core/money'
import { DHRU_STATUS_LABEL, type DhruStatus } from '@/core/edge/dhru'
import { useOrder } from '@/hooks/installation'
import { toast } from '@/stores/toast'
import type { OrderDetail, OrderEvent } from '@/types/installation'
import { cn } from '@/lib/cn'
import { dateTime, relative } from '@/lib/format'
import { FlashProvider, KV } from './lib'
import { CancelModal, RefundModal } from './detail/ActionModals'
import { ReviewPanel, ResolutionSummary } from './detail/ReviewPanel'
import { InputSection, LedgerSection, MoneyFlowSection, OutboundSection, PriceSection, ResultSection, RoutingSection, VerificationsSection, WireLogSection } from './detail/Panels'

const LIVE = ['awaiting_payment', 'queued', 'processing', 'needs_review']

const SECTION_FOR: Record<NonNullable<OrderEvent['ref']>['kind'], string> = {
  attempt: 'sec-routing',
  ledger: 'sec-ledger',
  payment: 'sec-payment',
  refund: 'sec-payment',
  notification: 'sec-outbound',
  webhook: 'sec-outbound',
  verification: 'sec-verification',
  audit: '',
  supplier: '',
}

export default function OrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const q = useOrder(id)
  const d = q.data
  const [modal, setModal] = useState<'cancel' | 'refund' | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const focus = useCallback((domId: string, fallback?: string) => {
    const el = document.getElementById(domId) ?? (fallback ? document.getElementById(fallback) : null)
    if (!el) {
      toast.info('Record not shown on this page')
      return
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setFlash(el.id)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setFlash(null), 2200)
  }, [])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  // Announce when a watched order changes status.
  const prev = useRef<string | null>(null)
  useEffect(() => {
    if (!d) return
    const was = prev.current
    prev.current = d.order.status
    if (was && was !== d.order.status) toast.info(`${d.order.ref} is now ${d.order.status.replace('_', ' ')}`)
  }, [d])
  useEffect(() => {
    prev.current = null
  }, [id])

  const onRef = (ref: NonNullable<OrderEvent['ref']>) => {
    if (ref.kind === 'supplier') return navigate(`/admin/suppliers/${ref.id}`)
    if (ref.kind === 'audit') return navigate(`/admin/system/audit?search=${encodeURIComponent(d?.order.ref ?? ref.id)}`)
    focus(`${ref.kind}-${ref.id}`, SECTION_FOR[ref.kind] || undefined)
  }

  if (q.isLoading) return <DetailSkeleton />
  if (q.isError || !d) {
    const notFound = (q.error as { status?: number } | null)?.status === 404
    return (
      <div>
        <BackLink />
        <Card className="mt-4">
          <EmptyState
            icon={<SearchX />}
            title={notFound ? 'Order not found' : 'Could not load this order'}
            description={notFound ? `No order matches “${id}”. The demo data may have been reset.` : ((q.error as Error | null)?.message ?? 'The installation API did not respond.')}
            action={
              <div className="flex gap-2">
                {!notFound && (
                  <Button size="sm" variant="secondary" leading={<RefreshCw />} onClick={() => q.refetch()}>
                    Retry
                  </Button>
                )}
                <Button size="sm" variant="primary" to="/admin/orders">
                  Back to orders
                </Button>
              </div>
            }
          />
        </Card>
      </div>
    )
  }

  const o = d.order
  const live = LIVE.includes(o.status)
  const canCancel = o.status === 'awaiting_payment' || o.status === 'queued'
  const canRefund = o.financialStatus === 'captured' || o.financialStatus === 'partially_refunded'
  const margin = o.supplierCost != null ? o.price.amount - o.supplierCost : null
  const marginBps = margin != null && o.price.amount ? Math.round((margin / o.price.amount) * 10_000) : null

  return (
    <FlashProvider value={flash}>
      <div className="grid gap-4">
        {/* Header */}
        <div>
          <BackLink />
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h1 className="flex items-center gap-1.5 font-mono text-[24px] font-semibold tracking-[-0.02em]">
                  {o.ref}
                  <CopyButton value={o.ref} label="Copy reference" />
                </h1>
                <OrderStatusBadge status={o.status} />
                <FinancialBadge status={o.financialStatus} />
                {o.scenario && <ScenarioTag id={o.scenario} />}
                {live && (
                  <Badge tone="accent" variant="outline" dot pulse>
                    Live
                  </Badge>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-fg-2">
                <Link to={`/admin/services/${d.service.id}`} className="font-medium text-fg hover:underline">
                  {o.serviceName}
                </Link>
                <span className="font-mono text-[11.5px] text-fg-3">{d.service.code}</span>
                <span className="text-fg-3">·</span>
                <ChannelBadge channel={o.channel} />
                <span className="text-fg-3">·</span>
                <Link to={`/admin/accounts/${d.account.id}`} className="hover:underline">
                  {d.account.kind === 'guest' ? `${d.account.email} (guest)` : d.account.name}
                </Link>
                <Badge tone="neutral">{ACCOUNT_TIER_LABEL[d.account.tier]}</Badge>
                {d.account.status !== 'active' && <Badge tone="danger">{d.account.status}</Badge>}
              </div>
              <div className="mt-1.5 text-[12px] text-fg-3">
                Created <span title={dateTime(o.createdAt)}>{relative(o.createdAt)}</span> · updated <span title={dateTime(o.updatedAt)}>{relative(o.updatedAt)}</span>
                {o.completedAt && <> · finished {dateTime(o.completedAt)}</>}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {canCancel && (
                <Guarded permission="orders.manage">
                  {(allowed) => (
                    <Button variant="secondary" leading={<Ban />} disabled={!allowed} onClick={() => setModal('cancel')}>
                      Cancel order
                    </Button>
                  )}
                </Guarded>
              )}
              {canRefund && (
                <Guarded permission="refunds.create">
                  {(allowed) => (
                    <Button variant="primary" leading={<Undo2 />} disabled={!allowed || d.refundable <= 0} onClick={() => setModal('refund')}>
                      Refund
                    </Button>
                  )}
                </Guarded>
              )}
              {!canCancel && !canRefund && (
                <Tooltip content={o.status === 'processing' ? 'A supplier has the order — it can no longer be cancelled' : o.status === 'needs_review' ? 'Resolve the review below' : 'No actions available in this state'}>
                  <span className="text-[12px] text-fg-3">No order actions available</span>
                </Tooltip>
              )}
            </div>
          </div>
        </div>

        {/* What the customer sees */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-line bg-surface-2/40 px-4 py-2.5 text-[12.5px]">
          <span className="flex items-center gap-2 text-fg-3">
            <Eye className="size-3.5" /> Customer sees
          </span>
          <span className="flex items-center gap-2">
            <span className="font-mono text-[12px] text-fg">{d.publicStatus.status}</span>
            {d.publicStatus.detail && <span className="font-mono text-[12px] text-fg-3">· {d.publicStatus.detail}</span>}
          </span>
          <span className="flex items-center gap-2">
            <span className="text-fg-3">DHRU status</span>
            <span className="rounded-md bg-surface-3 px-1.5 font-mono text-[12px] font-semibold">{d.dhruStatus}</span>
            <span className="text-fg-3">{DHRU_STATUS_LABEL[d.dhruStatus as DhruStatus] ?? ''}</span>
          </span>
          {o.status === 'needs_review' && <span className="text-[11.5px] text-fg-3">Internal review status is never exposed to customers or resellers.</span>}
        </div>

        {/* Needs review */}
        {o.status === 'needs_review' && o.review && <ReviewPanel d={d} onFocusAttempt={(aid) => focus(`attempt-${aid}`, 'sec-routing')} />}
        {o.review?.resolution && <ResolutionSummary review={o.review} />}

        {/* KPI strip */}
        <Card className="overflow-hidden">
          <div className="-mr-px -mb-px grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            <Kpi label="Price snapshot" value={<Money value={o.price.amount} />} sub={`${o.price.tierName} · ${o.price.ruleLabel}`} />
            <Kpi label="Supplier cost" value={o.supplierCost != null ? <Money value={o.supplierCost} /> : '—'} sub={o.supplierCost != null ? 'fulfilling attempt' : o.price.referenceCost != null ? <>ref. cost <Money value={o.price.referenceCost} /></> : 'not fulfilled'} />
            <Kpi label="Margin" value={margin != null ? <Money value={margin as never} tone="auto" /> : '—'} sub={marginBps != null ? formatBps(marginBps) : 'after completion'} tone={margin != null && margin < 0 ? 'danger' : undefined} />
            <Kpi label="Held now" value={<Money value={d.held} />} sub={d.held > 0 ? 'reserved in Customer Held' : 'nothing held'} tone={d.held > 0 ? 'warning' : undefined} />
            <Kpi label="Refunded" value={<Money value={o.refundedTotal} />} sub={canRefund ? <>refundable <Money value={d.refundable} /></> : o.refundedTotal > 0 ? 'refunded in full' : '—'} className="col-span-2 sm:col-span-1" />
          </div>
        </Card>

        {/* Body */}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="grid min-w-0 content-start gap-4">
            <RoutingSection d={d} />
            <ResultSection d={d} />
            <div className="grid gap-4 2xl:grid-cols-2">
              <InputSection d={d} />
              <PriceSection d={d} />
            </div>
            <LedgerSection d={d} />
            <MoneyFlowSection d={d} />
            <VerificationsSection d={d} />
            <OutboundSection d={d} />
            <WireLogSection d={d} />
          </div>

          <div className="grid min-w-0 content-start gap-4 xl:sticky xl:top-20 xl:self-start">
            <Card>
              <CardHeader
                icon={<History />}
                title="Timeline"
                description={live ? 'Live — refreshes every 2 s' : `${o.events.length} events`}
                actions={
                  live ? (
                    <Badge tone="accent" variant="outline" dot pulse>
                      Live
                    </Badge>
                  ) : undefined
                }
              />
              <div className="max-h-[calc(100vh-340px)] min-h-[200px] overflow-y-auto px-5 pb-5">
                <OrderTimeline events={o.events} onRef={onRef} live={live} />
              </div>
            </Card>
            <Card>
              <CardHeader icon={<Fingerprint />} title="Request" />
              <div className="divide-y divide-line/70 px-5 pb-4">
                <KV k="Order id" v={<span className="inline-flex items-center gap-1">{o.id}<CopyButton value={o.id} /></span>} mono />
                <KV k="Idempotency key" v={o.idempotencyKey ? <span className="inline-flex items-center gap-1">{o.idempotencyKey}<CopyButton value={o.idempotencyKey} /></span> : <span className="text-fg-3">none</span>} mono />
                <KV k="Client reference" v={o.clientReference ?? <span className="text-fg-3">—</span>} mono />
                <KV k="Placed by" v={<PlacedBy d={d} />} />
                <KV k="Channel" v={o.channel} mono />
                <KV k="Service revision" v={`r${o.serviceRevision}`} mono />
                <KV k="Account" v={<Link className="hover:underline" to={`/admin/accounts/${d.account.id}`}>{d.account.number}</Link>} mono />
                {o.trackingToken && <KV k="Tracking token" v={<span title="Private guest tracking token">{o.trackingToken.slice(0, 6)}…{o.trackingToken.slice(-4)}</span>} mono />}
              </div>
            </Card>
          </div>
        </div>
      </div>

      <CancelModal open={modal === 'cancel'} onClose={() => setModal(null)} d={d} />
      <RefundModal open={modal === 'refund'} onClose={() => setModal(null)} d={d} />
    </FlashProvider>
  )
}

function PlacedBy({ d }: { d: OrderDetail }) {
  const a = d.order.placedBy
  return (
    <span className="inline-flex items-center gap-1.5">
      <User className="size-3 text-fg-3" />
      {a.name}
      <span className="font-mono text-[11px] text-fg-3">
        {a.type}
        {a.role ? ` · ${a.role}` : ''}
      </span>
    </span>
  )
}

function Kpi({ label, value, sub, tone, className }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'danger' | 'warning'; className?: string }) {
  return (
    <div className={cn('min-w-0 border-r border-b border-line px-4 py-3', className)}>
      <div className="mono-label truncate">{label}</div>
      <div className={cn('mt-1.5 truncate font-display text-[20px] leading-none font-semibold tracking-[-0.02em] tabular', tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-fg')}>{value}</div>
      {sub && <div className="mt-1.5 truncate text-[11.5px] text-fg-3">{sub}</div>}
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/admin/orders" className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-3 hover:text-fg">
      <ArrowLeft className="size-3.5" /> Orders
    </Link>
  )
}

function DetailSkeleton() {
  return (
    <div className="grid gap-4">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-4 w-[420px] max-w-full" />
      </div>
      <Skeleton className="h-11 rounded-xl" />
      <Skeleton className="h-[86px] rounded-xl" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid gap-4">
          <Skeleton className="h-[360px] rounded-xl" />
          <Skeleton className="h-[220px] rounded-xl" />
        </div>
        <Skeleton className="h-[560px] rounded-xl" />
      </div>
    </div>
  )
}
