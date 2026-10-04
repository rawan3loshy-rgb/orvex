import { useMemo, useState } from 'react'
import { CircleCheck, KeyRound, ShieldAlert } from 'lucide-react'
import { useAccounts, useInstMutation } from '@/hooks/installation'
import { developerService } from '@/services/installation'
import type { ApiKey, ApiScope } from '@/types/installation'
import { Button, Checkbox, CopyButton, Field, Input, Modal, Segmented, Select, Switch, Textarea } from '@/components/ui'
import { PermissionHint } from '@/components/domain'
import { cn } from '@/lib/cn'
import { DhruChip, EnvBadge, ScopeChips } from '../shared'
import { SCOPES } from '../helpers'

const IP_RE = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/

export function CreateKeyModal({ open, onClose, defaultAccountId }: { open: boolean; onClose: () => void; defaultAccountId?: string }) {
  const accounts = useAccounts({ kind: 'customer', pageSize: 200 })
  const eligible = useMemo(() => (accounts.data?.items ?? []).filter((r) => r.account.channels.api || r.account.channels.dhru), [accounts.data])

  const [accountId, setAccountId] = useState(defaultAccountId ?? '')
  const [name, setName] = useState('')
  const [environment, setEnvironment] = useState<'live' | 'test'>('live')
  const [scopes, setScopes] = useState<ApiScope[]>(['services:read', 'orders:read', 'orders:write', 'account:read'])
  const [ipText, setIpText] = useState('')
  const [rateLimit, setRateLimit] = useState('600')
  const [dhruCompat, setDhruCompat] = useState(false)
  const [expiry, setExpiry] = useState('never')
  const [created, setCreated] = useState<{ key: ApiKey; secret: string } | null>(null)

  const account = eligible.find((r) => r.account.id === accountId)?.account
  const ips = ipText.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
  const badIps = ips.filter((ip) => !IP_RE.test(ip))
  const rate = Number(rateLimit)
  const valid = !!account && name.trim().length > 0 && scopes.length > 0 && badIps.length === 0 && Number.isFinite(rate) && rate >= 10 && rate <= 10_000

  const create = useInstMutation(developerService.createApiKey, { success: 'API key created', onSuccess: (r) => setCreated(r) })

  const reset = () => {
    setAccountId(defaultAccountId ?? '')
    setName('')
    setEnvironment('live')
    setScopes(['services:read', 'orders:read', 'orders:write', 'account:read'])
    setIpText('')
    setRateLimit('600')
    setDhruCompat(false)
    setExpiry('never')
    setCreated(null)
  }
  const close = () => {
    onClose()
    setTimeout(reset, 250)
  }

  const submit = () => {
    if (!valid || !account) return
    create.mutate({ accountId: account.id, name: name.trim(), environment, scopes, ipAllowlist: ips, rateLimitPerMin: rate, dhruCompat, expiresInDays: expiry === 'never' ? null : Number(expiry) })
  }

  if (created) {
    return (
      <Modal
        open={open}
        onClose={close}
        size="md"
        icon={<CircleCheck className="text-success" />}
        title="Copy your new key now"
        description={`${created.key.name} · ${account?.name ?? ''}`}
        footer={
          <Button variant="primary" onClick={close}>
            I’ve stored it safely
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-accent/30 bg-accent/[0.05] p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="mono-label">Secret key</span>
              <EnvBadge env={created.key.environment} />
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2.5">
              <code className="min-w-0 flex-1 font-mono text-[13px] break-all text-fg select-all">{created.secret}</code>
              <CopyButton value={created.secret} label="Copy secret" className="size-7" />
            </div>
          </div>
          <div className="flex gap-2.5 rounded-xl border border-warning/25 bg-warning/[0.05] p-3 text-[12.5px] text-fg-2">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            <p>
              <strong className="text-fg">This is the only time the secret is shown.</strong> Only a sha256 hash is stored — it cannot be shown again. If it is lost, revoke the key and create a new one.
            </p>
          </div>
          <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[12.5px]">
            <dt className="text-fg-3">Prefix</dt>
            <dd className="font-mono text-fg">{created.key.prefix}</dd>
            <dt className="text-fg-3">Stored hash</dt>
            <dd className="truncate font-mono text-fg-2">{created.key.hash}</dd>
            <dt className="text-fg-3">Scopes</dt>
            <dd>
              <ScopeChips scopes={created.key.scopes} />
            </dd>
            {created.key.dhruCompat && (
              <>
                <dt className="text-fg-3">DHRU</dt>
                <dd className="text-fg-2">
                  username <code className="font-mono text-fg">{account?.email}</code> + this key as <code className="font-mono">apiaccesskey</code>
                </dd>
              </>
            )}
          </dl>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      icon={<KeyRound />}
      title="Create API key"
      description="Keys belong to an account. The account’s pricing tier, service access, limits and wallet apply to every request."
      footer={
        <>
          <PermissionHint permission="developer.manage" className="mr-auto" />
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="accent" onClick={submit} disabled={!valid} loading={create.isPending}>
            Create key
          </Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Account" className="sm:col-span-2" hint={accounts.isLoading ? 'Loading accounts…' : `${eligible.length} accounts have the API or DHRU channel enabled`}>
          <Select
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value)
              const a = eligible.find((r) => r.account.id === e.target.value)?.account
              if (a && !a.channels.dhru) setDhruCompat(false)
            }}
            options={[{ value: '', label: 'Select an account…' }, ...eligible.map((r) => ({ value: r.account.id, label: `${r.account.name} — ${r.tierName} · ${[r.account.channels.api && 'API', r.account.channels.dhru && 'DHRU'].filter(Boolean).join(' + ')}` }))]}
          />
        </Field>
        <Field label="Name" hint="Where it is used, e.g. “POS integration”.">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="POS integration" maxLength={60} />
        </Field>
        <Field label="Environment">
          <Segmented<'live' | 'test'>
            value={environment}
            onChange={setEnvironment}
            items={[
              { value: 'live', label: 'Live · orx_live_' },
              { value: 'test', label: 'Test · orx_test_' },
            ]}
          />
        </Field>

        <div className="sm:col-span-2">
          <div className="mb-2 text-[12.5px] font-medium text-fg">Scopes</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {SCOPES.map((s) => (
              <label key={s.id} className={cn('flex cursor-pointer gap-2.5 rounded-xl border p-3 transition-colors', scopes.includes(s.id) ? 'border-accent/35 bg-accent/[0.04]' : 'border-line hover:border-line-strong')}>
                <Checkbox checked={scopes.includes(s.id)} onChange={(v) => setScopes((cur) => (v ? [...cur, s.id] : cur.filter((x) => x !== s.id)))} />
                <span className="min-w-0">
                  <code className="font-mono text-[12px] text-fg">{s.id}</code>
                  <span className="mt-0.5 block text-[12px] leading-snug text-fg-3">{s.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <Field label="IP allow-list" optional error={badIps.length ? `Invalid IP or CIDR: ${badIps.join(', ')}` : undefined} hint="IPs or CIDR ranges, comma or newline separated. Empty = any IP." className="sm:col-span-2">
          <Textarea mono rows={2} value={ipText} onChange={(e) => setIpText(e.target.value)} placeholder="203.0.113.0/24, 198.51.100.10" invalid={badIps.length > 0} className="min-h-[64px]" />
        </Field>

        <Field label="Rate limit" hint="Requests per minute for this key (10–10,000).">
          <Input type="number" min={10} max={10000} value={rateLimit} onChange={(e) => setRateLimit(e.target.value)} trailing={<span className="text-[11.5px]">/min</span>} />
        </Field>
        <Field label="Expiry">
          <Select
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            options={[
              { value: 'never', label: 'Never expires' },
              { value: '30', label: '30 days' },
              { value: '90', label: '90 days' },
              { value: '365', label: '1 year' },
            ]}
          />
        </Field>

        <div className={cn('flex items-start justify-between gap-4 rounded-xl border border-line p-3.5 sm:col-span-2', account && !account.channels.dhru && 'opacity-60')}>
          <div>
            <div className="flex items-center gap-2 text-[13px] font-medium text-fg">
              DHRU compatibility <DhruChip />
            </div>
            <p className="mt-0.5 text-[12px] text-fg-3">
              {account && !account.channels.dhru
                ? `The DHRU channel is not enabled for ${account.name}.`
                : <>Also authenticate the DHRU-compatible endpoint with <code className="font-mono">username</code> = account email and this key as <code className="font-mono">apiaccesskey</code>.</>}
            </p>
          </div>
          <Switch checked={dhruCompat} onChange={setDhruCompat} disabled={!!account && !account.channels.dhru} label="DHRU compatibility" />
        </div>
      </div>
    </Modal>
  )
}
