import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpRight, Copy, CornerDownLeft, History, KeyRound, RefreshCw, Repeat, Send, Shuffle, Terminal, Wand2 } from 'lucide-react'
import { useApiKeys, useInstMutation, useOrders } from '@/hooks/installation'
import { developerService } from '@/services/installation'
import type { ApiKeyRow, ConsoleResponse } from '@/types/installation'
import { Badge, Button, Card, CodeBlock, EmptyState, Field, Input, Kbd, Select, Skeleton, Switch, Textarea, Tooltip } from '@/components/ui'
import { cn } from '@/lib/cn'
import { ms, time } from '@/lib/format'
import { toast } from '@/stores/toast'
import { DhruChip, EnvBadge, HeaderTable, LiveStateNotice, MethodBadge, QueryError, ScopeChips, StatusCode } from '../shared'
import { curlNative, newIdemKey, statusPhrase } from '../helpers'
import { BAD_LUHN_IMEI, DEMO_IMEI, ENDPOINTS, endpointById } from './samples'

/* ------------------------------------------------------------------------- */
/*  Body templates                                                           */
/* ------------------------------------------------------------------------- */
const TEMPLATES: { id: string; label: string; endpoint: string; body: unknown }[] = [
  { id: 'carrier', label: 'iPhone 15 carrier check (4001)', endpoint: 'create-order', body: { service: '4001', input: { imei: DEMO_IMEI } } },
  { id: 'blacklist', label: 'GSMA blacklist check (4006)', endpoint: 'create-order', body: { service: '4006', input: { imei: '353918104523671' }, client_reference: 'pos-2207' } },
  { id: 'luhn', label: 'Invalid IMEI — Luhn fails (422)', endpoint: 'create-order', body: { service: '4001', input: { imei: BAD_LUHN_IMEI } } },
  { id: 'unlock_uk', label: 'Official unlock — UK network (4039)', endpoint: 'create-order', body: { service: '4039', input: { imei: '358240051111110', carrier: 'ee_uk' } } },
  { id: 'nck', label: 'Samsung NCK unlock code (4040)', endpoint: 'create-order', body: { service: '4040', input: { imei: '352099001761481', model: 'SM-S918B' } } },
  { id: 'batch', label: 'Batch: 1 valid + 1 invalid IMEI', endpoint: 'batch-orders', body: { orders: [{ service: '4006', input: { imei: DEMO_IMEI } }, { service: '4006', input: { imei: BAD_LUHN_IMEI } }] } },
  { id: 'cancel', label: 'Cancel with reason', endpoint: 'cancel-order', body: { reason: 'Customer changed their mind' } },
  { id: 'verify', label: 'Verification — code not working', endpoint: 'verify-order', body: { reason: 'code_not_working', message: 'NCK rejected by the device twice' } },
]

/* ------------------------------------------------------------------------- */
/*  Helpers                                                                  */
/* ------------------------------------------------------------------------- */
function luhnDigit(body14: string) {
  let sum = 0
  for (let i = 0; i < 14; i++) {
    let d = Number(body14[13 - i])
    if (i % 2 === 0) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return String((10 - (sum % 10)) % 10)
}

/** A fresh, Luhn-valid demo IMEI. */
function randomImei() {
  let b = '35'
  while (b.length < 14) b += Math.floor(Math.random() * 10)
  return b + luhnDigit(b)
}

/** An IP that satisfies the key's allow-list (CIDR → host .14). */
function allowedIp(k: Pick<ApiKeyRow, 'ipAllowlist'> | undefined) {
  const rule = k?.ipAllowlist[0]
  if (!rule) return ''
  if (!rule.includes('/')) return rule
  const [base] = rule.split('/')
  const parts = base!.split('.')
  parts[3] = '14'
  return parts.join('.')
}

function parseQuery(s: string): Record<string, string> | undefined {
  const t = s.trim().replace(/^\?/, '')
  if (!t) return undefined
  return Object.fromEntries(new URLSearchParams(t).entries())
}

/** Every order ref found in a response body (single order or batch). */
function orderRefs(body: unknown): string[] {
  const out = new Set<string>()
  const visit = (v: unknown, depth: number) => {
    if (depth > 4 || v == null) return
    if (Array.isArray(v)) return v.forEach((x) => visit(x, depth + 1))
    if (typeof v === 'object') {
      const o = v as Record<string, unknown>
      if (o.object === 'order' && typeof o.id === 'string') out.add(o.id)
      if (typeof o.order === 'string' && /^ORD-/.test(o.order)) out.add(o.order)
      for (const x of Object.values(o)) visit(x, depth + 1)
    }
  }
  visit(body, 0)
  return [...out]
}

interface SentRequest {
  method: 'GET' | 'POST'
  path: string
  query?: Record<string, string>
  headers: Record<string, string>
  body?: unknown
  ip?: string
}

interface Exchange {
  id: string
  at: number
  keyPrefix: string | null
  req: SentRequest
  res: ConsoleResponse
}

/* ------------------------------------------------------------------------- */
/*  Console                                                                  */
/* ------------------------------------------------------------------------- */
export function NativeConsole({ preset, onPresetConsumed }: { preset: string | null; onPresetConsumed: () => void }) {
  const keys = useApiKeys()
  const keyList = useMemo(() => (keys.data ?? []).slice().sort((a, b) => (a.status === b.status ? a.accountName.localeCompare(b.accountName) : a.status === 'active' ? -1 : 1)), [keys.data])
  const [keyId, setKeyId] = useState<string>('key_abc_live1')
  const key = keyList.find((k) => k.id === keyId)

  const [endpointId, setEndpointId] = useState('create-order')
  const endpoint = endpointById(endpointId)!
  const [method, setMethod] = useState<'GET' | 'POST'>(endpoint.method)
  const [path, setPath] = useState(endpoint.path)
  const [queryText, setQueryText] = useState('')
  const [bodyText, setBodyText] = useState(JSON.stringify(endpoint.body ?? {}, null, 2))
  const [idemKey, setIdemKey] = useState(() => newIdemKey('console'))
  const [useIdem, setUseIdem] = useState(true)
  const [sendAuth, setSendAuth] = useState(true)
  const [ip, setIp] = useState(() => allowedIp(key))
  const [history, setHistory] = useState<Exchange[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [lastRef, setLastRef] = useState<string | null>(null)

  const recent = useOrders({ accountId: key?.accountId, channel: 'api', pageSize: 5 }, { live: false })
  const sampleRef = lastRef ?? recent.data?.items[0]?.ref ?? endpoint.example ?? 'ORD-7K3P9Q'

  // IP follows the key's allow-list so allow-listed keys work out of the box (adjusted during render, not in an effect).
  const [ipForKey, setIpForKey] = useState(key?.id)
  if (ipForKey !== key?.id) {
    setIpForKey(key?.id)
    setIp(allowedIp(key))
  }

  const applyEndpoint = (id: string) => {
    const e = endpointById(id)
    if (!e) return
    setEndpointId(id)
    setMethod(e.method)
    setPath(e.path.replace(':id', sampleRef))
    setQueryText(e.query ? new URLSearchParams(e.query).toString() : '')
    setBodyText(e.body !== undefined ? JSON.stringify(e.body, null, 2) : '')
    setIdemKey(newIdemKey('console'))
  }

  // Deep link from the docs ("Try it"): apply it during render, then tell the parent it was consumed.
  const [appliedPreset, setAppliedPreset] = useState<string | null>(null)
  if (preset !== appliedPreset) {
    setAppliedPreset(preset)
    if (preset) applyEndpoint(preset)
  }
  const consumePreset = useEffectEvent(() => onPresetConsumed())
  useEffect(() => {
    if (preset) consumePreset()
  }, [preset])

  // Fill :id once a real order reference is known (adjusted during render, not in an effect).
  const [filledRef, setFilledRef] = useState<string | null>(null)
  if (filledRef !== sampleRef) {
    setFilledRef(sampleRef)
    setPath((p) => (p.includes(':id') ? p.replace(':id', sampleRef) : p))
  }

  const bodyParsed = useMemo((): { ok: true; value: unknown } | { ok: false; error: string } => {
    if (method === 'GET' || !bodyText.trim()) return { ok: true, value: undefined }
    try {
      return { ok: true, value: JSON.parse(bodyText) }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  }, [bodyText, method])

  const authValue = key ? `Bearer ${key.prefix}` : ''
  const headers: Record<string, string> = {
    ...(sendAuth && key ? { Authorization: authValue } : {}),
    ...(method === 'POST' && useIdem && idemKey ? { 'Idempotency-Key': idemKey } : {}),
  }
  const draft: SentRequest = { method, path: path.trim(), query: parseQuery(queryText), headers, body: bodyParsed.ok ? bodyParsed.value : undefined, ip: ip.trim() || undefined }

  // The exchange is stamped when the response arrives (in the mutation, never during render).
  const run = useInstMutation(async (r: SentRequest) => ({ res: await developerService.consoleNative(r), at: Date.now() }), { error: 'Console request failed' })

  const send = async (req: SentRequest = draft) => {
    if (!bodyParsed.ok && req === draft) {
      toast.error('Body is not valid JSON', bodyParsed.error)
      return
    }
    const { res, at } = await run.mutateAsync(req)
    const ex: Exchange = { id: `${at}`, at, keyPrefix: key?.prefix ?? null, req, res }
    setHistory((h) => [ex, ...h].slice(0, 12))
    setSelected(ex.id)
    const refs = orderRefs(res.body)
    if (refs[0]) setLastRef(refs[0])
  }

  const current = history.find((h) => h.id === selected) ?? history[0]
  const curl = curlNative({ method, path: draft.path, query: draft.query, headers: draft.headers, body: draft.body, keyDisplay: key ? `${key.prefix}_••••••••` : '$ORVEX_API_KEY' })

  /** Same Idempotency-Key, different input → 409 idempotency_conflict. */
  const conflictVariant = (req: SentRequest): SentRequest | null => {
    const b = req.body as { input?: Record<string, string> } | undefined
    if (!b?.input?.imei) return null
    return { ...req, body: { ...b, input: { ...b.input, imei: randomImei() } } }
  }

  if (keys.isError) return <Card><QueryError error={keys.error} onRetry={() => keys.refetch()} /></Card>

  const templates = TEMPLATES.filter((t) => t.endpoint === endpointId)

  return (
    <div className="space-y-4">
      <LiveStateNotice>
        <strong className="text-fg">These requests are real in this demo installation.</strong> The console calls the same Native API handler a partner would hit — key, scopes, IP allow-list, rate limit, idempotency and PlaceOrder all apply. Orders you place hold the account’s wallet, are routed to (simulated) suppliers and appear in Orders and API logs.
      </LiveStateNotice>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg border border-line bg-surface-2 text-fg-2">
              <Terminal className="size-4" />
            </span>
            <div>
              <h3 className="text-[14px] font-semibold tracking-[-0.01em]">API console</h3>
              <p className="mt-0.5 text-[12.5px] text-fg-3">Pick a key, an endpoint and a body. Press <Kbd>Ctrl</Kbd> <Kbd>↵</Kbd> to send.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-fg-3">
            <span className="font-mono">portal.unlockdesk-demo.com</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-2">
          {/* ---------------- Request builder ---------------- */}
          <form
            className="min-w-0 space-y-5 border-b border-line p-5 lg:border-r lg:border-b-0"
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault()
                send()
              }
            }}
          >
            {keys.isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-9" />
                ))}
              </div>
            ) : (
              <>
                <Field label="API key" hint="Keys belong to accounts — the account’s tier, limits and wallet apply.">
                  <Select
                    value={keyId}
                    onChange={(e) => setKeyId(e.target.value)}
                    options={keyList.map((k) => ({ value: k.id, label: `${k.accountName} · ${k.name} — ${k.prefix}${k.status === 'revoked' ? ' (revoked)' : ''}${k.ipAllowlist.length ? ' · IP allow-list' : ''}` }))}
                  />
                </Field>
                {key && (
                  <div className="space-y-2 rounded-xl border border-line bg-surface-2/40 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <KeyRound className="size-3.5 text-fg-3" />
                      <Link to={`/admin/accounts/${key.accountId}`} className="text-[13px] font-medium text-fg hover:text-accent-ink">
                        {key.accountName}
                      </Link>
                      <EnvBadge env={key.environment} />
                      {key.dhruCompat && <DhruChip />}
                      {key.status === 'revoked' && <Badge tone="danger">Revoked</Badge>}
                      <span className="ml-auto font-mono text-[11px] text-fg-3">{key.rateLimitPerMin}/min</span>
                    </div>
                    <ScopeChips scopes={key.scopes} />
                    {key.ipAllowlist.length > 0 && (
                      <div className="text-[12px] text-fg-3">
                        IP allow-list <span className="font-mono text-fg-2">{key.ipAllowlist.join(', ')}</span>
                      </div>
                    )}
                  </div>
                )}

                <Field label="Endpoint">
                  <Select value={endpointId} onChange={(e) => applyEndpoint(e.target.value)} options={ENDPOINTS.map((e) => ({ value: e.id, label: `${e.method}  ${e.path}  —  ${e.title}` }))} />
                </Field>

                <div className="flex items-stretch gap-2">
                  <div className="flex h-9 shrink-0 items-center rounded-lg border border-line bg-surface-2 px-2">
                    <MethodBadge method={method} />
                  </div>
                  <Input className="min-w-0 flex-1" mono value={path} onChange={(e) => setPath(e.target.value)} aria-label="Path" />
                </div>
                {method === 'GET' && (endpoint.query || queryText) && <Input mono value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder="status=processing&limit=10" leading={<span className="font-mono text-[12px]">?</span>} />}

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[12.5px] font-medium text-fg">Headers</span>
                  </div>
                  <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                    <div className="flex items-center gap-3 px-3 py-2">
                      <Switch size="sm" checked={sendAuth} onChange={setSendAuth} label="Send Authorization" />
                      <span className="w-[118px] shrink-0 font-mono text-[12px] text-fg-3">Authorization</span>
                      <span className={cn('min-w-0 flex-1 truncate font-mono text-[12px]', sendAuth ? 'text-fg' : 'text-fg-3 line-through')}>{key ? `Bearer ${key.prefix}_••••••••` : '—'}</span>
                      <Tooltip content="Filled from the selected key’s prefix. Turn off to see 401 missing_api_key.">
                        <span className="text-[11px] text-fg-3">auto</span>
                      </Tooltip>
                    </div>
                    <div className={cn('flex items-center gap-3 px-3 py-2', method === 'GET' && 'opacity-50')}>
                      <Switch size="sm" checked={useIdem && method === 'POST'} disabled={method === 'GET'} onChange={setUseIdem} label="Send Idempotency-Key" />
                      <span className="w-[118px] shrink-0 font-mono text-[12px] text-fg-3">Idempotency-Key</span>
                      <input value={idemKey} onChange={(e) => setIdemKey(e.target.value)} disabled={method === 'GET' || !useIdem} className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-fg outline-none placeholder:text-fg-3" aria-label="Idempotency key" />
                      <Button type="button" size="xs" variant="ghost" leading={<Shuffle />} disabled={method === 'GET'} onClick={() => setIdemKey(newIdemKey('console'))}>
                        Generate
                      </Button>
                    </div>
                    <div className="flex items-center gap-3 px-3 py-2">
                      <span className="w-[30px] shrink-0" />
                      <span className="w-[118px] shrink-0 font-mono text-[12px] text-fg-3">Source IP</span>
                      <input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="random (not allow-listed)" className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-fg outline-none placeholder:text-fg-3" aria-label="Source IP" />
                      {key?.ipAllowlist.length ? (
                        <Button type="button" size="xs" variant="ghost" onClick={() => setIp(ip === allowedIp(key) ? '192.0.2.77' : allowedIp(key))}>
                          {ip === allowedIp(key) ? 'Try outside IP' : 'Use allowed IP'}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>

                {method === 'POST' && (
                  <Field
                    label="JSON body"
                    error={!bodyParsed.ok ? `Invalid JSON — ${bodyParsed.error}` : undefined}
                    action={
                      templates.length > 0 && (
                        <Select
                          inputSize="sm"
                          className="w-[230px]"
                          value=""
                          onChange={(e) => {
                            const t = TEMPLATES.find((x) => x.id === e.target.value)
                            if (t) {
                              setBodyText(JSON.stringify(t.body, null, 2))
                              setIdemKey(newIdemKey('console'))
                            }
                          }}
                          options={[{ value: '', label: 'Templates…' }, ...templates.map((t) => ({ value: t.id, label: t.label }))]}
                        />
                      )
                    }
                  >
                    <Textarea mono rows={9} value={bodyText} onChange={(e) => setBodyText(e.target.value)} invalid={!bodyParsed.ok} spellCheck={false} className="min-h-[180px]" />
                  </Field>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <Button type="submit" variant="accent" leading={<Send />} loading={run.isPending} trailing={<CornerDownLeft className="opacity-60" />}>
                    Send request
                  </Button>
                  {method === 'POST' && endpointId === 'create-order' && (
                    <Button
                      type="button"
                      variant="ghost"
                      leading={<Wand2 />}
                      onClick={() => {
                        try {
                          const b = JSON.parse(bodyText) as { input?: Record<string, string> }
                          if (b.input?.imei) {
                            b.input.imei = randomImei()
                            setBodyText(JSON.stringify(b, null, 2))
                            setIdemKey(newIdemKey('console'))
                          }
                        } catch {
                          /* invalid JSON — ignore */
                        }
                      }}
                    >
                      New IMEI
                    </Button>
                  )}
                </div>
              </>
            )}
          </form>

          {/* ---------------- Response ---------------- */}
          <div className="min-w-0 space-y-4 p-5">
            <AnimatePresence mode="wait">
              {current ? (
                <motion.div key={current.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="space-y-4">
                  <ResponseSummary ex={current} />
                  <ReplayHelper
                    ex={current}
                    pending={run.isPending}
                    onReplay={() => send(current.req)}
                    onConflict={() => {
                      const v = conflictVariant(current.req)
                      if (v) send(v)
                    }}
                    canConflict={!!conflictVariant(current.req)}
                  />
                  <div>
                    <div className="mb-1.5 text-[12.5px] font-medium text-fg">Response headers</div>
                    <HeaderTable headers={current.res.headers} />
                  </div>
                  <CodeBlock lang="json" code={JSON.stringify(current.res.body, null, 2)} maxHeight={420} title="Body" />
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-dashed border-line-strong">
                  <EmptyState icon={<Send />} title="No request sent yet" description="The response — status, headers (x-request-id, idempotent-replayed), body and latency — appears here." />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <CodeBlock
          lang="bash"
          code={curl}
          title="cURL"
          actions={
            <Button
              size="xs"
              variant="ghost"
              leading={<Copy />}
              onClick={() => {
                navigator.clipboard?.writeText(curl).catch(() => undefined)
                toast.success('Copied as cURL', 'The secret is masked — paste your own key.')
              }}
            >
              Copy
            </Button>
          }
        />
        <Card>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="flex items-center gap-2 text-[13px] font-semibold">
              <History className="size-3.5 text-fg-3" /> Session history
            </span>
            {history.length > 0 && (
              <Button size="xs" variant="ghost" onClick={() => setHistory([])}>
                Clear
              </Button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="px-4 py-8 text-center text-[12.5px] text-fg-3">Requests you send in this session are listed here. Every one is also in API logs.</p>
          ) : (
            <ul className="max-h-[300px] divide-y divide-line overflow-y-auto">
              {history.map((h) => (
                <li key={h.id}>
                  <button type="button" onClick={() => setSelected(h.id)} className={cn('flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors hover:bg-surface-2/60', current?.id === h.id && 'bg-accent/[0.05]')}>
                    <MethodBadge method={h.req.method} size="xs" />
                    <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg-2">{h.req.path}</span>
                    {h.res.headers['idempotent-replayed'] && <Badge tone="info">replay</Badge>}
                    <StatusCode status={h.res.status} />
                    <span className="w-[54px] text-right font-mono text-[11px] text-fg-3">{time(h.at, true)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

function ResponseSummary({ ex }: { ex: Exchange }) {
  const { res } = ex
  const refs = orderRefs(res.body)
  const err = (res.body as { error?: { code?: string; message?: string } } | null)?.error
  const replayed = res.headers['idempotent-replayed'] === 'true'
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className={cn('font-display text-[28px] leading-none font-semibold tracking-[-0.02em] tabular', res.status >= 500 ? 'text-danger' : res.status >= 400 ? 'text-warning' : 'text-success')}>{res.status}</span>
        <span className="text-[13px] text-fg-2">{statusPhrase(res.status)}</span>
        {replayed && (
          <Badge tone="info" icon={<Repeat />}>
            Idempotent replay
          </Badge>
        )}
        <span className="ml-auto flex items-center gap-3 font-mono text-[12px] text-fg-3">
          <span>{ms(res.latencyMs)}</span>
          {res.headers['x-request-id'] && <span className="hidden truncate sm:inline">{res.headers['x-request-id']}</span>}
        </span>
      </div>
      {err && (
        <div className="rounded-lg border border-warning/25 bg-warning/[0.05] px-3 py-2 text-[12.5px]">
          <code className="font-mono font-semibold text-warning">{err.code}</code>
          <span className="ml-2 text-fg-2">{err.message}</span>
        </div>
      )}
      {refs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] text-fg-3">{replayed ? 'Original order' : refs.length > 1 ? 'Orders' : 'Order'}</span>
          {refs.map((r) => (
            <Link key={r} to={`/admin/orders/${r}`} className="inline-flex h-6 items-center gap-1 rounded-md border border-line bg-surface px-2 font-mono text-[12px] text-fg transition-colors hover:border-line-strong hover:text-accent-ink">
              {r}
              <ArrowUpRight className="size-3" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function ReplayHelper({ ex, pending, onReplay, onConflict, canConflict }: { ex: Exchange; pending: boolean; onReplay: () => void; onConflict: () => void; canConflict: boolean }) {
  const key = ex.req.headers['Idempotency-Key']
  if (ex.req.method !== 'POST' || !key) return null
  const replayed = ex.res.headers['idempotent-replayed'] === 'true'
  return (
    <div className="rounded-xl border border-line bg-surface-2/40 p-3">
      <div className="flex items-start gap-2.5">
        <RefreshCw className="mt-0.5 size-3.5 shrink-0 text-fg-3" />
        <div className="min-w-0 flex-1 text-[12.5px] text-fg-2">
          <p>
            {replayed ? (
              <>Replayed: the account already used <code className="font-mono text-fg">{key}</code> with this exact body, so the original order came back — no second order, no second hold.</>
            ) : ex.res.status === 409 ? (
              <>Conflict: <code className="font-mono text-fg">{key}</code> was already used by this account with a different body. Nothing was placed.</>
            ) : (
              <>Idempotency-Key <code className="font-mono text-fg">{key}</code> is now remembered for this <strong className="text-fg">account</strong> for 24 h.</>
            )}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button size="xs" variant="secondary" leading={<Repeat />} onClick={onReplay} disabled={pending}>
              Send again with the same key
            </Button>
            {canConflict && (
              <Button size="xs" variant="ghost" leading={<Shuffle />} onClick={onConflict} disabled={pending}>
                Same key, different IMEI
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
