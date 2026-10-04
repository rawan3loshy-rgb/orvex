import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowUpRight, ChevronRight, CircleAlert, Info, TriangleAlert } from 'lucide-react'
import { Badge, Card, CardHeader, EmptyState, Skeleton } from '@/components/ui'
import { ChartLegend, TimeChart } from '@/components/charts'
import { HealthBadge, Money } from '@/components/domain'
import type { AlertSeverity, CockpitData, CockpitSupplier } from '@/types/installation'
import { cn } from '@/lib/cn'
import { ms, num, time } from '@/lib/format'
import { asTone, TONE_DOT, age } from '../orders/helpers'

/* ------------------------------------------------------------------------- */
/*  Strip cell                                                               */
/* ------------------------------------------------------------------------- */
export function StripCell({ label, value, unit, sub, to, tone, className, children }: { label: ReactNode; value: ReactNode; unit?: ReactNode; sub?: ReactNode; to: string; tone?: 'danger' | 'warning' | 'success'; className?: string; children?: ReactNode }) {
  return (
    <Link to={to} className={cn('group flex min-w-0 flex-col justify-between gap-2 border-r border-b border-line px-4 py-3.5 transition-colors hover:bg-surface-2/60', className)}>
      <span className="flex items-center justify-between gap-2">
        <span className="mono-label truncate transition-colors group-hover:text-fg-2">{label}</span>
        <ArrowUpRight className="size-3.5 shrink-0 text-fg-3 opacity-0 transition-opacity group-hover:opacity-100" />
      </span>
      <span className="flex min-w-0 items-baseline gap-1.5 whitespace-nowrap">
        <span className={cn('font-display text-[24px] leading-none font-semibold tracking-[-0.025em] tabular', tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-fg')}>{value}</span>
        {unit && <span className="truncate text-[11.5px] text-fg-3">{unit}</span>}
      </span>
      {children}
      <span className="truncate text-[11.5px] text-fg-3">{sub ?? ' '}</span>
    </Link>
  )
}

/* ------------------------------------------------------------------------- */
/*  Throughput                                                               */
/* ------------------------------------------------------------------------- */
const SERIES = [
  { key: 'completed', label: 'Completed', color: 'var(--c2)' },
  { key: 'review', label: 'Needs review', color: 'var(--c1)' },
  { key: 'rejected', label: 'Rejected', color: 'var(--danger)' },
]

export function ThroughputCard({ data }: { data: CockpitData['throughput'] }) {
  const totals = data.reduce((a, b) => ({ completed: a.completed + b.completed, rejected: a.rejected + b.rejected, review: a.review + b.review }), { completed: 0, rejected: 0, review: 0 })
  return (
    <Card className="flex flex-col">
      <CardHeader title="Throughput · last 24 h" description="Orders per hour by current outcome (bucketed by creation time)" />
      <div className="px-5">
        <ChartLegend items={SERIES.map((s) => ({ label: s.label, color: s.color, value: num(totals[s.key as keyof typeof totals]) }))} />
      </div>
      <div className="flex-1 px-3 pt-2 pb-3">
        <TimeChart
          data={data}
          series={SERIES}
          x={(d) => d.t}
          kind="bar"
          stacked
          height={188}
          xFormat={(l) => time(l)}
          xLabelCount={6}
          tooltipTitle={(d) => `${time(d.t)} – ${time(new Date(new Date(d.t).getTime() + 3_600_000))}`}
        />
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------------- */
/*  Money today                                                              */
/* ------------------------------------------------------------------------- */
export function MoneyCard({ m }: { m: CockpitData['money'] }) {
  const marginTone = m.marginToday < 0 ? 'text-danger' : m.marginPct < 10 ? 'text-warning' : 'text-success'
  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Money today"
        description="Projections of the double-entry ledger"
        actions={
          <Link to="/admin/finance/ledger" className="text-[12px] font-medium text-accent-ink hover:underline">
            Ledger
          </Link>
        }
      />
      <div className="grid grid-cols-3 gap-px border-y border-line bg-line">
        <MoneyFact label="Revenue" value={<Money value={m.revenueToday} />} hint="captured" />
        <MoneyFact label="Supplier cost" value={<Money value={m.costToday} />} hint="cost of sales" />
        <MoneyFact label="Margin" value={<span className={marginTone}>{m.marginPct.toFixed(1)}%</span>} hint={<Money value={m.marginToday} />} />
      </div>
      <div className="flex-1 divide-y divide-line/70 px-5 py-1.5">
        <MoneyRow to="/admin/orders?financial=held" label="Held for open orders" hint="reserved customer funds — not revenue" value={<Money value={m.heldTotal} />} />
        <MoneyRow to="/admin/accounts" label="Wallet liability" hint="spendable customer balances" value={<Money value={m.walletLiability} />} />
        <MoneyRow to="/admin/finance/payments" label="Refunds today" hint="contra-revenue" value={<Money value={m.refundsToday} />} />
      </div>
    </Card>
  )
}

function MoneyFact({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0 bg-surface px-4 py-3">
      <div className="mono-label truncate">{label}</div>
      <div className="mt-1 truncate font-display text-[18px] font-semibold tracking-[-0.02em] tabular">{value}</div>
      {hint && <div className="mt-0.5 truncate text-[11px] text-fg-3">{hint}</div>}
    </div>
  )
}

function MoneyRow({ label, hint, value, to }: { label: string; hint: string; value: ReactNode; to: string }) {
  return (
    <Link to={to} className="group -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-surface-2/60">
      <span className="min-w-0">
        <span className="block text-[12.5px] text-fg">{label}</span>
        <span className="block truncate text-[11px] text-fg-3">{hint}</span>
      </span>
      <span className="font-mono text-[13px] font-medium">{value}</span>
    </Link>
  )
}

/* ------------------------------------------------------------------------- */
/*  Suppliers                                                                */
/* ------------------------------------------------------------------------- */
const CIRCUIT: Record<CockpitSupplier['circuit'], { tone: 'neutral' | 'danger' | 'warning'; label: string }> = {
  closed: { tone: 'neutral', label: 'Closed' },
  open: { tone: 'danger', label: 'Open' },
  half_open: { tone: 'warning', label: 'Half-open' },
}

const GRID = 'grid grid-cols-[minmax(170px,1.6fr)_118px_64px_64px_minmax(150px,1.3fr)_86px_88px] items-center gap-3'

export function SupplierStrip({ suppliers }: { suppliers: CockpitSupplier[] }) {
  const healthy = suppliers.filter((s) => s.health === 'healthy').length
  const low = suppliers.filter((s) => s.balance < s.threshold).length
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Suppliers"
        description={`${healthy}/${suppliers.length} healthy · ${low} below balance threshold · routing skips unhealthy suppliers and fails over only when it is safe`}
        actions={
          <Link to="/admin/suppliers" className="text-[12px] font-medium text-accent-ink hover:underline">
            All suppliers
          </Link>
        }
      />
      <div className="overflow-x-auto">
        <div className="min-w-[860px]">
          <div className={cn(GRID, 'border-y border-line bg-surface-2/40 px-5 py-2 text-[10.5px] font-medium tracking-wide text-fg-3 uppercase')}>
            <span>Supplier</span>
            <span>Health</span>
            <span className="text-right">Success</span>
            <span className="text-right">p50</span>
            <span>Balance vs threshold</span>
            <span>Circuit</span>
            <span className="text-right">Drift</span>
          </div>
          {suppliers.map((s) => {
            const ratio = s.threshold > 0 ? s.balance / s.threshold : 10
            const below = s.balance < s.threshold
            const c = CIRCUIT[s.circuit]
            return (
              <Link key={s.id} to={`/admin/suppliers/${s.id}`} className={cn(GRID, 'group border-b border-line/70 px-5 py-2 text-[12.5px] transition-colors last:border-0 hover:bg-surface-2/60')}>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-fg group-hover:underline">{s.name}</span>
                  <span className="block truncate text-[11px] text-fg-3">{s.driver}</span>
                </span>
                <span>
                  <HealthBadge health={s.health} />
                </span>
                <span className={cn('text-right font-mono tabular', s.successRate < 90 ? 'text-danger' : s.successRate < 97 ? 'text-warning' : 'text-fg-2')}>{s.successRate.toFixed(0)}%</span>
                <span className="text-right font-mono text-fg-2 tabular">{s.latencyP50 ? ms(s.latencyP50) : '—'}</span>
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className={cn('w-[74px] shrink-0 text-right font-mono tabular', below ? 'text-warning' : 'text-fg')}>
                    <Money value={s.balance} compact />
                  </span>
                  <span className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-fg/[0.07]">
                    <span className={cn('absolute inset-y-0 left-0 rounded-full', below ? 'bg-warning' : 'bg-fg-2/60')} style={{ width: `${Math.min(100, (ratio / 4) * 100)}%` }} />
                    <span className="absolute inset-y-0 w-px bg-fg-3" style={{ left: '25%' }} title="Low-balance threshold" />
                  </span>
                </span>
                <span>
                  <Badge tone={c.tone} variant={s.circuit === 'closed' ? 'outline' : 'soft'} dot={s.circuit !== 'closed'}>
                    {c.label}
                  </Badge>
                </span>
                <span className={cn('text-right font-mono tabular', s.drift !== 0 ? 'text-warning' : 'text-fg-3')}>{s.drift === 0 ? '—' : <Money value={s.drift} sign />}</span>
              </Link>
            )
          })}
        </div>
      </div>
      <div className="border-t border-line px-5 py-2 text-[11.5px] text-fg-3">Bar marker = low-balance threshold (scale 0–4×). Drift = supplier-reported balance minus the balance expected from the ledger.</div>
    </Card>
  )
}

/* ------------------------------------------------------------------------- */
/*  Check tile                                                               */
/* ------------------------------------------------------------------------- */
export function CheckTile({ icon, label, value, sub, to, tone }: { icon: ReactNode; label: string; value: ReactNode; sub: ReactNode; to: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }) {
  return (
    <Link to={to} className="group relative flex min-w-0 flex-col gap-2 rounded-xl border border-line bg-surface p-4 shadow-card transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-pop">
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[12.5px] font-medium text-fg-2 [&_svg]:size-3.5 [&_svg]:text-fg-3">
          {icon}
          {label}
        </span>
        <span className={cn('size-2 rounded-full', tone === 'neutral' ? 'bg-fg-3/50' : TONE_DOT[tone])} />
      </span>
      <span className={cn('font-display text-[22px] leading-none font-semibold tracking-[-0.025em] tabular', tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-fg')}>{value}</span>
      <span className="line-clamp-2 text-[11.5px] text-fg-3">{sub}</span>
      <ArrowUpRight className="absolute right-3.5 bottom-3.5 size-3.5 text-fg-3 opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  )
}

/* ------------------------------------------------------------------------- */
/*  List card                                                                */
/* ------------------------------------------------------------------------- */
export function ListCard({ title, description, to, toLabel, empty, children, count }: { title: string; description?: string; to: string; toLabel: string; empty: string; children: ReactNode[]; count?: number }) {
  return (
    <Card className="flex flex-col">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            {title}
            {count != null && count > 0 && <Badge tone="neutral">{count}</Badge>}
          </span>
        }
        description={description}
        actions={
          <Link to={to} className="text-[12px] font-medium text-accent-ink hover:underline">
            {toLabel}
          </Link>
        }
      />
      <div className="flex-1 px-3 pb-3">{children.length ? <div className="divide-y divide-line/70">{children}</div> : <div className="px-2 py-6 text-center text-[12.5px] text-fg-3">{empty}</div>}</div>
    </Card>
  )
}

export function ListRow({ to, title, sub, right }: { to: string; title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <Link to={to} className="group flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-surface-2/60">
      <span className="min-w-0">
        <span className="block truncate text-[12.5px] font-medium text-fg">{title}</span>
        {sub && <span className="block truncate text-[11.5px] text-fg-3">{sub}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-[12.5px]">
        {right}
        <ChevronRight className="size-3.5 text-fg-3 opacity-0 transition-opacity group-hover:opacity-100" />
      </span>
    </Link>
  )
}

/* ------------------------------------------------------------------------- */
/*  Alerts + feed                                                            */
/* ------------------------------------------------------------------------- */
const SEV: Record<AlertSeverity, { icon: typeof CircleAlert; cls: string; bar: string; label: string }> = {
  critical: { icon: CircleAlert, cls: 'text-danger', bar: 'bg-danger', label: 'Critical' },
  warning: { icon: TriangleAlert, cls: 'text-warning', bar: 'bg-warning', label: 'Warning' },
  info: { icon: Info, cls: 'text-info', bar: 'bg-info', label: 'Info' },
}

export function AlertsCard({ alerts }: { alerts: CockpitData['alerts'] }) {
  const crit = alerts.filter((a) => a.severity === 'critical').length
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            Alerts
            {alerts.length > 0 && (
              <Badge tone={crit ? 'danger' : 'warning'} dot pulse={crit > 0}>
                {alerts.length}
              </Badge>
            )}
          </span>
        }
        description="Ordered by severity — each opens the screen that resolves it"
      />
      {alerts.length === 0 ? (
        <EmptyState compact icon={<Info />} title="All clear" description="No supplier, money, catalog or integration issues right now." />
      ) : (
        <ul className="border-t border-line">
          {alerts.map((a) => {
            const s = SEV[a.severity]
            const Icon = s.icon
            return (
              <li key={a.id} className="border-b border-line/70 last:border-0">
                <Link to={a.href} className="group relative flex gap-3 py-2.5 pr-4 pl-5 transition-colors hover:bg-surface-2/60">
                  <span className={cn('absolute inset-y-0 left-0 w-[3px]', s.bar, a.severity === 'info' && 'opacity-50')} />
                  <Icon className={cn('mt-0.5 size-4 shrink-0', s.cls)} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-[12.5px] leading-snug font-medium text-fg group-hover:underline">{a.title}</span>
                      <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-fg-3" />
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[11.5px] text-fg-3">{a.detail}</span>
                    <span className="mt-1 block font-mono text-[10px] tracking-wider text-fg-3/80 uppercase">
                      {s.label} · {a.area}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

export function FeedCard({ feed, now }: { feed: CockpitData['feed']; now: number }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Live feed" description="Order outcomes and operator actions" />
      {feed.length === 0 ? (
        <div className="px-5 pb-5 text-[12.5px] text-fg-3">Nothing has happened yet.</div>
      ) : (
        <ul className="max-h-[520px] overflow-y-auto border-t border-line">
          {feed.map((f) => {
            const body = (
              <>
                <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', TONE_DOT[asTone(f.tone)])} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] text-fg">{f.title}</span>
                  <span className="block truncate text-[11.5px] text-fg-3">{f.detail}</span>
                </span>
                <span className="shrink-0 font-mono text-[10.5px] text-fg-3 tabular">{age(f.at, now)}</span>
              </>
            )
            return (
              <li key={f.id} className="border-b border-line/60 last:border-0">
                {f.href ? (
                  <Link to={f.href} className="flex gap-2.5 px-5 py-2 transition-colors hover:bg-surface-2/60">
                    {body}
                  </Link>
                ) : (
                  <div className="flex gap-2.5 px-5 py-2">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

export function CockpitSkeleton() {
  return (
    <div>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-7 w-72" />
      </div>
      <Skeleton className="h-[118px] w-full rounded-xl" />
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-4">
          <div className="grid gap-4 lg:grid-cols-5">
            <Skeleton className="h-[290px] rounded-xl lg:col-span-3" />
            <Skeleton className="h-[290px] rounded-xl lg:col-span-2" />
          </div>
          <Skeleton className="h-[420px] rounded-xl" />
        </div>
        <div className="grid content-start gap-4">
          <Skeleton className="h-[360px] rounded-xl" />
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
      </div>
    </div>
  )
}
