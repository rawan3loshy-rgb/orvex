import { Link, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, CircleSlash, ExternalLink, Pause, Play, Route } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Skeleton, StatusBadge, Tabs } from '@/components/ui'
import { ServiceIcon } from '@/components/brand'
import { Guarded, Money } from '@/components/domain'
import { useInstMutation, useService } from '@/hooks/installation'
import { catalogService } from '@/services/installation'
import type { ServiceDetail } from '@/types/installation'
import { ErrorPanel } from '../catalog/kit'
import { PROCESSING_LABEL, turnaroundLabel } from '../catalog/helpers'
import { OverviewTab } from './detail/OverviewTab'
import { FieldsTab } from './detail/FieldsTab'
import { OffersTab } from './detail/OffersTab'
import { PricingTab } from './detail/PricingTab'
import { ChannelsTab, OrdersTab } from './detail/ChannelsTab'

type TabId = 'overview' | 'fields' | 'offers' | 'pricing' | 'channels' | 'orders'
const TABS: TabId[] = ['overview', 'fields', 'offers', 'pricing', 'channels', 'orders']

export default function ServiceDetailPage() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const q = useService(id)
  const raw = params.get('tab') as TabId | null
  const tab: TabId = raw && TABS.includes(raw) ? raw : 'overview'
  const setTab = (t: TabId) => {
    const next = new URLSearchParams(params)
    if (t === 'overview') next.delete('tab')
    else next.set('tab', t)
    setParams(next, { replace: true })
  }

  if (q.isLoading) return <DetailSkeleton />
  if (q.isError || !q.data)
    return (
      <div>
        <BackLink />
        {q.isError ? <ErrorPanel error={q.error} onRetry={() => q.refetch()} /> : <Card><EmptyState title="Service not found" /></Card>}
      </div>
    )

  const d = q.data
  return (
    <div>
      <BackLink />
      <Header d={d} onTab={setTab} />
      <Tabs
        className="mb-5"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'overview', label: 'Overview' },
          { value: 'fields', label: 'Fields & revisions', count: `v${d.revision.number}` },
          { value: 'offers', label: 'Offers & routing', count: `${d.availability.routableOffers}/${d.availability.totalOffers}` },
          { value: 'pricing', label: 'Pricing', count: d.quotes.some((x) => x.guard === 'negative_margin') ? '!' : undefined },
          { value: 'channels', label: 'Channels' },
          { value: 'orders', label: 'Orders', count: d.stats.orders30d },
        ]}
      />
      <div key={tab} className="animate-fade-up">
        {tab === 'overview' && <OverviewTab d={d} onTab={setTab} />}
        {tab === 'fields' && <FieldsTab d={d} />}
        {tab === 'offers' && <OffersTab d={d} />}
        {tab === 'pricing' && <PricingTab d={d} />}
        {tab === 'channels' && <ChannelsTab d={d} />}
        {tab === 'orders' && <OrdersTab d={d} />}
      </div>
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/admin/services" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] text-fg-3 hover:text-fg">
      <ArrowLeft className="size-3.5" /> Services
    </Link>
  )
}

function Header({ d, onTab }: { d: ServiceDetail; onTab: (t: TabId) => void }) {
  const s = d.service
  const setStatus = useInstMutation((status: 'active' | 'paused') => catalogService.updateService(s.id, { status }), { success: (_, st) => (st === 'active' ? `${s.name} activated` : `${s.name} paused`) })
  const retail = d.quotes[0]
  return (
    <div className="mb-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <ServiceIcon icon={s.icon} size="lg" />
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2 text-[12.5px] text-fg-3">
              <span className="font-mono">#{s.code}</span>
              <span>·</span>
              <span>{d.category.name}</span>
              <span>·</span>
              <span>
                {PROCESSING_LABEL[s.processing]} · {turnaroundLabel(s.turnaround)}
              </span>
            </div>
            <h1 className="font-display text-[26px] leading-tight font-semibold tracking-[-0.025em]">{s.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={s.status} />
              {d.availability.available ? (
                <Badge tone="success" dot>
                  Available · {d.availability.routableOffers} of {d.availability.totalOffers} offers routable
                </Badge>
              ) : (
                <Badge tone="danger" dot pulse={s.status === 'active'}>
                  Unavailable
                </Badge>
              )}
              <Badge tone="neutral" variant="outline">
                Revision {d.revision.number}
              </Badge>
              {retail && (
                <Badge tone="neutral" variant="outline">
                  {retail.tierName} <Money value={retail.amount} />
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {s.visibility.storefront && s.status === 'active' && (
            <Button size="sm" variant="ghost" leading={<ExternalLink />} to={`/site/services/${s.slug}`}>
              Storefront
            </Button>
          )}
          <Guarded permission="catalog.manage">
            {(ok) =>
              s.status === 'active' ? (
                <Button size="sm" leading={<Pause />} disabled={!ok} loading={setStatus.isPending} onClick={() => setStatus.mutate('paused')}>
                  Pause
                </Button>
              ) : (
                <Button size="sm" variant="accent" leading={<Play />} disabled={!ok || s.status === 'archived'} loading={setStatus.isPending} onClick={() => setStatus.mutate('active')}>
                  Activate
                </Button>
              )
            }
          </Guarded>
        </div>
      </div>

      {!d.availability.available && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger/[0.06] px-4 py-3.5 sm:flex-row sm:items-center">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-danger/12 text-danger">
            <CircleSlash className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold text-danger">{d.availability.reason ?? 'Unavailable'}</div>
            <div className="text-[12.5px] text-fg-2">
              {d.availability.totalOffers === 0
                ? 'Add a supplier offer so orders have somewhere to go.'
                : `${d.availability.routableOffers} of ${d.availability.totalOffers} offers can take orders. `}
              {s.whenUnavailable === 'hide' ? 'The service is hidden from the storefront and portal until an offer recovers.' : 'Customers see it as unavailable — no order is accepted and no money is held.'}
            </div>
          </div>
          <Button size="sm" leading={<Route />} onClick={() => onTab('offers')}>
            Review offers
          </Button>
        </div>
      )}
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div>
      <Skeleton className="mb-4 h-4 w-24" />
      <div className="mb-6 flex items-start gap-3.5">
        <Skeleton className="size-11 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-48" />
          <Skeleton className="h-7 w-80" />
          <Skeleton className="h-5 w-64" />
        </div>
      </div>
      <Skeleton className="mb-5 h-10 w-full" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-xl lg:col-span-2" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  )
}
