import type { Service, ServiceCategory } from '@/types/installation'
import { API_BASE, API_HOST } from '../shared'

export type Lang = 'curl' | 'node' | 'python'

export interface RequestSpec {
  method: 'GET' | 'POST'
  /** Path relative to the API base, e.g. "/orders". */
  path: string
  query?: Record<string, string | number>
  body?: Record<string, unknown>
  idempotent?: boolean
}

const qs = (q?: Record<string, string | number>) => (q && Object.keys(q).length ? `?${new URLSearchParams(Object.entries(q).map(([k, v]) => [k, String(v)])).toString()}` : '')

function indent(text: string, spaces: number) {
  const pad = ' '.repeat(spaces)
  return text
    .split('\n')
    .map((l, i) => (i === 0 ? l : pad + l))
    .join('\n')
}

export function curlSample(r: RequestSpec) {
  const lines = [`curl${r.method === 'GET' ? '' : ` -X ${r.method}`} "${API_BASE}${r.path}${qs(r.query)}"`, `  -H "Authorization: Bearer $RESELLER_API_KEY"`]
  if (r.body) lines.push(`  -H "Content-Type: application/json"`)
  if (r.idempotent) lines.push(`  -H "Idempotency-Key: 5f1c9e2a-7b3d-4c8e-a1f0-9d2b6e4c3a71"`)
  if (r.body) lines.push(`  -d '${indent(JSON.stringify(r.body, null, 2), 2)}'`)
  return lines.join(' \\\n')
}

export function nodeSample(r: RequestSpec) {
  const url = `${API_BASE}${r.path}${qs(r.query)}`
  const headers = [`Authorization: \`Bearer \${process.env.RESELLER_API_KEY}\`,`]
  if (r.body) headers.push(`'Content-Type': 'application/json',`)
  if (r.idempotent) headers.push(`'Idempotency-Key': crypto.randomUUID(),`)
  const opts = [r.method !== 'GET' ? `  method: '${r.method}',` : null, `  headers: {\n    ${headers.join('\n    ')}\n  },`, r.body ? `  body: JSON.stringify(${indent(JSON.stringify(r.body, null, 2), 2)}),` : null].filter(Boolean).join('\n')
  const varName = r.path.startsWith('/orders') ? (r.method === 'POST' || /\/orders\/[^/]+$/.test(r.path) ? 'order' : r.path.endsWith('/result') ? 'result' : 'orders') : r.path.startsWith('/services') ? (r.path === '/services' ? 'services' : 'service') : 'balance'
  return `const res = await fetch('${url}', {\n${opts}\n})\n\nif (!res.ok) throw new Error((await res.json()).error.message)\nconst ${varName} = await res.json()`
}

export function pythonSample(r: RequestSpec) {
  const fn = r.method === 'GET' ? 'get' : 'post'
  const headers = [`"Authorization": f"Bearer {os.environ['RESELLER_API_KEY']}",`]
  if (r.idempotent) headers.push(`"Idempotency-Key": str(uuid.uuid4()),`)
  const args = [`    "${API_BASE}${r.path}",`, `    headers={\n        ${headers.join('\n        ')}\n    },`]
  if (r.query) args.push(`    params={${Object.entries(r.query).map(([k, v]) => `"${k}": ${typeof v === 'number' ? v : `"${v}"`}`).join(', ')}},`)
  if (r.body) args.push(`    json=${indent(JSON.stringify(r.body, null, 4), 4)},`)
  args.push('    timeout=30,')
  const imports = r.idempotent ? 'import os, uuid, requests' : 'import os, requests'
  return `${imports}\n\nres = requests.${fn}(\n${args.join('\n')}\n)\nres.raise_for_status()\ndata = res.json()`
}

export function samplesFor(r: RequestSpec): Record<Lang, string> {
  return { curl: curlSample(r), node: nodeSample(r), python: pythonSample(r) }
}

/* ------------------------------------------------------------------------- */
/*  Categories — stable API slugs for the catalog categories                 */
/* ------------------------------------------------------------------------- */
export const CATEGORY_SLUG: Record<ServiceCategory, string> = {
  'IMEI Services': 'imei_services',
  Unlocking: 'unlocking',
  'Server Services': 'server_services',
  Codes: 'codes',
  'Other Services': 'other_services',
}

export const CATEGORY_SLUGS = Object.values(CATEGORY_SLUG)

export const categorySlug = (c: ServiceCategory) => CATEGORY_SLUG[c] ?? c.toLowerCase().replace(/\s+/g, '_')

/* ------------------------------------------------------------------------- */
/*  IMEI helpers                                                             */
/* ------------------------------------------------------------------------- */
/** Luhn checksum used by the API to reject mistyped IMEIs before an order is charged. */
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

/** Demo IMEIs (all fictional). `TYPO` differs in the check digit and fails Luhn. */
export const DEMO_IMEI = { CLEAN: '356938035643809', TYPO: '356938035643808', BLACKLISTED: '353918104472317', OTHER: '352099001761481' }

/* ------------------------------------------------------------------------- */
/*  Example objects — GSM orders                                             */
/* ------------------------------------------------------------------------- */
const usd = (amount: number) => ({ amount, currency: 'USD' })
const REQ = 'req_8f29c1d07ab34e5f9d2c6b18'

const SVC_IMEI_CHECK = { id: 'SVC-1001', name: 'IMEI Check — Full Report', category: 'imei_services', delivery: 'instant' }
const SVC_IPHONE_UNLOCK = { id: 'SVC-1007', name: 'iPhone Unlock — USA Carriers', category: 'unlocking', delivery: 'async' }

/** Instant: an IMEI check answers synchronously — the result is in the 201 response. */
export const IMEI_CHECK_BODY = { service_id: 'SVC-1001', client_reference: 'MH-CHK-55120', fields: { imei: DEMO_IMEI.CLEAN } }

export const IMEI_CHECK_ORDER = {
  id: 'ord_10481',
  object: 'order',
  number: 10481,
  status: 'success',
  service: SVC_IMEI_CHECK,
  price: usd(0.49),
  client_reference: 'MH-CHK-55120',
  fields: { imei: DEMO_IMEI.CLEAN },
  result: {
    summary: 'iPhone 13 Pro · AT&T (US) · clean · SIM-locked',
    data: { model: 'iPhone 13 Pro', storage: '256GB', purchase_country: 'US', carrier: 'AT&T (US)', sim_lock: 'locked', gsma_blacklist: 'clean', fmi: 'off', warranty: 'expired' },
  },
  error: null,
  created_at: '2026-10-01T09:38:02Z',
  updated_at: '2026-10-01T09:38:05Z',
  completed_at: '2026-10-01T09:38:05Z',
}

/** Async: an iPhone network unlock is accepted now and completes later (webhook). */
export const ORDER_CREATE_BODY = { service_id: 'SVC-1007', client_reference: 'MH-UNL-20931', fields: { imei: DEMO_IMEI.CLEAN, network: 'att_us' } }

export const ORDER_OBJECT = {
  id: 'ord_10482',
  object: 'order',
  number: 10482,
  status: 'processing',
  service: SVC_IPHONE_UNLOCK,
  price: usd(22.96),
  client_reference: 'MH-UNL-20931',
  fields: { imei: DEMO_IMEI.CLEAN, network: 'att_us' },
  turnaround_seconds: { min: 3600, max: 21600 },
  result: null,
  error: null,
  created_at: '2026-10-01T09:41:12Z',
  updated_at: '2026-10-01T09:41:12Z',
  completed_at: null,
}

const UNLOCK_RESULT_DATA = {
  unlocked: true,
  method: 'remote',
  carrier: 'AT&T (US)',
  carrier_reference: 'UNL-7F3A9C',
  instructions: 'Insert a non-AT&T SIM and connect to Wi-Fi to finish activation.',
}

export const ORDER_COMPLETED = {
  ...ORDER_OBJECT,
  status: 'success',
  result: { summary: 'Unlocked — whitelisted on carrier database', data: UNLOCK_RESULT_DATA },
  updated_at: '2026-10-01T11:58:40Z',
  completed_at: '2026-10-01T11:58:40Z',
}

export const ORDER_RESULT = {
  id: 'ord_10482',
  object: 'order_result',
  status: 'success',
  summary: 'Unlocked — whitelisted on carrier database',
  data: UNLOCK_RESULT_DATA,
  completed_at: '2026-10-01T11:58:40Z',
}

/** Supplier rejection: not an HTTP error — the order fails and the charge is released. */
export const ORDER_REJECTED = {
  ...ORDER_OBJECT,
  id: 'ord_10486',
  number: 10486,
  status: 'failed',
  client_reference: 'MH-UNL-20937',
  fields: { imei: DEMO_IMEI.BLACKLISTED, network: 'tmobile_us' },
  error: { code: 'provider_rejected', message: 'IMEI is blacklisted — carrier refuses unlock', gsma_status: 'blacklisted' },
  refunded_amount: usd(22.96),
  updated_at: '2026-10-01T09:43:02Z',
  completed_at: '2026-10-01T09:43:02Z',
}

export const BLACKLIST_ORDER = {
  id: 'ord_10479',
  object: 'order',
  number: 10479,
  status: 'success',
  service: { id: 'SVC-1002', name: 'IMEI Blacklist Check (GSMA)', category: 'imei_services', delivery: 'instant' },
  price: usd(0.29),
  client_reference: 'MH-CHK-55117',
  fields: { imei: DEMO_IMEI.OTHER },
  result: { summary: 'CLEAN — not on the GSMA blacklist', data: { gsma_status: 'clean', reason: 'none', checked_registries: 42 } },
  error: null,
  created_at: '2026-10-01T09:30:51Z',
  updated_at: '2026-10-01T09:30:53Z',
  completed_at: '2026-10-01T09:30:53Z',
}

export const BALANCE_OBJECT = {
  object: 'balance',
  balance: usd(4820.0),
  credit_limit: usd(2500.0),
  available: usd(7320.0),
  low_balance_threshold: usd(100.0),
  updated_at: '2026-10-01T09:41:12Z',
}

export const ERROR_422 = {
  error: {
    type: 'invalid_request_error',
    code: 'validation_failed',
    reason: 'luhn_failed',
    message: `IMEI ${DEMO_IMEI.TYPO} failed the Luhn checksum — check the last digit.`,
    field: 'imei',
    request_id: REQ,
    doc_url: `${API_HOST}/docs/api#errors`,
  },
}

export const ERROR_402 = {
  error: {
    type: 'invalid_request_error',
    code: 'insufficient_balance',
    message: 'Balance cannot cover iPhone Unlock — USA Carriers ($22.96). Top up or ask for a credit line.',
    required: usd(22.96),
    available: usd(14.2),
    request_id: 'req_31b07c2e9d4a4f18b6e0',
  },
}

export const ERROR_429 = {
  error: { type: 'rate_limit_error', code: 'rate_limited', message: 'Rate limit of 600 requests/min exceeded.', retry_after: 12, request_id: 'req_51c0e7a2b9d84f36a1e2' },
}

export const ERROR_422_NETWORK = {
  error: {
    type: 'invalid_request_error',
    code: 'validation_failed',
    reason: 'invalid_option',
    message: 'network must be one of att_us, tmobile_us, verizon_us, cricket_us, sprint_us.',
    field: 'network',
    request_id: 'req_0c4e7a91d2b84f5ea713',
  },
}

/** Reseller-facing representation of a service (as returned by GET /services). */
export function serviceToApi(s: Service, opts?: { fields?: boolean }) {
  return {
    id: s.id,
    object: 'service',
    name: s.name,
    category: categorySlug(s.category),
    delivery: s.delivery,
    price: usd(s.price),
    turnaround_seconds: { min: s.turnaround.min, max: s.turnaround.max },
    ...(opts?.fields === false
      ? { fields_count: s.fields.length }
      : {
          fields: s.fields.map((f) => ({
            key: f.key,
            type: f.type,
            required: f.required,
            ...(f.key === 'imei' && f.validation?.pattern === '^\\d{15}$' ? { checksum: 'luhn' } : {}),
            ...(f.validation?.pattern ? { pattern: f.validation.pattern } : {}),
            ...(f.validation?.options ? { options: f.validation.options } : {}),
            ...(f.validation?.example ? { example: f.validation.example } : {}),
          })),
        }),
  }
}

export const json = (v: unknown) => JSON.stringify(v, null, 2)
