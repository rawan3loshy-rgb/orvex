import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { motion } from 'motion/react'
import { CloudDownload, LayoutGrid, Plus, Rows3, Scale, Server, ShieldAlert, Wallet } from 'lucide-react'
import { Badge, Button, Card, DataTable, EmptyState, PageHeader, Segmented, Skeleton, Tooltip, type Column } from '@/components/ui'
import { Guarded, HealthBadge, Money, SimulatedBadge } from '@/components/domain'
import { useSuppliers } from '@/hooks/installation'
import { sumBy } from '@/core/money'
import type { SupplierView } from '@/types/installation'
import { cn } from '@/lib/cn'
import { ms, num } from '@/lib/format'
import { BalanceMeter, ErrorPanel, LoadingCards, RelTime, SupplierMark } from '../catalog/kit'
import { DRIVER_META } from '../catalog/helpers'
import { ConnectSupplierDrawer } from './ConnectSupplierDrawer'

const CIRCUIT: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  closed: { label: 'Closed', tone: 'success' },
  half_open: { label: 'Half-open', tone: 'warning' },
  open: { label: 'Open', tone: 'danger' },
}

export default function SuppliersPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'table' ? 'table' : 'cards'
  const [connecting, setConnecting] = useState(false)
  const q = useSuppliers()

  const summary = useMemo(() => {
    const xs = q.data ?? []
    return {
      total: xs.length,
      healthy: xs.filter((s) => s.health === 'healthy').length,
      attention: xs.filter((s) => s.health !== 'healthy').length,
      balance: sumBy(xs, (s) => s.supplier.reportedBalance),
      pending: xs.reduce((a, s) => a + s.pendingChanges, 0),
      drift: xs.filter((s) => s.reconciliation.drift !== 0).length,
    }
  }, [q.data])

  const columns: Column<SupplierView>[] = [
    {
      key: 'name',
      header: 'Supplier',
      sortValue: (v) => v.supplier.name,
      cell: (v) => (
        <div className="flex items-center gap-3">
          <SupplierMark name={v.supplier.name} color={v.supplier.color} size="sm" />
          <div className="min-w-0">
            <div className="truncate font-medium">{v.supplier.name}</div>
            <div className="text-[11.5px] text-fg-3">
              {v.driver.name} · {v.products} products · {v.services} services
            </div>
          </div>
        </div>
      ),
    },
    { key: 'health', header: 'Health', sortValue: (v) => v.health, cell: (v) => <HealthBadge health={v.health} /> },
    {
      key: 'balance',
      header: 'Reported balance',
      align: 'right',
      sortValue: (v) => v.supplier.reportedBalance,
      cell: (v) => (
        <div className="ml-auto w-32">
          <Money value={v.supplier.reportedBalance} className={cn('font-mono text-[12.5px]', v.supplier.reportedBalance < v.supplier.lowBalanceThreshold && 'text-warning')} />
          <BalanceMeter value={v.supplier.reportedBalance} threshold={v.supplier.lowBalanceThreshold} className="mt-1" />
        </div>
      ),
    },
    { key: 'success', header: 'Success 7d', align: 'right', sortValue: (v) => v.metrics.successRate, cell: (v) => <span className={cn('font-mono', v.metrics.successRate < 94 && 'text-warning')}>{v.metrics.successRate.toFixed(1)}%</span> },
    { key: 'p50', header: 'p50', align: 'right', hideBelow: 'lg', sortValue: (v) => v.metrics.latencyP50, cell: (v) => <span className="font-mono text-fg-2">{v.metrics.latencyP50 ? ms(v.metrics.latencyP50) : '—'}</span> },
    { key: 'circuit', header: 'Circuit', hideBelow: 'md', cell: (v) => <Badge tone={CIRCUIT[v.supplier.circuit.state]!.tone}>{CIRCUIT[v.supplier.circuit.state]!.label}</Badge> },
    {
      key: 'sync',
      header: 'Last sync',
      hideBelow: 'lg',
      cell: (v) => (
        <div className="text-[12px]">
          <RelTime iso={v.lastSync?.finishedAt ?? v.supplier.lastSyncAt} className="text-fg-2" />
          {v.pendingChanges > 0 && (
            <Link to={`/admin/catalog/sync?supplier=${v.supplier.id}`} onClick={(e) => e.stopPropagation()} className="ml-1.5 text-warning hover:underline">
              {v.pendingChanges} pending
            </Link>
          )}
        </div>
      ),
    },
    {
      key: 'drift',
      header: 'Drift',
      align: 'right',
      hideBelow: 'md',
      sortValue: (v) => Math.abs(v.reconciliation.drift),
      cell: (v) => (
        <Link to={`/admin/finance/reconciliation?supplier=${v.supplier.id}`} onClick={(e) => e.stopPropagation()} className={cn('font-mono text-[12.5px] hover:underline', v.reconciliation.drift === 0 ? 'text-fg-3' : 'text-warning')}>
          <Money value={v.reconciliation.drift} sign />
        </Link>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        eyebrow={
          <Link to="/admin/integrations/providers" className="hover:text-fg hover:underline">
            Provider API · inbound
          </Link>
        }
        title="Suppliers"
        description="Upstream providers whose APIs ORVEX consumes, each through a structured adapter (DHRU Fusion, ORVEX REST, Manual). Credentials, health, circuit breaker, balances and catalog sync in one place."
        actions={
          <>
            <Segmented
              size="sm"
              value={view}
              onChange={(v) => setParams(v === 'cards' ? {} : { view: v }, { replace: true })}
              items={[
                { value: 'cards', label: 'Cards', icon: <LayoutGrid /> },
                { value: 'table', label: 'Table', icon: <Rows3 /> },
              ]}
            />
            <Guarded permission="suppliers.manage">
              {(ok) => (
                <Button variant="accent" leading={<Plus />} disabled={!ok} onClick={() => setConnecting(true)}>
                  Connect provider API
                </Button>
              )}
            </Guarded>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile icon={<Server />} label="Suppliers" value={num(summary.total)} sub={`${summary.healthy} healthy · ${summary.attention} need attention`} loading={q.isLoading} tone={summary.attention ? 'warning' : undefined} />
        <Tile icon={<Wallet />} label="Reported balances" value={<Money value={summary.balance} compact />} sub="Sum of getBalance() results" loading={q.isLoading} />
        <Tile icon={<CloudDownload />} label="Pending sync changes" value={num(summary.pending)} sub="Waiting for review" loading={q.isLoading} to="/admin/catalog/sync" tone={summary.pending ? 'warning' : undefined} />
        <Tile icon={<Scale />} label="Balance drift" value={num(summary.drift)} sub="Suppliers with expected ≠ actual" loading={q.isLoading} to="/admin/finance/reconciliation" tone={summary.drift ? 'warning' : undefined} />
      </div>

      {q.isError ? (
        <ErrorPanel error={q.error} onRetry={() => q.refetch()} />
      ) : view === 'table' ? (
        <Card>
          <DataTable columns={columns} rows={q.data} rowKey={(v) => v.supplier.id} loading={q.isLoading} onRowClick={(v) => navigate(`/admin/suppliers/${v.supplier.id}`)} minWidth={920} dense />
        </Card>
      ) : q.isLoading ? (
        <LoadingCards count={6} className="sm:grid-cols-2 xl:grid-cols-3" height="h-64" />
      ) : q.data?.length === 0 ? (
        <Card>
          <EmptyState icon={<Server />} title="No suppliers connected" description="Connect a DHRU Fusion, REST or manual supplier to start mapping offers." />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {q.data?.map((v, i) => <SupplierCard key={v.supplier.id} v={v} index={i} />)}
        </div>
      )}

      <ConnectSupplierDrawer open={connecting} onClose={() => setConnecting(false)} />
    </div>
  )
}

function Tile({ icon, label, value, sub, loading, to, tone }: { icon: ReactNode; label: string; value: ReactNode; sub: string; loading?: boolean; to?: string; tone?: 'warning' }) {
  const body = (
    <div className={cn('h-full rounded-xl border border-line bg-surface p-3.5 shadow-card', to && 'transition-colors hover:border-line-strong')}>
      <div className="flex items-center gap-2 text-[12px] text-fg-3 [&_svg]:size-3.5">
        {icon}
        {label}
      </div>
      {loading ? <Skeleton className="mt-2 h-6 w-16" /> : <div className={cn('mt-1.5 font-display text-[22px] leading-none font-semibold tabular', tone === 'warning' ? 'text-warning' : 'text-fg')}>{value}</div>}
      <div className="mt-1 truncate text-[11.5px] text-fg-3">{sub}</div>
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

function SupplierCard({ v, index }: { v: SupplierView; index: number }) {
  const s = v.supplier
  const low = s.reportedBalance < s.lowBalanceThreshold
  const circuit = CIRCUIT[s.circuit.state]!
  const attention = v.health !== 'healthy'
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 10) * 0.03 }}>
      <Link to={`/admin/suppliers/${s.id}`} className={cn('flex h-full flex-col rounded-xl border bg-surface shadow-card transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-pop', attention && ['auth_error', 'circuit_open'].includes(v.health) ? 'border-danger/30' : 'border-line')}>
        <div className="flex items-start gap-3 p-4 pb-3">
          <SupplierMark name={s.name} color={s.color} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-semibold">{s.name}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-fg-3">
              {DRIVER_META[s.driver].label} v{v.driver.version}
              <SimulatedBadge />
            </div>
          </div>
          <HealthBadge health={v.health} />
        </div>

        {s.auth.status === 'failed' && <div className="mx-4 mb-2 truncate rounded-md bg-danger/[0.07] px-2.5 py-1.5 text-[11.5px] text-danger">{s.auth.message ?? 'Authentication failing'}</div>}
        {s.maintenance.active && <div className="mx-4 mb-2 truncate rounded-md bg-info/[0.08] px-2.5 py-1.5 text-[11.5px] text-info">Maintenance{s.maintenance.note ? ` — ${s.maintenance.note}` : ''}</div>}

        <div className="px-4">
          <div className="flex items-baseline justify-between">
            <span className="mono-label">Reported balance</span>
            <span className="text-[11px] text-fg-3">
              threshold <Money value={s.lowBalanceThreshold} />
            </span>
          </div>
          <Money value={s.reportedBalance} className={cn('font-display text-[20px] font-semibold', low && 'text-warning')} />
          <BalanceMeter value={s.reportedBalance} threshold={s.lowBalanceThreshold} className="mt-1.5" />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line px-4 py-3 text-[12px]">
          <Metric label="Success 7d" value={`${v.metrics.successRate.toFixed(1)}%`} warn={v.metrics.successRate < 94} />
          <Metric label="p50" value={v.metrics.latencyP50 ? ms(v.metrics.latencyP50) : '—'} />
          <div>
            <div className="text-[11px] text-fg-3">Circuit</div>
            <Tooltip content={`${s.circuit.consecutiveFailures}/${s.circuit.threshold} consecutive failures · cooldown ${s.circuit.cooldownSec}s`}>
              <Badge tone={circuit.tone} className="mt-0.5">
                {circuit.label}
              </Badge>
            </Tooltip>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-[11.5px] text-fg-3">
          <span>
            Sync <RelTime iso={v.lastSync?.finishedAt ?? s.lastSyncAt} />
            {v.pendingChanges > 0 && <span className="ml-1.5 font-medium text-warning">· {v.pendingChanges} pending</span>}
          </span>
          {v.reconciliation.drift !== 0 ? (
            <span className="inline-flex items-center gap-1 text-warning">
              <ShieldAlert className="size-3" /> drift <Money value={v.reconciliation.drift} sign />
            </span>
          ) : (
            <span>no drift</span>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

function Metric({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-fg-3">{label}</div>
      <div className={cn('mt-0.5 font-mono text-[13px] tabular', warn ? 'text-warning' : 'text-fg')}>{value}</div>
    </div>
  )
}
