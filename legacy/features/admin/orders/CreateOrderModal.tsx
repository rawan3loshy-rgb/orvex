import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { CircleAlert, Dices, FlaskConical, Lock, Sparkles } from 'lucide-react'
import { ServiceIcon, categoryColor } from '@/components/brand'
import { Badge, Button, DemoTag, Field, Input, Modal, Select, Skeleton } from '@/components/ui'
import { useInstMutation, usePricingGroups, useResellers, useServices } from '@/hooks/installation'
import { ordersService } from '@/services/installation'
import { toast } from '@/stores/toast'
import { duration, money, titleCase } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { PricingGroup, Reseller, Service, ServiceCategory, ServiceField } from '@/types/installation'
import { CATEGORY_ORDER, groupImeiPartial, luhnValid, modelSuggestions, optionLabel, testImei, validateField } from './lib'

const FORM_ID = 'create-test-order'
const CARRIER_SUGGESTIONS = ['Vodafone UK', 'EE UK', 'O2 UK', 'AT&T US', 'T-Mobile US', 'Verizon US', 'Orange FR', 'Telekom DE', 'Movistar ES', 'Etisalat AE']

function priceFor(service: Service, reseller: Reseller | undefined, groups: PricingGroup[] | undefined) {
  if (!reseller) return { price: service.price, note: 'Public list price' }
  const g = groups?.find((x) => x.id === reseller.pricingGroupId)
  if (!g) return { price: service.price, note: 'Public list price' }
  const o = g.overrides.find((x) => x.serviceId === service.id)
  if (o) return { price: o.price, note: `${g.name} · contract price` }
  const price = Math.round(service.price * (1 - g.discountPercent / 100) * 100) / 100
  return { price, note: g.discountPercent ? `${g.name} · ${g.discountPercent > 0 ? '−' : '+'}${Math.abs(g.discountPercent)}%` : `${g.name} · list price` }
}

function turnaround(s: Service) {
  const { min, max } = s.turnaround
  return min === max ? duration(min) : `${duration(min)} – ${duration(max)}`
}

export function CreateOrderModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const services = useServices({ status: 'active' })
  const resellers = useResellers({ status: 'active' })
  const groups = usePricingGroups()

  const [category, setCategory] = useState<ServiceCategory>('IMEI Services')
  const [serviceId, setServiceId] = useState('')
  const [resellerId, setResellerId] = useState('')
  const [reference, setReference] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const list = useMemo(() => (services.data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)), [services.data])
  const counts = useMemo(() => new Map(CATEGORY_ORDER.map((c) => [c, list.filter((s) => s.category === c).length])), [list])
  const inCategory = useMemo(() => list.filter((s) => s.category === category), [list, category])
  const service = list.find((s) => s.id === serviceId)
  const reseller = resellers.data?.find((r) => r.id === resellerId)
  const groupOf = (r: Reseller) => groups.data?.find((g) => g.id === r.pricingGroupId)
  const allowed = !reseller || !service || reseller.allowedServiceIds === 'all' || reseller.allowedServiceIds.includes(service.id)

  // Fresh form every time the modal opens.
  useEffect(() => {
    if (!open) return
    setResellerId('')
    setReference('')
    setValues({})
    setTouched({})
    setServerErrors({})
    setSubmitted(false)
    setFormError(null)
    setServiceId('')
  }, [open])

  useEffect(() => {
    if (!open || serviceId || !list.length) return
    const first = list.find((s) => s.id === 'SVC-1001') ?? list[0]!
    setServiceId(first.id)
    setCategory(first.category)
  }, [open, serviceId, list])

  const errors = useMemo(() => {
    const out: Record<string, string> = {}
    for (const f of service?.fields ?? []) {
      const e = validateField(f, values[f.key])
      if (e) out[f.key] = e
    }
    return out
  }, [service, values])

  const create = useInstMutation((body: { serviceId: string; resellerId: string | null; input: Record<string, string>; clientReference?: string }) => ordersService.create(body), {
    error: 'Order was not created',
    onSuccess: (o) => {
      toast.success(`Order #${o.number} created`, `Routing ${o.serviceName} to a supplier — follow it live.`)
      // Replace the ?create=1 entry so "Back" returns to the list, not the modal.
      navigate(`/admin/orders/${o.id}`, { replace: true })
    },
    onError: (err) => {
      const details = err.details
      if (details && typeof details === 'object') {
        const map: Record<string, string> = {}
        for (const [k, v] of Object.entries(details as Record<string, unknown>)) map[k] = String(v)
        setServerErrors(map)
        setFormError(Object.keys(map).length ? `${err.message} — ${Object.keys(map).length} field${Object.keys(map).length === 1 ? '' : 's'} rejected by the server.` : err.message)
      } else setFormError(err.message)
    },
  })

  const pickService = (id: string) => {
    if (id === serviceId) return
    // Keep values for fields the next service also asks for (e.g. the IMEI).
    const next = list.find((s) => s.id === id)
    setValues((v) => Object.fromEntries(Object.entries(v).filter(([k]) => next?.fields.some((f) => f.key === k))))
    setServiceId(id)
    setTouched({})
    setServerErrors({})
    setSubmitted(false)
    setFormError(null)
  }

  const pickCategory = (c: ServiceCategory) => {
    setCategory(c)
    if (service?.category !== c) {
      const first = list.find((s) => s.category === c)
      if (first) pickService(first.id)
    }
  }

  const setValue = (key: string, v: string) => {
    setValues((s) => ({ ...s, [key]: v }))
    if (serverErrors[key])
      setServerErrors((s) => {
        const next = { ...s }
        delete next[key]
        return next
      })
  }

  const fillExamples = () => {
    if (!service) return
    const next: Record<string, string> = {}
    for (const f of service.fields) {
      const ex = f.validation?.example ?? f.validation?.options?.[0]
      if (ex) next[f.key] = ex
    }
    setValues(next)
    setServerErrors({})
    setFormError(null)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setFormError(null)
    if (!service) return
    if (Object.keys(errors).length) {
      setFormError('Fix the highlighted fields before submitting.')
      return
    }
    const input: Record<string, string> = {}
    for (const f of service.fields) {
      const v = (values[f.key] ?? '').trim()
      if (v) input[f.key] = v
    }
    create.mutate({ serviceId: service.id, resellerId: resellerId || null, input, clientReference: reference.trim() || undefined })
  }

  const pricing = service ? priceFor(service, reseller, groups.data) : null
  const single = (service?.fields.length ?? 0) === 1

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={<FlaskConical />}
      title="Test order"
      description="Sends a real order through validation, pricing, routing and supplier fulfilment — useful to verify a new mapping or supplier."
      footer={
        <>
          <span className="mr-auto hidden items-center gap-2 text-[12px] text-fg-3 sm:inline-flex">
            Channel <span className="text-fg-2">{reseller ? `Reseller API · ${reseller.name}` : 'Admin'}</span>
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" type="submit" form={FORM_ID} loading={create.isPending} disabled={!service || !allowed}>
            {pricing ? `Place order · ${money(pricing.price)}` : 'Place order'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} noValidate className="space-y-6">
        {/* Service */}
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 className="text-[13px] font-semibold">Service</h3>
              <p className="text-[12px] text-fg-3">Active services only · prices shown at public list price</p>
            </div>
          </div>
          {services.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8" />
              <Skeleton className="h-[188px]" />
            </div>
          ) : (
            <>
              <div role="tablist" aria-label="Service category" className="no-scrollbar -mx-1 flex items-center gap-1 overflow-x-auto px-1">
                {CATEGORY_ORDER.filter((c) => counts.get(c)).map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="tab"
                    aria-selected={category === c}
                    onClick={() => pickCategory(c)}
                    className={cn(
                      'inline-flex h-7.5 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] font-medium transition-colors',
                      category === c ? 'border-line-strong bg-surface-3 text-fg' : 'border-transparent text-fg-3 hover:bg-surface-2 hover:text-fg-2',
                    )}
                  >
                    <span className="size-1.5 rounded-full" style={{ background: categoryColor(c) }} />
                    {c}
                    <span className="font-mono text-[10.5px] text-fg-3 tabular">{counts.get(c)}</span>
                  </button>
                ))}
              </div>
              <div role="radiogroup" aria-label="Service" className="max-h-[228px] space-y-1 overflow-y-auto rounded-xl border border-line bg-surface-2/40 p-1.5">
                {inCategory.map((s) => {
                  const on = s.id === serviceId
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => pickService(s.id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg border px-2.5 py-2 text-left transition-[background-color,border-color]',
                        on ? 'border-accent/45 bg-surface shadow-card' : 'border-transparent hover:bg-surface',
                      )}
                    >
                      <span className={cn('grid size-4 shrink-0 place-items-center rounded-full border', on ? 'border-accent' : 'border-line-strong')}>{on && <span className="size-2 rounded-full bg-accent" />}</span>
                      <ServiceIcon icon={s.icon} category={s.category} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-fg">{s.name}</span>
                        <span className="block truncate text-[11.5px] text-fg-3">
                          <span className="font-mono text-[10.5px]">{s.id}</span> · {s.delivery === 'instant' ? 'Instant' : turnaround(s)}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[12.5px] text-fg tabular">{money(s.price)}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
          <AnimatePresence mode="wait" initial={false}>
            {service && (
              <motion.div key={service.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }} className="space-y-2 px-0.5">
                <p className="text-[12.5px] leading-relaxed text-fg-2">{service.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone={service.delivery === 'instant' ? 'success' : 'neutral'}>{service.delivery === 'instant' ? 'Instant result' : titleCase(service.delivery)}</Badge>
                  <Badge>Turnaround {turnaround(service)}</Badge>
                  <Badge>Routing · {titleCase(service.routingStrategy)}</Badge>
                  <Badge>
                    {service.providersCount} supplier{service.providersCount === 1 ? '' : 's'} mapped
                  </Badge>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Dynamic fields */}
        {service && (
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[13px] font-semibold">Device details</h3>
                <p className="text-[12px] text-fg-3">From the service definition · IMEI length and Luhn digit checked before routing</p>
              </div>
              <Button type="button" variant="ghost" size="sm" leading={<Sparkles />} onClick={fillExamples}>
                Example
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {service.fields.map((f) => (
                <DynamicField
                  key={`${service.id}-${f.key}`}
                  field={f}
                  service={service}
                  wide={single || f.key === 'imei' || f.key === 'serial_number'}
                  value={values[f.key] ?? ''}
                  onChange={(v) => setValue(f.key, v)}
                  onBlur={() => setTouched((t) => ({ ...t, [f.key]: true }))}
                  error={serverErrors[f.key] ?? (touched[f.key] || submitted ? errors[f.key] : undefined)}
                  server={!!serverErrors[f.key]}
                />
              ))}
            </div>
          </section>
        )}

        {/* Client */}
        <section className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Field
              label="Client"
              htmlFor="co-client"
              hint={reseller ? `Charged to ${reseller.name}’s prepaid balance (${money(reseller.balance)} available).` : 'Internal order — no reseller balance is charged.'}
              error={!allowed && service ? `${reseller?.name} is not allowed to order ${service.name}.` : undefined}
            >
              <Select
                id="co-client"
                value={resellerId}
                onChange={(e) => {
                  setResellerId(e.target.value)
                  setFormError(null)
                }}
                options={[{ value: '', label: 'Internal · Admin' }, ...(resellers.data ?? []).map((r) => ({ value: r.id, label: `${r.name} · ${groupOf(r)?.name ?? 'Reseller'}` }))]}
              />
            </Field>
            <Field label="Client reference" htmlFor="co-ref" optional hint="Echoed back in webhooks and the API.">
              <Input id="co-ref" mono value={reference} maxLength={40} onChange={(e) => setReference(e.target.value)} placeholder="UD-TEST-0001" autoComplete="off" spellCheck={false} />
            </Field>
          </div>

          {service && pricing && (
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
              <Summary label="Price" value={money(pricing.price)} sub={pricing.note} />
              <Summary label="Est. supplier cost" value={service.primaryCost ? money(service.primaryCost) : '—'} sub="Primary mapping" />
              <Summary
                label="Est. margin"
                value={service.primaryCost ? money(pricing.price - service.primaryCost) : '—'}
                sub={service.primaryCost && pricing.price ? `${(((pricing.price - service.primaryCost) / pricing.price) * 100).toFixed(1)}% of price` : undefined}
                className="col-span-2 sm:col-span-1"
              />
            </div>
          )}
        </section>

        <AnimatePresence>
          {formError && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="flex items-start gap-2.5 rounded-lg border border-danger/25 bg-danger/[0.06] px-3 py-2.5 text-[12.5px] text-danger">
                <CircleAlert className="mt-px size-4 shrink-0" />
                <span>{formError}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </Modal>
  )
}

function Summary({ label, value, sub, className }: { label: string; value: string; sub?: string; className?: string }) {
  return (
    <div className={cn('bg-surface px-3.5 py-3', className)}>
      <div className="mono-label">{label}</div>
      <div className="mt-1 font-display text-[18px] leading-tight font-semibold tracking-[-0.02em] tabular">{value}</div>
      {sub && <div className="mt-0.5 truncate text-[11.5px] text-fg-3">{sub}</div>}
    </div>
  )
}

/** Normalise what an operator types or pastes into a GSM field. */
function sanitize(f: ServiceField, raw: string) {
  if (f.key === 'imei') {
    // Pasted IMEIs are often grouped ("35 693803 564380 9") — keep digits only. Serials stay alphanumeric.
    if (/^[\d\s-]*$/.test(raw)) return raw.replace(/\D/g, '').slice(0, 15)
    return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  }
  if (f.key === 'serial_number') return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (f.key === 'phone_number') return raw.replace(/[^\d+]/g, '')
  return raw
}

function DynamicField({
  field: f,
  service,
  wide,
  value,
  onChange,
  onBlur,
  error,
  server,
}: {
  field: ServiceField
  service: Service
  wide?: boolean
  value: string
  onChange: (v: string) => void
  onBlur: () => void
  error?: string
  server?: boolean
}) {
  const id = `co-f-${f.key}`
  const listId = useId()
  const ex = f.validation?.example
  const options = f.validation?.options
  const imeiOnly = f.key === 'imei' && f.validation?.pattern === '^\\d{15}$'
  const digits = f.key === 'imei' && /^\d+$/.test(value)
  const fullImei = digits && value.length === 15
  const suggestions = f.key === 'model' ? modelSuggestions(service.tags) : f.key === 'network' && !options ? CARRIER_SUGGESTIONS : null

  const hint = (() => {
    if (fullImei) return <span className="font-mono text-fg-2">{`${groupImeiPartial(value)} · ${luhnValid(value) ? 'Luhn ✓' : 'Luhn ✗'}`}</span>
    if (f.description) return f.description
    return ex && !options ? `e.g. ${ex}` : undefined
  })()

  const label = (
    <span className="inline-flex items-center gap-1.5">
      {f.label}
      {f.sensitive && (
        <span title="Sensitive — stored masked" className="text-fg-3">
          <Lock className="size-3" />
        </span>
      )}
      {server && <span className="rounded bg-danger/10 px-1 font-mono text-[9.5px] tracking-wide text-danger uppercase">server</span>}
    </span>
  )

  const action =
    f.key === 'imei' ? (
      <button type="button" onClick={() => onChange(testImei())} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg">
        <Dices className="size-3.5" />
        Test IMEI
        <DemoTag className="ml-0.5 h-4 px-1 text-[8.5px]" />
      </button>
    ) : undefined

  return (
    <Field label={label} htmlFor={id} optional={!f.required} error={error} hint={hint} action={action} className={cn(wide && 'sm:col-span-2')}>
      {options && (f.type === 'enum' || f.type === 'country') ? (
        <Select
          id={id}
          value={value}
          invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          options={[{ value: '', label: f.required ? (f.key === 'network' ? 'Select the locked network…' : 'Select…') : 'None' }, ...options.map((o) => ({ value: o, label: optionLabel(f, o) }))]}
        />
      ) : (
        <>
          <Input
            id={id}
            value={value}
            invalid={!!error}
            mono={f.key === 'imei' || f.key === 'serial_number' || f.key === 'model' || f.key === 'phone_number' || (!!f.validation?.pattern && f.type !== 'email')}
            inputSize={f.key === 'imei' ? 'lg' : 'md'}
            placeholder={ex ?? ''}
            type={f.type === 'email' ? 'email' : f.type === 'phone' ? 'tel' : 'text'}
            inputMode={imeiOnly || f.type === 'number' ? 'numeric' : undefined}
            maxLength={f.key === 'imei' ? 15 : f.validation?.maxLength}
            list={suggestions ? listId : undefined}
            autoComplete="off"
            spellCheck={false}
            className={cn(f.key === 'imei' && '[&_input]:text-[15px] [&_input]:tracking-[0.08em]')}
            trailing={f.key === 'imei' && digits ? <span className={cn('font-mono text-[11px] tabular', value.length === 15 ? 'text-fg-2' : 'text-fg-3')}>{value.length}/15</span> : undefined}
            onChange={(e) => onChange(sanitize(f, e.target.value))}
            onBlur={onBlur}
          />
          {suggestions && (
            <datalist id={listId}>
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          )}
        </>
      )}
    </Field>
  )
}
