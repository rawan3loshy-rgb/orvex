import { useMemo, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import {
  Activity,
  ArrowLeft,
  Boxes,
  ChartColumn,
  CircleCheck,
  Gauge,
  KeyRound,
  Plus,
  ReceiptText,
  ScrollText,
  ShieldOff,
  Tags,
  TriangleAlert,
  UserRound,
  UserX,
  Wallet,
} from 'lucide-react'
import { useApiKeys, useInstMutation, usePricingGroups, useReseller, useResellerUsage } from '@/hooks/installation'
import { resellersService } from '@/services/installation'
import type { Reseller, ResellerStatus } from '@/types/installation'
import { Button, Card, ConfirmDialog, CopyButton, EmptyState, KpiCard, Skeleton, StatusBadge, Tabs, type TabItem } from '@/components/ui'
import { cn } from '@/lib/cn'
import { date, ms, money, num, pct, relative } from '@/lib/format'
import { CreateApiKeyModal } from '@/features/admin/developer/keys/CreateApiKeyModal'
import { AdjustBalanceModal } from './resellers/AdjustBalanceModal'
import { CountryTag, GroupChip, LOW_BALANCE, ResellerAvatar, isLowBalance } from './resellers/shared'
import { ProfileTab } from './resellers/tabs/ProfileTab'
import { ApiAccessTab } from './resellers/tabs/ApiAccessTab'
import { ServicesTab } from './resellers/tabs/ServicesTab'
import { PricingTab } from './resellers/tabs/PricingTab'
import { OrdersTab } from './resellers/tabs/OrdersTab'
import { UsageTab } from './resellers/tabs/UsageTab'
import { ActivityTab } from './resellers/tabs/ActivityTab'
import { LimitsTab } from './resellers/tabs/LimitsTab'

type TabId = 'profile' | 'api' | 'services' | 'pricing' | 'orders' | 'usage' | 'activity' | 'limits'
const TAB_IDS: TabId[] = ['profile', 'api', 'services', 'pricing', 'orders', 'usage', 'activity', 'limits']

export default function ResellerDetailPage() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const reseller = useReseller(id)
  const usage = useResellerUsage(id)
  const groups = usePricingGroups()
  const keys = useApiKeys({ resellerId: id })

  const [adjustOpen, setAdjustOpen] = useState(false)
  const [keyOpen, setKeyOpen] = useState(false)
  const [statusTarget, setStatusTarget] = useState<ResellerStatus | null>(null)

  const rawTab = params.get('tab') as TabId | null
  const tab: TabId = rawTab && TAB_IDS.includes(rawTab) ? rawTab : 'profile'
  const setTab = (t: TabId) => {
    const next = new URLSearchParams(params)
    if (t === 'profile') next.delete('tab')
    else next.set('tab', t)
    setParams(next, { replace: true })
  }

  const setStatus = useInstMutation((status: ResellerStatus) => resellersService.update(id!, { status }), {
    success: (r) => (r.status === 'suspended' ? `${r.name} suspended` : `${r.name} activated`),
    onSuccess: () => setStatusTarget(null),
  })

  const r = reseller.data
  const group = groups.data?.find((g) => g.id === r?.pricingGroupId)

  const sparks = useMemo(() => {
    const d = usage.data?.daily ?? []
    return {
      orders: d.map((x) => x.orders),
      spend: d.map((x) => x.spend),
      success: d.map((x) => (x.orders ? ((x.orders - x.failed) / x.orders) * 100 : 100)),
    }
  }, [usage.data])

  if (reseller.isError)
    return (
      <Card className="mt-6">
        <EmptyState
          icon={<UserX />}
          title="Reseller not found"
          description={`No reseller with ID “${id}” exists in this installation. It may have been removed.`}
          action={
            <Button to="/admin/resellers" leading={<ArrowLeft />}>
              Back to resellers
            </Button>
          }
        />
      </Card>
    )

  const activeKeys = keys.data?.filter((k) => k.status === 'active').length

  const tabs: TabItem<TabId>[] = [
    { value: 'profile', label: 'Profile', icon: <UserRound /> },
    { value: 'api', label: 'API access', icon: <KeyRound />, count: activeKeys },
    { value: 'services', label: 'Services', icon: <Boxes />, count: r ? (r.allowedServiceIds === 'all' ? 'All' : r.allowedServiceIds.length) : undefined },
    { value: 'pricing', label: 'Pricing', icon: <Tags /> },
    { value: 'orders', label: 'Orders', icon: <ReceiptText />, count: r ? num(r.ordersTotal, { compact: true }) : undefined },
    { value: 'usage', label: 'Usage', icon: <ChartColumn /> },
    { value: 'activity', label: 'Activity', icon: <Activity /> },
    { value: 'limits', label: 'Limits', icon: <Gauge /> },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link to="/admin/resellers" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] text-fg-3 transition-colors hover:text-fg">
          <ArrowLeft className="size-3.5" />
          Resellers
        </Link>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          {r ? (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="flex min-w-0 items-start gap-4">
              <ResellerAvatar reseller={r} size="lg" className="size-12! text-[15px]! shadow-card" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <h1 className="font-display text-[26px] leading-tight font-semibold tracking-[-0.025em] text-fg">{r.name}</h1>
                  <StatusBadge status={r.status} size="md" />
                  <GroupChip group={group} size="md" />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-fg-3">
                  <CountryTag code={r.country} />
                  <Sep />
                  <span>Partner since {date(r.createdAt)}</span>
                  <Sep />
                  <span>Active {relative(r.lastActiveAt)}</span>
                  <Sep />
                  <span className="group inline-flex items-center gap-1 font-mono text-[11.5px]">
                    {r.id}
                    <CopyButton value={r.id} className="size-5" />
                  </span>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex items-start gap-4">
              <Skeleton className="size-12 rounded-full" />
              <div className="space-y-2.5">
                <Skeleton className="h-7 w-56" />
                <Skeleton className="h-3.5 w-80" />
              </div>
            </div>
          )}
          {r && (
            <div className="flex flex-wrap items-center gap-2">
              <Button leading={<Wallet />} onClick={() => setAdjustOpen(true)}>
                Adjust balance
              </Button>
              {r.status === 'active' ? (
                <Button variant="secondary" leading={<ShieldOff />} onClick={() => setStatusTarget('suspended')} className="hover:text-danger">
                  Suspend
                </Button>
              ) : (
                <Button variant="secondary" leading={<CircleCheck />} onClick={() => setStatusTarget('active')}>
                  Activate
                </Button>
              )}
              <Button variant="primary" leading={<Plus />} onClick={() => setKeyOpen(true)} disabled={r.status === 'suspended'}>
                Create API key
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Contextual banners */}
      {r && <Banners reseller={r} onAdjust={() => setAdjustOpen(true)} onActivate={() => setStatusTarget('active')} />}

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          loading={!r}
          icon={<Wallet />}
          label="Balance"
          value={r ? <span className={cn(isLowBalance(r) && 'text-warning', r.balance < 0 && 'text-danger')}>{money(r.balance)}</span> : null}
          footer={r ? (r.creditLimit ? `+ ${money(r.creditLimit)} credit limit` : 'Prepaid · no credit') : undefined}
          onClick={r ? () => setAdjustOpen(true) : undefined}
        />
        <KpiCard loading={!r || usage.isLoading} icon={<ReceiptText />} label="Orders · 30d" value={r ? num(r.orders30d) : null} spark={sparks.orders} sparkColor="var(--c2)" footer={r ? `${num(r.ordersTotal)} lifetime` : undefined} onClick={() => setTab('orders')} />
        <KpiCard loading={!r || usage.isLoading} icon={<ChartColumn />} label="Spend · 30d" value={r ? money(r.spend30d, { compact: true }) : null} spark={sparks.spend} sparkColor="var(--c1)" footer={r && r.orders30d ? `${money(r.spend30d / Math.max(1, r.orders30d))} avg per order` : 'No orders yet'} onClick={() => setTab('usage')} />
        <KpiCard
          loading={!r || usage.isLoading}
          icon={<CircleCheck />}
          label="Success rate"
          value={r ? (r.successRate30d ? pct(r.successRate30d) : '—') : null}
          spark={sparks.success}
          sparkColor={r && r.successRate30d && r.successRate30d < 92 ? 'var(--warning)' : 'var(--success)'}
          footer="Completed vs failed, 30d"
        />
        <KpiCard
          loading={usage.isLoading}
          icon={<ScrollText />}
          label="API requests · 24h"
          value={usage.data ? num(usage.data.api.requests24h) : '—'}
          footer={usage.data ? `${num(usage.data.api.errors24h)} errors · p50 ${ms(usage.data.api.p50)}` : undefined}
          className="col-span-2 md:col-span-1"
          onClick={() => setTab('usage')}
        />
      </div>

      <Tabs items={tabs} value={tab} onChange={setTab} className="mb-5" />

      {r ? (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
            {tab === 'profile' && <ProfileTab reseller={r} group={group} />}
            {tab === 'api' && <ApiAccessTab reseller={r} onCreateKey={() => setKeyOpen(true)} />}
            {tab === 'services' && <ServicesTab reseller={r} />}
            {tab === 'pricing' && <PricingTab reseller={r} />}
            {tab === 'orders' && <OrdersTab reseller={r} />}
            {tab === 'usage' && <UsageTab reseller={r} />}
            {tab === 'activity' && <ActivityTab reseller={r} />}
            {tab === 'limits' && <LimitsTab reseller={r} />}
          </motion.div>
        </AnimatePresence>
      ) : (
        <Skeleton className="h-[360px] rounded-xl" />
      )}

      {r && (
        <>
          <AdjustBalanceModal reseller={r} open={adjustOpen} onClose={() => setAdjustOpen(false)} />
          <CreateApiKeyModal open={keyOpen} onClose={() => setKeyOpen(false)} defaultOwnerId={r.id} lockOwner />
          <ConfirmDialog
            open={statusTarget !== null}
            onClose={() => setStatusTarget(null)}
            tone={statusTarget === 'suspended' ? 'danger' : 'default'}
            title={statusTarget === 'suspended' ? `Suspend ${r.name}?` : `Activate ${r.name}?`}
            description={
              statusTarget === 'suspended'
                ? 'All API requests from this reseller will be rejected with 403 account_suspended. Unlocks and checks already in progress still complete; balance and keys are kept.'
                : r.status === 'pending'
                  ? 'The reseller can start ordering IMEI checks, unlocks and codes immediately with their API keys, at their pricing group prices.'
                  : 'API access is restored immediately for all active keys.'
            }
            confirmLabel={statusTarget === 'suspended' ? 'Suspend reseller' : 'Activate reseller'}
            loading={setStatus.isPending}
            onConfirm={() => statusTarget && setStatus.mutate(statusTarget)}
          >
            {statusTarget === 'suspended' && (
              <div className="grid grid-cols-3 gap-3 rounded-xl border border-line bg-surface-2/60 p-3 text-[12px]">
                <div>
                  <div className="mono-label">Keys</div>
                  <div className="mt-1 text-fg tabular">{activeKeys ?? '—'} active</div>
                </div>
                <div>
                  <div className="mono-label">Balance</div>
                  <div className="mt-1 text-fg tabular">{money(r.balance)}</div>
                </div>
                <div>
                  <div className="mono-label">Orders 30d</div>
                  <div className="mt-1 text-fg tabular">{num(r.orders30d)}</div>
                </div>
              </div>
            )}
          </ConfirmDialog>
        </>
      )}
    </div>
  )
}

function Sep() {
  return <span className="text-fg-3/40">·</span>
}

function Banners({ reseller: r, onAdjust, onActivate }: { reseller: Reseller; onAdjust: () => void; onActivate: () => void }) {
  let banner: { tone: 'danger' | 'warning' | 'info'; icon: ReactNode; title: string; body: string; action: ReactNode } | null = null
  if (r.status === 'suspended')
    banner = {
      tone: 'danger',
      icon: <ShieldOff />,
      title: 'Reseller suspended',
      body: r.notes || 'API requests are rejected with 403 account_suspended.',
      action: (
        <Button size="sm" onClick={onActivate}>
          Reactivate
        </Button>
      ),
    }
  else if (r.status === 'pending')
    banner = {
      tone: 'info',
      icon: <UserRound />,
      title: 'Pending activation',
      body: r.notes || 'This shop cannot place orders or call the Reseller API until activated.',
      action: (
        <Button size="sm" variant="primary" onClick={onActivate}>
          Activate now
        </Button>
      ),
    }
  else if (isLowBalance(r))
    banner = {
      tone: 'warning',
      icon: <TriangleAlert />,
      title: `Balance below ${money(LOW_BALANCE)}`,
      body: `${money(r.balance)} left${r.creditLimit ? ` plus ${money(r.creditLimit)} credit` : ' and no credit line'}. New IMEI checks, unlocks and code orders are rejected with 402 insufficient_balance once funds run out; subscribed endpoints receive a balance.low event.`,
      action: (
        <Button size="sm" onClick={onAdjust} leading={<Plus />}>
          Top up
        </Button>
      ),
    }
  if (!banner) return null
  const cls = { danger: 'border-danger/25 bg-danger/[0.05] text-danger', warning: 'border-warning/30 bg-warning/[0.06] text-warning', info: 'border-info/25 bg-info/[0.06] text-info' }[banner.tone]
  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className={cn('mb-5 flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center', cls)}>
      <span className="flex min-w-0 flex-1 items-start gap-3 [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0">
        {banner.icon}
        <span className="min-w-0">
          <span className="block text-[13px] font-medium text-fg">{banner.title}</span>
          <span className="block text-[12.5px] text-fg-2">{banner.body}</span>
        </span>
      </span>
      <span className="shrink-0">{banner.action}</span>
    </motion.div>
  )
}
