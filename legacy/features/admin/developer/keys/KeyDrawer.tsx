import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ArrowUpRight, Building, Check, Globe, KeyRound, Minus, ScrollText, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react'
import { useApiLogs } from '@/hooks/installation'
import type { ApiKey, Reseller } from '@/types/installation'
import { Badge, Button, CopyButton, Drawer, EmptyState, Segmented, Skeleton, StatusBadge } from '@/components/ui'
import { cn } from '@/lib/cn'
import { date, dateTime, num, relative, time } from '@/lib/format'
import { ResellerAvatar } from '@/features/admin/commerce/resellers/shared'
import { EnvBadge, LatencyBar, MethodBadge, SCOPES, StatusCode, endpointLabel, keyDisplay, scopeParts, sinceShort } from '../shared'

export function KeyDrawer({
  apiKey: k,
  open,
  owner,
  ownerGroup,
  onClose,
  onRevoke,
}: {
  apiKey: ApiKey | null | undefined
  open: boolean
  owner?: Reseller
  /** Pricing group name of the owner, shown next to the reseller. */
  ownerGroup?: string
  onClose: () => void
  onRevoke: (k: ApiKey) => void
}) {
  return (
    <Drawer
      open={open && !!k}
      onClose={onClose}
      width="lg"
      icon={<KeyRound />}
      title={k?.name}
      description={k ? <span className="font-mono text-[12px]">{keyDisplay(k)}</span> : undefined}
      actions={k && <StatusBadge status={k.status} />}
      footer={
        k && (
          <>
            <Button variant="ghost" to={`/admin/developer/logs?search=${encodeURIComponent(k.prefix)}`} leading={<ScrollText />} className="mr-auto">
              View in logs
            </Button>
            {k.status === 'active' && (
              <Button variant="danger" leading={<Trash2 />} onClick={() => onRevoke(k)}>
                Revoke key
              </Button>
            )}
          </>
        )
      }
    >
      {k && <KeyDetails apiKey={k} owner={owner} ownerGroup={ownerGroup} />}
    </Drawer>
  )
}

function KeyDetails({ apiKey: k, owner, ownerGroup }: { apiKey: ApiKey; owner?: Reseller; ownerGroup?: string }) {
  const navigate = useNavigate()
  const [scope, setScope] = useState<'key' | 'owner'>('key')
  const clientId = k.resellerId ?? 'internal'
  const logs = useApiLogs({ clientId, search: scope === 'key' ? k.prefix : undefined, pageSize: 12 })
  const expired = k.expiresAt && new Date(k.expiresAt).getTime() < Date.now()
  const liveTraffic = !!k.lastUsedAt && Date.now() - new Date(k.lastUsedAt).getTime() < 5 * 60_000 && k.status === 'active'
  const parts = scopeParts(k.scopes)
  const accountLimit = owner?.limits.ratePerMinute
  const openLive = k.environment === 'live' && !k.ipAllowlist.length && k.status === 'active'

  return (
    <div className="space-y-7">
      {/* Key identifier */}
      <section className="overflow-hidden rounded-xl border border-line bg-bg-subtle">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <span className="mono-label">Key identifier</span>
          <EnvBadge env={k.environment} />
        </div>
        <div className="px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-2">
            <code className="min-w-0 truncate font-mono text-[14px] font-medium tracking-wide text-fg sm:text-[15px]">
              {k.prefix}
              <span className="tracking-[0.14em] text-fg-3/70">••••••••••••••••</span>
              {k.last4}
            </code>
            <CopyButton value={k.prefix} label="Copy prefix" />
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-fg-3">The full secret was shown once at creation. ORVEX stores only an Argon2id hash and cannot reveal it — if it is lost, rotate the key.</p>
        </div>
      </section>

      {/* Integration */}
      <section className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 rounded-xl border border-line p-3.5">
          <div className="mono-label mb-2.5">Owner</div>
          {owner ? (
            <button type="button" onClick={() => navigate(`/admin/resellers/${owner.id}?tab=api`)} className="group flex w-full min-w-0 items-center gap-3 text-left">
              <ResellerAvatar reseller={owner} size="md" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 truncate text-[13.5px] font-medium text-fg group-hover:text-accent-ink">
                  {owner.name}
                  <ArrowUpRight className="size-3.5 shrink-0 text-fg-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
                <span className="block truncate text-[12px] text-fg-3">
                  {ownerGroup ? `${ownerGroup} pricing` : 'Reseller'} · {owner.country} · orders charged to its balance
                </span>
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-surface-2">
                <Building className="size-3.5 text-fg-3" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-medium text-fg">Internal · UnlockDesk Ops</span>
                <span className="block text-[12px] text-fg-3">Orders at public prices, no reseller balance</span>
              </span>
            </div>
          )}
        </div>
        <div className="min-w-0 rounded-xl border border-line p-3.5">
          <div className="mono-label mb-2.5">Access</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {parts.map((p) => (
              <span key={p.key} className={cn('inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-[12px] ring-1 ring-inset', p.key === 'orders' && p.mode !== 'read' ? 'bg-accent/[0.07] text-fg ring-accent/25' : 'bg-fg/[0.04] text-fg-2 ring-line')}>
                {p.label}
                {p.mode && <span className="font-mono text-[10px] text-fg-3 uppercase">{p.mode === 'read' ? 'read' : 'write'}</span>}
              </span>
            ))}
            {!parts.length && <span className="text-[12px] text-fg-3">No scopes</span>}
          </div>
          <p className="mt-2 text-[12px] text-fg-3">{k.scopes.includes('orders:write') ? 'Can place IMEI checks, unlocks and code orders — each charged to the balance.' : 'Read-only: cannot place or cancel orders.'}</p>
        </div>
      </section>

      {/* Usage */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        <Cell label="Last request">
          <span className="inline-flex items-center gap-1.5" title={k.lastUsedAt ? dateTime(k.lastUsedAt) : undefined}>
            {liveTraffic && (
              <span className="relative inline-flex size-1.5">
                <span className="absolute inset-0 animate-pulse-ring rounded-full bg-accent" />
                <span className="relative size-full rounded-full bg-accent" />
              </span>
            )}
            {sinceShort(k.lastUsedAt)}
          </span>
        </Cell>
        <Cell label="Requests · 24h">
          <span className="font-mono tabular">{num(k.requests24h)}</span>
        </Cell>
        <Cell label="Rate limit" sub={accountLimit ? `Account cap ${num(accountLimit)}/min` : 'Per key'}>
          <span className="font-mono tabular">
            {num(k.rateLimit)}
            <span className="text-fg-3">/min</span>
          </span>
        </Cell>
        <Cell label="Expires" sub={`Created ${date(k.createdAt)} · ${k.createdBy.split(' ')[0]}`}>
          {k.expiresAt ? <span className={cn(expired && 'text-danger')}>{expired ? `Expired ${relative(k.expiresAt)}` : date(k.expiresAt)}</span> : 'Never'}
        </Cell>
      </section>

      {/* Scopes */}
      <section>
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
          <h4 className="text-[13px] font-semibold">Scopes</h4>
          <span className="font-mono text-[11px] text-fg-3 tabular">
            {k.scopes.length}/{SCOPES.length} granted
          </span>
        </div>
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          {SCOPES.map((s) => {
            const on = k.scopes.includes(s.id)
            return (
              <div key={s.id} className={cn('flex items-start gap-3 px-3.5 py-2.5', !on && 'opacity-55')}>
                <span className={cn('mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-full', on ? 'bg-fg text-bg' : 'border border-dashed border-line-strong text-fg-3')}>{on ? <Check className="size-3" /> : <Minus className="size-3" />}</span>
                <div className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-2">
                    <code className="font-mono text-[12px] text-fg">{s.id}</code>
                    {on && s.id === 'orders:write' && (
                      <Badge tone="accent" className="h-4.5 text-[10.5px]">
                        charges balance
                      </Badge>
                    )}
                  </span>
                  <p className="text-[12px] text-fg-3">{s.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* IP allowlist */}
      <section>
        <h4 className="mb-2.5 text-[13px] font-semibold">IP allowlist</h4>
        {k.ipAllowlist.length ? (
          <div className="flex flex-wrap gap-1.5">
            {k.ipAllowlist.map((ip) => (
              <span key={ip} className="inline-flex h-6 items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2 font-mono text-[11.5px] text-fg-2">
                <ShieldCheck className="size-3 text-success" />
                {ip}
              </span>
            ))}
          </div>
        ) : openLive ? (
          <p className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/[0.05] px-3 py-2.5 text-[12.5px] text-fg-2">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
            <span>
              <span className="font-medium text-fg">Any IP address.</span> This live key can place charged orders from anywhere — restrict it to the reseller’s shop or panel server IPs.
            </span>
          </p>
        ) : (
          <p className="flex items-center gap-2 text-[12.5px] text-fg-3">
            <Globe className="size-3.5" /> Any IP address.
          </p>
        )}
      </section>

      {/* Recent requests */}
      <section>
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-[13px] font-semibold">Recent requests</h4>
          <Segmented<'key' | 'owner'>
            value={scope}
            onChange={setScope}
            size="xs"
            items={[
              { value: 'key', label: 'This key' },
              { value: 'owner', label: owner ? `All ${owner.name.split(' ')[0]} keys` : 'All internal' },
            ]}
          />
        </div>
        <div className="overflow-hidden rounded-xl border border-line">
          {logs.isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-6" />
              ))}
            </div>
          ) : !logs.data?.items.length ? (
            <EmptyState
              compact
              icon={<ScrollText />}
              title={scope === 'key' && k.requests24h > 0 ? 'No detailed entries for this key' : 'No requests in the last 24 hours'}
              description={
                scope === 'key'
                  ? k.requests24h > 0
                    ? `${num(k.requests24h)} requests in 24h — detailed logs keep a recent window of calls only.`
                    : 'This key has not been used recently.'
                  : 'No traffic from this owner.'
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {logs.data.items.map((l) => (
                <li key={l.id}>
                  <button type="button" onClick={() => navigate(`/admin/developer/logs?search=${l.requestId}`)} className="group flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-2/70">
                    <span className="w-[58px] shrink-0 font-mono text-[11px] text-fg-3 tabular">{time(l.at, true)}</span>
                    <MethodBadge method={l.method} size="xs" />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-mono text-[12px] text-fg-2">{l.path.replace('/api/v1', '')}</span>
                      <span className="ml-2 hidden text-[11.5px] text-fg-3 md:inline">{endpointLabel(l.endpoint)}</span>
                    </span>
                    <StatusCode status={l.status} />
                    <LatencyBar value={l.latencyMs} className="hidden sm:inline-flex" />
                    <ArrowUpRight className="size-3.5 text-fg-3 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {logs.data && logs.data.items.length > 0 && (
          <p className="mt-2 text-[12px] text-fg-3">
            Latest {logs.data.items.length} of {num(logs.data.total)} detailed entries
            {scope === 'key' ? ` · ${num(k.requests24h)} requests in 24h in total` : ''}.
          </p>
        )}
      </section>
    </div>
  )
}

function Cell({ label, children, sub }: { label: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 bg-surface px-3.5 py-3">
      <div className="mono-label">{label}</div>
      <div className="mt-1.5 truncate text-[13.5px] text-fg">{children}</div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-fg-3">{sub}</div>}
    </div>
  )
}
