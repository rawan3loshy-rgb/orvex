import { useEffect, useState } from 'react'
import { Layers } from 'lucide-react'
import { useInstMutation } from '@/hooks/installation'
import { pricingService } from '@/services/installation'
import type { PricingGroup } from '@/types/installation'
import { Button, Field, Input, Modal, Textarea } from '@/components/ui'

/** Create a pricing group, or edit the name/description of an existing one. */
export function GroupModal({ open, onClose, group, onSaved }: { open: boolean; onClose: () => void; group?: PricingGroup | null; onSaved?: (g: PricingGroup) => void }) {
  const editing = !!group
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [discount, setDiscount] = useState('5')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(group?.name ?? '')
    setDescription(group?.description ?? '')
    setDiscount(String(group?.discountPercent ?? 5))
    setSubmitted(false)
  }, [open, group])

  const d = Number(discount)
  const errors = {
    name: !name.trim() ? 'Name is required' : undefined,
    discount: discount === '' || Number.isNaN(d) || d < 0 || d > 90 ? 'Between 0% and 90%' : undefined,
  }

  const create = useInstMutation((body: Partial<PricingGroup>) => pricingService.createGroup(body), {
    success: (g) => `Created group “${g.name}”`,
    onSuccess: (g) => {
      onSaved?.(g)
      onClose()
    },
  })
  const update = useInstMutation((body: Partial<PricingGroup>) => pricingService.updateGroup(group!.id, body), {
    success: 'Group updated',
    onSuccess: (g) => {
      onSaved?.(g)
      onClose()
    },
  })

  const submit = () => {
    setSubmitted(true)
    if (errors.name || errors.discount) return
    if (editing) update.mutate({ name: name.trim(), description: description.trim() })
    else create.mutate({ name: name.trim(), description: description.trim(), discountPercent: d })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<Layers />}
      title={editing ? `Edit ${group?.name}` : 'New pricing group'}
      description={editing ? 'Rename the group or update its description.' : 'Add a tier next to your existing groups. Start with a discount off public prices, then add per-service contract prices from the price table.'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={submit} loading={create.isPending || update.isPending}>
            {editing ? 'Save changes' : 'Create group'}
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
        <Field label="Name" error={submitted ? errors.name : undefined}>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wholesale" invalid={submitted && !!errors.name} />
        </Field>
        <Field label="Description" optional>
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Wholesale markets placing 5,000+ IMEI checks a month" />
        </Field>
        {!editing && (
          <Field label="Discount off public price" error={submitted ? errors.discount : undefined} hint="You can fine-tune it later with the discount slider.">
            <Input type="number" min={0} max={90} step="0.5" value={discount} onChange={(e) => setDiscount(e.target.value)} trailing={<span className="text-[12px]">%</span>} invalid={submitted && !!errors.discount} />
          </Field>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}
