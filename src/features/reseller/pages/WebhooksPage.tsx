import { useState } from 'react'
import { ChevronDown, Pencil, Plus, Power, Send, ShieldAlert, ShieldCheck, Trash2, Webhook } from 'lucide-react'
import { Badge, Button, Card, Checkbox, CodeBlock, ConfirmDialog, EmptyState, Field, Input, Modal, SecretField, Skeleton, StatusBadge } from '@/components/ui'
import { useInstMutation, usePortalWebhooks } from '@/hooks/installation'
import { portalService } from '@/services/installation'
import type { WebhookDelivery, WebhookEndpoint, WebhookEventType } from '@/types/installation'
import { dateTime, ms, relative } from '@/lib/format'
import { cn } from '@/lib/cn'
import { ApiSectionHeader, ErrorCard, NoAccess } from '../kit'
import { usePortalSession } from '../kitUtils'

type Endpoint = WebhookEndpoint & { recent: WebhookDelivery[] }

const EVENTS: { id: WebhookEventType; desc: string }[] = [
  { id: 'order.created', desc: 'An order was placed and funds reserved' },
  { id: 'order.processing', desc: 'Processing started' },
  { id: 'order.completed', desc: 'Result available, funds charged' },
  { id: 'order.rejected', desc: 'Could not be completed, funds released' },
  { id: 'order.cancelled', desc: 'Cancelled before processing' },
  { id: 'order.refunded', desc: 'A refund was issued to your wallet' },
  { id: 'account.balance_low', desc: 'Balance fell below your alert level' },
]

export default function WebhooksPage() {
  const { me, can, role } = usePortalSession()
  const hooks = usePortalWebhooks()
  const [create, setCreate] = useState(false)
  const [edit, setEdit] = useState<Endpoint | null>(null)
  const [del, setDel] = useState<Endpoint | null>(null)
  const remove = useInstMutation((id: string) => portalService.deleteWebhook(id), { success: 'Endpoint deleted', onSuccess: () => setDel(null) })

  const header = (
    <ApiSectionHeader
      title="Webhooks"
      description={
        <>
          Get notified when your orders change. Deliveries are signed with{' '}
          <a href="https://www.standardwebhooks.com" target="_blank" rel="noreferrer" className="text-accent-ink hover:underline">
            Standard Webhooks
          </a>{' '}
          headers and retried with backoff.
        </>
      }
      actions={
        can.api && (
          <Button variant="accent" leading={<Plus />} onClick={() => setCreate(true)}>
            Add endpoint
          </Button>
        )
      }
    />
  )
  if (me && !can.api)
    return (
      <div>
        {header}
        <NoAccess need="api" role={role} />
      </div>
    )

  return (
    <div>
      {header}
      {hooks.error ? (
        <ErrorCard error={hooks.error} onRetry={() => hooks.refetch()} />
      ) : hooks.isLoading ? (
        <Skeleton className="h-[200px] rounded-xl" />
      ) : !hooks.data?.length ? (
        <Card>
          <EmptyState icon={<Webhook />} title="No endpoints yet" description="Add an HTTPS endpoint to receive order updates in real time." action={<Button size="sm" variant="accent" onClick={() => setCreate(true)}>Add endpoint</Button>} />
        </Card>
      ) : (
        <div className="space-y-4">
          {hooks.data.map((w) => (
            <EndpointCard key={w.id} w={w} onEdit={() => setEdit(w)} onDelete={() => setDel(w)} />
          ))}
        </div>
      )}

      <Card className="mt-4">
        <div className="grid gap-4 p-5 lg:grid-cols-2">
          <div>
            <h3 className="text-[14px] font-semibold">Verifying signatures</h3>
            <p className="mt-1 text-[12.5px] text-fg-3">
              Sign <code className="font-mono">{'{webhook-id}.{webhook-timestamp}.{body}'}</code> with HMAC-SHA256 using your endpoint secret and compare it to the <code className="font-mono">v1,</code> value in <code className="font-mono">webhook-signature</code>. Use <code className="font-mono">webhook-id</code> to ignore duplicates — it stays the same across retries.
            </p>
          </div>
          <CodeBlock
            lang="http"
            code={`POST /orvex/webhook HTTP/1.1
webhook-id: msg_2Kf8Q1x…
webhook-timestamp: 1791100800
webhook-signature: v1,K5oZfzN95Z9UVu1Eso…
content-type: application/json`}
          />
        </div>
      </Card>

      <EndpointModal open={create} onClose={() => setCreate(false)} />
      <EndpointModal open={!!edit} endpoint={edit ?? undefined} onClose={() => setEdit(null)} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => del && remove.mutate(del.id)} loading={remove.isPending} tone="danger" title="Delete endpoint?" description={`${del?.url ?? ''} will stop receiving events. Pending retries are dropped.`} confirmLabel="Delete" />
    </div>
  )
}

function EndpointCard({ w, onEdit, onDelete }: { w: Endpoint; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const toggle = useInstMutation(() => portalService.updateWebhook(w.id, { status: w.status === 'disabled' ? 'active' : 'disabled' }), { success: w.status === 'disabled' ? 'Endpoint enabled' : 'Endpoint disabled' })
  const test = useInstMutation(() => portalService.testWebhook(w.id), { success: (d) => (d ? `Test event sent · ${d.status}` : 'Test event queued'), onSuccess: () => setOpen(true) })
  return (
    <Card>
      <div className="flex flex-col gap-3 p-4 sm:p-5 md:flex-row md:items-start">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-fg-2">
          <Webhook className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 truncate font-mono text-[13px] font-medium">{w.url}</span>
            <StatusBadge status={w.status} />
          </div>
          {w.description && <p className="mt-0.5 text-[12.5px] text-fg-3">{w.description}</p>}
          <div className="mt-2 flex flex-wrap gap-1">
            {w.events.map((e) => (
              <span key={e} className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] text-fg-2 ring-1 ring-line">
                {e}
              </span>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 text-[12px] text-fg-3">
            <span>Secret <span className="font-mono">{w.secretMasked}</span></span>
            <span>Added {dateTime(w.createdAt)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 md:justify-end">
          <Button size="sm" leading={<Send />} loading={test.isPending} disabled={w.status === 'disabled'} onClick={() => test.mutate()}>
            Send test
          </Button>
          <Button size="sm" variant="ghost" icon aria-label="Edit events" onClick={onEdit}>
            <Pencil />
          </Button>
          <Button size="sm" variant="ghost" icon aria-label={w.status === 'disabled' ? 'Enable' : 'Disable'} loading={toggle.isPending} onClick={() => toggle.mutate()}>
            <Power />
          </Button>
          <Button size="sm" variant="ghost" icon aria-label="Delete" className="text-danger hover:bg-danger/10 hover:text-danger" onClick={onDelete}>
            <Trash2 />
          </Button>
        </div>
      </div>
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between border-t border-line px-5 py-2.5 text-[12.5px] font-medium text-fg-2 hover:bg-surface-2/60">
        Recent deliveries ({w.recent.length})
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <Deliveries list={w.recent} />}
    </Card>
  )
}

function Deliveries({ list }: { list: WebhookDelivery[] }) {
  const [sel, setSel] = useState<string | null>(null)
  if (!list.length) return <EmptyState compact title="No deliveries yet" description="Send a test event to see one here." />
  return (
    <ul className="divide-y divide-line border-t border-line">
      {list.map((d) => {
        const last = d.attempts[d.attempts.length - 1]
        const expanded = sel === d.id
        return (
          <li key={d.id}>
            <button type="button" onClick={() => setSel(expanded ? null : d.id)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-left hover:bg-surface-2/50">
              <span className="font-mono text-[12px] font-medium">{d.event}</span>
              <StatusBadge status={d.status} />
              {last && <Badge tone={last.httpStatus && last.httpStatus < 300 ? 'success' : 'danger'} variant="outline">{last.httpStatus ?? 'no response'}</Badge>}
              <span className="ml-auto text-[11.5px] text-fg-3">
                {d.attempts.length > 1 && `${d.attempts.length} attempts · `}
                {last ? ms(last.latencyMs) : ''} · {relative(d.createdAt)}
              </span>
            </button>
            {expanded && (
              <div className="space-y-3 bg-surface-2/40 px-5 py-3">
                <CodeBlock lang="http" title="Headers" code={Object.entries(d.headers).map(([k, v]) => `${k}: ${v}`).join('\n')} wrap />
                <CodeBlock lang="json" title="Payload" code={d.payload} maxHeight={220} />
                {d.attempts.some((a) => a.error) && (
                  <ul className="space-y-1 text-[12px] text-fg-3">
                    {d.attempts.map((a) => (
                      <li key={a.n}>
                        #{a.n} · {dateTime(a.at)} · {a.httpStatus ?? '—'} {a.error && <span className="text-danger">· {a.error}</span>}
                      </li>
                    ))}
                  </ul>
                )}
                {d.nextRetryAt && <p className="text-[12px] text-warning">Next retry {relative(d.nextRetryAt)}</p>}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function EndpointModal({ open, onClose, endpoint }: { open: boolean; onClose: () => void; endpoint?: Endpoint }) {
  return (
    <Modal open={open} onClose={onClose} icon={<Webhook />} title={endpoint ? 'Edit endpoint' : 'Add endpoint'} size="md" description={endpoint ? endpoint.url : 'We’ll POST signed JSON to this URL for the events you choose.'}>
      {open && <EndpointForm key={endpoint?.id ?? 'new'} endpoint={endpoint} onClose={onClose} />}
    </Modal>
  )
}

function EndpointForm({ endpoint, onClose }: { endpoint?: Endpoint; onClose: () => void }) {
  const [url, setUrl] = useState(endpoint?.url ?? 'https://')
  const [description, setDescription] = useState(endpoint?.description ?? '')
  const [events, setEvents] = useState<WebhookEventType[]>(endpoint?.events ?? ['order.completed', 'order.rejected'])
  const [secret, setSecret] = useState<string | null>(null)
  const create = useInstMutation(portalService.createWebhook, { success: 'Endpoint added', onSuccess: (r) => setSecret(r.secret) })
  const update = useInstMutation((patch: Partial<WebhookEndpoint>) => portalService.updateWebhook(endpoint!.id, patch), { success: 'Endpoint updated', onSuccess: onClose })
  const validUrl = /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(url)

  if (secret)
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-[13px] font-medium">
          <ShieldCheck className="size-4 text-success" /> Signing secret — shown once
        </div>
        <SecretField masked={`whsec_${'•'.repeat(24)}`} value={secret} revealable label="Signing secret" />
        <div className="flex gap-2 rounded-lg border border-warning/35 bg-warning/[0.07] px-3 py-2.5 text-[12.5px] text-fg-2">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          Store it in your server’s configuration. We only keep it to sign deliveries and never show it again.
        </div>
        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    )

  return (
    <div className="space-y-4">
      {!endpoint && (
        <>
          <Field label="Endpoint URL" error={url.length > 8 && !validUrl ? 'Must be a valid https:// URL' : undefined} htmlFor="wh_url">
            <Input id="wh_url" mono value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://pos.example.com/webhooks/unlockdesk" />
          </Field>
          <Field label="Description" optional htmlFor="wh_desc">
            <Input id="wh_desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. POS system" />
          </Field>
        </>
      )}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12.5px] font-medium">Events</span>
          <button type="button" className="text-[12px] text-accent-ink hover:underline" onClick={() => setEvents(events.length === EVENTS.length ? [] : EVENTS.map((e) => e.id))}>
            {events.length === EVENTS.length ? 'Clear all' : 'Select all'}
          </button>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {EVENTS.map((e) => (
            <Checkbox key={e.id} checked={events.includes(e.id)} onChange={(v) => setEvents((x) => (v ? [...x, e.id] : x.filter((y) => y !== e.id)))} label={<span className="font-mono text-[12px]">{e.id}</span>} description={e.desc} />
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        {endpoint ? (
          <Button variant="primary" loading={update.isPending} disabled={!events.length} onClick={() => update.mutate({ events })}>
            Save events
          </Button>
        ) : (
          <Button variant="accent" loading={create.isPending} disabled={!validUrl || !events.length} onClick={() => create.mutate({ url, description, events })}>
            Add endpoint
          </Button>
        )}
      </div>
    </div>
  )
}
