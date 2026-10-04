/**
 * Field-type registry and validation.
 *
 * A service revision's FieldDef list is the single definition that drives:
 *   storefront form · portal form · native API JSON schema · server validation
 *   · DHRU-compatible parameter mapping.
 * Core ships generic types; vertical packs (e.g. GSM) register their own.
 * The same `validateInput` runs in the browser (instant feedback) and in the
 * PlaceOrder command (authoritative).
 */
import type { FieldDef } from './domain/catalog'

export interface FieldCheck {
  label: string
  ok: boolean
}

export interface FieldTypeDef {
  id: string
  label: string
  packId: string | null
  inputMode: 'text' | 'numeric' | 'email' | 'tel' | 'select'
  description: string
  example: string
  /** Canonical form stored on the order (e.g. IMEI without spaces). */
  normalize: (raw: string) => string
  /** Visible checklist (✓ 15 digits ✓ Luhn valid). Empty for simple types. */
  checks: (value: string, field: FieldDef) => FieldCheck[]
  /** Error message, or null when valid. Runs after required/length checks. */
  validate: (value: string, field: FieldDef) => string | null
  /** JSON-schema fragment for API docs. */
  schema: (field: FieldDef) => Record<string, unknown>
  /** DHRU-compatible parameter name, when the type maps to one. */
  dhruParam?: string
}

const registry = new Map<string, FieldTypeDef>()

export function registerFieldType(def: FieldTypeDef) {
  registry.set(def.id, def)
}

export function fieldType(id: string): FieldTypeDef {
  return registry.get(id) ?? registry.get('text')!
}

export function fieldTypes(): FieldTypeDef[] {
  return [...registry.values()]
}

/* ------------------------------------------------------------------------- */
/*  Core field types                                                         */
/* ------------------------------------------------------------------------- */
const trim = (s: string) => s.trim()
const optionsOf = (f: FieldDef) => f.options?.map((o) => o.value) ?? []

registerFieldType({
  id: 'text',
  label: 'Text',
  packId: null,
  inputMode: 'text',
  description: 'Free text with optional length and pattern rules.',
  example: 'Any text',
  normalize: trim,
  checks: () => [],
  validate: (v, f) => (f.pattern && !new RegExp(f.pattern).test(v) ? 'Invalid format' : null),
  schema: (f) => ({ type: 'string', ...(f.minLength ? { minLength: f.minLength } : {}), ...(f.maxLength ? { maxLength: f.maxLength } : {}), ...(f.pattern ? { pattern: f.pattern } : {}) }),
})

registerFieldType({
  id: 'number',
  label: 'Number',
  packId: null,
  inputMode: 'numeric',
  description: 'Whole number.',
  example: '42',
  normalize: trim,
  checks: () => [],
  validate: (v) => (/^-?\d+$/.test(v) ? null : 'Must be a whole number'),
  schema: () => ({ type: 'integer' }),
})

registerFieldType({
  id: 'select',
  label: 'Select',
  packId: null,
  inputMode: 'select',
  description: 'One value from a fixed list.',
  example: 'option_a',
  normalize: trim,
  checks: () => [],
  validate: (v, f) => (optionsOf(f).length && !optionsOf(f).includes(v) ? 'Choose one of the listed options' : null),
  schema: (f) => ({ type: 'string', enum: optionsOf(f) }),
})

registerFieldType({
  id: 'email',
  label: 'Email',
  packId: null,
  inputMode: 'email',
  description: 'Email address.',
  example: 'name@example.com',
  normalize: (v) => v.trim().toLowerCase(),
  checks: () => [],
  validate: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? null : 'Enter a valid email address'),
  schema: () => ({ type: 'string', format: 'email' }),
})

registerFieldType({
  id: 'country',
  label: 'Country',
  packId: null,
  inputMode: 'select',
  description: 'ISO 3166-1 alpha-2 country code.',
  example: 'US',
  normalize: (v) => v.trim().toUpperCase(),
  checks: () => [],
  validate: (v) => (/^[A-Z]{2}$/.test(v) ? null : 'Two-letter country code'),
  schema: () => ({ type: 'string', pattern: '^[A-Z]{2}$' }),
})

registerFieldType({
  id: 'phone',
  label: 'Phone number',
  packId: null,
  inputMode: 'tel',
  description: 'E.164 phone number.',
  example: '+447700900123',
  normalize: (v) => v.replace(/[\s()-]/g, ''),
  checks: () => [],
  validate: (v) => (/^\+[1-9]\d{7,14}$/.test(v) ? null : 'Use international format, e.g. +447700900123'),
  schema: () => ({ type: 'string', pattern: '^\\+[1-9]\\d{7,14}$' }),
})

/* ------------------------------------------------------------------------- */
/*  Validation                                                               */
/* ------------------------------------------------------------------------- */
export interface InputValidation {
  ok: boolean
  values: Record<string, string>
  errors: Record<string, string>
  checks: Record<string, FieldCheck[]>
}

export function validateField(field: FieldDef, raw: string | undefined): { value: string; error: string | null; checks: FieldCheck[] } {
  const t = fieldType(field.type)
  const value = t.normalize(raw ?? '')
  if (!value) return { value, error: field.required ? `${field.label} is required` : null, checks: [] }
  const checks = t.checks(value, field)
  if (field.minLength && value.length < field.minLength) return { value, error: `At least ${field.minLength} characters`, checks }
  if (field.maxLength && value.length > field.maxLength) return { value, error: `At most ${field.maxLength} characters`, checks }
  return { value, error: t.validate(value, field), checks }
}

export function validateInput(fields: FieldDef[], input: Record<string, string | undefined>): InputValidation {
  const values: Record<string, string> = {}
  const errors: Record<string, string> = {}
  const checks: Record<string, FieldCheck[]> = {}
  for (const f of fields) {
    const r = validateField(f, input[f.key])
    if (r.value) values[f.key] = r.value
    if (r.error) errors[f.key] = r.error
    if (r.checks.length) checks[f.key] = r.checks
  }
  const unknown = Object.keys(input).filter((k) => !fields.some((f) => f.key === k) && input[k])
  for (const k of unknown) errors[k] = 'Unknown field for this service'
  return { ok: Object.keys(errors).length === 0, values, errors, checks }
}

/** JSON schema of a service's input — published in the native API docs. */
export function inputSchema(fields: FieldDef[]) {
  return {
    type: 'object',
    required: fields.filter((f) => f.required).map((f) => f.key),
    properties: Object.fromEntries(fields.map((f) => [f.key, { title: f.label, ...fieldType(f.type).schema(f), ...(f.help ? { description: f.help } : {}) }])),
    additionalProperties: false,
  }
}

/** Mask sensitive values for logs and notifications. */
export function maskInput(fields: FieldDef[], input: Record<string, string>) {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(input)) {
    const f = fields.find((x) => x.key === k)
    out[k] = f?.sensitive ? `${v.slice(0, 3)}••••${v.slice(-2)}` : v
  }
  return out
}
