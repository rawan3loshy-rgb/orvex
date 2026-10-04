import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, CircleCheck, Copy, Globe, KeyRound, Lock, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useInstMutation, useResellers } from '@/hooks/installation'
import { developerService } from '@/services/installation'
import type { ApiScope, CreatedApiKey } from '@/types/installation'
import { Badge, Button, Checkbox, CodeBlock, Field, Input, Modal, Segmented, Select, Textarea } from '@/components/ui'
import { cn } from '@/lib/cn'
import { date, num } from '@/lib/format'
import { toast } from '@/stores/toast'
import { API_BASE, EnvBadge, KeyId, SCOPES, ScopeChips, isValidIpRule, scopeSummary } from '../shared'

type Expiry = 'never' | '30' | '90' | '365'

const READ_ONLY: ApiScope[] = ['services:read', 'orders:read', 'balance:read']
const FULL: ApiScope[] = SCOPES.map((s) => s.id)
/** Typical shop / unlock-panel integration: browse services, place and track orders, show balance. */
const STANDARD: ApiScope[] = ['services:read', 'orders:read', 'orders:write', 'balance:read']

const ENVIRONMENTS = [
  { v: 'live', desc: 'Real IMEI checks, unlocks and codes — routed to suppliers and charged to the owner balance.' },
  { v: 'test', desc: 'Sandbox: simulated results (test IMEIs, dummy NCK codes). Nothing is charged or sent to suppliers.' },
] as const

export interface CreateApiKeyModalProps {
  open: boolean
  onClose: () => void
  /** Pre-selected owner: a reseller id, or null for an internal key. */
  defaultOwnerId?: string | null
  /** Hide the owner picker (e.g. when opened from a reseller page). */
  lockOwner?: boolean
}

export function CreateApiKeyModal({ open, onClose, defaultOwnerId = null, lockOwner }: CreateApiKeyModalProps) {
  const resellers = useResellers()
  const [name, setName] = useState('')
  const [owner, setOwner] = useState<string>(defaultOwnerId ?? '')
  const [env, setEnv] = useState<'live' | 'test'>('live')
  const [scopes, setScopes] = useState<ApiScope[]>(STANDARD)
  const [rate, setRate] = useState('300')
  const [ips, setIps] = useState('')
  const [expiry, setExpiry] = useState<Expiry>('never')
  const [submitted, setSubmitted] = useState(false)
  const [created, setCreated] = useState<CreatedApiKey | null>(null)
  const [copied, setCopied] = useState(false)

  const ownerReseller = resellers.data?.find((r) => r.id === owner)

  useEffect(() => {
    if (!open) return
    setName('')
    setOwner(defaultOwnerId ?? '')
    setEnv('live')
    setScopes(STANDARD)
    setIps('')
    setExpiry('never')
    setSubmitted(false)
    setCreated(null)
    setCopied(false)
  }, [open, defaultOwnerId])

  // Default the rate limit to the owner's contractual limit.
  useEffect(() => {
    if (!open) return
    setRate(String(ownerReseller?.limits.ratePerMinute ?? 300))
  }, [open, ownerReseller?.limits.ratePerMinute])

  const ipList = useMemo(
    () =>
      ips
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    [ips],
  )
  const invalidIps = ipList.filter((ip) => !isValidIpRule(ip))
  const rateN = Number(rate)
  const errors = {
    name: !name.trim() ? 'Give the key a recognisable name' : undefined,
    scopes: scopes.length === 0 ? 'Select at least one scope' : undefined,
    rate: !Number.isInteger(rateN) || rateN < 1 || rateN > 10000 ? 'Between 1 and 10,000 requests per minute' : ownerReseller && rateN > ownerReseller.limits.ratePerMinute ? `Exceeds ${ownerReseller.name}'s account limit of ${ownerReseller.limits.ratePerMinute}/min` : undefined,
    ips: invalidIps.length ? `Not a valid IPv4/IPv6 address or CIDR range: ${invalidIps.join(', ')}` : undefined,
  }
  const hasErrors = Object.values(errors).some(Boolean)

  const create = useInstMutation((body: Parameters<typeof developerService.createApiKey>[0]) => developerService.createApiKey(body), {
    onSuccess: (data) => setCreated(data),
  })

  const submit = () => {
    setSubmitted(true)
    if (hasErrors) return
    create.mutate({
      name: name.trim(),
      resellerId: owner || null,
      environment: env,
      scopes,
      rateLimit: rateN,
      ipAllowlist: ipList,
      expiresInDays: expiry === 'never' ? null : Number(expiry),
    })
  }

  const toggleScope = (s: ApiScope, on: boolean) => setScopes((cur) => (on ? FULL.filter((x) => cur.includes(x) || x === s) : cur.filter((x) => x !== s)))
  const err = (k: keyof typeof errors) => (submitted ? errors[k] : undefined)
  const preset = (p: ApiScope[]) => p.length === scopes.length && p.every((s) => scopes.includes(s))

  const copySecret = () => {
    if (!created) return
    navigator.clipboard?.writeText(created.secret).catch(() => undefined)
    setCopied(true)
    toast.success('API key copied to clipboard')
  }

  const expiresOn = expiry === 'never' ? null : new Date(Date.now() + Number(expiry) * 86400_000)
  const ownerLabel = ownerReseller?.name ?? 'Internal · UnlockDesk Ops'

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={created ? <CircleCheck className="text-success" /> : <KeyRound />}
      title={created ? 'API key created' : 'Create API key'}
      description={
        created
          ? `${created.key.name} · ${ownerLabel}`
          : 'Keys let a reseller’s shop, unlock panel or POS place IMEI checks, unlocks and code orders through the Reseller API. Grant only what the integration needs.'
      }
      footer={
        created ? (
          <>
            <span className="mr-auto hidden text-[12px] text-fg-3 sm:block">{copied ? 'Copied. Closing this dialog hides the key permanently.' : 'Copy the key before closing this dialog.'}</span>
            <Button variant={copied ? 'primary' : 'secondary'} onClick={onClose}>
              {copied ? 'Done' : 'I have stored the key'}
            </Button>
          </>
        ) : (
          <>
            <span className="mr-auto hidden min-w-0 items-center gap-2 truncate text-[12px] text-fg-3 md:inline-flex">
              <EnvBadge env={env} />
              <span className="truncate">
                {scopes.length ? scopeSummary(scopes) : 'No scopes'} · {Number.isFinite(rateN) ? num(rateN) : '—'}/min · {ipList.length ? `${ipList.length} IP rule${ipList.length === 1 ? '' : 's'}` : 'any IP'}
              </span>
            </span>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="accent" onClick={submit} loading={create.isPending} leading={<KeyRound />}>
              Create key
            </Button>
          </>
        )
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {created ? (
          <motion.div key="created" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="space-y-5">
            <div className="relative overflow-hidden rounded-xl border border-line bg-bg-subtle">
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
                <span className="mono-label">Secret key · shown once</span>
                <EnvBadge env={created.key.environment} />
              </div>
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <code className="min-w-0 flex-1 font-mono text-[14px] leading-relaxed font-medium tracking-wide break-all text-fg select-all sm:text-[15px]">{created.secret}</code>
                <Button variant={copied ? 'secondary' : 'accent'} onClick={copySecret} leading={copied ? <Check className="text-success" /> : <Copy />} className="shrink-0">
                  {copied ? 'Copied' : 'Copy key'}
                </Button>
              </div>
            </div>

            <div className="flex gap-3 rounded-xl border border-warning/25 bg-warning/[0.06] p-3.5">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
              <div className="text-[13px]">
                <p className="font-medium text-fg">You won't be able to see this key again. Store it securely.</p>
                <p className="mt-0.5 text-fg-2">
                  Share it with {ownerReseller ? ownerReseller.name : 'your team'} over a secure channel — never by email or chat. ORVEX only keeps an Argon2id hash; if the key is lost, revoke it and create a new one.
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-line p-4 text-[12.5px] sm:grid-cols-4">
              <div className="col-span-2">
                <dt className="mono-label">Identifier</dt>
                <dd className="mt-1">
                  <KeyId apiKey={created.key} className="text-[12px] text-fg" />
                </dd>
              </div>
              <div>
                <dt className="mono-label">Rate limit</dt>
                <dd className="mt-1 font-mono text-[12px] text-fg tabular">{num(created.key.rateLimit)}/min</dd>
              </div>
              <div>
                <dt className="mono-label">Expires</dt>
                <dd className="mt-1 text-fg">{created.key.expiresAt ? date(created.key.expiresAt) : 'Never'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="mono-label">Access</dt>
                <dd className="mt-1.5">
                  <ScopeChips scopes={created.key.scopes} max={4} />
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="mono-label">IP allowlist</dt>
                <dd className="mt-1.5 inline-flex items-center gap-1.5 text-fg">
                  {created.key.ipAllowlist.length ? <ShieldCheck className="size-3.5 text-success" /> : <Globe className="size-3.5 text-fg-3" />}
                  {created.key.ipAllowlist.length ? `${created.key.ipAllowlist.length} rules` : 'Any IP'}
                </dd>
              </div>
            </dl>

            <CodeBlock
              title="Verify the key · read the balance"
              lang="bash"
              code={`export RESELLER_API_KEY="${created.key.prefix}…"   # paste the full key\n\ncurl ${API_BASE}/balance \\\n  -H "Authorization: Bearer $RESELLER_API_KEY"`}
            />
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" error={err('name')} hint="Name it after the integration — only administrators see it">
                <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="MobileHub — Unlock panel" invalid={!!err('name')} />
              </Field>
              <Field label="Owner" hint={lockOwner ? 'Orders are charged to this reseller' : owner ? 'Orders are charged to this reseller at its group prices' : 'Internal keys order at public prices'}>
                {lockOwner ? (
                  <div className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 text-[13.5px] text-fg">
                    <Lock className="size-3.5 text-fg-3" />
                    {ownerLabel}
                  </div>
                ) : (
                  <Select
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    options={[{ value: '', label: 'Internal · UnlockDesk Ops' }, ...(resellers.data ?? []).filter((r) => r.status !== 'suspended').map((r) => ({ value: r.id, label: `${r.name}${r.status === 'pending' ? ' (pending)' : ''}` }))]}
                  />
                )}
              </Field>
            </div>

            <Field label="Environment">
              <div className="grid gap-2.5 sm:grid-cols-2">
                {ENVIRONMENTS.map((o) => {
                  const on = env === o.v
                  return (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setEnv(o.v)}
                      aria-pressed={on}
                      className={cn(
                        'relative flex flex-col items-start gap-2 overflow-hidden rounded-xl border p-3 text-left transition-[border-color,background-color,box-shadow]',
                        on
                          ? o.v === 'live'
                            ? 'border-accent/50 bg-accent/[0.04] shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_12%,transparent)]'
                            : 'border-line-strong bg-surface-2 shadow-[0_0_0_3px_color-mix(in_oklab,var(--fg)_6%,transparent)]'
                          : 'border-line hover:border-line-strong hover:bg-surface-2',
                      )}
                    >
                      {o.v === 'test' && <span className="pointer-events-none absolute inset-0 bg-hatch opacity-70" />}
                      <span className="relative flex w-full items-center justify-between gap-2">
                        <EnvBadge env={o.v} />
                        <code className="font-mono text-[11px] text-fg-3">orx_{o.v}_…</code>
                      </span>
                      <span className="relative block text-[12px] leading-relaxed text-fg-2">{o.desc}</span>
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field
              label="Scopes"
              error={err('scopes')}
              action={
                <div className="flex items-center gap-1">
                  {(
                    [
                      ['Read-only', READ_ONLY],
                      ['Ordering', STANDARD],
                      ['Full access', FULL],
                    ] as const
                  ).map(([label, set]) => (
                    <Button key={label} type="button" size="xs" variant="ghost" onClick={() => setScopes([...set])} className={cn(preset([...set]) && 'bg-surface-2 text-fg')}>
                      {label}
                    </Button>
                  ))}
                </div>
              }
            >
              <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                {SCOPES.map((s) => (
                  <div key={s.id} className={cn('px-3.5 py-2.5 transition-colors', scopes.includes(s.id) ? 'bg-fg/[0.025]' : 'hover:bg-surface-2/60')}>
                    <Checkbox
                      checked={scopes.includes(s.id)}
                      onChange={(v) => toggleScope(s.id, v)}
                      label={
                        <span className="flex flex-wrap items-center gap-x-2">
                          <code className="font-mono text-[12px] text-fg">{s.id}</code>
                          <span className="text-[12px] font-normal text-fg-3">{s.label}</span>
                          {s.id === 'orders:write' && (
                            <Badge tone="accent" className="h-4.5 text-[10.5px]">
                              charges balance
                            </Badge>
                          )}
                        </span>
                      }
                      description={s.description}
                    />
                  </div>
                ))}
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Rate limit" error={err('rate')} hint={!err('rate') ? (ownerReseller ? `Account limit: ${ownerReseller.limits.ratePerMinute}/min across all its keys` : 'Requests per minute for this key') : undefined}>
                <Input type="number" min={1} value={rate} onChange={(e) => setRate(e.target.value)} trailing={<span className="text-[12px]">req/min</span>} invalid={!!err('rate')} mono />
              </Field>
              <Field label="Expiry" hint={expiresOn ? `Expires on ${date(expiresOn)}` : 'Key stays valid until revoked'}>
                <Segmented<Expiry>
                  value={expiry}
                  onChange={setExpiry}
                  size="md"
                  className="flex w-full [&>button]:flex-1 [&>button]:justify-center"
                  items={[
                    { value: 'never', label: 'Never' },
                    { value: '30', label: '30 d' },
                    { value: '90', label: '90 d' },
                    { value: '365', label: '1 yr' },
                  ]}
                />
              </Field>
            </div>

            <Field
              label="IP allowlist"
              optional
              error={err('ips')}
              hint={
                !err('ips')
                  ? ipList.length
                    ? `${ipList.length} rule${ipList.length === 1 ? '' : 's'} — requests from other addresses get 403 ip_not_allowed`
                    : env === 'live'
                      ? 'Recommended for live keys: the reseller’s shop or panel server IPs. One IPv4/IPv6 address or CIDR per line.'
                      : 'One IPv4/IPv6 address or CIDR range per line. Leave empty to allow any IP.'
                  : undefined
              }
            >
              <Textarea mono rows={3} value={ips} onChange={(e) => setIps(e.target.value)} placeholder={'203.0.113.0/24\n198.51.100.17'} invalid={!!err('ips')} />
              {ipList.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {ipList.map((ip, i) => (
                    <span key={`${ip}-${i}`} className={cn('inline-flex h-5.5 items-center rounded-md px-1.5 font-mono text-[11px] ring-1 ring-inset', isValidIpRule(ip) ? 'bg-fg/[0.04] text-fg-2 ring-line' : 'bg-danger/8 text-danger ring-danger/25')}>
                      {ip}
                    </span>
                  ))}
                </div>
              )}
            </Field>
            <button type="submit" className="hidden" />
          </motion.form>
        )}
      </AnimatePresence>
    </Modal>
  )
}
