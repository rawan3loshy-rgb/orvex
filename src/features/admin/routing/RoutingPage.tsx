import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Check, CircleHelp, FlaskConical, ListOrdered, Minus, Route, ShieldAlert, SkipForward, X } from 'lucide-react'
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, PageHeader, Skeleton } from '@/components/ui'
import { HealthBadge, Money } from '@/components/domain'
import { useService, useServices } from '@/hooks/installation'
import { cn } from '@/lib/cn'
import { num } from '@/lib/format'
import { ErrorPanel, SupplierMark } from '../catalog/kit'
import { OUTCOMES } from '../catalog/helpers'
import { Pipeline } from './Pipeline'

export default function RoutingPage() {
  const services = useServices({ status: 'active' })
  const popular = (services.data ?? [])
    .slice()
    .sort((a, b) => b.orders30d - a.orders30d)
    .slice(0, 6)

  return (
    <div>
      <PageHeader
        title="Routing policy"
        eyebrow={<Badge tone="accent">V1</Badge>}
        description="One strategy, made safe: try offers in priority order and fail over only when the supplier provably did not process the order."
        actions={
          <Button leading={<FlaskConical />} to="/admin/demo">
            Try it in the demo simulator
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Rule icon={<ListOrdered />} title="Priority order" body="Each service has offers ranked P1, P2, P3… The router always starts at the top. Disabled offers, removed products and suppliers in maintenance, auth error or open circuit are skipped." />
        <Rule icon={<SkipForward />} title="Guarded failover" body="Move to the next offer only after a definitive, failover-safe outcome: a mapped rejection or a provable non-acceptance (rate limit, supplier funds, auth, connection refused)." />
        <Rule icon={<CircleHelp />} title="UNKNOWN → needs review" tone="danger" body="A timeout or unusable response after sending is UNKNOWN. The supplier may have processed it, so failover is blocked; the order goes to needs_review with its hold kept." />
        <Rule icon={<ShieldAlert />} title="Margin guard" body="An offer whose cost is above the order’s snapshotted price is skipped (and above its max cost). The router never knowingly sells at a loss." />
      </div>

      <Card className="mb-5">
        <CardHeader title="An order’s path" description="Pick an outcome to replay how the router reacts. Same engine as live orders (simulated suppliers)." icon={<Route />} />
        <CardBody>
          <Pipeline />
        </CardBody>
      </Card>

      <div className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader title="Outcome classification" description="Every supplier response is normalised into one of five classes. Only two of them allow failover." />
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full min-w-[680px] text-[12.5px]">
              <thead>
                <tr className="border-b border-line text-left text-[11.5px] text-fg-3">
                  <th className="py-2 pr-3 pl-5 font-medium">Class</th>
                  <th className="px-3 py-2 font-medium">Examples</th>
                  <th className="px-3 py-2 text-center font-medium">Fails over?</th>
                  <th className="py-2 pr-5 pl-3 font-medium">Then</th>
                </tr>
              </thead>
              <tbody>
                {OUTCOMES.map((o) => (
                  <tr key={o.cls} className={cn('border-b border-line last:border-0', o.cls === 'unknown' && 'bg-danger/[0.04]')}>
                    <td className="py-2.5 pr-3 pl-5">
                      <Badge tone={o.tone} dot>
                        {o.label}
                      </Badge>
                      <div className="mt-0.5 font-mono text-[10.5px] text-fg-3">{o.cls}</div>
                    </td>
                    <td className="px-3 py-2.5 text-fg-2">{o.examples}</td>
                    <td className="px-3 py-2.5 text-center">
                      {o.failover === 'yes' ? (
                        <span className="inline-flex items-center gap-1 font-medium text-success">
                          <Check className="size-3.5" /> Yes
                        </span>
                      ) : o.cls === 'success' ? (
                        <Minus className="mx-auto size-3.5 text-fg-3" />
                      ) : (
                        <span className={cn('inline-flex items-center gap-1 font-medium', o.cls === 'unknown' ? 'text-danger' : 'text-fg-2')}>
                          <X className="size-3.5" /> No
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-5 pl-3 text-fg-2">{o.then}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-line px-5 py-2.5 text-[11.5px] text-fg-3">Unmapped rejections default to terminal — the safe choice. Per-supplier error mappings promote specific messages to failover-safe (Suppliers → Error mappings).</div>
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader title="Not in V1 — on purpose" />
            <CardBody className="space-y-2 text-[12.5px] text-fg-2">
              <p>No weighted, round-robin, cheapest-first or scoring strategies, and no condition rules. They need measured supplier data first, and every extra strategy makes an order’s path harder to explain to the customer and to finance.</p>
              <p className="text-fg-3">Change behaviour by reordering offers, setting a max cost, disabling an offer or putting a supplier in maintenance.</p>
            </CardBody>
          </Card>
          <Card className="border-dashed border-warning/40 bg-hatch">
            <CardHeader title="Try timeout vs rejection" description="DEMO / SIMULATION" icon={<FlaskConical />} />
            <CardBody className="space-y-2 text-[12.5px] text-fg-2">
              <p>Set a supplier to “timeout” or “reject (failover-safe)” in the simulator, place an order, and watch the order detail: one goes to needs_review, the other completes on P2.</p>
              <Button size="sm" variant="accent" trailing={<ArrowRight />} to="/admin/demo">
                Open simulator
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-[14px] font-semibold">Chains for the most ordered services</h2>
          <p className="text-[12.5px] text-fg-3">Live state: which offer an order placed right now at the retail price would try first.</p>
        </div>
        <Link to="/admin/services" className="text-[12.5px] text-accent-ink hover:underline">
          All services →
        </Link>
      </div>
      {services.isError ? (
        <ErrorPanel error={services.error} onRetry={() => services.refetch()} />
      ) : services.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : popular.length === 0 ? (
        <Card>
          <EmptyState title="No active services" />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {popular.map((s) => (
            <Chain key={s.service.id} id={s.service.id} orders={s.orders30d} />
          ))}
        </div>
      )}
    </div>
  )
}

function Rule({ icon, title, body, tone }: { icon: ReactNode; title: string; body: string; tone?: 'danger' }) {
  return (
    <Card className={cn('p-4', tone === 'danger' && 'border-danger/30')}>
      <div className={cn('mb-2.5 grid size-8 place-items-center rounded-lg border [&_svg]:size-4', tone === 'danger' ? 'border-danger/30 bg-danger/10 text-danger' : 'border-line bg-surface-2 text-fg-2')}>{icon}</div>
      <div className="text-[13.5px] font-semibold">{title}</div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-fg-2">{body}</p>
    </Card>
  )
}

function Chain({ id, orders }: { id: string; orders: number }) {
  const q = useService(id)
  if (q.isLoading) return <Skeleton className="h-48 rounded-xl" />
  if (!q.data) return null
  const d = q.data
  const price = d.quotes[0]?.amount ?? null
  const firstUsable = d.offers.find((o) => o.routable && (price == null || o.cost <= price))
  return (
    <Card>
      <CardHeader
        title={
          <Link to={`/admin/services/${id}?tab=offers`} className="hover:underline">
            {d.service.name}
          </Link>
        }
        description={
          <span>
            {num(orders)} orders 30d · retail <Money value={price} />
          </span>
        }
        actions={d.availability.available ? <Badge tone="success" dot>Available</Badge> : <Badge tone="danger" dot>Unavailable</Badge>}
      />
      <CardBody className="space-y-1.5">
        {d.offers.map((o, i) => {
          const margin = price != null && o.cost > price
          const usable = o.routable && !margin
          return (
            <div key={o.offer.id} className={cn('flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5', firstUsable?.offer.id === o.offer.id ? 'border-success/40 bg-success/[0.05]' : usable ? 'border-line' : 'border-dashed border-line opacity-70')}>
              <span className={cn('font-mono text-[11px] font-semibold', usable ? 'text-fg' : 'text-fg-3')}>P{i + 1}</span>
              <SupplierMark name={o.supplier.name} size="xs" />
              <span className="min-w-0 flex-1 truncate text-[12.5px]" title={o.reasons.join(' · ')}>
                {o.supplier.name.replace(/^DHRU Supplier /, '')}
                {!o.routable && <span className="ml-1.5 text-[11px] text-fg-3">· {o.reasons[0]}</span>}
                {o.routable && margin && <span className="ml-1.5 text-[11px] text-danger">· margin guard</span>}
              </span>
              <HealthBadge health={o.supplier.health} className="hidden 2xl:inline-flex" />
              <Money value={o.cost} className="font-mono text-[11.5px] text-fg-2" />
            </div>
          )
        })}
        {!d.availability.available && <div className="pt-1 text-[11.5px] text-danger">{d.availability.reason}</div>}
      </CardBody>
    </Card>
  )
}
