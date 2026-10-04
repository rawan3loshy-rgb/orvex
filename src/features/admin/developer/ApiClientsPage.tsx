import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { KeyRound, Plus, Users } from 'lucide-react'
import { Badge, Button, Card, DataTable, EmptyState, KpiCard, PageHeader, SearchInput, type Column } from '@/components/ui'
import { Guarded, Money } from '@/components/domain'
import { useCategories, usePricing } from '@/hooks/installation'
import { num } from '@/lib/format'
import { PricingTierChip } from '../accounts/shared'
import { tierColor } from '../accounts/helpers'
import { DhruChip, QueryError } from './shared'
import { sinceShort } from './helpers'
import { accessLabel, useApiClients, type ApiClientRow } from './clients/data'
import { ClientDrawer } from './clients/ClientDrawer'
import { CreateKeyModal } from './keys/CreateKeyModal'

/** Reseller API (outbound): the businesses and apps that call ORVEX. */
export default function ApiClientsPage() {
  const [params, setParams] = useSearchParams()
  const selected = params.get('client')
  const setSelected = (id: string | null) => {
    const next = new URLSearchParams(params)
    if (id) next.set('client', id)
    else next.delete('client')
    setParams(next, { replace: true })
  }
  const clients = useApiClients()
  const pricing = usePricing()
  const cats = useCategories()
  const catNames = useMemo(() => new Map((cats.data ?? []).map((c) => [c.id, c.name])), [cats.data])
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)

  const all = useMemo(() => clients.data ?? [], [clients.data])
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? all.filter((c) => [c.row.account.name, c.row.account.number, c.row.account.email, c.row.tierName].some((s) => s.toLowerCase().includes(q))) : all
  }, [all, search])

  const columns: Column<ApiClientRow>[] = [
    {
      key: 'client',
      header: 'Client',
      sortValue: (c) => c.row.account.name,
      cell: (c) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{c.row.account.name}</div>
          <div className="truncate text-[11.5px] text-fg-3">
            <span className="font-mono">{c.row.account.number}</span>
            {c.row.account.website && <> · {c.row.account.website.replace(/^https?:\/\//, '')}</>}
          </div>
        </div>
      ),
    },
    { key: 'tier', header: 'Price tier', sortValue: (c) => c.row.tierName, cell: (c) => <PricingTierChip name={c.row.tierName} color={tierColor(pricing.data?.tiers, c.row.account.pricingTierId)} /> },
    {
      key: 'access',
      header: 'Service access',
      hideBelow: 'lg',
      cell: (c) => (
        <Badge tone={c.row.account.serviceAccess.mode === 'all' ? 'success' : 'neutral'} variant="outline">
          {accessLabel(c.row.account.serviceAccess, catNames)}
        </Badge>
      ),
    },
    {
      key: 'channels',
      header: 'Protocol',
      hideBelow: 'md',
      cell: (c) => (
        <span className="flex items-center gap-1">
          {c.row.account.channels.api && <Badge tone="accent">REST v1</Badge>}
          {c.row.account.channels.dhru && <DhruChip />}
        </span>
      ),
    },
    { key: 'keys', header: 'Keys', align: 'right', sortValue: (c) => c.activeKeys, cell: (c) => <span className={c.activeKeys ? 'tabular' : 'text-fg-3'}>{c.activeKeys}</span> },
    { key: 'rate', header: 'Orders/min', align: 'right', hideBelow: 'xl', sortValue: (c) => c.row.account.limits.ordersPerMinute, cell: (c) => <span className="font-mono text-[12px] text-fg-2">{num(c.row.account.limits.ordersPerMinute)}</span> },
    { key: 'balance', header: 'Balance', align: 'right', sortValue: (c) => c.row.balance.available, cell: (c) => <Money value={c.row.balance.available} tone="auto" className="font-mono text-[12.5px]" /> },
    { key: 'req', header: 'Req · 24h', align: 'right', sortValue: (c) => c.requests24h, cell: (c) => <span className="tabular">{num(c.requests24h)}</span> },
    { key: 'last', header: 'Last call', hideBelow: 'lg', sortValue: (c) => (c.lastUsedAt ? new Date(c.lastUsedAt).getTime() : 0), cell: (c) => <span className="text-[12.5px] whitespace-nowrap text-fg-2">{sinceShort(c.lastUsedAt)}</span> },
  ]

  const totalKeys = all.reduce((a, c) => a + c.activeKeys, 0)
  return (
    <div>
      <PageHeader
        icon={<Users />}
        eyebrow={
          <Link to="/admin/developer" className="hover:text-fg hover:underline">
            Reseller API · outbound
          </Link>
        }
        title="API clients"
        description="Resellers and applications that sell ORVEX services from their own systems. Each client is an account: its keys and permissions, the services it may order, its price tier, its limits and its wallet."
        actions={
          <Guarded permission="developer.manage">
            {(ok) => (
              <Button variant="accent" leading={<Plus />} disabled={!ok} onClick={() => setCreating(true)}>
                Issue API key
              </Button>
            )}
          </Guarded>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="API clients" value={num(all.length)} loading={clients.isLoading} footer="Accounts with API or DHRU access" />
        <KpiCard label="Active keys" value={num(totalKeys)} loading={clients.isLoading} icon={<KeyRound />} footer={`${num(all.filter((c) => c.activeKeys === 0).length)} clients without a key`} />
        <KpiCard label="Requests · 24h" value={num(all.reduce((a, c) => a + c.requests24h, 0))} loading={clients.isLoading} footer="All clients, all keys" />
        <KpiCard label="Restricted access" value={num(all.filter((c) => c.row.account.serviceAccess.mode !== 'all').length)} loading={clients.isLoading} footer="Clients limited to some services" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput value={search} onChange={setSearch} placeholder="Search client, account no., tier…" className="sm:w-[300px]" />
          <span className="text-[12px] text-fg-3">Click a client to manage its keys, service access, pricing and limits.</span>
        </div>
        {clients.isError ? (
          <QueryError error={clients.error} onRetry={() => clients.refetch()} />
        ) : (
          <DataTable
            columns={columns}
            rows={clients.data ? rows : undefined}
            loading={clients.isLoading}
            rowKey={(c) => c.row.account.id}
            onRowClick={(c) => setSelected(c.row.account.id)}
            selectedKey={selected}
            minWidth={820}
            defaultSort={{ key: 'req', dir: 'desc' }}
            empty={<EmptyState compact icon={<Users />} title="No API clients" description="Enable the Reseller API channel on an account to make it an API client." />}
          />
        )}
      </Card>

      <ClientDrawer accountId={selected} onClose={() => setSelected(null)} />
      <CreateKeyModal open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}
