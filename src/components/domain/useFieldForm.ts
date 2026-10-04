import { useMemo, useState } from 'react'
import { validateField, validateInput, type FieldCheck } from '@/core/fields'
import '@/core/verticals/gsm'
import type { FieldDef } from '@/types/installation'

/** Headless state + validation for a service revision's FieldDef list (see `FieldInput` / `FieldList`). */
export function useFieldForm(fields: FieldDef[] | undefined, initial?: Record<string, string>) {
  const [values, setValues] = useState<Record<string, string>>(initial ?? {})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted] = useState(false)
  const list = useMemo(() => fields ?? [], [fields])
  const result = useMemo(() => validateInput(list, values), [list, values])
  const perField = useMemo(() => Object.fromEntries(list.map((f) => [f.key, validateField(f, values[f.key])])), [list, values])
  return {
    values,
    set: (key: string, v: string) => setValues((x) => ({ ...x, [key]: v })),
    touch: (key: string) => setTouched((t) => ({ ...t, [key]: true })),
    reset: (next?: Record<string, string>) => {
      setValues(next ?? {})
      setTouched({})
      setSubmitted(false)
    },
    /** Error to display for a field (only once touched or after submit). */
    errorOf: (key: string) => ((touched[key] || submitted) && perField[key]?.error) || undefined,
    checksOf: (key: string): FieldCheck[] => perField[key]?.checks ?? [],
    valid: result.ok,
    normalized: result.values,
    errors: result.errors,
    /** Mark everything touched; returns true when valid. */
    submit: () => {
      setSubmitted(true)
      return result.ok
    },
  }
}

export type FieldFormState = ReturnType<typeof useFieldForm>
