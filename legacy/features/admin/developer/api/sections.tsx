import type { ReactNode } from 'react'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import type { Service, ServiceCategory } from '@/types/installation'
import { Button, CodeBlock, CopyButton, StatusBadge } from '@/components/ui'
import { categoryColor } from '@/components/brand'
import { API_BASE, EnvBadge, SCOPES, WEBHOOK_EVENTS } from '../shared'
import { C, Callout, DocSection, EndpointHeader, ExampleSwitcher, H2, H3, P, ParamTable, ResponseCode, SampleCode, SimpleTable } from './primitives'
import {
  BALANCE_OBJECT,
  BLACKLIST_ORDER,
  CATEGORY_SLUG,
  CATEGORY_SLUGS,
  DEMO_IMEI,
  ERROR_402,
  ERROR_422,
  ERROR_422_NETWORK,
  ERROR_429,
  IMEI_CHECK_BODY,
  IMEI_CHECK_ORDER,
  ORDER_COMPLETED,
  ORDER_CREATE_BODY,
  ORDER_OBJECT,
  ORDER_REJECTED,
  ORDER_RESULT,
  json,
  samplesFor,
  serviceToApi,
} from './samples'

export interface NavEntry {
  id: string
  label: string
  method?: 'GET' | 'POST'
}

export const DOC_NAV: { group: string; items: NavEntry[] }[] = [
  {
    group: 'Getting started',
    items: [
      { id: 'introduction', label: 'Introduction' },
      { id: 'authentication', label: 'Authentication' },
      { id: 'errors', label: 'Errors' },
      { id: 'rate-limits', label: 'Rate limits' },
      { id: 'idempotency', label: 'Idempotency' },
    ],
  },
  {
    group: 'Services',
    items: [
      { id: 'list-services', label: 'List services', method: 'GET' },
      { id: 'get-service', label: 'Retrieve a service', method: 'GET' },
    ],
  },
  {
    group: 'Orders',
    items: [
      { id: 'create-order', label: 'Create an order', method: 'POST' },
      { id: 'get-order', label: 'Retrieve an order', method: 'GET' },
      { id: 'get-order-result', label: 'Retrieve a result', method: 'GET' },
      { id: 'list-orders', label: 'List orders', method: 'GET' },
    ],
  },
  { group: 'Account', items: [{ id: 'get-balance', label: 'Retrieve balance', method: 'GET' }] },
  {
    group: 'Webhooks',
    items: [
      { id: 'webhooks', label: 'Events' },
      { id: 'webhook-signatures', label: 'Verifying signatures' },
      { id: 'webhook-retries', label: 'Retries' },
    ],
  },
  { group: 'Sandbox', items: [{ id: 'try-it', label: 'Try it console' }] },
]

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

const CATEGORY_ORDER: ServiceCategory[] = ['IMEI Services', 'Unlocking', 'Server Services', 'Codes', 'Other Services']

const CATEGORY_NOTES: Record<ServiceCategory, string> = {
  'IMEI Services': 'Instant device checks: full report, GSMA blacklist, carrier & SIM-lock, iCloud/FMI, warranty.',
  Unlocking: 'Network unlocks for iPhone, Samsung, Xiaomi, UK and EU carriers. Async — minutes to hours.',
  'Server Services': 'Supplier-server jobs: Samsung FRP, Xiaomi Mi Account, Apple GSX activation, MDM.',
  Codes: 'Unlock codes: Huawei calculator, NCK, MCK, SP and Subnet (NSCK) codes.',
  'Other Services': 'Warranty status, carrier lookup by phone number, band compatibility, serial checks.',
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2.5 text-[13.5px] leading-relaxed text-fg-2">
      {items.map((li, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-[9px] size-1 shrink-0 rounded-full bg-fg-3" />
          <span>{li}</span>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------------- */
/*  Getting started                                                          */
/* ------------------------------------------------------------------------- */
const FLOW: { method: 'GET' | 'POST' | 'HOOK'; path: string; title: string; text: string }[] = [
  { method: 'GET', path: '/services', title: 'Load the catalog', text: 'Services, your prices and the input fields each one needs (imei, network, model…).' },
  { method: 'POST', path: '/orders', title: 'Place an order', text: 'Send the IMEI. The balance is charged; IMEI checks answer instantly in the response.' },
  { method: 'HOOK', path: 'order.completed', title: 'Receive the result', text: 'Unlocks, server jobs and codes finish later — the result arrives by signed webhook.' },
  { method: 'GET', path: '/balance', title: 'Reconcile', text: 'Show remaining credit in the shop and top up before the low-balance threshold.' },
]

export function IntroSection({ services, loading }: { services: Service[]; loading: boolean }) {
  const live = services.slice(0, 2).map((s) => serviceToApi(s, { fields: false }))
  return (
    <DocSection
      id="introduction"
      aside={
        <>
          <SampleCode label="Your first request" samples={samplesFor({ method: 'GET', path: '/services', query: { limit: 2 } })} />
          <ResponseCode status={200} live={!loading} code={loading ? '// loading live catalog…' : json({ object: 'list', data: live, has_more: services.length > 2 })} />
        </>
      }
    >
      <H2 eyebrow="Reseller API · v1">Introduction</H2>
      <P>
        The Reseller API lets <span className="text-fg">UnlockDesk</span> partners — GSM shops, repair centres and resellers running their own unlock panels — list services, place IMEI checks, unlocks and code orders, and receive results programmatically. It is served directly by this ORVEX Core installation: requests, IMEIs and results never leave UnlockDesk&apos;s infrastructure.
      </P>
      <P>The API is organised around REST: predictable resource URLs, JSON request and response bodies, standard HTTP status codes and Bearer authentication.</P>

      <div className="my-6 rounded-xl border border-line bg-bg-subtle p-4">
        <div className="mono-label">Base URL</div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <code className="min-w-0 truncate font-mono text-[13px] text-fg sm:text-[14px]">{API_BASE}</code>
          <CopyButton value={API_BASE} label="Copy base URL" />
        </div>
        <p className="mt-2 text-[12px] text-fg-3">The installation&apos;s own domain. HTTPS only (TLS 1.2+) — plain HTTP requests are refused, not redirected.</p>
      </div>

      <H3>Typical integration</H3>
      <ol className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
        {FLOW.map((f, i) => (
          <li key={f.title} className="relative bg-surface p-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-accent-ink tabular">{String(i + 1).padStart(2, '0')}</span>
              <span className="text-[13px] font-medium text-fg">{f.title}</span>
            </div>
            <code className="mt-1.5 block font-mono text-[11.5px] text-fg-3">
              {f.method === 'HOOK' ? 'webhook ' : `${f.method} `}
              <span className="text-fg-2">{f.path}</span>
            </code>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-2">{f.text}</p>
          </li>
        ))}
      </ol>

      <H3>Conventions</H3>
      <Bullets
        items={[
          <>
            Amounts are decimal numbers in <C>USD</C>, wrapped as <C>{'{ amount, currency }'}</C> — always the calling reseller&apos;s own price.
          </>,
          <>
            Timestamps are ISO 8601 in UTC, e.g. <C>2026-10-01T09:41:12Z</C>. Turnaround is given in seconds.
          </>,
          <>
            IDs are prefixed by type: <C>SVC-1007</C>, <C>ord_10482</C>, <C>evt_…</C>, <C>req_…</C>.
          </>,
          <>
            IMEIs are 15 digits and must pass the <span className="text-fg">Luhn checksum</span> — mistyped IMEIs are rejected with <C>422</C> before anything is charged.
          </>,
          <>
            Lists are cursor-paginated with <C>limit</C> and <C>starting_after</C>, and return <C>has_more</C>.
          </>,
          <>
            Every response carries an <C>X-Request-Id</C> header — include it when contacting UnlockDesk support.
          </>,
        ]}
      />
    </DocSection>
  )
}

export function AuthSection() {
  return (
    <DocSection
      id="authentication"
      aside={
        <>
          <SampleCode label="Authenticated request" samples={samplesFor({ method: 'GET', path: '/balance' })} />
          <ResponseCode status={401} title="Missing or revoked key" code={json({ error: { type: 'authentication_error', code: 'invalid_api_key', message: 'The API key provided is invalid or revoked.', request_id: 'req_2b71d0c9e84f4a1b9c03' } })} />
        </>
      }
    >
      <H2>Authentication</H2>
      <P>
        Authenticate by sending an API key in the <C>Authorization</C> header as a Bearer token. Every key belongs to one reseller, and every request is evaluated in that reseller&apos;s context: its pricing group, allowed services, rate limits and balance.
      </P>
      <CodeBlock lang="http" code={`Authorization: Bearer orx_live_4f2a••••••••••••••••••••••••••••9c1d`} />

      <H3>Live and test keys</H3>
      <SimpleTable
        head={['Prefix', 'Environment', 'Behaviour']}
        mono={[0]}
        rows={[
          ['orx_live_', <EnvBadge key="l" env="live" />, 'Real IMEI checks, unlocks and codes — routed to suppliers and charged to the balance.'],
          ['orx_test_', <EnvBadge key="t" env="test" />, 'Sandbox: simulated results (dummy NCK codes, CLEAN checks), nothing is charged, webhooks carry test: true.'],
        ]}
      />

      <H3>Scopes</H3>
      <P>Keys are issued with the minimum scopes an integration needs — a price-list widget only needs services:read. A request outside the key&apos;s scopes fails with 403 insufficient_scope.</P>
      <SimpleTable head={['Scope', 'Grants']} rows={SCOPES.map((s) => [s.id, s.description])} />

      <Callout tone="warning" title="Keep keys server-side">
        Never embed a key in a shop&apos;s browser checkout or a mobile app. Restrict production keys to the reseller&apos;s server IPs with an allowlist, and rotate by creating a new key before revoking the old one. ORVEX stores only an Argon2id hash — lost keys cannot be recovered.
      </Callout>
      <Button size="sm" variant="secondary" to="/admin/developer/keys" trailing={<ArrowUpRight />}>
        Manage API keys
      </Button>
    </DocSection>
  )
}

const ERROR_ROWS: [number, string, string][] = [
  [400, 'bad_request', 'Malformed JSON or an unknown parameter.'],
  [401, 'invalid_api_key', 'Missing, invalid, revoked or expired API key.'],
  [402, 'insufficient_balance', 'Balance plus credit line cannot cover the order price. Nothing was charged.'],
  [403, 'service_not_allowed', 'The service is not enabled for this reseller. Also account_suspended, ip_not_allowed, insufficient_scope.'],
  [404, 'not_found', 'The order or service does not exist, or belongs to another reseller.'],
  [409, 'idempotency_conflict', 'Idempotency-Key reused with a different body. Also order_not_ready for results.'],
  [422, 'validation_failed', 'An input field failed the service schema — e.g. an IMEI that is not 15 digits or fails Luhn. See error.field and error.reason.'],
  [429, 'rate_limited', 'Too many requests. Retry after error.retry_after seconds.'],
  [500, 'internal_error', 'Unexpected error on the installation side. Safe to retry with the same Idempotency-Key.'],
  [503, 'service_unavailable', 'Maintenance window, or the service is paused because no supplier can currently serve it.'],
]

const REASONS: [string, string][] = [
  ['required', 'A required field (imei, network, model…) is missing.'],
  ['pattern_mismatch', 'Wrong format — e.g. an IMEI with 14 digits or a serial with lowercase letters.'],
  ['luhn_failed', 'The IMEI is 15 digits but its check digit is wrong — almost always a typo.'],
  ['invalid_option', 'The value is not one of the field options, e.g. network: "att" instead of att_us.'],
]

const ORDER_FAILURES: [string, string][] = [
  ['provider_rejected', 'The supplier refused the job: IMEI blacklisted, device not eligible (contract or financing active), wrong network selected, model not supported.'],
  ['provider_timeout', 'Every supplier in the routing chain timed out. Common during carrier maintenance windows.'],
  ['provider_error', 'The supplier returned an error after all fallbacks were tried.'],
  ['no_route', 'No eligible supplier is mapped or healthy for this service.'],
]

export function ErrorsSection() {
  return (
    <DocSection
      id="errors"
      aside={
        <>
          <ExampleSwitcher
            label="Examples"
            items={[
              { id: 'imei', label: 'Invalid IMEI', content: <ResponseCode status={422} title="Luhn checksum failed" code={json(ERROR_422)} /> },
              { id: 'network', label: 'Wrong network', content: <ResponseCode status={422} title="Unknown carrier option" code={json(ERROR_422_NETWORK)} /> },
              { id: 'balance', label: 'Balance', content: <ResponseCode status={402} title="Insufficient balance" code={json(ERROR_402)} /> },
              { id: 'rate', label: 'Rate limit', content: <ResponseCode status={429} title="Rate limited" code={json(ERROR_429)} /> },
              { id: 'rejected', label: 'Blacklisted', content: <ResponseCode status={200} title="GET /orders/ord_10486 · supplier rejected" code={json(ORDER_REJECTED)} maxHeight={340} /> },
            ]}
          />
          <CodeBlock
            title="Handling errors · Node.js"
            lang="js"
            code={`const res = await fetch(url, opts)
if (!res.ok) {
  const { error } = await res.json()
  switch (error.code) {
    case 'rate_limited':
      await sleep(error.retry_after * 1000); break
    case 'insufficient_balance':
      return notifyTopUp(error.available)
    case 'validation_failed': // e.g. imei · luhn_failed
      return showFieldError(error.field, error.message)
    default:
      throw new Error(\`\${error.code}: \${error.message} (\${error.request_id})\`)
  }
}`}
          />
        </>
      }
    >
      <H2>Errors</H2>
      <P>
        ORVEX uses conventional HTTP status codes. <C>2xx</C> means success, <C>4xx</C> means the request needs to change, and <C>5xx</C> indicates a problem on the installation side. Every error body has the same shape, with a stable machine-readable <C>code</C>.
      </P>
      <SimpleTable
        head={['Status', 'Code', 'Meaning']}
        mono={[0, 1]}
        rows={ERROR_ROWS.map(([s, c, m]) => [<span key="s" className={s >= 500 ? 'text-danger' : 'text-warning'}>{s}</span>, c, m])}
      />

      <H3>Validation reasons</H3>
      <P>
        A <C>422 validation_failed</C> names the offending <C>field</C> and a <C>reason</C>, so shops can highlight the exact input. IMEIs are validated before routing — a typo never reaches a supplier and is never charged.
      </P>
      <SimpleTable head={['reason', 'When']} rows={REASONS} />

      <ParamTable
        title="Error object"
        params={[
          { name: 'type', type: 'string', required: true, description: 'Broad category.', values: ['invalid_request_error', 'authentication_error', 'rate_limit_error', 'api_error'] },
          { name: 'code', type: 'string', required: true, description: 'Stable, machine-readable error code from the table above.' },
          { name: 'message', type: 'string', required: true, description: 'Human-readable explanation. May change — do not parse it.' },
          { name: 'field', type: 'string', description: <>For validation errors, the offending input field key, e.g. <C>imei</C>.</> },
          { name: 'reason', type: 'enum', description: 'For validation errors, why the field was rejected.', values: REASONS.map(([r]) => r) },
          { name: 'retry_after', type: 'integer', description: 'For 429 responses, seconds to wait before retrying.' },
          { name: 'request_id', type: 'string', required: true, description: 'Unique request identifier, also returned as X-Request-Id.' },
        ]}
      />

      <H3>Order failures</H3>
      <P>
        Supplier rejections are <span className="text-fg">not HTTP errors</span>. The order was valid and accepted, so it moves to <C>failed</C> later, the charge is released to the balance and an <C>order.failed</C> webhook carries <C>error.code</C>:
      </P>
      <SimpleTable head={['error.code', 'Typical cause']} rows={ORDER_FAILURES} />
    </DocSection>
  )
}

export function RateLimitSection() {
  return (
    <DocSection
      id="rate-limits"
      aside={
        <>
          <CodeBlock
            title="Response headers"
            lang="http"
            code={`HTTP/1.1 200 OK
Content-Type: application/json
X-Request-Id: req_8f29c1d07ab34e5f9d2c6b18
X-RateLimit-Limit: 600
X-RateLimit-Remaining: 587
X-RateLimit-Reset: 1759311720`}
          />
          <ResponseCode status={429} title="Rate limited" code={json(ERROR_429)} />
        </>
      }
    >
      <H2>Rate limits</H2>
      <P>
        Limits are enforced per reseller across all of its keys, using a sliding one-minute window. Individual keys can carry a lower limit. Additional caps apply to orders per day and orders in flight at the same time — all are visible to administrators on the reseller&apos;s Limits tab.
      </P>
      <SimpleTable
        head={['Header', 'Description']}
        rows={[
          ['X-RateLimit-Limit', 'Requests allowed in the current window.'],
          ['X-RateLimit-Remaining', 'Requests left in the current window.'],
          ['X-RateLimit-Reset', 'Unix timestamp (seconds) when the window resets.'],
          ['Retry-After', 'Sent with 429 responses: seconds to wait. Mirrors error.retry_after.'],
        ]}
      />
      <Callout tone="tip" title="Bulk IMEI checks">
        Shops checking a whole trade-in batch should queue requests client-side and stay under <C>X-RateLimit-Remaining</C>. On 429, wait <C>retry_after</C> seconds and retry with exponential backoff and jitter — a POST retried with the same Idempotency-Key never creates a duplicate order.
      </Callout>
    </DocSection>
  )
}

export function IdempotencySection() {
  return (
    <DocSection
      id="idempotency"
      aside={
        <>
          <SampleCode label="Idempotent unlock order" samples={samplesFor({ method: 'POST', path: '/orders', body: ORDER_CREATE_BODY, idempotent: true })} />
          <CodeBlock
            title="Replayed response"
            lang="http"
            code={`HTTP/1.1 201 Created
Idempotent-Replayed: true
X-Request-Id: req_8f29c1d07ab34e5f9d2c6b18`}
          />
        </>
      }
    >
      <H2>Idempotency</H2>
      <P>
        Network failures happen — and a $28 unlock must never be ordered twice. To retry <C>POST /orders</C> safely, send an <C>Idempotency-Key</C> header (a UUID v4 is recommended, max 255 characters). The first response for a key is stored and replayed for any retry with the same key, so an order is never created or charged twice.
      </P>
      <SimpleTable
        head={['Rule', 'Behaviour']}
        mono={[]}
        rows={[
          ['Window', 'Keys are remembered for 24 hours after the first request.'],
          ['Scope', 'Keys are scoped to the API key that sent them.'],
          ['Replay', <span key="r">The original status and body are returned with <C>Idempotent-Replayed: true</C>.</span>],
          ['Mismatch', <span key="m">Same key with a different body (e.g. another IMEI) fails with <C>409 idempotency_conflict</C>.</span>],
          ['In progress', 'A concurrent request with the same key waits for the first one to finish.'],
        ]}
      />
    </DocSection>
  )
}

/* ------------------------------------------------------------------------- */
/*  Endpoints                                                                */
/* ------------------------------------------------------------------------- */
export function ListServicesSection({ services, loading }: { services: Service[]; loading: boolean }) {
  const imei = services.filter((s) => s.category === 'IMEI Services')
  const count = (c: ServiceCategory) => services.filter((s) => s.category === c).length
  return (
    <DocSection
      id="list-services"
      aside={
        <>
          <SampleCode samples={samplesFor({ method: 'GET', path: '/services', query: { category: 'imei_services', limit: 3 } })} />
          <ResponseCode status={200} live={!loading} code={loading ? '// loading live catalog…' : json({ object: 'list', data: imei.slice(0, 3).map((s) => serviceToApi(s, { fields: false })), has_more: imei.length > 3 })} />
        </>
      }
    >
      <EndpointHeader method="GET" path="/services" title="List services" scope="services:read" />
      <P>
        Returns the services this reseller can order, with the reseller&apos;s <span className="text-fg">effective price</span> — the public price after its pricing group discount and any contract price. Services not enabled for the reseller are omitted. The response on the right is live data from this installation&apos;s catalog ({loading ? '…' : services.length} active services).
      </P>

      <H3>Categories</H3>
      <div className="mt-3 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[460px] text-[12.5px]">
          <thead>
            <tr className="border-b border-line bg-surface-2/50">
              {['Slug', 'Covers', 'Live'].map((h, i) => (
                <th key={h} className={`px-3.5 py-2 text-left text-[11.5px] font-medium text-fg-3 ${i === 2 ? 'text-right' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {CATEGORY_ORDER.map((c) => (
              <tr key={c} className="align-top transition-colors hover:bg-surface-2/40">
                <td className="px-3.5 py-2.5 whitespace-nowrap">
                  <span className="inline-flex items-center gap-2 font-mono text-[12px] text-fg">
                    <span className="size-2 rounded-[3px]" style={{ background: categoryColor(c) }} />
                    {CATEGORY_SLUG[c]}
                  </span>
                </td>
                <td className="px-3.5 py-2.5 text-fg-2">{CATEGORY_NOTES[c]}</td>
                <td className="px-3.5 py-2.5 text-right font-mono text-[12px] text-fg tabular">{loading ? '…' : count(c)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ParamTable
        title="Query parameters"
        params={[
          { name: 'category', type: 'enum', description: 'Only return services in this category.', values: CATEGORY_SLUGS },
          { name: 'delivery', type: 'enum', description: 'instant for synchronous checks and calculator codes; async for unlocks, server services and most codes.', values: ['instant', 'async', 'manual'] },
          { name: 'limit', type: 'integer', description: 'Page size between 1 and 100. Defaults to 50.' },
          { name: 'starting_after', type: 'string', description: 'Cursor: a service ID from the previous page.' },
        ]}
      />
    </DocSection>
  )
}

export function GetServiceSection({ service, loading }: { service?: Service; loading: boolean }) {
  return (
    <DocSection
      id="get-service"
      aside={
        <>
          <SampleCode samples={samplesFor({ method: 'GET', path: `/services/${service?.id ?? 'SVC-1007'}` })} />
          <ResponseCode status={200} live={!!service} code={service ? json(serviceToApi(service)) : loading ? '// loading…' : '{}'} maxHeight={460} />
        </>
      }
    >
      <EndpointHeader method="GET" path="/services/:id" title="Retrieve a service" scope="services:read" />
      <P>
        Retrieves a single service including its input schema. Use the field definitions to build the order form in the shop or panel — e.g. an <C>imei</C> text input with Luhn validation and a <C>network</C> dropdown with the carrier options — before calling Create an order.
      </P>
      <ParamTable title="Path parameters" params={[{ name: 'id', type: 'string', required: true, description: <>Service identifier, e.g. <C>SVC-1007</C>.</> }]} />
      <ParamTable
        title="Service object"
        params={[
          { name: 'id', type: 'string', required: true, description: 'Stable service identifier.' },
          { name: 'name', type: 'string', required: true, description: 'Display name, e.g. iPhone Unlock — USA Carriers.' },
          { name: 'category', type: 'enum', required: true, description: 'Service category slug.', values: CATEGORY_SLUGS },
          { name: 'delivery', type: 'enum', required: true, description: 'instant services answer synchronously within seconds; async services complete later and notify via webhook.', values: ['instant', 'async', 'manual'] },
          { name: 'price', type: 'money', required: true, description: 'Effective price for the calling reseller.' },
          { name: 'turnaround_seconds', type: 'object', required: true, description: 'Expected min / max completion time — seconds for checks, hours for carrier unlocks.' },
          {
            name: 'fields[]',
            type: 'array',
            required: true,
            description: (
              <>
                Input schema. Each field has <C>key</C>, <C>type</C>, <C>required</C> and optionally <C>pattern</C>, <C>options</C>, <C>example</C> and <C>checksum</C> (<C>luhn</C> for IMEIs).
              </>
            ),
          },
        ]}
      />
    </DocSection>
  )
}

export function CreateOrderSection() {
  return (
    <DocSection
      id="create-order"
      aside={
        <ExampleSwitcher
          label="Example"
          items={[
            {
              id: 'instant',
              label: (
                <>
                  <span className="font-mono text-[10.5px] text-fg-3">SVC-1001</span> Instant check
                </>
              ),
              content: (
                <>
                  <SampleCode samples={samplesFor({ method: 'POST', path: '/orders', body: IMEI_CHECK_BODY, idempotent: true })} />
                  <ResponseCode status={201} title="Created · result inline" code={json(IMEI_CHECK_ORDER)} maxHeight={360} />
                </>
              ),
            },
            {
              id: 'async',
              label: (
                <>
                  <span className="font-mono text-[10.5px] text-fg-3">SVC-1007</span> Async unlock
                </>
              ),
              content: (
                <>
                  <SampleCode samples={samplesFor({ method: 'POST', path: '/orders', body: ORDER_CREATE_BODY, idempotent: true })} />
                  <ResponseCode status={201} title="Created · processing" code={json(ORDER_OBJECT)} maxHeight={360} />
                </>
              ),
            },
          ]}
        />
      }
    >
      <EndpointHeader method="POST" path="/orders" title="Create an order" scope="orders:write" />
      <P>
        Creates an order and charges its price to the reseller balance immediately. ORVEX validates the input against the service schema (including the IMEI Luhn checksum), routes the order to the best available supplier and falls back automatically if a supplier fails. If the order ultimately fails, the charge is released.
      </P>
      <SimpleTable
        head={['delivery', 'Examples', 'What you get']}
        mono={[0]}
        rows={[
          ['instant', 'IMEI Check — Full Report, GSMA blacklist, iCloud/FMI, Huawei calculator codes', <span key="i">The result is already in the <C>201</C> response, typically within 2–8 s.</span>],
          ['async', 'iPhone / Samsung / UK / EU network unlocks, FRP, Mi Account, NCK & SP codes', <span key="a"><C>201</C> with status <C>processing</C> and <C>turnaround_seconds</C>; the result arrives with <C>order.completed</C>.</span>],
          ['manual', 'Services held for staff review by a routing rule', 'Same as async; status pending until reviewed.'],
        ]}
      />
      <ParamTable title="Headers" params={[{ name: 'Idempotency-Key', type: 'string', description: <>Recommended. Makes retries safe — see <button type="button" className="text-accent-ink hover:underline" onClick={() => scrollTo('idempotency')}>Idempotency</button>.</> }]} />
      <ParamTable
        title="Body parameters"
        params={[
          { name: 'service_id', type: 'string', required: true, description: <>The service to order, e.g. <C>SVC-1001</C> or <C>SVC-1007</C>.</> },
          {
            name: 'fields',
            type: 'object',
            required: true,
            description: (
              <>
                Input values keyed by the service&apos;s field <C>key</C> — e.g. <C>imei</C> (15 digits, Luhn-checked) and <C>network</C> (one of the options, such as <C>att_us</C>).
              </>
            ),
          },
          { name: 'client_reference', type: 'string', description: 'Your own identifier, e.g. the shop’s job number (max 64 chars). Echoed in responses and webhooks; searchable in List orders.' },
          { name: 'metadata', type: 'object', description: 'Up to 20 string key-value pairs stored with the order (customer ticket, store branch…).' },
        ]}
      />
      <Callout title="Common failures">
        <C>402 insufficient_balance</C> when funds run out, <C>403 service_not_allowed</C> for services outside the reseller&apos;s allowlist, and <C>422 validation_failed</C> with the offending <C>field</C> — e.g. <C>imei</C> with reason <C>luhn_failed</C> for <C>{DEMO_IMEI.TYPO}</C>. A blacklisted IMEI is accepted, then rejected by the supplier: the order fails and is refunded automatically.
      </Callout>
      <Button size="sm" variant="primary" trailing={<ArrowRight />} onClick={() => scrollTo('try-it')}>
        Try it in the console
      </Button>
    </DocSection>
  )
}

const LIFECYCLE: [string, string][] = [
  ['created', 'Accepted and charged; waiting to be routed to a supplier.'],
  ['processing', 'Submitted to a supplier; awaiting the result. Carrier unlocks can stay here for hours.'],
  ['pending', 'Held for manual review by a routing rule (e.g. high-value unlocks).'],
  ['success', 'Completed. The result — report, unlock confirmation or code — is available.'],
  ['failed', 'All suppliers rejected or failed (e.g. IMEI blacklisted). The charge was released.'],
  ['refunded', 'Completed, then refunded by an operator (e.g. the unlock did not apply).'],
  ['cancelled', 'Cancelled before a supplier started processing.'],
]

export function GetOrderSection() {
  return (
    <DocSection
      id="get-order"
      aside={
        <>
          <SampleCode samples={samplesFor({ method: 'GET', path: '/orders/ord_10482' })} />
          <ResponseCode status={200} code={json(ORDER_COMPLETED)} maxHeight={420} />
        </>
      }
    >
      <EndpointHeader method="GET" path="/orders/:id" title="Retrieve an order" scope="orders:read" />
      <P>Retrieves the current state of an order. Prefer webhooks over polling — an unlock can take hours. If you must poll, do not poll more than once every 2 seconds per order, and back off to minutes for async services.</P>
      <ParamTable title="Path parameters" params={[{ name: 'id', type: 'string', required: true, description: <>Order ID such as <C>ord_10482</C>, or the numeric order number.</> }]} />
      <H3>Lifecycle</H3>
      <div className="mb-4 flex flex-wrap items-center gap-1.5 text-fg-3">
        {['created', 'processing', 'success'].map((s, i) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            {i > 0 && <ArrowRight className="size-3.5" />}
            <StatusBadge status={s} noPulse />
          </span>
        ))}
        <span className="mx-1 text-[12px]">or</span>
        <StatusBadge status="failed" />
      </div>
      <SimpleTable head={['Status', 'Meaning']} rows={LIFECYCLE.map(([s, m]) => [s, m])} />
    </DocSection>
  )
}

const RESULT_EXAMPLES: { id: string; label: string; result: Record<string, unknown> }[] = [
  { id: 'unlock', label: 'Unlock', result: ORDER_RESULT },
  {
    id: 'code',
    label: 'NCK + MCK',
    result: { id: 'ord_10475', object: 'order_result', status: 'success', summary: 'NCK 48213907 · MCK 77120458', data: { nck: '48213907', mck: '77120458', attempts_remaining: 5 }, completed_at: '2026-10-01T09:12:44Z' },
  },
  {
    id: 'check',
    label: 'Blacklist',
    result: { id: 'ord_10479', object: 'order_result', status: 'success', summary: 'CLEAN — not on the GSMA blacklist', data: { gsma_status: 'clean', reason: 'none', checked_registries: 42 }, completed_at: '2026-10-01T09:30:53Z' },
  },
  {
    id: 'server',
    label: 'FRP',
    result: { id: 'ord_10471', object: 'order_result', status: 'success', summary: 'FRP removed — device ready for setup', data: { frp: 'removed', server_job: 'FRP-3C91E0' }, completed_at: '2026-10-01T08:51:20Z' },
  },
]

export function GetResultSection() {
  return (
    <DocSection
      id="get-order-result"
      aside={
        <>
          <SampleCode samples={samplesFor({ method: 'GET', path: '/orders/ord_10482/result' })} />
          <ExampleSwitcher label="Result" items={RESULT_EXAMPLES.map((r) => ({ id: r.id, label: r.label, content: <ResponseCode status={200} code={json(r.result)} /> }))} />
          <ResponseCode status={409} title="Not ready yet" code={json({ error: { type: 'invalid_request_error', code: 'order_not_ready', message: 'Order ord_10484 is processing (iPhone Unlock — USA Carriers, typical turnaround 1–6 h). Retry when status is success.', request_id: 'req_0d7e1c4b2a9f4c36b8e1' } })} />
        </>
      }
    >
      <EndpointHeader method="GET" path="/orders/:id/result" title="Retrieve a result" scope="orders:read" />
      <P>
        Returns the normalised result of a successful order. Regardless of which supplier served the order, results for a service always share the same <C>data</C> schema — your shop never has to parse supplier-specific formats. <C>summary</C> is a short line suitable for showing to the end customer.
      </P>
      <ParamTable
        title="Result object"
        params={[
          { name: 'status', type: 'enum', required: true, description: 'Always success for available results.' },
          { name: 'summary', type: 'string', required: true, description: 'One-line outcome, e.g. “NCK 48213907” or “FMI: OFF — clean”.' },
          { name: 'data', type: 'object', required: true, description: 'Service-specific structured result (see below).' },
          { name: 'completed_at', type: 'timestamp', required: true, description: 'When the supplier returned the final result.' },
        ]}
      />
      <H3>Result data by category</H3>
      <SimpleTable
        head={['Category', 'Typical data keys', 'Summary example']}
        mono={[0, 1]}
        rows={[
          ['imei_services', 'gsma_status, carrier, sim_lock, fmi', 'CLEAN — not on the GSMA blacklist'],
          ['unlocking', 'unlocked, method, carrier_reference', 'Unlocked — whitelisted on carrier database'],
          ['server_services', 'frp, mi_account, server_job', 'FRP removed — device ready for setup'],
          ['codes', 'nck, mck, sp_code, attempts_remaining', 'NCK 48213907 · MCK 77120458'],
          ['other_services', 'line_type, carrier, ported, in_warranty', 'Mobile · Vodafone UK · original network'],
        ]}
      />
    </DocSection>
  )
}

export function ListOrdersSection() {
  return (
    <DocSection
      id="list-orders"
      aside={
        <>
          <SampleCode samples={samplesFor({ method: 'GET', path: '/orders', query: { status: 'success', limit: 2 } })} />
          <ResponseCode status={200} code={json({ object: 'list', data: [ORDER_COMPLETED, BLACKLIST_ORDER], has_more: true })} maxHeight={420} />
        </>
      }
    >
      <EndpointHeader method="GET" path="/orders" title="List orders" scope="orders:read" />
      <P>Returns the reseller&apos;s orders, newest first. Combine filters to reconcile with the shop&apos;s own job records — or pull every order ever placed for one device by its IMEI.</P>
      <ParamTable
        title="Query parameters"
        params={[
          { name: 'status', type: 'enum', description: 'Only orders in this status.', values: LIFECYCLE.map(([s]) => s) },
          { name: 'service_id', type: 'string', description: 'Only orders for this service, e.g. SVC-1007.' },
          { name: 'category', type: 'enum', description: 'Only orders for services in this category.', values: CATEGORY_SLUGS },
          { name: 'imei', type: 'string', description: 'Exact match on the imei field — the full order history of one device.' },
          { name: 'client_reference', type: 'string', description: 'Exact match on your reference.' },
          { name: 'created_after', type: 'timestamp', description: 'ISO 8601 lower bound on created_at.' },
          { name: 'limit', type: 'integer', description: 'Page size between 1 and 100. Defaults to 25.' },
          { name: 'starting_after', type: 'string', description: 'Cursor: an order ID from the previous page.' },
        ]}
      />
    </DocSection>
  )
}

export function BalanceSection() {
  return (
    <DocSection
      id="get-balance"
      aside={
        <>
          <SampleCode samples={samplesFor({ method: 'GET', path: '/balance' })} />
          <ResponseCode status={200} code={json(BALANCE_OBJECT)} />
        </>
      }
    >
      <EndpointHeader method="GET" path="/balance" title="Retrieve balance" scope="balance:read" />
      <P>Returns the prepaid balance and credit line of the reseller that owns the key. Orders are accepted while the order price fits within <C>available</C> — show it in the shop so staff know before a batch of unlocks fails with 402.</P>
      <ParamTable
        title="Balance object"
        params={[
          { name: 'balance', type: 'money', required: true, description: 'Current prepaid balance. Negative when credit is in use.' },
          { name: 'credit_limit', type: 'money', required: true, description: 'How far the balance may go below zero.' },
          { name: 'available', type: 'money', required: true, description: 'balance + credit_limit — the spendable amount.' },
          { name: 'low_balance_threshold', type: 'money', required: true, description: 'A balance.low webhook is sent when the balance drops below this.' },
        ]}
      />
    </DocSection>
  )
}

/* ------------------------------------------------------------------------- */
/*  Webhooks                                                                 */
/* ------------------------------------------------------------------------- */
export function WebhookEventsSection() {
  const completed = WEBHOOK_EVENTS.find((e) => e.id === 'order.completed')!
  const failed = WEBHOOK_EVENTS.find((e) => e.id === 'order.failed')!
  return (
    <DocSection
      id="webhooks"
      aside={
        <ExampleSwitcher
          label="Payload"
          items={[
            { id: 'completed', label: 'order.completed', content: <CodeBlock title="Unlock completed" lang="json" code={json(completed.payload)} maxHeight={440} /> },
            { id: 'failed', label: 'order.failed', content: <CodeBlock title="IMEI blacklisted · refunded" lang="json" code={json(failed.payload)} maxHeight={440} /> },
          ]}
        />
      }
    >
      <H2 eyebrow="Webhooks">Events</H2>
      <P>
        Register an HTTPS endpoint and ORVEX sends a <C>POST</C> with a JSON event the moment an unlock completes, a code is delivered, a check is rejected or the balance runs low — no polling needed. Every event shares the same envelope: <C>id</C>, <C>type</C>, <C>created_at</C> and <C>data</C>.
      </P>
      <SimpleTable head={['Event', 'Sent when']} rows={WEBHOOK_EVENTS.filter((e) => e.id !== 'service.updated').map((e) => [e.id, e.description])} />
      <Callout tone="tip" title="Design for at-least-once delivery">
        Events can arrive more than once or out of order. Deduplicate on the event <C>id</C>, match orders by <C>client_reference</C>, compare <C>created_at</C>, and answer with a <C>2xx</C> within 10 seconds — do heavy work (emailing the customer their unlock code) asynchronously.
      </Callout>
      <Button size="sm" variant="secondary" to="/admin/developer/webhooks" trailing={<ArrowUpRight />}>
        Manage endpoints
      </Button>
    </DocSection>
  )
}

const VERIFY_NODE = `import crypto from 'node:crypto'

// Use the raw request body — not a re-serialised JSON object.
export function verify(rawBody, header, secret) {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')))
  const timestamp = Number(parts.t)

  // Reject events older than 5 minutes (replay protection).
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) return false

  const expected = crypto
    .createHmac('sha256', secret)
    .update(\`\${timestamp}.\${rawBody}\`)
    .digest('hex')

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1))
}

app.post('/webhooks/orvex', express.raw({ type: 'application/json' }), (req, res) => {
  if (!verify(req.body.toString(), req.get('Webhook-Signature'), process.env.WEBHOOK_SECRET)) {
    return res.status(400).send('invalid signature')
  }
  const event = JSON.parse(req.body)
  // e.g. order.completed → mark the shop job done and send the unlock result
  queue.push(event) // process asynchronously
  res.sendStatus(200)
})`

const VERIFY_PY = `import hashlib, hmac, os, time

def verify(raw_body: bytes, header: str, secret: str) -> bool:
    parts = dict(p.split("=", 1) for p in header.split(","))
    timestamp = int(parts["t"])

    # Reject events older than 5 minutes (replay protection).
    if abs(time.time() - timestamp) > 300:
        return False

    signed = f"{timestamp}.".encode() + raw_body
    expected = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, parts["v1"])

@app.post("/webhooks/orvex")
def orvex_webhook():
    if not verify(request.get_data(), request.headers["Webhook-Signature"], os.environ["WEBHOOK_SECRET"]):
        abort(400)
    event = request.get_json()
    # e.g. order.failed with provider_rejected → notify the customer, balance already refunded
    queue.put(event)  # process asynchronously
    return "", 200`

export function WebhookSignaturesSection() {
  return (
    <DocSection
      id="webhook-signatures"
      aside={
        <CodeBlock
          tabs={[
            { label: 'Node.js', lang: 'js', code: VERIFY_NODE },
            { label: 'Python', lang: 'python', code: VERIFY_PY },
          ]}
          maxHeight={520}
        />
      }
    >
      <H2 eyebrow="Webhooks">Verifying signatures</H2>
      <P>
        Each delivery is signed with your endpoint&apos;s signing secret (<C>whsec_…</C>, shown once when the endpoint is created). Always verify it — an unsigned “unlock completed” callback could otherwise be forged. The <C>Webhook-Signature</C> header contains a timestamp and an HMAC-SHA256 signature:
      </P>
      <CodeBlock lang="http" code={`Webhook-Signature: t=1759311672,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd`} wrap />
      <ol className="mt-5 space-y-3 text-[13.5px] leading-relaxed text-fg-2">
        {[
          <>
            Split the header on <C>,</C> and read <C>t</C> (Unix seconds) and <C>v1</C> (hex signature).
          </>,
          <>
            Build the signed payload: <C>{'{t}.{raw_body}'}</C> — the exact bytes received.
          </>,
          <>Compute HMAC-SHA256 of that payload with your signing secret and hex-encode it.</>,
          <>Compare with v1 in constant time, and reject timestamps more than 5 minutes old.</>,
        ].map((li, i) => (
          <li key={i} className="flex gap-3">
            <span className="grid size-5 shrink-0 place-items-center rounded-full border border-line bg-surface-2 font-mono text-[10.5px] text-fg-2">{i + 1}</span>
            <span>{li}</span>
          </li>
        ))}
      </ol>
    </DocSection>
  )
}

const RETRIES: [number, string, string][] = [
  [1, 'Immediately', '0s'],
  [2, '30 seconds', '30s'],
  [3, '2 minutes', '2m 30s'],
  [4, '10 minutes', '12m 30s'],
  [5, '30 minutes', '42m 30s'],
  [6, '1 hour', '1h 42m'],
  [7, '3 hours', '4h 42m'],
  [8, '6 hours', '10h 42m'],
]

export function WebhookRetriesSection() {
  return (
    <DocSection
      id="webhook-retries"
      aside={
        <CodeBlock
          title="Delivery request"
          lang="http"
          code={`POST /orvex/orders HTTP/1.1
Host: hooks.mobilehub.example
Content-Type: application/json
User-Agent: Webhook-Dispatcher/2.4.1
Webhook-Event: order.completed
Webhook-Delivery: whd_000412
Webhook-Attempt: 3
Webhook-Signature: t=1759311672,v1=5257a869e7ec…`}
        />
      }
    >
      <H2 eyebrow="Webhooks">Retries</H2>
      <P>
        A delivery succeeds when your endpoint answers with any <C>2xx</C> status within 10 seconds. Anything else — a non-2xx status, a timeout or a connection error — is retried with exponential backoff, up to 8 attempts over roughly 11 hours, so a shop server that is briefly down still receives its unlock results.
      </P>
      <SimpleTable head={['Attempt', 'Delay', 'Elapsed']} mono={[0, 2]} rows={RETRIES.map(([a, d, c]) => [`#${a}`, d, c])} />
      <P className="mt-4">
        After the last attempt the delivery is marked <C>failed</C>. Endpoints that keep failing are flagged as failing in the admin, where any delivery can be inspected and replayed once the endpoint is fixed. Results stay available via <C>GET /orders/:id/result</C> in the meantime.
      </P>
    </DocSection>
  )
}
