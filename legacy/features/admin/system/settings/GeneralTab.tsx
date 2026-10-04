import { Building } from 'lucide-react'
import { Input, Select } from '@/components/ui'
import { FormSkeleton, SaveBar, SettingRow, SettingsCard, EMAIL_RE, useSectionForm } from './form'

const TIMEZONES = ['UTC', 'Europe/Amsterdam', 'Europe/London', 'Europe/Berlin', 'Europe/Istanbul', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Sao_Paulo', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Australia/Sydney']
const CURRENCIES = [
  { value: 'USD', label: 'USD — US dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British pound' },
  { value: 'AED', label: 'AED — UAE dirham' },
  { value: 'TRY', label: 'TRY — Turkish lira' },
  { value: 'BRL', label: 'BRL — Brazilian real' },
  { value: 'SGD', label: 'SGD — Singapore dollar' },
]

export function GeneralTab() {
  const f = useSectionForm('general', 'General')
  if (!f.values) return <FormSkeleton rows={5} />
  const v = f.values
  const emailInvalid = !EMAIL_RE.test(v.supportEmail)
  const nameInvalid = !v.orgName.trim()
  const prefixInvalid = v.orderPrefix.length > 6

  const tzNow = (() => {
    try {
      return new Intl.DateTimeFormat('en-GB', { timeZone: v.timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
    } catch {
      return '—'
    }
  })()

  return (
    <div>
      <SettingsCard icon={<Building />} title="Organisation" description="Shown in the admin, reseller statements and transactional emails.">
        <SettingRow label="Organisation name" description="Legal or trading name of the business operating this installation." changed={f.isChanged('orgName')} htmlFor="orgName">
          <Input id="orgName" value={v.orgName} invalid={nameInvalid} placeholder="UnlockDesk Demo Ltd." onChange={(e) => f.set('orgName', e.target.value)} className="max-w-md" />
          {nameInvalid && <p className="mt-1.5 text-xs text-danger">Organisation name is required.</p>}
        </SettingRow>
        <SettingRow label="Support email" description="Reply-to address on order receipts, unlock results and reseller emails." changed={f.isChanged('supportEmail')} htmlFor="supportEmail">
          <Input id="supportEmail" type="email" value={v.supportEmail} invalid={emailInvalid} placeholder="support@unlockdesk-demo.com" onChange={(e) => f.set('supportEmail', e.target.value)} className="max-w-md" />
          {emailInvalid && <p className="mt-1.5 text-xs text-danger">Enter a valid email address.</p>}
        </SettingRow>
      </SettingsCard>

      <SettingsCard className="mt-5" title="Regional defaults" description="Used for reports, order timestamps, reseller balances and pricing.">
        <SettingRow label="Timezone" description={`Reports and daily reseller limits reset at midnight in this timezone. Local time now: ${tzNow}.`} changed={f.isChanged('timezone')}>
          <Select value={v.timezone} onChange={(e) => f.set('timezone', e.target.value)} options={TIMEZONES.map((t) => ({ value: t, label: t.replaceAll('_', ' ') }))} className="max-w-xs" />
        </SettingRow>
        <SettingRow label="Base currency" description="Currency for service prices, reseller balances and the transaction ledger. Changing it does not convert existing amounts." changed={f.isChanged('currency')}>
          <Select value={v.currency} onChange={(e) => f.set('currency', e.target.value)} options={CURRENCIES} className="max-w-xs" />
        </SettingRow>
        <SettingRow label="Order number prefix" description="Prepended to order numbers in the admin, receipts and Reseller API responses." changed={f.isChanged('orderPrefix')} htmlFor="orderPrefix">
          <div className="flex flex-wrap items-center gap-3">
            <Input id="orderPrefix" value={v.orderPrefix} mono invalid={prefixInvalid} maxLength={8} onChange={(e) => f.set('orderPrefix', e.target.value)} className="w-28" />
            <span className="text-[12.5px] text-fg-3">
              Preview: <span className="font-mono text-fg">{v.orderPrefix}100482</span> · iPhone Unlock — USA Carriers
            </span>
          </div>
          {prefixInvalid && <p className="mt-1.5 text-xs text-danger">Use at most 6 characters.</p>}
        </SettingRow>
      </SettingsCard>

      <SaveBar dirty={f.dirty} count={f.changed.length} saving={f.saving} invalid={emailInvalid || nameInvalid || prefixInvalid} onDiscard={f.discard} onSave={f.save} />
    </div>
  )
}
