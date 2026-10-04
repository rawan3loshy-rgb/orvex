import { useState } from 'react'
import { motion } from 'motion/react'
import { ArrowRight, BookOpen, KeyRound, Lock, ShieldCheck, Webhook } from 'lucide-react'
import { Badge, Button, Card, CardHeader, CodeBlock, CopyButton, DescriptionList } from '@/components/ui'
import { useWebhooks } from '@/hooks/installation'
import { cn } from '@/lib/cn'
import { money } from '@/lib/format'
import type { Service, WebhookEventType } from '@/types/installation'
import { API_BASE, ORDER_EVENTS, createResponse, curlSnippet, jsSnippet, jsonSchema, pythonSnippet, requestJson, resultResponse, sampleResult, webhookHeaders, webhookPayload } from '../examples'
import { Callout, DELIVERY, turnaroundLabel } from '../shared'

export function ApiSchemaTab({ service: s }: { service: Service }) {
  const D = DELIVERY[s.delivery]
  const instant = s.delivery === 'instant'
  return (
    <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-5 xl:sticky xl:top-20 xl:self-start">
        <Card>
          <CardHeader icon={<BookOpen />} title="Create order" description="Generated from this service’s schema." />
          <div className="px-5 pb-5">
            <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2/60 px-3 py-2">
              <span className="rounded bg-success/12 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-success">POST</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">/api/v1/orders</span>
              <CopyButton value={`${API_BASE}/orders`} />
            </div>
            <DescriptionList
              className="mt-3"
              items={[
                { label: 'Auth', value: 'Bearer API key' },
                { label: 'Scope', value: 'orders:write', mono: true },
                { label: 'Idempotency', value: 'Idempotency-Key · 24h' },
                { label: 'Delivery', value: `${D.label} · ${instant ? 'result inline' : 'webhook or polling'}` },
                { label: 'Turnaround', value: turnaroundLabel(s.turnaround) },
                { label: 'Price', value: money(s.price) },
                { label: 'Sample result', value: <span className="font-mono text-[12px]">{sampleResult(s).summary}</span> },
              ]}
            />
          </div>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader title="Fields" description={`${s.fields.length} keys in fields`} />
          <ul className="divide-y divide-line border-t border-line">
            {s.fields.map((f) => (
              <li key={f.key} className="flex items-center gap-2 px-5 py-2.5">
                <span className="font-mono text-[12px] text-fg">{f.key}</span>
                {f.sensitive && <Lock className="size-3 text-fg-3" />}
                <span className="ml-auto font-mono text-[11px] text-fg-3">{f.type}</span>
                {f.required ? <Badge variant="outline">required</Badge> : <Badge>optional</Badge>}
              </li>
            ))}
            {!s.fields.length && <li className="px-5 py-4 text-[12.5px] text-fg-3">No fields — the body only needs service_id.</li>}
          </ul>
        </Card>
      </div>
      <div className="min-w-0 space-y-5">
        <section>
          <SectionLabel n={1} title="Request" hint="Send the service ID and the order input (IMEI, network…). Keys outside the schema are rejected; IMEIs are Luhn-checked." />
          <CodeBlock
            tabs={[
              { label: 'JSON', lang: 'json', code: requestJson(s) },
              { label: 'cURL', lang: 'bash', code: curlSnippet(s) },
              { label: 'JavaScript', lang: 'js', code: jsSnippet(s) },
              { label: 'Python', lang: 'python', code: pythonSnippet(s) },
            ]}
            maxHeight={380}
          />
        </section>
        <section>
          <SectionLabel n={2} title="JSON Schema" hint="Validate client-side with any JSON Schema 2020-12 library." />
          <CodeBlock title={`schemas/${s.id}.json`} code={jsonSchema(s)} lang="json" maxHeight={360} lineNumbers />
        </section>
        <section>
          <SectionLabel n={3} title="Response" hint={instant ? `Instant services return the result in the same call — typically ${turnaroundLabel(s.turnaround)}.` : `Async services return immediately with status processing; the supplier result follows in ${turnaroundLabel(s.turnaround)}.`} />
          <CodeBlock title="201 Created" code={createResponse(s)} lang="json" maxHeight={360} />
        </section>
        {!instant && (
          <section>
            <SectionLabel n={4} title="Async result" hint="Poll the result endpoint or subscribe to order.completed — both carry the same normalised result." />
            <CodeBlock
              tabs={[
                { label: `GET /orders/:id/result`, lang: 'json', code: resultResponse(s) },
                { label: 'Webhook · order.completed', lang: 'json', code: webhookPayload(s, 'order.completed') },
              ]}
              maxHeight={360}
            />
          </section>
        )}
        <Callout tone="neutral" icon={<KeyRound />}>
          Errors use one envelope: <code className="font-mono text-[12px] text-fg">{'{ "error": { "code", "message", "field" } }'}</code>. Validation failures (e.g. an IMEI failing the Luhn check) return <span className="font-medium text-fg">422</span> with the failing field; insufficient reseller balance returns <span className="font-medium text-fg">402</span>.
        </Callout>
      </div>
    </div>
  )
}

function SectionLabel({ n, title, hint }: { n: number; title: string; hint: string }) {
  return (
    <div className="mb-2.5 flex items-baseline gap-2.5">
      <span className="grid size-5 shrink-0 translate-y-0.5 place-items-center rounded-full border border-line bg-surface-2 font-mono text-[10.5px] text-fg-2">{n}</span>
      <div>
        <h3 className="text-[13.5px] font-semibold">{title}</h3>
        <p className="text-[12px] text-fg-3">{hint}</p>
      </div>
    </div>
  )
}

export function WebhooksTab({ service: s }: { service: Service }) {
  const [active, setActive] = useState<WebhookEventType>('order.completed')
  const hooks = useWebhooks()
  const subscribed = (t: WebhookEventType) => (hooks.data ?? []).filter((w) => w.status !== 'disabled' && w.events.includes(t)).length
  const instant = s.delivery === 'instant'
  const ev = ORDER_EVENTS.find((e) => e.type === active)!
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <Card className="overflow-hidden lg:self-start">
        <CardHeader icon={<Webhook />} title="Events emitted" description={`Lifecycle events for every ${s.name} order — sent to resellers’ endpoints, signed and retried with backoff.`} />
        <ul className="border-t border-line p-1.5">
          {ORDER_EVENTS.map((e) => {
            const skipped = e.asyncOnly && instant
            const n = subscribed(e.type)
            return (
              <li key={e.type}>
                <button
                  type="button"
                  onClick={() => setActive(e.type)}
                  className={cn('relative flex w-full items-start gap-3 rounded-lg px-3.5 py-3 text-left transition-colors', active === e.type ? 'bg-surface-2' : 'hover:bg-surface-2/60', skipped && 'opacity-60')}
                >
                  {active === e.type && <motion.span layoutId="wh-active" className="absolute top-2.5 bottom-2.5 left-0 w-[2px] rounded-full bg-accent" />}
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', e.type === 'order.failed' ? 'bg-danger' : e.type === 'order.completed' ? 'bg-success' : e.type === 'order.processing' ? 'bg-warning' : e.type === 'order.created' ? 'bg-info' : 'bg-fg-3')} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[12.5px] font-medium text-fg">{e.type}</span>
                      {skipped && <Badge>Not sent for instant</Badge>}
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-fg-3">{e.when}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-fg-3 tabular">{n} endpoint{n === 1 ? '' : 's'}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <div className="border-t border-line px-5 py-3">
          <Button size="sm" variant="ghost" to="/admin/developer/webhooks" trailing={<ArrowRight />} className="-ml-2">
            Manage endpoints
          </Button>
        </div>
      </Card>
      <div className="min-w-0 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="mono-label">Example delivery</div>
            <div className="mt-0.5 text-[15px] font-semibold">{ev.title}</div>
          </div>
          {ev.asyncOnly && instant && <Badge tone="warning">Skipped for instant delivery</Badge>}
        </div>
        <CodeBlock title="Headers" code={webhookHeaders(active)} lang="http" />
        <CodeBlock title="Body" code={webhookPayload(s, active)} lang="json" maxHeight={420} />
        <Callout tone="success" icon={<ShieldCheck />} title="Verify every delivery">
          Compute HMAC-SHA256 over <code className="font-mono text-[12px]">timestamp.body</code> with the endpoint’s signing secret and compare it to <code className="font-mono text-[12px]">v1</code> in Webhook-Signature. Reject deliveries older than five minutes. Failed deliveries retry up to 8 times with exponential backoff.
        </Callout>
      </div>
    </div>
  )
}
