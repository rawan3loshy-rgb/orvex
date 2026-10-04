/**
 * Field form — renders a service revision's FieldDef list.
 *
 * The same field definitions drive the storefront form, the portal form, the
 * admin "create order" form, the native API schema and server validation.
 * `useFieldForm` is headless (the storefront styles its own inputs); `FieldInput`
 * is the default rendering for the admin console and reseller portal.
 */
import { Check, X } from 'lucide-react'
import { Field, Input, Select } from '@/components/ui'
import { fieldType, type FieldCheck } from '@/core/fields'
import '@/core/verticals/gsm'
import type { FieldDef } from '@/types/installation'
import { cn } from '@/lib/cn'
import type { FieldFormState } from './useFieldForm'

export function FieldChecks({ checks, className }: { checks: FieldCheck[]; className?: string }) {
  if (!checks.length) return null
  return (
    <div className={cn('flex flex-wrap gap-x-3 gap-y-1', className)}>
      {checks.map((c) => (
        <span key={c.label} className={cn('inline-flex items-center gap-1 text-[11.5px] font-medium', c.ok ? 'text-success' : 'text-fg-3')}>
          {c.ok ? <Check className="size-3" /> : <X className="size-3" />}
          {c.label}
        </span>
      ))}
    </div>
  )
}

export function FieldInput({ field, form, size = 'md' }: { field: FieldDef; form: FieldFormState; size?: 'md' | 'lg' }) {
  const t = fieldType(field.type)
  const err = form.errorOf(field.key)
  const value = form.values[field.key] ?? ''
  const options = field.options ?? []
  return (
    <Field label={field.label} hint={err ? undefined : field.help} error={err} optional={!field.required} htmlFor={`f_${field.key}`}>
      {t.inputMode === 'select' || options.length ? (
        <Select id={`f_${field.key}`} value={value} invalid={!!err} onChange={(e) => form.set(field.key, e.target.value)} onBlur={() => form.touch(field.key)} options={[{ value: '', label: `Select ${field.label.toLowerCase()}…` }, ...options]} />
      ) : (
        <Input
          id={`f_${field.key}`}
          value={value}
          inputSize={size}
          invalid={!!err}
          mono={field.type === 'gsm.imei' || field.type === 'gsm.serial'}
          inputMode={t.inputMode === 'numeric' ? 'numeric' : t.inputMode === 'email' ? 'email' : t.inputMode === 'tel' ? 'tel' : 'text'}
          placeholder={field.placeholder ?? t.example}
          onChange={(e) => form.set(field.key, e.target.value)}
          onBlur={() => form.touch(field.key)}
        />
      )}
      <FieldChecks checks={form.checksOf(field.key)} />
    </Field>
  )
}

export function FieldList({ fields, form, size }: { fields: FieldDef[]; form: FieldFormState; size?: 'md' | 'lg' }) {
  return (
    <div className="grid gap-4">
      {fields.map((f) => (
        <FieldInput key={f.key} field={f} form={form} size={size} />
      ))}
    </div>
  )
}
