/**
 * Order-engine helpers shared by the Orders list and Order detail screens.
 */
import { useEffect, useRef, useState } from 'react'
import { duration, ms, num, titleCase } from '@/lib/format'
import type { Tone } from '@/types/common'
import type { OrderAttempt, OrderChannel, OrderRow, OrderStatus, ServiceCategory, ServiceField } from '@/types/installation'

export const IN_FLIGHT: OrderStatus[] = ['created', 'processing', 'pending']
export const isInFlight = (s: OrderStatus) => IN_FLIGHT.includes(s)

export const CHANNEL_LABEL: Record<OrderChannel, string> = { api: 'Reseller API', website: 'Website', admin: 'Admin' }

export const CATEGORY_ORDER: ServiceCategory[] = ['IMEI Services', 'Unlocking', 'Server Services', 'Codes', 'Other Services']

/** Who placed the order, as shown in tables. */
export function clientLabel(o: Pick<OrderRow, 'resellerName' | 'channel'>) {
  if (o.resellerName) return o.resellerName
  return o.channel === 'website' ? 'Website' : o.channel === 'admin' ? 'Admin' : 'API client'
}

/** Human span with millisecond precision for short intervals. */
export function span(v: number) {
  const x = Math.max(0, v)
  return x < 60_000 ? ms(x) : duration(x / 1000)
}

/** Realised (or projected, for in-flight orders) margin. `null` when not meaningful. */
export function marginOf(o: Pick<OrderRow, 'status' | 'price' | 'cost'>): number | null {
  if (o.status === 'success') return +(o.price - o.cost).toFixed(2)
  if (o.status === 'refunded') return -o.cost
  if (isInFlight(o.status) && o.cost > 0) return +(o.price - o.cost).toFixed(2)
  return null
}

export const OUTCOME: Record<OrderAttempt['outcome'], { label: string; tone: Tone }> = {
  success: { label: 'Accepted', tone: 'success' },
  timeout: { label: 'Timed out', tone: 'warning' },
  error: { label: 'Upstream error', tone: 'warning' },
  rejected: { label: 'Rejected', tone: 'danger' },
  in_flight: { label: 'In flight', tone: 'accent' },
}

/* ------------------------------------------------------------------ */
/*  GSM formatting                                                     */
/* ------------------------------------------------------------------ */
const compact = (v: string) => v.replace(/[\s-]/g, '')

export const isImei = (v: string | undefined | null) => !!v && /^\d{15}$/.test(compact(v))

/** `35 693803 564380 9` — reporting body (TAC 2+6) · serial (6) · Luhn check digit. */
export function formatImei(v: string) {
  const d = compact(v)
  if (!/^\d{15}$/.test(d)) return v
  return `${d.slice(0, 2)} ${d.slice(2, 8)} ${d.slice(8, 14)} ${d.slice(14)}`
}

/** Same grouping, applied progressively while an IMEI is being typed. */
export function groupImeiPartial(d: string) {
  return [d.slice(0, 2), d.slice(2, 8), d.slice(8, 14), d.slice(14, 15)].filter(Boolean).join(' ')
}

/** Luhn checksum over a 15-digit IMEI (the 15th digit is the check digit). */
export function luhnValid(v: string) {
  const d = compact(v)
  if (!/^\d{15}$/.test(d)) return false
  let sum = 0
  for (let i = 0; i < 15; i++) {
    let n = Number(d[14 - i])
    if (i % 2 === 1) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
  }
  return sum % 10 === 0
}

function luhnDigit(body14: string) {
  let sum = 0
  for (let i = 0; i < 14; i++) {
    let n = Number(body14[13 - i])
    if (i % 2 === 0) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
  }
  return String((10 - (sum % 10)) % 10)
}

/** Luhn-valid test IMEI on a realistic TAC (DEMO — not a real handset). */
export function testImei() {
  const tacs = ['35693803', '35332411', '35391805', '35407115', '86691104', '35875610']
  const tac = tacs[Math.floor(Math.random() * tacs.length)]!
  const serial = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
  return `${tac}${serial}${luhnDigit(tac + serial)}`
}

const NETWORKS: Record<string, string> = {
  att_us: 'AT&T',
  tmobile_us: 'T-Mobile',
  verizon_us: 'Verizon',
  cricket_us: 'Cricket Wireless',
  sprint_us: 'Sprint',
  ee_uk: 'EE',
  vodafone_uk: 'Vodafone',
  o2_uk: 'O2',
  three_uk: 'Three',
  tesco_uk: 'Tesco Mobile',
  orange_fr: 'Orange',
  sfr_fr: 'SFR',
  telekom_de: 'Telekom',
  vodafone_de: 'Vodafone',
  movistar_es: 'Movistar',
  kpn_nl: 'KPN',
  tim_it: 'TIM',
}

/** `att_us` → `AT&T (US)`; free-text networks are returned as entered. */
export function networkLabel(code: string) {
  const name = NETWORKS[code]
  if (!name) return code
  return `${name} (${code.split('_').at(-1)!.toUpperCase()})`
}

const BRANDS: Record<string, string> = { apple: 'Apple', samsung: 'Samsung', xiaomi: 'Xiaomi', huawei: 'Huawei', motorola: 'Motorola', google: 'Google Pixel', other: 'Other brand' }

/** Display label for an enum / country option of a service field. */
export function optionLabel(f: Pick<ServiceField, 'key' | 'type'>, v: string) {
  if (f.key === 'network') return networkLabel(v)
  if (f.key === 'brand') return BRANDS[v] ?? titleCase(v)
  if (f.type === 'country') return `${v} — ${countryName(v)}`
  return titleCase(v)
}

/** Common model codes offered as suggestions on model inputs (demo list). */
const MODELS: Record<'samsung' | 'xiaomi' | 'huawei' | 'codes' | 'other', string[]> = {
  samsung: ['SM-S918B', 'SM-S911B', 'SM-A546B', 'SM-A346B', 'SM-G991B', 'SM-A145F'],
  xiaomi: ['2201123G', '23049PCD8G', 'M2101K6G', '22111317G'],
  huawei: ['ANE-LX1', 'E5577s-321', 'VOG-L29'],
  codes: ['TCL 30 SE', 'ZTE Blade A52', 'Alcatel 1B', 'XT2235-2'],
  other: ['SM-S918B', 'iPhone 15 Pro', 'Pixel 8', 'XT2235-2'],
}

export function modelSuggestions(tags: string[]) {
  for (const t of ['samsung', 'xiaomi', 'huawei', 'codes'] as const) if (tags.includes(t)) return MODELS[t]
  return MODELS.other
}

/** The identifier an operator recognises an order by (IMEI, serial, phone number or model). */
export function deviceOf(input: Record<string, string>): { label: string; value: string; display: string } | null {
  const imei = input.imei
  if (imei) return isImei(imei) ? { label: 'IMEI', value: compact(imei), display: formatImei(imei) } : { label: 'Serial', value: imei, display: imei }
  if (input.serial_number) return { label: 'Serial', value: input.serial_number, display: input.serial_number }
  if (input.phone_number) return { label: 'MSISDN', value: input.phone_number, display: input.phone_number }
  if (input.model) return { label: 'Model', value: input.model, display: input.model }
  return null
}

/** Secondary order context shown next to the device: model, network, brand, country. */
export function deviceContext(input: Record<string, string>) {
  const parts: string[] = []
  if (input.model && (input.imei || input.serial_number)) parts.push(input.model)
  if (input.network) parts.push(networkLabel(input.network))
  if (input.brand) parts.push(BRANDS[input.brand] ?? input.brand)
  if (input.country) parts.push(input.country)
  return parts
}

/* ------------------------------------------------------------------ */
/*  Supplier results → readable GSM verdicts                           */
/* ------------------------------------------------------------------ */
type Raw = string | number | boolean

export interface ResultCode {
  key: string
  label: string
  name: string
  value: string
}
export interface ResultVerdict {
  key: string
  label: string
  value: string
  tone: Tone
}
export interface ResultFact {
  key: string
  label: string
  value: string
  mono?: boolean
  copy?: boolean
}
export interface ReadableResult {
  headline: string
  note?: string
  tone: Tone
  codes: ResultCode[]
  verdicts: ResultVerdict[]
  facts: ResultFact[]
  attemptsRemaining?: number
}

const CODES: Record<string, { label: string; name: string }> = {
  nck: { label: 'NCK', name: 'Network Control Key' },
  mck: { label: 'MCK', name: 'Master Control Key' },
  sp_code: { label: 'SP', name: 'Service Provider code' },
  nsck: { label: 'NSCK', name: 'Network Subset Control Key' },
}

const yes = (v: Raw) => v === true || v === 'true'
const up = (v: Raw) => String(v).replace(/_/g, ' ').toUpperCase()
const blacklist = (v: Raw): Omit<ResultVerdict, 'key'> => (v === 'blacklisted' ? { label: 'GSMA blacklist', value: 'BLACKLISTED', tone: 'danger' } : { label: 'GSMA blacklist', value: 'CLEAN', tone: 'success' })

const VERDICTS: Record<string, (v: Raw) => Omit<ResultVerdict, 'key'>> = {
  gsma_status: blacklist,
  gsma_blacklist: blacklist,
  fmi: (v) => (v === 'on' ? { label: 'Find My iPhone', value: 'FMI: ON', tone: 'danger' } : { label: 'Find My iPhone', value: 'FMI: OFF', tone: 'success' }),
  icloud_status: (v) => (v === 'clean' ? { label: 'iCloud', value: 'CLEAN', tone: 'success' } : { label: 'iCloud', value: up(v), tone: 'danger' }),
  sim_lock: (v) => (v === 'unlocked' ? { label: 'SIM-lock', value: 'UNLOCKED', tone: 'success' } : { label: 'SIM-lock', value: 'LOCKED', tone: 'warning' }),
  unlock_eligible: (v) => (yes(v) ? { label: 'Unlock eligibility', value: 'ELIGIBLE', tone: 'success' } : { label: 'Unlock eligibility', value: 'NOT ELIGIBLE', tone: 'danger' }),
  unlocked: (v) => (yes(v) ? { label: 'Network lock', value: 'UNLOCKED', tone: 'success' } : { label: 'Network lock', value: 'LOCKED', tone: 'warning' }),
  frp: (v) => (v === 'removed' ? { label: 'FRP lock', value: 'REMOVED', tone: 'success' } : { label: 'FRP lock', value: up(v), tone: 'warning' }),
  mi_account: (v) => (v === 'removed' ? { label: 'Mi Account', value: 'REMOVED', tone: 'success' } : { label: 'Mi Account', value: up(v), tone: 'warning' }),
  mdm: (v) => (v === 'removed' ? { label: 'MDM profile', value: 'REMOVED', tone: 'success' } : { label: 'MDM profile', value: up(v), tone: 'warning' }),
  warranty: (v) => (v === 'active' ? { label: 'Warranty', value: 'ACTIVE', tone: 'success' } : { label: 'Warranty', value: up(v), tone: 'neutral' }),
  in_warranty: (v) => (yes(v) ? { label: 'Warranty', value: 'IN WARRANTY', tone: 'success' } : { label: 'Warranty', value: 'OUT OF WARRANTY', tone: 'neutral' }),
  applecare: (v) => (yes(v) ? { label: 'AppleCare', value: 'COVERED', tone: 'success' } : { label: 'AppleCare', value: 'NONE', tone: 'neutral' }),
  replaced: (v) => (yes(v) ? { label: 'Device', value: 'REPLACED', tone: 'warning' } : { label: 'Device', value: 'ORIGINAL', tone: 'success' }),
  valid: (v) => (yes(v) ? { label: 'Serial', value: 'VALID', tone: 'success' } : { label: 'Serial', value: 'INVALID', tone: 'danger' }),
  lte: (v) => (yes(v) ? { label: '4G LTE', value: 'SUPPORTED', tone: 'success' } : { label: '4G LTE', value: 'NOT SUPPORTED', tone: 'warning' }),
  nr5g: (v) => (yes(v) ? { label: '5G NR', value: 'SUPPORTED', tone: 'success' } : { label: '5G NR', value: 'NOT SUPPORTED', tone: 'warning' }),
  ported: (v) => (yes(v) ? { label: 'Number', value: 'PORTED', tone: 'neutral' } : { label: 'Number', value: 'ORIGINAL NETWORK', tone: 'neutral' }),
  reachable: (v) => (yes(v) ? { label: 'HLR', value: 'REACHABLE', tone: 'success' } : { label: 'HLR', value: 'UNREACHABLE', tone: 'warning' }),
}

const FACTS: Record<string, { label: string; mono?: boolean; copy?: boolean; format?: (v: Raw) => string | null }> = {
  model: { label: 'Model', mono: true },
  carrier: { label: 'Carrier' },
  original_carrier: { label: 'Original carrier' },
  purchase_country: { label: 'Purchase country', format: (v) => `${v} · ${countryName(String(v))}` },
  storage: { label: 'Storage' },
  manufactured: { label: 'Manufactured', mono: true },
  method: { label: 'Unlock method', format: (v) => titleCase(String(v)) },
  carrier_reference: { label: 'Carrier reference', mono: true, copy: true },
  server_job: { label: 'Server job', mono: true, copy: true },
  region: { label: 'Region' },
  activation_policy: { label: 'Activation policy' },
  line_type: { label: 'Line type', format: (v) => titleCase(String(v)) },
  checked_registries: { label: 'Registries checked', format: (v) => num(Number(v)) },
  reason: { label: 'Reason', format: (v) => (v === 'none' ? null : titleCase(String(v))) },
  purchase_date_estimated: { label: 'Purchase date', format: (v) => (yes(v) ? 'Estimated' : 'Confirmed') },
  first_activation: { label: 'First activation', format: (v) => (yes(v) ? 'Recorded' : 'Not activated') },
}

const SKIP = new Set(['ok', 'attempts_remaining'])
const sentence = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s)

/** Turn a supplier result payload into what an order desk shows: verdicts, unlock codes and facts. */
export function readResult(result: { summary: string; data: Record<string, Raw> }): ReadableResult {
  const codes: ResultCode[] = []
  const verdicts: ResultVerdict[] = []
  const facts: ResultFact[] = []
  for (const [k, v] of Object.entries(result.data)) {
    if (CODES[k]) codes.push({ key: k, ...CODES[k]!, value: String(v) })
    else if (VERDICTS[k]) verdicts.push({ key: k, ...VERDICTS[k]!(v) })
    else if (!SKIP.has(k)) {
      const def = FACTS[k]
      const value = def?.format ? def.format(v) : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : typeof v === 'number' ? num(v) : String(v)
      if (value != null) facts.push({ key: k, label: def?.label ?? titleCase(k), value, mono: def?.mono, copy: def?.copy })
    }
  }
  const attempts = result.data.attempts_remaining
  const attemptsRemaining = typeof attempts === 'number' ? attempts : undefined

  if (codes.length) {
    const names = codes.map((c) => c.label)
    return {
      headline: codes.length > 1 ? `${names.join(' + ')} codes delivered` : `${names[0] === 'SP' ? 'SP code' : `${names[0]} code`} delivered`,
      note: 'Insert a non-accepted SIM, then enter the code when the device asks for the network unlock PIN.',
      tone: 'success',
      codes,
      verdicts,
      facts,
      attemptsRemaining,
    }
  }
  const [head, ...rest] = result.summary.split(' — ')
  const has = (t: Tone) => verdicts.some((x) => x.tone === t)
  // A negative finding (blacklisted, FMI on…) colours the whole result; purely informational results stay neutral.
  const tone: Tone = has('danger') ? 'danger' : has('success') ? 'success' : has('warning') ? 'warning' : verdicts.length ? 'neutral' : 'success'
  return { headline: head || result.summary, note: rest.length ? sentence(rest.join(' — ')) : undefined, tone, codes, verdicts, facts, attemptsRemaining }
}

/* ------------------------------------------------------------------ */
/*  Dynamic form validation (mirrors Core's server-side field rules)    */
/* ------------------------------------------------------------------ */
export function validateField(f: ServiceField, raw: string | undefined): string | null {
  const v = (raw ?? '').trim()
  if (!v) return f.required ? `${f.label} is required` : null
  const rule = f.validation
  if (rule?.options && (f.type === 'enum' || f.type === 'country') && !rule.options.includes(v)) return 'Choose one of the listed options'
  if (rule?.minLength != null && v.length < rule.minLength) return `At least ${rule.minLength} characters`
  if (rule?.maxLength != null && v.length > rule.maxLength) return `At most ${rule.maxLength} characters`
  if (rule?.pattern) {
    try {
      if (!new RegExp(rule.pattern).test(v)) return rule.message ?? `Doesn’t match the expected format${rule.example ? ` (e.g. ${rule.example})` : ''}`
    } catch {
      /* malformed pattern — let the server decide */
    }
  }
  // IMEIs carry a Luhn check digit — catch typos before the order reaches a supplier.
  if (f.key === 'imei' && /^\d{15}$/.test(v) && !luhnValid(v)) return 'Luhn checksum failed — check the last digit'
  return null
}

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' })
  } catch {
    return null
  }
})()

export function countryName(code: string) {
  try {
    return regionNames?.of(code) ?? code
  } catch {
    return code
  }
}

/* ------------------------------------------------------------------ */
/*  Hooks                                                              */
/* ------------------------------------------------------------------ */
export function useDebounced<T>(value: T, delay = 250) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

/** Re-render on an interval while `enabled` (for live elapsed timers). */
export function useNow(enabled: boolean, interval = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), interval)
    return () => clearInterval(t)
  }, [enabled, interval])
  return enabled ? now : Date.now()
}

export type ArrivalPhase = 'new' | 'fading'

/**
 * Tracks rows that appear between two refreshes of the same query so they can
 * be briefly highlighted. Re-baselines whenever the query scope changes.
 */
export function useArrivals<T>(rows: T[] | undefined, key: (r: T) => string, opts: { enabled: boolean; scope: string; placeholder: boolean }) {
  const seen = useRef<Set<string> | null>(null)
  const scopeRef = useRef<string | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const [marks, setMarks] = useState<Record<string, ArrivalPhase>>({})

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  useEffect(() => {
    if (!rows || opts.placeholder) return
    const ids = rows.map(key)
    if (!seen.current || scopeRef.current !== opts.scope) {
      seen.current = new Set(ids)
      scopeRef.current = opts.scope
      return
    }
    const fresh = ids.filter((id) => !seen.current!.has(id))
    fresh.forEach((id) => seen.current!.add(id))
    if (!opts.enabled || fresh.length === 0) return
    setMarks((m) => ({ ...m, ...Object.fromEntries(fresh.map((id) => [id, 'new' as const])) }))
    timers.current.push(
      setTimeout(() => setMarks((m) => ({ ...m, ...Object.fromEntries(fresh.filter((id) => id in m).map((id) => [id, 'fading' as const])) })), 1600),
      setTimeout(
        () =>
          setMarks((m) => {
            const next = { ...m }
            fresh.forEach((id) => delete next[id])
            return next
          }),
        3400,
      ),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, opts.scope, opts.placeholder, opts.enabled])

  return marks
}
