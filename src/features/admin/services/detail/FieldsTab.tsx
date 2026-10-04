import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, CircleCheck, Code2, FileJson, GitCommitVertical, Globe, LayoutDashboard, Pencil, PlugZap, Plus, ShieldCheck, Trash2, X } from 'lucide-react'
import { Badge, Button, Card, CardBody, CardHeader, CodeBlock, Field, Input, Select, Switch, Textarea, Timeline } from '@/components/ui'
import { FieldList, Guarded, PermissionHint, useFieldForm } from '@/components/domain'
import { useInstMutation } from '@/hooks/installation'
import { catalogService } from '@/services/installation'
import { fieldType, inputSchema } from '@/core/fields'
import { GSM_FIELDS } from '@/core/verticals/gsm'
import type { FieldDef, ServiceDetail } from '@/types/installation'
import { cn } from '@/lib/cn'
import { dateTime } from '@/lib/format'

/** Short, human summary of what the server validates for a field. */
function validationSummary(f: FieldDef): string {
  switch (f.type) {
    case 'gsm.imei':
      return '15 digits · Luhn check digit'
    case 'gsm.serial':
      return '8–14 letters / digits'
    case 'gsm.model':
      return '2–40 chars'
    case 'country':
      return 'ISO 3166 alpha-2'
    case 'email':
      return 'Email address'
    case 'phone':
      return 'E.164'
  }
  if (f.options?.length) return `One of ${f.options.length} options`
  const parts = [f.minLength ? `min ${f.minLength}` : null, f.maxLength ? `max ${f.maxLength}` : null, f.pattern ? `/${f.pattern}/` : null].filter(Boolean)
  return parts.length ? parts.join(' · ') : '—'
}

const PRESET_OPTIONS = Object.entries(GSM_FIELDS).map(([k, f]) => ({ value: k, label: `${f.label} — ${f.type}${f.required ? '' : ' (optional)'}` }))

export function FieldsTab({ d }: { d: ServiceDetail }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<FieldDef[]>(d.revision.fields)
  const [note, setNote] = useState('')
  const [preset, setPreset] = useState('')

  const fields = editing ? draft : d.revision.fields
  const schema = useMemo(() => (editing ? inputSchema(draft) : d.inputSchema), [editing, draft, d.inputSchema])
  const dirty = editing && JSON.stringify(draft) !== JSON.stringify(d.revision.fields)

  const publish = useInstMutation(() => catalogService.publishRevision(d.service.id, { fields: draft, note: note.trim() }), {
    success: (r) => `Revision ${r.number} published`,
    onSuccess: () => {
      setEditing(false)
      setNote('')
    },
  })

  const start = () => {
    setDraft(d.revision.fields.map((f) => ({ ...f })))
    setEditing(true)
  }
  const patch = (i: number, p: Partial<FieldDef>) => setDraft((xs) => xs.map((f, j) => (j === i ? { ...f, ...p } : f)))
  const move = (i: number, dir: -1 | 1) =>
    setDraft((xs) => {
      const next = xs.slice()
      const j = i + dir
      if (j < 0 || j >= next.length) return xs
      ;[next[i], next[j]] = [next[j]!, next[i]!]
      return next
    })
  const add = () => {
    const f = GSM_FIELDS[preset as keyof typeof GSM_FIELDS] as FieldDef | undefined
    if (!f) return
    setDraft((xs) => [...xs.filter((x) => x.key !== f.key), { ...f }])
    setPreset('')
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="grid min-w-0 content-start gap-4">
        <Card>
          <CardHeader
            title={editing ? `Editing — will publish revision ${d.revision.number + 1}` : `Revision ${d.revision.number} fields`}
            description={editing ? 'Existing orders keep the revision they were placed with. New orders use the new revision immediately.' : `Published ${dateTime(d.revision.createdAt)} by ${d.revision.createdBy}${d.revision.note ? ` — “${d.revision.note}”` : ''}`}
            actions={
              editing ? (
                <Button size="sm" variant="ghost" leading={<X />} onClick={() => setEditing(false)}>
                  Discard
                </Button>
              ) : (
                <Guarded permission="catalog.manage">
                  {(ok) => (
                    <Button size="sm" leading={<Pencil />} disabled={!ok} onClick={start}>
                      Edit fields
                    </Button>
                  )}
                </Guarded>
              )
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[12.5px]">
              <thead>
                <tr className="border-y border-line text-left text-[11.5px] text-fg-3">
                  <th className="py-2 pr-3 pl-5 font-medium">Key</th>
                  <th className="px-3 py-2 font-medium">Label</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Required</th>
                  <th className="px-3 py-2 font-medium">Validation</th>
                  <th className="px-3 py-2 font-medium">DHRU parameter</th>
                  {editing && <th className="py-2 pr-5 pl-3" />}
                </tr>
              </thead>
              <tbody>
                {fields.map((f, i) => {
                  const t = fieldType(f.type)
                  const dhru = editing ? (t.dhruParam ?? f.key.toUpperCase()) : (d.dhruMapping.find((m) => m.field === f.key)?.dhruParam ?? null)
                  return (
                    <tr key={f.key} className="border-b border-line last:border-0">
                      <td className="py-2 pr-3 pl-5 font-mono text-[12px] text-fg">{f.key}</td>
                      <td className="px-3 py-2">{editing ? <Input inputSize="sm" value={f.label} onChange={(e) => patch(i, { label: e.target.value })} className="w-40" /> : f.label}</td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-[11.5px] text-fg-2">{f.type}</span>
                        {t.packId && <span className="ml-1.5 text-[10.5px] text-fg-3 uppercase">{t.packId}</span>}
                      </td>
                      <td className="px-3 py-2">{editing ? <Switch size="sm" checked={f.required} onChange={(v) => patch(i, { required: v })} label="Required" /> : f.required ? <Badge tone="neutral">Required</Badge> : <span className="text-fg-3">Optional</span>}</td>
                      <td className="px-3 py-2 text-fg-2">{validationSummary(f)}</td>
                      <td className="px-3 py-2">{dhru ? <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11.5px]">{dhru}</span> : <span className="text-fg-3">—</span>}</td>
                      {editing && (
                        <td className="py-2 pr-5 pl-3">
                          <div className="flex justify-end gap-0.5">
                            <Button size="xs" variant="ghost" icon disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                              <ArrowUp />
                            </Button>
                            <Button size="xs" variant="ghost" icon disabled={i === fields.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                              <ArrowDown />
                            </Button>
                            <Button size="xs" variant="ghost" icon disabled={fields.length <= 1} onClick={() => setDraft((xs) => xs.filter((_, j) => j !== i))} aria-label="Remove field">
                              <Trash2 />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {editing && (
            <div className="space-y-3 border-t border-line px-5 py-4">
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Add a GSM pack field" className="min-w-[260px] flex-1">
                  <Select inputSize="sm" value={preset} onChange={(e) => setPreset(e.target.value)} options={[{ value: '', label: 'Choose a field preset…' }, ...PRESET_OPTIONS]} />
                </Field>
                <Button size="sm" leading={<Plus />} disabled={!preset} onClick={add}>
                  Add field
                </Button>
              </div>
              <Field label="Revision note" hint="Shown in the revision history and the audit log.">
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Model is now optional — suppliers derive it from the IMEI" className="min-h-14" />
              </Field>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <PermissionHint permission="catalog.manage" />
                <Button variant="accent" size="sm" disabled={!dirty || note.trim().length < 3} loading={publish.isPending} onClick={() => publish.mutate()}>
                  Publish revision {d.revision.number + 1}
                </Button>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="One definition, five consumers" description="The field list above is the only place fields are defined. Nothing is copied." />
          <CardBody className="grid gap-2 sm:grid-cols-5">
            <Consumer icon={<Globe />} label="Storefront form" detail="Rendered from the revision" />
            <Consumer icon={<LayoutDashboard />} label="Portal form" detail="Same fields, bulk paste for IMEIs" />
            <Consumer icon={<Code2 />} label="API schema" detail="JSON schema in /v1/services" />
            <Consumer icon={<ShieldCheck />} label="Validation" detail="Same rules in browser and PlaceOrder" />
            <Consumer icon={<PlugZap />} label="DHRU mapping" detail="IMEI · MODELID · PROVIDERID · SN" />
          </CardBody>
        </Card>

        <CodeBlock title={<span className="inline-flex items-center gap-1.5"><FileJson className="size-3.5" />input schema · revision {editing ? `${d.revision.number + 1} (draft)` : d.revision.number}</span>} lang="json" code={JSON.stringify(schema, null, 2)} maxHeight={360} />
      </div>

      <div className="grid content-start gap-4">
        <TryForm key={fields.map((f) => f.key).join(',')} fields={fields} draft={editing} />

        <Card>
          <CardHeader title="Revision history" description="Orders snapshot the revision they used." icon={<GitCommitVertical />} />
          <CardBody>
            <Timeline
              items={d.revisions.map((r) => ({
                id: r.id,
                tone: r.id === d.revision.id ? 'accent' : 'neutral',
                title: (
                  <span className="flex items-center gap-2">
                    Revision {r.number}
                    {r.id === d.revision.id && (
                      <Badge tone="accent" size="sm">
                        current
                      </Badge>
                    )}
                  </span>
                ),
                time: dateTime(r.createdAt),
                detail: (
                  <div>
                    <div>{r.note || 'No note'}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.fields.map((f) => (
                        <span key={f.key} className="rounded bg-surface-2 px-1.5 py-px font-mono text-[10.5px] text-fg-2">
                          {f.key}
                          {f.required ? '' : '?'}
                        </span>
                      ))}
                    </div>
                    <div className="mt-1 text-[11px]">by {r.createdBy}</div>
                  </div>
                ),
              }))}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function Consumer({ icon, label, detail }: { icon: ReactNode; label: string; detail: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/40 p-3">
      <div className="mb-2 grid size-7 place-items-center rounded-md border border-line bg-surface text-fg-2 [&_svg]:size-3.5">{icon}</div>
      <div className="text-[12.5px] font-medium">{label}</div>
      <div className="text-[11.5px] text-fg-3">{detail}</div>
    </div>
  )
}

function TryForm({ fields, draft }: { fields: FieldDef[]; draft: boolean }) {
  const hasImei = fields.some((f) => f.key === 'imei')
  const sample = (imei: string): Record<string, string> => (hasImei ? { imei } : {})
  const form = useFieldForm(fields, sample('356938035643809'))
  return (
    <Card className={cn(draft && 'border-accent/40')}>
      <CardHeader
        title="Try the form"
        description={draft ? 'Live preview of the draft revision.' : 'Exactly what customers fill in — same validation as the server.'}
        actions={
          form.valid ? (
            <Badge tone="success" icon={<CircleCheck />}>
              Valid
            </Badge>
          ) : (
            <Badge tone="neutral">{Object.keys(form.errors).length} to fix</Badge>
          )
        }
      />
      <CardBody>
        <FieldList fields={fields} form={form} />
        <div className="mt-4 flex gap-2">
          {hasImei && (
            <>
              <Button size="sm" variant="ghost" onClick={() => form.reset(sample('356938035643809'))}>
                Valid sample
              </Button>
              <Button size="sm" variant="ghost" onClick={() => form.reset(sample('356938035643808'))}>
                Bad Luhn
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={() => form.submit()} className="ml-auto">
            Validate
          </Button>
        </div>
        <div className="mt-3">
          <div className="mono-label mb-1.5">Normalised input → order</div>
          <CodeBlock lang="json" code={JSON.stringify(form.normalized, null, 2)} className="text-[11.5px]" />
        </div>
      </CardBody>
    </Card>
  )
}
