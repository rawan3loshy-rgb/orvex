import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { ArrowUpRight, CircleCheck, CircleX, KeyRound, Lock, Plug, Puzzle, RefreshCw, RotateCcw, ShieldCheck, Zap } from 'lucide-react'
import { Badge, Button, Card, CardBody, CardFooter, CardHeader, ConfirmDialog, CopyButton, Field, Input, Modal, SecretField, Select, Switch, Tooltip } from '@/components/ui'
import { useInstallation, useInstMutation } from '@/hooks/installation'
import { providersService, type ConnectionTestResult } from '@/services/installation'
import { cn } from '@/lib/cn'
import { date, ms, relative } from '@/lib/format'
import type { Provider, ProviderCredential } from '@/types/installation'
import { ConnectionSteps } from '../ConnectionSteps'
import { Callout, KeyValue, REGIONS } from '../shared'

const PROTOCOLS: Provider['protocol'][] = ['REST / JSON', 'SOAP / XML', 'GraphQL', 'gRPC']

interface ConnForm {
  baseUrl: string
  protocol: Provider['protocol']
  region: string
  timeoutMs: string
  maxAttempts: string
  backoff: Provider['retryPolicy']['backoff']
  baseDelayMs: string
  rateRequests: string
  ratePer: Provider['rateLimit']['per']
  webhookSigning: boolean
}

const fromProvider = (p: Provider): ConnForm => ({
  baseUrl: p.baseUrl,
  protocol: p.protocol,
  region: p.region,
  timeoutMs: String(p.timeoutMs),
  maxAttempts: String(p.retryPolicy.maxAttempts),
  backoff: p.retryPolicy.backoff,
  baseDelayMs: String(p.retryPolicy.baseDelayMs),
  rateRequests: String(p.rateLimit.requests),
  ratePer: p.rateLimit.per,
  webhookSigning: p.webhookSigning,
})

export function ConnectionTab({ provider: p, test, testRun, testing, onTest }: { provider: Provider; test: ConnectionTestResult | null; testRun: number; testing: boolean; onTest: () => void }) {
  const [f, setF] = useState<ConnForm>(() => fromProvider(p))
  const base = useMemo(() => fromProvider(p), [p])
  useEffect(() => setF(fromProvider(p)), [p.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(f) !== JSON.stringify(base)
  const set = <K extends keyof ConnForm>(k: K, v: ConnForm[K]) => setF((s) => ({ ...s, [k]: v }))
  const inst = useInstallation()
  const ext = inst.data?.extensions.find((e) => e.id === p.adapterId)

  const n = (v: string) => Number(v)
  const errors = {
    baseUrl: !/^https:\/\/\S+$/.test(f.baseUrl.trim()) ? 'Must be an https:// URL' : undefined,
    timeoutMs: Number.isNaN(n(f.timeoutMs)) || n(f.timeoutMs) < 1000 || n(f.timeoutMs) > 120000 ? '1,000 – 120,000 ms' : undefined,
    maxAttempts: Number.isNaN(n(f.maxAttempts)) || n(f.maxAttempts) < 1 || n(f.maxAttempts) > 6 ? '1 – 6' : undefined,
    baseDelayMs: Number.isNaN(n(f.baseDelayMs)) || n(f.baseDelayMs) < 0 ? '≥ 0' : undefined,
    rateRequests: Number.isNaN(n(f.rateRequests)) || n(f.rateRequests) < 1 ? '≥ 1' : undefined,
  }
  const valid = !Object.values(errors).some(Boolean)

  const save = useInstMutation(
    () =>
      providersService.update(p.id, {
        baseUrl: f.baseUrl.trim(),
        protocol: f.protocol,
        region: f.region,
        timeoutMs: n(f.timeoutMs),
        retryPolicy: { maxAttempts: n(f.maxAttempts), backoff: f.backoff, baseDelayMs: n(f.baseDelayMs) },
        rateLimit: { requests: n(f.rateRequests), per: f.ratePer },
        webhookSigning: f.webhookSigning,
      }),
    { success: 'Connection settings saved' },
  )

  const backoffPreview = Array.from({ length: Math.max(0, Math.min(6, n(f.maxAttempts) || 0) - 1) }, (_, i) => {
    const d = n(f.baseDelayMs) || 0
    return f.backoff === 'exponential' ? d * 2 ** i : f.backoff === 'linear' ? d * (i + 1) : d
  })

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader icon={<Plug />} title="Connection" description="How the adapter reaches this supplier. Changes apply to the next order submission." actions={dirty && <Badge tone="warning" dot>Unsaved</Badge>} />
        <CardBody className="space-y-5">
          <Field label="Base URL" error={errors.baseUrl}>
            <Input mono value={f.baseUrl} onChange={(e) => set('baseUrl', e.target.value)} invalid={!!errors.baseUrl} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Protocol">
              <Select value={f.protocol} onChange={(e) => set('protocol', e.target.value as Provider['protocol'])} options={PROTOCOLS.map((x) => ({ value: x, label: x === 'SOAP / XML' ? 'SOAP / XML (incl. DHRU-compatible)' : x }))} />
            </Field>
            <Field label="Region">
              <Select value={f.region} onChange={(e) => set('region', e.target.value)} options={[...new Set([f.region, ...REGIONS])].map((r) => ({ value: r, label: r }))} />
            </Field>
          </div>
          <Field label="Adapter" hint="Adapters are extensions — swap or upgrade them without touching Core.">
            <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-2/60 px-3 py-2">
              <Puzzle className="size-4 text-fg-3" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{p.adapterName}</div>
                <div className="truncate font-mono text-[11.5px] text-fg-3">{p.adapterId}</div>
              </div>
              <Button size="xs" variant="ghost" to="/admin/system/extensions" trailing={<ArrowUpRight />}>
                Extensions
              </Button>
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Timeout" error={errors.timeoutMs}>
              <Input inputMode="numeric" value={f.timeoutMs} onChange={(e) => set('timeoutMs', e.target.value)} trailing={<span className="text-[12px]">ms</span>} invalid={!!errors.timeoutMs} />
            </Field>
            <Field label="Rate limit" error={errors.rateRequests}>
              <Input inputMode="numeric" value={f.rateRequests} onChange={(e) => set('rateRequests', e.target.value)} invalid={!!errors.rateRequests} />
            </Field>
            <Field label="Per">
              <Select value={f.ratePer} onChange={(e) => set('ratePer', e.target.value as ConnForm['ratePer'])} options={[{ value: 'second', label: 'second' }, { value: 'minute', label: 'minute' }]} />
            </Field>
          </div>
          <div className="rounded-xl border border-line p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] font-medium">Retry policy</span>
              <span className="font-mono text-[11px] text-fg-3">{backoffPreview.length ? `retries after ${backoffPreview.map((d) => ms(d)).join(' → ')}` : 'no retries'}</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Max attempts" error={errors.maxAttempts}>
                <Input inputMode="numeric" value={f.maxAttempts} onChange={(e) => set('maxAttempts', e.target.value)} invalid={!!errors.maxAttempts} />
              </Field>
              <Field label="Backoff">
                <Select value={f.backoff} onChange={(e) => set('backoff', e.target.value as ConnForm['backoff'])} options={['exponential', 'linear', 'fixed'].map((b) => ({ value: b, label: b }))} />
              </Field>
              <Field label="Base delay" error={errors.baseDelayMs}>
                <Input inputMode="numeric" value={f.baseDelayMs} onChange={(e) => set('baseDelayMs', e.target.value)} trailing={<span className="text-[12px]">ms</span>} invalid={!!errors.baseDelayMs} />
              </Field>
            </div>
          </div>
          <Field label="Callback URL" hint="Give this URL to the supplier for asynchronous results — unlock confirmations, codes, server-job outcomes.">
            <div className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface-2/60 pr-1.5 pl-3">
              <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-fg-2">{p.callbackUrl}</span>
              <CopyButton value={p.callbackUrl} />
            </div>
          </Field>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3">
            <div>
              <div className="text-[13px] font-medium">Webhook signing</div>
              <div className="text-[12px] text-fg-3">Reject inbound callbacks whose signature does not match the supplier’s signing secret.</div>
            </div>
            <Switch checked={f.webhookSigning} onChange={(v) => set('webhookSigning', v)} label="Webhook signing" />
          </div>
        </CardBody>
        <CardFooter>
          <span>Last updated settings are audit-logged.</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" leading={<RotateCcw />} disabled={!dirty} onClick={() => setF(base)}>
              Reset
            </Button>
            <Button size="sm" variant="primary" disabled={!dirty || !valid} loading={save.isPending} onClick={() => save.mutate()}>
              Save changes
            </Button>
          </div>
        </CardFooter>
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader
            icon={<Zap />}
            title="Connection test"
            description={`Last health check ${relative(p.lastCheckAt)}`}
            actions={
              <Button size="sm" variant="secondary" leading={<RefreshCw className={cn(testing && 'animate-spin')} />} onClick={onTest} disabled={testing}>
                {test ? 'Re-run' : 'Run test'}
              </Button>
            }
          />
          <CardBody>
            {test || testing ? (
              <>
                <div className="rounded-xl border border-line bg-surface-2/40 p-2">
                  <ConnectionSteps steps={test?.steps ?? null} pending={testing} runKey={testRun} />
                </div>
                {test && !testing && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(4, test.steps.length) * 0.4 }} className={cn('mt-3 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[12.5px]', test.ok ? 'bg-success/[0.07] text-fg' : 'bg-danger/[0.07] text-fg')}>
                    {test.ok ? <CircleCheck className="size-4 text-success" /> : <CircleX className="size-4 text-danger" />}
                    <span className="flex-1">{test.message}</span>
                    <span className="font-mono text-[11.5px] text-fg-3">{ms(test.latencyMs)}</span>
                  </motion.div>
                )}
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center">
                <p className="text-[13px] font-medium">Verify DNS, TLS, credentials and reachability</p>
                <p className="mt-1 text-[12px] text-fg-3">Authenticates, reads the credit balance and pings the supplier through the adapter — without placing an order.</p>
                <Button size="sm" variant="primary" className="mt-4" leading={<Zap />} onClick={onTest}>
                  Run connection test
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={<Puzzle />} title="Adapter extension" description="Installed package that implements this integration." />
          <CardBody className="pt-0">
            <KeyValue k="Package" v={p.adapterId} mono />
            <KeyValue k="Version" v={ext ? `v${ext.version}` : '—'} />
            <KeyValue k="Source" v={ext ? <Badge variant={ext.source === 'custom' ? 'outline' : 'soft'}>{ext.source}</Badge> : '—'} />
            <KeyValue k="Core range" v={ext?.coreRange ?? '—'} mono />
            <KeyValue
              k="Next Core release"
              v={ext ? ext.compatibleWithNext ? <span className="text-success">Compatible</span> : <span className="text-warning">Needs update</span> : '—'}
            />
            {ext && (
              <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line pt-3">
                {ext.permissions.map((perm) => (
                  <span key={perm} className="rounded-md bg-surface-3 px-1.5 py-0.5 font-mono text-[11px] text-fg-2">
                    {perm}
                  </span>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/*  Credentials                                                              */
/* ------------------------------------------------------------------------- */

export function CredentialsTab({ provider: p }: { provider: Provider }) {
  const [rotating, setRotating] = useState<ProviderCredential | null>(null)
  const [replacing, setReplacing] = useState<ProviderCredential | null>(null)
  const [secret, setSecret] = useState('')
  const [confirmSecret, setConfirmSecret] = useState('')

  const rotate = useInstMutation((key: string) => providersService.rotateCredential(p.id, key), {
    success: (_, key) => `${p.credentials.find((c) => c.key === key)?.label ?? 'Credential'} rotated`,
    onSuccess: () => setRotating(null),
  })
  const replace = useInstMutation((key: string) => providersService.rotateCredential(p.id, key), {
    success: 'Credential replaced and encrypted',
    onSuccess: () => {
      setReplacing(null)
      setSecret('')
      setConfirmSecret('')
    },
  })

  const replaceError = secret && secret.length < 8 ? 'At least 8 characters' : confirmSecret && confirmSecret !== secret ? 'Values do not match' : undefined

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Card className="overflow-hidden">
        <CardHeader icon={<KeyRound />} title="Stored credentials" description={`${p.credentials.length} secret${p.credentials.length === 1 ? '' : 's'} used by ${p.adapterName}. Values are write-only.`} />
        <ul className="divide-y divide-line border-t border-line">
          {p.credentials.map((c) => {
            const ageDays = (Date.now() - new Date(c.lastRotatedAt).getTime()) / 86400_000
            const stale = ageDays > 180
            return (
              <li key={c.key} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13.5px] font-medium">{c.label}</span>
                  <span className="font-mono text-[11.5px] text-fg-3">{c.key}</span>
                  {stale && (
                    <Tooltip content="Older than 180 days — rotate to follow your security policy">
                      <Badge tone="warning">Rotation due</Badge>
                    </Tooltip>
                  )}
                  <span className="ml-auto text-[12px] text-fg-3">
                    Rotated <span title={date(c.lastRotatedAt)}>{relative(c.lastRotatedAt)}</span>
                  </span>
                </div>
                <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <SecretField masked={c.masked} label={c.label} className="flex-1" />
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" leading={<RefreshCw />} onClick={() => setRotating(c)}>
                      Rotate
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setReplacing(c)}>
                      Replace
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </Card>
      <div className="space-y-5">
        <Callout tone="success" icon={<ShieldCheck />} title="Encrypted in your own database">
          Every credential is encrypted with AES-256-GCM using this installation’s master key and stored in its own PostgreSQL database. Values are write-only: the API only ever returns masked previews, and they are never transmitted to ORVEX Systems.
        </Callout>
        <Card>
          <CardHeader icon={<Lock />} title="Key management" />
          <CardBody className="pt-0">
            <KeyValue k="Cipher" v="AES-256-GCM" />
            <KeyValue k="Master key" v="APP_KEY (environment)" mono />
            <KeyValue k="Storage" v="provider_credentials" mono />
            <KeyValue k="Decrypted by" v="Adapter runtime only" />
            <KeyValue k="Access" v={<Link to="/admin/system/activity" className="text-accent-ink hover:underline">Audit-logged</Link>} />
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={!!rotating}
        onClose={() => setRotating(null)}
        onConfirm={() => rotating && rotate.mutate(rotating.key)}
        loading={rotate.isPending}
        title={`Rotate ${rotating?.label}?`}
        description={`ORVEX requests a new ${rotating?.label.toLowerCase()} from ${p.name} through the adapter, re-encrypts it and retires the old value after in-flight unlock and code jobs finish.`}
        confirmLabel="Rotate credential"
      />
      <Modal
        open={!!replacing}
        onClose={() => setReplacing(null)}
        size="sm"
        icon={<KeyRound />}
        title={`Replace ${replacing?.label}`}
        description="Paste the new value issued by the supplier. It is encrypted immediately and cannot be viewed again."
        footer={
          <>
            <Button variant="ghost" onClick={() => setReplacing(null)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!secret || !!replaceError || confirmSecret !== secret} loading={replace.isPending} onClick={() => replacing && replace.mutate(replacing.key)}>
              Encrypt &amp; save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="New value" error={secret && secret.length < 8 ? 'At least 8 characters' : undefined}>
            <Input type="password" autoComplete="new-password" spellCheck={false} mono leading={<Lock />} value={secret} onChange={(e) => setSecret(e.target.value)} />
          </Field>
          <Field label="Confirm value" error={confirmSecret && confirmSecret !== secret ? 'Values do not match' : undefined}>
            <Input type="password" autoComplete="new-password" spellCheck={false} mono leading={<Lock />} value={confirmSecret} onChange={(e) => setConfirmSecret(e.target.value)} />
          </Field>
          <p className="text-[12px] text-fg-3">The previous value stays active until this one is saved, so in-flight orders are unaffected.</p>
        </div>
      </Modal>
    </div>
  )
}
