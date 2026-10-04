/**
 * Non-component helpers for the developer area (Native API, keys, webhooks,
 * logs) and the DHRU screens — constants, scopes, events and cURL builders.
 * Components live in `./shared`.
 */
import type { ApiLogEntry, ApiScope, WebhookEventType } from '@/types/installation'

/* ------------------------------------------------------------------------- */
/*  Constants                                                                */
/* ------------------------------------------------------------------------- */
/** Native API v1 is served by the installation's own domain. */
export const API_HOST = 'https://portal.unlockdesk-demo.com'
export const API_BASE = `${API_HOST}/v1`
export const DHRU_ENDPOINT_FALLBACK = `${API_HOST}/api/dhru`

/** Standard Webhooks retry schedule — delay before each attempt (attempt 1 is immediate). */
export const RETRY_DELAYS_SEC = [0, 5, 300, 1800, 7200, 18000, 36000, 36000]
export const RETRY_LABELS = ['immediately', '5s', '5m', '30m', '2h', '5h', '10h', '10h']
export const MAX_ATTEMPTS = RETRY_DELAYS_SEC.length

/* ------------------------------------------------------------------------- */
/*  HTTP status                                                              */
/* ------------------------------------------------------------------------- */
const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  207: 'Multi-Status',
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  410: 'Gone',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
}

export const statusPhrase = (status: number) => STATUS_TEXT[status] ?? ''

export function statusTextCls(status: number) {
  if (status >= 500) return 'text-danger'
  if (status >= 400) return 'text-warning'
  return 'text-success'
}

export const SLOW_MS = 250
export const CRITICAL_MS = 1000

/* ------------------------------------------------------------------------- */
/*  API keys                                                                 */
/* ------------------------------------------------------------------------- */
export const SCOPES: { id: ApiScope; label: string; description: string }[] = [
  { id: 'services:read', label: 'Read services', description: 'List services with this account’s live price, availability and input schema.' },
  { id: 'orders:read', label: 'Read orders', description: 'Retrieve orders, status, results and rejection reasons.' },
  { id: 'orders:write', label: 'Place orders', description: 'Place, batch, cancel and open verification requests. Each order holds funds in the account wallet.' },
  { id: 'account:read', label: 'Read account', description: 'Read the wallet projection (available, held, credit limit) and transactions.' },
  { id: 'webhooks:manage', label: 'Manage webhooks', description: 'Register and update the account’s own webhook endpoints.' },
]

/* ------------------------------------------------------------------------- */
/*  Webhook events                                                           */
/* ------------------------------------------------------------------------- */
export const WEBHOOK_EVENTS: { id: WebhookEventType; description: string; operatorOnly?: boolean }[] = [
  { id: 'order.created', description: 'An order was accepted (any channel) and funds were held.' },
  { id: 'order.processing', description: 'The order was sent to a supplier.' },
  { id: 'order.completed', description: 'Result available; held funds captured.' },
  { id: 'order.rejected', description: 'Rejected by every eligible supplier; funds released to the wallet.' },
  { id: 'order.cancelled', description: 'Cancelled before completion; funds released.' },
  { id: 'order.refunded', description: 'A full or partial refund was issued.' },
  { id: 'order.needs_review', description: 'Supplier outcome unknown — operator review required. Never sent to customers.', operatorOnly: true },
  { id: 'account.balance_low', description: 'Available balance fell below the account’s alert threshold.' },
  { id: 'service.updated', description: 'A service price, availability or schema revision changed.' },
]

/* ------------------------------------------------------------------------- */
/*  Helpers                                                                  */
/* ------------------------------------------------------------------------- */
export function newIdemKey(prefix = 'idem') {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().replace(/-/g, '').slice(0, 16) : Math.random().toString(16).slice(2, 18)
  return `${prefix}_${rnd}`
}

export function prettyJson(raw: string | null | undefined) {
  if (!raw) return ''
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

export function sinceShort(iso: string | null | undefined) {
  if (!iso) return 'Never'
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 45) return 'just now'
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  const d = Math.round(s / 86400)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

/** cURL for a native API request. The key is referenced by env var unless `keyDisplay` is given. */
export function curlNative(p: { method: string; path: string; query?: Record<string, string>; headers?: Record<string, string>; body?: unknown; keyDisplay?: string }) {
  const qs = p.query && Object.keys(p.query).length ? `?${new URLSearchParams(p.query).toString()}` : ''
  const lines = [`curl -X ${p.method} ${API_HOST}${p.path}${qs}`, `  -H "Authorization: Bearer ${p.keyDisplay ?? '$ORVEX_API_KEY'}"`]
  for (const [k, v] of Object.entries(p.headers ?? {})) {
    if (k.toLowerCase() === 'authorization') continue
    lines.push(`  -H "${k}: ${v}"`)
  }
  if (p.body !== undefined && p.method !== 'GET') {
    lines.push('  -H "Content-Type: application/json"')
    lines.push(`  -d ${shq(JSON.stringify(p.body, null, 2))}`)
  }
  return lines.join(' \\\n')
}

/** cURL reconstruction of a logged request (native or DHRU). */
export function curlFromLog(l: ApiLogEntry, dhruEndpoint = DHRU_ENDPOINT_FALLBACK) {
  if (l.protocol === 'dhru') {
    const fields = (l.requestBody ?? '').split('\n').filter(Boolean)
    return [`curl -X POST ${dhruEndpoint}`, ...fields.map((f) => `  --data-urlencode ${shq(f.startsWith('apiaccesskey=') ? 'apiaccesskey=$ORVEX_API_KEY' : f)}`)].join(' \\\n')
  }
  const lines = [`curl -X ${l.method} ${API_HOST}${l.path}`, '  -H "Authorization: Bearer $ORVEX_API_KEY"']
  if (l.idempotencyKey) lines.push(`  -H "Idempotency-Key: ${l.idempotencyKey}"`)
  if (l.requestBody && l.method !== 'GET') {
    lines.push('  -H "Content-Type: application/json"')
    lines.push(`  -d ${shq(l.requestBody)}`)
  }
  return lines.join(' \\\n')
}
