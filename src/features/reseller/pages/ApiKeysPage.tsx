import { useState } from 'react'
import { ArrowRight, CodeXml, KeyRound, Plus, PlugZap, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Badge, Button, Card, CardHeader, Checkbox, CodeBlock, ConfirmDialog, CopyButton, EmptyState, Field, Input, Modal, SecretField, Segmented, Skeleton, StatusBadge, Switch, Textarea } from '@/components/ui'
import { useInstMutation, usePortalApiKeys } from '@/hooks/installation'
import { portalService } from '@/services/installation'
import type { ApiKey, ApiScope } from '@/types/installation'
import { dateTime, relative } from '@/lib/format'
import { cn } from '@/lib/cn'
import { ApiSectionHeader, ErrorCard, NoAccess } from '../kit'
import { NATIVE_API_BASE, usePortalSession } from '../kitUtils'

const SCOPES: { id: ApiScope; label: string; desc: string }[] = [
  { id: 'services:read', label: 'services:read', desc: 'List services and your prices' },
  { id: 'orders:read', label: 'orders:read', desc: 'Read orders and results' },
  { id: 'orders:write', label: 'orders:write', desc: 'Place and cancel orders' },
  { id: 'account:read', label: 'account:read', desc: 'Balance and transactions' },
  { id: 'webhooks:manage', label: 'webhooks:manage', desc: 'Manage webhook endpoints' },
]

export default function ApiKeysPage() {
  const { me, can, role } = usePortalSession()
  const keys = usePortalApiKeys()
  const [create, setCreate] = useState(false)
  const [revoke, setRevoke] = useState<ApiKey | null>(null)
  const revokeKey = useInstMutation((id: string) => portalService.revokeApiKey(id), { success: 'Key revoked — requests with it now fail with 401', onSuccess: () => setRevoke(null) })

  const header = (
    <ApiSectionHeader
      title="API keys"
      description="Connect your shop, POS or panel to UnlockDesk. Keys authenticate the native API v1 and — when enabled — the DHRU-compatible endpoint."
      actions={
        can.api && (
          <Button variant="accent" leading={<Plus />} onClick={() => setCreate(true)}>
            Create key
          </Button>
        )
      }
    />
  )
  if (me && !can.api)
    return (
      <div>
        {header}
        <NoAccess need="api" role={role} />
      </div>
    )

  const list = keys.data ?? []
  const active = list.filter((k) => k.status === 'active')
  const revoked = list.filter((k) => k.status !== 'active')

  return (
    <div>
      {header}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-3">
          {keys.error ? (
            <ErrorCard error={keys.error} onRetry={() => keys.refetch()} />
          ) : keys.isLoading ? (
            [0, 1].map((i) => <Skeleton key={i} className="h-[150px] rounded-xl" />)
          ) : !list.length ? (
            <Card>
              <EmptyState icon={<KeyRound />} title="No API keys yet" description="Create a key to place orders from your own systems." action={<Button size="sm" variant="accent" onClick={() => setCreate(true)}>Create key</Button>} />
            </Card>
          ) : (
            <>
              {active.map((k) => (
                <KeyCard key={k.id} k={k} onRevoke={() => setRevoke(k)} />
              ))}
              {revoked.length > 0 && (
                <details className="group">
                  <summary className="cursor-pointer list-none py-2 text-[12.5px] font-medium text-fg-3 hover:text-fg">Revoked keys ({revoked.length}) ▸</summary>
                  <div className="space-y-3">
                    {revoked.map((k) => (
                      <KeyCard key={k.id} k={k} />
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </div>
        <div className="min-w-0 space-y-4">
          <NativeApiCard />
          <Card>
            <CardHeader icon={<PlugZap />} title="Coming from a DHRU panel?" description="Keep your existing integration: use your account email as username and a DHRU-compatible key." />
            <div className="px-5 pb-5">
              <Button to="/portal/api/dhru" size="sm" trailing={<ArrowRight />}>
                DHRU connection
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <CreateKeyModal open={create} onClose={() => setCreate(false)} />
      <ConfirmDialog
        open={!!revoke}
        onClose={() => setRevoke(null)}
        onConfirm={() => revoke && revokeKey.mutate(revoke.id)}
        loading={revokeKey.isPending}
        tone="danger"
        title={`Revoke “${revoke?.name}”?`}
        description="Every system using this key stops working immediately. This can’t be undone — create a new key to reconnect."
        confirmLabel="Revoke key"
      />
    </div>
  )
}

function KeyCard({ k, onRevoke }: { k: ApiKey; onRevoke?: () => void }) {
  const off = k.status !== 'active'
  return (
    <Card className={cn(off && 'opacity-70')}>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:p-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-fg-2">
          <KeyRound className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-semibold">{k.name}</span>
            <StatusBadge status={k.status} />
            <Badge tone={k.environment === 'live' ? 'accent' : 'neutral'} variant="outline">
              {k.environment}
            </Badge>
            {k.dhruCompat && (
              <Badge tone="info" icon={<PlugZap />}>
                DHRU-compatible
              </Badge>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px] text-fg-2">
            <span className="inline-flex items-center gap-1">
              {k.prefix}_••••{k.last4}
              <CopyButton value={k.prefix} label="Copy prefix" />
            </span>
            <span className="text-fg-3" title="Only a hash of the secret is stored">
              {k.hash}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {k.scopes.map((s) => (
              <span key={s} className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] text-fg-2 ring-1 ring-line">
                {s}
              </span>
            ))}
          </div>
          <div className="mt-2.5 grid gap-x-6 gap-y-1 text-[12px] text-fg-3 sm:grid-cols-2">
            <span>
              IP allowlist: <span className="font-mono text-fg-2">{k.ipAllowlist.length ? k.ipAllowlist.join(', ') : 'any IP'}</span>
            </span>
            <span>Last used: <span className="text-fg-2">{k.lastUsedAt ? relative(k.lastUsedAt) : 'never'}</span></span>
            <span>Created {dateTime(k.createdAt)} by {k.createdBy}</span>
            <span>{k.rateLimitPerMin} requests / min{k.expiresAt ? ` · expires ${dateTime(k.expiresAt)}` : ''}</span>
          </div>
        </div>
        {onRevoke && !off && (
          <Button size="sm" variant="ghost" className="self-start text-danger hover:bg-danger/10 hover:text-danger" onClick={onRevoke}>
            Revoke
          </Button>
        )}
      </div>
    </Card>
  )
}

function NativeApiCard() {
  const curl = `curl ${NATIVE_API_BASE}/orders \\
  -H "Authorization: Bearer orx_live_…" \\
  -H "Idempotency-Key: pos-10234" \\
  -H "Content-Type: application/json" \\
  -d '{
    "service": "4001",
    "input": { "imei": "356938035643809" },
    "client_reference": "POS-10234"
  }'`
  return (
    <Card>
      <CardHeader icon={<CodeXml />} title="Native API v1" description="JSON over HTTPS. Idempotency keys are scoped to your account." />
      <div className="space-y-3 px-5 pb-5">
        <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2/60 px-3 py-2">
          <code className="truncate font-mono text-[12px]">{NATIVE_API_BASE}</code>
          <CopyButton value={NATIVE_API_BASE} />
        </div>
        <CodeBlock code={curl} lang="bash" title="Place an order" wrap />
        <ul className="space-y-1 text-[12px] text-fg-3">
          <li>
            <code className="font-mono text-fg-2">GET /v1/services</code> · your services and prices
          </li>
          <li>
            <code className="font-mono text-fg-2">GET /v1/orders/:id</code> · status, result, refunds
          </li>
          <li>
            <code className="font-mono text-fg-2">GET /v1/account</code> · balance (available / held)
          </li>
        </ul>
      </div>
    </Card>
  )
}

function CreateKeyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('')
  const [env, setEnv] = useState<'live' | 'test'>('live')
  const [scopes, setScopes] = useState<ApiScope[]>(['services:read', 'orders:read', 'orders:write', 'account:read'])
  const [ips, setIps] = useState('')
  const [dhru, setDhru] = useState(false)
  const [created, setCreated] = useState<{ key: ApiKey; secret: string } | null>(null)
  const createKey = useInstMutation(portalService.createApiKey, { success: 'API key created', onSuccess: (r) => setCreated(r) })

  const close = () => {
    onClose()
    setTimeout(() => {
      setCreated(null)
      setName('')
      setIps('')
      setDhru(false)
      setEnv('live')
    }, 250)
  }
  const ipList = ips.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean)

  return (
    <Modal
      open={open}
      onClose={close}
      icon={created ? <ShieldCheck /> : <KeyRound />}
      title={created ? 'Copy your secret key now' : 'Create API key'}
      description={created ? 'This is the only time the full key is shown.' : 'Give each integration its own key so you can revoke it independently.'}
      footer={
        created ? (
          <Button variant="primary" onClick={close}>
            I’ve stored it safely
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="accent" loading={createKey.isPending} disabled={!name.trim() || !scopes.length} onClick={() => createKey.mutate({ name: name.trim(), environment: env, scopes, ipAllowlist: ipList, dhruCompat: dhru })}>
              Create key
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div className="space-y-4">
          <SecretField masked={`${created.key.prefix}_${'•'.repeat(24)}`} value={created.secret} revealable label="API key" />
          <CodeBlock code={`Authorization: Bearer ${created.secret}`} lang="http" wrap />
          <div className="flex gap-2 rounded-lg border border-warning/35 bg-warning/[0.07] px-3 py-2.5 text-[12.5px] text-fg-2">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>
              We only store a hash of this key (<span className="font-mono text-[11.5px]">{created.key.hash}</span>). If you lose it, revoke it and create a new one.
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Name" htmlFor="k_name">
            <Input id="k_name" autoFocus value={name} placeholder="e.g. POS counter 1" onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Environment">
            <Segmented
              items={[
                { value: 'live', label: 'Live' },
                { value: 'test', label: 'Test' },
              ]}
              value={env}
              onChange={(v) => setEnv(v as 'live' | 'test')}
            />
          </Field>
          <div>
            <div className="mb-2 text-[12.5px] font-medium">Scopes</div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {SCOPES.map((s) => (
                <Checkbox key={s.id} checked={scopes.includes(s.id)} onChange={(v) => setScopes((x) => (v ? [...x, s.id] : x.filter((y) => y !== s.id)))} label={<span className="font-mono text-[12px]">{s.label}</span>} description={s.desc} />
              ))}
            </div>
          </div>
          <Field label="IP allowlist" optional hint="IPv4 addresses or CIDR ranges, one per line. Leave empty to allow any IP." htmlFor="k_ips">
            <Textarea id="k_ips" mono rows={2} value={ips} placeholder={'203.0.113.10\n198.51.100.0/24'} onChange={(e) => setIps(e.target.value)} />
          </Field>
          <div className="flex items-start justify-between gap-4 rounded-lg border border-line px-3.5 py-3">
            <div>
              <div className="text-[13px] font-medium">DHRU-compatible</div>
              <div className="text-[12px] text-fg-3">Also accept this key on the DHRU endpoint (username = your account email).</div>
            </div>
            <Switch checked={dhru} onChange={setDhru} label="DHRU-compatible" />
          </div>
        </div>
      )}
    </Modal>
  )
}
