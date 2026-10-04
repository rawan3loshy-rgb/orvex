import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ChevronRight, Clock, RotateCw, Send, Webhook } from 'lucide-react'
import { useInstMutation, useWebhookDeliveries } from '@/hooks/installation'
import { developerService } from '@/services/installation'
import type { Reseller, WebhookDelivery, WebhookEndpoint } from '@/types/installation'
import { Button, CodeBlock, DescriptionList, EmptyState, MonoValue, Pagination, SecretField, Segmented, Skeleton, StatusBadge, Switch, Drawer } from '@/components/ui'
import { cn } from '@/lib/cn'
import { date, dateTime, ms, num, pct, relative, time } from '@/lib/format'
import { toast } from '@/stores/toast'
import { EventChip, StatusCode, prettyJson } from '../shared'

type DFilter = 'all' | 'delivered' | 'failed' | 'retrying'

/** Pseudo signature for display — derived from the delivery id, never from the real secret. */
function fakeSig(seed: string) {
  let h = 2166136261
  let out = ''
  for (let i = 0; out.length < 64; i++) {
    h ^= seed.charCodeAt(i % seed.length) + i
    h = Math.imul(h, 16777619) >>> 0
    out += h.toString(16).padStart(8, '0')
  }
  return out.slice(0, 64)
}

export function EndpointDrawer({ endpoint: w, open, owner, onClose }: { endpoint: WebhookEndpoint | undefined; open: boolean; owner?: Reseller; onClose: () => void }) {
  const [delivery, setDelivery] = useState<WebhookDelivery | null>(null)
  useEffect(() => {
    if (open) setDelivery(null)
  }, [open, w?.id])

  const toggle = useInstMutation((on: boolean) => developerService.updateWebhook(w!.id, { status: on ? 'active' : 'disabled' }), { success: (x) => (x.status === 'disabled' ? 'Endpoint disabled — deliveries paused' : 'Endpoint enabled') })

  return (
    <Drawer
      open={open && !!w}
      onClose={onClose}
      width="xl"
      icon={<Webhook />}
      title={w ? new URL(w.url).host : ''}
      description={w ? <span className="font-mono text-[12px]">{new URL(w.url).pathname}</span> : undefined}
      actions={
        w && (
          <label className="mr-2 flex items-center gap-2 text-[12.5px] text-fg-2">
            <span className="hidden sm:inline">{w.status === 'disabled' ? 'Disabled' : 'Enabled'}</span>
            <Switch checked={w.status !== 'disabled'} onChange={(v) => toggle.mutate(v)} disabled={toggle.isPending} label="Enable endpoint" />
          </label>
        )
      }
    >
      {w && (
        <AnimatePresence mode="wait" initial={false}>
          {delivery ? (
            <motion.div key={`delivery-${delivery.id}`} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.2 }}>
              <DeliveryDetail endpoint={w} delivery={delivery} onBack={() => setDelivery(null)} onReplayed={setDelivery} />
            </motion.div>
          ) : (
            <motion.div key="overview" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
              <EndpointOverview endpoint={w} owner={owner} onOpenDelivery={setDelivery} />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </Drawer>
  )
}

function EndpointOverview({ endpoint: w, owner, onOpenDelivery }: { endpoint: WebhookEndpoint; owner?: Reseller; onOpenDelivery: (d: WebhookDelivery) => void }) {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<DFilter>('all')
  const [page, setPage] = useState(1)
  const deliveries = useWebhookDeliveries({ endpointId: w.id, status: filter, page, pageSize: 12 })
  const [lastTest, setLastTest] = useState<WebhookDelivery | null>(null)

  const test = useInstMutation(() => developerService.testWebhook(w.id), {
    onSuccess: (d) => {
      setLastTest(d)
      if (d.status === 'delivered') toast.success('Test event delivered', `${d.responseCode} · ${ms(d.latencyMs)}`)
      else toast.error('Test event failed', `Endpoint responded ${d.responseCode ?? 'with a timeout'}`)
    },
  })

  return (
    <div className="space-y-7">
      {w.status === 'failing' && (
        <div className="flex items-start gap-3 rounded-xl border border-danger/25 bg-danger/[0.05] p-3.5 text-[13px]">
          <StatusBadge status="failing" />
          <p className="text-fg-2">Most recent deliveries are failing, so this reseller’s shop is not receiving unlock results and codes. ORVEX keeps retrying with exponential backoff for up to 8 attempts, then marks the delivery failed. Fix the endpoint, then replay failed deliveries.</p>
        </div>
      )}

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        {[
          { label: 'Success · 24h', value: pct(w.successRate24h), tone: w.successRate24h < 90 ? 'text-danger' : w.successRate24h < 99 ? 'text-warning' : 'text-success' },
          { label: 'Avg latency', value: ms(w.avgLatencyMs), tone: '' },
          { label: 'Deliveries · 24h', value: num(w.deliveries24h), tone: '' },
          { label: 'Last delivery', value: w.lastDeliveryAt ? relative(w.lastDeliveryAt) : 'Never', tone: '' },
        ].map((s) => (
          <div key={s.label} className="bg-surface p-4">
            <div className="mono-label">{s.label}</div>
            <div className={cn('mt-1.5 font-display text-[19px] leading-none font-semibold tracking-[-0.02em] tabular', s.tone || 'text-fg')}>{s.value}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <h4 className="mb-1 text-[13px] font-semibold">Configuration</h4>
          <DescriptionList
            items={[
              { label: 'URL', value: <MonoValue value={w.url} className="justify-end" /> },
              { label: 'Owner', value: owner ? <button type="button" className="hover:text-accent-ink" onClick={() => navigate(`/admin/resellers/${owner.id}?tab=api`)}>{owner.name}</button> : 'Internal · all orders' },
              { label: 'Created', value: date(w.createdAt) },
              { label: 'Signing', value: 'HMAC-SHA256' },
              { label: 'Timeout · retries', value: '10s · 8 attempts' },
            ]}
          />
        </div>
        <div className="space-y-4">
          <div>
            <h4 className="mb-2 text-[13px] font-semibold">Subscribed events</h4>
            <div className="flex flex-wrap gap-1.5">
              {w.events.map((e) => (
                <EventChip key={e} event={e} />
              ))}
            </div>
          </div>
          <div>
            <h4 className="mb-2 text-[13px] font-semibold">Signing secret</h4>
            <SecretField masked={w.secretMasked} label="The signing secret" />
            <p className="mt-1.5 text-[12px] text-fg-3">Shown once at creation. Verify the Webhook-Signature header with it.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-2/50 p-3">
            <Button size="sm" variant="primary" leading={<Send />} loading={test.isPending} onClick={() => test.mutate()} disabled={w.status === 'disabled'}>
              Send test event
            </Button>
            <span className="text-[12px] text-fg-3">
              {w.status === 'disabled' ? (
                'Enable the endpoint to send events.'
              ) : lastTest ? (
                <span className="inline-flex items-center gap-2">
                  <StatusCode status={lastTest.responseCode} /> <span className="font-mono tabular">{ms(lastTest.latencyMs)}</span> · {relative(lastTest.at)}
                </span>
              ) : (
                <>
                  Sends a signed <code className="font-mono">order.completed</code> sample (iPhone unlock result)
                </>
              )}
            </span>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-[13px] font-semibold">Delivery history</h4>
          <Segmented<DFilter>
            value={filter}
            onChange={(v) => {
              setFilter(v)
              setPage(1)
            }}
            size="xs"
            items={[
              { value: 'all', label: 'All' },
              { value: 'delivered', label: 'Delivered' },
              { value: 'retrying', label: 'Retrying' },
              { value: 'failed', label: 'Failed' },
            ]}
          />
        </div>
        <div className="overflow-hidden rounded-xl border border-line">
          {deliveries.isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-8" />
              ))}
            </div>
          ) : !deliveries.data?.items.length ? (
            <EmptyState compact icon={<Webhook />} title={filter === 'all' ? 'No deliveries yet' : `No ${filter} deliveries`} description={filter === 'all' ? 'Send a test event to check the endpoint.' : 'Nice — nothing to look at here.'} />
          ) : (
            <>
              <div className="hidden grid-cols-[96px_minmax(0,1fr)_64px_64px_70px_88px_16px] gap-3 border-b border-line bg-surface-2/40 px-3.5 py-2 text-[11px] font-medium text-fg-3 md:grid">
                <span>Status</span>
                <span>Event</span>
                <span>Code</span>
                <span className="text-right">Latency</span>
                <span className="text-right">Attempt</span>
                <span className="text-right">Time</span>
                <span />
              </div>
              <ul className="divide-y divide-line">
                {deliveries.data.items.map((d) => (
                  <li key={d.id}>
                    <button type="button" onClick={() => onOpenDelivery(d)} className="group grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-2/70 md:grid-cols-[96px_minmax(0,1fr)_64px_64px_70px_88px_16px]">
                      <span>
                        <StatusBadge status={d.status} />
                      </span>
                      <span className="min-w-0 max-md:col-span-1 max-md:row-start-2">
                        <EventChip event={d.event} />
                        {d.orderId && <span className="ml-2 font-mono text-[11px] text-fg-3">{d.orderId}</span>}
                      </span>
                      <StatusCode status={d.responseCode} className="max-md:hidden" />
                      <span className={cn('text-right font-mono text-[12px] tabular max-md:hidden', d.latencyMs >= 10000 ? 'text-danger' : d.latencyMs > 1000 ? 'text-accent-ink' : 'text-fg-2')}>{d.latencyMs >= 10000 ? 'timeout' : ms(d.latencyMs)}</span>
                      <span className="text-right font-mono text-[12px] text-fg-2 tabular max-md:hidden">
                        {d.attempt}/{d.maxAttempts}
                      </span>
                      <span className="text-right text-[12px] text-fg-3 tabular max-md:row-start-1 max-md:col-start-2" title={dateTime(d.at)}>
                        {d.nextRetryAt && d.status === 'retrying' ? (
                          <span className="inline-flex items-center gap-1 text-warning">
                            <Clock className="size-3" />
                            {relative(d.nextRetryAt)}
                          </span>
                        ) : (
                          time(d.at, true)
                        )}
                      </span>
                      <ChevronRight className="size-3.5 text-fg-3 opacity-0 transition-opacity group-hover:opacity-100 max-md:hidden" />
                    </button>
                  </li>
                ))}
              </ul>
              <Pagination page={page} pageSize={12} total={deliveries.data.total} onPage={setPage} className="px-3.5" />
            </>
          )}
        </div>
      </section>
    </div>
  )
}

function DeliveryDetail({ endpoint: w, delivery: d, onBack, onReplayed }: { endpoint: WebhookEndpoint; delivery: WebhookDelivery; onBack: () => void; onReplayed: (d: WebhookDelivery) => void }) {
  const replay = useInstMutation((id: string) => developerService.replayDelivery(id), {
    onSuccess: (r) => {
      if (r.status === 'delivered') toast.success('Delivery replayed', `${r.responseCode} OK · ${ms(r.latencyMs)}`)
      else toast.error('Replay failed', `Endpoint responded ${r.responseCode}`)
      onReplayed(r)
    },
  })

  const u = new URL(w.url)
  const t = Math.floor(new Date(d.at).getTime() / 1000)
  const headers = `POST ${u.pathname} HTTP/1.1
Host: ${u.host}
Content-Type: application/json
User-Agent: Webhook-Dispatcher/2.4.1
Webhook-Event: ${d.event}
Webhook-Delivery: ${d.id}
Webhook-Attempt: ${d.attempt}
Webhook-Signature: t=${t},v1=${fakeSig(d.id)}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button size="sm" variant="ghost" leading={<ArrowLeft />} onClick={onBack} className="-ml-2">
          Delivery history
        </Button>
        <Button size="sm" variant="primary" leading={<RotateCw />} loading={replay.isPending} onClick={() => replay.mutate(d.id)} disabled={w.status === 'disabled'}>
          Replay
        </Button>
      </div>

      <div className="rounded-xl border border-line p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <StatusBadge status={d.status} size="md" />
          <EventChip event={d.event} />
          <span className="font-mono text-[12px] text-fg-3">{d.id}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <div>
            <div className="mono-label">Response</div>
            <div className="mt-1.5">
              <StatusCode status={d.responseCode} phrase />
            </div>
          </div>
          <div>
            <div className="mono-label">Latency</div>
            <div className={cn('mt-1.5 font-mono text-[13px] tabular', d.latencyMs >= 10000 ? 'text-danger' : 'text-fg')}>{d.latencyMs >= 10000 ? 'Timed out' : ms(d.latencyMs)}</div>
          </div>
          <div>
            <div className="mono-label">Attempt</div>
            <div className="mt-1.5 font-mono text-[13px] text-fg tabular">
              {d.attempt} of {d.maxAttempts}
            </div>
          </div>
          <div>
            <div className="mono-label">{d.nextRetryAt && d.status === 'retrying' ? 'Next retry' : 'Sent'}</div>
            <div className="mt-1.5 text-[13px] text-fg">{d.nextRetryAt && d.status === 'retrying' ? relative(d.nextRetryAt) : dateTime(d.at)}</div>
          </div>
        </div>
      </div>

      <CodeBlock title="Request headers" lang="http" code={headers} />
      <CodeBlock title="Request body" lang="json" code={prettyJson(d.requestBody)} maxHeight={320} lineNumbers />
      <CodeBlock title={`Response body · ${d.responseCode ?? 'no response'}`} lang={d.responseBody.trim().startsWith('{') ? 'json' : 'text'} code={prettyJson(d.responseBody)} maxHeight={180} />
    </div>
  )
}
