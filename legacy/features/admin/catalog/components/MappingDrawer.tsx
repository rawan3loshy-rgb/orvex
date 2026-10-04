import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Trash2, Wand2, Workflow } from 'lucide-react'
import { ProviderMark, ServiceIcon } from '@/components/brand'
import { Badge, Button, ConfirmDialog, Drawer, Field, Input, Select, Switch } from '@/components/ui'
import { useInstMutation, useMappings } from '@/hooks/installation'
import { mappingsService } from '@/services/installation'
import { cn } from '@/lib/cn'
import { money, pct } from '@/lib/format'
import type { ServiceMapping } from '@/types/installation'
import { Callout, margin, marginTone, useProviderMap, useServiceMap } from './shared'

export type MappingDrawerState = { mode: 'edit'; mapping: ServiceMapping } | { mode: 'create'; serviceId?: string; providerId?: string } | null

interface FormState {
  serviceId: string
  providerId: string
  externalId: string
  externalName: string
  cost: string
  timeoutMs: string
  weight: string
  enabled: boolean
  fieldMap: Record<string, string>
}

const EMPTY: FormState = { serviceId: '', providerId: '', externalId: '', externalName: '', cost: '', timeoutMs: '30000', weight: '10', enabled: true, fieldMap: {} }

const camel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())

/** Key convention each adapter family expects (DHRU-style XML gateways use upper-case keys). */
function conventionFor(protocol: string | undefined) {
  if (protocol === 'SOAP / XML') return { label: 'UPPER_CASE (DHRU-style XML)', apply: (k: string) => k.toUpperCase() }
  if (protocol === 'GraphQL') return { label: 'camelCase (GraphQL)', apply: camel }
  return { label: 'snake_case (REST / JSON)', apply: (k: string) => k }
}

/** Create or edit a service ↔ provider mapping. */
export function MappingDrawer({ state, onClose }: { state: MappingDrawerState; onClose: () => void }) {
  const { map: services, data: serviceList } = useServiceMap()
  const { map: providers, data: providerList } = useProviderMap()
  const all = useMappings()
  const [f, setF] = useState<FormState>(EMPTY)
  const [touched, setTouched] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const open = !!state
  const editing = state?.mode === 'edit' ? state.mapping : null

  const mappedFor = useMemo(() => new Set((all.data ?? []).filter((m) => m.serviceId === f.serviceId).map((m) => m.providerId)), [all.data, f.serviceId])

  // Initialise the form whenever the drawer opens with a new target.
  useEffect(() => {
    if (!state) return
    setTouched(false)
    if (state.mode === 'edit') {
      const m = state.mapping
      setF({ serviceId: m.serviceId, providerId: m.providerId, externalId: m.externalId, externalName: m.externalName, cost: String(m.cost), timeoutMs: String(m.timeoutMs), weight: String(m.weight), enabled: m.enabled, fieldMap: { ...m.fieldMap } })
    } else {
      const svc = services.get(state.serviceId ?? '') ?? serviceList?.[0]
      const taken = new Set((all.data ?? []).filter((m) => m.serviceId === svc?.id).map((m) => m.providerId))
      const prv = state.providerId ?? providerList?.find((p) => !taken.has(p.id))?.id ?? ''
      setF({
        ...EMPTY,
        serviceId: svc?.id ?? '',
        providerId: prv,
        externalName: svc?.name ?? '',
        cost: svc ? String(+(svc.price * 0.45).toFixed(2)) : '',
        timeoutMs: svc?.delivery === 'instant' ? '15000' : '30000',
        fieldMap: Object.fromEntries((svc?.fields ?? []).map((x) => [x.key, x.key])),
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const svc = services.get(f.serviceId)
  const prv = providers.get(f.providerId)
  const cost = Number(f.cost)
  const timeout = Number(f.timeoutMs)
  const weight = Number(f.weight)
  const errors = {
    serviceId: !f.serviceId ? 'Choose a service' : undefined,
    providerId: !f.providerId ? 'Choose a supplier' : !editing && mappedFor.has(f.providerId) ? 'Already mapped to this service' : undefined,
    externalId: !f.externalId.trim() ? 'Required — the supplier’s own service ID' : !/^[\w.:-]{1,40}$/.test(f.externalId.trim()) ? 'Letters, digits, dot, dash or underscore' : undefined,
    cost: f.cost === '' || Number.isNaN(cost) || cost < 0 ? 'Enter a cost ≥ 0' : undefined,
    timeoutMs: Number.isNaN(timeout) || timeout < 1000 || timeout > 120000 ? '1,000 – 120,000 ms' : undefined,
    weight: Number.isNaN(weight) || weight < 0 || weight > 100 ? '0 – 100' : undefined,
  }
  const valid = !Object.values(errors).some(Boolean)
  const show = (k: keyof typeof errors) => (touched ? errors[k] : undefined)
  const m = svc ? margin(svc.price, Number.isNaN(cost) ? 0 : cost) : null
  const sampleExt = (all.data ?? []).find((x) => x.providerId === f.providerId)?.externalId
  const convention = conventionFor(prv?.protocol)

  const save = useInstMutation(
    async () => {
      const body = { externalId: f.externalId.trim(), externalName: f.externalName.trim() || svc?.name, cost, timeoutMs: timeout, weight, enabled: f.enabled, fieldMap: f.fieldMap }
      if (editing) return mappingsService.update(editing.id, body)
      const created = await mappingsService.create({ serviceId: f.serviceId, providerId: f.providerId, externalId: body.externalId, externalName: body.externalName, cost, timeoutMs: timeout })
      return mappingsService.update(created.id, { weight, enabled: f.enabled, fieldMap: f.fieldMap })
    },
    { success: editing ? 'Mapping saved' : 'Provider mapped', onSuccess: () => onClose() },
  )
  const remove = useInstMutation(() => mappingsService.remove(editing!.id), {
    success: 'Mapping removed',
    onSuccess: () => {
      setConfirmRemove(false)
      onClose()
    },
  })

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }))

  const onServiceChange = (id: string) => {
    const s = services.get(id)
    const taken = new Set((all.data ?? []).filter((x) => x.serviceId === id).map((x) => x.providerId))
    setF((st) => ({
      ...st,
      serviceId: id,
      providerId: st.providerId && !taken.has(st.providerId) ? st.providerId : (providerList?.find((p) => !taken.has(p.id))?.id ?? ''),
      externalName: s?.name ?? '',
      cost: s ? String(+(s.price * 0.45).toFixed(2)) : st.cost,
      fieldMap: Object.fromEntries((s?.fields ?? []).map((x) => [x.key, x.key])),
    }))
  }

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        width="md"
        icon={<Workflow />}
        title={editing ? 'Edit mapping' : 'Map a supplier service'}
        description={editing ? `${svc?.name ?? editing.serviceId} → ${prv?.shortName ?? editing.providerId} #${editing.externalId}` : 'Connect an internal service to a supplier’s own service ID.'}
        footer={
          <>
            {editing && (
              <Button variant="ghost" className="mr-auto text-danger hover:bg-danger/10 hover:text-danger" leading={<Trash2 />} onClick={() => setConfirmRemove(true)}>
                Remove
              </Button>
            )}
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
              {editing ? 'Save mapping' : 'Create mapping'}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          {/* Link summary */}
          <div className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-line bg-surface-2/50 p-3.5">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              {svc ? <ServiceIcon icon={svc.icon} category={svc.category} size="sm" /> : <span className="size-7 rounded-md bg-surface-3" />}
              <div className="min-w-0">
                <div className="mono-label">Internal</div>
                <div className="truncate text-[13px] font-medium">{svc?.name ?? 'Select a service'}</div>
              </div>
            </div>
            <ArrowRight className="size-4 shrink-0 text-fg-3" />
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              {prv ? <ProviderMark id={prv.id} name={prv.name} size="sm" /> : <span className="size-6 rounded-md bg-surface-3" />}
              <div className="min-w-0">
                <div className="mono-label">Supplier{f.externalId.trim() ? ` · #${f.externalId.trim()}` : ''}</div>
                <div className="truncate text-[13px] font-medium">{prv?.name ?? 'Select a supplier'}</div>
              </div>
            </div>
          </div>

          {!editing && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Internal service" error={show('serviceId')}>
                <Select value={f.serviceId} onChange={(e) => onServiceChange(e.target.value)} options={(serviceList ?? []).map((s) => ({ value: s.id, label: `${s.name} · ${s.id}` }))} />
              </Field>
              <Field label="Supplier" error={show('providerId')}>
                <Select
                  value={f.providerId}
                  onChange={(e) => set('providerId', e.target.value)}
                  options={[{ value: '', label: 'Select supplier…' }, ...(providerList ?? []).map((p) => ({ value: p.id, label: mappedFor.has(p.id) ? `${p.name} (already mapped)` : p.status !== 'operational' ? `${p.name} — ${p.status}` : p.name }))]}
                />
              </Field>
            </div>
          )}

          <section className="space-y-4">
            <h3 className="mono-label">Supplier service</h3>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <Field label="Supplier service ID" error={show('externalId')} hint={`As listed in ${prv?.shortName ?? 'the supplier'}’s service list${sampleExt ? ` — e.g. ${sampleExt}` : ''}.`}>
                <Input mono value={f.externalId} onChange={(e) => set('externalId', e.target.value)} placeholder={sampleExt ? `e.g. ${sampleExt}` : 'e.g. 312'} invalid={!!show('externalId')} />
              </Field>
              <Field label="External name" optional>
                <Input value={f.externalName} onChange={(e) => set('externalName', e.target.value)} placeholder={svc?.name} />
              </Field>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="mono-label">Commercials &amp; delivery</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Supplier cost" error={show('cost')}>
                <Input leading={<span className="text-[13px]">$</span>} inputMode="decimal" value={f.cost} onChange={(e) => set('cost', e.target.value)} invalid={!!show('cost')} className="tabular" />
              </Field>
              <Field label="Timeout" error={show('timeoutMs')} hint="Then fail over">
                <Input inputMode="numeric" value={f.timeoutMs} onChange={(e) => set('timeoutMs', e.target.value)} trailing={<span className="text-[12px]">ms</span>} invalid={!!show('timeoutMs')} />
              </Field>
              <Field label="Weight" error={show('weight')} hint="Round robin share">
                <Input inputMode="numeric" value={f.weight} onChange={(e) => set('weight', e.target.value)} trailing={<span className="text-[12px]">%</span>} invalid={!!show('weight')} />
              </Field>
            </div>
            {svc && m && (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-line bg-surface-2/50 px-4 py-3 text-[12.5px]">
                <span className="text-fg-3">
                  Public price <span className="font-medium text-fg tabular">{money(svc.price)}</span>
                </span>
                <span className="text-fg-3">
                  Margin <span className={cn('font-medium tabular', m.abs < 0 ? 'text-danger' : 'text-fg')}>{money(m.abs)}</span>
                </span>
                <Badge tone={marginTone(m.pct)}>{pct(m.pct)} margin</Badge>
                <span className="text-fg-3">
                  Markup <span className="font-medium text-fg tabular">{pct(m.markup)}</span>
                </span>
              </div>
            )}
            {svc && m && m.abs < 0 && (
              <Callout tone="danger" title="Cost exceeds the public price">
                Every order routed to {prv?.shortName ?? 'this supplier'} would lose {money(-m.abs)}. Raise the service price or choose a cheaper supplier service.
              </Callout>
            )}
            <div className="flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3">
              <div>
                <div className="text-[13px] font-medium">Enabled</div>
                <div className="text-[12px] text-fg-3">Disabled mappings stay configured but are skipped by the routing engine — useful while a supplier is degraded.</div>
              </div>
              <Switch checked={f.enabled} onChange={(v) => set('enabled', v)} label="Enabled" />
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <h3 className="mono-label">Field map</h3>
                <p className="mt-1 text-[12px] text-fg-3">
                  Core’s normalised input keys → the keys {prv?.shortName ?? 'the supplier'} expects. The adapter applies this map before submission{prv ? ` · convention ${convention.label}` : ''}.
                </p>
              </div>
              {svc && svc.fields.length > 0 && prv && (
                <Button size="xs" variant="ghost" leading={<Wand2 />} onClick={() => setF((st) => ({ ...st, fieldMap: Object.fromEntries(svc.fields.map((x) => [x.key, convention.apply(x.key)])) }))} className="shrink-0">
                  Apply convention
                </Button>
              )}
            </div>
            {svc && svc.fields.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-line">
                {svc.fields.map((fd) => (
                  <div key={fd.key} className="grid grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)] items-center gap-2 border-b border-line px-3 py-2 last:border-0">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-[12px] text-fg">{fd.key}</div>
                      <div className="truncate text-[11px] text-fg-3">
                        {fd.label}
                        {fd.required ? ' · required' : ''}
                      </div>
                    </div>
                    <ArrowRight className="size-3.5 text-fg-3" />
                    <Input
                      inputSize="sm"
                      mono
                      value={f.fieldMap[fd.key] ?? ''}
                      placeholder={fd.key}
                      onChange={(e) => setF((s) => ({ ...s, fieldMap: { ...s.fieldMap, [fd.key]: e.target.value } }))}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-[12.5px] text-fg-3">This service has no input fields to map.</p>
            )}
          </section>
        </div>
      </Drawer>
      <ConfirmDialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        tone="danger"
        confirmLabel="Remove mapping"
        title="Remove this mapping?"
        description={`${prv?.name ?? 'The supplier'} will no longer receive ${svc?.name ?? 'this service'} orders. Remaining suppliers are re-prioritised automatically.`}
      />
    </>
  )
}
