import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ArrowUpRight, CornerDownLeft, PlugZap, Send } from 'lucide-react'
import { useApiKeys, useInstMutation } from '@/hooks/installation'
import { developerService } from '@/services/installation'
import type { ConsoleResponse, DhruOverview } from '@/types/installation'
import { Badge, Button, Card, CodeBlock, EmptyState, Field, Input, Select, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { ms } from '@/lib/format'
import { LiveStateNotice } from '@/features/admin/developer/shared'

const ACTION_HELP: Record<string, string> = {
  accountinfo: 'Wallet projection: credit (available), held, credit limit.',
  imeiservicelist: 'Catalog grouped by category with this account’s live prices.',
  placeimeiorder: 'Translated into PlaceOrder (channel "dhru") — same validation, hold and routing.',
  getimeiorder: 'Order status mapped to DHRU 0 / 1 / 3 / 4, result in CODE.',
}

function esc(v: string) {
  return v.replace(/[<>&]/g, '')
}

export function DhruConsole({ overview }: { overview: DhruOverview | undefined }) {
  const keys = useApiKeys({ status: 'active' })
  const dhruKeys = useMemo(() => (keys.data ?? []).filter((k) => k.dhruCompat), [keys.data])
  const [keyId, setKeyId] = useState('key_abc_live1')
  const key = dhruKeys.find((k) => k.id === keyId) ?? dhruKeys[0]
  const emailFor = (accountId: string) => overview?.connectedAccounts.find((a) => a.id === accountId)?.username ?? ''
  const [username, setUsername] = useState('')
  const [action, setAction] = useState('placeimeiorder')
  const [serviceId, setServiceId] = useState('4001')
  const [imei, setImei] = useState('356938035643809')
  const [model, setModel] = useState('')
  const [provider, setProvider] = useState('')
  const [reference, setReference] = useState('')
  const [orderId, setOrderId] = useState('')
  const [res, setRes] = useState<ConsoleResponse | null>(null)

  // Username follows the selected key's account (adjusted during render, not in an effect).
  const [usernameFor, setUsernameFor] = useState<{ keyId: string | undefined; overview: DhruOverview | undefined } | null>(null)
  if (!usernameFor || usernameFor.keyId !== key?.id || usernameFor.overview !== overview) {
    setUsernameFor({ keyId: key?.id, overview })
    if (key) setUsername(emailFor(key.accountId))
  }

  const parameters =
    action === 'placeimeiorder'
      ? `<PARAMETERS><ID>${esc(serviceId)}</ID><IMEI>${esc(imei)}</IMEI>${model ? `<MODELID>${esc(model)}</MODELID>` : ''}${provider ? `<PROVIDERID>${esc(provider)}</PROVIDERID>` : ''}${reference ? `<REFERENCE>${esc(reference)}</REFERENCE>` : ''}</PARAMETERS>`
      : action === 'getimeiorder'
        ? `<PARAMETERS><ID>${esc(orderId)}</ID></PARAMETERS>`
        : ''

  const run = useInstMutation((b: { username: string; apiaccesskey: string; action: string; parameters?: string }) => developerService.consoleDhru(b), { error: 'DHRU console request failed' })

  const send = async () => {
    if (!key) return
    const r = await run.mutateAsync({ username: username.trim(), apiaccesskey: key.prefix, action, parameters: parameters || undefined })
    setRes(r)
    const ref = (r.body as { SUCCESS?: { REFERENCEID?: string }[] })?.SUCCESS?.[0]?.REFERENCEID
    if (ref) setOrderId(ref)
  }

  const form = [`username=${username}`, `apiaccesskey=${key ? `${key.prefix}_••••••••` : ''}`, `action=${action}`, 'requestformat=JSON', ...(parameters ? [`parameters=${parameters}`] : [])].join('\n')
  const body = res?.body as { SUCCESS?: Record<string, unknown>[]; ERROR?: { MESSAGE: string }[] } | undefined
  const refId = body?.SUCCESS?.[0]?.REFERENCEID as string | undefined
  const statusCode = body?.SUCCESS?.[0]?.STATUS as string | undefined

  return (
    <div className="space-y-4">
      <LiveStateNotice>
        <strong className="text-fg">Real in this demo installation.</strong> The console posts to the DHRU-compatible handler exactly as a legacy DHRU Fusion client would. <code className="font-mono">placeimeiorder</code> places a real order (wallet hold, routing) visible in Orders and API logs.
      </LiveStateNotice>
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <span className="grid size-9 place-items-center rounded-lg border border-line bg-surface-2 text-fg-2">
            <PlugZap className="size-4" />
          </span>
          <div>
            <h3 className="text-[14px] font-semibold tracking-[-0.01em]">DHRU console</h3>
            <p className="mt-0.5 text-[12.5px] text-fg-3">Form-POST in, JSON {'{SUCCESS}'} / {'{ERROR}'} out — HTTP 200 either way, as DHRU clients expect.</p>
          </div>
        </div>
        <div className="grid lg:grid-cols-2">
          <form
            className="min-w-0 space-y-4 border-b border-line p-5 lg:border-r lg:border-b-0"
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
          >
            {keys.isLoading ? (
              Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-9" />)
            ) : dhruKeys.length === 0 ? (
              <EmptyState compact icon={<PlugZap />} title="No DHRU-enabled keys" description="Enable DHRU compatibility on an API key first." action={<Button size="sm" to="/admin/developer/keys?create=1">Create key</Button>} />
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="apiaccesskey" hint="Active keys with DHRU compatibility">
                    <Select value={key?.id ?? ''} onChange={(e) => setKeyId(e.target.value)} options={dhruKeys.map((k) => ({ value: k.id, label: `${k.accountName} — ${k.prefix}` }))} />
                  </Field>
                  <Field label="username" hint="The account email">
                    <Input mono value={username} onChange={(e) => setUsername(e.target.value)} />
                  </Field>
                </div>
                <Field label="action" hint={ACTION_HELP[action]}>
                  <Select value={action} onChange={(e) => setAction(e.target.value)} options={(overview?.actions ?? Object.keys(ACTION_HELP)).map((a) => ({ value: a, label: a }))} />
                </Field>
                {action === 'placeimeiorder' && (
                  <div className="grid gap-3 rounded-xl border border-line bg-surface-2/30 p-3.5 sm:grid-cols-2">
                    <div className="mono-label sm:col-span-2">XML parameters</div>
                    <Field label="ID (service)">
                      <Input mono inputSize="sm" value={serviceId} onChange={(e) => setServiceId(e.target.value)} />
                    </Field>
                    <Field label="IMEI">
                      <Input mono inputSize="sm" value={imei} onChange={(e) => setImei(e.target.value)} />
                    </Field>
                    <Field label="MODELID" optional>
                      <Input mono inputSize="sm" value={model} onChange={(e) => setModel(e.target.value)} placeholder="SM-S918B" />
                    </Field>
                    <Field label="PROVIDERID" optional>
                      <Input mono inputSize="sm" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="ee_uk" />
                    </Field>
                    <Field label="REFERENCE" optional hint="Becomes the idempotency key (dhru:REFERENCE), scoped to the account." className="sm:col-span-2">
                      <Input mono inputSize="sm" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="pos-88231" />
                    </Field>
                  </div>
                )}
                {action === 'getimeiorder' && (
                  <div className="rounded-xl border border-line bg-surface-2/30 p-3.5">
                    <Field label="ID (order reference)" hint="Filled automatically after placeimeiorder.">
                      <Input mono inputSize="sm" value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="ORD-…" />
                    </Field>
                  </div>
                )}
                <CodeBlock lang="text" title="POST body (x-www-form-urlencoded)" code={form} wrap />
                <Button type="submit" variant="accent" leading={<Send />} loading={run.isPending} trailing={<CornerDownLeft className="opacity-60" />}>
                  Send to DHRU endpoint
                </Button>
              </>
            )}
          </form>
          <div className="min-w-0 space-y-3 p-5">
            {res ? (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-display text-[26px] leading-none font-semibold text-success tabular">{res.status}</span>
                  <Badge tone={body?.ERROR ? 'warning' : 'success'}>{body?.ERROR ? 'ERROR' : 'SUCCESS'}</Badge>
                  {statusCode && (
                    <Badge tone="neutral" variant="outline">
                      DHRU STATUS {statusCode}
                    </Badge>
                  )}
                  <span className="ml-auto font-mono text-[12px] text-fg-3">{ms(res.latencyMs)}</span>
                </div>
                {body?.ERROR && <p className={cn('rounded-lg border border-warning/25 bg-warning/[0.05] px-3 py-2 text-[12.5px] text-fg-2')}>{body.ERROR[0]?.MESSAGE}</p>}
                {refId && (
                  <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                    <span className="text-fg-3">Order placed through PlaceOrder</span>
                    <Link to={`/admin/orders/${refId}`} className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-0.5 font-mono text-[12px] hover:text-accent-ink">
                      {refId} <ArrowUpRight className="size-3" />
                    </Link>
                    <button type="button" className="text-accent-ink hover:underline" onClick={() => setAction('getimeiorder')}>
                      → getimeiorder
                    </button>
                  </div>
                )}
                <CodeBlock lang="json" title="JSON response" code={JSON.stringify(res.body, null, 2)} maxHeight={460} />
              </>
            ) : (
              <div className="flex h-full min-h-[300px] items-center justify-center rounded-xl border border-dashed border-line-strong">
                <EmptyState icon={<Send />} title="No request yet" description="Try accountinfo, then placeimeiorder and getimeiorder to watch the status mapping." />
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
