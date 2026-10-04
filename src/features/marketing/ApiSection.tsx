import { ArrowRight, BookOpen, Gauge, KeyRound, Plug, RefreshCw, Webhook, type LucideIcon } from 'lucide-react'
import { Badge, Button, CodeBlock, type CodeTab } from '@/components/ui'
import { brand, demoInstallation } from '@/config/brand'
import { Container, Reveal, Section, SectionHeader } from './shared'

const BASE = `https://${demoInstallation.domain}/v1`

const TABS: CodeTab[] = [
  {
    label: 'cURL',
    lang: 'bash',
    code: `# API_KEY=orx_live_…  (scopes: orders:write services:read)
curl -X POST ${BASE}/orders \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Idempotency-Key: 6f1c2a9e-4b7d-4e1a-9c3f-2d8b5e7a1c04" \\
  -H "Content-Type: application/json" \\
  -d '{
    "service": "4040",
    "client_reference": "shop-7781",
    "input": {
      "imei": "352094117328416",
      "model": "SM-S918B"
    }
  }'`,
  },
  {
    label: 'Node.js',
    lang: 'js',
    code: `import { randomUUID } from 'node:crypto'

// Samsung Network Unlock Code (NCK)
const res = await fetch('${BASE}/orders', {
  method: 'POST',
  headers: {
    Authorization: \`Bearer \${process.env.API_KEY}\`, // orx_live_…
    'Idempotency-Key': randomUUID(),
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    service: '4040',
    client_reference: 'shop-7781',
    input: { imei: '352094117328416', model: 'SM-S918B' },
  }),
})

const order = await res.json() // → status: "queued"`,
  },
  {
    label: 'Python',
    lang: 'python',
    code: `import os, uuid, requests

# Samsung Network Unlock Code (NCK)
res = requests.post(
    "${BASE}/orders",
    headers={
        "Authorization": f"Bearer {os.environ['API_KEY']}",  # orx_live_…
        "Idempotency-Key": str(uuid.uuid4()),
    },
    json={
        "service": "4040",
        "client_reference": "shop-7781",
        "input": {"imei": "352094117328416", "model": "SM-S918B"},
    },
    timeout=10,
)

order = res.json()  # status: "queued"`,
  },
  {
    label: 'DHRU client',
    lang: 'bash',
    code: `# Existing DHRU Fusion client — only the URL changes
curl -X POST https://${demoInstallation.domain}/api/dhru \\
  -d username=abcgsm \\
  -d apiaccesskey=orx_live_… \\
  -d action=placeimeiorder \\
  --data-urlencode 'parameters=<PARAMETERS>
      <ID>4040</ID><IMEI>352094117328416</IMEI>
      <MODEL>SM-S918B</MODEL><REFERENCE>shop-7781</REFERENCE>
    </PARAMETERS>'

# → {"SUCCESS":[{"MESSAGE":"Order received","REFERENCEID":"ORD-9T1V6B"}]}`,
  },
]

const RESULT_TABS: CodeTab[] = [
  {
    label: '201 Response',
    lang: 'json',
    code: `{
  "id": "ORD-9T1V6B",
  "object": "order",
  "status": "queued",
  "status_detail": null,
  "financial_status": "held",
  "service": { "id": "4040", "name": "Samsung Network Unlock Code (NCK)", "revision": 1 },
  "input": { "imei": "352094117328416", "model": "SM-S918B" },
  "price": { "amount": "9.00", "currency": "USD" },
  "client_reference": "shop-7781",
  "channel": "api",
  "created_at": "2026-10-04T10:14:03Z"
}`,
  },
  {
    label: 'Webhook · order.completed',
    lang: 'http',
    code: `POST https://hooks.abc-gsm.example/orvex
Content-Type: application/json
webhook-id: msg_2Qx7fK9aT1
webhook-timestamp: 1791108161
webhook-signature: v1,K5oZfzN95Z9UVu1EsfQmfVNQhnkZ2pj9o9NDN/H/pI4=

{
  "type": "order.completed",
  "data": {
    "id": "ORD-9T1V6B",
    "status": "completed",
    "financial_status": "captured",
    "service": { "id": "4040" },
    "result": { "summary": "NCK code delivered" },
    "completed_at": "2026-10-04T11:02:41Z"
  }
}`,
  },
]

const FEATURES: { icon: LucideIcon; title: string; body: string; code: string }[] = [
  { icon: KeyRound, title: 'Scoped API keys', body: 'Keys belong to an account, carry explicit scopes, can be pinned to IP allowlists and revoked instantly.', code: 'orx_live_7Hq2…  orders:write' },
  { icon: Gauge, title: 'Rate limits', body: 'Per-key limits with standard headers, so clients back off gracefully instead of hammering your queue.', code: 'RateLimit-Remaining: 596' },
  { icon: RefreshCw, title: 'Account-scoped idempotency', body: 'A retry with the same key returns the original order — even through another key or channel of the same account. Never a double hold on a wallet.', code: 'Idempotency-Key: 6f1c2a9e-…' },
  { icon: Webhook, title: 'Standard Webhooks', body: 'Every order event is signed per the Standard Webhooks spec and retried on a fixed schedule with the same message id, so receivers can de-duplicate.', code: 'webhook-signature: v1,…' },
]

const ENDPOINTS = [
  ['GET', '/v1/services'],
  ['POST', '/v1/orders'],
  ['GET', '/v1/orders/:id'],
  ['POST', '/v1/orders/:id/verify'],
  ['GET', '/v1/account'],
]

const IMPORT_STEPS = ['Scan', 'Dry run', 'Diff', 'Review', 'Import', 'Validate']

function DhruPanel() {
  return (
    <Reveal className="mt-14 grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg border border-accent/30 bg-accent/10 text-accent-ink">
            <Plug className="size-4" />
          </span>
          <div>
            <div className="text-[14.5px] font-semibold text-fg">DHRU-compatible endpoint</div>
            <div className="font-mono text-[11px] text-fg-3">POST /api/dhru · accountinfo · imeiservicelist · placeimeiorder · getimeiorder</div>
          </div>
        </div>
        <p className="mt-3 text-[13.5px] leading-relaxed text-fg-2">
          Resellers who already run a DHRU client keep it — they change the URL and use a key with DHRU compatibility enabled. Their orders enter the same PlaceOrder command as every other channel, at their own tier price. DHRU’s numeric statuses exist only at this edge; Core never sees them.
        </p>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[14.5px] font-semibold text-fg">DHRU migration importer</div>
          <Badge tone="neutral">Simulated in the demo</Badge>
        </div>
        <p className="mt-3 text-[13.5px] leading-relaxed text-fg-2">Moving off a DHRU panel? The importer reads services, clients, price groups and credit balances, shows exactly what will change, and imports only what you approve — balances arrive as opening ledger entries.</p>
        <ol className="mt-4 flex flex-wrap items-center gap-1.5">
          {IMPORT_STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className="inline-flex h-6 items-center gap-1.5 rounded-md border border-line bg-surface-2/70 px-2 font-mono text-[11px] text-fg-2">
                <span className="text-fg-3">{i + 1}</span>
                {s}
              </span>
              {i < IMPORT_STEPS.length - 1 && <ArrowRight className="size-3 text-fg-3" />}
            </li>
          ))}
        </ol>
      </div>
    </Reveal>
  )
}

export function ApiSection() {
  return (
    <Section id="developers" className="overflow-hidden bg-bg-subtle/60">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-line" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-line" />
      <Container className="relative">
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
          <div>
            <SectionHeader
              index="09"
              eyebrow="Native API & DHRU compatibility"
              title="An API your partners will enjoy — and a door for legacy DHRU clients."
              description="Every installation exposes the Native API v1 for partners and reseller integrations — typed GSM fields, wallet-backed orders and the guarantees production integrations depend on — plus a DHRU-compatible endpoint so existing reseller clients keep working."
            />
            <div className="mt-10 grid gap-x-6 gap-y-7 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={i * 0.05}>
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 place-items-center rounded-lg border border-line bg-surface text-fg-2 shadow-card">
                      <f.icon className="size-4" />
                    </span>
                    <span className="text-[14.5px] font-semibold text-fg">{f.title}</span>
                  </div>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-fg-2">{f.body}</p>
                  <code className="mt-2.5 inline-block max-w-full truncate rounded-md border border-line bg-surface px-2 py-1 font-mono text-[11px] text-fg-2">{f.code}</code>
                </Reveal>
              ))}
            </div>
            <Reveal className="mt-10 flex flex-wrap items-center gap-3">
              <Button variant="secondary" href={brand.docsUrl} leading={<BookOpen />}>
                API reference
              </Button>
              <span className="text-[12.5px] text-fg-3">OpenAPI 3.1 spec included with every release</span>
            </Reveal>
          </div>

          <Reveal delay={0.1} className="min-w-0 space-y-3 lg:pt-6">
            <div className="flex flex-wrap items-center gap-1.5">
              {ENDPOINTS.map(([m, p]) => (
                <span key={p} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 font-mono text-[11px] text-fg-2">
                  <span className={m === 'POST' ? 'text-accent-ink' : 'text-fg-3'}>{m}</span>
                  {p}
                </span>
              ))}
            </div>
            <CodeBlock tabs={TABS} className="bg-surface shadow-pop" maxHeight={420} />
            <CodeBlock
              tabs={RESULT_TABS}
              className="bg-surface shadow-card"
              maxHeight={340}
              actions={
                <span className="hidden items-center gap-2 pr-1 sm:flex">
                  <Badge tone="success" variant="soft">
                    201
                  </Badge>
                  <span className="font-mono text-[11px] text-fg-3">84ms · req_9f2c41ab</span>
                </span>
              }
            />
          </Reveal>
        </div>
        <DhruPanel />
      </Container>
    </Section>
  )
}
