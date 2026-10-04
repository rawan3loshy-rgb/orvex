import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { LifeBuoy, Lock } from 'lucide-react'
import { Button, Field, Input, Modal, Segmented, Select, Textarea } from '@/components/ui'
import { useVendorInstallations, useVendorMutation } from '@/hooks/vendor'
import { supportService } from '@/services/vendor'
import { toast } from '@/stores/toast'
import type { SupportTicket } from '@/types/vendor'
import { categoryLabel, TICKET_CATEGORIES } from './kitUtils'

export interface TicketDefaults {
  subject?: string
  category?: SupportTicket['category']
  priority?: SupportTicket['priority']
  installationId?: string | null
  body?: string
}

const PRIORITIES: { value: SupportTicket['priority']; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const PRIORITY_HINT: Record<SupportTicket['priority'], string> = {
  low: 'Questions and requests without time pressure.',
  normal: 'Something isn’t working as expected, with a workaround available.',
  high: 'A production feature is impaired and affecting your business.',
  urgent: 'Production is down or orders cannot be processed.',
}

const init = (d?: TicketDefaults) => ({
  subject: d?.subject ?? '',
  category: d?.category ?? ('General' as SupportTicket['category']),
  priority: d?.priority ?? ('normal' as SupportTicket['priority']),
  installationId: d?.installationId ?? '',
  body: d?.body ?? '',
})

/**
 * Opens a ticket with ORVEX Systems support (vendor API). Used from Support,
 * Subscription (add-ons, sales), License (domain changes) and Overview.
 */
export function NewTicketModal({
  open,
  onClose,
  defaults,
  title = 'New support ticket',
  description = 'Reaches the ORVEX Systems support team. Priority support replies within 4 business hours.',
  submitLabel = 'Create ticket',
  stay = false,
  icon = <LifeBuoy />,
  successMessage,
}: {
  open: boolean
  onClose: () => void
  defaults?: TicketDefaults
  title?: ReactNode
  description?: ReactNode
  submitLabel?: string
  /** Stay on the current page after creating (default: open the new ticket). */
  stay?: boolean
  icon?: ReactNode
  successMessage?: string
}) {
  const navigate = useNavigate()
  const installs = useVendorInstallations()
  const [form, setForm] = useState(() => init(defaults))
  const [touched, setTouched] = useState(false)

  // Reset whenever the modal opens with (possibly new) defaults (adjusted during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setForm(init(defaults))
      setTouched(false)
    }
  }

  const create = useVendorMutation(supportService.create, {
    onSuccess: (t) => {
      toast.success(`Ticket ${t.id} created`, successMessage ?? 'You’ll get an email when support replies.')
      onClose()
      if (!stay) navigate(`/account/support/${t.id}`)
    },
  })

  const subjectError = touched && form.subject.trim().length < 4 ? 'Add a short subject (at least 4 characters).' : undefined
  const bodyError = touched && form.body.trim().length < 10 ? 'Describe the request in a sentence or two.' : undefined

  const submit = () => {
    setTouched(true)
    if (form.subject.trim().length < 4 || form.body.trim().length < 10) return
    create.mutate({
      subject: form.subject.trim(),
      body: form.body.trim(),
      category: form.category,
      priority: form.priority,
      installationId: form.installationId || null,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={icon}
      title={title}
      description={description}
      footer={
        <>
          <span className="mr-auto hidden text-[12px] text-fg-3 sm:block">Professional · Priority support</span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={submit} loading={create.isPending}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Field label="Subject" error={subjectError}>
          <Input autoFocus value={form.subject} invalid={!!subjectError} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. NCK code orders stuck in processing after update" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as SupportTicket['category'] })} options={TICKET_CATEGORIES.map((c) => ({ value: c, label: categoryLabel(c) }))} />
          </Field>
          <Field label="Installation" optional>
            <Select
              value={form.installationId ?? ''}
              onChange={(e) => setForm({ ...form, installationId: e.target.value })}
              options={[{ value: '', label: 'Not installation-specific' }, ...(installs.data ?? []).map((i) => ({ value: i.id, label: `${i.name} — ${i.domain}` }))]}
            />
          </Field>
        </div>
        <Field label="Priority" hint={PRIORITY_HINT[form.priority]}>
          <Segmented size="sm" value={form.priority} onChange={(v) => setForm({ ...form, priority: v })} items={PRIORITIES} className="w-full [&>button]:flex-1 [&>button]:justify-center" />
        </Field>
        <Field label="Message" error={bodyError}>
          <Textarea
            rows={6}
            value={form.body}
            invalid={!!bodyError}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder="What happened, what did you expect, and when did it start? Include the Core version, the supplier and driver involved, the service code (e.g. 4040) and order references (ORD-…) or request IDs if you have them."
          />
        </Field>
        <div className="flex items-start gap-2.5 rounded-lg border border-line bg-surface-2/60 px-3 py-2.5 text-[12px] text-fg-3">
          <Lock className="mt-px size-3.5 shrink-0" />
          <p>Never include passwords, API keys, supplier credentials or your customers’ data (full IMEIs, serials, phone numbers). Order and request IDs are enough. ORVEX staff will never ask for credentials to your installation’s admin.</p>
        </div>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  )
}
