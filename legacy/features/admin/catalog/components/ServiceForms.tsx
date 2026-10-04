import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Boxes, Check, CircleCheck, CircleX, ListPlus, Pencil, X } from 'lucide-react'
import { categoryColor } from '@/components/brand'
import { Badge, Button, Drawer, Field, Input, Modal, Segmented, Select, Switch, Textarea } from '@/components/ui'
import { useInstMutation } from '@/hooks/installation'
import { servicesService } from '@/services/installation'
import { cn } from '@/lib/cn'
import type { DeliveryType, Service, ServiceCategory, ServiceField } from '@/types/installation'
import { FIELD_PRESETS, SUGGESTED_TURNAROUND, isImeiField, luhnValid, presetById } from './fieldPresets'
import { CATEGORIES, CATEGORY_META, DELIVERY, turnaroundLabel } from './shared'

/** Toggle chips for the GSM order-input presets. */
export function PresetPicker({ selected, onToggle, disabledKeys, className }: { selected?: string[]; onToggle: (id: string) => void; disabledKeys?: Set<string>; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {FIELD_PRESETS.map((p) => {
        const on = selected?.includes(p.id) ?? false
        const taken = !on && !!disabledKeys?.has(p.field.key)
        return (
          <button
            key={p.id}
            type="button"
            disabled={taken}
            onClick={() => onToggle(p.id)}
            title={taken ? `This service already has a “${p.field.key}” field` : `${p.field.key} · ${p.hint}`}
            className={cn(
              'group flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-left text-[12.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              on ? 'border-accent/50 bg-accent/[0.06] text-fg' : 'border-line text-fg-2 hover:border-line-strong hover:bg-surface-2/60',
            )}
          >
            {on && <Check className="size-3.5 shrink-0 text-accent-ink" />}
            <span className="font-medium whitespace-nowrap">{p.label}</span>
            <span className="hidden text-[11px] whitespace-nowrap text-fg-3 sm:inline">{p.hint}</span>
          </button>
        )
      })}
    </div>
  )
}

type TUnit = 's' | 'min' | 'h'
const UNIT_SECONDS: Record<TUnit, number> = { s: 1, min: 60, h: 3600 }
const unitFor = (seconds: number): TUnit => (seconds >= 3600 ? 'h' : seconds >= 120 ? 'min' : 's')
const fromSeconds = (v: number, u: TUnit) => String(+(v / UNIT_SECONDS[u]).toFixed(2))

/* ------------------------------------------------------------------------- */
/*  New service                                                              */
/* ------------------------------------------------------------------------- */

/** Sensible GSM starting points per category: delivery, list price and order input. */
const CATEGORY_DEFAULTS: Record<ServiceCategory, { delivery: DeliveryType; price: string; inputs: string[]; example: string }> = {
  'IMEI Services': { delivery: 'instant', price: '0.50', inputs: ['imei'], example: 'e.g. Google Pixel Carrier Check' },
  Unlocking: { delivery: 'async', price: '15.00', inputs: ['imei', 'network_eu'], example: 'e.g. Google Pixel Network Unlock — EU' },
  'Server Services': { delivery: 'async', price: '8.00', inputs: ['imei', 'model'], example: 'e.g. Huawei FRP Removal (Server)' },
  Codes: { delivery: 'async', price: '4.00', inputs: ['imei', 'model'], example: 'e.g. NCK Code — Nokia / HMD' },
  'Other Services': { delivery: 'instant', price: '0.30', inputs: ['imei_or_serial'], example: 'e.g. Activation Lock Status — Multi-brand' },
}

export function NewServiceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<ServiceCategory>('IMEI Services')
  const [delivery, setDelivery] = useState<DeliveryType>('instant')
  const [price, setPrice] = useState(CATEGORY_DEFAULTS['IMEI Services'].price)
  const [inputs, setInputs] = useState<string[]>(CATEGORY_DEFAULTS['IMEI Services'].inputs)
  const [description, setDescription] = useState('')
  const [touched, setTouched] = useState(false)
  const [priceTouched, setPriceTouched] = useState(false)

  useEffect(() => {
    if (open) {
      setName('')
      setCategory('IMEI Services')
      setDelivery('instant')
      setPrice(CATEGORY_DEFAULTS['IMEI Services'].price)
      setInputs(CATEGORY_DEFAULTS['IMEI Services'].inputs)
      setDescription('')
      setTouched(false)
      setPriceTouched(false)
    }
  }, [open])

  const onCategory = (c: ServiceCategory) => {
    const d = CATEGORY_DEFAULTS[c]
    setCategory(c)
    setDelivery(d.delivery)
    setInputs(d.inputs)
    if (!priceTouched) setPrice(d.price)
  }

  // Presets sharing a key (e.g. the three "Locked network" enums) are mutually exclusive.
  const toggleInput = (id: string) => {
    const preset = presetById(id)
    if (!preset) return
    setInputs((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur.filter((x) => presetById(x)?.field.key !== preset.field.key), id]))
  }

  const p = Number(price)
  const errors = {
    name: name.trim().length < 3 ? 'Give the service a name of at least 3 characters' : undefined,
    price: Number.isNaN(p) || p <= 0 ? 'Enter a price greater than $0' : undefined,
  }
  const valid = !errors.name && !errors.price
  const turnaround = SUGGESTED_TURNAROUND[category] ?? { min: 1, max: 5 }

  const create = useInstMutation(
    async () => {
      const fields = inputs.map((id) => presetById(id)?.field).filter((f): f is ServiceField => !!f)
      const created = await servicesService.create({ name: name.trim(), category, delivery, price: +p.toFixed(2), description: description.trim(), fields })
      // Core assigns a generic turnaround on create — apply the category default right away.
      return servicesService.update(created.id, { turnaround, tags: [category === 'IMEI Services' ? 'imei' : category.split(' ')[0]!.toLowerCase()] })
    },
    {
      success: (s) => `${s.name} created as draft`,
      onSuccess: (s) => {
        onClose()
        navigate(`/admin/services/${s.id}`)
      },
    },
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      icon={<Boxes />}
      title="New service"
      description="Services start as drafts. Pick the order input now, then map at least one supplier service before activating."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={create.isPending}
            onClick={() => {
              setTouched(true)
              if (valid) create.mutate()
            }}
          >
            Create service
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          setTouched(true)
          if (valid) create.mutate()
        }}
      >
        <Field label="Name" error={touched ? errors.name : undefined}>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={CATEGORY_DEFAULTS[category].example} invalid={touched && !!errors.name} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" hint={CATEGORY_META[category].blurb}>
            <Select value={category} onChange={(e) => onCategory(e.target.value as ServiceCategory)} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field label="Public price" error={touched ? errors.price : undefined} hint="Standard group & website">
            <Input
              leading={<span className="text-[13px]">$</span>}
              inputMode="decimal"
              value={price}
              onChange={(e) => {
                setPriceTouched(true)
                setPrice(e.target.value)
              }}
              invalid={touched && !!errors.price}
              className="tabular"
            />
          </Field>
        </div>
        <Field label="Delivery type" hint={`${DELIVERY[delivery].description} Suggested turnaround ${turnaroundLabel(turnaround)}.`}>
          <Segmented
            size="md"
            value={delivery}
            onChange={setDelivery}
            className="w-full [&>button]:flex-1 [&>button]:justify-center"
            items={(Object.keys(DELIVERY) as DeliveryType[]).map((d) => {
              const D = DELIVERY[d]
              return { value: d, label: D.label, icon: <D.icon /> }
            })}
          />
        </Field>
        <Field label="Order input" hint="What the customer must provide. Fine-tune validation later on the Required fields tab.">
          <PresetPicker selected={inputs} onToggle={toggleInput} />
        </Field>
        <Field label="Description" optional>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does the customer get back — e.g. an NCK code, an unlock confirmation or a GSMA blacklist report? Shown on the website and in the API catalog." rows={3} />
        </Field>
        <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2/50 px-3 py-2 text-[12px] text-fg-3">
          <span className="size-2 shrink-0 rounded-full" style={{ background: categoryColor(category) }} />
          A service ID (SVC-…) is assigned automatically and never changes. New services start as drafts.
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------------------- */
/*  Edit details                                                             */
/* ------------------------------------------------------------------------- */

export function ServiceDetailsDrawer({ service, open, onClose }: { service: Service; open: boolean; onClose: () => void }) {
  const [name, setName] = useState(service.name)
  const [category, setCategory] = useState<ServiceCategory>(service.category)
  const [delivery, setDelivery] = useState<DeliveryType>(service.delivery)
  const [description, setDescription] = useState(service.description)
  const [unit, setUnit] = useState<TUnit>(unitFor(service.turnaround.max))
  const [tMin, setTMin] = useState(fromSeconds(service.turnaround.min, unitFor(service.turnaround.max)))
  const [tMax, setTMax] = useState(fromSeconds(service.turnaround.max, unitFor(service.turnaround.max)))
  const [tags, setTags] = useState<string[]>(service.tags)
  const [tagDraft, setTagDraft] = useState('')

  useEffect(() => {
    if (!open) return
    const u = unitFor(service.turnaround.max)
    setName(service.name)
    setCategory(service.category)
    setDelivery(service.delivery)
    setDescription(service.description)
    setUnit(u)
    setTMin(fromSeconds(service.turnaround.min, u))
    setTMax(fromSeconds(service.turnaround.max, u))
    setTags(service.tags)
    setTagDraft('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Switching unit converts the values in place so the turnaround itself never changes.
  const changeUnit = (u: TUnit) => {
    const conv = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? v : fromSeconds(Number(v) * UNIT_SECONDS[unit], u))
    setTMin(conv(tMin))
    setTMax(conv(tMax))
    setUnit(u)
  }

  const min = Math.round(Number(tMin) * UNIT_SECONDS[unit])
  const max = Math.round(Number(tMax) * UNIT_SECONDS[unit])
  const errors = {
    name: name.trim().length < 3 ? 'At least 3 characters' : undefined,
    turnaround: Number.isNaN(min) || Number.isNaN(max) || tMin.trim() === '' || tMax.trim() === '' || min < 0 || max < min ? 'Max must be ≥ min' : undefined,
  }
  const valid = !errors.name && !errors.turnaround
  const save = useInstMutation(() => servicesService.update(service.id, { name: name.trim(), category, delivery, description: description.trim(), turnaround: { min, max }, tags }), {
    success: 'Service details saved',
    onSuccess: onClose,
  })

  const addTag = () => {
    const t = tagDraft.trim().toLowerCase().replace(/\s+/g, '-')
    if (t && !tags.includes(t)) setTags([...tags, t])
    setTagDraft('')
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      icon={<Pencil />}
      title="Edit service details"
      description={`${service.id} · changes are recorded in the audit log`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!valid} loading={save.isPending} onClick={() => save.mutate()}>
            Save details
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Name" error={errors.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} invalid={!!errors.name} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value as ServiceCategory)} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field label="Delivery type">
            <Select value={delivery} onChange={(e) => setDelivery(e.target.value as DeliveryType)} options={(Object.keys(DELIVERY) as DeliveryType[]).map((d) => ({ value: d, label: `${DELIVERY[d].label} — ${DELIVERY[d].description}` }))} />
          </Field>
        </div>
        <Field label="Description">
          <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field
          label="Expected turnaround"
          error={errors.turnaround}
          hint={errors.turnaround ? undefined : `Shown to customers and used for SLA alerts · ${DELIVERY[delivery].label} · ${turnaroundLabel({ min, max })}`}
          action={<Segmented size="xs" value={unit} onChange={changeUnit} items={[{ value: 's', label: 'sec' }, { value: 'min', label: 'min' }, { value: 'h', label: 'hours' }]} />}
        >
          <div className="grid grid-cols-2 gap-3">
            <Input inputMode="decimal" value={tMin} onChange={(e) => setTMin(e.target.value)} invalid={!!errors.turnaround} leading={<span className="text-[11px]">from</span>} trailing={<span className="text-[11px]">{unit}</span>} />
            <Input inputMode="decimal" value={tMax} onChange={(e) => setTMax(e.target.value)} invalid={!!errors.turnaround} leading={<span className="text-[11px]">to</span>} trailing={<span className="text-[11px]">{unit}</span>} />
          </div>
        </Field>
        <Field label="Tags" hint="Used for search, filters and the public catalog.">
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface p-2">
            {tags.map((t) => (
              <span key={t} className="inline-flex h-6 items-center gap-1 rounded-md bg-surface-3 pr-1 pl-2 font-mono text-[11.5px] text-fg-2">
                {t}
                <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} className="grid size-4 place-items-center rounded text-fg-3 hover:text-fg" aria-label={`Remove ${t}`}>
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  addTag()
                }
              }}
              onBlur={addTag}
              placeholder="Add tag…"
              className="h-6 min-w-[100px] flex-1 bg-transparent px-1 text-[12.5px] outline-none placeholder:text-fg-3"
            />
          </div>
        </Field>
      </div>
    </Drawer>
  )
}

/* ------------------------------------------------------------------------- */
/*  Required field editor                                                    */
/* ------------------------------------------------------------------------- */

const FIELD_TYPES: ServiceField['type'][] = ['string', 'enum', 'country', 'date', 'number', 'email', 'phone']

interface FieldDraft {
  key: string
  label: string
  type: ServiceField['type']
  required: boolean
  sensitive: boolean
  description: string
  pattern: string
  minLength: string
  maxLength: string
  options: string
  example: string
  message: string
}

function toDraft(f?: ServiceField): FieldDraft {
  return {
    key: f?.key ?? '',
    label: f?.label ?? '',
    type: f?.type ?? 'string',
    required: f?.required ?? true,
    sensitive: f?.sensitive ?? false,
    description: f?.description ?? '',
    pattern: f?.validation?.pattern ?? '',
    minLength: f?.validation?.minLength != null ? String(f.validation.minLength) : '',
    maxLength: f?.validation?.maxLength != null ? String(f.validation.maxLength) : '',
    options: f?.validation?.options?.join(', ') ?? '',
    example: f?.validation?.example ?? '',
    message: f?.validation?.message ?? '',
  }
}

function fromDraft(d: FieldDraft): ServiceField {
  const validation: NonNullable<ServiceField['validation']> = {}
  if (d.pattern.trim()) validation.pattern = d.pattern.trim()
  if (d.minLength.trim()) validation.minLength = Number(d.minLength)
  if (d.maxLength.trim()) validation.maxLength = Number(d.maxLength)
  const opts = d.options
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (opts.length) validation.options = opts
  if (d.example.trim()) validation.example = d.example.trim()
  if (d.message.trim()) validation.message = d.message.trim()
  const out: ServiceField = { key: d.key.trim(), label: d.label.trim(), type: d.type, required: d.required }
  if (d.description.trim()) out.description = d.description.trim()
  if (d.sensitive) out.sensitive = true
  if (Object.keys(validation).length) out.validation = validation
  return out
}

export function safeRegex(p: string): RegExp | null {
  try {
    return new RegExp(p)
  } catch {
    return null
  }
}

/** Add or edit one input field; persists the whole field list on save. */
export function FieldDrawer({ open, onClose, service, field }: { open: boolean; onClose: () => void; service: Service; field: ServiceField | null }) {
  const [d, setD] = useState<FieldDraft>(toDraft())
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    if (open) {
      setD(toDraft(field ?? undefined))
      setTouched(false)
    }
  }, [open, field])

  const set = <K extends keyof FieldDraft>(k: K, v: FieldDraft[K]) => setD((s) => ({ ...s, [k]: v }))
  const others = service.fields.filter((f) => f.key !== field?.key)
  const re = d.pattern.trim() ? safeRegex(d.pattern.trim()) : null
  const errors = {
    key: !/^[a-z][a-z0-9_]{1,39}$/.test(d.key.trim()) ? 'snake_case, starts with a letter (2–40 chars)' : others.some((f) => f.key === d.key.trim()) ? 'Another field already uses this key' : undefined,
    label: d.label.trim().length < 2 ? 'Required' : undefined,
    pattern: d.pattern.trim() && !re ? 'Not a valid regular expression' : undefined,
    minLength: d.minLength && (Number.isNaN(Number(d.minLength)) || Number(d.minLength) < 0) ? 'Number ≥ 0' : undefined,
    maxLength: d.maxLength && (Number.isNaN(Number(d.maxLength)) || (d.minLength !== '' && Number(d.maxLength) < Number(d.minLength))) ? 'Must be ≥ min length' : undefined,
    options: d.type === 'enum' && !d.options.trim() ? 'Enum fields need at least one option' : undefined,
  }
  const valid = !Object.values(errors).some(Boolean)
  const show = (k: keyof typeof errors) => (touched ? errors[k] : undefined)

  const exampleCheck = useMemo(() => {
    const ex = d.example.trim()
    if (!ex) return null
    const opts = d.options
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const checks: { label: string; ok: boolean }[] = []
    if (re) checks.push({ label: 'pattern', ok: re.test(ex) })
    if (d.minLength) checks.push({ label: `≥ ${d.minLength} chars`, ok: ex.length >= Number(d.minLength) })
    if (d.maxLength) checks.push({ label: `≤ ${d.maxLength} chars`, ok: ex.length <= Number(d.maxLength) })
    if (opts.length) checks.push({ label: 'in options', ok: opts.includes(ex) })
    if (isImeiField({ key: d.key.trim(), label: d.label }) && /^\d{15}$/.test(ex)) checks.push({ label: 'Luhn', ok: luhnValid(ex) })
    return checks
  }, [d.example, d.minLength, d.maxLength, d.options, d.key, d.label, re])

  const takenKeys = useMemo(() => new Set(service.fields.filter((f) => f.key !== field?.key).map((f) => f.key)), [service.fields, field])
  const [preset, setPreset] = useState<string | null>(null)
  useEffect(() => {
    if (open) setPreset(null)
  }, [open])
  const togglePreset = (id: string) => {
    const p = presetById(id)
    if (!p || id === preset) {
      setPreset(null)
      setD(toDraft())
      return
    }
    setPreset(id)
    setD(toDraft(p.field))
  }

  const save = useInstMutation(
    () => {
      const next = fromDraft(d)
      const fields = field ? service.fields.map((f) => (f.key === field.key ? next : f)) : [...service.fields, next]
      return servicesService.update(service.id, { fields })
    },
    { success: field ? 'Field updated' : 'Field added', onSuccess: onClose },
  )

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="md"
      icon={field ? <Pencil /> : <ListPlus />}
      title={field ? `Edit field · ${field.key}` : 'Add required field'}
      description="Fields define the order input schema for the website, the Reseller API and provider field maps."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={save.isPending}
            onClick={() => {
              setTouched(true)
              if (valid) save.mutate()
            }}
          >
            {field ? 'Save field' : 'Add field'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {!field && (
          <section className="space-y-2.5">
            <div>
              <h3 className="mono-label">Start from a GSM preset</h3>
              <p className="mt-1 text-[12px] text-fg-3">Pre-fills key, type and validation — IMEI fields are Luhn-checked by Core. Presets for keys this service already uses are disabled.</p>
            </div>
            <PresetPicker selected={preset ? [preset] : []} onToggle={togglePreset} disabledKeys={takenKeys} />
          </section>
        )}
        <section className="space-y-4">
          <h3 className="mono-label">Definition</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Key" error={show('key')} hint="Used in the API payload">
              <Input mono value={d.key} onChange={(e) => set('key', e.target.value)} placeholder="imei" invalid={!!show('key')} />
            </Field>
            <Field label="Label" error={show('label')}>
              <Input value={d.label} onChange={(e) => set('label', e.target.value)} placeholder="IMEI" invalid={!!show('label')} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              <Select value={d.type} onChange={(e) => set('type', e.target.value as ServiceField['type'])} options={FIELD_TYPES.map((t) => ({ value: t, label: t }))} />
            </Field>
            <Field label="Description" optional>
              <Input value={d.description} onChange={(e) => set('description', e.target.value)} placeholder="e.g. Dial *#06# to show the IMEI" />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ToggleRow label="Required" hint="Orders without it are rejected" checked={d.required} onChange={(v) => set('required', v)} />
            <ToggleRow label="Sensitive" hint="Masked in logs & exports" checked={d.sensitive} onChange={(v) => set('sensitive', v)} />
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="mono-label">Validation</h3>
          <Field label="Pattern" optional error={show('pattern')} hint={isImeiField({ key: d.key.trim(), label: d.label }) ? 'Regular expression on the raw value. 15-digit IMEIs also get a Luhn checksum check.' : 'JavaScript regular expression, evaluated on the raw value.'}>
            <Input mono value={d.pattern} onChange={(e) => set('pattern', e.target.value)} placeholder="^\d{15}$" invalid={!!show('pattern')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Min length" optional error={show('minLength')}>
              <Input inputMode="numeric" value={d.minLength} onChange={(e) => set('minLength', e.target.value)} />
            </Field>
            <Field label="Max length" optional error={show('maxLength')}>
              <Input inputMode="numeric" value={d.maxLength} onChange={(e) => set('maxLength', e.target.value)} />
            </Field>
          </div>
          <Field label="Allowed options" optional={d.type !== 'enum'} error={show('options')} hint="Comma separated, e.g. att_us, tmobile_us, verizon_us">
            <Input mono value={d.options} onChange={(e) => set('options', e.target.value)} placeholder="ee_uk, vodafone_uk, o2_uk" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Example" optional hint="Used in generated API docs">
              <Input mono value={d.example} onChange={(e) => set('example', e.target.value)} placeholder="356938035643809" />
            </Field>
            <Field label="Error message" optional>
              <Input value={d.message} onChange={(e) => set('message', e.target.value)} placeholder="e.g. Exactly 15 digits" />
            </Field>
          </div>
          {exampleCheck && exampleCheck.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface-2/50 px-3 py-2">
              <span className="mr-1 text-[12px] text-fg-3">Example passes</span>
              {exampleCheck.map((c) => (
                <Badge key={c.label} tone={c.ok ? 'success' : 'danger'} icon={c.ok ? <CircleCheck /> : <CircleX />}>
                  {c.label}
                </Badge>
              ))}
            </div>
          )}
        </section>
      </div>
    </Drawer>
  )
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 transition-colors', checked ? 'border-accent/30 bg-accent/[0.03]' : 'border-line')}>
      <div className="min-w-0">
        <div className="text-[13px] font-medium">{label}</div>
        <div className="truncate text-[11.5px] text-fg-3">{hint}</div>
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  )
}
