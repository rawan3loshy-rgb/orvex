import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, CircleCheck, Copy, Link2, ShieldAlert, Webhook } from 'lucide-react'
import { useInstMutation, useResellers } from '@/hooks/installation'
import { developerService } from '@/services/installation'
import type { WebhookEndpoint, WebhookEventType } from '@/types/installation'
import { Button, Checkbox, CodeBlock, Field, Input, Modal, Select } from '@/components/ui'
import { cn } from '@/lib/cn'
import { toast } from '@/stores/toast'
import { WEBHOOK_EVENTS } from '../shared'

export function validateWebhookUrl(raw: string): string | undefined {
  const v = raw.trim()
  if (!v) return 'Endpoint URL is required'
  if (!/^https:\/\//i.test(v)) return 'Must use https:// — plain HTTP endpoints are rejected'
  try {
    const u = new URL(v)
    if (!u.hostname.includes('.')) return 'Use a public, fully-qualified hostname'
    if (/^(localhost|127\.|10\.|192\.168\.)/.test(u.hostname)) return 'Private and loopback addresses are not reachable from ORVEX'
  } catch {
    return 'Not a valid URL'
  }
  return undefined
}

const DEFAULT_EVENTS: WebhookEventType[] = ['order.completed', 'order.failed']

export function AddEndpointModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (w: WebhookEndpoint) => void }) {
  const resellers = useResellers()
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [owner, setOwner] = useState('')
  const [events, setEvents] = useState<WebhookEventType[]>(DEFAULT_EVENTS)
  const [submitted, setSubmitted] = useState(false)
  const [created, setCreated] = useState<{ endpoint: WebhookEndpoint; secret: string } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    setUrl('')
    setDescription('')
    setOwner('')
    setEvents(DEFAULT_EVENTS)
    setSubmitted(false)
    setCreated(null)
    setCopied(false)
  }, [open])

  const errors = { url: validateWebhookUrl(url), events: events.length ? undefined : 'Subscribe to at least one event' }

  const create = useInstMutation((body: Partial<WebhookEndpoint>) => developerService.createWebhook(body), {
    success: 'Webhook endpoint added',
    onSuccess: (res) => {
      setCreated(res)
      onCreated?.(res.endpoint)
    },
  })

  const submit = () => {
    setSubmitted(true)
    if (errors.url || errors.events) return
    create.mutate({ url: url.trim(), description: description.trim(), resellerId: owner || null, events })
  }

  const toggle = (e: WebhookEventType, on: boolean) => setEvents((cur) => (on ? WEBHOOK_EVENTS.map((x) => x.id).filter((x) => cur.includes(x) || x === e) : cur.filter((x) => x !== e)))

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={created ? <CircleCheck className="text-success" /> : <Webhook />}
      title={created ? 'Endpoint added' : 'Add webhook endpoint'}
      description={created ? created.endpoint.url : 'ORVEX sends a signed HTTPS POST for each subscribed event — unlock results, codes, check reports, balance alerts — and retries failed deliveries with exponential backoff.'}
      footer={
        created ? (
          <Button variant={copied ? 'primary' : 'secondary'} onClick={onClose}>
            {copied ? 'Done' : 'I have stored the secret'}
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="accent" onClick={submit} loading={create.isPending}>
              Add endpoint
            </Button>
          </>
        )
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {created ? (
          <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="rounded-xl border border-line bg-bg-subtle">
              <div className="border-b border-line px-4 py-2">
                <span className="mono-label">Signing secret</span>
              </div>
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <code className="min-w-0 flex-1 font-mono text-[14.5px] font-medium tracking-wide break-all text-fg select-all">{created.secret}</code>
                <Button
                  variant={copied ? 'secondary' : 'primary'}
                  leading={copied ? <Check className="text-success" /> : <Copy />}
                  onClick={() => {
                    navigator.clipboard?.writeText(created.secret).catch(() => undefined)
                    setCopied(true)
                    toast.success('Signing secret copied')
                  }}
                >
                  {copied ? 'Copied' : 'Copy secret'}
                </Button>
              </div>
            </div>
            <div className="flex gap-3 rounded-xl border border-warning/25 bg-warning/[0.06] p-3.5 text-[13px]">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
              <div>
                <p className="font-medium text-fg">This secret is shown only once.</p>
                <p className="mt-0.5 text-fg-2">Use it to verify the Webhook-Signature header on every delivery, so a forged “unlock completed” callback is rejected. ORVEX stores it encrypted (AES-256-GCM) and only displays it masked afterwards.</p>
              </div>
            </div>
            <CodeBlock
              title="verify.js"
              lang="js"
              code={`const expected = crypto\n  .createHmac('sha256', process.env.WEBHOOK_SECRET)\n  .update(\`\${timestamp}.\${rawBody}\`)\n  .digest('hex')`}
            />
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -6 }}
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <Field label="Endpoint URL" error={submitted ? errors.url : undefined} hint={!submitted || !errors.url ? 'Must respond with a 2xx status within 10 seconds.' : undefined}>
              <Input autoFocus mono value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://panel.your-shop.com/webhooks/orvex" leading={<Link2 />} invalid={submitted && !!errors.url} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Description" optional>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Unlock panel order callbacks" />
              </Field>
              <Field label="Owner" hint={owner ? 'Receives events for this reseller’s orders only' : 'Receives events for all orders (UnlockDesk Ops)'}>
                <Select value={owner} onChange={(e) => setOwner(e.target.value)} options={[{ value: '', label: 'Internal · all orders' }, ...(resellers.data ?? []).filter((r) => r.status === 'active').map((r) => ({ value: r.id, label: r.name }))]} />
              </Field>
            </div>
            <Field
              label="Events"
              error={submitted ? errors.events : undefined}
              action={
                <div className="flex gap-1">
                  <Button type="button" size="xs" variant="ghost" onClick={() => setEvents(WEBHOOK_EVENTS.filter((e) => e.id.startsWith('order.')).map((e) => e.id))}>
                    All order events
                  </Button>
                  <Button type="button" size="xs" variant="ghost" onClick={() => setEvents(WEBHOOK_EVENTS.map((e) => e.id))}>
                    Everything
                  </Button>
                </div>
              }
            >
              <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
                {WEBHOOK_EVENTS.map((e, i) => {
                  const on = events.includes(e.id)
                  const lastOdd = i === WEBHOOK_EVENTS.length - 1 && WEBHOOK_EVENTS.length % 2 === 1
                  return (
                    <div key={e.id} className={cn('bg-surface px-3.5 py-2.5 transition-colors', on ? 'bg-[color-mix(in_oklab,var(--fg)_3%,var(--surface))]' : 'hover:bg-surface-2', lastOdd && 'sm:col-span-2')}>
                      <Checkbox checked={on} onChange={(v) => toggle(e.id, v)} label={<code className="font-mono text-[12px]">{e.id}</code>} description={e.description} />
                    </div>
                  )
                })}
              </div>
            </Field>
            <button type="submit" className="hidden" />
          </motion.form>
        )}
      </AnimatePresence>
    </Modal>
  )
}
