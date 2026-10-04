import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Check, Plus, SlidersHorizontal, Trash2, Wand2 } from 'lucide-react'
import { ServiceIcon, categoryColor } from '@/components/brand'
import { Button, Drawer, Field, Input, SearchInput, Segmented, Select, Switch, Textarea } from '@/components/ui'
import { useInstMutation } from '@/hooks/installation'
import { routingService } from '@/services/installation'
import { cn } from '@/lib/cn'
import type { RoutingAction, RoutingCondition, RoutingConditionField, RoutingRule, RoutingStrategy, ServiceCategory } from '@/types/installation'
import { ACTIONS, ActionPill, CATEGORIES, CONDITION_FIELDS, OPERATORS, STRATEGIES, STRATEGY_ORDER, actionText, conditionText, scopeText, useProviderMap, useServiceMap } from './shared'

let uidSeq = 1
const uid = () => uidSeq++

interface CondDraft {
  uid: number
  field: RoutingConditionField
  operator: RoutingCondition['operator']
  value: string
}

type ScopeMode = 'all' | 'categories' | 'services'

/** GSM starting points for a new rule — each fills the whole form and stays editable. */
const TEMPLATES: { id: string; label: string; name: string; description: string; scope: { mode: ScopeMode; categories?: ServiceCategory[]; serviceIds?: string[] }; conds: Omit<CondDraft, 'uid'>[]; action: RoutingAction }[] = [
  {
    id: 'skip-degraded',
    label: 'Skip degraded suppliers',
    name: 'Skip suppliers below 95% health',
    description: 'Remove any supplier whose 15-minute success rate drops below 95% so orders fail over before they time out.',
    scope: { mode: 'all' },
    conds: [{ field: 'provider.health', operator: 'lt', value: '95' }],
    action: { type: 'exclude_provider' },
  },
  {
    id: 'uk-unlocks',
    label: 'UK unlocks → Global Unlock',
    name: 'UK unlocks prefer Global Unlock',
    description: 'Send unlock orders for UK networks (EE, Vodafone, O2, Three) to Global Unlock Provider first.',
    scope: { mode: 'categories', categories: ['Unlocking'] },
    conds: [{ field: 'order.country', operator: 'in', value: 'GB' }],
    action: { type: 'prefer_provider', providerId: 'prv_globalunlock' },
  },
  {
    id: 'hold-high-value',
    label: 'Hold high-value unlocks',
    name: 'Hold unlock orders above $25',
    description: 'Park high-value unlock orders for an operator to check the IMEI and reseller before any supplier is charged.',
    scope: { mode: 'categories', categories: ['Unlocking'] },
    conds: [{ field: 'order.amount', operator: 'gt', value: '25' }],
    action: { type: 'hold_for_review' },
  },
  {
    id: 'codes-low-balance',
    label: 'Protect supplier credit',
    name: 'Skip suppliers with low credit',
    description: 'Exclude a supplier when its prepaid credit drops under $300 so code orders are not rejected for insufficient balance.',
    scope: { mode: 'categories', categories: ['Codes', 'Server Services'] },
    conds: [{ field: 'provider.balance', operator: 'lt', value: '300' }],
    action: { type: 'exclude_provider' },
  },
  {
    id: 'instant-timeout',
    label: 'Fast failover for IMEI checks',
    name: 'Fail over instant IMEI checks after 6s',
    description: 'Instant IMEI checks should answer in seconds — fail over to the next supplier after 6 seconds.',
    scope: { mode: 'categories', categories: ['IMEI Services'] },
    conds: [],
    action: { type: 'set_timeout', value: 6000 },
  },
]

const NUMBER_OPS: RoutingCondition['operator'][] = ['lt', 'gt', 'eq', 'neq']
const LIST_OPS: RoutingCondition['operator'][] = ['in', 'eq', 'neq']

function condFromRule(c: RoutingCondition): CondDraft {
  return { uid: uid(), field: c.field, operator: c.operator, value: Array.isArray(c.value) ? c.value.join(', ') : String(c.value) }
}

function condToRule(c: CondDraft): RoutingCondition {
  const meta = CONDITION_FIELDS[c.field]
  if (meta.kind === 'list') {
    const list = c.value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    return { field: c.field, operator: c.operator, value: c.operator === 'in' ? list : (list[0] ?? '') }
  }
  return { field: c.field, operator: c.operator, value: Number(c.value) }
}

export function RuleDrawer({ open, rule, onClose }: { open: boolean; rule: RoutingRule | null; onClose: () => void }) {
  const { map: providers, data: providerList } = useProviderMap()
  const { map: services, data: serviceList } = useServiceMap()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [scopeMode, setScopeMode] = useState<ScopeMode>('all')
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [svcSearch, setSvcSearch] = useState('')
  const [conds, setConds] = useState<CondDraft[]>([])
  const [action, setAction] = useState<RoutingAction>({ type: 'exclude_provider' })
  const [touched, setTouched] = useState(false)
  const [template, setTemplate] = useState<string | null>(null)

  const applyTemplate = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id)
    if (!t) return
    setTemplate(id)
    setTouched(false)
    setName(t.name)
    setDescription(t.description)
    setScopeMode(t.scope.mode)
    setCategories(t.scope.categories ?? [])
    setServiceIds(t.scope.serviceIds ?? [])
    setConds(t.conds.map((c) => ({ ...c, uid: uid() })))
    setAction({ ...t.action })
  }

  useEffect(() => {
    if (!open) return
    setTouched(false)
    setSvcSearch('')
    setTemplate(null)
    if (rule) {
      setName(rule.name)
      setDescription(rule.description)
      setEnabled(rule.enabled)
      if (rule.scope.serviceIds === 'all') {
        setScopeMode(rule.scope.categories?.length ? 'categories' : 'all')
        setCategories(rule.scope.categories ?? [])
        setServiceIds([])
      } else {
        setScopeMode('services')
        setServiceIds(rule.scope.serviceIds)
        setCategories([])
      }
      setConds(rule.conditions.map(condFromRule))
      setAction({ ...rule.action })
    } else {
      setName('')
      setDescription('')
      setEnabled(true)
      setScopeMode('all')
      setCategories([])
      setServiceIds([])
      setConds([{ uid: uid(), field: 'provider.health', operator: 'lt', value: '95' }])
      setAction({ type: 'exclude_provider' })
    }
  }, [open, rule])

  const scope: RoutingRule['scope'] = scopeMode === 'all' ? { serviceIds: 'all' } : scopeMode === 'categories' ? { serviceIds: 'all', categories } : { serviceIds }

  const condErrors = conds.map((c) => {
    const meta = CONDITION_FIELDS[c.field]
    if (!c.value.trim()) return 'Value required'
    if (meta.kind === 'number' && Number.isNaN(Number(c.value))) return 'Must be a number'
    if (c.field === 'time.hour' && (Number(c.value) < 0 || Number(c.value) > 23)) return '0–23'
    return undefined
  })
  const errors = {
    name: name.trim().length < 3 ? 'Give the rule a descriptive name' : undefined,
    scope: scopeMode === 'categories' && !categories.length ? 'Pick at least one category' : scopeMode === 'services' && !serviceIds.length ? 'Pick at least one service' : undefined,
    action:
      action.type === 'prefer_provider' && !action.providerId
        ? 'Choose the supplier to prefer'
        : action.type === 'set_strategy' && !action.strategy
          ? 'Choose a strategy'
          : action.type === 'set_timeout' && (!action.value || action.value < 1000)
            ? 'Timeout must be at least 1,000 ms'
            : undefined,
  }
  const valid = !errors.name && !errors.scope && !errors.action && condErrors.every((e) => !e)

  const body = (): Partial<RoutingRule> => ({ name: name.trim(), description: description.trim(), enabled, scope, conditions: conds.map(condToRule), action: cleanAction(action) })
  const save = useInstMutation(() => (rule ? routingService.updateRule(rule.id, body()) : routingService.createRule(body())), {
    success: rule ? 'Routing rule saved' : 'Routing rule created',
    onSuccess: onClose,
  })

  const preview = useMemo(() => {
    try {
      return { conds: conds.filter((_, i) => !condErrors[i]).map((c) => conditionText(condToRule(c))), action: actionText(cleanAction(action), providers), scope: scopeText(scope, services) }
    } catch {
      return null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conds, action, scopeMode, categories, serviceIds, providers, services])

  const filteredServices = (serviceList ?? []).filter((s) => !svcSearch || `${s.name} ${s.id}`.toLowerCase().includes(svcSearch.toLowerCase()))

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="lg"
      icon={<SlidersHorizontal />}
      title={rule ? `Edit rule · ${rule.name}` : 'New routing rule'}
      description="Rules run top to bottom before the strategy and can prefer, exclude or hold — by carrier country, order amount or supplier health."
      footer={
        <>
          <div className="mr-auto flex items-center gap-2 text-[12.5px] text-fg-2">
            <Switch checked={enabled} onChange={setEnabled} label="Enabled" size="sm" />
            {enabled ? 'Enabled' : 'Saved as disabled'}
          </div>
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
            {rule ? 'Save rule' : 'Create rule'}
          </Button>
        </>
      }
    >
      <div className="space-y-7">
        {!rule && (
          <section className="space-y-2.5">
            <div className="flex items-center gap-1.5">
              <Wand2 className="size-3.5 text-fg-3" />
              <h3 className="mono-label">Start from a template</h3>
            </div>
            <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t.id)}
                  title={t.description}
                  className={cn(
                    'flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] whitespace-nowrap transition-colors',
                    template === t.id ? 'border-accent/50 bg-accent/[0.06] text-fg' : 'border-line text-fg-2 hover:border-line-strong hover:text-fg',
                  )}
                >
                  {template === t.id && <Check className="size-3.5 text-accent-ink" />}
                  {t.label}
                </button>
              ))}
            </div>
          </section>
        )}
        <section className="space-y-4">
          <Field label="Name" error={touched ? errors.name : undefined}>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Prefer Global Unlock for EU unlocks" invalid={touched && !!errors.name} />
          </Field>
          <Field label="Description" optional>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Why this rule exists — e.g. direct carrier agreements give Global Unlock the fastest EU turnaround." />
          </Field>
        </section>

        {/* Conditions */}
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <h3 className="mono-label">When</h3>
              <p className="mt-1 text-[12px] text-fg-3">All conditions must match. Leave empty to always apply.</p>
            </div>
            <Button size="sm" variant="secondary" leading={<Plus />} onClick={() => setConds((c) => [...c, { uid: uid(), field: 'order.country', operator: 'in', value: '' }])}>
              Condition
            </Button>
          </div>
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {conds.map((c, i) => {
                const meta = CONDITION_FIELDS[c.field]
                const ops = meta.kind === 'list' ? LIST_OPS : NUMBER_OPS
                const err = touched ? condErrors[i] : undefined
                return (
                  <motion.div key={c.uid} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className={cn('rounded-xl border bg-surface-2/40 p-2.5', err ? 'border-danger/40' : 'border-line')}>
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto]">
                        <Select
                          inputSize="sm"
                          value={c.field}
                          onChange={(e) => {
                            const field = e.target.value as RoutingConditionField
                            const kind = CONDITION_FIELDS[field].kind
                            setConds((cs) => cs.map((x, j) => (j === i ? { uid: x.uid, field, operator: kind === 'list' ? 'in' : 'lt', value: '' } : x)))
                          }}
                          options={(Object.keys(CONDITION_FIELDS) as RoutingConditionField[]).map((f) => ({ value: f, label: `${f}` }))}
                        />
                        <Select inputSize="sm" value={c.operator} onChange={(e) => setConds((cs) => cs.map((x, j) => (j === i ? { ...x, operator: e.target.value as RoutingCondition['operator'] } : x)))} options={ops.map((o) => ({ value: o, label: `${OPERATORS[o].symbol}  ${OPERATORS[o].label}` }))} />
                        <Input
                          inputSize="sm"
                          mono
                          value={c.value}
                          placeholder={meta.kind === 'list' ? (c.field === 'order.country' ? 'FR, DE, ES, IT' : c.field === 'service.category' ? 'Unlocking, Codes' : 'grp_enterprise') : meta.unit === '%' ? '95' : meta.unit === 'ms' ? '2000' : meta.unit === 'h' ? '6' : '20'}
                          onChange={(e) => setConds((cs) => cs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                          invalid={!!err}
                          trailing={meta.unit && meta.unit !== '$' ? <span className="text-[11px]">{meta.unit}</span> : undefined}
                          leading={meta.unit === '$' ? <span className="text-[12px]">$</span> : undefined}
                        />
                        <Button size="sm" variant="ghost" icon aria-label="Remove condition" onClick={() => setConds((cs) => cs.filter((_, j) => j !== i))}>
                          <Trash2 />
                        </Button>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between px-1 text-[11.5px]">
                        <span className="text-fg-3">
                          {meta.label} · {meta.hint}
                        </span>
                        {err && <span className="text-danger">{err}</span>}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
            {!conds.length && <p className="rounded-xl border border-dashed border-line px-4 py-4 text-center text-[12.5px] text-fg-3">No conditions — the action applies to every order in scope.</p>}
          </div>
        </section>

        {/* Action */}
        <section className="space-y-3">
          <h3 className="mono-label">Then</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(ACTIONS) as RoutingAction['type'][]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setAction((a) => ({ type: t, providerId: t === 'prefer_provider' || t === 'exclude_provider' ? a.providerId : undefined, strategy: t === 'set_strategy' ? (a.strategy ?? 'lowest_cost') : undefined, value: t === 'set_timeout' ? (a.value ?? 8000) : undefined }))}
                className={cn('flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-left transition-colors', action.type === t ? 'border-accent/50 bg-accent/[0.04]' : 'border-line hover:border-line-strong')}
              >
                <span className={cn('mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border', action.type === t ? 'border-accent bg-accent text-accent-fg' : 'border-line-strong')}>{action.type === t && <Check className="size-2.5" />}</span>
                <span>
                  <span className="block text-[13px] font-medium">{ACTIONS[t].label}</span>
                  <span className="block text-[11.5px] text-fg-3">{ACTIONS[t].description}</span>
                </span>
              </button>
            ))}
          </div>
          {(action.type === 'prefer_provider' || action.type === 'exclude_provider') && (
            <Field label="Supplier" error={touched ? errors.action : undefined} hint={action.type === 'exclude_provider' ? 'Leave as “matching supplier” to exclude whichever supplier meets the provider.* conditions (health, latency, balance).' : undefined}>
              <Select
                value={action.providerId ?? ''}
                onChange={(e) => setAction((a) => ({ ...a, providerId: e.target.value || undefined }))}
                options={[{ value: '', label: action.type === 'exclude_provider' ? 'Matching supplier (from conditions)' : 'Select supplier…' }, ...(providerList ?? []).map((p) => ({ value: p.id, label: `${p.name}${p.status !== 'operational' ? ` — ${p.status}` : ''}` }))]}
              />
            </Field>
          )}
          {action.type === 'set_strategy' && (
            <Field label="Strategy" error={touched ? errors.action : undefined}>
              <Select value={action.strategy ?? ''} onChange={(e) => setAction((a) => ({ ...a, strategy: e.target.value as RoutingStrategy }))} options={STRATEGY_ORDER.map((s) => ({ value: s, label: `${STRATEGIES[s].label} — ${STRATEGIES[s].tagline}` }))} />
            </Field>
          )}
          {action.type === 'set_timeout' && (
            <Field label="Timeout" error={touched ? errors.action : undefined} hint="Overrides the supplier timeout so Core fails over sooner.">
              <Input inputMode="numeric" value={action.value ?? ''} onChange={(e) => setAction((a) => ({ ...a, value: Number(e.target.value) || undefined }))} trailing={<span className="text-[12px]">ms</span>} />
            </Field>
          )}
        </section>

        {/* Scope */}
        <section className="space-y-3">
          <h3 className="mono-label">Applies to</h3>
          <Segmented
            size="md"
            value={scopeMode}
            onChange={setScopeMode}
            items={[
              { value: 'all', label: 'All services' },
              { value: 'categories', label: 'Categories' },
              { value: 'services', label: 'Specific services' },
            ]}
          />
          {touched && errors.scope && <p className="text-[12px] text-danger">{errors.scope}</p>}
          {scopeMode === 'categories' && (
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const on = categories.includes(c)
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategories((cs) => (on ? cs.filter((x) => x !== c) : [...cs, c]))}
                    className={cn('flex h-8 items-center gap-2 rounded-full border px-3 text-[12.5px] transition-colors', on ? 'border-accent/50 bg-accent/[0.06] text-fg' : 'border-line text-fg-2 hover:border-line-strong')}
                  >
                    <span className="size-2 rounded-full" style={{ background: categoryColor(c) }} />
                    {c}
                    {on && <Check className="size-3.5 text-accent-ink" />}
                  </button>
                )
              })}
            </div>
          )}
          {scopeMode === 'services' && (
            <div className="overflow-hidden rounded-xl border border-line">
              <div className="flex items-center gap-2 border-b border-line p-2">
                <SearchInput value={svcSearch} onChange={setSvcSearch} placeholder="Filter services…" className="flex-1 [&_input]:h-8" />
                <span className="pr-1 text-[12px] text-fg-3 tabular">{serviceIds.length} selected</span>
              </div>
              <ul className="max-h-[240px] overflow-y-auto p-1">
                {filteredServices.map((s) => {
                  const on = serviceIds.includes(s.id)
                  return (
                    <li key={s.id}>
                      <button type="button" onClick={() => setServiceIds((ids) => (on ? ids.filter((x) => x !== s.id) : [...ids, s.id]))} className={cn('flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors', on ? 'bg-accent/[0.06]' : 'hover:bg-surface-2')}>
                        <span className={cn('grid size-4 shrink-0 place-items-center rounded-[5px] border', on ? 'border-accent bg-accent text-accent-fg' : 'border-line-strong')}>{on && <Check className="size-3" />}</span>
                        <ServiceIcon icon={s.icon} category={s.category} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-[13px]">{s.name}</span>
                        <span className="font-mono text-[11px] text-fg-3">{s.id}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </section>

        {/* Preview */}
        {preview && (
          <section className="rounded-xl border border-line bg-bg-subtle p-4">
            <div className="mono-label mb-2">Preview</div>
            <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
              <span className="text-fg-3">When</span>
              {preview.conds.length ? (
                preview.conds.map((c, i) => (
                  <span key={i} className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[11.5px]">
                    {c}
                  </span>
                ))
              ) : (
                <span className="text-fg-2">any order</span>
              )}
              <ArrowRight className="size-3.5 text-fg-3" />
              <ActionPill action={cleanAction(action)} providers={providers} className="text-[12px]" />
              <span className="text-fg-3">for</span>
              <span className="font-medium text-fg">{preview.scope}</span>
            </div>
          </section>
        )}
      </div>
    </Drawer>
  )
}

function cleanAction(a: RoutingAction): RoutingAction {
  const out: RoutingAction = { type: a.type }
  if ((a.type === 'prefer_provider' || a.type === 'exclude_provider') && a.providerId) out.providerId = a.providerId
  if (a.type === 'set_strategy' && a.strategy) out.strategy = a.strategy
  if (a.type === 'set_timeout' && a.value) out.value = a.value
  return out
}
