import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpRight, CornerDownLeft, RefreshCw, ScrollText, Send, Terminal } from 'lucide-react'
import { useApiKeys, useInstMutation, usePrices, useResellers, useServices } from '@/hooks/installation'
import { ordersService } from '@/services/installation'
import type { OrderRow, Service, ServiceField } from '@/types/installation'
import { Badge, Button, Card, CodeBlock, DemoTag, Field, Input, Kbd, Select, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { duration, money, ms } from '@/lib/format'
import { API_BASE, MethodBadge, StatusCode, keyDisplay, statusPhrase } from '../shared'
import { countryName } from '@/features/admin/commerce/resellers/shared'
import { DEMO_IMEI, categorySlug, luhnValid } from './samples'

interface ConsoleResponse {
  status: number
  body: unknown
  latency: number
  order?: OrderRow
  replayed?: boolean
  at: number
}

const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`)

function mask(v: string) {
  if (v.length <= 4) return '••••'
  return `${v.slice(0, 3)}${'•'.repeat(Math.max(3, v.length - 6))}${v.slice(-3)}`
}

const isImeiField = (f: ServiceField) => f.key === 'imei'
/** A 15-digit IMEI whose check digit is wrong — the API rejects it before anything is charged. */
const failsLuhn = (f: ServiceField, v: string) => isImeiField(f) && /^\d{15}$/.test(v) && !luhnValid(v)

function validate(f: ServiceField, v: string): string | undefined {
  if (!v) return f.required ? 'Required' : undefined
  if (f.validation?.pattern) {
    try {
      if (!new RegExp(f.validation.pattern).test(v)) return f.validation.message ?? `Must match ${f.validation.pattern}`
    } catch {
      /* ignore invalid patterns */
    }
  }
  if (failsLuhn(f, v)) return 'Luhn checksum failed — check the last digit'
  return undefined
}

const reqId = () => `req_${newKey().replace(/-/g, '').slice(0, 24)}`

export function TryItConsole() {
  const resellers = useResellers({ status: 'active' })
  const services = useServices({ status: 'active' })
  const [resellerId, setResellerId] = useState('rsl_482')
  const reseller = resellers.data?.find((r) => r.id === resellerId)
  const keys = useApiKeys({ resellerId })
  const prices = usePrices(reseller?.pricingGroupId)

  const allowed = useMemo(() => {
    const all = (services.data ?? []).filter((s) => s.visibility.api)
    if (!reseller || reseller.allowedServiceIds === 'all') return all
    const set = new Set(reseller.allowedServiceIds)
    return all.filter((s) => set.has(s.id))
  }, [services.data, reseller])

  const [serviceId, setServiceId] = useState('SVC-1001')
  const service: Service | undefined = allowed.find((s) => s.id === serviceId) ?? allowed[0]
  const [values, setValues] = useState<Record<string, string>>({})
  const [idemKey, setIdemKey] = useState(newKey)
  const [touched, setTouched] = useState(false)
  const [response, setResponse] = useState<ConsoleResponse | null>(null)
  const history = useRef(new Map<string, { body: string; response: ConsoleResponse }>())

  // Prefill each field with its documented example whenever the service changes.
  useEffect(() => {
    if (!service) return
    setValues(Object.fromEntries(service.fields.map((f) => [f.key, f.validation?.example ?? ''])))
    setTouched(false)
  }, [service?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const price = prices.data?.find((p) => p.serviceId === service?.id)
  const key = keys.data?.find((k) => k.status === 'active' && k.environment === 'live') ?? keys.data?.find((k) => k.status === 'active')
  const input = useMemo(() => Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '')), [values])
  const errors = useMemo(() => Object.fromEntries((service?.fields ?? []).map((f) => [f.key, validate(f, values[f.key] ?? '')]).filter(([, e]) => e)), [service, values]) as Record<string, string>
  const body = { service_id: service?.id ?? '', fields: input }
  const bodyStr = JSON.stringify(body)

  const create = useInstMutation((b: { serviceId: string; resellerId: string; input: Record<string, string> }) => ordersService.create(b), { error: 'The API returned an error' })

  const curl = `curl -X POST ${API_BASE}/orders \\
  -H "Authorization: Bearer ${key ? `${key.prefix}••••••••` : '$RESELLER_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: ${idemKey}" \\
  -d '${JSON.stringify(body, null, 2).replace(/\n/g, '\n  ')}'`

  const send = async () => {
    if (!service || !reseller || create.isPending) return
    setTouched(true)
    const t0 = performance.now()
    const prior = history.current.get(idemKey)
    if (prior) {
      // Idempotency semantics, exactly as documented above.
      const latency = 6 + Math.round(Math.random() * 10)
      if (prior.body === bodyStr) setResponse({ ...prior.response, replayed: true, latency, at: Date.now() })
      else setResponse({ status: 409, latency, at: Date.now(), body: { error: { type: 'invalid_request_error', code: 'idempotency_conflict', message: 'Idempotency-Key was already used with a different request body.', request_id: reqId() } } })
      return
    }
    // IMEI checksum is validated at the edge, before pricing and routing — nothing is charged.
    const luhnField = service.fields.find((f) => failsLuhn(f, values[f.key] ?? ''))
    if (luhnField) {
      setResponse({
        status: 422,
        latency: 4 + Math.round(Math.random() * 6),
        at: Date.now(),
        body: { error: { type: 'invalid_request_error', code: 'validation_failed', reason: 'luhn_failed', message: `IMEI ${values[luhnField.key]} failed the Luhn checksum — check the last digit.`, field: luhnField.key, request_id: reqId() } },
      })
      return
    }
    try {
      const o = await create.mutateAsync({ serviceId: service.id, resellerId: reseller.id, input })
      const latency = performance.now() - t0
      const res: ConsoleResponse = {
        status: 201,
        latency,
        order: o,
        at: Date.now(),
        body: {
          id: o.id,
          object: 'order',
          number: o.number,
          status: o.status === 'created' ? 'processing' : o.status,
          service: { id: o.serviceId, name: o.serviceName },
          price: { amount: o.price, currency: 'USD' },
          client_reference: o.clientReference,
          fields: Object.fromEntries(Object.entries(o.input).map(([k, v]) => [k, service.fields.find((f) => f.key === k)?.sensitive ? mask(v) : v])),
          result: null,
          error: null,
          created_at: o.createdAt.replace(/\.\d{3}Z$/, 'Z'),
        },
      }
      history.current.set(idemKey, { body: bodyStr, response: res })
      setResponse(res)
    } catch (e) {
      const err = e as { status?: number; code?: string; message?: string; details?: unknown }
      setResponse({
        status: err.status ?? 500,
        latency: performance.now() - t0,
        at: Date.now(),
        body: { error: { type: (err.status ?? 500) < 500 ? 'invalid_request_error' : 'api_error', code: err.code ?? 'internal_error', message: err.message ?? 'Unexpected error', ...(err.details ? { fields: err.details } : {}), request_id: reqId() } },
      })
    }
  }

  const loading = resellers.isLoading || services.isLoading

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg border border-line bg-surface-2 text-fg-2">
            <Terminal className="size-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[14px] font-semibold tracking-[-0.01em]">Try it</h3>
              <MethodBadge method="POST" size="xs" />
              <code className="font-mono text-[12px] text-fg-2">/orders</code>
            </div>
            <p className="mt-0.5 text-[12.5px] text-fg-3">Sends a real request to this installation as the selected reseller. The IMEI is validated, the order routed to a supplier, charged and logged.</p>
          </div>
        </div>
        <DemoTag />
      </div>

      <div className="grid lg:grid-cols-2">
        {/* Request builder */}
        <form
          className="space-y-5 border-b border-line p-5 lg:border-r lg:border-b-0"
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
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-9" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="API client" hint={key ? <span className="font-mono text-[11px]">{keyDisplay(key)}</span> : 'No active key — request would fail with 401'}>
                  <Select
                    value={resellerId}
                    onChange={(e) => {
                      setResellerId(e.target.value)
                      setResponse(null)
                    }}
                    options={(resellers.data ?? []).map((r) => ({ value: r.id, label: r.name }))}
                  />
                </Field>
                <Field label="Service" hint={reseller && reseller.allowedServiceIds !== 'all' ? `${allowed.length} services enabled for ${reseller.name}` : `${allowed.length} services`}>
                  <Select value={service?.id ?? ''} onChange={(e) => setServiceId(e.target.value)} options={allowed.map((s) => ({ value: s.id, label: `${s.name} · ${s.id}` }))} />
                </Field>
              </div>

              {reseller && service && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-line bg-surface-2/50 px-3 py-2 text-[12px] text-fg-3">
                  <span>
                    Charged <span className="font-medium text-fg tabular">{price ? money(price.groupPrice) : '…'}</span>
                    {price && price.groupPrice < price.publicPrice && <span className="ml-1 line-through">{money(price.publicPrice)}</span>}
                  </span>
                  <span>
                    Balance <span className={cn('tabular', reseller.balance < 100 ? 'text-warning' : 'text-fg-2')}>{money(reseller.balance)}</span>
                  </span>
                  <span className="font-mono text-[11px]">{categorySlug(service.category)}</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className={cn('size-1.5 rounded-full', service.delivery === 'instant' ? 'bg-accent' : 'border border-fg-3')} />
                    {service.delivery === 'instant' ? `Instant result · ${duration(service.turnaround.min)}–${duration(service.turnaround.max)}` : `Async · ${duration(service.turnaround.min)}–${duration(service.turnaround.max)} · result via webhook`}
                  </span>
                </div>
              )}

              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="mono-label">fields</span>
                  <button type="button" className="text-[12px] text-fg-3 hover:text-fg" onClick={() => service && setValues(Object.fromEntries(service.fields.map((f) => [f.key, f.validation?.example ?? ''])))}>
                    Reset to examples
                  </button>
                </div>
                <div className="space-y-3.5">
                  {service?.fields.map((f) => {
                    const err = touched ? errors[f.key] : undefined
                    const v = values[f.key] ?? ''
                    const label = (
                      <span className="flex items-center gap-2">
                        <code className="font-mono text-[12px]">{f.key}</code>
                        <span className="font-normal text-fg-3">{f.label}</span>
                        {f.required && <span className="font-mono text-[10px] font-semibold tracking-[0.08em] text-accent-ink uppercase">required</span>}
                      </span>
                    )
                    const opts = f.validation?.options
                    return (
                      <Field
                        key={f.key}
                        label={label}
                        error={err}
                        hint={
                          !err ? (
                            f.validation?.pattern ? (
                              <span className="font-mono text-[11px]">
                                {f.validation.pattern}
                                {isImeiField(f) && f.validation.pattern === '^\\d{15}$' && <span className="text-fg-3"> · Luhn checksum</span>}
                              </span>
                            ) : (
                              f.description
                            )
                          ) : undefined
                        }
                        action={
                          isImeiField(f) ? (
                            <span className="flex items-center gap-1">
                              {(
                                [
                                  ['Clean', DEMO_IMEI.CLEAN],
                                  ['Typo', DEMO_IMEI.TYPO],
                                ] as const
                              ).map(([lbl, imei]) => (
                                <button
                                  key={lbl}
                                  type="button"
                                  onClick={() => {
                                    setValues((s) => ({ ...s, [f.key]: imei }))
                                    setTouched(true)
                                  }}
                                  className={cn('rounded px-1.5 py-0.5 font-mono text-[10.5px] transition-colors', v === imei ? 'bg-surface-3 text-fg' : 'text-fg-3 hover:bg-surface-2 hover:text-fg-2')}
                                >
                                  {lbl}
                                </button>
                              ))}
                            </span>
                          ) : undefined
                        }
                      >
                        {opts ? (
                          <Select
                            value={v}
                            onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
                            invalid={!!err}
                            options={[...(f.required ? [] : [{ value: '', label: '— omit —' }]), ...opts.map((o) => ({ value: o, label: f.type === 'country' ? `${o} · ${countryName(o)}` : o }))]}
                          />
                        ) : (
                          <Input mono value={v} onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))} placeholder={f.validation?.example ?? ''} invalid={!!err} onBlur={() => setTouched(true)} />
                        )}
                      </Field>
                    )
                  })}
                </div>
              </div>

              <Field
                label={<code className="font-mono text-[12px]">Idempotency-Key</code>}
                hint={history.current.has(idemKey) ? 'Already used — sending again replays the stored response.' : 'Fresh key: the next send creates a new order.'}
                action={
                  <button type="button" onClick={() => setIdemKey(newKey())} className="inline-flex items-center gap-1 text-[12px] text-fg-3 hover:text-fg">
                    <RefreshCw className="size-3" /> New key
                  </button>
                }
              >
                <Input mono value={idemKey} onChange={(e) => setIdemKey(e.target.value)} />
              </Field>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button type="submit" variant="accent" size="lg" leading={<Send />} loading={create.isPending} disabled={!service || !reseller}>
                  Send request
                </Button>
                <span className="hidden items-center gap-1 text-[12px] text-fg-3 sm:inline-flex">
                  <Kbd>Ctrl</Kbd>
                  <Kbd>
                    <CornerDownLeft className="size-3" />
                  </Kbd>
                </span>
                {touched && Object.keys(errors).length > 0 && <span className="text-[12px] text-warning">Input has validation errors — the API will answer 422 and charge nothing.</span>}
              </div>
            </>
          )}
        </form>

        {/* Request preview + response */}
        <div className="min-w-0 space-y-4 bg-bg-subtle/40 p-5">
          <CodeBlock title="Request" lang="bash" code={curl} maxHeight={260} />
          <AnimatePresence mode="wait" initial={false}>
            {response ? (
              <motion.div key={response.at} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3 text-[12.5px]">
                    <StatusCode status={response.status} phrase className="text-[13px]" />
                    <span className="font-mono text-fg-3 tabular">{ms(response.latency)}</span>
                    {response.replayed && (
                      <Badge tone="info" variant="soft">
                        Idempotent-Replayed
                      </Badge>
                    )}
                  </div>
                  {response.order && (
                    <div className="flex items-center gap-1">
                      <Button size="xs" variant="ghost" to={`/admin/developer/logs?search=${response.order.requestId}`} leading={<ScrollText />}>
                        Log
                      </Button>
                      <Button size="xs" variant="secondary" to={`/admin/orders/${response.order.id}`} trailing={<ArrowUpRight />}>
                        View order #{response.order.number}
                      </Button>
                    </div>
                  )}
                </div>
                <CodeBlock title={`HTTP/1.1 ${response.status} ${statusPhrase(response.status)}`} lang="json" code={JSON.stringify(response.body, null, 2)} maxHeight={360} />
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid min-h-[220px] place-items-center rounded-xl border border-dashed border-line-strong p-6 text-center">
                <div>
                  <Send className="mx-auto size-5 text-fg-3" />
                  <p className="mt-3 text-[13px] font-medium text-fg">Response will appear here</p>
                  <p className="mt-1 text-[12.5px] text-fg-3">Fields are prefilled with each field&apos;s documented example — a clean demo IMEI and a carrier. Try the “Typo” IMEI to see a Luhn rejection.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Card>
  )
}
