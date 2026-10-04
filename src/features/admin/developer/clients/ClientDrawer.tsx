import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRight, KeyRound, Plus, ScrollText, Tags, Users, Webhook } from 'lucide-react'
import { Badge, Button, Card, CardHeader, DataTable, Drawer, EmptyState, Skeleton, StatusBadge, Tabs, type Column } from '@/components/ui'
import { Guarded, Money } from '@/components/domain'
import { useAccount, useApiKeys, useApiLogs, useCategories, usePriceMatrix, usePricing } from '@/hooks/installation'
import type { AccountDetail, ApiKeyRow, PriceMatrixRow } from '@/types/installation'
import { cn } from '@/lib/cn'
import { num, time } from '@/lib/format'
import { ChannelsCard, LimitsCard, ServiceAccessCard } from '../../accounts/detail/OverviewTab'
import { PricingTierChip } from '../../accounts/shared'
import { tierColor } from '../../accounts/helpers'
import { DhruChip, EnvBadge, KeyId, MethodBadge, ScopeChips, StatusCode } from '../shared'
import { sinceShort } from '../helpers'
import { CreateKeyModal } from '../keys/CreateKeyModal'

type Tab = 'access' | 'keys' | 'pricing' | 'activity'

/** One API client (= account with API access): permissions, keys, prices and traffic in one place. */
export function ClientDrawer({ accountId, onClose }: { accountId: string | null; onClose: () => void }) {
  const q = useAccount(accountId ?? undefined)
  const [tab, setTab] = useState<Tab>('access')
  const d = q.data
  return (
    <Drawer
      open={!!accountId}
      onClose={onClose}
      width="xl"
      icon={<Users />}
      title={d ? d.account.name : 'API client'}
      description={d ? `${d.account.number} · ${d.account.email}` : undefined}
      actions={
        d && (
          <Link to={`/admin/accounts/${d.account.id}`} className="inline-flex items-center gap-1 text-[12.5px] text-accent-ink hover:underline">
            Account <ArrowRight className="size-3.5" />
          </Link>
        )
      }
    >
      {!d ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-56" />
        </div>
      ) : (
        <div className="grid gap-4">
          <Summary d={d} />
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            items={[
              { value: 'access', label: 'Access & limits' },
              { value: 'keys', label: 'Keys & webhooks', count: d.apiKeys.filter((k) => k.status === 'active').length },
              { value: 'pricing', label: 'Pricing' },
              { value: 'activity', label: 'API activity' },
            ]}
          />
          <div key={tab} className="animate-fade-up">
            {tab === 'access' && (
              <div className="grid gap-4">
                <ServiceAccessCard a={d.account} />
                <div className="grid gap-4 lg:grid-cols-2">
                  <ChannelsCard a={d.account} />
                  <LimitsCard a={d.account} />
                </div>
              </div>
            )}
            {tab === 'keys' && <KeysTab d={d} />}
            {tab === 'pricing' && <PricingTab d={d} />}
            {tab === 'activity' && <ActivityTab d={d} />}
          </div>
        </div>
      )}
    </Drawer>
  )
}

function Summary({ d }: { d: AccountDetail }) {
  const pricing = usePricing()
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
      <Cell label="Balance (available)">
        <Money value={d.balance.available} className="font-mono" tone="auto" />
      </Cell>
      <Cell label="Held for open orders">
        <Money value={d.balance.held} className="font-mono" />
      </Cell>
      <Cell label="Price tier">
        <PricingTierChip name={d.tierName} color={tierColor(pricing.data?.tiers, d.account.pricingTierId)} />
      </Cell>
      <Cell label="Status">
        <StatusBadge status={d.account.status} />
      </Cell>
    </div>
  )
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 bg-surface px-3.5 py-2.5">
      <div className="text-[11.5px] text-fg-3">{label}</div>
      <div className="mt-0.5 truncate text-[13.5px] font-medium">{children}</div>
    </div>
  )
}

/* ---------------------------------- Keys ---------------------------------- */
function KeysTab({ d }: { d: AccountDetail }) {
  const keys = useApiKeys({ accountId: d.account.id })
  const [creating, setCreating] = useState(false)
  const apiOff = !d.account.channels.api && !d.account.channels.dhru
  const columns: Column<ApiKeyRow>[] = [
    {
      key: 'key',
      header: 'Key',
      cell: (k) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{k.name}</div>
          <KeyId apiKey={k} className="mt-0.5" />
        </div>
      ),
    },
    { key: 'env', header: 'Env', cell: (k) => <EnvBadge env={k.environment} /> },
    { key: 'scopes', header: 'Permissions', cell: (k) => <ScopeChips scopes={k.scopes} className="max-w-[260px]" /> },
    { key: 'rate', header: 'Rate', align: 'right', cell: (k) => <span className="font-mono text-[12px] text-fg-2">{num(k.rateLimitPerMin)}/m</span> },
    { key: 'ip', header: 'IP', hideBelow: 'lg', cell: (k) => <span className="font-mono text-[11.5px] text-fg-2">{k.ipAllowlist[0] ?? 'Any'}</span> },
    { key: 'dhru', header: '', hideBelow: 'md', cell: (k) => (k.dhruCompat ? <DhruChip /> : null) },
    { key: 'last', header: 'Last used', cell: (k) => <span className="text-[12px] whitespace-nowrap text-fg-2">{sinceShort(k.lastUsedAt)}</span> },
    { key: 'status', header: 'Status', cell: (k) => <StatusBadge status={k.status} /> },
  ]
  return (
    <div className="grid gap-4">
      <Card className="overflow-hidden">
        <CardHeader
          icon={<KeyRound />}
          title="API keys"
          description="Scopes are the key’s permissions; IP allow-list and rate limit apply per key. Account limits apply on top."
          actions={
            <Guarded permission="developer.manage">
              {(ok) => (
                <Button size="sm" variant="accent" leading={<Plus />} disabled={!ok || apiOff} onClick={() => setCreating(true)}>
                  Create key
                </Button>
              )}
            </Guarded>
          }
        />
        {apiOff && <p className="px-5 pb-3 text-[12px] text-warning">Enable the Reseller API or DHRU channel (Access & limits) before issuing keys.</p>}
        <DataTable columns={columns} rows={keys.data} loading={keys.isLoading} rowKey={(k) => k.id} dense minWidth={720} rowClassName={(k) => (k.status === 'revoked' ? 'opacity-60' : undefined)} empty={<EmptyState compact icon={<KeyRound />} title="No keys yet" description="Create a key to let this client call the ORVEX API." />} />
        <div className="border-t border-line px-5 py-2.5 text-[12px]">
          <Link to="/admin/developer/keys" className="inline-flex items-center gap-1 text-accent-ink hover:underline">
            Manage all keys <ArrowRight className="size-3" />
          </Link>
        </div>
      </Card>
      <Card>
        <CardHeader icon={<Webhook />} title="Webhooks" description="Where ORVEX pushes this client’s order events (signed, retried)." />
        {d.webhooks.length === 0 ? (
          <EmptyState compact title="No endpoints" description="The client polls GET /v1/orders/{id} instead." />
        ) : (
          <div className="divide-y divide-line border-t border-line">
            {d.webhooks.map((w) => (
              <div key={w.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
                <div className="min-w-0">
                  <div className="truncate font-mono text-[12px]">{w.url}</div>
                  <div className="truncate text-[11.5px] text-fg-3">{w.events.join(' · ')}</div>
                </div>
                <StatusBadge status={w.status} />
              </div>
            ))}
          </div>
        )}
      </Card>
      <CreateKeyModal open={creating} onClose={() => setCreating(false)} defaultAccountId={d.account.id} />
    </div>
  )
}

/* -------------------------------- Pricing -------------------------------- */
function PricingTab({ d }: { d: AccountDetail }) {
  const matrix = usePriceMatrix()
  const cats = useCategories()
  const sa = d.account.serviceAccess
  const rows = useMemo(() => {
    const names = new Set(sa.mode === 'categories' ? sa.categoryIds.map((id) => cats.data?.find((c) => c.id === id)?.name) : [])
    return (matrix.data ?? []).filter((r) => (sa.mode === 'all' ? true : sa.mode === 'services' ? sa.serviceIds.includes(r.serviceId) : names.has(r.categoryName)))
  }, [matrix.data, cats.data, sa])
  const tier = d.account.pricingTierId
  const columns: Column<PriceMatrixRow>[] = [
    {
      key: 'name',
      header: 'ORVEX service',
      sortValue: (r) => r.name,
      cell: (r) => (
        <div className="min-w-0">
          <Link to={`/admin/services/${r.serviceId}`} className="truncate font-medium hover:underline">
            {r.name}
          </Link>
          <div className="text-[11.5px] text-fg-3">{r.categoryName}</div>
        </div>
      ),
    },
    { key: 'retail', header: 'Retail', align: 'right', sortValue: (r) => r.prices.tier_retail?.amount ?? 0, cell: (r) => <Money value={r.prices.tier_retail?.amount} className="font-mono text-[12.5px] text-fg-3" /> },
    {
      key: 'client',
      header: `${d.tierName} price (API)`,
      align: 'right',
      sortValue: (r) => r.prices[tier]?.amount ?? 0,
      cell: (r) => {
        const p = r.prices[tier]
        return (
          <span className="inline-flex items-center gap-1.5">
            {p?.inherited && <Badge tone="neutral" variant="outline">inherited</Badge>}
            <Money value={p?.amount} className="font-mono text-[13px] font-semibold" />
          </span>
        )
      },
    },
  ]
  return (
    <Card className="overflow-hidden">
      <CardHeader icon={<Tags />} title="What this client pays through the API" description={`GET /v1/services returns the ${d.tierName} price for every service in its access list. Supplier costs and offers are never exposed.`} />
      <DataTable columns={columns} rows={matrix.data ? rows : undefined} loading={matrix.isLoading} rowKey={(r) => r.serviceId} dense minWidth={520} defaultSort={{ key: 'name', dir: 'asc' }} empty={<EmptyState compact title="No services in access" />} />
      <div className="border-t border-line px-5 py-2.5 text-[12px] text-fg-3">
        {num(rows.length)} services available to this client ·{' '}
        <Link to="/admin/pricing" className="text-accent-ink hover:underline">
          Pricing rules
        </Link>
      </div>
    </Card>
  )
}

/* -------------------------------- Activity -------------------------------- */
function ActivityTab({ d }: { d: AccountDetail }) {
  const logs = useApiLogs({ accountId: d.account.id, pageSize: 15 })
  const items = logs.data?.items ?? []
  return (
    <Card className="overflow-hidden">
      <CardHeader icon={<ScrollText />} title="Recent API calls" description="Native API and DHRU-compatible requests made with this client’s keys." />
      {logs.isLoading ? (
        <div className="space-y-2 px-5 pb-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState compact title="No API calls yet" />
      ) : (
        <div className="divide-y divide-line border-t border-line">
          {items.map((l) => (
            <div key={l.id} className="flex items-center gap-3 px-5 py-2">
              <span className="w-[62px] shrink-0 font-mono text-[11.5px] text-fg-3">{time(l.at, true)}</span>
              <MethodBadge method={l.method} size="xs" />
              <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg-2">{l.protocol === 'dhru' ? `DHRU ${l.endpoint}` : l.path}</span>
              {l.orderRef && (
                <Link to={`/admin/orders/${l.orderRef}`} className="hidden shrink-0 font-mono text-[11.5px] text-accent-ink hover:underline sm:inline">
                  {l.orderRef}
                </Link>
              )}
              <StatusCode status={l.status} className={cn('shrink-0')} />
              <span className="w-[52px] shrink-0 text-right font-mono text-[11.5px] text-fg-3">{l.latencyMs}ms</span>
            </div>
          ))}
        </div>
      )}
      <div className="border-t border-line px-5 py-2.5 text-[12px]">
        <Link to={`/admin/developer/logs?search=${encodeURIComponent(d.account.name)}`} className="inline-flex items-center gap-1 text-accent-ink hover:underline">
          All API logs for {d.account.name} <ArrowRight className="size-3" />
        </Link>
      </div>
    </Card>
  )
}
