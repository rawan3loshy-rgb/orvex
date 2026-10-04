import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, BookOpen, ChevronRight, Lock, LockOpen, Snowflake } from 'lucide-react'
import type { AccountDetail } from '@/types/installation'
import { accountsService } from '@/services/installation'
import { useAccount, useInstMutation, usePricing } from '@/hooks/installation'
import { Guarded, Money, PermissionHint } from '@/components/domain'
import { Button, Card, EmptyState, Field, Modal, Skeleton, Tabs, Textarea } from '@/components/ui'
import { relative } from '@/lib/format'
import { cn } from '@/lib/cn'
import { AccountStatus, Figure, LoadError, PricingTierChip, TierBadge } from './shared'
import { tierColor } from './helpers'
import { OverviewTab } from './detail/OverviewTab'
import { WalletTab } from './detail/WalletTab'
import { MembersTab } from './detail/MembersTab'
import { ApiTab, DhruTab, OrdersTab, PaymentsTab } from './detail/ActivityTabs'

type TabKey = 'overview' | 'orders' | 'wallet' | 'members' | 'api' | 'payments' | 'dhru'

export default function AccountDetailPage() {
  const { id } = useParams()
  const q = useAccount(id)
  const pricing = usePricing()
  const [params, setParams] = useSearchParams()
  const [freezeOpen, setFreezeOpen] = useState(false)

  if (q.isLoading) return <DetailSkeleton />
  if (q.isError || !q.data)
    return (
      <div>
        <BackLink />
        <Card>
          {q.isError && (q.error as { status?: number } | null)?.status !== 404 ? (
            <LoadError what="this account" onRetry={() => q.refetch()} />
          ) : (
            <EmptyState title="Account not found" description="It may have been closed, or the link is wrong." action={<Button to="/admin/accounts">All accounts</Button>} />
          )}
        </Card>
      </div>
    )

  const d = q.data
  const a = d.account
  const hasDhru = a.channels.dhru || !!d.dhruUsername
  const tabs: { value: TabKey; label: string; count?: number }[] = [
    { value: 'overview', label: 'Overview' },
    { value: 'orders', label: 'Orders', count: d.openOrders || undefined },
    { value: 'wallet', label: 'Wallet' },
    { value: 'members', label: 'Members', count: d.members.length },
    { value: 'api', label: 'API access', count: d.apiKeys.filter((k) => k.status === 'active').length },
    { value: 'payments', label: 'Payments & refunds', count: d.payments.length + d.refunds.length },
    ...(hasDhru ? [{ value: 'dhru' as const, label: 'DHRU' }] : []),
  ]
  const tabParam = params.get('tab') as TabKey | null
  const tab: TabKey = tabParam && tabs.some((t) => t.value === tabParam) ? tabParam : 'overview'
  const setTab = (t: TabKey) => {
    const next = new URLSearchParams(params)
    if (t === 'overview') next.delete('tab')
    else next.set('tab', t)
    setParams(next, { replace: true })
  }

  const frozen = a.status === 'frozen'

  return (
    <div>
      <BackLink />

      {/* Header */}
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-[26px] leading-tight font-semibold tracking-[-0.025em]">{a.name}</h1>
            <AccountStatus account={a} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-fg-3">
            <span className="font-mono text-fg-2">{a.number}</span>
            <TierBadge account={a} />
            <PricingTierChip name={d.tierName} color={tierColor(pricing.data?.tiers, a.pricingTierId)} />
            <span>{a.kind === 'guest' ? 'Guest account (created by guest checkout)' : 'Customer account'}</span>
            <span>· {a.country}</span>
            <span>· active {relative(a.lastActiveAt)}</span>
          </div>
          {a.statusReason && (
            <div className={cn('mt-2.5 inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12.5px]', frozen ? 'border-danger/30 bg-danger/[0.06] text-danger' : 'border-warning/30 bg-warning/[0.06] text-warning')}>
              {frozen ? <Snowflake className="size-3.5" /> : <Lock className="size-3.5" />}
              {frozen ? 'Frozen' : a.status === 'pending' ? 'Pending' : 'Closed'}: {a.statusReason}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" to={`/admin/orders?accountId=${a.id}`} trailing={<ChevronRight />}>
            Orders
          </Button>
          <Guarded permission="accounts.manage">
            {(allowed) =>
              frozen ? (
                <Button size="sm" leading={<LockOpen />} disabled={!allowed} onClick={() => setFreezeOpen(true)}>
                  Unfreeze
                </Button>
              ) : (
                <Button size="sm" variant="outline" leading={<Snowflake />} disabled={!allowed || a.status === 'closed'} onClick={() => setFreezeOpen(true)}>
                  Freeze
                </Button>
              )
            }
          </Guarded>
        </div>
      </div>

      <WalletCard d={d} />

      <Tabs<TabKey> className="mt-6 mb-5" items={tabs} value={tab} onChange={setTab} />

      {tab === 'overview' && <OverviewTab d={d} />}
      {tab === 'orders' && <OrdersTab d={d} />}
      {tab === 'wallet' && <WalletTab d={d} />}
      {tab === 'members' && <MembersTab d={d} />}
      {tab === 'api' && <ApiTab d={d} />}
      {tab === 'payments' && <PaymentsTab d={d} />}
      {tab === 'dhru' && <DhruTab d={d} />}

      <FreezeModal open={freezeOpen} onClose={() => setFreezeOpen(false)} d={d} />
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/admin/accounts" className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-fg-3 hover:text-fg">
      <ArrowLeft className="size-3.5" /> Accounts
    </Link>
  )
}

function WalletCard({ d }: { d: AccountDetail }) {
  const b = d.balance
  const a = d.account
  const usedCredit = b.available < 0
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 px-5 py-4.5 sm:grid-cols-4">
        <Figure label="Available" value={<Money value={b.available} />} tone={b.available < 0 ? 'danger' : d.lowBalance ? 'warning' : undefined} sub={d.lowBalance ? <span className="text-warning">Below alert of <Money value={a.lowBalanceAlert} /></span> : usedCredit ? 'Using post-paid credit' : 'Spendable funds in the wallet'} />
        <Figure label="Held" value={<Money value={b.held} />} sub={d.openOrders ? `Reserved for ${d.openOrders} open order${d.openOrders > 1 ? 's' : ''}` : 'No open orders'} />
        <Figure label="Credit limit" value={<Money value={b.creditLimit} />} sub={b.creditLimit ? 'Available may go negative to this' : 'Prepaid only'} />
        <Figure label="Spendable" value={<Money value={b.spendable} />} tone={b.spendable <= 0 ? 'danger' : 'success'} sub="available + credit limit" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-2/40 px-5 py-2.5 text-[12px] text-fg-3">
        <span className="inline-flex items-center gap-1.5">
          <BookOpen className="size-3.5" />
          Balances are ledger projections — see postings.
        </span>
        <Link to={`/admin/finance/ledger?accountId=${a.id}`} className="inline-flex items-center gap-1 font-medium text-accent-ink hover:underline">
          Ledger postings for {a.number} <ChevronRight className="size-3.5" />
        </Link>
      </div>
    </Card>
  )
}

function FreezeModal({ open, onClose, d }: { open: boolean; onClose: () => void; d: AccountDetail }) {
  const a = d.account
  const freezing = a.status !== 'frozen'
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const m = useInstMutation((r: string) => accountsService.setStatus(a.id, freezing ? 'frozen' : 'active', r), {
    success: freezing ? `${a.name} frozen` : `${a.name} unfrozen`,
    onSuccess: () => {
      setReason('')
      setTried(false)
      onClose()
    },
  })
  const invalid = reason.trim().length < 4
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      icon={freezing ? <Snowflake /> : <LockOpen />}
      title={freezing ? `Freeze ${a.name}?` : `Unfreeze ${a.name}?`}
      description={freezing ? 'New orders are refused on every channel (storefront, portal, API, DHRU). Open orders continue and their holds settle normally. Funds stay in the wallet.' : 'The account can place orders again on its enabled channels.'}
      footer={
        <>
          <PermissionHint permission="accounts.manage" className="mr-auto" />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={freezing ? 'danger' : 'primary'}
            loading={m.isPending}
            onClick={() => {
              setTried(true)
              if (!invalid) m.mutate(reason.trim())
            }}
          >
            {freezing ? 'Freeze account' : 'Unfreeze account'}
          </Button>
        </>
      }
    >
      <Field label="Reason" error={tried && invalid ? 'A reason is required — it is written to the audit log.' : undefined} hint="Recorded in the audit log with your name and role.">
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={freezing ? 'e.g. Chargeback on top-up PAY-… — finance review' : 'e.g. Documents received, review closed'} invalid={tried && invalid} autoFocus />
      </Field>
    </Modal>
  )
}

function DetailSkeleton() {
  return (
    <div>
      <Skeleton className="mb-5 h-4 w-24" />
      <Skeleton className="h-8 w-72" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <Skeleton className="mt-6 h-32 w-full rounded-xl" />
      <Skeleton className="mt-6 h-10 w-full" />
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  )
}
