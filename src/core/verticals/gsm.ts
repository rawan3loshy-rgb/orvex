/**
 * GSM vertical pack.
 *
 * Everything GSM-specific lives here as data and registered capabilities —
 * field types (IMEI with Luhn, serial, brand, model, carrier), the GSM service
 * categories and result schemas. Core's order engine, ledger and routing never
 * reference IMEIs; another vertical could register its own pack the same way.
 *
 * Demo catalog policy: legitimate services only — device checks, information,
 * warranty, compatibility and carrier-authorised unlock codes. No activation-
 * lock bypass, account removal, blacklist removal or IMEI modification.
 */
import { registerFieldType, type FieldCheck } from '../fields'
import type { FieldDef, FieldOption, ResultFieldDef } from '../domain/catalog'

export const GSM_PACK = {
  id: 'gsm',
  name: 'GSM Services Pack',
  version: '1.3.0',
  author: 'ORVEX Systems',
  description: 'IMEI, serial, brand, model and carrier field types; GSM service categories; result schemas for device checks and unlock codes; DHRU parameter mapping.',
  capabilities: ['field types: gsm.imei, gsm.serial, gsm.brand, gsm.model, gsm.carrier', '6 service categories', '9 result schemas', 'DHRU parameter mapping (IMEI, MODELID, PROVIDERID, SN)'],
} as const

/** Luhn (mod-10) checksum, as used by the 15th IMEI digit. */
export function luhnValid(digits: string) {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

/** Complete a 14-digit body with its Luhn check digit. */
export function withLuhn(body14: string) {
  for (let c = 0; c <= 9; c++) if (luhnValid(`${body14}${c}`)) return `${body14}${c}`
  return `${body14}0`
}

export const GSM_BRANDS: FieldOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'samsung', label: 'Samsung' },
  { value: 'google', label: 'Google' },
  { value: 'xiaomi', label: 'Xiaomi' },
  { value: 'motorola', label: 'Motorola' },
  { value: 'huawei', label: 'Huawei' },
  { value: 'oneplus', label: 'OnePlus' },
  { value: 'alcatel', label: 'Alcatel / TCL' },
  { value: 'zte', label: 'ZTE' },
  { value: 'other', label: 'Other' },
]

export const GSM_CARRIERS: FieldOption[] = [
  { value: 'tmobile_us', label: 'T-Mobile (US)' },
  { value: 'att_us', label: 'AT&T (US)' },
  { value: 'verizon_us', label: 'Verizon (US)' },
  { value: 'cricket_us', label: 'Cricket (US)' },
  { value: 'ee_uk', label: 'EE (UK)' },
  { value: 'vodafone_uk', label: 'Vodafone (UK)' },
  { value: 'o2_uk', label: 'O2 (UK)' },
  { value: 'three_uk', label: 'Three (UK)' },
  { value: 'orange_fr', label: 'Orange (FR)' },
  { value: 'telekom_de', label: 'Telekom (DE)' },
  { value: 'movistar_es', label: 'Movistar (ES)' },
  { value: 'rogers_ca', label: 'Rogers (CA)' },
  { value: 'telstra_au', label: 'Telstra (AU)' },
]

export const carrierLabel = (v: string) => GSM_CARRIERS.find((c) => c.value === v)?.label ?? v
export const brandLabel = (v: string) => GSM_BRANDS.find((c) => c.value === v)?.label ?? v

/* ------------------------------------------------------------------------- */
/*  Field types                                                              */
/* ------------------------------------------------------------------------- */
registerFieldType({
  id: 'gsm.imei',
  label: 'IMEI',
  packId: 'gsm',
  inputMode: 'numeric',
  description: '15-digit device identity. Spaces and dashes are removed; the Luhn check digit is verified before any supplier is charged.',
  example: '356938035643809',
  normalize: (v) => v.replace(/[\s-]/g, ''),
  checks: (v): FieldCheck[] => [
    { label: '15 digits', ok: /^\d{15}$/.test(v) },
    { label: 'Luhn valid', ok: /^\d{15}$/.test(v) && luhnValid(v) },
  ],
  validate: (v) => {
    if (!/^\d+$/.test(v)) return 'IMEI contains digits only'
    if (v.length !== 15) return `IMEI must be 15 digits (got ${v.length})`
    if (!luhnValid(v)) return 'Invalid IMEI — Luhn check digit does not match'
    return null
  },
  schema: () => ({ type: 'string', pattern: '^\\d{15}$', 'x-checksum': 'luhn', example: '356938035643809' }),
  dhruParam: 'IMEI',
})

registerFieldType({
  id: 'gsm.serial',
  label: 'Serial number',
  packId: 'gsm',
  inputMode: 'text',
  description: 'Manufacturer serial number (8–14 letters and digits).',
  example: 'F2LXK1ABHG7F',
  normalize: (v) => v.replace(/\s/g, '').toUpperCase(),
  checks: (v) => [{ label: '8–14 letters or digits', ok: /^[A-Z0-9]{8,14}$/.test(v) }],
  validate: (v) => (/^[A-Z0-9]{8,14}$/.test(v) ? null : 'Serial numbers are 8–14 letters or digits'),
  schema: () => ({ type: 'string', pattern: '^[A-Z0-9]{8,14}$' }),
  dhruParam: 'SN',
})

registerFieldType({
  id: 'gsm.brand',
  label: 'Brand',
  packId: 'gsm',
  inputMode: 'select',
  description: 'Device manufacturer.',
  example: 'apple',
  normalize: (v) => v.trim().toLowerCase(),
  checks: () => [],
  validate: (v, f) => ((f.options ?? GSM_BRANDS).some((o) => o.value === v) ? null : 'Choose a brand from the list'),
  schema: (f) => ({ type: 'string', enum: (f.options ?? GSM_BRANDS).map((o) => o.value) }),
})

registerFieldType({
  id: 'gsm.model',
  label: 'Model',
  packId: 'gsm',
  inputMode: 'text',
  description: 'Model name or code, e.g. "iPhone 15" or "SM-S918B".',
  example: 'iPhone 15',
  normalize: (v) => v.trim().replace(/\s+/g, ' '),
  checks: () => [],
  validate: (v) => (/^[A-Za-z0-9 +()./-]{2,40}$/.test(v) ? null : 'Use 2–40 letters, digits or - + ( ) . /'),
  schema: () => ({ type: 'string', minLength: 2, maxLength: 40 }),
  dhruParam: 'MODELID',
})

registerFieldType({
  id: 'gsm.carrier',
  label: 'Carrier',
  packId: 'gsm',
  inputMode: 'select',
  description: 'Network the device is (or was) locked to.',
  example: 'tmobile_us',
  normalize: (v) => v.trim(),
  checks: () => [],
  validate: (v, f) => ((f.options ?? GSM_CARRIERS).some((o) => o.value === v) ? null : 'Choose a carrier from the list'),
  schema: (f) => ({ type: 'string', enum: (f.options ?? GSM_CARRIERS).map((o) => o.value) }),
  dhruParam: 'PROVIDERID',
})

/* ------------------------------------------------------------------------- */
/*  Field presets (used by the catalog seed and the service editor)          */
/* ------------------------------------------------------------------------- */
export const GSM_FIELDS = {
  imei: { key: 'imei', label: 'IMEI', type: 'gsm.imei', required: true, placeholder: '15-digit IMEI (dial *#06#)', help: 'Dial *#06# on the device, or find it in Settings → About.' },
  serial: { key: 'serial_number', label: 'Serial number', type: 'gsm.serial', required: true, placeholder: 'e.g. F2LXK1ABHG7F', help: 'Settings → General → About on Apple devices.' },
  brand: { key: 'brand', label: 'Brand', type: 'gsm.brand', required: true, options: GSM_BRANDS },
  model: { key: 'model', label: 'Model', type: 'gsm.model', required: true, placeholder: 'e.g. iPhone 15 or SM-S918B' },
  modelOptional: { key: 'model', label: 'Model', type: 'gsm.model', required: false, placeholder: 'Optional — speeds up processing' },
  carrier: { key: 'carrier', label: 'Carrier', type: 'gsm.carrier', required: true, options: GSM_CARRIERS },
  carrierUS: { key: 'carrier', label: 'Carrier', type: 'gsm.carrier', required: true, options: GSM_CARRIERS.filter((c) => c.value.endsWith('_us')) },
  carrierUK: { key: 'carrier', label: 'Carrier', type: 'gsm.carrier', required: true, options: GSM_CARRIERS.filter((c) => c.value.endsWith('_uk')) },
  country: { key: 'country', label: 'Target country', type: 'country', required: true, placeholder: 'e.g. US' },
} satisfies Record<string, FieldDef>

/* ------------------------------------------------------------------------- */
/*  Categories                                                               */
/* ------------------------------------------------------------------------- */
export const GSM_CATEGORIES = [
  { id: 'cat_imei', name: 'IMEI Checks', slug: 'imei-checks', description: 'Blacklist, full reports and device status checks.', icon: 'scan-barcode' },
  { id: 'cat_carrier', name: 'Carrier & Network', slug: 'carrier-network', description: 'Original carrier, SIM-lock policy and network compatibility.', icon: 'radio-tower' },
  { id: 'cat_device', name: 'Device Information', slug: 'device-information', description: 'Model, specs, manufacture and activation data.', icon: 'smartphone' },
  { id: 'cat_warranty', name: 'Warranty', slug: 'warranty', description: 'Manufacturer warranty and coverage status.', icon: 'badge-check' },
  { id: 'cat_unlock', name: 'Unlock Codes', slug: 'unlock-codes', description: 'Carrier-authorised network unlock codes and official unlocks for eligible devices.', icon: 'key-round' },
  { id: 'cat_serial', name: 'Serial Checks', slug: 'serial-checks', description: 'Serial number validation and lookups.', icon: 'scan-text' },
] as const

/* ------------------------------------------------------------------------- */
/*  Result schemas                                                           */
/* ------------------------------------------------------------------------- */
const tonesClean = { clean: 'success', blacklisted: 'danger', unknown: 'warning' } as const

export const GSM_RESULT_SCHEMAS: Record<string, ResultFieldDef[]> = {
  carrier_check: [
    { key: 'carrier', label: 'Carrier', kind: 'text', primary: true },
    { key: 'status', label: 'Status', kind: 'status', tones: tonesClean },
    { key: 'sim_lock', label: 'SIM-lock', kind: 'status', tones: { unlocked: 'success', locked: 'warning' } },
    { key: 'unlock_eligible', label: 'Unlock eligible', kind: 'boolean' },
    { key: 'model', label: 'Model', kind: 'text' },
  ],
  blacklist: [
    { key: 'status', label: 'GSMA status', kind: 'status', primary: true, tones: tonesClean },
    { key: 'reason', label: 'Reason', kind: 'text' },
    { key: 'registries', label: 'Registries checked', kind: 'text' },
  ],
  full_report: [
    { key: 'model', label: 'Model', kind: 'text', primary: true },
    { key: 'carrier', label: 'Carrier', kind: 'text' },
    { key: 'status', label: 'Blacklist', kind: 'status', tones: tonesClean },
    { key: 'sim_lock', label: 'SIM-lock', kind: 'status', tones: { unlocked: 'success', locked: 'warning' } },
    { key: 'warranty', label: 'Warranty', kind: 'status', tones: { active: 'success', expired: 'neutral' } },
    { key: 'purchase_country', label: 'Purchase country', kind: 'text' },
  ],
  device_info: [
    { key: 'model', label: 'Model', kind: 'text', primary: true },
    { key: 'storage', label: 'Storage', kind: 'text' },
    { key: 'colour', label: 'Colour', kind: 'text' },
    { key: 'manufactured', label: 'Manufactured', kind: 'text' },
  ],
  warranty: [
    { key: 'warranty', label: 'Warranty', kind: 'status', primary: true, tones: { active: 'success', expired: 'neutral' } },
    { key: 'coverage_end', label: 'Coverage ends', kind: 'date' },
    { key: 'purchase_date', label: 'Estimated purchase', kind: 'date' },
  ],
  activation_status: [
    { key: 'activation_lock', label: 'Activation lock', kind: 'status', primary: true, tones: { off: 'success', on: 'warning' } },
    { key: 'first_activation', label: 'First activation', kind: 'date' },
    { key: 'model', label: 'Model', kind: 'text' },
  ],
  compatibility: [
    { key: 'compatibility', label: 'Compatibility', kind: 'status', primary: true, tones: { full: 'success', partial: 'warning', none: 'danger' } },
    { key: 'lte', label: '4G LTE', kind: 'boolean' },
    { key: 'nr5g', label: '5G', kind: 'boolean' },
    { key: 'volte', label: 'VoLTE', kind: 'boolean' },
  ],
  unlock_code: [
    { key: 'code', label: 'Unlock code', kind: 'code', primary: true },
    { key: 'instructions', label: 'How to enter', kind: 'text' },
    { key: 'attempts_remaining', label: 'Attempts remaining', kind: 'text' },
  ],
  official_unlock: [
    { key: 'status', label: 'Unlock status', kind: 'status', primary: true, tones: { unlocked: 'success', pending_carrier: 'warning' } },
    { key: 'carrier_reference', label: 'Carrier reference', kind: 'code' },
    { key: 'instructions', label: 'Next step', kind: 'text' },
  ],
  serial: [
    { key: 'valid', label: 'Serial valid', kind: 'boolean', primary: true },
    { key: 'model', label: 'Model', kind: 'text' },
    { key: 'production_week', label: 'Production week', kind: 'text' },
  ],
}
