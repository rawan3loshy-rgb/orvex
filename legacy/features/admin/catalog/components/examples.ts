/**
 * Generators for service API documentation: example inputs, JSON Schema,
 * request snippets, responses and webhook payloads — all derived from the
 * service's own field schema so docs never drift from configuration.
 */
import type { Service, ServiceField, WebhookEventType } from '@/types/installation'

export const API_BASE = 'https://portal.unlockdesk-demo.com/api/v1'
const AT = '2026-10-01T09:12:44Z'
const DONE = '2026-10-01T09:13:21Z'
const ORDER = { id: 'ord_48213', number: 48213, ref: 'repair-ticket-1042' }

export function exampleValue(f: ServiceField): string {
  if (f.validation?.example) return f.validation.example
  if (f.validation?.options?.length) return f.validation.options[0]!
  switch (f.type) {
    case 'country':
      return 'FR'
    case 'date':
      return '2026-01-15'
    case 'number':
      return '1'
    case 'email':
      return 'orders@phonefix-center.example'
    case 'phone':
      return '+447700900123'
    default:
      return f.key === 'imei' ? '356938035643809' : 'SM-S918B'
  }
}

export function exampleInput(s: Service) {
  return Object.fromEntries(s.fields.map((f) => [f.key, exampleValue(f)]))
}

const RESULTS: Record<string, { summary: string; data: Record<string, string | number | boolean> }> = {
  'SVC-1001': { summary: 'iPhone 14 Pro · AT&T US · SIM-locked · CLEAN', data: { model: 'iPhone 14 Pro 256GB', brand: 'Apple', purchase_country: 'US', carrier: 'AT&T US', sim_lock: 'locked', gsma_blacklist: 'clean', fmi: 'off', warranty: 'expired' } },
  'SVC-1002': { summary: 'CLEAN — not on the GSMA blacklist', data: { gsma_status: 'clean', blacklisted: false, lost_or_stolen: false, unpaid_bill: false } },
  'SVC-1003': { summary: 'Samsung Galaxy S23 Ultra · SM-S918B · 256GB', data: { brand: 'Samsung', model: 'Galaxy S23 Ultra', model_code: 'SM-S918B', storage: '256GB', colour: 'Phantom Black', manufactured: '2023-03' } },
  'SVC-1004': { summary: 'T-Mobile US · SIM-locked · unlock eligible', data: { original_carrier: 'T-Mobile US', sim_lock: 'locked', lock_policy: 'T-Mobile US Postpaid', unlock_eligible: true } },
  'SVC-1005': { summary: 'AppleCare+ active until 08 Apr 2027', data: { coverage: 'AppleCare+', coverage_end: '2027-04-08', estimated_purchase: '2025-04-08', repairs_covered: true } },
  'SVC-1006': { summary: 'FMI: OFF — clean', data: { fmi: 'OFF', icloud_status: 'clean', lost_mode: false } },
  'SVC-1007': { summary: 'Unlocked — whitelisted on carrier database', data: { unlocked: true, network: 'att_us', method: 'carrier_whitelist', note: 'Insert a non-AT&T SIM and connect to Wi-Fi to finish' } },
  'SVC-1008': { summary: 'Unlocked remotely — reboot to apply', data: { unlocked: true, model: 'SM-S918B', method: 'remote' } },
  'SVC-1009': { summary: 'Unlocked — network lock removed', data: { unlocked: true, model: 'Redmi Note 13 Pro', method: 'remote' } },
  'SVC-1010': { summary: 'Unlocked — EE UK whitelist updated', data: { unlocked: true, network: 'ee_uk', permanent: true } },
  'SVC-1011': { summary: 'Unlocked — Orange FR whitelist updated', data: { unlocked: true, network: 'orange_fr', country: 'FR', permanent: true } },
  'SVC-1012': { summary: 'FRP removed — device ready for setup', data: { frp_removed: true, model: 'SM-S918B' } },
  'SVC-1013': { summary: 'Mi Account removed — device unbound', data: { mi_account_removed: true, model: 'Redmi Note 13 Pro' } },
  'SVC-1014': { summary: 'First activation 12 Mar 2024 · sold to AT&T US', data: { first_activation: '2024-03-12', sold_to: 'AT&T US', activation_policy: 'AT&T US Locked Policy', replaced: false } },
  'SVC-1015': { summary: 'MDM enrolment removed — enterprise released', data: { mdm_removed: true, organisation_released: true } },
  'SVC-1016': { summary: 'Unlocked via server — reboot to apply', data: { unlocked: true, brand: 'motorola', method: 'server' } },
  'SVC-1017': { summary: 'NCK 48213907', data: { nck: '48213907', algorithm: 'v201', attempts_left: 10 } },
  'SVC-1018': { summary: 'NCK 61029384', data: { nck: '61029384', model: 'Alcatel 1B' } },
  'SVC-1019': { summary: 'SP code 77302914', data: { sp_code: '77302914', network: 'Vodafone UK' } },
  'SVC-1020': { summary: 'NSCK 33119025', data: { nsck: '33119025' } },
  'SVC-1021': { summary: 'NCK 48213907 · MCK 90371288', data: { nck: '48213907', mck: '90371288', attempts_left: 5 } },
  'SVC-1022': { summary: 'In warranty until 08 Apr 2027', data: { brand: 'samsung', in_warranty: true, coverage_end: '2027-04-08' } },
  'SVC-1023': { summary: 'EE UK · mobile · not ported', data: { carrier: 'EE', country: 'GB', mcc_mnc: '234-30', line_type: 'mobile', ported: false } },
  'SVC-1024': { summary: 'Fully compatible in FR · 5G n78 · 4G B3/B7/B20', data: { compatible: true, country: 'FR', bands_5g: 'n78', bands_4g: 'B3,B7,B20' } },
  'SVC-1025': { summary: 'Valid serial · iPhone 14 Pro · week 18/2023', data: { valid: true, model: 'iPhone 14 Pro', production_week: '2023-W18' } },
}

export function sampleResult(s: Service) {
  return RESULTS[s.id] ?? { summary: 'Completed', data: { ok: true } }
}

const j = (v: unknown) => JSON.stringify(v, null, 2)

export function requestBody(s: Service) {
  return { service_id: s.id, client_reference: ORDER.ref, fields: exampleInput(s) }
}

export function requestJson(s: Service) {
  return j(requestBody(s))
}

export function curlSnippet(s: Service) {
  const body = j(requestBody(s))
    .split('\n')
    .map((l, i) => (i === 0 ? l : `  ${l}`))
    .join('\n')
  return [
    `curl -X POST ${API_BASE}/orders \\`,
    `  -H "Authorization: Bearer $RESELLER_API_KEY" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -H "Idempotency-Key: $(uuidgen)" \\`,
    `  -d '${body}'`,
  ].join('\n')
}

export function jsSnippet(s: Service) {
  return `const res = await fetch('${API_BASE}/orders', {
  method: 'POST',
  headers: {
    Authorization: \`Bearer \${process.env.RESELLER_API_KEY}\`,
    'Content-Type': 'application/json',
    'Idempotency-Key': crypto.randomUUID(),
  },
  body: JSON.stringify(${j(requestBody(s)).replace(/\n/g, '\n  ')}),
})

const order = await res.json()
console.log(order.id, order.status)`
}

export function pythonSnippet(s: Service) {
  const fields = Object.entries(exampleInput(s))
    .map(([k, v]) => `        "${k}": "${v}",`)
    .join('\n')
  return `import os, uuid, requests

res = requests.post(
    "${API_BASE}/orders",
    headers={
        "Authorization": f"Bearer {os.environ['RESELLER_API_KEY']}",
        "Idempotency-Key": str(uuid.uuid4()),
    },
    json={
        "service_id": "${s.id}",
        "client_reference": "${ORDER.ref}",
        "fields": {
${fields}
        },
    },
    timeout=30,
)
order = res.json()
print(order["id"], order["status"])`
}

export function jsonSchema(s: Service) {
  const properties: Record<string, Record<string, unknown>> = {}
  for (const f of s.fields) {
    const p: Record<string, unknown> = { type: f.type === 'number' ? 'integer' : 'string', title: f.label }
    if (f.description) p.description = f.description
    if (f.type === 'date') p.format = 'date'
    if (f.type === 'email') p.format = 'email'
    if (f.type === 'phone') p.format = 'e164'
    if (f.validation?.options?.length) p.enum = f.validation.options
    if (f.validation?.pattern && f.type !== 'number') p.pattern = f.validation.pattern
    if (f.validation?.minLength != null) p.minLength = f.validation.minLength
    if (f.validation?.maxLength != null) p.maxLength = f.validation.maxLength
    p.examples = [f.type === 'number' ? Number(exampleValue(f)) : exampleValue(f)]
    if (f.sensitive) p['x-sensitive'] = true
    properties[f.key] = p
  }
  return j({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `${API_BASE}/services/${s.id}/schema.json`,
    title: `${s.name} — order fields`,
    type: 'object',
    required: s.fields.filter((f) => f.required).map((f) => f.key),
    additionalProperties: false,
    properties,
  })
}

export function createResponse(s: Service) {
  const base = {
    id: ORDER.id,
    number: ORDER.number,
    status: s.delivery === 'instant' ? 'success' : 'processing',
    service: { id: s.id, name: s.name },
    price: { amount: s.price, currency: 'USD' },
    client_reference: ORDER.ref,
    created_at: AT,
  }
  if (s.delivery === 'instant') return j({ ...base, completed_at: '2026-10-01T09:12:45Z', result: sampleResult(s) })
  return j({ ...base, links: { self: `/api/v1/orders/${ORDER.id}`, result: `/api/v1/orders/${ORDER.id}/result` } })
}

export function resultResponse(s: Service) {
  return j({ id: ORDER.id, status: 'success', completed_at: DONE, result: sampleResult(s), error: null })
}

export const ORDER_EVENTS: { type: WebhookEventType; title: string; when: string; asyncOnly?: boolean }[] = [
  { type: 'order.created', title: 'Order created', when: 'The order passed validation, the customer was charged and routing started.' },
  { type: 'order.processing', title: 'Order processing', when: 'A supplier accepted the order and is processing it (unlock, server or code job). Sent for async and manual delivery only.', asyncOnly: true },
  { type: 'order.completed', title: 'Order completed', when: 'A supplier returned a result — e.g. an NCK code, an unlock confirmation or an IMEI report. The payload carries the normalised result.' },
  { type: 'order.failed', title: 'Order failed', when: 'Every supplier in the chain failed, rejected the IMEI or timed out. The customer is refunded automatically.' },
  { type: 'order.refunded', title: 'Order refunded', when: 'An operator refunded a completed order. The amount is credited to the customer balance.' },
]

export function webhookPayload(s: Service, type: WebhookEventType) {
  const status = type === 'order.created' ? 'created' : type === 'order.processing' ? 'processing' : type === 'order.completed' ? 'success' : type === 'order.failed' ? 'failed' : 'refunded'
  const at = type === 'order.created' ? AT : type === 'order.processing' ? '2026-10-01T09:12:46Z' : DONE
  const data: Record<string, unknown> = {
    order_id: ORDER.id,
    number: ORDER.number,
    service_id: s.id,
    status,
    client_reference: ORDER.ref,
    price: s.price,
    result: type === 'order.completed' || type === 'order.refunded' ? sampleResult(s).data : null,
    error: type === 'order.failed' ? { code: 'no_provider_available', message: 'Every supplier in the chain failed or timed out' } : null,
  }
  if (type === 'order.refunded') data.refund = { amount: s.price, currency: 'USD', reason: 'operator_refund' }
  return j({ id: `evt_${type.split('.')[1]!.slice(0, 4)}9f3kq2m8x1`, type, created_at: at, data })
}

export function webhookHeaders(type: WebhookEventType) {
  return [
    'POST /your/webhook/endpoint HTTP/1.1',
    'Content-Type: application/json',
    `Webhook-Event: ${type}`,
    'Webhook-Delivery: dlv_7h2k9d0q1m3x',
    'Webhook-Signature: t=1791105164,v1=<hex HMAC-SHA256 of "t.body">',
  ].join('\n')
}
