import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, CircleCheck, CircleX, Clock, Layers, ListOrdered, Plus, ShoppingBag, TriangleAlert, Wallet, Zap } from 'lucide-react'
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, KpiCard, PageHeader, Select, Skeleton } from '@/components/ui'
import { BarList, TimeChart } from '@/components/charts'
import { Money } from '@/components/domain'
import { usePortalDashboard, usePortalServices } from '@/hooks/installation'
import { formatMoney, usd, add, ZERO, type Micros } from '@/core/money'
import type { PortalMe, PortalOrder } from '@/types/installation'
import { dateShort, duration, num, relative } from '@/lib/format'
import { cn } from '@/lib/cn'
import { CardSkeleton, ErrorCard, PortalStatus, Reveal } from '../kit'
import { lowBalanceThreshold, usePortalSession } from '../kitUtils'

function greeting(name: string) {
  const h = new Date().getHours()
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  return `${part}, ${name.split(' ')[0]}`
}

export default function DashboardPage() {
  const { me, can, isLoading, error, refetch } = usePortalSession()
  const dash = usePortalDashboard()

  if (error) return <ErrorCard error={error} onRetry={() => refetch()} />

  const low = me ? me.balance.available < lowBalanceThreshold(me.account.lowBalanceAlert) : false

  return (
    <div>
      <PageHeader
        eyebrow={me ? greeting(me.member.name) : <Skeleton className="h-3 w-32" />}
        title="Dashboard"
        description={me ? `${me.account.name} · ${me.tierName} pricing — prices you see are calculated live for your tier.` : 'Your partner account at a glance.'}
        actions={
          can.order && (
            <>
              <Button to="/portal/bulk" leading={<Layers />}>
                Bulk orders
              </Button>
              <Button to="/portal/order" variant="accent" leading={<Plus />}>
                Place order
              </Button>
            </>
          )
        }
      />

      {me && low && (
        <Reveal>
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-warning/35 bg-warning/[0.07] px-4 py-3.5 sm:flex-row sm:items-center">
            <TriangleAlert className="size-5 shrink-0 text-warning" />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold">Your balance is running low</p>
              <p className="text-[12.5px] text-fg-2">
                <Money value={me.balance.available} /> available — below your alert level of <Money value={lowBalanceThreshold(me.account.lowBalanceAlert)} />. Orders are reserved from your balance plus credit (<Money value={me.balance.spendable} /> spendable).
              </p>
            </div>
            {can.finance ? (
              <Button to="/portal/wallet?topup=1" variant="accent" size="sm" leading={<Wallet />} className="self-start sm:self-auto">
                Top up wallet
              </Button>
            ) : (
              <span className="text-[12px] text-fg-3">Ask a finance member to top up.</span>
            )}
          </div>
        </Reveal>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Reveal className="lg:col-span-2">{me ? <BalanceCard me={me} openOrders={dash.data?.processing} canTopUp={can.finance} /> : <CardSkeleton rows={4} className="h-full" />}</Reveal>
        <Reveal delay={0.05}>
          <QuickOrder canOrder={can.order} loading={isLoading} />
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard loading={dash.isLoading} label="Orders today" icon={<ShoppingBag />} value={num(dash.data?.ordersToday)} footer="All channels: portal, API, DHRU" />
        <KpiCard loading={dash.isLoading} label="Processing" icon={<Clock />} value={num(dash.data?.processing)} footer={<Link to="/portal/orders?status=processing" className="hover:text-fg">View open orders →</Link>} />
        <KpiCard loading={dash.isLoading} label="Completed · 7d" icon={<CircleCheck />} value={num(dash.data?.completed7d)} footer={dash.data?.avgTurnaroundSec ? `Median turnaround ${duration(dash.data.avgTurnaroundSec)}` : 'Last 7 days'} />
        <KpiCard loading={dash.isLoading} label="Rejected · 7d" icon={<CircleX />} value={num(dash.data?.rejected7d)} footer="Reserved funds were released" />
        <KpiCard loading={dash.isLoading} className="col-span-2 md:col-span-1" label="Spend · 30d" icon={<Wallet />} value={<Money value={dash.data?.spend30d} />} footer="Completed orders, net of refunds" />
      </div>

      {dash.error ? (
        <ErrorCard className="mt-4" error={dash.error} onRetry={() => dash.refetch()} />
      ) : (
        <>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <SpendChart data={dash.data?.spendByDay} />
            </Card>
            <Card>
              <CardHeader title="Top services" description="Last 30 days, by orders" />
              <div className="px-3 pb-4">
                {dash.isLoading ? (
                  <div className="space-y-2 px-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-7" />)}</div>
                ) : dash.data?.topServices.length ? (
                  <BarList items={dash.data.topServices.map((s) => ({ key: s.name, label: s.name, value: s.orders }))} format={(v) => `${num(v)}`} />
                ) : (
                  <EmptyState compact icon={<ListOrdered />} title="No orders yet" description="Your most-ordered services will appear here." />
                )}
              </div>
            </Card>
          </div>

          <Card className="mt-4">
            <CardHeader
              title="Recent orders"
              description="Updates live as orders progress"
              actions={
                <Button to="/portal/orders" size="sm" variant="ghost" trailing={<ArrowRight />}>
                  All orders
                </Button>
              }
            />
            <RecentOrders orders={dash.data?.recent} loading={dash.isLoading} />
          </Card>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function BalanceCard({ me, openOrders, canTopUp }: { me: PortalMe; openOrders?: number; canTopUp: boolean }) {
  const b = me.balance
  return (
    <Card className="relative h-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-dots opacity-60 [mask-image:linear-gradient(120deg,transparent_40%,#000)]" />
      <div className="relative flex h-full flex-col p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="mono-label">Available balance</span>
          <Badge tone="accent" variant="soft">
            {me.tierName} pricing
          </Badge>
        </div>
        <div className="mt-2 font-display text-[34px] leading-none font-semibold tracking-[-0.03em] tabular sm:text-[40px]">
          <Money value={b.available} tone="auto" />
        </div>
        <p className="mt-2 text-[12.5px] text-fg-3">Ledger-backed: every top-up, reservation, charge and refund is a recorded transaction.</p>

        <div className="mt-5 grid grid-cols-3 divide-x divide-line rounded-lg border border-line bg-surface-2/60">
          <BalanceCell label="Held" value={b.held} hint={b.held > 0 ? `Reserved for ${openOrders ?? '…'} open order${openOrders === 1 ? '' : 's'}` : 'Nothing reserved'} />
          <BalanceCell label="Credit limit" value={b.creditLimit} hint="Post-paid allowance" />
          <BalanceCell label="Spendable" value={b.spendable} hint="Available + credit" strong />
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
          {canTopUp && (
            <Button to="/portal/wallet?topup=1" variant="primary" size="sm" leading={<Plus />}>
              Top up
            </Button>
          )}
          <Button to="/portal/wallet" size="sm" variant="secondary">
            Wallet & transactions
          </Button>
        </div>
      </div>
    </Card>
  )
}

function BalanceCell({ label, value, hint, strong }: { label: string; value: Micros; hint: string; strong?: boolean }) {
  return (
    <div className="min-w-0 px-3 py-2.5">
      <div className="truncate text-[11.5px] text-fg-3">{label}</div>
      <div className={cn('mt-0.5 truncate text-[14px] font-semibold tabular sm:text-[15px]', strong && 'text-accent-ink')}>
        <Money value={value} tone="auto" />
      </div>
      <div className="mt-0.5 hidden truncate text-[11px] text-fg-3 sm:block">{hint}</div>
    </div>
  )
}

function QuickOrder({ canOrder, loading }: { canOrder: boolean; loading: boolean }) {
  const services = usePortalServices()
  const navigate = useNavigate()
  const [serviceId, setServiceId] = useState('')
  const [imei, setImei] = useState('')
  const available = (services.data ?? []).filter((s) => s.available)
  const chosen = available.find((s) => s.id === serviceId)
  const go = () => {
    if (!serviceId) return
    const p = new URLSearchParams({ service: serviceId })
    if (imei.trim()) p.set('imei', imei.trim())
    navigate(`/portal/order?${p.toString()}`)
  }
  return (
    <Card className="flex h-full flex-col">
      <CardHeader icon={<Zap />} title="Quick order" description="Pick a service, paste an IMEI, continue." />
      <form
        className="flex flex-1 flex-col gap-3 px-5 pb-5"
        onSubmit={(e) => {
          e.preventDefault()
          go()
        }}
      >
        <Field label="Service" htmlFor="qo_service">
          <Select
            id="qo_service"
            value={serviceId}
            disabled={!canOrder || loading}
            onChange={(e) => setServiceId(e.target.value)}
            options={[{ value: '', label: services.isLoading ? 'Loading services…' : 'Choose a service…' }, ...available.map((s) => ({ value: s.id, label: `${s.name} — ${formatMoney(s.price)}` }))]}
          />
        </Field>
        <Field label="IMEI" htmlFor="qo_imei" optional>
          <Input id="qo_imei" mono inputMode="numeric" placeholder="15-digit IMEI" value={imei} disabled={!canOrder} onChange={(e) => setImei(e.target.value)} />
        </Field>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="text-[12px] text-fg-3">{chosen ? <>Your price <Money value={chosen.price} className="font-medium text-fg" /></> : canOrder ? 'Checked live before you pay' : 'Your role can’t place orders'}</span>
          <Button type="submit" size="sm" variant="accent" disabled={!canOrder || !serviceId} trailing={<ArrowRight />}>
            Continue
          </Button>
        </div>
      </form>
    </Card>
  )
}

function SpendChart({ data }: { data?: { t: string; spend: number; orders: number }[] }) {
  const total = (data ?? []).reduce<Micros>((acc, d) => add(acc, usd(d.spend)), ZERO)
  const orders = (data ?? []).reduce((acc, d) => acc + d.orders, 0)
  return (
    <>
      <CardHeader
        title="Spend · last 14 days"
        description="Completed orders per day, net of refunds"
        actions={
          data && (
            <div className="text-right">
              <div className="text-[15px] font-semibold tabular">
                <Money value={total} />
              </div>
              <div className="text-[11.5px] text-fg-3">{num(orders)} orders placed</div>
            </div>
          )
        }
      />
      <div className="px-3 pb-4 sm:px-5">
        {!data ? (
          <Skeleton className="h-[220px] rounded-lg" />
        ) : (
          <TimeChart
            data={data}
            x={(d) => d.t}
            kind="bar"
            height={220}
            series={[{ key: 'spend', label: 'Spend', color: 'var(--c1)', type: 'bar' }]}
            xFormat={(l) => dateShort(l)}
            xLabelCount={7}
            yFormat={(v) => formatMoney(usd(v), { compact: true, precise: false }).replace(/\.00$/, '')}
            tooltipTitle={(d) => dateShort(d.t)}
            tooltipFormat={(v) => formatMoney(usd(v))}
            tooltipExtra={(d) => <span className="text-fg-3">{num(d.orders)} orders placed</span>}
          />
        )}
      </div>
    </>
  )
}

function RecentOrders({ orders, loading }: { orders?: PortalOrder[]; loading: boolean }) {
  if (loading && !orders)
    return (
      <div className="space-y-3 px-5 pb-5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    )
  if (!orders?.length) return <EmptyState compact icon={<ShoppingBag />} title="No orders yet" description="Place your first order — it appears here instantly." action={<Button to="/portal/order" size="sm" variant="accent">Place order</Button>} />
  return (
    <ul className="divide-y divide-line border-t border-line">
      {orders.map((o) => (
        <li key={o.id}>
          <Link to={`/portal/orders/${o.ref}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2/60">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[12px] text-fg-2">{o.ref}</span>
                <span className="hidden text-[11.5px] text-fg-3 sm:inline">· {relative(o.createdAt)}</span>
              </div>
              <div className="truncate text-[13px] font-medium">{o.serviceName}</div>
              <div className="truncate font-mono text-[11.5px] text-fg-3">{Object.values(o.input)[0] ?? '—'}</div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Money value={o.price} className="text-[13px] font-medium" />
              <PortalStatus status={o.status} detail={o.statusDetail} showDetail={false} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
