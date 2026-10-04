import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Ban, Clock, Coins, Copy, Layers, ListOrdered, RotateCw, SearchX, Tag, TrendingUp, Undo2 } from 'lucide-react'
import { ServiceIcon } from '@/components/brand'
import { Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, KpiCard, PageHeader, Skeleton, StatusBadge } from '@/components/ui'
import { useInstMutation, useOrder, useProviders, useService, useServiceMappings } from '@/hooks/installation'
import { ordersService } from '@/services/installation'
import { toast } from '@/stores/toast'
import { dateTime, duration, money, relative } from '@/lib/format'
import type { OrderDetail, Service } from '@/types/installation'
import { CHANNEL_LABEL, deviceOf, isInFlight, marginOf, readResult, span, useNow } from './lib'
import { OrderLifecycle, StageRail } from './OrderLifecycle'
import { ClientCard, ErrorCard, InputCard, RequestCard, ResultCard, WebhooksCard } from './OrderPanels'
import { RoutingCard } from './RoutingCard'

export default function OrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const order = useOrder(id)
  const o = order.data
  const service = useService(o?.serviceId)
  const mappings = useServiceMappings(o?.serviceId)
  const providers = useProviders()
  const inflight = !!o && isInFlight(o.status)
  const now = useNow(inflight, 250)
  const [confirm, setConfirm] = useState<'refund' | 'cancel' | null>(null)

  // Announce when the order settles while it is being watched.
  const prevStatus = useRef<string | null>(null)
  useEffect(() => {
    if (!o) return
    const prev = prevStatus.current
    prevStatus.current = o.status
    if (!prev || prev === o.status || !isInFlight(prev as OrderDetail['status'])) return
    if (o.status === 'success') toast.success(`Order #${o.number} completed`, o.result ? readResult(o.result).headline : undefined)
    else if (o.status === 'failed') toast.error(`Order #${o.number} failed`, o.error?.message)
  }, [o])
  useEffect(() => {
    prevStatus.current = null
  }, [id])

  const retry = useInstMutation((orderId: string) => ordersService.retry(orderId), {
    error: 'Retry failed',
    onSuccess: (n) => {
      toast.success(`Retry created as #${n.number}`, 'Following the new order live.')
      navigate(`/admin/orders/${n.id}`)
    },
  })
  const refund = useInstMutation((orderId: string) => ordersService.refund(orderId), { success: (r) => `Order #${r.number} refunded`, error: 'Refund failed', onSuccess: () => setConfirm(null) })
  const cancel = useInstMutation((orderId: string) => ordersService.cancel(orderId), { success: (r) => `Order #${r.number} cancelled`, error: 'Could not cancel order', onSuccess: () => setConfirm(null) })

  if (order.isLoading) return <DetailSkeleton />

  if (order.isError || !o) {
    const notFound = (order.error as { status?: number } | null)?.status === 404
    return (
      <div>
        <BackLink />
        <Card className="mt-4">
          <EmptyState
            icon={<SearchX />}
            title={notFound ? 'Order not found' : 'Could not load this order'}
            description={notFound ? `No order matches “${id}”. It may belong to another installation or the demo data was reset.` : 'The installation API did not respond. Try again in a moment.'}
            action={
              <div className="flex gap-2">
                {!notFound && (
                  <Button size="sm" variant="secondary" onClick={() => order.refetch()}>
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

  const svc = service.data
  const margin = marginOf(o)
  const elapsed = (o.completedAt ? new Date(o.completedAt).getTime() : now) - new Date(o.createdAt).getTime()
  const failovers = Math.max(0, o.attempts.length - 1)
  const device = deviceOf(o.input)
  const supplier = providers.data?.find((p) => p.id === o.providerId)

  return (
    <div>
      <PageHeader
        eyebrow={<BackLink />}
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="tabular">#{o.number}</span>
            <StatusBadge status={o.status} size="md" className="translate-y-px" />
            {inflight && (
              <Badge tone="accent" variant="outline" size="md" dot pulse className="translate-y-px">
                Live
              </Badge>
            )}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <ServiceIcon icon={svc?.icon ?? 'box'} category={o.serviceCategory} size="sm" className="size-5.5 rounded-[5px] [&_svg]:size-3" />
            <Link to={`/admin/services/${o.serviceId}`} className="font-medium text-fg hover:underline">
              {o.serviceName}
            </Link>
            {device && (
              <>
                <span className="text-fg-3">·</span>
                <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
                  <span className="font-mono text-[10px] tracking-wider text-fg-3 uppercase">{device.label}</span>
                  <span className="font-mono text-[12.5px] text-fg-2 tabular">{device.display}</span>
                </span>
              </>
            )}
            <span className="text-fg-3">·</span>
            <span title={relative(o.createdAt)}>Created {dateTime(o.createdAt)}</span>
            <span className="text-fg-3">·</span>
            <span>{CHANNEL_LABEL[o.channel]}</span>
          </span>
        }
        actions={
          <>
            <Button
              variant="secondary"
              leading={<Copy />}
              onClick={() => {
                navigator.clipboard?.writeText(o.id).catch(() => undefined)
                toast.success('Order ID copied', o.id)
              }}
            >
              Copy ID
            </Button>
            {(o.status === 'created' || o.status === 'pending') && (
              <Button variant="secondary" leading={<Ban />} onClick={() => setConfirm('cancel')}>
                Cancel
              </Button>
            )}
            {o.status === 'success' && (
              <Button variant="secondary" leading={<Undo2 />} onClick={() => setConfirm('refund')}>
                Refund
              </Button>
            )}
            {o.status === 'failed' && (
              <Button variant="accent" leading={<RotateCw />} loading={retry.isPending} onClick={() => retry.mutate(o.id)}>
                Retry order
              </Button>
            )}
          </>
        }
      />

      {/* Summary */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard icon={<Tag />} label="Price" value={money(o.price)} footer={o.resellerName ? `Charged to ${o.resellerName}` : o.channel === 'website' ? 'Website checkout' : 'Internal order'} />
        <KpiCard
          icon={<Coins />}
          label="Supplier cost"
          value={o.cost > 0 ? money(o.cost) : '—'}
          footer={o.cost > 0 ? (supplier?.shortName ?? o.providerName ?? 'Supplier') : o.status === 'failed' ? 'Not billed — no supplier accepted' : inflight ? 'Known once accepted' : 'No supplier charge'}
        />
        <KpiCard
          icon={<TrendingUp />}
          label="Margin"
          value={margin == null ? '—' : <span className={margin < 0 ? 'text-danger' : undefined}>{money(margin)}</span>}
          footer={margin == null ? (o.status === 'failed' ? 'No revenue on failed orders' : 'Pending acceptance') : inflight ? 'Projected' : o.status === 'refunded' ? 'Supplier cost not recoverable' : o.price ? `${((margin / o.price) * 100).toFixed(1)}% of price` : undefined}
        />
        <KpiCard
          icon={<Clock />}
          label={inflight ? 'Elapsed' : 'Turnaround'}
          value={<span className={inflight ? 'text-accent-ink' : undefined}>{o.status === 'cancelled' && !o.attempts.length ? '—' : span(elapsed)}</span>}
          footer={svc ? `Expected ${expected(svc)}` : undefined}
        />
        <KpiCard
          icon={<Layers />}
          label="Attempts"
          value={o.attempts.length}
          className="col-span-2 md:col-span-1"
          footer={o.attempts.length === 0 ? 'Not routed yet' : failovers ? `${failovers} fallback${failovers === 1 ? '' : 's'} · ${o.attempts.length} suppliers` : o.attempts[0]!.outcome === 'success' ? 'Accepted on first attempt' : 'Single supplier'}
        />
      </div>

      <div className="mb-5">
        <RoutingCard order={o} service={svc} providers={providers.data} mappings={mappings.data} now={now} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card className="self-start">
          <CardHeader
            icon={<ListOrdered />}
            title="Lifecycle"
            description={`${o.events.length} events · ${inflight ? `${span(elapsed)} so far` : `${span(elapsed)} end to end`}`}
            actions={
              inflight ? (
                <Badge tone="accent" dot pulse>
                  Updating
                </Badge>
              ) : (
                <StatusBadge status={o.status} noPulse />
              )
            }
          />
          <div className="mx-5 mb-5 border-b border-line pb-4">
            <StageRail order={o} service={svc} providers={providers.data} />
          </div>
          <div className="px-5 pt-1 pb-6">
            <OrderLifecycle order={o} service={svc} now={now} />
          </div>
        </Card>

        <div className="space-y-5">
          <ErrorCard order={o} />
          <ResultCard order={o} service={svc} />
          <InputCard order={o} service={svc} />
          <ClientCard order={o} />
          <RequestCard order={o} />
          <WebhooksCard order={o} />
        </div>
      </div>

      <ConfirmDialog
        open={confirm === 'refund'}
        onClose={() => setConfirm(null)}
        onConfirm={() => refund.mutate(o.id)}
        loading={refund.isPending}
        tone="danger"
        title={`Refund order #${o.number}?`}
        confirmLabel={`Refund ${money(o.price)}`}
        description={
          o.resellerName
            ? `${money(o.price)} will be credited back to ${o.resellerName}’s balance and a refund transaction recorded.`
            : 'The order will be marked as refunded. Settle the payment with the customer outside ORVEX.'
        }
      >
        {o.cost > 0 && <p className="rounded-lg border border-line bg-surface-2/60 px-3 py-2 text-[12.5px] text-fg-3">The supplier cost of {money(o.cost)} is already paid{supplier ? ` to ${supplier.shortName}` : ''} and is not recoverable — it will reduce margin.</p>}
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === 'cancel'}
        onClose={() => setConfirm(null)}
        onConfirm={() => cancel.mutate(o.id)}
        loading={cancel.isPending}
        tone="danger"
        title={`Cancel order #${o.number}?`}
        confirmLabel="Cancel order"
        description="The order is withdrawn from the routing queue and will not be submitted to any further suppliers."
      />
    </div>
  )
}

function expected(s: Service) {
  const { min, max } = s.turnaround
  return min === max ? duration(min) : `${duration(min)}–${duration(max)}`
}

function BackLink() {
  return (
    <Link to="/admin/orders" className="inline-flex items-center gap-1.5 text-fg-3 transition-colors hover:text-fg">
      <ArrowLeft className="size-3.5" />
      Orders
    </Link>
  )
}

function DetailSkeleton() {
  return (
    <div className="animate-fade-up">
      <div className="mb-6 space-y-2.5">
        <Skeleton className="h-3 w-16" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-3.5 w-80 max-w-full" />
      </div>
      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-[112px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="mb-5 h-[230px] rounded-xl" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card className="p-5">
          <Skeleton className="mb-6 h-4 w-32" />
          <div className="space-y-6">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="flex gap-3.5">
                <Skeleton className="size-7 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <div className="space-y-5">
          <Skeleton className="h-[180px] rounded-xl" />
          <Skeleton className="h-[200px] rounded-xl" />
          <Skeleton className="h-[160px] rounded-xl" />
        </div>
      </div>
    </div>
  )
}
