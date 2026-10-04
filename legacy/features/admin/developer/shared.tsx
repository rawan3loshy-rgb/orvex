import type { ReactNode } from 'react'
import { Check, CloudOff, Minus, RotateCw } from 'lucide-react'
import { cn } from '@/lib/cn'
import { ms } from '@/lib/format'
import type { ApiKey, ApiLogEntry, ApiScope, WebhookEventType } from '@/types/installation'
import { Button, EmptyState, Tooltip } from '@/components/ui'

/* ------------------------------------------------------------------------- */
/*  Constants                                                                */
/* ------------------------------------------------------------------------- */
/** The Reseller API is served by the customer's own installation domain. */
export const API_HOST = 'https://portal.unlockdesk-demo.com'
export const API_BASE = `${API_HOST}/api/v1`

/* ------------------------------------------------------------------------- */
/*  HTTP method & status                                                     */
/* ------------------------------------------------------------------------- */
/** Method colours: reads are steel/graphite, writes coral, destructive crimson. No blue. */
const METHOD_CLS: Record<string, string> = {
  GET: 'text-info bg-info/10 ring-info/25',
  POST: 'text-accent-ink bg-accent/10 ring-accent/25',
  PUT: 'text-warning bg-warning/10 ring-warning/25',
  PATCH: 'text-warning bg-warning/10 ring-warning/25',
  DELETE: 'text-danger bg-danger/10 ring-danger/25',
}

export function MethodBadge({ method, size = 'sm', className }: { method: string; size?: 'xs' | 'sm'; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[4px] font-mono font-semibold tracking-[0.04em] ring-1 ring-inset',
        size === 'xs' ? 'h-[17px] min-w-[36px] px-1 text-[9.5px]' : 'h-5 min-w-[42px] px-1.5 text-[10.5px]',
        METHOD_CLS[method] ?? 'bg-fg/5 text-fg-2 ring-line',
        className,
      )}
    >
      {method}
    </span>
  )
}

export function statusText(status: number) {
  if (status >= 500) return 'text-danger'
  if (status >= 400) return 'text-warning'
  if (status >= 300) return 'text-info'
  return 'text-success'
}

const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  408: 'Request Timeout',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
}

export function statusPhrase(status: number) {
  return STATUS_TEXT[status] ?? ''
}

export function StatusCode({ status, className, phrase }: { status: number | null; className?: string; phrase?: boolean }) {
  if (status == null) return <span className={cn('font-mono text-[12px] text-fg-3', className)}>—</span>
  const dot = status >= 500 ? 'bg-danger' : status >= 400 ? 'bg-warning' : status >= 300 ? 'bg-info' : 'bg-success'
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-mono text-[12px] font-medium tabular', statusText(status), className)}>
      <span className={cn('size-1.5 shrink-0 rounded-[2px]', dot)} />
      {status}
      {phrase && <span className="font-sans font-normal text-fg-3">{statusPhrase(status)}</span>}
    </span>
  )
}

/** Latency thresholds shared by logs, key drawer and the try-it console. */
export const SLOW_MS = 250
export const CRITICAL_MS = 1000

/**
 * Graphite latency bar. Slow requests — and the selected row (`highlight`) — switch to signal coral;
 * pathological ones to crimson.
 */
export function LatencyBar({ value, max = 300, className, highlight }: { value: number; max?: number; className?: string; highlight?: boolean }) {
  const ratio = Math.min(1, value / max)
  const critical = value > CRITICAL_MS
  const slow = value > SLOW_MS
  const bar = critical ? 'bg-danger' : slow || highlight ? 'bg-accent' : 'bg-fg-2/45'
  const text = critical ? 'text-danger' : slow ? 'text-accent-ink' : highlight ? 'text-fg' : 'text-fg-2'
  return (
    <span className={cn('inline-flex items-center justify-end gap-2', className)}>
      <span className="hidden h-[5px] w-12 overflow-hidden rounded-[2px] bg-fg/[0.06] sm:block">
        <span className={cn('block h-full rounded-[2px] transition-[width,background-color] duration-300', bar)} style={{ width: `${Math.max(4, ratio * 100)}%` }} />
      </span>
      <span className={cn('w-[46px] text-right font-mono text-[12px] tabular', text)}>{ms(value)}</span>
    </span>
  )
}

/** Human label for a normalised endpoint ("POST /api/v1/orders" → "Place order"). */
export function endpointLabel(endpoint: string) {
  const [method, path = ''] = endpoint.split(' ')
  const p = path.replace('/api/v1', '')
  if (p === '/orders') return method === 'POST' ? 'Place order' : 'List orders'
  if (p === '/orders/:id') return 'Poll order status'
  if (p === '/orders/:id/result') return 'Fetch result'
  if (p === '/services') return 'List services'
  if (p === '/services/:id') return 'Service schema'
  if (p === '/balance') return 'Read balance'
  return p || endpoint
}

/** Service ordered by a logged POST /orders call, read from its request body. */
export function orderedServiceId(l: Pick<ApiLogEntry, 'method' | 'requestBody'>) {
  if (l.method !== 'POST' || !l.requestBody) return null
  try {
    const b = JSON.parse(l.requestBody) as { service_id?: unknown }
    return typeof b.service_id === 'string' ? b.service_id : null
  } catch {
    return null
  }
}

/** Compact "2 min ago" style for request recency. */
export function sinceShort(iso: string | null | undefined) {
  if (!iso) return 'Never'
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 45) return 'just now'
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  const d = Math.round(s / 86400)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

/* ------------------------------------------------------------------------- */
/*  API keys                                                                 */
/* ------------------------------------------------------------------------- */
export const SCOPES: { id: ApiScope; label: string; description: string }[] = [
  { id: 'services:read', label: 'Read services', description: 'List IMEI, unlocking, server and code services with the owner’s prices and required input fields (imei, network, model…).' },
  { id: 'orders:read', label: 'Read orders', description: 'Retrieve orders, status history and results — check reports, unlock confirmations, NCK/MCK/SP codes.' },
  { id: 'orders:write', label: 'Place orders', description: 'Place IMEI checks, unlocks and code orders. Each order is charged to the owner balance.' },
  { id: 'balance:read', label: 'Read balance', description: 'Read the prepaid balance, credit line and low-balance threshold.' },
  { id: 'webhooks:manage', label: 'Manage webhooks', description: 'Register, update and remove the owner’s order-callback endpoints.' },
]

/** Masked key identifier — the secret itself is never stored or shown again. */
export function keyDisplay(k: Pick<ApiKey, 'prefix' | 'last4'>) {
  return `${k.prefix}••••${k.last4}`
}

/** Key identifier with the masked middle visually de-emphasised. */
export function KeyId({ apiKey: k, className }: { apiKey: Pick<ApiKey, 'prefix' | 'last4'>; className?: string }) {
  return (
    <span className={cn('inline-flex items-baseline font-mono text-[11.5px] whitespace-nowrap text-fg-2', className)}>
      {k.prefix}
      <span className="tracking-[0.12em] text-fg-3/70">••••</span>
      {k.last4}
    </span>
  )
}

/** Environment chip: Live = coral signal dot, Test = neutral hatched sandbox. */
export function EnvBadge({ env, className }: { env: 'live' | 'test'; className?: string }) {
  const live = env === 'live'
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1.5 rounded-[5px] px-1.5 font-mono text-[10px] font-semibold tracking-[0.08em] uppercase ring-1 ring-inset',
        live ? 'bg-accent/[0.08] text-accent-ink ring-accent/25' : 'bg-hatch bg-surface-2 text-fg-2 ring-line-strong',
        className,
      )}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', live ? 'bg-accent shadow-[0_0_0_2px_color-mix(in_oklab,var(--accent)_22%,transparent)]' : 'border border-fg-3')} />
      {live ? 'Live' : 'Test'}
    </span>
  )
}

export interface ScopePart {
  key: 'services' | 'orders' | 'balance' | 'webhooks'
  label: string
  /** Only set when a resource is partially granted. */
  mode?: 'read' | 'write'
}

/** Groups raw scopes into the resources a key can touch, e.g. "Services + Orders". */
export function scopeParts(scopes: ApiScope[]): ScopePart[] {
  const parts: ScopePart[] = []
  if (scopes.includes('services:read')) parts.push({ key: 'services', label: 'Services' })
  const or = scopes.includes('orders:read')
  const ow = scopes.includes('orders:write')
  if (or || ow) parts.push({ key: 'orders', label: 'Orders', mode: or && ow ? undefined : or ? 'read' : 'write' })
  if (scopes.includes('balance:read')) parts.push({ key: 'balance', label: 'Balance' })
  if (scopes.includes('webhooks:manage')) parts.push({ key: 'webhooks', label: 'Webhooks' })
  return parts
}

export function scopeSummary(scopes: ApiScope[]) {
  return scopeParts(scopes)
    .map((p) => (p.mode ? `${p.label} (${p.mode})` : p.label))
    .join(' + ')
}

/** Full scope matrix, used in tooltips. */
export function ScopeMatrix({ scopes }: { scopes: ApiScope[] }) {
  return (
    <span className="block min-w-[190px] py-0.5">
      <span className="mb-1.5 block font-mono text-[9.5px] tracking-[0.1em] text-fg-3 uppercase">
        {scopes.length}/{SCOPES.length} scopes granted
      </span>
      {SCOPES.map((s) => {
        const on = scopes.includes(s.id)
        return (
          <span key={s.id} className={cn('flex items-center gap-1.5 py-px font-mono text-[11px]', on ? 'text-fg' : 'text-fg-3/70')}>
            {on ? <Check className="size-3 text-accent-ink" /> : <Minus className="size-3" />}
            {s.id}
            {on && s.id === 'orders:write' && <span className="ml-auto pl-2 font-sans text-[10px] text-fg-3">charges balance</span>}
          </span>
        )
      })}
    </span>
  )
}

/**
 * Compact human scope summary ("Services + Orders +2") with the full scope list in a tooltip.
 * `max` = how many resources are spelled out before collapsing into "+n".
 */
export function ScopeChips({ scopes, max = 2, className }: { scopes: ApiScope[]; max?: number; className?: string }) {
  const parts = scopeParts(scopes)
  if (!parts.length) return <span className={cn('text-[12px] text-fg-3', className)}>No scopes</span>
  const shown = parts.slice(0, max)
  const rest = parts.length - shown.length
  return (
    <Tooltip content={<ScopeMatrix scopes={scopes} />}>
      <span className={cn('inline-flex min-w-0 cursor-default items-center gap-1.5 text-[12.5px] whitespace-nowrap text-fg-2', className)}>
        <span className="truncate">
          {shown.map((p, i) => (
            <span key={p.key}>
              {i > 0 && <span className="px-1 text-fg-3">+</span>}
              <span className="text-fg">{p.label}</span>
              {p.mode && <span className="ml-1 font-mono text-[10px] text-fg-3 uppercase">{p.mode === 'read' ? 'ro' : 'wo'}</span>}
            </span>
          ))}
        </span>
        {rest > 0 && <span className="inline-flex h-[18px] shrink-0 items-center rounded-[4px] bg-fg/[0.05] px-1 font-mono text-[10px] text-fg-3 ring-1 ring-line ring-inset">+{rest}</span>}
      </span>
    </Tooltip>
  )
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}(\/(3[0-2]|[12]?\d))?$/
const IPV6 = /^[0-9a-f:]+(\/\d{1,3})?$/i

export function isValidIpRule(v: string) {
  return IPV4.test(v) || (v.includes(':') && IPV6.test(v))
}

/* ------------------------------------------------------------------------- */
/*  Webhook events                                                           */
/* ------------------------------------------------------------------------- */
export interface EventDef {
  id: WebhookEventType
  title: string
  description: string
  payload: Record<string, unknown>
}

const usd = (amount: number) => ({ amount, currency: 'USD' })

/** Demo order used across event payloads: an async iPhone unlock placed by MobileHub's panel. */
const ORDER_BASE = {
  order_id: 'ord_10482',
  number: 10482,
  service: { id: 'SVC-1007', name: 'iPhone Unlock — USA Carriers', category: 'unlocking', delivery: 'async' },
  client_reference: 'MH-UNL-20931',
  fields: { imei: '356938035643809', network: 'att_us' },
  price: usd(22.96),
}

export const WEBHOOK_EVENTS: EventDef[] = [
  {
    id: 'order.created',
    title: 'Order created',
    description: 'The order passed validation (IMEI format + Luhn checksum), the reseller balance was charged and it entered the routing queue.',
    payload: { id: 'evt_7b1d4e0c9a2f61', type: 'order.created', created_at: '2026-10-01T09:41:12Z', data: { ...ORDER_BASE, status: 'processing', result: null, error: null } },
  },
  {
    id: 'order.processing',
    title: 'Order processing',
    description: 'The order was submitted to a supplier and is awaiting a result. Unlocks and server services can take hours.',
    payload: {
      id: 'evt_7b1d4e0c9a2f62',
      type: 'order.processing',
      created_at: '2026-10-01T09:41:13Z',
      data: { ...ORDER_BASE, status: 'processing', attempt: 1, turnaround_seconds: { min: 3600, max: 21600 }, estimated_completion_at: '2026-10-01T12:41:13Z' },
    },
  },
  {
    id: 'order.completed',
    title: 'Order completed',
    description: 'A supplier returned the final result — unlock confirmation, NCK/MCK/SP code or check report. The normalised result is included.',
    payload: {
      id: 'evt_7b1d4e0c9a2f63',
      type: 'order.completed',
      created_at: '2026-10-01T11:58:40Z',
      data: {
        ...ORDER_BASE,
        status: 'success',
        result: {
          summary: 'Unlocked — whitelisted on carrier database',
          data: {
            unlocked: true,
            method: 'remote',
            carrier: 'AT&T (US)',
            carrier_reference: 'UNL-7F3A9C',
            instructions: 'Insert a non-AT&T SIM and connect to Wi-Fi to finish activation.',
          },
        },
        error: null,
        completed_at: '2026-10-01T11:58:40Z',
      },
    },
  },
  {
    id: 'order.failed',
    title: 'Order failed',
    description: 'Every supplier in the routing chain rejected or failed the order — e.g. IMEI blacklisted or wrong network. The charge is released to the balance.',
    payload: {
      id: 'evt_7b1d4e0c9a2f64',
      type: 'order.failed',
      created_at: '2026-10-01T09:43:02Z',
      data: {
        ...ORDER_BASE,
        order_id: 'ord_10486',
        number: 10486,
        client_reference: 'MH-UNL-20937',
        fields: { imei: '353918104472317', network: 'tmobile_us' },
        status: 'failed',
        result: null,
        error: { code: 'provider_rejected', message: 'IMEI is blacklisted — carrier refuses unlock', gsma_status: 'blacklisted' },
        refunded_amount: usd(22.96),
      },
    },
  },
  {
    id: 'order.refunded',
    title: 'Order refunded',
    description: 'A completed order was refunded by an operator (e.g. the unlock did not apply). The amount is credited back to the balance.',
    payload: { id: 'evt_7b1d4e0c9a2f65', type: 'order.refunded', created_at: '2026-10-02T11:05:44Z', data: { ...ORDER_BASE, status: 'refunded', refunded_amount: usd(22.96), balance_after: usd(4842.96) } },
  },
  {
    id: 'balance.low',
    title: 'Balance low',
    description: 'The reseller balance dropped below its low-balance threshold. Top up to keep checks and unlocks flowing.',
    payload: { id: 'evt_7b1d4e0c9a2f66', type: 'balance.low', created_at: '2026-10-01T10:12:09Z', data: { reseller_id: 'rsl_629', reseller: 'Celular Brasil', balance: usd(95.2), threshold: usd(100), credit_limit: usd(0) } },
  },
  {
    id: 'service.updated',
    title: 'Service updated',
    description: 'A service changed price, input fields or availability (e.g. a supplier paused it). Refresh cached catalog data.',
    payload: {
      id: 'evt_7b1d4e0c9a2f67',
      type: 'service.updated',
      created_at: '2026-10-01T08:00:00Z',
      data: { service_id: 'SVC-1007', name: 'iPhone Unlock — USA Carriers', category: 'unlocking', changes: ['price'], previous_price: usd(21.32), price: usd(22.96), status: 'active' },
    },
  },
]

export function eventDef(id: string) {
  return WEBHOOK_EVENTS.find((e) => e.id === id)
}

export function eventTone(event: string) {
  return event.endsWith('failed') ? 'bg-danger' : event.endsWith('completed') ? 'bg-success' : event.startsWith('balance') ? 'bg-warning' : event.endsWith('refunded') ? 'bg-info' : 'bg-fg-3'
}

export function EventChip({ event, className }: { event: string; className?: string }) {
  return (
    <span className={cn('inline-flex h-5 items-center gap-1.5 rounded-[5px] bg-fg/[0.04] px-1.5 font-mono text-[10.5px] whitespace-nowrap ring-1 ring-line ring-inset', className)}>
      <span className={cn('size-1.5 shrink-0 rounded-[2px]', eventTone(event))} />
      <span className="text-fg-2">{event}</span>
    </span>
  )
}

/* ------------------------------------------------------------------------- */
/*  Misc                                                                     */
/* ------------------------------------------------------------------------- */
export function prettyJson(raw: string | null | undefined) {
  if (!raw) return ''
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

export function curlFromLog(l: ApiLogEntry) {
  // The key itself is never stored in logs — reference it from the environment.
  const lines = [`curl -X ${l.method} "${API_HOST}${l.path}"`, `  -H "Authorization: Bearer $RESELLER_API_KEY"`]
  for (const [k, v] of Object.entries(l.requestHeaders)) {
    if (k === 'authorization' || k === 'user-agent' || k === 'x-forwarded-for' || v === '—') continue
    lines.push(`  -H "${k.replace(/(^|-)\w/g, (c) => c.toUpperCase())}: ${v}"`)
  }
  if (l.requestBody) {
    let body = l.requestBody
    try {
      body = JSON.stringify(JSON.parse(l.requestBody))
    } catch {
      /* keep raw */
    }
    lines.push(`  -d '${body}'`)
  }
  return lines.join(' \\\n')
}

export function Kv({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="mono-label">{label}</div>
      <div className="mt-1.5 truncate text-[13px] text-fg">{children}</div>
    </div>
  )
}

/** Error state for list views when the installation API request fails. */
export function LoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <EmptyState
      icon={<CloudOff />}
      title={`Couldn't load ${what}`}
      description="The installation API did not respond. Check System → Health, then try again."
      action={
        <Button size="sm" leading={<RotateCw />} onClick={onRetry}>
          Retry
        </Button>
      }
    />
  )
}
