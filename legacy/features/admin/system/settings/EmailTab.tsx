import { useState } from 'react'
import { BadgeCheck, FileText, Mail, Send, TriangleAlert } from 'lucide-react'
import { Badge, Button, Input, SecretField, Select } from '@/components/ui'
import { toast } from '@/stores/toast'
import { withMinDuration } from '../health/useNow'
import { EMAIL_RE, FormSkeleton, SaveBar, SettingRow, SettingsCard, useSectionForm } from './form'

const PROVIDERS = ['SMTP', 'Amazon SES', 'Postmark', 'Mailgun', 'SendGrid']

/** Demo subjects use the seeded order numbers and services. */
const TEMPLATES = [
  { event: 'order.completed', subject: 'Your unlock order #100482 is complete — iPhone Unlock, USA Carriers', to: 'Customer / reseller' },
  { event: 'order.failed', subject: 'Order #100479 could not be completed — refunded to your balance', to: 'Customer / reseller' },
  { event: 'reseller.balance_low', subject: 'Your balance is below $50 — top up to keep orders flowing', to: 'Reseller' },
  { event: 'reseller.statement', subject: 'September statement — 1,284 orders · IMEI checks, unlocks, codes', to: 'Reseller' },
  { event: 'user.invited', subject: 'You have been invited to UnlockDesk Ops', to: 'Admin user' },
]

export function EmailTab() {
  const f = useSectionForm('email', 'Email')
  const [sending, setSending] = useState(false)
  const [to, setTo] = useState('alex@unlockdesk-demo.com')
  if (!f.values) return <FormSkeleton rows={5} />
  const v = f.values
  const fromInvalid = !EMAIL_RE.test(v.fromAddress)
  const toInvalid = !EMAIL_RE.test(to)

  const sendTest = async () => {
    setSending(true)
    await withMinDuration(Promise.resolve(), 1300)
    setSending(false)
    toast.success('Test email sent', `Delivered to ${to} via ${v.provider} in 412 ms — look for “Test email from ${v.fromName}” in the inbox.`)
  }

  return (
    <div>
      <SettingsCard icon={<Mail />} title="Sender" description="Used for order receipts, unlock codes and IMEI reports, reseller statements, invitations and low-balance alerts.">
        <SettingRow label="From name" description="Your brand as resellers and customers see it in their inbox." changed={f.isChanged('fromName')} htmlFor="fromName">
          <Input id="fromName" value={v.fromName} placeholder="UnlockDesk" onChange={(e) => f.set('fromName', e.target.value)} className="max-w-md" />
        </SettingRow>
        <SettingRow label="From address" description="Must belong to a domain verified with your email provider (SPF + DKIM)." changed={f.isChanged('fromAddress')} htmlFor="fromAddress">
          <div className="flex max-w-md flex-col gap-1.5">
            <Input id="fromAddress" type="email" value={v.fromAddress} invalid={fromInvalid} onChange={(e) => f.set('fromAddress', e.target.value)} />
            {fromInvalid ? (
              <p className="text-xs text-danger">Enter a valid email address.</p>
            ) : v.verified && !f.isChanged('fromAddress') ? (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-success">
                <BadgeCheck className="size-3.5" /> Domain verified · SPF and DKIM passing
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-warning">
                <TriangleAlert className="size-3.5" /> New address — verify the domain with your provider after saving
              </span>
            )}
          </div>
        </SettingRow>
      </SettingsCard>

      <SettingsCard className="mt-5" title="Delivery" description="Credentials come from the SMTP_URL environment variable and are never shown in the admin.">
        <SettingRow label="Provider" changed={f.isChanged('provider')}>
          <Select value={v.provider} onChange={(e) => f.set('provider', e.target.value)} options={PROVIDERS.map((p) => ({ value: p, label: p }))} className="max-w-xs" />
        </SettingRow>
        <SettingRow label="SMTP host" description="Host and credentials are part of SMTP_URL. Change them in your .env file and restart core-worker.">
          <div className="flex max-w-md flex-col gap-2">
            <SecretField masked={v.smtpHostMasked} label="The SMTP connection string" />
            <div className="flex items-center gap-2">
              <Badge tone={v.verified ? 'success' : 'warning'} dot>
                {v.verified ? 'Connected' : 'Not verified'}
              </Badge>
              <span className="text-[12px] text-fg-3">TLS (STARTTLS) on port 587</span>
            </div>
          </div>
        </SettingRow>
        <SettingRow label="Send test email" description="Sends a short test message using the saved configuration.">
          <div className="flex max-w-md gap-2">
            <Input type="email" value={to} invalid={toInvalid} onChange={(e) => setTo(e.target.value)} className="flex-1" aria-label="Test recipient" />
            <Button variant="secondary" leading={<Send />} loading={sending} disabled={toInvalid} onClick={sendTest}>
              Send test
            </Button>
          </div>
        </SettingRow>
      </SettingsCard>

      <SettingsCard className="mt-5" icon={<FileText />} title="Transactional emails" description="Sent automatically from this installation with your sender and branding.">
        <ul>
          {TEMPLATES.map((t) => (
            <li key={t.event} className="grid gap-1 border-t border-line px-5 py-3 first:border-t-0 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
              <span className="font-mono text-[12px] text-fg-2">{t.event}</span>
              <span className="min-w-0 truncate text-[13px] text-fg">{t.subject}</span>
              <span className="text-[12px] text-fg-3">{t.to}</span>
            </li>
          ))}
        </ul>
      </SettingsCard>

      <SaveBar dirty={f.dirty} count={f.changed.length} saving={f.saving} invalid={fromInvalid} onDiscard={f.discard} onSave={f.save} />
    </div>
  )
}
