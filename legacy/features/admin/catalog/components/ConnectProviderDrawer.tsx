import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, Blocks, Check, CodeXml, FileCode2, KeyRound, Lock, Network, PlugZap, Puzzle, RefreshCw, ShieldCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge, Button, Drawer, Field, Input, Select, Skeleton } from '@/components/ui'
import { useInstallation, useInstMutation, useProviders } from '@/hooks/installation'
import { providersService } from '@/services/installation'
import { cn } from '@/lib/cn'
import { ms, num } from '@/lib/format'
import type { InstalledExtension } from '@/types/extensions'
import type { Provider } from '@/types/installation'
import { ConnectionSteps, type TestStep } from './ConnectionSteps'
import { Callout, REGIONS, hashUnit } from './shared'

interface AdapterOption {
  id: string
  name: string
  kind: 'rest' | 'soap' | 'graphql' | 'custom'
  protocol: Provider['protocol']
  version: string
  source: InstalledExtension['source']
  description: string
  icon: LucideIcon
}

const CREDENTIALS: Record<AdapterOption['kind'], { key: string; label: string; optional?: boolean; hint?: string }[]> = {
  rest: [
    { key: 'api_key', label: 'API key', hint: 'From the supplier’s reseller / API settings' },
    { key: 'username', label: 'Account username', optional: true, hint: 'Some unlock suppliers pair the key with your username' },
    { key: 'webhook_secret', label: 'Callback signing secret', optional: true, hint: 'Verifies inbound result callbacks' },
  ],
  soap: [
    { key: 'username', label: 'Username', hint: 'Your reseller username on the gateway' },
    { key: 'api_access_key', label: 'API access key', hint: 'DHRU-style “API key” issued with the username' },
    { key: 'reseller_code', label: 'Reseller code', optional: true },
  ],
  graphql: [{ key: 'api_token', label: 'API token', hint: 'Bearer token for the supplier’s job queue' }],
  custom: [
    { key: 'api_key', label: 'API key' },
    { key: 'hmac_secret', label: 'HMAC secret', hint: 'Used by the adapter to sign requests' },
  ],
}

/** What each adapter family typically connects in a GSM catalog. */
const ADAPTER_FIT: Record<AdapterOption['kind'], { fits: string; auth: string; baseUrl: string; nameHint: string }> = {
  rest: { fits: 'Unlock and IMEI-check suppliers with JSON APIs', auth: 'API key · optional username', baseUrl: 'https://api.unlock-supplier.example/v2', nameHint: 'e.g. Carrier Unlock Supplier' },
  soap: { fits: 'DHRU-compatible XML gateways — codes, unlocks, IMEI services', auth: 'Username + API access key', baseUrl: 'https://gateway.code-supplier.example/api/index.php', nameHint: 'e.g. Unlock Code Gateway' },
  graphql: { fits: 'Queue-based server-service suppliers — FRP, Mi Account, GSX', auth: 'Bearer API token', baseUrl: 'https://graph.server-supplier.example/v1', nameHint: 'e.g. Server Services Supplier' },
  custom: { fits: 'Suppliers with a bespoke or batch API, via a custom extension', auth: 'Defined by the extension', baseUrl: 'https://api.device-data.example/v1', nameHint: 'e.g. Device Data Supplier' },
}

const FALLBACK_ADAPTERS: AdapterOption[] = [
  { id: 'adapter.rest-json', name: 'REST / JSON Adapter', kind: 'rest', protocol: 'REST / JSON', version: '3.2.0', source: 'core', description: 'Generic adapter for JSON over HTTPS providers with OAuth2, API key or HMAC auth.', icon: CodeXml },
  { id: 'adapter.soap-xml', name: 'SOAP / XML Adapter', kind: 'soap', protocol: 'SOAP / XML', version: '2.1.4', source: 'core', description: 'WSDL-driven adapter for XML gateways, including DHRU-compatible supplier APIs.', icon: FileCode2 },
  { id: 'adapter.graphql', name: 'GraphQL Adapter', kind: 'graphql', protocol: 'GraphQL', version: '1.4.0', source: 'official', description: 'Adapter for GraphQL provider APIs with persisted queries.', icon: Network },
]

function toOption(e: InstalledExtension): AdapterOption {
  const kind: AdapterOption['kind'] = e.source === 'custom' ? 'custom' : e.id.includes('soap') ? 'soap' : e.id.includes('graphql') ? 'graphql' : 'rest'
  return {
    id: e.id,
    name: e.name,
    kind,
    protocol: kind === 'soap' ? 'SOAP / XML' : kind === 'graphql' ? 'GraphQL' : 'REST / JSON',
    version: e.version,
    source: e.source,
    description: e.description,
    icon: kind === 'soap' ? FileCode2 : kind === 'graphql' ? Network : kind === 'custom' ? Puzzle : CodeXml,
  }
}

const STEPS = ['Adapter', 'Connection', 'Test', 'Create'] as const

function simulateSteps(seed: string, kind: AdapterOption['kind']): TestStep[] {
  const r = (salt: number, lo: number, hi: number) => Math.round(lo + hashUnit(seed, salt) * (hi - lo))
  const services = r(6, 80, 340)
  return [
    { label: 'DNS resolve', ms: r(1, 3, 18), ok: true },
    { label: 'TLS handshake', ms: r(2, 24, 88), ok: true },
    { label: kind === 'soap' ? 'Authenticate · username + API access key' : kind === 'graphql' ? 'Authenticate · bearer token' : 'Authenticate · API key', ms: r(3, 40, 140), ok: true },
    { label: kind === 'soap' ? 'accountinfo · read credit balance' : 'Read supplier credit balance', ms: r(5, 45, 190), ok: true },
    { label: `${kind === 'soap' ? 'imeiservicelist' : 'List remote services'} · ${services} services found`, ms: r(4, 120, 420), ok: true },
  ]
}

/** Four-step wizard: adapter → connection → live test → create. */
export function ConnectProviderDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const inst = useInstallation()
  const providers = useProviders()
  const [step, setStep] = useState(0)
  const [adapterId, setAdapterId] = useState('adapter.rest-json')
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [region, setRegion] = useState(REGIONS[0]!)
  const [timeout, setTimeoutMs] = useState('30000')
  const [rate, setRate] = useState('20')
  const [secrets, setSecrets] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState(false)
  const [testRun, setTestRun] = useState(0)
  const [testSteps, setTestSteps] = useState<TestStep[] | null>(null)
  const [testOk, setTestOk] = useState<boolean | null>(null)

  useEffect(() => {
    if (!open) return
    setStep(0)
    setAdapterId('adapter.rest-json')
    setName('')
    setBaseUrl('')
    setRegion(REGIONS[0]!)
    setTimeoutMs('30000')
    setRate('20')
    setSecrets({})
    setTouched(false)
    setTestSteps(null)
    setTestOk(null)
  }, [open])

  const adapters = useMemo(() => {
    const ext = inst.data?.extensions.filter((e) => e.kind === 'provider-adapter' && e.status === 'enabled')
    return ext?.length ? ext.map(toOption) : FALLBACK_ADAPTERS
  }, [inst.data])
  const adapter = adapters.find((a) => a.id === adapterId) ?? adapters[0]!
  const creds = CREDENTIALS[adapter.kind]

  const t = Number(timeout)
  const rl = Number(rate)
  const errors = {
    name: name.trim().length < 3 ? 'At least 3 characters' : providers.data?.some((p) => p.name.toLowerCase() === name.trim().toLowerCase()) ? 'A supplier with this name already exists' : undefined,
    baseUrl: !/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(baseUrl.trim()) ? 'Must be an https:// URL' : undefined,
    timeout: Number.isNaN(t) || t < 1000 || t > 120000 ? '1,000 – 120,000 ms' : undefined,
    rate: Number.isNaN(rl) || rl < 1 || rl > 10000 ? '1 – 10,000 req/s' : undefined,
    ...Object.fromEntries(creds.filter((c) => !c.optional).map((c) => [`cred:${c.key}`, !secrets[c.key]?.trim() ? 'Required' : undefined])),
  } as Record<string, string | undefined>
  const connectionValid = !Object.values(errors).some(Boolean)
  const show = (k: string) => (touched ? errors[k] : undefined)

  const runTest = () => {
    setTestOk(null)
    setTestSteps(null)
    setTestRun((n) => n + 1)
    // Brief "in flight" moment before results stream in.
    setTimeout(() => setTestSteps(simulateSteps(`${baseUrl}|${adapter.id}|${Date.now()}`, adapter.kind)), 450)
  }

  const create = useInstMutation(
    () =>
      providersService.create({
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        adapterId: adapter.id,
        adapterName: adapter.source === 'custom' ? `${adapter.name} (custom)` : adapter.name,
        protocol: adapter.protocol,
        region,
        timeoutMs: t,
        rateLimit: rl,
        description: adapter.kind === 'soap' ? `GSM supplier connected over a DHRU-compatible XML gateway via ${adapter.name}.` : `GSM supplier connected via ${adapter.name}.`,
        // Only credential identifiers are sent here; values are encrypted server-side and never returned.
        credentials: creds.filter((c) => secrets[c.key]?.trim()).map((c) => ({ key: c.key, label: c.label })),
      }),
    {
      success: (p) => `${p.name} connected`,
      onSuccess: (p) => {
        onClose()
        navigate(`/admin/providers/${p.id}`)
      },
    },
  )

  const next = () => {
    if (step === 1) {
      setTouched(true)
      if (!connectionValid) return
      setStep(2)
      runTest()
      return
    }
    if (step === 3) {
      create.mutate()
      return
    }
    setStep((s) => s + 1)
  }

  const canContinue = step === 0 ? !!adapter : step === 1 ? true : step === 2 ? testOk === true : !create.isPending

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="lg"
      icon={<PlugZap />}
      title="Connect provider"
      description="Add a GSM supplier API — unlocks, IMEI checks, codes or server services. Nothing is sent to the supplier until you finish."
      footer={
        <>
          {step > 0 && (
            <Button variant="ghost" leading={<ArrowLeft />} className="mr-auto" onClick={() => setStep((s) => s - 1)} disabled={create.isPending}>
              Back
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={step === 3 ? 'accent' : 'primary'} trailing={step < 3 ? <ArrowRight /> : <Check />} disabled={!canContinue} loading={create.isPending} onClick={next}>
            {step === 0 ? 'Continue' : step === 1 ? 'Test connection' : step === 2 ? (testOk === null ? 'Testing…' : 'Continue') : 'Connect provider'}
          </Button>
        </>
      }
    >
      {/* Stepper */}
      <ol className="mb-7 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold transition-colors',
                i < step ? 'bg-success text-white' : i === step ? 'bg-fg text-bg' : 'border border-line-strong text-fg-3',
              )}
            >
              {i < step ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={cn('hidden text-[12.5px] font-medium sm:block', i === step ? 'text-fg' : 'text-fg-3')}>{label}</span>
            {i < STEPS.length - 1 && <span className={cn('h-px flex-1 transition-colors', i < step ? 'bg-success/50' : 'bg-line')} />}
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-[15px] font-semibold">Choose an adapter</h3>
                <p className="mt-0.5 text-[13px] text-fg-3">The adapter translates between ORVEX Core and the supplier’s API — orders, status polls, callbacks, balance and service list.</p>
              </div>
              {inst.isLoading ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-[132px] rounded-xl" />
                  ))}
                </div>
              ) : (
                <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
                  {adapters.map((a) => {
                    const active = a.id === adapterId
                    return (
                      <button
                        key={a.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setAdapterId(a.id)}
                        className={cn('relative flex flex-col rounded-xl border p-4 text-left transition-[border-color,background-color,box-shadow]', active ? 'border-accent/50 bg-accent/[0.04] ring-3 ring-accent/10' : 'border-line hover:border-line-strong hover:bg-surface-2/50')}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className={cn('grid size-9 place-items-center rounded-lg border [&_svg]:size-4', active ? 'border-accent/30 bg-accent/10 text-accent-ink' : 'border-line bg-surface-2 text-fg-2')}>
                            <a.icon />
                          </span>
                          {active ? (
                            <span className="grid size-5 place-items-center rounded-full bg-accent text-accent-fg">
                              <Check className="size-3" />
                            </span>
                          ) : (
                            <Badge variant={a.source === 'custom' ? 'soft' : 'outline'}>
                              {a.source === 'core' ? 'Core' : a.source === 'official' ? 'Official' : 'Custom'}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-3 text-[13.5px] font-semibold">{a.kind === 'custom' ? `Custom · ${a.name}` : a.kind === 'soap' ? 'SOAP / XML · DHRU-compatible' : a.protocol}</div>
                        <div className="font-mono text-[11px] text-fg-3">
                          {a.id} · v{a.version}
                        </div>
                        <p className="mt-2 text-[12.5px] leading-relaxed text-fg-2">{a.description}</p>
                        <div className="mt-3 space-y-1 border-t border-line pt-2.5 text-[11.5px]">
                          <div className="flex gap-1.5 text-fg-2">
                            <span className="w-9 shrink-0 text-fg-3">Fits</span>
                            <span>{ADAPTER_FIT[a.kind].fits}</span>
                          </div>
                          <div className="flex gap-1.5 text-fg-2">
                            <span className="w-9 shrink-0 text-fg-3">Auth</span>
                            <span>{ADAPTER_FIT[a.kind].auth}</span>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
              <Callout tone="neutral" icon={<Blocks />} title="Adapters are extensions">
                Core never talks to a supplier directly. A DHRU-compatible XML supplier is simply a configuration of the SOAP / XML adapter. Each API is wrapped by an adapter extension implementing <span className="font-mono text-[11.5px]">testConnection</span>, <span className="font-mono text-[11.5px]">listRemoteServices</span>, <span className="font-mono text-[11.5px]">submitOrder</span>,{' '}
                <span className="font-mono text-[11.5px]">getOrderStatus</span> and <span className="font-mono text-[11.5px]">parseWebhook</span>. New supplier APIs never require changes to Core, and Core updates never overwrite your integrations. Need a supplier no adapter supports? A custom adapter is delivered as an extension.
              </Callout>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <section className="space-y-4">
                <h3 className="mono-label">Connection</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Display name" error={show('name')}>
                    <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={ADAPTER_FIT[adapter.kind].nameHint} invalid={!!show('name')} />
                  </Field>
                  <Field label="Region" hint="Where the supplier processes orders">
                    <Select value={region} onChange={(e) => setRegion(e.target.value)} options={REGIONS.map((r) => ({ value: r, label: r }))} />
                  </Field>
                </div>
                <Field label="Base URL" error={show('baseUrl')} hint={adapter.kind === 'soap' ? `DHRU-style gateways expose a single endpoint (often …/api/index.php). Sent by ${adapter.name} over TLS 1.2+.` : `Requests are sent by ${adapter.name} over TLS 1.2+.`}>
                  <Input mono value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={ADAPTER_FIT[adapter.kind].baseUrl} invalid={!!show('baseUrl')} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Timeout" error={show('timeout')} hint="Fail over to the next supplier after">
                    <Input inputMode="numeric" value={timeout} onChange={(e) => setTimeoutMs(e.target.value)} trailing={<span className="text-[12px]">ms</span>} invalid={!!show('timeout')} />
                  </Field>
                  <Field label="Rate limit" error={show('rate')} hint="Core queues requests above this">
                    <Input inputMode="numeric" value={rate} onChange={(e) => setRate(e.target.value)} trailing={<span className="text-[12px]">req/s</span>} invalid={!!show('rate')} />
                  </Field>
                </div>
              </section>
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="mono-label">Credentials</h3>
                  <span className="flex items-center gap-1.5 text-[11.5px] text-fg-3">
                    <Lock className="size-3" /> Write-only
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {creds.map((c) => (
                    <Field key={c.key} label={c.label} optional={c.optional} error={show(`cred:${c.key}`)} hint={c.hint}>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        spellCheck={false}
                        mono
                        leading={<KeyRound />}
                        value={secrets[c.key] ?? ''}
                        onChange={(e) => setSecrets((s) => ({ ...s, [c.key]: e.target.value }))}
                        invalid={!!show(`cred:${c.key}`)}
                      />
                    </Field>
                  ))}
                </div>
                <Callout tone="success" icon={<ShieldCheck />} title="Encrypted at rest, never shown again">
                  Credentials are encrypted with AES-256-GCM and stored only in this installation’s own PostgreSQL database. After saving they are write-only: the API returns masked values and you can rotate or replace them, but never read them back.
                </Callout>
              </section>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-semibold">Testing connection</h3>
                  <p className="mt-0.5 font-mono text-[12px] text-fg-3">{baseUrl}</p>
                </div>
                <Button size="sm" variant="ghost" leading={<RefreshCw />} onClick={runTest} disabled={testOk === null}>
                  Re-run
                </Button>
              </div>
              <div className="rounded-xl border border-line bg-surface-2/40 p-2">
                <ConnectionSteps steps={testSteps} pending runKey={testRun} onDone={setTestOk} />
              </div>
              <AnimatePresence>
                {testOk !== null && testSteps && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                    {testOk ? (
                      <Callout tone="success" title={`Connected in ${ms(testSteps.reduce((a, s) => a + s.ms, 0))}`}>
                        {adapter.name} authenticated with {name.trim()}, read the credit balance and fetched the supplier’s service list. Continue to save the supplier.
                      </Callout>
                    ) : (
                      <Callout tone="danger" title="Connection failed">
                        Check the base URL and credentials, then re-run the test.
                      </Callout>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-[15px] font-semibold">Review &amp; connect</h3>
                <p className="mt-0.5 text-[13px] text-fg-3">The supplier is created as operational. Map its service IDs to your catalog afterwards.</p>
              </div>
              <div className="overflow-hidden rounded-xl border border-line">
                {[
                  ['Name', name.trim()],
                  ['Adapter', `${adapter.name} · ${adapter.id}`],
                  ['Protocol', adapter.kind === 'soap' ? 'SOAP / XML · DHRU-compatible' : adapter.protocol],
                  ['Base URL', baseUrl.trim()],
                  ['Region', region],
                  ['Timeout', ms(t)],
                  ['Rate limit', `${num(rl)} req/s`],
                  ['Credentials', `${creds.filter((c) => secrets[c.key]?.trim()).length} secret(s) · encrypted on save`],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-4 border-b border-line px-4 py-2.5 text-[13px] last:border-0">
                    <span className="text-fg-3">{k}</span>
                    <span className={cn('min-w-0 truncate text-right', (k === 'Base URL' || k === 'Adapter') && 'font-mono text-[12px]')}>{v}</span>
                  </div>
                ))}
              </div>
              <Callout tone="neutral">Next: sync the supplier’s service list (unlocks, IMEI checks, codes…) and map its service IDs to your internal services on the Mappings page — e.g. SVC-1018 NCK Code ↔ #3110.</Callout>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </Drawer>
  )
}
