import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, ChevronUp, CircleCheck, CircleDashed, CircleX, Eraser, FlaskConical, ListChecks, Lock, Pencil, Plus, Send, Sparkles, Trash2, Wand2 } from 'lucide-react'
import { Badge, Button, Card, CardHeader, CodeBlock, ConfirmDialog, EmptyState, Input, Select, Tooltip } from '@/components/ui'
import { useInstMutation } from '@/hooks/installation'
import { ordersService, servicesService } from '@/services/installation'
import { cn } from '@/lib/cn'
import type { Service, ServiceField } from '@/types/installation'
import { exampleValue } from '../examples'
import { isImeiField, luhnValid } from '../fieldPresets'
import { FieldDrawer, safeRegex } from '../ServiceForms'
import { Callout } from '../shared'

/* ------------------------------------------------------------------------- */
/*  Schema table                                                             */
/* ------------------------------------------------------------------------- */

export function FieldsTab({ service: s }: { service: Service }) {
  const [drawer, setDrawer] = useState<{ open: boolean; field: ServiceField | null }>({ open: false, field: null })
  const [removing, setRemoving] = useState<ServiceField | null>(null)
  const update = useInstMutation((fields: ServiceField[]) => servicesService.update(s.id, { fields }), { success: 'Input schema updated' })
  const remove = useInstMutation((key: string) => servicesService.update(s.id, { fields: s.fields.filter((f) => f.key !== key) }), {
    success: 'Field removed',
    onSuccess: () => setRemoving(null),
  })

  const move = (i: number, dir: -1 | 1) => {
    const next = s.fields.slice()
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j]!, next[i]!]
    update.mutate(next)
  }

  const required = s.fields.filter((f) => f.required).length
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader
          icon={<ListChecks />}
          title="Required fields"
          description={`${s.fields.length} field${s.fields.length === 1 ? '' : 's'} · ${required} required · validated by Core before an order is charged or routed.`}
          actions={
            <Button size="sm" variant="secondary" leading={<Plus />} onClick={() => setDrawer({ open: true, field: null })}>
              Add field
            </Button>
          }
        />
        {s.fields.length ? (
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full min-w-[920px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[11.5px] text-fg-3">
                  <th className="w-[56px] py-2.5 pl-5 font-medium">#</th>
                  <th className="px-3 py-2.5 font-medium">Key</th>
                  <th className="px-3 py-2.5 font-medium">Label</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 font-medium">Required</th>
                  <th className="px-3 py-2.5 font-medium">Validation</th>
                  <th className="px-3 py-2.5 text-center font-medium">Sensitive</th>
                  <th className="w-[84px] py-2.5 pr-5" />
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {s.fields.map((f, i) => (
                    <motion.tr key={f.key} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="group border-b border-line align-top last:border-0 hover:bg-surface-2/50">
                      <td className="py-3 pl-5">
                        <div className="flex items-center gap-0.5">
                          <span className="w-4 font-mono text-[11.5px] text-fg-3 tabular">{i + 1}</span>
                          <div className="flex flex-col opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                            <button type="button" disabled={i === 0 || update.isPending} onClick={() => move(i, -1)} className="text-fg-3 hover:text-fg disabled:opacity-30" aria-label="Move up">
                              <ChevronUp className="size-3.5" />
                            </button>
                            <button type="button" disabled={i === s.fields.length - 1 || update.isPending} onClick={() => move(i, 1)} className="text-fg-3 hover:text-fg disabled:opacity-30" aria-label="Move down">
                              <ChevronDown className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-mono text-[12.5px] text-fg">{f.key}</div>
                        {f.description && <div className="mt-0.5 max-w-[240px] text-[11.5px] leading-snug text-fg-3">{f.description}</div>}
                      </td>
                      <td className="px-3 py-3 text-fg-2">{f.label}</td>
                      <td className="px-3 py-3">
                        <span className="rounded-md bg-surface-3 px-1.5 py-0.5 font-mono text-[11.5px] text-fg-2">{f.type}</span>
                      </td>
                      <td className="px-3 py-3">{f.required ? <Badge dot>Required</Badge> : <span className="text-[12px] text-fg-3">Optional</span>}</td>
                      <td className="px-3 py-3">
                        <ValidationChips field={f} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        {f.sensitive ? (
                          <Tooltip content="Masked in logs, exports and webhook payload previews">
                            <Lock className="mx-auto size-3.5 text-warning" />
                          </Tooltip>
                        ) : (
                          <span className="text-fg-3">—</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-5 text-right">
                        <div className="inline-flex gap-0.5">
                          <Button variant="ghost" size="xs" icon aria-label={`Edit ${f.key}`} onClick={() => setDrawer({ open: true, field: f })}>
                            <Pencil />
                          </Button>
                          <Button variant="ghost" size="xs" icon aria-label={`Remove ${f.key}`} className="hover:bg-danger/10 hover:text-danger" onClick={() => setRemoving(f)}>
                            <Trash2 />
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            className="border-t border-line"
            icon={<ListChecks />}
            title="No input fields yet"
            description="Define what customers must provide when ordering. Fields drive the website form, the API schema and supplier field maps."
            action={
              <Button size="sm" variant="primary" leading={<Plus />} onClick={() => setDrawer({ open: true, field: null })}>
                Add first field
              </Button>
            }
          />
        )}
      </Card>
      <Callout tone="neutral">
        IMEI fields are normalised (spaces and dashes stripped) and Luhn-checked by the <span className="font-medium text-fg">IMEI &amp; Serial Field Types</span> extension before an order is charged. Renaming a key does not rewrite supplier field maps — review <span className="font-medium text-fg">Supplier mappings</span> after changing keys. Schema changes apply to new orders; in-flight orders keep the schema they were validated with.
      </Callout>
      <FieldDrawer open={drawer.open} field={drawer.field} service={s} onClose={() => setDrawer({ open: false, field: null })} />
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing.key)}
        loading={remove.isPending}
        tone="danger"
        confirmLabel="Remove field"
        title={`Remove ${removing?.key}?`}
        description="API clients still sending this field will have it ignored. Required-field validation for it stops immediately."
      />
    </div>
  )
}

function ValidationChips({ field: f }: { field: ServiceField }) {
  const v = f.validation
  if (!v || !Object.keys(v).length) return <span className="text-[12px] text-fg-3">Any value</span>
  const len = v.minLength != null || v.maxLength != null ? (v.minLength === v.maxLength ? `${v.minLength} chars` : `${v.minLength ?? 0}–${v.maxLength ?? '∞'} chars`) : null
  return (
    <div className="flex max-w-[340px] flex-wrap gap-1">
      {v.pattern && (
        <Tooltip content={<span className="font-mono">{v.pattern}</span>}>
          <span className="max-w-[180px] truncate rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-fg-2">/{v.pattern}/</span>
        </Tooltip>
      )}
      {len && <span className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] text-fg-2">{len}</span>}
      {v.options && (
        <Tooltip content={v.options.join(', ')}>
          <span className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] text-fg-2">{v.options.length} options</span>
        </Tooltip>
      )}
      {isImeiField(f) && (
        <Tooltip content="Last digit is a Luhn check digit — mistyped IMEIs are rejected before routing">
          <span className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] text-fg-2">Luhn</span>
        </Tooltip>
      )}
      {v.example && <span className="rounded-md bg-surface-3 px-1.5 py-0.5 font-mono text-[11px] text-fg-2">e.g. {v.example}</span>}
      {v.message && (
        <Tooltip content={`Error message: “${v.message}”`}>
          <span className="rounded-md border border-dashed border-line-strong px-1.5 py-0.5 text-[11px] text-fg-3">msg</span>
        </Tooltip>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/*  Validation tester                                                        */
/* ------------------------------------------------------------------------- */

interface RuleCheck {
  id: string
  label: string
  ok: boolean | null
}

export function checkField(f: ServiceField, raw: string): RuleCheck[] {
  const v = raw ?? ''
  const empty = v.trim() === ''
  const out: RuleCheck[] = [{ id: 'required', label: f.required ? 'Required' : 'Optional', ok: f.required ? !empty : null }]
  const skip = empty
  const val = f.validation
  if (val?.pattern) {
    const re = safeRegex(val.pattern)
    out.push({ id: 'pattern', label: 'Pattern', ok: skip || !re ? null : re.test(v) })
  }
  if (val?.minLength != null) out.push({ id: 'min', label: `≥ ${val.minLength} chars`, ok: skip ? null : v.length >= val.minLength })
  if (val?.maxLength != null) out.push({ id: 'max', label: `≤ ${val.maxLength} chars`, ok: skip ? null : v.length <= val.maxLength })
  if (val?.options?.length) out.push({ id: 'options', label: `One of ${val.options.length}`, ok: skip ? null : val.options.includes(v) })
  // IMEI: the 15th digit is a Luhn check digit (IMEI-or-serial fields only check numeric values).
  if (isImeiField(f)) {
    const numeric = /^\d{15}$/.test(v)
    out.push({ id: 'luhn', label: 'Luhn checksum', ok: skip || (!numeric && !/^\d+$/.test(v)) ? null : numeric && luhnValid(v) })
  }
  return out
}

function invalidSample(f: ServiceField) {
  // A 15-digit IMEI with a wrong check digit: passes the pattern, fails Luhn.
  if (isImeiField(f)) return '356938035643808'
  if (f.validation?.options?.length) return 'unknown_network'
  if (f.validation?.pattern) return f.type === 'phone' ? '07700 900123' : f.type === 'date' ? '15/01/2026' : f.type === 'country' ? 'France' : 'sm s918b!'
  if (f.validation?.minLength) return 'x'
  return ''
}

export function ValidationTab({ service: s }: { service: Service }) {
  const navigate = useNavigate()
  const [values, setValues] = useState<Record<string, string>>({})
  const results = useMemo(() => s.fields.map((f) => ({ f, checks: checkField(f, values[f.key] ?? '') })), [s.fields, values])
  const failing = results.filter((r) => r.checks.some((c) => c.ok === false))
  const touched = Object.values(values).some((v) => v !== '')
  const allPass = failing.length === 0 && results.every((r) => r.checks.every((c) => c.ok !== false))
  const payload = useMemo(() => JSON.stringify({ service_id: s.id, fields: Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '')) }, null, 2), [s.id, values])

  const place = useInstMutation(() => ordersService.create({ serviceId: s.id, input: Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '')) }), {
    success: (o) => `Test order #${o.number} created`,
    onSuccess: (o) => navigate(`/admin/orders/${o.id}`),
  })

  const canPlace = allPass && s.status === 'active' && s.providersCount > 0

  if (!s.fields.length) {
    return (
      <Card>
        <EmptyState icon={<FlaskConical />} title="Nothing to validate" description="This service has no input fields. Add fields on the Required fields tab to generate a test form." />
      </Card>
    )
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <Card className="overflow-hidden">
        <CardHeader
          icon={<FlaskConical />}
          title="Test input"
          description="A live form generated from the schema. Rules — including the IMEI Luhn checksum — run on every keystroke exactly as Core runs them server-side."
          actions={
            <>
              <Button size="sm" variant="ghost" leading={<Wand2 />} onClick={() => setValues(Object.fromEntries(s.fields.map((f) => [f.key, exampleValue(f)])))}>
                <span className="hidden sm:inline">Examples</span>
              </Button>
              <Button size="sm" variant="ghost" leading={<Sparkles />} onClick={() => setValues(Object.fromEntries(s.fields.map((f) => [f.key, invalidSample(f)])))}>
                <span className="hidden sm:inline">Invalid</span>
              </Button>
              <Button size="sm" variant="ghost" icon aria-label="Clear" onClick={() => setValues({})}>
                <Eraser />
              </Button>
            </>
          }
        />
        <div className="divide-y divide-line border-t border-line">
          {results.map(({ f, checks }) => {
            const bad = checks.some((c) => c.ok === false)
            const good = checks.every((c) => c.ok !== false) && checks.some((c) => c.ok === true)
            const opts = f.validation?.options
            const value = values[f.key] ?? ''
            return (
              <div key={f.key} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
                <div className="min-w-0">
                  <label htmlFor={`vt-${f.key}`} className="flex items-center gap-2 text-[13px] font-medium">
                    {f.label}
                    {f.required && <span className="text-danger">*</span>}
                    {f.sensitive && <Lock className="size-3 text-fg-3" />}
                  </label>
                  <div className="mt-0.5 font-mono text-[11px] text-fg-3">{f.key}</div>
                  <div className="mt-2">
                    {opts && (f.type === 'enum' || f.type === 'country') ? (
                      <Select id={`vt-${f.key}`} value={value} invalid={bad} onChange={(e) => setValues((st) => ({ ...st, [f.key]: e.target.value }))} options={[{ value: '', label: 'Select…' }, ...opts.map((o) => ({ value: o, label: o }))]} />
                    ) : (
                      <Input
                        id={`vt-${f.key}`}
                        mono={!!f.validation?.pattern}
                        value={value}
                        invalid={bad}
                        placeholder={f.validation?.example ?? ''}
                        onChange={(e) => setValues((st) => ({ ...st, [f.key]: e.target.value }))}
                        trailing={good ? <CircleCheck className="text-success" /> : bad ? <CircleX className="text-danger" /> : undefined}
                      />
                    )}
                  </div>
                  <AnimatePresence>{bad && f.validation?.message && <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-1.5 text-[12px] text-danger">{f.validation.message}</motion.p>}</AnimatePresence>
                </div>
                <div className="flex flex-wrap gap-1.5 md:justify-end md:pt-6">
                  {checks.map((c) => (
                    <span
                      key={c.id}
                      className={cn(
                        'inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11.5px] font-medium ring-1 ring-inset transition-colors',
                        c.ok === true && 'bg-success/10 text-success ring-success/20',
                        c.ok === false && 'bg-danger/10 text-danger ring-danger/20',
                        c.ok === null && 'bg-fg/[0.04] text-fg-3 ring-line',
                      )}
                    >
                      {c.ok === true ? <CircleCheck className="size-3" /> : c.ok === false ? <CircleX className="size-3" /> : <CircleDashed className="size-3" />}
                      {c.label}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <motion.div
          key={allPass ? 'pass' : 'fail'}
          initial={{ opacity: 0.6, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn('rounded-xl border p-4', allPass && touched ? 'border-success/30 bg-success/[0.06]' : failing.length ? 'border-danger/25 bg-danger/[0.05]' : 'border-line bg-surface')}
        >
          <div className="flex items-center gap-2.5">
            {allPass && touched ? <CircleCheck className="size-5 text-success" /> : failing.length ? <CircleX className="size-5 text-danger" /> : <CircleDashed className="size-5 text-fg-3" />}
            <div>
              <div className="text-[13.5px] font-semibold">{allPass && touched ? 'Payload accepted' : failing.length ? `${failing.length} field${failing.length === 1 ? '' : 's'} failing` : 'Waiting for input'}</div>
              <div className="text-[12px] text-fg-3">{allPass && touched ? 'Core would charge and route this order.' : failing.length ? 'The API would answer 422 validation_failed.' : 'Fill the form or load the examples.'}</div>
            </div>
          </div>
          {failing.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-danger/15 pt-3">
              {failing.map(({ f, checks }) => (
                <li key={f.key} className="flex items-baseline gap-2 text-[12px]">
                  <span className="font-mono text-fg">{f.key}</span>
                  <span className="text-fg-3">{f.validation?.message ?? checks.filter((c) => c.ok === false).map((c) => c.label.toLowerCase()).join(', ')}</span>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
        <CodeBlock title="POST /api/v1/orders" code={payload} lang="json" maxHeight={280} />
        <div className="rounded-xl border border-line bg-surface p-4">
          <Tooltip className="flex w-full" content={!allPass ? 'Fix failing fields first' : s.status !== 'active' ? `Service is ${s.status}` : s.providersCount === 0 ? 'No supplier mapped' : 'Creates a real order on the admin channel'}>
            <span className="block w-full">
              <Button variant="primary" className="w-full" leading={<Send />} disabled={!canPlace || !touched} loading={place.isPending} onClick={() => place.mutate()}>
                Place test order
              </Button>
            </span>
          </Tooltip>
          <p className="mt-2 text-[11.5px] leading-relaxed text-fg-3">Runs the full pipeline — validate (incl. IMEI Luhn), charge, route, submit to the supplier — on the admin channel. No reseller balance is touched.</p>
        </div>
      </div>
    </div>
  )
}
