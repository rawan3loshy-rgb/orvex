import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Ban, KeyRound, Plus, ShieldCheck } from 'lucide-react'
import { useApiKeys } from '@/hooks/installation'
import type { ApiKeyRow } from '@/types/installation'
import { Button, Card, DataTable, EmptyState, KpiCard, PageHeader, SearchInput, Segmented, Select, StatusBadge, Switch, Tooltip, type Column } from '@/components/ui'
import { Guarded } from '@/components/domain'
import { num } from '@/lib/format'
import { DhruChip, EnvBadge, KeyId, QueryError, ScopeChips } from './shared'
import { sinceShort } from './helpers'
import { CreateKeyModal } from './keys/CreateKeyModal'
import { KeyDrawer, RevokeKeyDialog } from './keys/KeyDrawer'

type StatusFilter = 'active' | 'revoked' | 'all'

export default function ApiKeysPage() {
  const [params, setParams] = useSearchParams()
  const createOpen = params.get('create') === '1'
  const setCreateOpen = (v: boolean) => {
    const next = new URLSearchParams(params)
    if (v) next.set('create', '1')
    else next.delete('create')
    setParams(next, { replace: true })
  }

  const keys = useApiKeys()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [env, setEnv] = useState('all')
  const [accountId, setAccountId] = useState('all')
  const [dhruOnly, setDhruOnly] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<ApiKeyRow | null>(null)

  const all = useMemo(() => keys.data ?? [], [keys.data])
  const accounts = useMemo(() => [...new Map(all.map((k) => [k.accountId, k.accountName])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [all])
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((k) => {
      if (status !== 'all' && k.status !== status) return false
      if (env !== 'all' && k.environment !== env) return false
      if (accountId !== 'all' && k.accountId !== accountId) return false
      if (dhruOnly && !k.dhruCompat) return false
      if (q && ![k.name, k.accountName, k.prefix, k.hash, ...k.ipAllowlist].some((s) => s.toLowerCase().includes(q))) return false
      return true
    })
  }, [all, search, status, env, accountId, dhruOnly])

  const active = all.filter((k) => k.status === 'active')
  const selected = all.find((k) => k.id === selectedId)

  const columns: Column<ApiKeyRow>[] = [
    {
      key: 'key',
      header: 'Key',
      sortValue: (k) => k.name,
      cell: (k) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-fg">{k.name}</span>
          </div>
          <KeyId apiKey={k} className="mt-0.5" />
          <div className="mt-0.5 hidden truncate font-mono text-[10.5px] text-fg-3 xl:block" title="Only a sha256 hash is stored">
            {k.hash}
          </div>
        </div>
      ),
    },
    { key: 'account', header: 'Account', sortValue: (k) => k.accountName, cell: (k) => <span className="text-fg-2">{k.accountName}</span> },
    { key: 'env', header: 'Env', cell: (k) => <EnvBadge env={k.environment} />, hideBelow: 'md' },
    { key: 'scopes', header: 'Scopes', cell: (k) => <ScopeChips scopes={k.scopes} className="max-w-[230px]" />, hideBelow: 'lg' },
    {
      key: 'ip',
      header: 'IP allow-list',
      hideBelow: 'xl',
      cell: (k) =>
        k.ipAllowlist.length ? (
          <Tooltip content={k.ipAllowlist.join(', ')}>
            <span className="font-mono text-[11.5px] text-fg-2">
              {k.ipAllowlist[0]}
              {k.ipAllowlist.length > 1 && <span className="text-fg-3"> +{k.ipAllowlist.length - 1}</span>}
            </span>
          </Tooltip>
        ) : (
          <span className="text-[12px] text-fg-3">Any</span>
        ),
    },
    { key: 'rate', header: 'Rate', align: 'right', hideBelow: 'xl', sortValue: (k) => k.rateLimitPerMin, cell: (k) => <span className="font-mono text-[12px] text-fg-2">{num(k.rateLimitPerMin)}/m</span> },
    { key: 'dhru', header: 'DHRU', align: 'center', hideBelow: 'md', cell: (k) => (k.dhruCompat ? <DhruChip /> : <span className="text-fg-3">—</span>) },
    { key: 'last', header: 'Last used', sortValue: (k) => (k.lastUsedAt ? new Date(k.lastUsedAt).getTime() : 0), hideBelow: 'lg', cell: (k) => <span className="text-[12.5px] whitespace-nowrap text-fg-2">{sinceShort(k.lastUsedAt)}</span> },
    { key: 'req', header: 'Req · 24h', align: 'right', sortValue: (k) => k.requests24h, cell: (k) => <span className="tabular">{num(k.requests24h)}</span> },
    { key: 'status', header: 'Status', cell: (k) => <StatusBadge status={k.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (k) =>
        k.status === 'active' ? (
          <Guarded permission="developer.manage">
            {(ok) => (
              <Button
                size="xs"
                variant="ghost"
                leading={<Ban />}
                disabled={!ok}
                onClick={(e) => {
                  e.stopPropagation()
                  setRevoking(k)
                }}
              >
                Revoke
              </Button>
            )}
          </Guarded>
        ) : null,
    },
  ]

  return (
    <div>
      <PageHeader
        icon={<KeyRound />}
        title="API keys"
        description="Keys belong to accounts — any tier with the API or DHRU channel enabled. Only a sha256 hash of each secret is stored."
        actions={
          <Guarded permission="developer.manage">
            {(ok) => (
              <Button variant="accent" leading={<Plus />} disabled={!ok} onClick={() => setCreateOpen(true)}>
                Create key
              </Button>
            )}
          </Guarded>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Active keys" value={num(active.length)} loading={keys.isLoading} footer={`${num(new Set(active.map((k) => k.accountId)).size)} accounts`} />
        <KpiCard label="Requests · 24h" value={num(active.reduce((a, k) => a + k.requests24h, 0))} loading={keys.isLoading} footer="Native + DHRU, all keys" />
        <KpiCard label="DHRU-compatible" value={num(active.filter((k) => k.dhruCompat).length)} loading={keys.isLoading} footer="Also authenticate /api/dhru" />
        <KpiCard label="IP-restricted" value={num(active.filter((k) => k.ipAllowlist.length).length)} loading={keys.isLoading} icon={<ShieldCheck />} footer="Allow-list enforced" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, account, prefix, IP…" className="lg:w-[300px]" />
          <Segmented<StatusFilter>
            value={status}
            onChange={setStatus}
            items={[
              { value: 'active', label: 'Active', count: active.length },
              { value: 'revoked', label: 'Revoked', count: all.length - active.length },
              { value: 'all', label: 'All' },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <Select inputSize="sm" className="w-[180px]" value={accountId} onChange={(e) => setAccountId(e.target.value)} options={[{ value: 'all', label: 'All accounts' }, ...accounts.map(([id, name]) => ({ value: id, label: name }))]} />
            <Select
              inputSize="sm"
              className="w-[120px]"
              value={env}
              onChange={(e) => setEnv(e.target.value)}
              options={[
                { value: 'all', label: 'Any env' },
                { value: 'live', label: 'Live' },
                { value: 'test', label: 'Test' },
              ]}
            />
            <label className="flex items-center gap-2 text-[12.5px] text-fg-2">
              <Switch size="sm" checked={dhruOnly} onChange={setDhruOnly} label="DHRU only" /> DHRU only
            </label>
          </div>
        </div>
        {keys.isError ? (
          <QueryError error={keys.error} onRetry={() => keys.refetch()} />
        ) : (
          <DataTable
            columns={columns}
            rows={keys.data ? rows : undefined}
            loading={keys.isLoading}
            rowKey={(k) => k.id}
            onRowClick={(k) => setSelectedId(k.id)}
            selectedKey={selectedId}
            minWidth={760}
            defaultSort={{ key: 'req', dir: 'desc' }}
            rowClassName={(k) => (k.status === 'revoked' ? 'opacity-60' : undefined)}
            empty={<EmptyState compact icon={<KeyRound />} title="No keys match" description="Adjust the filters or create a key for an account with API access." />}
          />
        )}
      </Card>

      <KeyDrawer apiKey={selected} open={!!selected} onClose={() => setSelectedId(null)} onRevoke={(k) => setRevoking(k)} />
      <RevokeKeyDialog apiKey={revoking} open={!!revoking} onClose={() => setRevoking(null)} />
      <CreateKeyModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
