import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { UserPlus } from 'lucide-react'
import { formatMoney, parseMoney, ZERO } from '@/core/money'
import type { AccountTier } from '@/types/installation'
import { accountsService } from '@/services/installation'
import { useInstMutation, usePricing } from '@/hooks/installation'
import { Guarded, PermissionHint } from '@/components/domain'
import { Button, Field, Input, Modal, Select } from '@/components/ui'
import { cn } from '@/lib/cn'
import { COUNTRIES, TIER_META } from './helpers'

const TIERS: AccountTier[] = ['retail', 'reseller', 'business', 'api_only']
const DEFAULT_PRICING: Record<AccountTier, string> = { retail: 'tier_retail', reseller: 'tier_silver', business: 'tier_silver', api_only: 'tier_silver' }

const EMPTY = { name: '', email: '', contactName: '', country: 'AE', tier: 'reseller' as AccountTier, pricingTierId: '', credit: '0' }

export function CreateAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const pricing = usePricing()
  const tiers = useMemo(() => [...(pricing.data?.tiers ?? [])].sort((a, b) => a.sort - b.sort), [pricing.data])
  const [form, setForm] = useState(EMPTY)
  const [submitted, setSubmitted] = useState(false)

  // Start clean every time the modal opens (adjusted during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setForm(EMPTY)
      setSubmitted(false)
    }
  }

  const pricingTierId = form.pricingTierId || (tiers.find((t) => t.id === DEFAULT_PRICING[form.tier])?.id ?? tiers.find((t) => t.isDefault)?.id ?? '')
  const credit = parseMoney(form.credit || '0')
  const errors = {
    name: form.name.trim().length < 2 ? 'Enter the account name' : undefined,
    email: !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email) ? 'Enter a valid email' : undefined,
    contactName: !form.contactName.trim() ? 'Who is the main contact?' : undefined,
    credit: credit == null ? 'Enter an amount like 250 or 250.00' : credit < 0 ? 'Credit limit cannot be negative' : undefined,
    pricing: !pricingTierId ? 'Pick a pricing tier' : undefined,
  }
  const valid = !Object.values(errors).some(Boolean)

  const create = useInstMutation(accountsService.create, {
    success: (row) => `${row.account.name} created · ${row.account.number}`,
    onSuccess: (row) => {
      onClose()
      navigate(`/admin/accounts/${row.account.id}`)
    },
  })

  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const err = (k: keyof typeof errors) => (submitted ? errors[k] : undefined)

  const submit = () => {
    setSubmitted(true)
    if (!valid) return
    create.mutate({ name: form.name.trim(), email: form.email.trim(), contactName: form.contactName.trim(), country: form.country, tier: form.tier, pricingTierId, creditLimit: credit ?? ZERO })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={<UserPlus />}
      title="Create account"
      description="Every buyer — retail customer, reseller, business or API-only integration — is the same Account: one ledger-backed wallet, one order model, one idempotency scope."
      footer={
        <>
          <PermissionHint permission="accounts.manage" className="mr-auto" />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Guarded permission="accounts.manage">
            {(allowed) => (
              <Button variant="accent" onClick={submit} loading={create.isPending} disabled={!allowed}>
                Create account
              </Button>
            )}
          </Guarded>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <div className="mb-2 text-[12.5px] font-medium">Account tier</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TIERS.map((t) => {
              const m = TIER_META[t]
              const Icon = m.icon
              const active = form.tier === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, tier: t, pricingTierId: '' }))}
                  className={cn('rounded-lg border px-3 py-2.5 text-left transition-colors', active ? 'border-accent/60 bg-accent/[0.06]' : 'border-line hover:border-line-strong hover:bg-surface-2')}
                >
                  <div className="flex items-center gap-2 text-[13px] font-medium">
                    <Icon className={cn('size-4', active ? 'text-accent-ink' : 'text-fg-3')} />
                    {m.label}
                  </div>
                  <div className="mt-1 text-[11.5px] leading-snug text-fg-3">{m.blurb}</div>
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-[11.5px] text-fg-3">The tier changes defaults (channels, copy, pricing) — not the data model. You can change it later.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Account name" error={err('name')}>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Nordic Phone Repair AB" invalid={!!err('name')} autoFocus />
          </Field>
          <Field label="Billing email" error={err('email')} hint="Also the DHRU username if DHRU access is enabled.">
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="ops@example.com" invalid={!!err('email')} />
          </Field>
          <Field label="Main contact" error={err('contactName')}>
            <Input value={form.contactName} onChange={(e) => set('contactName', e.target.value)} placeholder="Full name" invalid={!!err('contactName')} />
          </Field>
          <Field label="Country">
            <Select value={form.country} onChange={(e) => set('country', e.target.value)} options={COUNTRIES.map((c) => ({ value: c.value, label: `${c.label} (${c.value})` }))} />
          </Field>
          <Field label="Pricing tier" error={err('pricing')} hint={tiers.find((t) => t.id === pricingTierId)?.description}>
            <Select value={pricingTierId} onChange={(e) => set('pricingTierId', e.target.value)} options={tiers.length ? tiers.map((t) => ({ value: t.id, label: `${t.name}${t.isDefault ? ' (default)' : ''}` })) : [{ value: '', label: pricing.isLoading ? 'Loading tiers…' : 'No tiers' }]} />
          </Field>
          <Field label="Credit limit" error={err('credit')} hint={credit && credit > 0 ? `Available may go down to ${formatMoney((-credit) as typeof credit)} (post-paid).` : 'Prepaid only — orders need available funds.'}>
            <Input value={form.credit} onChange={(e) => set('credit', e.target.value)} leading={<span className="text-[13px]">$</span>} mono inputMode="decimal" invalid={!!err('credit')} />
          </Field>
        </div>

        <div className="rounded-lg border border-line bg-surface-2/50 px-3.5 py-3 text-[12px] leading-relaxed text-fg-3">
          The wallet starts at <span className="font-mono text-fg-2">$0.00</span>. Funds only arrive through audited ledger postings — a payment (DR Gateway Clearing / CR Customer Available) or a manual adjustment with a reason. There is no editable balance field.
        </div>
      </div>
    </Modal>
  )
}
