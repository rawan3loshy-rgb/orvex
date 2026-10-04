import { useMemo, useState } from 'react'
import { CircleCheck, ShieldAlert, Webhook } from 'lucide-react'
import { useAccounts, useInstMutation } from '@/hooks/installation'
import { developerService, type WebhookEndpointRow } from '@/services/installation'
import type { WebhookEndpoint, WebhookEventType } from '@/types/installation'
import { Button, Checkbox, CopyButton, Field, Input, Modal, Select } from '@/components/ui'
import { PermissionHint } from '@/components/domain'
import { cn } from '@/lib/cn'
import { WEBHOOK_EVENTS } from '../helpers'

const OPERATOR = '__operator__'

/** Create (owner + url + events) or edit (description + events) an endpoint. */
export function EndpointModal({ open, onClose, endpoint }: { open: boolean; onClose: () => void; endpoint?: WebhookEndpointRow | null }) {
  const editing = !!endpoint
  const accounts = useAccounts({ kind: 'customer', pageSize: 200 })
  const eligible = useMemo(() => (accounts.data?.items ?? []).filter((r) => r.account.channels.api || r.account.channels.dhru), [accounts.data])
  const [owner, setOwner] = useState(OPERATOR)
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [events, setEvents] = useState<WebhookEventType[]>(['order.completed', 'order.rejected'])
  const [created, setCreated] = useState<{ endpoint: WebhookEndpoint; secret: string } | null>(null)

  // Seed the form each time the modal opens or the endpoint changes (adjusted during render, not in an effect).
  const [seededFor, setSeededFor] = useState<{ open: boolean; endpoint: typeof endpoint } | null>(null)
  if (!seededFor || seededFor.open !== open || seededFor.endpoint !== endpoint) {
    setSeededFor({ open, endpoint })
    if (open) {
      setCreated(null)
      if (endpoint) {
        setOwner(endpoint.accountId ?? OPERATOR)
        setUrl(endpoint.url)
        setDescription(endpoint.description)
        setEvents(endpoint.events)
      } else {
        setOwner(OPERATOR)
        setUrl('https://')
        setDescription('')
        setEvents(['order.completed', 'order.rejected', 'order.needs_review'])
      }
    }
  }

  const isOperator = owner === OPERATOR
  const effectiveEvents = isOperator ? events : events.filter((e) => e !== 'order.needs_review')
  const urlOk = /^https:\/\/[^\s]+\.[^\s]+$/.test(url)
  const valid = (editing || urlOk) && effectiveEvents.length > 0

  const create = useInstMutation(developerService.createWebhook, { success: 'Endpoint created', onSuccess: (r) => setCreated(r) })
  const update = useInstMutation((v: { id: string; patch: Partial<WebhookEndpoint> }) => developerService.updateWebhook(v.id, v.patch), { success: 'Endpoint updated', onSuccess: () => onClose() })

  const submit = () => {
    if (!valid) return
    if (endpoint) update.mutate({ id: endpoint.id, patch: { description, events: effectiveEvents } })
    else create.mutate({ accountId: isOperator ? null : owner, url: url.trim(), description: description.trim(), events: effectiveEvents })
  }

  if (created) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        icon={<CircleCheck className="text-success" />}
        title="Endpoint created — copy the signing secret"
        description={created.endpoint.url}
        footer={
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2.5">
            <code className="min-w-0 flex-1 font-mono text-[13px] break-all text-fg select-all">{created.secret}</code>
            <CopyButton value={created.secret} label="Copy secret" className="size-7" />
          </div>
          <div className="flex gap-2.5 rounded-xl border border-warning/25 bg-warning/[0.05] p-3 text-[12.5px] text-fg-2">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            <p>
              The receiver verifies <code className="font-mono">webhook-signature</code> = <code className="font-mono">v1,base64(HMAC-SHA256(secret, id.timestamp.body))</code>. The secret is shown once and stored encrypted.
            </p>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={<Webhook />}
      title={editing ? 'Edit endpoint' : 'Add webhook endpoint'}
      description={editing ? endpoint?.url : 'Deliveries are signed with Standard Webhooks headers (webhook-id, webhook-timestamp, webhook-signature).'}
      footer={
        <>
          <PermissionHint permission="developer.manage" className="mr-auto" />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" disabled={!valid} loading={create.isPending || update.isPending} onClick={submit}>
            {editing ? 'Save changes' : 'Create endpoint'}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Owner" hint={isOperator ? 'Installation-level endpoint: receives events for every account.' : 'Receives events for this account’s orders only.'}>
          <Select
            value={owner}
            disabled={editing}
            onChange={(e) => setOwner(e.target.value)}
            options={[{ value: OPERATOR, label: 'Installation (operator)' }, ...eligible.map((r) => ({ value: r.account.id, label: r.account.name }))]}
          />
        </Field>
        <Field label="Description" optional>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ops alerting" />
        </Field>
        <Field label="Endpoint URL" className="sm:col-span-2" error={!editing && url.length > 8 && !urlOk ? 'Must be an https:// URL' : undefined}>
          <Input mono value={url} disabled={editing} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/orvex/webhook" />
        </Field>
        <div className="sm:col-span-2">
          <div className="mb-2 text-[12.5px] font-medium text-fg">Events</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {WEBHOOK_EVENTS.map((ev) => {
              const blocked = ev.operatorOnly && !isOperator
              const on = effectiveEvents.includes(ev.id)
              return (
                <label key={ev.id} className={cn('flex gap-2.5 rounded-xl border p-3 transition-colors', blocked ? 'cursor-not-allowed border-line opacity-55' : 'cursor-pointer', on ? 'border-accent/35 bg-accent/[0.04]' : 'border-line hover:border-line-strong')}>
                  <Checkbox checked={on} disabled={blocked} onChange={(v) => setEvents((cur) => (v ? [...cur, ev.id] : cur.filter((x) => x !== ev.id)))} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <code className="font-mono text-[12px] text-fg">{ev.id}</code>
                      {ev.operatorOnly && <span className="rounded bg-warning/10 px-1 font-mono text-[10px] text-warning">operator only</span>}
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-fg-3">{ev.description}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}
