import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, KeyRound, Users } from 'lucide-react'
import { useApiKeys, usePricingGroups, useResellers } from '@/hooks/installation'
import { Button, Card, CardHeader, EmptyState, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { ago, initials, money, num, pct } from '@/lib/format'
import { change, deriveResellerActivity, useOrderWindow, usePreviousWindow } from './ops'

/*
 * Size container: narrow → name + orders + revenue; ≥ 520px adds the share bar,
 * success rate and last order.
 */
const ROW = 'grid-cols-[18px_minmax(0,1fr)_auto_auto] @min-[520px]:grid-cols-[18px_minmax(0,1.3fr)_minmax(60px,1fr)_52px_72px_56px_40px]'

export function ResellerActivity({ className }: { className?: string }) {
  const navigate = useNavigate()
  const resellers = useResellers()
  const groups = usePricingGroups()
  const keys = useApiKeys()
  const { orders, loading } = useOrderWindow()
  const prev = usePreviousWindow()

  const activity = useMemo(() => deriveResellerActivity(orders), [orders])
  const top = activity.slice(0, 5)
  const maxOrders = Math.max(1, ...top.map((r) => r.orders))
  const apiOrders = activity.reduce((a, r) => a + r.orders, 0)
  const prevApi = useMemo(() => (prev.complete ? prev.orders.filter((o) => o.resellerId).length : null), [prev])
  const apiDelta = change(apiOrders, prevApi)
  const enabled = resellers.data?.filter((r) => r.status === 'active').length ?? 0
  const byId = useMemo(() => new Map(resellers.data?.map((r) => [r.id, r]) ?? []), [resellers.data])
  const groupName = useMemo(() => new Map(groups.data?.map((g) => [g.id, g.name]) ?? []), [groups.data])
  const pending = resellers.data?.filter((r) => r.status === 'pending').length ?? 0
  const suspended = resellers.data?.filter((r) => r.status === 'suspended').length ?? 0
  const active = keys.data?.filter((k) => k.status === 'active') ?? []
  const live = active.filter((k) => k.environment === 'live')
  const busiest = live
    .slice()
    .sort((a, b) => b.requests24h - a.requests24h)
    .slice(0, 3)

  return (
    <Card className={cn('@container flex flex-col overflow-hidden', className)}>
      <CardHeader
        title="Reseller activity"
        description="Reseller API orders · rolling 24h"
        icon={<Users />}
        actions={
          <Button size="xs" variant="ghost" to="/admin/resellers" trailing={<ArrowRight />}>
            Resellers
          </Button>
        }
      />

      <div className="grid grid-cols-3 border-y border-line">
        <Fact
          label="Resellers ordering · 24h"
          value={loading ? null : num(activity.length)}
          sub={resellers.data ? `of ${enabled} active · ${pending} pending · ${suspended} suspended` : undefined}
          onClick={() => navigate('/admin/resellers')}
        />
        <Fact
          label="API orders · 24h"
          value={loading ? null : num(apiOrders)}
          sub={orders.length ? `${pct((apiOrders / orders.length) * 100, 0)} of all orders${apiDelta != null ? ` · ${apiDelta >= 0 ? '+' : '−'}${Math.abs(apiDelta).toFixed(0)}% vs prev` : ''}` : undefined}
          onClick={() => navigate('/admin/orders?channel=api&range=24h')}
        />
        <Fact
          label="Live API keys"
          value={keys.data ? num(live.length) : null}
          sub={
            keys.data
              ? `${active.length - live.length} sandbox · ${num(
                  live.reduce((a, k) => a + k.requests24h, 0),
                  { compact: true },
                )} req/24h`
              : undefined
          }
          onClick={() => navigate('/admin/developer/keys')}
        />
      </div>

      <div className={cn('hidden items-center gap-x-3 px-5 pt-3 pb-1.5 @min-[520px]:grid', ROW)}>
        <span className="mono-label">#</span>
        <span className="mono-label">Top resellers · 24h</span>
        <span className="mono-label">Share</span>
        <span className="mono-label text-right">Orders</span>
        <span className="mono-label text-right">Revenue</span>
        <span className="mono-label text-right">Success</span>
        <span className="mono-label text-right">Last</span>
      </div>
      <div className="mono-label px-5 pt-3 pb-1.5 @min-[520px]:hidden">Top resellers · 24h</div>

      <div className="px-2 pb-2">
        {loading &&
          Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2">
              <Skeleton className="size-7 rounded-lg" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        {!loading && top.length === 0 && <EmptyState compact icon={<Users />} title="No reseller orders in the last 24h" description="Orders placed through the Reseller API appear here as they arrive." />}
        {top.map((r, i) => {
          const rs = byId.get(r.resellerId)
          const finished = r.success + r.failed
          const rate = finished ? (r.success / finished) * 100 : null
          return (
            <button key={r.resellerId} type="button" onClick={() => navigate(`/admin/resellers/${r.resellerId}`)} className={cn('grid w-full items-center gap-x-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-2', ROW)}>
              <span className="font-mono text-[11px] text-fg-3 tabular">{String(i + 1).padStart(2, '0')}</span>
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-[10px] font-semibold text-fg-2">{initials(rs?.name ?? '?')}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] text-fg">{rs?.name ?? r.resellerId}</span>
                  <span className="block truncate text-[11px] text-fg-3">
                    {rs ? `${groupName.get(rs.pricingGroupId) ?? 'Standard'} · ${rs.country}` : '—'}
                    {r.inFlight ? ` · ${r.inFlight} in flight` : ''}
                  </span>
                </span>
              </span>
              <span className="hidden h-1.5 overflow-hidden rounded-full bg-fg/[0.06] @min-[520px]:block">
                <span
                  className="block h-full rounded-full transition-[width] duration-700"
                  style={{
                    width: `${(r.orders / maxOrders) * 100}%`,
                    background: 'var(--c2)',
                  }}
                />
              </span>
              <span className="text-right text-[12.5px] font-medium text-fg tabular">
                {num(r.orders)}
                <span className="font-normal text-fg-3 @min-[520px]:hidden"> ord.</span>
              </span>
              <span className="text-right text-[12.5px] text-fg-2 tabular">{money(r.revenue)}</span>
              <span className={cn('hidden text-right text-[12px] tabular @min-[520px]:block', rate != null && rate < 90 ? 'text-warning' : 'text-fg-2')}>{rate == null ? '—' : pct(rate, 0)}</span>
              <span className="hidden text-right text-[11.5px] text-fg-3 tabular @min-[520px]:block">{ago(r.lastAt)}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-auto border-t border-line">
        <div className="flex items-center justify-between px-5 pt-3 pb-1">
          <span className="mono-label">Busiest live API keys</span>
          <Link to="/admin/developer/keys" className="flex items-center gap-1 text-[12px] text-fg-3 transition-colors hover:text-fg">
            API keys <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="px-2 pb-2.5">
          {keys.isLoading && <Skeleton className="mx-3 my-2 h-8 w-auto" />}
          {keys.data && busiest.length === 0 && <p className="px-3 py-2 text-[12.5px] text-fg-3">No live keys in use.</p>}
          {busiest.map((k) => (
            <button key={k.id} type="button" onClick={() => navigate('/admin/developer/keys')} className="flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-left transition-colors hover:bg-surface-2">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-fg-3">
                <KeyRound className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-fg">{k.name}</span>
                <span className="block truncate font-mono text-[11px] text-fg-3">
                  {k.prefix}••••{k.last4}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-[12.5px] font-medium text-fg tabular">{num(k.requests24h, { compact: true })}</span>
                <span className="block text-[11px] text-fg-3 tabular">{k.lastUsedAt ? `used ${ago(k.lastUsedAt)} ago` : 'never used'}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </Card>
  )
}

function Fact({ label, value, sub, onClick }: { label: string; value: string | null; sub?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="min-w-0 border-r border-line px-4 py-3 text-left transition-colors last:border-r-0 hover:bg-surface-2/60">
      {value == null ? <Skeleton className="h-5 w-10" /> : <div className="font-display text-[18px] leading-tight font-semibold tracking-[-0.02em] text-fg tabular">{value}</div>}
      <div className="mt-0.5 truncate text-[11.5px] text-fg-2">{label}</div>
      {sub && <div className="truncate text-[10.5px] text-fg-3">{sub}</div>}
    </button>
  )
}
