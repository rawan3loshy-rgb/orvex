import { useState } from 'react'
import { ArrowUpRight, KeyRound, Plus, ShieldCheck, Trash2, Webhook } from 'lucide-react'
import { useApiKeys, useWebhooks } from '@/hooks/installation'
import type { ApiKey, Reseller } from '@/types/installation'
import { Button, Card, CardBody, CardHeader, CodeBlock, CopyButton, DataTable, EmptyState, StatusBadge, Tooltip, type Column } from '@/components/ui'
import { cn } from '@/lib/cn'
import { date, num, pct, relative } from '@/lib/format'
import { RevokeKeyDialog } from '@/features/admin/developer/keys/RevokeKeyDialog'
import { API_BASE, EnvBadge, ScopeChips, keyDisplay } from '@/features/admin/developer/shared'

export function ApiAccessTab({ reseller, onCreateKey }: { reseller: Reseller; onCreateKey: () => void }) {
  const keys = useApiKeys({ resellerId: reseller.id })
  const webhooks = useWebhooks()
  const [revoking, setRevoking] = useState<ApiKey | null>(null)
  const endpoints = webhooks.data?.filter((w) => w.resellerId === reseller.id) ?? []
  const liveKey = keys.data?.find((k) => k.status === 'active' && k.environment === 'live')

  const columns: Column<ApiKey>[] = [
    {
      key: 'name',
      header: 'Key',
      cell: (k) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-fg">{k.name}</span>
            <EnvBadge env={k.environment} />
          </div>
          <span className="group/k mt-0.5 inline-flex items-center gap-1 font-mono text-[11.5px] text-fg-3">
            {keyDisplay(k)}
            <CopyButton value={k.prefix} label="Copy prefix" className="size-5 opacity-0 group-hover/k:opacity-100" />
          </span>
        </div>
      ),
    },
    { key: 'scopes', header: 'Scopes', hideBelow: 'md', cell: (k) => <ScopeChips scopes={k.scopes} /> },
    { key: 'rate', header: 'Rate limit', align: 'right', hideBelow: 'sm', cell: (k) => <span className="tabular">{num(k.rateLimit)}/min</span> },
    {
      key: 'ips',
      header: 'IP allowlist',
      hideBelow: 'lg',
      cell: (k) =>
        k.ipAllowlist.length ? (
          <Tooltip content={<span className="font-mono text-[11.5px]">{k.ipAllowlist.join('\n')}</span>}>
            <span className="inline-flex items-center gap-1.5 text-fg-2">
              <ShieldCheck className="size-3.5 text-success" />
              <span className="font-mono text-[11.5px]">{k.ipAllowlist[0]}</span>
              {k.ipAllowlist.length > 1 && <span className="text-[11.5px] text-fg-3">+{k.ipAllowlist.length - 1}</span>}
            </span>
          </Tooltip>
        ) : (
          <span className="text-[12.5px] text-fg-3">Any IP</span>
        ),
    },
    {
      key: 'used',
      header: 'Last used',
      hideBelow: 'md',
      cell: (k) => (
        <div className="text-[12.5px]">
          <div className="text-fg-2">{k.lastUsedAt ? relative(k.lastUsedAt) : 'Never'}</div>
          <div className="text-[11.5px] text-fg-3 tabular">{num(k.requests24h)} req · 24h</div>
        </div>
      ),
    },
    { key: 'status', header: 'Status', cell: (k) => <StatusBadge status={k.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 'w-[52px]',
      cell: (k) =>
        k.status === 'active' ? (
          <Tooltip content="Revoke key">
            <Button size="sm" variant="ghost" icon onClick={() => setRevoking(k)} aria-label={`Revoke ${k.name}`} className="hover:text-danger">
              <Trash2 />
            </Button>
          </Tooltip>
        ) : (
          <span className="text-[11.5px] text-fg-3">{k.expiresAt ? date(k.expiresAt) : ''}</span>
        ),
    },
  ]

  const bearer = liveKey ? `${liveKey.prefix}••••••••` : 'orx_live_••••••••'
  const ref = `${reseller.name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'RSL'}-10442`
  const samples = [
    {
      label: 'Balance',
      lang: 'bash' as const,
      code: `curl ${API_BASE}/balance \\
  -H "Authorization: Bearer ${bearer}"`,
    },
    {
      label: 'IMEI blacklist check',
      lang: 'bash' as const,
      code: `curl -X POST ${API_BASE}/orders \\
  -H "Authorization: Bearer ${bearer}" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: ${ref}" \\
  -d '{
    "service_id": "SVC-1002",
    "client_reference": "${ref}",
    "fields": { "imei": "356938035643809" }
  }'`,
    },
  ]

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <CardHeader
          icon={<KeyRound />}
          title="API keys"
          description={`Keys owned by ${reseller.name}. Secrets are shown once at creation and stored as Argon2id hashes.`}
          actions={
            <>
              <Button size="sm" variant="ghost" to="/admin/developer/keys" trailing={<ArrowUpRight />} className="hidden sm:inline-flex">
                All keys
              </Button>
              <Button size="sm" variant="primary" leading={<Plus />} onClick={onCreateKey} disabled={reseller.status === 'suspended'}>
                Create key
              </Button>
            </>
          }
        />
        <DataTable
          columns={columns}
          rows={keys.data}
          loading={keys.isLoading}
          rowKey={(k) => k.id}
          minWidth={620}
          skeletonRows={3}
          rowClassName={(k) => (k.status !== 'active' ? 'opacity-60' : undefined)}
          empty={
            <EmptyState
              compact
              icon={<KeyRound />}
              title="No API keys yet"
              description={reseller.status === 'suspended' ? 'Activate the reseller before issuing keys.' : `Create a key so ${reseller.name} can place IMEI checks, unlocks and code orders through the Reseller API.`}
              action={
                reseller.status !== 'suspended' && (
                  <Button size="sm" variant="accent" leading={<Plus />} onClick={onCreateKey}>
                    Create API key
                  </Button>
                )
              }
            />
          }
        />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<Webhook />} title="Webhook endpoints" description="Order events are pushed to these URLs." actions={<Button size="sm" variant="ghost" to="/admin/developer/webhooks" trailing={<ArrowUpRight />}>Manage</Button>} />
          <CardBody className="space-y-2 pt-0">
            {endpoints.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[12.5px] text-fg-3">No webhook endpoints. {reseller.name} polls GET /orders/:id for unlock and code results instead.</p>
            ) : (
              endpoints.map((w) => (
                <div key={w.id} className="rounded-lg border border-line px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-mono text-[12px] text-fg">{w.url}</span>
                    <StatusBadge status={w.status} />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-[11.5px] text-fg-3">
                    <span>{w.events.length} events</span>
                    <span className={cn(w.successRate24h < 90 && 'text-danger')}>{pct(w.successRate24h)} delivered · 24h</span>
                    <span>{w.lastDeliveryAt ? `last ${relative(w.lastDeliveryAt)}` : 'no deliveries yet'}</span>
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Connectivity check" description="Share with the shop's developer to verify their key, then place a first IMEI check." actions={<Button size="sm" variant="ghost" to="/admin/developer/api" trailing={<ArrowUpRight />}>API reference</Button>} />
          <CardBody className="pt-0">
            <CodeBlock tabs={samples} />
          </CardBody>
        </Card>
      </div>

      <RevokeKeyDialog apiKey={revoking} ownerName={reseller.name} onClose={() => setRevoking(null)} />
    </div>
  )
}
