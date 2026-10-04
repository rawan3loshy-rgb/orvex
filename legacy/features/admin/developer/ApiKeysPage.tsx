import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { motion } from 'motion/react'
import { BookOpen, Building, Copy, Ellipsis, Eye, Globe, KeyRound, Plus, ScrollText, ShieldCheck, Trash2 } from 'lucide-react'
import { useApiKeys, usePricingGroups, useResellers } from '@/hooks/installation'
import type { ApiKey } from '@/types/installation'
import { Badge, Button, Card, DataTable, DemoTag, EmptyState, MenuItem, MenuSeparator, PageHeader, Popover, SearchInput, Segmented, Select, Skeleton, StatusBadge, Tooltip, type Column } from '@/components/ui'
import { cn } from '@/lib/cn'
import { dateTime, num, pct } from '@/lib/format'
import { toast } from '@/stores/toast'
import { ResellerAvatar } from '@/features/admin/commerce/resellers/shared'
import { CreateApiKeyModal } from './keys/CreateApiKeyModal'
import { KeyDrawer } from './keys/KeyDrawer'
import { RevokeKeyDialog } from './keys/RevokeKeyDialog'
import { EnvBadge, KeyId, LoadError, ScopeChips, scopeSummary, sinceShort } from './shared'

type StatusFilter = 'all' | ApiKey['status']
type EnvFilter = 'all' | 'live' | 'test'
type ScopeFilter = 'any' | 'orders' | 'readonly' | 'webhooks'

const MIN = 60_000

/** Recency of the last request: live traffic (coral) → recent (graphite) → idle (hollow). */
function recency(k: ApiKey) {
  if (!k.lastUsedAt) return 'never' as const
  const age = Date.now() - new Date(k.lastUsedAt).getTime()
  return age < 5 * MIN ? ('live' as const) : age < 24 * 60 * MIN ? ('recent' as const) : ('idle' as const)
}

export default function ApiKeysPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const keys = useApiKeys()
  const resellers = useResellers()
  const groups = usePricingGroups()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [env, setEnv] = useState<EnvFilter>('all')
  const [scope, setScope] = useState<ScopeFilter>('any')
  const [drawer, setDrawer] = useState<{ id: string; open: boolean } | null>(null)
  const [revoking, setRevoking] = useState<ApiKey | null>(null)

  const resellerById = useMemo(() => new Map((resellers.data ?? []).map((r) => [r.id, r])), [resellers.data])
  const groupById = useMemo(() => new Map((groups.data ?? []).map((g) => [g.id, g])), [groups.data])
  const createOpen = params.get('create') === '1'
  const setCreate = (open: boolean) => {
    const next = new URLSearchParams(params)
    if (open) next.set('create', '1')
    else next.delete('create')
    setParams(next, { replace: true })
  }

  const all = keys.data ?? []
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return keys.data?.filter((k) => {
      if (status !== 'all' && k.status !== status) return false
      if (env !== 'all' && k.environment !== env) return false
      if (scope === 'orders' && !k.scopes.includes('orders:write')) return false
      if (scope === 'readonly' && k.scopes.some((s) => s === 'orders:write' || s === 'webhooks:manage')) return false
      if (scope === 'webhooks' && !k.scopes.includes('webhooks:manage')) return false
      if (!q) return true
      const owner = k.resellerId ? resellerById.get(k.resellerId)?.name : 'internal unlockdesk ops'
      return `${k.name} ${k.prefix} ${k.last4} ${owner ?? ''} ${k.scopes.join(' ')} ${scopeSummary(k.scopes)}`.toLowerCase().includes(q)
    })
  }, [keys.data, search, status, env, scope, resellerById])

  const summary = useMemo(() => {
    const active = all.filter((k) => k.status === 'active')
    const soon = active.filter((k) => k.expiresAt && new Date(k.expiresAt).getTime() - Date.now() < 30 * 86400_000)
    const requests = all.reduce((a, k) => a + k.requests24h, 0)
    const top = [...all].sort((a, b) => b.requests24h - a.requests24h)[0]
    const liveOpen = active.filter((k) => k.environment === 'live' && !k.ipAllowlist.length)
    return {
      active: active.length,
      live: active.filter((k) => k.environment === 'live').length,
      test: active.filter((k) => k.environment === 'test').length,
      requests,
      top,
      topShare: top && requests ? (top.requests24h / requests) * 100 : 0,
      restricted: active.filter((k) => k.ipAllowlist.length).length,
      liveOpen: liveOpen.length,
      unused: active.filter((k) => !k.lastUsedAt || Date.now() - new Date(k.lastUsedAt).getTime() > 7 * 86400_000).length,
      soon: soon.length,
      inactive: all.length - active.length,
      trafficNow: active.filter((k) => recency(k) === 'live').length,
    }
  }, [all])

  const selected = drawer ? all.find((k) => k.id === drawer.id) : undefined
  const selectedId = drawer?.open ? drawer.id : null
  const maxReq = Math.max(1, ...all.map((k) => k.requests24h))

  // Fits a 1440px viewport with the expanded sidebar (~1144px content) without scrolling:
  // compact 12px cell padding, rate limit + IP allowlist merged into "Limits", row menu inside Status.
  const tight = { className: 'px-3', headerClassName: 'px-3' }
  const columns: Column<ApiKey>[] = [
    {
      key: 'name',
      header: 'Key',
      sortValue: (k) => k.name,
      ...tight,
      cell: (k) => (
        <div className="min-w-0 max-w-[180px]" title={k.name}>
          <div className="truncate font-medium text-fg">{k.name}</div>
          <KeyId apiKey={k} className="mt-0.5 text-[11px]" />
        </div>
      ),
    },
    {
      key: 'owner',
      header: 'Owner',
      sortValue: (k) => (k.resellerId ? (resellerById.get(k.resellerId)?.name ?? k.resellerId) : '0'),
      ...tight,
      cell: (k) => {
        const r = k.resellerId ? resellerById.get(k.resellerId) : null
        const g = r ? groupById.get(r.pricingGroupId) : undefined
        return r ? (
          <span className="inline-flex max-w-[150px] min-w-0 items-center gap-2" title={r.name}>
            <ResellerAvatar reseller={r} size="xs" />
            <span className="min-w-0">
              <span className="block truncate text-[13px] text-fg">{r.name}</span>
              <span className="block truncate text-[11px] text-fg-3">
                {g?.name ?? 'Reseller'}
                {r.status !== 'active' && <span className="text-warning"> · {r.status}</span>}
              </span>
            </span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <span className="grid size-5 shrink-0 place-items-center rounded-full border border-line bg-surface-2">
              <Building className="size-3 text-fg-3" />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] text-fg">Internal</span>
              <span className="block text-[11px] text-fg-3">UnlockDesk Ops</span>
            </span>
          </span>
        )
      },
    },
    { key: 'env', header: 'Env', sortValue: (k) => k.environment, ...tight, cell: (k) => <EnvBadge env={k.environment} /> },
    { key: 'scopes', header: 'Access', hideBelow: 'md', sortValue: (k) => k.scopes.length, ...tight, cell: (k) => <ScopeChips scopes={k.scopes} /> },
    {
      key: 'used',
      header: 'Last request',
      hideBelow: 'sm',
      sortValue: (k) => (k.lastUsedAt ? new Date(k.lastUsedAt).getTime() : 0),
      ...tight,
      cell: (k) => {
        const r = recency(k)
        return (
          <Tooltip content={k.lastUsedAt ? dateTime(k.lastUsedAt) : 'This key has never been used'}>
            <span className={cn('inline-flex items-center gap-2 text-[12.5px] whitespace-nowrap', r === 'live' ? 'text-fg' : r === 'recent' ? 'text-fg-2' : 'text-fg-3')}>
              <span className="relative inline-flex size-1.5 shrink-0">
                {r === 'live' && k.status === 'active' && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-accent" />}
                <span className={cn('relative size-full rounded-full', r === 'live' ? 'bg-accent' : r === 'recent' ? 'bg-fg-2/70' : 'border border-fg-3')} />
              </span>
              {sinceShort(k.lastUsedAt)}
            </span>
          </Tooltip>
        )
      },
    },
    {
      key: 'req',
      header: 'Requests 24h',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (k) => k.requests24h,
      ...tight,
      cell: (k) => (
        <span className="inline-flex items-center justify-end gap-2">
          <span className="hidden h-[5px] w-9 overflow-hidden rounded-[2px] bg-fg/[0.06] xl:block">
            <span className={cn('block h-full rounded-[2px] transition-colors', selectedId === k.id ? 'bg-accent' : 'bg-fg-2/50')} style={{ width: `${Math.max(k.requests24h ? 3 : 0, (k.requests24h / maxReq) * 100)}%` }} />
          </span>
          <span className={cn('min-w-[44px] font-mono text-[12px] tabular', k.requests24h ? 'text-fg' : 'text-fg-3')}>{num(k.requests24h)}</span>
        </span>
      ),
    },
    {
      key: 'limits',
      header: 'Limits',
      hideBelow: 'lg',
      sortValue: (k) => k.rateLimit,
      ...tight,
      cell: (k) => {
        const openLive = k.environment === 'live' && k.status === 'active' && !k.ipAllowlist.length
        return (
          <div className="flex flex-col gap-0.5 leading-tight whitespace-nowrap">
            <span className="font-mono text-[12px] text-fg-2 tabular">
              {num(k.rateLimit)}
              <span className="text-fg-3">/min</span>
            </span>
            {k.ipAllowlist.length ? (
              <Tooltip content={<span className="font-mono text-[11.5px] whitespace-pre">{`IP allowlist\n${k.ipAllowlist.join('\n')}`}</span>}>
                <span className="inline-flex items-center gap-1 text-[11.5px] text-fg-2">
                  <ShieldCheck className="size-3 text-success" />
                  {k.ipAllowlist.length} {k.ipAllowlist.length === 1 ? 'IP' : 'IPs'}
                </span>
              </Tooltip>
            ) : (
              <Tooltip content={openLive ? 'Live key accepts requests from any IP. Add the reseller’s server IPs.' : 'No IP allowlist — requests accepted from any IP'}>
                <span className="inline-flex items-center gap-1 text-[11.5px] text-fg-3">
                  <Globe className="size-3" />
                  Any IP
                  {openLive && <span className="size-1.5 rounded-full bg-warning" />}
                </span>
              </Tooltip>
            )}
          </div>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (k) => k.status,
      ...tight,
      cell: (k) => (
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={k.status} />
          <div onClick={(e) => e.stopPropagation()} className="-my-1 -mr-1.5">
            <Popover
              placement="bottom-end"
              trigger={({ toggle, open }) => (
                <Button size="sm" variant="ghost" icon onClick={toggle} aria-label="Key actions" className={cn(open && 'bg-surface-2 text-fg')}>
                  <Ellipsis />
                </Button>
              )}
            >
              {(close) => (
                <>
                  <MenuItem icon={<Eye />} onClick={() => (close(), setDrawer({ id: k.id, open: true }))}>
                    View details
                  </MenuItem>
                  <MenuItem
                    icon={<Copy />}
                    onClick={() => {
                      close()
                      navigator.clipboard?.writeText(k.prefix).catch(() => undefined)
                      toast.success('Key prefix copied', k.prefix)
                    }}
                  >
                    Copy prefix
                  </MenuItem>
                  <MenuItem icon={<ScrollText />} onClick={() => (close(), navigate(`/admin/developer/logs?search=${encodeURIComponent(k.prefix)}`))}>
                    View requests
                  </MenuItem>
                  {k.status === 'active' && (
                    <>
                      <MenuSeparator />
                      <MenuItem danger icon={<Trash2 />} onClick={() => (close(), setRevoking(k))}>
                        Revoke key
                      </MenuItem>
                    </>
                  )}
                </>
              )}
            </Popover>
          </div>
        </div>
      ),
    },
  ]

  const filtered = search || status !== 'all' || env !== 'all' || scope !== 'any'
  const liveShare = summary.active ? (summary.live / summary.active) * 100 : 0
  const restrictedShare = summary.active ? (summary.restricted / summary.active) * 100 : 0

  return (
    <div>
      <PageHeader
        icon={<KeyRound />}
        title="API keys"
        description="Bearer credentials that resellers’ shops, unlock panels and POS systems use to place IMEI checks, unlocks and code orders through the Reseller API. Each key is scoped, rate-limited and revocable on its own."
        actions={
          <>
            <Button variant="ghost" to="/admin/developer/api#authentication" leading={<BookOpen />}>
              Authentication docs
            </Button>
            <Button variant="accent" leading={<Plus />} onClick={() => setCreate(true)}>
              Create API key
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryTile
          loading={keys.isLoading}
          label="Active keys"
          value={num(summary.active)}
          sub={
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-accent" />
                {summary.live} live
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-1.5 rounded-full border border-fg-3" />
                {summary.test} test
              </span>
            </span>
          }
          visual={
            <span className="flex h-[5px] w-full overflow-hidden rounded-[2px] bg-hatch bg-surface-2 ring-1 ring-line ring-inset">
              <motion.span className="block h-full bg-accent" initial={{ width: 0 }} animate={{ width: `${liveShare}%` }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} />
            </span>
          }
          delay={0}
        />
        <SummaryTile
          loading={keys.isLoading}
          label="Requests · 24h"
          value={num(summary.requests, { compact: true })}
          sub={summary.top ? <span className="truncate">Top · {summary.top.name}</span> : 'Across all keys'}
          visual={
            <span className="flex h-[5px] w-full overflow-hidden rounded-[2px] bg-fg/[0.06]">
              <motion.span className="block h-full bg-fg-2/60" initial={{ width: 0 }} animate={{ width: `${summary.topShare}%` }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} />
            </span>
          }
          aside={summary.top ? <span className="font-mono text-[11px] text-fg-3 tabular">{pct(summary.topShare, 0)}</span> : undefined}
          delay={1}
        />
        <SummaryTile
          loading={keys.isLoading}
          label="IP restricted"
          value={
            <>
              {summary.restricted}
              <span className="text-fg-3">/{summary.active}</span>
            </>
          }
          sub={summary.liveOpen ? <span>{summary.liveOpen} live keys accept any IP</span> : 'All live keys restricted'}
          visual={
            <span className="flex h-[5px] w-full overflow-hidden rounded-[2px] bg-fg/[0.06]">
              <motion.span className="block h-full bg-success/80" initial={{ width: 0 }} animate={{ width: `${restrictedShare}%` }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} />
            </span>
          }
          delay={2}
        />
        <SummaryTile
          loading={keys.isLoading}
          label="Needs attention"
          value={num(summary.unused + summary.soon)}
          sub={summary.unused + summary.soon ? `${summary.unused} idle 7d+ · ${summary.soon} expiring soon` : 'Nothing stale'}
          tone={summary.unused + summary.soon ? 'warning' : undefined}
          aside={
            summary.trafficNow > 0 ? (
              <Tooltip content="Keys with a request in the last 5 minutes">
                <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-fg-3">
                  <span className="relative inline-flex size-1.5">
                    <span className="absolute inset-0 animate-pulse-ring rounded-full bg-accent" />
                    <span className="relative size-full rounded-full bg-accent" />
                  </span>
                  {summary.trafficNow} live now
                </span>
              </Tooltip>
            ) : undefined
          }
          delay={3}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:px-5 xl:flex-row xl:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Search key, prefix, reseller or access…" className="xl:w-[300px]" />
          <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1">
            <Segmented<StatusFilter>
              value={status}
              onChange={setStatus}
              items={[
                { value: 'all', label: 'All', count: keys.data ? all.length : undefined },
                { value: 'active', label: 'Active', count: keys.data ? summary.active : undefined },
                { value: 'revoked', label: 'Revoked' },
                { value: 'expired', label: 'Expired' },
              ]}
            />
            <Segmented<EnvFilter>
              value={env}
              onChange={setEnv}
              items={[
                { value: 'all', label: 'Any env' },
                { value: 'live', label: 'Live', icon: <span className="size-1.5 rounded-full bg-accent" /> },
                { value: 'test', label: 'Test', icon: <span className="size-1.5 rounded-full border border-fg-3" /> },
              ]}
            />
          </div>
          <Select
            inputSize="sm"
            value={scope}
            onChange={(e) => setScope(e.target.value as ScopeFilter)}
            className="sm:w-[200px] xl:ml-auto"
            aria-label="Filter by access"
            options={[
              { value: 'any', label: 'Any access' },
              { value: 'orders', label: 'Can place orders' },
              { value: 'readonly', label: 'Read-only keys' },
              { value: 'webhooks', label: 'Manages webhooks' },
            ]}
          />
        </div>
        {keys.isError ? (
          <LoadError what="API keys" onRetry={() => keys.refetch()} />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            loading={keys.isLoading}
            rowKey={(k) => k.id}
            onRowClick={(k) => setDrawer({ id: k.id, open: true })}
            selectedKey={selectedId}
            minWidth={900}
            defaultSort={{ key: 'req', dir: 'desc' }}
            rowClassName={(k) => (k.status !== 'active' ? 'opacity-60 hover:opacity-100' : undefined)}
            empty={
              <EmptyState
                icon={<KeyRound />}
                title={filtered ? 'No keys match these filters' : 'No API keys yet'}
                description={filtered ? 'Try another search term or clear the filters.' : 'Create one key per reseller integration — shop website, unlock panel, POS — so each can be rotated and revoked independently.'}
                action={
                  filtered ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSearch('')
                        setStatus('all')
                        setEnv('all')
                        setScope('any')
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : (
                    <Button size="sm" variant="accent" leading={<Plus />} onClick={() => setCreate(true)}>
                      Create API key
                    </Button>
                  )
                }
              />
            }
          />
        )}
        {rows && rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-[12px] text-fg-3 sm:px-5">
            <span className="inline-flex items-center gap-2 tabular">
              {rows.length} of {all.length} keys · {summary.inactive} revoked or expired
              <DemoTag />
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Badge tone="neutral" variant="outline" className="font-mono text-[10.5px]">
                Argon2id
              </Badge>
              Secrets are shown once and never stored in plain text
            </span>
          </div>
        )}
      </Card>

      <CreateApiKeyModal open={createOpen} onClose={() => setCreate(false)} />
      <KeyDrawer
        apiKey={selected}
        open={!!drawer?.open}
        owner={selected?.resellerId ? resellerById.get(selected.resellerId) : undefined}
        ownerGroup={selected?.resellerId ? groupById.get(resellerById.get(selected.resellerId)?.pricingGroupId ?? '')?.name : undefined}
        onClose={() => setDrawer((d) => (d ? { ...d, open: false } : d))}
        onRevoke={(k) => setRevoking(k)}
      />
      <RevokeKeyDialog apiKey={revoking} ownerName={revoking?.resellerId ? resellerById.get(revoking.resellerId)?.name : undefined} onClose={() => setRevoking(null)} />
    </div>
  )
}

function SummaryTile({
  label,
  value,
  sub,
  loading,
  tone,
  delay,
  visual,
  aside,
}: {
  label: string
  value: ReactNode
  sub: ReactNode
  loading?: boolean
  tone?: 'warning'
  delay: number
  visual?: ReactNode
  aside?: ReactNode
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: delay * 0.04 }} className="flex min-w-0 flex-col rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <div className="mono-label truncate">{label}</div>
        {!loading && aside && <span className="hidden shrink-0 sm:inline-flex">{aside}</span>}
      </div>
      {loading ? <Skeleton className="mt-2.5 h-6 w-20" /> : <div className={cn('mt-2 font-display text-[24px] leading-none font-semibold tracking-[-0.025em] tabular', tone === 'warning' ? 'text-warning' : 'text-fg')}>{value}</div>}
      {visual && <div className="mt-3">{loading ? <Skeleton className="h-[5px] w-full" /> : visual}</div>}
      <div className="mt-2 truncate text-[12px] text-fg-3">{loading ? <Skeleton className="h-3 w-28" /> : sub}</div>
    </motion.div>
  )
}
