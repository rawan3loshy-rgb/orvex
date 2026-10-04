import { Link } from 'react-router'
import { motion } from 'motion/react'
import { ArrowUpRight, Play } from 'lucide-react'
import { Button, CodeBlock } from '@/components/ui'
import { cn } from '@/lib/cn'
import { MethodBadge } from '../shared'
import { API_BASE, RETRY_LABELS, SCOPES, WEBHOOK_EVENTS } from '../helpers'
import { AUTH_SAMPLES, BAD_LUHN_IMEI, DEMO_IMEI, SAMPLE_ORDER, VERIFY_NODE, VERIFY_PYTHON, WEBHOOK_SAMPLE_BODY, WEBHOOK_SAMPLE_HEADERS, endpointSamples, type EndpointDef } from './samples'
import { C, Callout, DocSection, EndpointHeader, H2, H3, P, ResponseCode, SampleCode, SimpleTable } from './primitives'
import { DOC_NAV, goTo } from './docsNav'

/* ------------------------------------------------------------------------- */
/*  Navigation                                                               */
/* ------------------------------------------------------------------------- */
export function DocsSidebar({ active }: { active: string }) {
  return (
    <nav aria-label="API reference" className="space-y-6">
      {DOC_NAV.map((g) => (
        <div key={g.group}>
          <div className="mono-label mb-2 px-2.5">{g.group}</div>
          <ul className="space-y-px">
            {g.items.map((it) => {
              const on = it.id === active
              return (
                <li key={it.id} className="relative">
                  {on && (
                    <motion.span layoutId="orx-docs-active" className="absolute inset-0 rounded-lg bg-surface-3/80 shadow-[inset_0_0_0_1px_var(--line)]" transition={{ type: 'spring', stiffness: 500, damping: 40 }}>
                      <span className="absolute top-1/2 left-0 h-3.5 w-[2px] -translate-y-1/2 rounded-full bg-accent" />
                    </motion.span>
                  )}
                  <a
                    href={`#${it.id}`}
                    onClick={(e) => {
                      e.preventDefault()
                      goTo(it.id)
                    }}
                    className={cn('relative flex h-8 items-center gap-2 rounded-lg px-2.5 text-[13px] transition-colors', on ? 'font-medium text-fg' : 'text-fg-2 hover:text-fg')}
                  >
                    {it.method && <MethodBadge method={it.method} size="xs" />}
                    <span className="truncate">{it.label}</span>
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export function DocsJumpBar({ active }: { active: string }) {
  return (
    <div className="no-scrollbar sticky top-14 z-20 -mx-1 mb-2 flex items-center gap-1 overflow-x-auto border-b border-line bg-bg/90 px-1 py-2 backdrop-blur xl:hidden">
      {DOC_NAV.flatMap((g) => g.items).map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => goTo(it.id)}
          className={cn('flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] whitespace-nowrap transition-colors', it.id === active ? 'bg-surface-3 font-medium text-fg' : 'text-fg-3 hover:text-fg-2')}
        >
          {it.method && <MethodBadge method={it.method} size="xs" />}
          {it.label}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/*  Sections                                                                 */
/* ------------------------------------------------------------------------- */
export function OverviewSection() {
  return (
    <DocSection
      id="overview"
      aside={
        <>
          <CodeBlock
            title="Base URL"
            lang="text"
            code={API_BASE}
          />
          <SimpleTable
            head={['Area', 'Endpoints']}
            mono={[]}
            rows={[
              ['Catalog', <span className="font-mono text-[12px]">GET /v1/services · /v1/services/:id</span>],
              ['Orders', <span className="font-mono text-[12px]">POST /v1/orders · /v1/orders/batch · GET /v1/orders · /v1/orders/:id · POST …/cancel · …/verify</span>],
              ['Account', <span className="font-mono text-[12px]">GET /v1/account · /v1/account/transactions</span>],
            ]}
          />
        </>
      }
    >
      <H2 eyebrow="Native API v1">Overview</H2>
      <P>
        The Native API is a JSON-over-HTTPS REST API served by <strong className="text-fg">this installation</strong> — UnlockDesk runs it on its own server and database, not on an ORVEX-hosted service. Partners use it to read the catalog with their own prices, place orders, poll results and read their wallet.
      </P>
      <P>
        Every order placed through the API enters the same <C>PlaceOrder</C> command as the storefront, the reseller portal, the DHRU-compatible endpoint and the admin console: same validation (IMEI: 15 digits + Luhn), same pricing tier, same wallet hold, same supplier routing with guarded failover.
      </P>
      <Callout tone="tip" title="Try every call against this installation">
        The <strong>API console</strong> tab executes these endpoints through the real request handler. Orders you place there are real orders in this demo installation — they hold wallet funds and appear in Orders and API logs.
      </Callout>
    </DocSection>
  )
}

export function AuthSection() {
  return (
    <DocSection id="authentication" aside={<SampleCode samples={AUTH_SAMPLES} label="Authenticated request" />}>
      <H2 eyebrow="Security">Authentication & keys</H2>
      <P>
        Send the secret as a bearer token: <C>Authorization: Bearer orx_live_…</C>. Keys belong to an <strong className="text-fg">account</strong> — any account tier with the API channel enabled (reseller, business, API-only), not just resellers. The account’s pricing tier, service access, limits and wallet apply to every call made with its keys.
      </P>
      <P>
        Only a SHA-256 hash of the secret is stored; the full key is shown once at creation. The public prefix (<C>orx_live_a3c1</C>) identifies the key in logs. Test keys (<C>orx_test_…</C>) authenticate the same way.
      </P>
      <H3>Scopes</H3>
      <SimpleTable head={['Scope', 'Grants']} rows={SCOPES.map((s) => [s.id, s.description])} />
      <H3>IP allow-lists</H3>
      <P>
        A key may be restricted to IPs or CIDR ranges (e.g. <C>203.0.113.0/24</C>). Requests from anywhere else are refused with <C>403 ip_not_allowed</C> before anything else is evaluated.
      </P>
      <H3>Rate limits</H3>
      <P>
        Each key has a per-minute limit (default 600/min, configurable per key). Responses carry <C>x-ratelimit-limit</C>; exceeding it returns <C>429 rate_limited</C> with <C>details.retry_after</C> in seconds. Separately, account limits (max order value, concurrent open orders) return <C>429 limit_exceeded</C>.
      </P>
      <P className="mb-0">
        Keys may also be enabled for the <a href="#dhru" className="text-accent-ink hover:underline" onClick={(e) => { e.preventDefault(); goTo('dhru') }}>DHRU-compatible endpoint</a> so legacy clients can authenticate with the same secret.
      </P>
    </DocSection>
  )
}

export function IdempotencySection() {
  const first = JSON.stringify({ ...SAMPLE_ORDER, id: 'ORD-9QW2EZ', service: { id: '4006', name: 'IMEI Blacklist Check (GSMA)', revision: 2 }, price: { amount: '0.74', currency: 'USD' }, client_reference: null }, null, 2)
  const conflict = JSON.stringify({ error: { code: 'idempotency_conflict', message: 'Idempotency-Key "mh-batch-20261004-0042" was already used with a different request', details: { orderId: 'ord_…' } } }, null, 2)
  return (
    <DocSection
      id="idempotency"
      aside={
        <>
          <CodeBlock
            lang="http"
            title="1 · First request → 201 Created"
            code={`POST /v1/orders\nIdempotency-Key: mh-batch-20261004-0042\n\n{"service":"4006","input":{"imei":"${DEMO_IMEI}"}}\n\nHTTP/1.1 201 Created\nx-request-id: req_7hX…`}
          />
          <CodeBlock
            lang="http"
            title="2 · Retry, same body → 200 + replay"
            code={`POST /v1/orders\nIdempotency-Key: mh-batch-20261004-0042\n\n{"service":"4006","input":{"imei":"${DEMO_IMEI}"}}\n\nHTTP/1.1 200 OK\nidempotent-replayed: true\n\n→ same order ORD-9QW2EZ, no second hold`}
          />
          <ResponseCode status={409} title="3 · Same key, different body" code={conflict} maxHeight={200} />
          <details className="group rounded-xl border border-line bg-surface-2/40 px-3.5 py-2.5 text-[12.5px] text-fg-3">
            <summary className="cursor-pointer text-fg-2">Body returned by 1 and 2</summary>
            <pre className="mt-2 max-h-56 overflow-auto font-mono text-[11.5px] text-fg-2">{first}</pre>
          </details>
        </>
      }
    >
      <H2 eyebrow="Safe retries">Idempotency</H2>
      <P>
        Send <C>Idempotency-Key</C> on every <C>POST /v1/orders</C> and <C>POST /v1/orders/batch</C>. Keys are scoped to the <strong className="text-fg">account</strong> — not to the API key — and remembered for <strong className="text-fg">24 hours</strong>. A retry through a different API key, or even a different channel (portal, DHRU <C>REFERENCE</C>), still resolves to the original order.
      </P>
      <SimpleTable
        head={['Situation', 'Result']}
        mono={[]}
        rows={[
          ['Key never seen (or older than 24h)', 'Order is placed normally → 201 Created'],
          ['Same key, identical body (service, input, client_reference)', <span>Original order returned → <C>200</C> with header <C>Idempotent-Replayed: true</C>. No second order, no second wallet hold.</span>],
          ['Same key, different body', <span><C>409 idempotency_conflict</C> — nothing is placed. Use a new key for a new order.</span>],
        ]}
      />
      <Callout tone="info" title="Scenario J in this installation">
        MobileHub retried <C>POST /v1/orders</C> with <C>mh-batch-20261004-0042</C>: one order, one charge, and a later request with a different IMEI under the same key got 409. Search that key in <Link to="/admin/developer/logs?search=mh-batch-20261004-0042" className="text-accent-ink hover:underline">API logs</Link>.
      </Callout>
    </DocSection>
  )
}

const ERROR_ROWS: [string, number, string][] = [
  ['missing_api_key', 401, 'No Authorization header.'],
  ['invalid_api_key', 401, 'Unknown or revoked key.'],
  ['expired_api_key', 401, 'Key passed its expiry date.'],
  ['ip_not_allowed', 403, 'Caller IP is outside the key’s allow-list.'],
  ['insufficient_scope', 403, 'Key lacks the scope this endpoint needs.'],
  ['account_frozen', 403, 'The key’s account is frozen (e.g. chargeback review).'],
  ['channel_not_enabled', 403, 'The API channel is disabled for this account.'],
  ['service_not_allowed', 403, 'Account’s service access excludes this service.'],
  ['not_found', 404, 'Service or order does not exist (or belongs to another account).'],
  ['validation_failed', 422, 'Input failed the service schema — see details.fields (e.g. IMEI Luhn).'],
  ['service_unavailable', 409, 'No routable supplier offer right now (health, circuit, margin guard).'],
  ['idempotency_conflict', 409, 'Idempotency-Key reused with a different body.'],
  ['insufficient_balance', 402, 'Available + credit limit cannot cover the price.'],
  ['limit_exceeded', 429, 'Account limit: max order value or concurrent open orders.'],
  ['rate_limited', 429, 'Per-key requests/min exceeded; retry after details.retry_after.'],
]

export function ErrorsSection() {
  const sample = JSON.stringify({ error: { code: 'validation_failed', message: 'Input validation failed', details: { fields: { imei: 'IMEI checksum (Luhn) is invalid' } } } }, null, 2)
  return (
    <DocSection
      id="errors"
      aside={
        <>
          <ResponseCode status={422} code={sample} title={`IMEI ${BAD_LUHN_IMEI}`} />
          <ResponseCode status={402} code={JSON.stringify({ error: { code: 'insufficient_balance', message: 'Insufficient balance: $1.20 available, $34.00 required' } }, null, 2)} maxHeight={160} />
        </>
      }
    >
      <H2 eyebrow="Reference">Errors</H2>
      <P>
        Errors use conventional HTTP status codes and a stable machine-readable <C>error.code</C>. Branch on the code, show the message. <C>details</C> carries structured context — field-level validation messages, the conflicting order, or <C>retry_after</C>.
      </P>
      <SimpleTable head={['code', 'HTTP', 'Meaning']} mono={[0, 1]} rows={ERROR_ROWS.map(([c, s, m]) => [c, s, m])} />
      <Callout tone="tip" title="Validated before money moves">
        Input validation (15 digits, Luhn checksum, carrier/model enums) happens before pricing and the wallet hold — a rejected request never charges the account.
      </Callout>
    </DocSection>
  )
}

export function MoneySection() {
  return (
    <DocSection id="money" aside={<CodeBlock lang="json" title="Money object" code={JSON.stringify({ price: { amount: '0.94', currency: 'USD' }, cost_example: { amount: '0.0425', currency: 'USD' } }, null, 2)} />}>
      <H2 eyebrow="Format">Money</H2>
      <P>
        Amounts cross the API as <strong className="text-fg">decimal strings</strong> with a currency — <C>{'{"amount":"0.94","currency":"USD"}'}</C> — never floats. Parse them with a decimal type (<C>decimal.Decimal</C>, <C>big.js</C>, <C>BigDecimal</C>).
      </P>
      <P className="mb-0">
        Internally ORVEX stores money as integer micro-units (1 USD = 1,000,000) in a double-entry ledger. Normal prices render with 2 decimals; sub-cent amounts keep 4 (<C>"0.0425"</C>).
      </P>
    </DocSection>
  )
}

export function StatusSection() {
  return (
    <DocSection
      id="statuses"
      aside={
        <CodeBlock
          lang="json"
          title="Order under operator review"
          code={JSON.stringify({ id: 'ORD-3XK8PL', status: 'processing', status_detail: 'under_review', financial_status: 'held' }, null, 2)}
        />
      }
    >
      <H2 eyebrow="Lifecycle">Status model</H2>
      <P>Each order carries two independent statuses — fulfilment and financial — plus an optional detail.</P>
      <H3 className="mt-2">status (fulfilment)</H3>
      <SimpleTable
        head={['status', 'Meaning']}
        rows={[
          ['awaiting_payment', 'Waiting for a payment (storefront checkout). Not used for wallet-funded API orders.'],
          ['queued', 'Accepted and funded, waiting to be dispatched.'],
          ['processing', 'At a supplier — or being reviewed (see status_detail).'],
          ['completed', 'Result available in result.'],
          ['rejected', 'No supplier could fulfil it; funds released. Reason in rejection.'],
          ['cancelled', 'Cancelled before completion; funds released.'],
        ]}
      />
      <H3>status_detail</H3>
      <SimpleTable
        head={['value', 'Meaning']}
        rows={[
          ['under_review', 'The supplier outcome is uncertain (e.g. timeout after send). An operator verifies before anything is retried — it is never silently re-sent to another supplier.'],
          ['at_supplier', 'Accepted by the supplier, waiting for the result.'],
          ['null', 'No extra detail.'],
        ]}
      />
      <H3>financial_status</H3>
      <SimpleTable
        head={['value', 'Meaning']}
        rows={[
          ['none', 'Not funded yet.'],
          ['held', 'Price held in the wallet.'],
          ['captured', 'Charged (order completed).'],
          ['released', 'Hold released (rejected / cancelled).'],
          ['partially_refunded', 'Part of the captured amount refunded.'],
          ['refunded', 'Fully refunded.'],
        ]}
      />
    </DocSection>
  )
}

function TryButton({ e, onTry }: { e: EndpointDef; onTry: (id: string) => void }) {
  return (
    <Button size="sm" variant="secondary" leading={<Play />} onClick={() => onTry(e.id)} className="shrink-0">
      Try it
    </Button>
  )
}

export function EndpointSection({ e, onTry }: { e: EndpointDef; onTry: (id: string) => void }) {
  return (
    <DocSection
      id={e.id}
      aside={
        <>
          <SampleCode samples={endpointSamples(e)} label="Request" />
          <ResponseCode status={e.response.status} code={JSON.stringify(e.response.body, null, 2)} />
        </>
      }
    >
      <EndpointHeader method={e.method} path={e.path} title={e.title} scope={e.scope} actions={<TryButton e={e} onTry={onTry} />} />
      <P>{e.summary.split(/(`[^`]+`)/).map((part, i) => (part.startsWith('`') ? <C key={i}>{part.slice(1, -1)}</C> : part))}</P>
      <EndpointParams e={e} />
    </DocSection>
  )
}

function EndpointParams({ e }: { e: EndpointDef }) {
  switch (e.id) {
    case 'get-service':
      return <SimpleTable head={['Path parameter', 'Description']} rows={[['id', 'Service code, e.g. 4001 (the same ID DHRU clients use).']]} />
    case 'create-order':
      return (
        <>
          <SimpleTable
            head={['Body field', 'Type', 'Description']}
            mono={[0, 1]}
            rows={[
              ['service', 'string', <span>Service code (<C>4001</C>). Required.</span>],
              ['input', 'object', <span>Values for the service’s <C>input_schema</C>, e.g. <C>{`{"imei":"${DEMO_IMEI}"}`}</C>. Required.</span>],
              ['client_reference', 'string', 'Your own reference, echoed back and searchable. Optional.'],
            ]}
          />
          <SimpleTable head={['Header', 'Description']} rows={[['Idempotency-Key', 'Strongly recommended. Account-scoped, 24 h. See Idempotency.']]} />
        </>
      )
    case 'batch-orders':
      return <SimpleTable head={['Body field', 'Type', 'Description']} mono={[0, 1]} rows={[['orders', 'array', '1–100 objects shaped like a single order body.']]} />
    case 'list-orders':
      return (
        <SimpleTable
          head={['Query', 'Type', 'Description']}
          mono={[0, 1]}
          rows={[
            ['status', 'string', 'Filter by public status. processing includes orders under review.'],
            ['limit', 'integer', 'Max results, default 25, max 100.'],
          ]}
        />
      )
    case 'cancel-order':
      return <SimpleTable head={['Body field', 'Type', 'Description']} mono={[0, 1]} rows={[['reason', 'string', 'Optional note stored on the order timeline.']]} />
    case 'verify-order':
      return (
        <SimpleTable
          head={['Body field', 'Type', 'Description']}
          mono={[0, 1]}
          rows={[
            ['reason', 'enum', 'code_not_working · wrong_result · result_missing · other'],
            ['message', 'string', 'What happened, for the operator and supplier.'],
          ]}
        />
      )
    case 'account-transactions':
      return <SimpleTable head={['Query', 'Type', 'Description']} mono={[0, 1]} rows={[['limit', 'integer', 'Max lines, default 50.']]} />
    case 'get-order':
      return <SimpleTable head={['Path parameter', 'Description']} rows={[['id', 'Order reference, e.g. ORD-7K3P9Q. Orders of other accounts return 404.']]} />
    default:
      return null
  }
}

export function WebhookEventsSection() {
  return (
    <DocSection id="webhook-events" aside={<CodeBlock lang="json" title="order.completed payload" code={WEBHOOK_SAMPLE_BODY} maxHeight={420} />}>
      <H2 eyebrow="Webhooks">Events</H2>
      <P>
        Register HTTPS endpoints per account (or installation-wide for the operator) and subscribe to events. The payload is <C>{'{ type, timestamp, data }'}</C> where <C>data</C> is the API representation of the object — the same shape as <C>GET /v1/orders/:id</C>.
      </P>
      <SimpleTable head={['Event', 'When']} rows={WEBHOOK_EVENTS.map((e) => [e.id, <span>{e.description}{e.operatorOnly && <span className="ml-1.5 rounded bg-warning/10 px-1.5 py-px font-mono text-[10.5px] text-warning">operator only</span>}</span>])} />
    </DocSection>
  )
}

export function WebhookSignatureSection() {
  return (
    <DocSection
      id="webhook-signatures"
      aside={
        <>
          <CodeBlock lang="http" title="Delivery headers" code={WEBHOOK_SAMPLE_HEADERS} />
          <CodeBlock tabs={[{ label: 'Node.js', lang: 'js', code: VERIFY_NODE }, { label: 'Python', lang: 'python', code: VERIFY_PYTHON }]} maxHeight={460} />
        </>
      }
    >
      <H2 eyebrow="Webhooks">Signatures</H2>
      <P>
        Deliveries follow the <strong className="text-fg">Standard Webhooks</strong> convention. Each request carries three headers:
      </P>
      <SimpleTable
        head={['Header', 'Value']}
        rows={[
          ['webhook-id', 'Unique message id (msg_…). Stable across retries and manual replays — de-duplicate on it.'],
          ['webhook-timestamp', 'Unix seconds when the message was signed. Reject anything older than ~5 minutes.'],
          ['webhook-signature', 'Space-separated list of v1,<base64> signatures.'],
        ]}
      />
      <H3>Computing the signature</H3>
      <CodeBlock lang="text" code={'signed_content = "{webhook-id}.{webhook-timestamp}.{raw body}"\nsignature      = base64( HMAC-SHA256( secret, signed_content ) )\nheader         = "v1," + signature'} />
      <Callout tone="warning" title="Verify the raw body">
        Compute the HMAC over the exact bytes received, before JSON parsing or re-serialising. Use a constant-time comparison.
      </Callout>
    </DocSection>
  )
}

export function WebhookRetriesSection() {
  return (
    <DocSection id="webhook-retries">
      <H2 eyebrow="Webhooks">Retries & replay</H2>
      <P>
        A delivery succeeds on any <C>2xx</C> response. Otherwise it is retried on this schedule — 8 attempts in total — then marked <C>failed</C>, the endpoint flagged <C>failing</C> and the operator notified.
      </P>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {RETRY_LABELS.map((l, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[12px]">
              <span className="font-mono text-[10.5px] text-fg-3">#{i + 1}</span>
              <span className="font-mono text-fg">{l}</span>
            </span>
            {i < RETRY_LABELS.length - 1 && <span className="h-px w-3 bg-line-strong" />}
          </span>
        ))}
      </div>
      <P className="mt-5 mb-0">
        Operators can replay any delivery from <Link to="/admin/developer/webhooks?tab=deliveries" className="text-accent-ink hover:underline">Webhooks → Deliveries</Link>. A replay re-sends with the <strong className="text-fg">same webhook-id</strong>, so a receiver that already processed it simply ignores the duplicate.
      </P>
    </DocSection>
  )
}

export function DhruPointerSection() {
  return (
    <DocSection id="dhru">
      <H2 eyebrow="Legacy integrations">DHRU compatibility</H2>
      <P>
        Resellers migrating from a DHRU Fusion panel can keep their existing client. A DHRU-compatible endpoint accepts the classic form POST (<C>username</C> = account email, <C>apiaccesskey</C> = an ORVEX key with DHRU compatibility enabled, <C>action</C>, XML <C>parameters</C>) and answers with <C>{'{"SUCCESS":[…]}'}</C> / <C>{'{"ERROR":[…]}'}</C>.
      </P>
      <P>
        Translation happens only at the edge: <C>placeimeiorder</C> becomes the same <C>PlaceOrder</C> command, and order statuses are mapped to DHRU’s numeric 0 / 1 / 3 / 4 on the way out. Core never uses numeric states.
      </P>
      <Button to="/admin/developer/dhru" variant="secondary" trailing={<ArrowUpRight />}>
        DHRU compatibility & console
      </Button>
    </DocSection>
  )
}
