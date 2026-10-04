import { Link } from 'react-router'
import { CircleCheck, Eye, Siren } from 'lucide-react'
import { Badge, Card, CardHeader, EmptyState, Segmented, Skeleton, StatusBadge, Timeline, type TimelineItem } from '@/components/ui'
import { useState } from 'react'
import { dateTime, duration, relative } from '@/lib/format'
import { useProviders } from '@/hooks/installation'
import type { HealthSnapshot, Provider } from '@/types/installation'

type Incident = HealthSnapshot['incidents'][number]

function linkFor(i: Incident, providers: Provider[]) {
  const supplier = providers.find((p) => p.name === i.component || p.shortName === i.component)
  if (supplier) return { to: `/admin/providers/${supplier.id}`, label: `Open ${supplier.shortName}` }
  if (/provider|supplier/i.test(i.component)) return { to: '/admin/providers', label: 'Open Providers' }
  if (/webhook/i.test(i.component)) return { to: '/admin/developer/webhooks', label: 'Open Webhooks' }
  if (/api/i.test(i.component)) return { to: '/admin/developer/logs', label: 'Open API logs' }
  if (/database/i.test(i.component)) return { to: '/admin/settings?tab=system', label: 'Database settings' }
  return null
}

export function IncidentsCard({ data }: { data: HealthSnapshot | undefined }) {
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all')
  const providers = useProviders()
  const incidents = data?.incidents ?? []
  const open = incidents.filter((i) => i.status !== 'resolved')
  const shown = incidents.filter((i) => (filter === 'all' ? true : filter === 'open' ? i.status !== 'resolved' : i.status === 'resolved'))

  const items: TimelineItem[] = shown.map((i) => {
    const link = linkFor(i, providers.data ?? [])
    const lasted = ((i.resolvedAt ? new Date(i.resolvedAt).getTime() : Date.now()) - new Date(i.startedAt).getTime()) / 1000
    return {
      id: i.id,
      tone: i.status === 'investigating' ? 'danger' : i.status === 'monitoring' ? 'warning' : 'success',
      icon: i.status === 'investigating' ? <Siren /> : i.status === 'monitoring' ? <Eye /> : <CircleCheck />,
      active: i.status !== 'resolved',
      time: dateTime(i.startedAt),
      title: (
        <span className="inline-flex flex-wrap items-center gap-2">
          {i.title}
          <StatusBadge status={i.status} />
        </span>
      ),
      detail: (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge tone="neutral" variant="outline">
            {i.component}
          </Badge>
          <span>{i.resolvedAt ? `Resolved after ${duration(lasted)}` : `Open for ${duration(lasted).replace(/ \d+s$/, '')} · started ${relative(i.startedAt)}`}</span>
          {link && (
            <Link to={link.to} className="text-accent-ink hover:underline">
              {link.label} →
            </Link>
          )}
        </span>
      ),
    }
  })

  return (
    <Card className="h-full">
      <CardHeader
        title="Incidents"
        description={data ? (open.length ? `${open.length} open · newest first` : 'No open incidents') : 'Loading…'}
        actions={
          <Segmented
            size="xs"
            value={filter}
            onChange={setFilter}
            items={[
              { value: 'all', label: 'All' },
              { value: 'open', label: 'Open', count: open.length || undefined },
              { value: 'resolved', label: 'Resolved' },
            ]}
          />
        }
      />
      <div className="px-5 pt-2 pb-5">
        {!data ? (
          <div className="space-y-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3.5">
                <Skeleton className="size-[27px] rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length ? (
          <Timeline items={items} />
        ) : (
          <EmptyState compact icon={<CircleCheck />} title={filter === 'open' ? 'No open incidents' : 'Nothing here'} description="Incidents are opened automatically when a component or supplier check fails for more than 2 minutes." />
        )}
      </div>
    </Card>
  )
}
