/**
 * Non-component helpers shared by the catalog / suppliers / pricing / routing
 * screens — labels, driver metadata and payload formatting. Components live in `./kit`.
 */
import { duration } from '@/lib/format'
import { fieldType } from '@/core/fields'
import type { AttemptClass, DriverId, DriverOperation, FieldDef, ProcessingMode, Service } from '@/types/installation'

/* ------------------------------------------------------------------------- */
/*  Labels                                                                   */
/* ------------------------------------------------------------------------- */
export const PROCESSING_LABEL: Record<ProcessingMode, string> = {
  instant: 'Instant',
  async: 'Async',
  manual: 'Manual',
}

export const PROCESSING_HINT: Record<ProcessingMode, string> = {
  instant: 'Result returned in the submit response or within seconds',
  async: 'Supplier accepts, result arrives later by callback or status poll',
  manual: 'Fulfilled by a person (work queue) — result entered by hand',
}

export function turnaroundLabel(t: Service['turnaround']) {
  if (t.maxSec <= 0) return 'Instant'
  if (t.minSec === t.maxSec) return duration(t.maxSec)
  return `${duration(t.minSec)}–${duration(t.maxSec)}`
}

export const DRIVER_META: Record<DriverId, { label: string; short: string }> = {
  dhru_fusion: { label: 'DHRU Fusion', short: 'DHRU' },
  orvex_rest: { label: 'ORVEX REST', short: 'REST' },
  manual: { label: 'Manual', short: 'Manual' },
}

/** Credential each driver needs — keys match the seeded suppliers. */
export const DRIVER_CREDENTIAL: Record<DriverId, { key: string; label: string; placeholder: string; usernameLabel: string | null }> = {
  dhru_fusion: { key: 'api_access_key', label: 'API access key', placeholder: 'XXXX-XXXX-XXXX-XXXX', usernameLabel: 'Username' },
  orvex_rest: { key: 'api_token', label: 'API token', placeholder: 'token issued by the supplier', usernameLabel: 'Account id' },
  manual: { key: 'portal_password', label: 'Supplier portal password', placeholder: '••••••••', usernameLabel: 'Portal login' },
}

/** The SupplierDriver contract — every driver implements all eight operations. */
export const DRIVER_OPERATIONS: { op: DriverOperation | 'normalizeResult'; label: string; detail: string }[] = [
  { op: 'testConnection', label: 'testConnection()', detail: 'Resolve, TLS, authenticate, read account — no side effects' },
  { op: 'getBalance', label: 'getBalance()', detail: 'Prepaid credit reported by the supplier → reconciliation' },
  { op: 'syncCatalog', label: 'syncCatalog()', detail: 'Remote product list → diff → change review (never silent)' },
  { op: 'submit', label: 'submit()', detail: 'Send one order attempt; the response is classified' },
  { op: 'getStatus', label: 'getStatus()', detail: 'Poll an accepted attempt until it settles' },
  { op: 'parseCallback', label: 'parseCallback()', detail: 'Verify + parse a supplier callback (HMAC when supported)' },
  { op: 'normalizeResult', label: 'normalizeResult()', detail: 'Map the supplier payload onto the service result schema' },
  { op: 'cancel', label: 'cancel()', detail: 'Ask the supplier to cancel, when the product allows it' },
]

/** Outcome classes — the heart of safe routing (mirrors SupplierService.classify). */
export const OUTCOMES: { cls: AttemptClass; label: string; examples: string; failover: 'yes' | 'no'; then: string; tone: 'success' | 'danger' | 'warning' | 'info' }[] = [
  { cls: 'success', label: 'Success', examples: 'Accepted — result now or later (callback / poll)', failover: 'no', then: 'Order completes; cost captured', tone: 'success' },
  { cls: 'rejected_terminal', label: 'Rejected — terminal', examples: 'Bad input, device not supported, not eligible (default for any rejection)', failover: 'no', then: 'Order rejected, hold released to the customer', tone: 'danger' },
  { cls: 'rejected_failover_safe', label: 'Rejected — failover-safe', examples: 'Mapped supplier errors, e.g. "service temporarily disabled", "out of stock"', failover: 'yes', then: 'Next offer in priority order', tone: 'warning' },
  { cls: 'not_accepted', label: 'Not accepted', examples: 'Rate limited · insufficient supplier funds · auth failed · connection refused', failover: 'yes', then: 'Supplier provably did not take the order → next offer', tone: 'warning' },
  { cls: 'unknown', label: 'Unknown', examples: 'Timeout · unusable / bad response after the request was sent', failover: 'no', then: 'needs_review — failover blocked (it could duplicate the order and the charge)', tone: 'danger' },
]

export const CLASS_LABEL: Record<string, { label: string; tone: 'success' | 'danger' | 'warning' | 'info' | 'neutral' }> = {
  success: { label: 'Success', tone: 'success' },
  rejected_terminal: { label: 'Terminal', tone: 'danger' },
  rejected_failover_safe: { label: 'Failover-safe', tone: 'warning' },
  not_accepted: { label: 'Not accepted', tone: 'warning' },
  unknown: { label: 'Unknown', tone: 'danger' },
}

export const DEFAULT_STEP_LABELS = ['Resolve host', 'TLS handshake', 'Authenticate credentials', 'Read account balance', 'List remote products']

/** Guess a code language for a wire payload (DHRU form-POST vs JSON). */
export function payloadLang(s: string): 'json' | 'http' | 'text' {
  const t = s.trim()
  if (t.startsWith('{') || t.startsWith('[')) return 'json'
  if (/^(GET|POST|PUT|PATCH|DELETE)\s/.test(t) || /^HTTP\//.test(t)) return 'http'
  return 'text'
}

export function prettyPayload(s: string) {
  const t = s.trim()
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      return JSON.stringify(JSON.parse(t), null, 2)
    } catch {
      return s
    }
  }
  return s
}

/** Default mapping ORVEX service field → supplier field (DHRU param, then same key). */
export function autoMapping(fields: FieldDef[], remote: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of fields) {
    const dhru = fieldType(f.type).dhruParam
    const hit = remote.find((r) => dhru && r.toUpperCase() === dhru) ?? remote.find((r) => r.toLowerCase() === f.key.toLowerCase())
    if (hit) out[f.key] = hit
  }
  if (!Object.keys(out).length && fields[0] && remote[0]) out[fields[0].key] = remote[0]
  return out
}
