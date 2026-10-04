/**
 * Demo result generator for simulated suppliers.
 * Driven by the service revision's result schema (from the GSM pack), seeded by
 * the input so the same IMEI always produces the same answer.
 */
import { createRng } from '@/lib/random'
import { fingerprint } from '@/core/ids'
import { carrierLabel } from '@/core/verticals/gsm'
import type { OrderResult, ResultFieldDef } from '@/core/domain'

/** IMEIs with fixed demo answers (listed in the Demo control center). */
export const DEMO_IMEIS: { imei: string; story: string; fixed: Record<string, string | boolean> }[] = [
  { imei: '356938035643809', story: 'Clean iPhone 15 on T-Mobile', fixed: { carrier: 'T-Mobile', status: 'clean', sim_lock: 'locked', unlock_eligible: true, model: 'iPhone 15 (A3090)', warranty: 'active' } },
  { imei: '353918106523455', story: 'Blacklisted device (reported lost)', fixed: { status: 'blacklisted', reason: 'Reported lost — GSMA', carrier: 'AT&T', model: 'iPhone 13 (A2633)' } },
  { imei: '490154203237518', story: 'Unlocked Samsung, warranty expired', fixed: { carrier: 'Vodafone UK', status: 'clean', sim_lock: 'unlocked', model: 'Galaxy S23 (SM-S911B)', warranty: 'expired' } },
]

const MODELS = ['iPhone 15 (A3090)', 'iPhone 15 Pro (A3102)', 'iPhone 14 (A2882)', 'iPhone 13 (A2633)', 'Galaxy S24 (SM-S921B)', 'Galaxy S23 (SM-S911B)', 'Galaxy A54 (SM-A546B)', 'Pixel 8 (GKWS6)', 'Redmi Note 13 (23129RAA4G)', 'Moto G84 (XT2347-2)']
const CARRIERS = ['T-Mobile', 'AT&T', 'Verizon', 'EE UK', 'Vodafone UK', 'O2 UK', 'Orange FR', 'Telekom DE', 'Movistar ES', 'Rogers CA']
const COUNTRIES = ['United States', 'United Kingdom', 'Germany', 'France', 'Spain', 'Canada', 'UAE', 'Turkey']

export function generateResult(schema: ResultFieldDef[], input: Record<string, string>, salt: string, at: string): OrderResult {
  const key = input.imei ?? input.serial_number ?? input.model ?? JSON.stringify(input)
  const rng = createRng(parseInt(fingerprint(`${key}|${salt}`), 16))
  const demo = DEMO_IMEIS.find((d) => d.imei === input.imei)?.fixed ?? {}
  const negative = rng.bool(0.06)
  const fields: Record<string, string | number | boolean> = {}
  const y = new Date(at).getFullYear()
  const date = (offsetMonths: number) => {
    const d = new Date(at)
    d.setMonth(d.getMonth() + offsetMonths)
    return d.toISOString().slice(0, 10)
  }
  for (const f of schema) {
    if (demo[f.key] !== undefined) {
      fields[f.key] = demo[f.key]!
      continue
    }
    switch (f.key) {
      case 'carrier':
        fields.carrier = input.carrier ? carrierLabel(input.carrier).replace(/ \((US)\)$/, '') : rng.pick(CARRIERS)
        break
      case 'status':
        fields.status = schema.some((x) => x.key === 'carrier_reference') ? 'unlocked' : negative ? 'blacklisted' : 'clean'
        break
      case 'sim_lock':
        fields.sim_lock = rng.bool(0.55) ? 'locked' : 'unlocked'
        break
      case 'unlock_eligible':
        fields.unlock_eligible = !negative
        break
      case 'model':
        fields.model = input.model || rng.pick(MODELS)
        break
      case 'reason':
        fields.reason = negative ? rng.pick(['Reported lost', 'Reported stolen', 'Unpaid bill']) : 'None'
        break
      case 'registries':
        fields.registries = '42 national registries'
        break
      case 'storage':
        fields.storage = rng.pick(['128 GB', '256 GB', '512 GB'])
        break
      case 'colour':
        fields.colour = rng.pick(['Black', 'Blue', 'Midnight', 'Silver', 'Green'])
        break
      case 'manufactured':
        fields.manufactured = `${y - rng.int(0, 3)}-W${String(rng.int(1, 52)).padStart(2, '0')}`
        break
      case 'warranty':
        fields.warranty = rng.bool(0.6) ? 'active' : 'expired'
        break
      case 'coverage_end':
        fields.coverage_end = date(rng.int(-14, 18))
        break
      case 'purchase_date':
        fields.purchase_date = date(-rng.int(3, 30))
        break
      case 'purchase_country':
        fields.purchase_country = rng.pick(COUNTRIES)
        break
      case 'activation_lock':
        fields.activation_lock = rng.bool(0.82) ? 'off' : 'on'
        break
      case 'first_activation':
        fields.first_activation = date(-rng.int(2, 36))
        break
      case 'compatibility':
        fields.compatibility = negative ? 'partial' : 'full'
        break
      case 'lte':
        fields.lte = true
        break
      case 'nr5g':
        fields.nr5g = !negative
        break
      case 'volte':
        fields.volte = rng.bool(0.85)
        break
      case 'code':
        fields.code = Array.from({ length: rng.pick([8, 16]) }, () => rng.int(0, 9)).join('')
        break
      case 'instructions':
        fields.instructions = schema.some((x) => x.key === 'code') ? 'Insert a non-accepted SIM card and enter the code when prompted.' : 'Connect to Wi-Fi and restart with a SIM from another carrier.'
        break
      case 'attempts_remaining':
        fields.attempts_remaining = String(rng.int(3, 10))
        break
      case 'carrier_reference':
        fields.carrier_reference = `UNL-${rng.hex(6).toUpperCase()}`
        break
      case 'valid':
        fields.valid = !negative
        break
      case 'production_week':
        fields.production_week = `${y - rng.int(0, 3)}-W${String(rng.int(1, 52)).padStart(2, '0')}`
        break
      default:
        fields[f.key] = '—'
    }
  }
  const primary = schema.find((f) => f.primary) ?? schema[0]
  const second = schema.find((f) => f.kind === 'status' && f !== primary)
  const fmt = (v: unknown) => (typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v).replace(/^\w/, (c) => c.toUpperCase()))
  const summary = [primary ? fmt(fields[primary.key]) : 'Completed', second ? fmt(fields[second.key]) : null].filter(Boolean).join(' · ')
  return { fields, summary, receivedAt: at, source: 'supplier' }
}
