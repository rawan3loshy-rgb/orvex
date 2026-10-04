/**
 * GSM order-input presets used when building a service schema.
 * Mirrors the field definitions of the demo catalog so new services validate
 * exactly like the seeded ones (IMEI with Luhn, carrier enums, E.164 phone…).
 */
import type { ServiceField } from '@/types/installation'

export const US_NETWORKS = ['att_us', 'tmobile_us', 'verizon_us', 'cricket_us', 'sprint_us']
export const UK_NETWORKS = ['ee_uk', 'vodafone_uk', 'o2_uk', 'three_uk', 'tesco_uk']
export const EU_NETWORKS = ['orange_fr', 'sfr_fr', 'telekom_de', 'vodafone_de', 'movistar_es', 'kpn_nl', 'tim_it']
export const BRANDS = ['apple', 'samsung', 'xiaomi', 'huawei', 'motorola', 'google', 'other']
const COUNTRY_CODES = ['US', 'GB', 'DE', 'FR', 'NL', 'ES', 'IT', 'SE', 'PL', 'AE', 'SG', 'BR', 'CA', 'TR', 'CH']

export interface FieldPreset {
  id: string
  label: string
  hint: string
  field: ServiceField
}

export const FIELD_PRESETS: FieldPreset[] = [
  {
    id: 'imei',
    label: 'IMEI',
    hint: '15 digits · Luhn',
    field: { key: 'imei', label: 'IMEI', type: 'string', required: true, description: '15-digit IMEI (dial *#06#). The Luhn checksum is validated before routing.', validation: { pattern: '^\\d{15}$', minLength: 15, maxLength: 15, example: '356938035643809', message: 'Exactly 15 digits' } },
  },
  {
    id: 'imei_or_serial',
    label: 'IMEI or serial',
    hint: 'IMEI or 10–12 char serial',
    field: { key: 'imei', label: 'IMEI or serial number', type: 'string', required: true, description: '15-digit IMEI or a 10–12 character manufacturer serial.', validation: { pattern: '^(\\d{15}|[A-Z0-9]{10,12})$', minLength: 10, maxLength: 15, example: '356938035643809', message: '15-digit IMEI or 10–12 character serial' } },
  },
  {
    id: 'serial',
    label: 'Serial number',
    hint: '8–14 chars',
    field: { key: 'serial_number', label: 'Serial number', type: 'string', required: true, description: 'Manufacturer serial number as shown in Settings → About.', validation: { pattern: '^[A-Z0-9]{8,14}$', minLength: 8, maxLength: 14, example: 'F2LXK1ABHG7F', message: '8–14 uppercase letters or digits' } },
  },
  {
    id: 'model',
    label: 'Model',
    hint: 'e.g. SM-S918B',
    field: { key: 'model', label: 'Model', type: 'string', required: true, description: 'Manufacturer model code.', validation: { pattern: '^[A-Za-z0-9 -]{3,24}$', minLength: 3, maxLength: 24, example: 'SM-S918B', message: '3–24 letters, digits, spaces or dashes' } },
  },
  {
    id: 'brand',
    label: 'Brand',
    hint: `enum · ${BRANDS.length} brands`,
    field: { key: 'brand', label: 'Brand', type: 'enum', required: true, validation: { options: BRANDS, example: 'samsung' } },
  },
  {
    id: 'network_us',
    label: 'Locked network · US',
    hint: 'AT&T, T-Mobile, Verizon…',
    field: { key: 'network', label: 'Locked to network', type: 'enum', required: true, description: 'US carrier the device is locked to.', validation: { options: US_NETWORKS, example: 'att_us' } },
  },
  {
    id: 'network_uk',
    label: 'Locked network · UK',
    hint: 'EE, Vodafone, O2, Three…',
    field: { key: 'network', label: 'Locked to network', type: 'enum', required: true, description: 'UK carrier the device is locked to.', validation: { options: UK_NETWORKS, example: 'ee_uk' } },
  },
  {
    id: 'network_eu',
    label: 'Locked network · EU',
    hint: 'Orange, Telekom, Movistar…',
    field: { key: 'network', label: 'Locked to network', type: 'enum', required: true, description: 'EU carrier the device is locked to.', validation: { options: EU_NETWORKS, example: 'orange_fr' } },
  },
  {
    id: 'country',
    label: 'Country',
    hint: 'ISO alpha-2',
    field: { key: 'country', label: 'Country', type: 'country', required: true, description: 'ISO 3166-1 alpha-2 country of the carrier.', validation: { pattern: '^[A-Z]{2}$', options: COUNTRY_CODES, example: 'FR', message: 'Two-letter ISO country code' } },
  },
  {
    id: 'phone',
    label: 'Phone number',
    hint: 'E.164 · sensitive',
    field: { key: 'phone_number', label: 'Phone number', type: 'phone', required: true, sensitive: true, description: 'Number to look up on the carrier HLR.', validation: { pattern: '^\\+[1-9]\\d{7,14}$', example: '+447700900123', message: 'E.164 format' } },
  },
]

export const presetById = (id: string) => FIELD_PRESETS.find((p) => p.id === id)

/** Luhn (mod 10) checksum — the last digit of every IMEI is a Luhn check digit. */
export function luhnValid(digits: string) {
  if (!/^\d+$/.test(digits)) return false
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

/** IMEI fields get an extra Luhn check on top of their pattern. */
export function isImeiField(f: Pick<ServiceField, 'key' | 'label'>) {
  return f.key === 'imei' || /\bimei\b/i.test(f.label)
}

/** Default turnaround (seconds) suggested for a new service of a category. */
export const SUGGESTED_TURNAROUND: Record<string, { min: number; max: number }> = {
  'IMEI Services': { min: 2, max: 10 },
  Unlocking: { min: 1800, max: 6 * 3600 },
  'Server Services': { min: 600, max: 4 * 3600 },
  Codes: { min: 300, max: 3600 },
  'Other Services': { min: 1, max: 5 },
}
