import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Building, Globe, Mail, UserRound, UserPlus } from 'lucide-react'
import { usePricingGroups, useInstMutation } from '@/hooks/installation'
import { resellersService } from '@/services/installation'
import { Button, Field, Input, Modal, Select } from '@/components/ui'
import { money } from '@/lib/format'
import { COUNTRY_OPTIONS, discountLabel, groupStyle } from './shared'

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const DOMAIN = /^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i

interface FormState {
  name: string
  contactName: string
  email: string
  country: string
  website: string
  pricingGroupId: string
  balance: string
  creditLimit: string
  ratePerMinute: string
}

const INITIAL: FormState = { name: '', contactName: '', email: '', country: 'US', website: '', pricingGroupId: 'grp_standard', balance: '0', creditLimit: '0', ratePerMinute: '120' }

export function CreateResellerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const groups = usePricingGroups()
  const [form, setForm] = useState<FormState>(INITIAL)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(INITIAL)
      setSubmitted(false)
    }
  }, [open])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const errors = useMemo(() => {
    const e: Partial<Record<keyof FormState, string>> = {}
    if (!form.name.trim()) e.name = 'Business name is required'
    if (!form.email.trim()) e.email = 'Email is required'
    else if (!EMAIL.test(form.email.trim())) e.email = 'Enter a valid email address'
    if (form.website && !DOMAIN.test(form.website.trim())) e.website = 'Enter a domain such as gsm-shop.example'
    for (const k of ['balance', 'creditLimit'] as const) {
      const n = Number(form[k])
      if (form[k] === '' || Number.isNaN(n) || n < 0) e[k] = 'Must be 0 or more'
    }
    const rate = Number(form.ratePerMinute)
    if (!Number.isInteger(rate) || rate < 1 || rate > 10000) e.ratePerMinute = 'Between 1 and 10,000'
    return e
  }, [form])

  const create = useInstMutation((body: Parameters<typeof resellersService.create>[0]) => resellersService.create(body), {
    success: (r) => `${r.name} added`,
    onSuccess: (r) => {
      onClose()
      navigate(`/admin/resellers/${r.id}`)
    },
  })

  const submit = () => {
    setSubmitted(true)
    if (Object.keys(errors).length) return
    create.mutate({
      name: form.name.trim(),
      contactName: form.contactName.trim(),
      email: form.email.trim(),
      country: form.country,
      website: form.website.trim().replace(/^https?:\/\//, ''),
      pricingGroupId: form.pricingGroupId,
      balance: Number(form.balance),
      creditLimit: Number(form.creditLimit),
      ratePerMinute: Number(form.ratePerMinute),
    })
  }

  const err = (k: keyof FormState) => (submitted ? errors[k] : undefined)
  const group = groups.data?.find((g) => g.id === form.pricingGroupId)

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={<UserPlus />}
      title="Add reseller"
      description="Onboard a GSM shop, repair chain or distributor. They order IMEI checks, unlocks and codes through the Reseller API from their own prepaid balance."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={submit} loading={create.isPending}>
            Create reseller
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="space-y-6"
      >
        <section>
          <p className="mono-label mb-3">Shop</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name" error={err('name')} className="sm:col-span-2">
              <Input autoFocus value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Unlock Express Repairs" leading={<Building />} invalid={!!err('name')} />
            </Field>
            <Field label="Contact person" optional>
              <Input value={form.contactName} onChange={(e) => set('contactName', e.target.value)} placeholder="Shop owner or API contact" leading={<UserRound />} />
            </Field>
            <Field label="Billing & technical email" error={err('email')}>
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="api@gsm-shop.example" leading={<Mail />} invalid={!!err('email')} />
            </Field>
            <Field label="Country">
              <Select value={form.country} onChange={(e) => set('country', e.target.value)} options={COUNTRY_OPTIONS} />
            </Field>
            <Field label="Website" optional error={err('website')}>
              <Input value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="gsm-shop.example" leading={<Globe />} invalid={!!err('website')} />
            </Field>
          </div>
        </section>

        <section>
          <p className="mono-label mb-3">Commercial terms</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pricing group" hint={group ? group.description : 'Standard, Dealer, Distributor or Contract'} className="sm:col-span-2">
              <div className="flex items-center gap-2">
                <Select
                  className="flex-1"
                  value={form.pricingGroupId}
                  onChange={(e) => set('pricingGroupId', e.target.value)}
                  options={(groups.data ?? []).map((g) => ({ value: g.id, label: `${g.name} · ${discountLabel(g.discountPercent)}` }))}
                />
                {group && (
                  <span className="hidden h-9 items-center rounded-lg px-3 text-[12px] font-medium sm:inline-flex" style={groupStyle(group.color)}>
                    {group.overrides.length ? `${group.overrides.length} contract prices` : discountLabel(group.discountPercent)}
                  </span>
                )}
              </div>
            </Field>
            <Field label="Opening balance" error={err('balance')} hint={!err('balance') && Number(form.balance) > 0 ? `${money(Number(form.balance))} available for orders immediately` : 'Prepaid funds — recorded as an opening top-up'}>
              <Input type="number" min={0} step="0.01" value={form.balance} onChange={(e) => set('balance', e.target.value)} leading={<span className="text-[13px]">$</span>} invalid={!!err('balance')} className="tabular" />
            </Field>
            <Field label="Credit limit" error={err('creditLimit')} hint="Balance may go negative up to this amount">
              <Input type="number" min={0} step="50" value={form.creditLimit} onChange={(e) => set('creditLimit', e.target.value)} leading={<span className="text-[13px]">$</span>} invalid={!!err('creditLimit')} />
            </Field>
            <Field label="API rate limit" error={err('ratePerMinute')} hint="Requests per minute across all of the shop's keys — 120/min suits a single counter, distributors usually need 600+" className="sm:col-span-2">
              <Input type="number" min={1} value={form.ratePerMinute} onChange={(e) => set('ratePerMinute', e.target.value)} trailing={<span className="text-[12px]">req/min</span>} invalid={!!err('ratePerMinute')} />
            </Field>
          </div>
        </section>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}
