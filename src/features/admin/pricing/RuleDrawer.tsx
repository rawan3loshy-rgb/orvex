import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Button, Drawer, Field, Input, Segmented, Select, Switch, Textarea } from '@/components/ui'
import { PermissionHint } from '@/components/domain'
import { useCategories, useInstMutation, useServices } from '@/hooks/installation'
import { pricingService } from '@/services/installation'
import { formatMoney, parseMoney, type Micros, type RoundingMode } from '@/core/money'
import type { PricingMethod, PricingOverview, PricingRule, PricingScope } from '@/types/installation'
import { Callout } from '../catalog/kit'

type RuleRow = PricingOverview['rules'][number]

const INCREMENTS = [
  { value: '10000', label: '$0.01' },
  { value: '50000', label: '$0.05' },
  { value: '100000', label: '$0.10' },
  { value: '250000', label: '$0.25' },
  { value: '500000', label: '$0.50' },
  { value: '1000000', label: '$1.00' },
]

const money = (m: number) => formatMoney(m as Micros).replace(/[$,]/g, '')

export function RuleDrawer({ open, onClose, rule, tiers, defaultTierId }: { open: boolean; onClose: () => void; rule: RuleRow | null; tiers: PricingOverview['tiers']; defaultTierId?: string }) {
  const categories = useCategories()
  const services = useServices()
  const [tierId, setTierId] = useState('')
  const [scopeKind, setScopeKind] = useState<PricingScope['kind']>('all')
  const [categoryId, setCategoryId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [method, setMethod] = useState<PricingMethod>('cost_plus_percent')
  const [value, setValue] = useState('')
  const [increment, setIncrement] = useState('10000')
  const [mode, setMode] = useState<RoundingMode>('up')
  const [minMargin, setMinMargin] = useState('')
  const [note, setNote] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [reason, setReason] = useState('')

  // Seed the form whenever the drawer opens or its inputs change (adjusted during render, not in an effect).
  const [seededFor, setSeededFor] = useState<{ open: boolean; rule: RuleRow | null; tiers: PricingOverview['tiers']; defaultTierId?: string } | null>(null)
  if (!seededFor || seededFor.open !== open || seededFor.rule !== rule || seededFor.tiers !== tiers || seededFor.defaultTierId !== defaultTierId) {
    setSeededFor({ open, rule, tiers, defaultTierId })
    if (open) {
      const r = rule
      setTierId(r?.tierId ?? defaultTierId ?? tiers[0]?.id ?? '')
      setScopeKind(r?.scope.kind ?? 'all')
      setCategoryId(r?.scope.kind === 'category' ? r.scope.categoryId : '')
      setServiceId(r?.scope.kind === 'service' ? r.scope.serviceId : '')
      setMethod(r?.method ?? 'cost_plus_percent')
      setValue(r ? (r.method === 'cost_plus_percent' ? String(r.value / 100) : money(r.value)) : '')
      setIncrement(String(r?.rounding.increment ?? 10000))
      setMode(r?.rounding.mode ?? 'up')
      setMinMargin(r?.minMarginBps != null ? String(r.minMarginBps / 100) : '')
      setNote(r?.note ?? '')
      setEnabled(r?.enabled ?? true)
      setReason('')
    }
  }

  const pct = method === 'cost_plus_percent'
  const parsedValue = pct ? (value.trim() && !Number.isNaN(Number(value)) ? Math.round(Number(value) * 100) : null) : parseMoney(value)
  const parsedMin = minMargin.trim() ? (Number.isNaN(Number(minMargin)) ? NaN : Math.round(Number(minMargin) * 100)) : null
  const scope: PricingScope | null = scopeKind === 'all' ? { kind: 'all' } : scopeKind === 'category' ? (categoryId ? { kind: 'category', categoryId } : null) : serviceId ? { kind: 'service', serviceId } : null
  const valid = !!tierId && scope != null && parsedValue != null && !Number.isNaN(parsedMin as number)

  const save = useInstMutation(
    () => {
      const body: Omit<PricingRule, 'id' | 'updatedAt' | 'updatedBy'> = { tierId, scope: scope!, method, value: parsedValue!, rounding: { increment: Number(increment) as Micros, mode }, minMarginBps: parsedMin, enabled, note: note.trim() }
      return rule ? pricingService.updateRule(rule.id, body, reason.trim() || undefined) : pricingService.createRule(body, reason.trim() || undefined)
    },
    { success: rule ? 'Pricing rule updated — prices recalculated' : 'Pricing rule created — prices recalculated', onSuccess: onClose },
  )

  return (
    <Drawer
      open={open}
      onClose={onClose}
      icon={<SlidersHorizontal />}
      title={rule ? 'Edit pricing rule' : 'New pricing rule'}
      description="Rules are evaluated live. Precedence inside a tier: service → category → all."
      footer={
        <>
          <PermissionHint permission="pricing.manage" className="mr-auto" />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" disabled={!valid} loading={save.isPending} onClick={() => save.mutate()}>
            {rule ? 'Save rule' : 'Create rule'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Tier">
          <Select value={tierId} onChange={(e) => setTierId(e.target.value)} options={tiers.map((t) => ({ value: t.id, label: `${t.name}${t.isDefault ? ' (default)' : ''}` }))} />
        </Field>
        <Field label="Scope">
          <Segmented
            value={scopeKind}
            onChange={setScopeKind}
            items={[
              { value: 'all', label: 'All services' },
              { value: 'category', label: 'Category' },
              { value: 'service', label: 'Service' },
            ]}
          />
        </Field>
        {scopeKind === 'category' && (
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} options={[{ value: '', label: 'Choose a category…' }, ...(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))]} />
        )}
        {scopeKind === 'service' && (
          <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)} options={[{ value: '', label: 'Choose a service…' }, ...(services.data ?? []).map((s) => ({ value: s.service.id, label: `${s.service.name} (#${s.service.code})` }))]} />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Method">
            <Select
              value={method}
              onChange={(e) => {
                setMethod(e.target.value as PricingMethod)
                setValue('')
              }}
              options={[
                { value: 'fixed', label: 'Fixed price' },
                { value: 'cost_plus_percent', label: 'Cost + percent' },
                { value: 'cost_plus_fixed', label: 'Cost + fixed amount' },
              ]}
            />
          </Field>
          <Field label={pct ? 'Markup (%)' : method === 'fixed' ? 'Price' : 'Markup amount'} error={value && parsedValue == null ? 'Invalid number' : undefined}>
            <Input mono value={value} onChange={(e) => setValue(e.target.value)} leading={pct ? undefined : <span className="text-[12px]">$</span>} trailing={pct ? <span className="text-[12px]">%</span> : undefined} placeholder={pct ? '25' : '0.12'} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Round to">
            <Select value={increment} onChange={(e) => setIncrement(e.target.value)} options={INCREMENTS} />
          </Field>
          <Field label="Rounding">
            <Select
              value={mode}
              onChange={(e) => setMode(e.target.value as RoundingMode)}
              options={[
                { value: 'up', label: 'Up' },
                { value: 'nearest', label: 'Nearest' },
                { value: 'down', label: 'Down' },
              ]}
            />
          </Field>
          <Field label="Min margin (%)" optional error={Number.isNaN(parsedMin as number) ? 'Invalid' : undefined}>
            <Input mono value={minMargin} onChange={(e) => setMinMargin(e.target.value)} placeholder="8" />
          </Field>
        </div>
        <Field label="Note" optional>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Contract price until 2027-03" />
        </Field>
        <label className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
          <span>
            <span className="block text-[13px] font-medium">Enabled</span>
            <span className="block text-[11.5px] text-fg-3">Disabled rules are ignored by the engine.</span>
          </span>
          <Switch checked={enabled} onChange={setEnabled} label="Enabled" />
        </label>
        <Field label="Reason" optional hint="Recorded in the audit log together with the prices that changed.">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-14" />
        </Field>
        {method === 'fixed' && (
          <Callout>A fixed price does not follow supplier cost. If the cost rises above it, the quote shows a negative margin and the margin guard skips offers costing more than the order price.</Callout>
        )}
      </div>
    </Drawer>
  )
}
