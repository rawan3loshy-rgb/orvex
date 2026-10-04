import { useEffect, useMemo, useState } from 'react'
import { Building, Globe, Mail, UserRound } from 'lucide-react'
import { useInstMutation } from '@/hooks/installation'
import { resellersService } from '@/services/installation'
import type { PricingGroup, Reseller } from '@/types/installation'
import { Button, Card, CardFooter, CardHeader, CardBody, DescriptionList, Field, Input, MonoValue, Select, Textarea } from '@/components/ui'
import { date, dateTime, num, relative } from '@/lib/format'
import { COUNTRY_OPTIONS, GroupChip } from '../shared'

type Form = Pick<Reseller, 'name' | 'contactName' | 'email' | 'country' | 'website' | 'notes'>

const pick = (r: Reseller): Form => ({ name: r.name, contactName: r.contactName, email: r.email, country: r.country, website: r.website, notes: r.notes })
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function ProfileTab({ reseller, group }: { reseller: Reseller; group?: PricingGroup }) {
  const [form, setForm] = useState<Form>(() => pick(reseller))
  // Only reset the form when the stored profile actually changes (not on every refetch).
  const storedKey = JSON.stringify(pick(reseller))
  useEffect(() => setForm(JSON.parse(storedKey) as Form), [storedKey])

  const original = pick(reseller)
  const dirty = (Object.keys(form) as (keyof Form)[]).some((k) => form[k] !== original[k])
  const errors = useMemo(() => ({ name: !form.name.trim() ? 'Required' : undefined, email: !EMAIL.test(form.email.trim()) ? 'Enter a valid email address' : undefined }), [form])
  const invalid = !!(errors.name || errors.email)

  const save = useInstMutation((body: Partial<Reseller>) => resellersService.update(reseller.id, body), { success: 'Profile saved' })
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))

  // Country codes not in the curated list still need to be selectable.
  const countryOptions = COUNTRY_OPTIONS.some((c) => c.value === form.country) ? COUNTRY_OPTIONS : [{ value: form.country, label: form.country }, ...COUNTRY_OPTIONS]

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader title="Shop profile" description="Business and contact details used for top-up receipts, low-balance alerts and supplier-outage notices." />
        <CardBody>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (dirty && !invalid) save.mutate({ ...form, name: form.name.trim(), email: form.email.trim() })
            }}
          >
            <Field label="Business name" error={errors.name} className="sm:col-span-2">
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} leading={<Building />} invalid={!!errors.name} />
            </Field>
            <Field label="Contact person">
              <Input value={form.contactName} onChange={(e) => set('contactName', e.target.value)} leading={<UserRound />} placeholder="Name of the primary contact" />
            </Field>
            <Field label="Email" error={errors.email}>
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} leading={<Mail />} invalid={!!errors.email} />
            </Field>
            <Field label="Website">
              <Input value={form.website} onChange={(e) => set('website', e.target.value)} leading={<Globe />} placeholder="gsm-shop.example" />
            </Field>
            <Field label="Country">
              <Select value={form.country} onChange={(e) => set('country', e.target.value)} options={countryOptions} />
            </Field>
            <Field label="Internal notes" optional hint="Visible to administrators only — never exposed through the API." className="sm:col-span-2">
              <Textarea rows={4} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Volume commitments, preferred suppliers, chargeback history, escalation contacts…" />
            </Field>
            <button type="submit" className="hidden" />
          </form>
        </CardBody>
        <CardFooter>
          <span>{dirty ? <span className="text-warning">Unsaved changes</span> : 'All changes saved'}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" disabled={!dirty} onClick={() => setForm(original)}>
              Discard
            </Button>
            <Button size="sm" variant="primary" disabled={!dirty || invalid} loading={save.isPending} onClick={() => save.mutate({ ...form, name: form.name.trim(), email: form.email.trim() })}>
              Save profile
            </Button>
          </div>
        </CardFooter>
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader title="Account" />
          <CardBody className="pt-0">
            <DescriptionList
              items={[
                { label: 'Reseller ID', value: <MonoValue value={reseller.id} /> },
                { label: 'Pricing group', value: <GroupChip group={group} /> },
                { label: 'Partner since', value: date(reseller.createdAt) },
                { label: 'Last active', value: relative(reseller.lastActiveAt), hint: dateTime(reseller.lastActiveAt) },
                { label: 'Lifetime orders', value: <span className="tabular">{num(reseller.ordersTotal)}</span> },
                { label: 'Services', value: reseller.allowedServiceIds === 'all' ? 'All services' : `${reseller.allowedServiceIds.length} selected` },
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Callback URL" description="Where unlock confirmations and code results are pushed by default." />
          <CardBody className="pt-0">
            {reseller.webhookUrl ? (
              <div className="rounded-lg border border-line bg-surface-2/60 px-3 py-2">
                <MonoValue value={reseller.webhookUrl} className="w-full" />
              </div>
            ) : (
              <p className="text-[12.5px] text-fg-3">No callback URL registered. The shop polls order status for results instead.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
