/**
 * Native API v1 endpoint catalogue — drives the reference docs AND the console
 * presets, so both always describe the same 10 endpoints.
 */
import type { ApiScope } from '@/types/installation'
import { API_BASE, API_HOST } from '../helpers'
import type { Lang } from './langContext'

export const DEMO_IMEI = '356938035643809'
export const BAD_LUHN_IMEI = '356938035643808'
export const ISO = '2026-10-04T09:41:12Z'

export interface EndpointDef {
  id: string
  method: 'GET' | 'POST'
  /** Path with `:id` placeholder. */
  path: string
  title: string
  summary: string
  scope: ApiScope
  /** Example path value for `:id`. */
  example?: string
  query?: Record<string, string>
  body?: unknown
  idempotent?: boolean
  response: { status: number; body: unknown }
}

const money = (amount: string) => ({ amount, currency: 'USD' })

export const SAMPLE_ORDER = {
  id: 'ORD-7K3P9Q',
  object: 'order',
  status: 'processing',
  status_detail: null,
  financial_status: 'held',
  service: { id: '4001', name: 'iPhone 15 Carrier Check', revision: 3 },
  input: { imei: DEMO_IMEI },
  price: money('2.80'),
  refunded: money('0.00'),
  result: null,
  rejection: null,
  client_reference: 'pos-1182',
  channel: 'api',
  created_at: ISO,
  updated_at: ISO,
  completed_at: null,
}

export const SAMPLE_ORDER_COMPLETED = {
  ...SAMPLE_ORDER,
  status: 'completed',
  financial_status: 'captured',
  result: { summary: 'T-Mobile US · Clean · Locked', fields: { carrier: 'T-Mobile US', status: 'clean', sim_lock: 'locked', unlock_eligible: true, model: 'iPhone 15 Pro 256GB' } },
  updated_at: '2026-10-04T09:41:19Z',
  completed_at: '2026-10-04T09:41:19Z',
}

export const SAMPLE_SERVICE = {
  id: '4001',
  object: 'service',
  name: 'iPhone 15 Carrier Check',
  category: 'IMEI Checks',
  processing: 'instant',
  turnaround: { min_seconds: 5, max_seconds: 60 },
  price: money('2.80'),
  available: true,
  revision: 3,
  input_schema: {
    type: 'object',
    required: ['imei'],
    properties: { imei: { title: 'IMEI', type: 'string', pattern: '^\\d{15}$', 'x-checks': ['luhn'], description: 'Dial *#06# on the device, or find it in Settings → About.' } },
    additionalProperties: false,
  },
  result_fields: [
    { key: 'carrier', label: 'Carrier', kind: 'text' },
    { key: 'status', label: 'Status', kind: 'status' },
    { key: 'sim_lock', label: 'SIM-lock', kind: 'status' },
    { key: 'unlock_eligible', label: 'Unlock eligible', kind: 'boolean' },
    { key: 'model', label: 'Model', kind: 'text' },
  ],
}

export const ENDPOINTS: EndpointDef[] = [
  {
    id: 'list-services',
    method: 'GET',
    path: '/v1/services',
    title: 'List services',
    summary: 'Every service this account may order through the API, with its own pricing-tier price, live availability and input schema.',
    scope: 'services:read',
    response: { status: 200, body: { object: 'list', data: [SAMPLE_SERVICE, { ...SAMPLE_SERVICE, id: '4006', name: 'IMEI Blacklist Check (GSMA)', price: money('0.74'), turnaround: { min_seconds: 20, max_seconds: 90 } }], has_more: false } },
  },
  {
    id: 'get-service',
    method: 'GET',
    path: '/v1/services/:id',
    example: '4001',
    title: 'Retrieve a service',
    summary: 'One service by its code. Use `input_schema` (JSON Schema) to build forms and validate before ordering.',
    scope: 'services:read',
    response: { status: 200, body: SAMPLE_SERVICE },
  },
  {
    id: 'create-order',
    method: 'POST',
    path: '/v1/orders',
    title: 'Place an order',
    summary: 'Validates input (IMEI: 15 digits + Luhn), prices at the account’s tier, holds funds in the wallet and routes to the highest-priority healthy supplier. Same PlaceOrder command as every other channel.',
    scope: 'orders:write',
    idempotent: true,
    body: { service: '4001', input: { imei: DEMO_IMEI }, client_reference: 'pos-1182' },
    response: { status: 201, body: SAMPLE_ORDER },
  },
  {
    id: 'batch-orders',
    method: 'POST',
    path: '/v1/orders/batch',
    title: 'Place orders in batch',
    summary: '1–100 orders in one call. Each line is placed independently; the response is 207 with a per-line status. With an Idempotency-Key, line n is keyed as `<key>:<n>`.',
    scope: 'orders:write',
    idempotent: true,
    body: { orders: [{ service: '4006', input: { imei: DEMO_IMEI } }, { service: '4006', input: { imei: BAD_LUHN_IMEI } }] },
    response: {
      status: 207,
      body: {
        object: 'batch',
        accepted: 1,
        rejected: 1,
        results: [
          { index: 0, status: 201, order: { ...SAMPLE_ORDER, id: 'ORD-2M8D4W', service: { id: '4006', name: 'IMEI Blacklist Check (GSMA)', revision: 2 }, price: money('0.74'), client_reference: null } },
          { index: 1, status: 422, error: { code: 'validation_failed', message: 'Input validation failed', details: { fields: { imei: 'IMEI checksum (Luhn) is invalid' } } } },
        ],
      },
    },
  },
  {
    id: 'get-order',
    method: 'GET',
    path: '/v1/orders/:id',
    example: 'ORD-7K3P9Q',
    title: 'Retrieve an order',
    summary: 'Current status, financial status and — once completed — the structured result. Poll this or (better) subscribe to webhooks.',
    scope: 'orders:read',
    response: { status: 200, body: SAMPLE_ORDER_COMPLETED },
  },
  {
    id: 'list-orders',
    method: 'GET',
    path: '/v1/orders',
    query: { status: 'processing', limit: '10' },
    title: 'List orders',
    summary: 'This account’s most recent orders, newest first. Filter with `status` (`processing` also returns orders under review) and `limit` (max 100).',
    scope: 'orders:read',
    response: { status: 200, body: { object: 'list', data: [{ ...SAMPLE_ORDER, status_detail: 'under_review' }], has_more: false } },
  },
  {
    id: 'cancel-order',
    method: 'POST',
    path: '/v1/orders/:id/cancel',
    example: 'ORD-7K3P9Q',
    title: 'Cancel an order',
    summary: 'Cancels an order that has not been accepted by a supplier yet. Held funds are released to the wallet.',
    scope: 'orders:write',
    body: { reason: 'Customer changed their mind' },
    response: { status: 200, body: { ...SAMPLE_ORDER, status: 'cancelled', financial_status: 'released', rejection: { code: 'cancelled', message: 'Customer changed their mind' } } },
  },
  {
    id: 'verify-order',
    method: 'POST',
    path: '/v1/orders/:id/verify',
    example: 'ORD-7K3P9Q',
    title: 'Request verification',
    summary: 'After-care: dispute a completed result (code not working, wrong result). Opens a verification request the operator handles — may lead to a refund.',
    scope: 'orders:write',
    body: { reason: 'code_not_working', message: 'NCK rejected by the device twice' },
    response: { status: 201, body: { id: 'VR-4H2K', object: 'verification_request', order: 'ORD-7K3P9Q', status: 'open', reason: 'code_not_working', message: 'NCK rejected by the device twice', created_at: ISO } },
  },
  {
    id: 'get-account',
    method: 'GET',
    path: '/v1/account',
    title: 'Retrieve the account',
    summary: 'The key’s account and its wallet projection — computed from ledger entries, never stored as a mutable number.',
    scope: 'account:read',
    response: { status: 200, body: { id: 'AC-10482', object: 'account', name: 'ABC GSM', tier: 'reseller', pricing_tier: 'Gold', status: 'active', balance: { available: money('842.50'), held: money('27.00'), credit_limit: money('250.00') } } },
  },
  {
    id: 'account-transactions',
    method: 'GET',
    path: '/v1/account/transactions',
    query: { limit: '20' },
    title: 'List wallet transactions',
    summary: 'Wallet statement lines: holds, captures, releases, top-ups, refunds — each with the change to available and held funds.',
    scope: 'account:read',
    response: {
      status: 200,
      body: {
        object: 'list',
        data: [
          { id: 'TX-9F3K2A', at: ISO, type: 'order_hold', description: 'Hold for ORD-7K3P9Q', order: 'ORD-7K3P9Q', available_change: money('-2.80'), held_change: money('2.80'), available_after: money('842.50') },
          { id: 'TX-9F3K1Z', at: '2026-10-04T08:12:40Z', type: 'order_capture', description: 'Capture ORD-5B1N7C', order: 'ORD-5B1N7C', available_change: money('0.00'), held_change: money('-0.74'), available_after: money('845.30') },
        ],
      },
    },
  },
]

export const endpointById = (id: string) => ENDPOINTS.find((e) => e.id === id)

/* ------------------------------------------------------------------------- */
/*  Code samples                                                             */
/* ------------------------------------------------------------------------- */
function resolvedPath(e: EndpointDef) {
  const p = e.example ? e.path.replace(':id', e.example) : e.path
  const qs = e.query ? `?${new URLSearchParams(e.query).toString()}` : ''
  return p + qs
}

export function endpointSamples(e: EndpointDef): Record<Lang, string> {
  const path = resolvedPath(e)
  const url = `${API_HOST}${path}`
  const idem = e.idempotent ? 'pos-1182-a' : null
  const body = e.body !== undefined ? JSON.stringify(e.body, null, 2) : null
  const curl = [
    `curl -X ${e.method} ${url}`,
    '  -H "Authorization: Bearer $ORVEX_API_KEY"',
    ...(idem ? [`  -H "Idempotency-Key: ${idem}"`] : []),
    ...(body ? ['  -H "Content-Type: application/json"', `  -d '${body.replace(/\n/g, '\n  ')}'`] : []),
  ].join(' \\\n')
  const node = `const res = await fetch('${url}', {
  method: '${e.method}',
  headers: {
    Authorization: \`Bearer \${process.env.ORVEX_API_KEY}\`,${idem ? `\n    'Idempotency-Key': '${idem}',` : ''}${body ? `\n    'Content-Type': 'application/json',` : ''}
  },${body ? `\n  body: JSON.stringify(${body.replace(/\n/g, '\n  ')}),` : ''}
})
const data = await res.json()
if (!res.ok) throw new Error(\`\${data.error.code}: \${data.error.message}\`)`
  const python = `import os, requests

res = requests.${e.method.toLowerCase()}(
    "${url}",
    headers={
        "Authorization": f"Bearer {os.environ['ORVEX_API_KEY']}",${idem ? `\n        "Idempotency-Key": "${idem}",` : ''}
    },${body ? `\n    json=${pyLiteral(e.body, 4)},` : ''}
    timeout=30,
)
data = res.json()
res.raise_for_status()`
  return { curl, node, python }
}

function pyLiteral(v: unknown, indent: number): string {
  return JSON.stringify(v, null, 4)
    .replace(/\btrue\b/g, 'True')
    .replace(/\bfalse\b/g, 'False')
    .replace(/\bnull\b/g, 'None')
    .replace(/\n/g, `\n${' '.repeat(indent)}`)
}

export const AUTH_SAMPLES: Record<Lang, string> = {
  curl: `curl ${API_BASE}/account \\\n  -H "Authorization: Bearer orx_live_a3c1_••••••••••••••••"`,
  node: `const res = await fetch('${API_BASE}/account', {\n  headers: { Authorization: \`Bearer \${process.env.ORVEX_API_KEY}\` },\n})`,
  python: `requests.get(\n    "${API_BASE}/account",\n    headers={"Authorization": f"Bearer {os.environ['ORVEX_API_KEY']}"},\n)`,
}

export const VERIFY_NODE = `import crypto from 'node:crypto'

// Your endpoint secret, shown once when the endpoint was created.
const SECRET = process.env.ORVEX_WEBHOOK_SECRET // "whsec_…"

export function verify(rawBody, headers) {
  const id = headers['webhook-id']
  const timestamp = headers['webhook-timestamp']
  const signatures = headers['webhook-signature'] // "v1,<base64> v1,<base64>"

  // 1. Reject stale messages (replay protection) — 5 minute tolerance.
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) throw new Error('stale webhook')

  // 2. HMAC-SHA256 over "{id}.{timestamp}.{body}" with the secret.
  const key = Buffer.from(SECRET.replace(/^whsec_/, ''), 'base64')
  const expected = crypto.createHmac('sha256', key).update(\`\${id}.\${timestamp}.\${rawBody}\`).digest('base64')

  // 3. Constant-time compare against every "v1," signature (keys can rotate).
  const ok = signatures.split(' ').some((s) => {
    const [version, sig] = s.split(',')
    return version === 'v1' && sig.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  })
  if (!ok) throw new Error('invalid signature')

  // 4. De-duplicate on webhook-id — it is stable across retries and replays.
  return JSON.parse(rawBody)
}`

export const VERIFY_PYTHON = `import base64, hashlib, hmac, json, os, time

SECRET = os.environ["ORVEX_WEBHOOK_SECRET"]  # "whsec_…"

def verify(raw_body: bytes, headers) -> dict:
    msg_id = headers["webhook-id"]
    timestamp = headers["webhook-timestamp"]
    signatures = headers["webhook-signature"]  # "v1,<base64> v1,<base64>"

    # 1. Reject stale messages (replay protection) — 5 minute tolerance.
    if abs(time.time() - int(timestamp)) > 300:
        raise ValueError("stale webhook")

    # 2. HMAC-SHA256 over "{id}.{timestamp}.{body}" with the secret.
    key = base64.b64decode(SECRET.removeprefix("whsec_"))
    signed = f"{msg_id}.{timestamp}.".encode() + raw_body
    expected = base64.b64encode(hmac.new(key, signed, hashlib.sha256).digest()).decode()

    # 3. Constant-time compare against every "v1," signature.
    if not any(
        version == "v1" and hmac.compare_digest(sig, expected)
        for version, _, sig in (s.partition(",") for s in signatures.split(" "))
    ):
        raise ValueError("invalid signature")

    # 4. De-duplicate on webhook-id — stable across retries and replays.
    return json.loads(raw_body)`

export const WEBHOOK_SAMPLE_HEADERS = `POST /orvex/webhook HTTP/1.1
Host: pos.abcgsm.example
Content-Type: application/json
webhook-id: msg_2Vt8kQ9rXc4LmP7aZ1yB6nHd
webhook-timestamp: 1791107079
webhook-signature: v1,K5oZfzN95Z9UVu1EsfQmfVNQhnkZ2pj9o9NDN/H/pI4=`

export const WEBHOOK_SAMPLE_BODY = JSON.stringify({ type: 'order.completed', timestamp: '2026-10-04T09:41:19.000Z', data: SAMPLE_ORDER_COMPLETED }, null, 2)
