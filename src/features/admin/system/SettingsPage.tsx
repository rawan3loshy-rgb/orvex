import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { Building, CodeXml, Globe, Languages, Mail, Palette, Settings2, Webhook } from 'lucide-react'
import { Badge, CodeBlock, Input, PageHeader, SecretField, Select, Switch, Tabs, type TabItem } from '@/components/ui'
import { PermissionHint, SimulatedBadge } from '@/components/domain'
import { FormSkeleton, SaveBar, SettingRow, SettingsCard } from './settings/form'
import { EMAIL_RE, URL_RE, toInt, useSectionForm } from './settings/sectionForm'
import { Callout, QueryError } from './shared'

type Tab = 'general' | 'api' | 'email' | 'webhooks' | 'localization' | 'branding'

const TABS: TabItem<Tab>[] = [
  { value: 'general', label: 'General', icon: <Building /> },
  { value: 'api', label: 'API', icon: <CodeXml /> },
  { value: 'email', label: 'Email', icon: <Mail /> },
  { value: 'webhooks', label: 'Webhooks', icon: <Webhook /> },
  { value: 'localization', label: 'Localization', icon: <Languages /> },
  { value: 'branding', label: 'Branding', icon: <Palette /> },
]

const TIMEZONES = ['Asia/Dubai', 'Europe/London', 'Europe/Berlin', 'Europe/Istanbul', 'America/New_York', 'America/Los_Angeles', 'Asia/Kolkata', 'Asia/Singapore', 'UTC']

export default function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t.value === params.get('tab'))?.value ?? 'general') as Tab
  return (
    <div className="space-y-5">
      <PageHeader icon={<Settings2 />} eyebrow="System" title="Settings" description="Installation-wide settings. Every change is audited with the field-level diff." actions={<PermissionHint permission="system.manage" />} />
      <Tabs items={TABS} value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} />
      {tab === 'general' && <GeneralTab />}
      {tab === 'api' && <ApiTab />}
      {tab === 'email' && <EmailTab />}
      {tab === 'webhooks' && <WebhooksTab />}
      {tab === 'localization' && <LocalizationTab />}
      {tab === 'branding' && <BrandingTab />}
    </div>
  )
}

function Frame({ f, rows, children }: { f: { loading: boolean; error: boolean; values: unknown; retry: () => void }; rows?: number; children: ReactNode }) {
  if (f.error && !f.values) return <QueryError onRetry={f.retry} />
  if (!f.values) return <FormSkeleton rows={rows} />
  return <>{children}</>
}

/* ------------------------------------------------------------------ */
function GeneralTab() {
  const f = useSectionForm('general', 'General')
  const v = f.values
  const emailBad = !!v && !EMAIL_RE.test(v.supportEmail)
  return (
    <Frame f={f}>
      {v && (
        <>
          <SettingsCard title="Organisation" description="Shown in emails, invoices and the admin console.">
            <SettingRow label="Organisation name" changed={f.isChanged('orgName')}>
              <Input value={v.orgName} onChange={(e) => f.set('orgName', e.target.value)} disabled={!f.canEdit} className="max-w-md" />
            </SettingRow>
            <SettingRow label="Support email" description="Reply-to for customer notifications." changed={f.isChanged('supportEmail')}>
              <Input value={v.supportEmail} invalid={emailBad} onChange={(e) => f.set('supportEmail', e.target.value)} disabled={!f.canEdit} className="max-w-md" />
            </SettingRow>
            <SettingRow label="Timezone" description="Daily reports, statements and the cockpit “today” window." changed={f.isChanged('timezone')}>
              <Select value={v.timezone} onChange={(e) => f.set('timezone', e.target.value)} options={TIMEZONES.map((t) => ({ value: t, label: t }))} disabled={!f.canEdit} className="max-w-xs" />
            </SettingRow>
            <SettingRow label="Ledger currency" description="Fixed at installation. All amounts are stored as integer micro-units.">
              <div className="flex items-center gap-2">
                <Badge tone="neutral" variant="outline" size="md">
                  {v.currency}
                </Badge>
                <span className="text-[12px] text-fg-3">read-only</span>
              </div>
            </SettingRow>
          </SettingsCard>
          <SaveBar dirty={f.dirty} count={f.changed.length} saving={f.saving} invalid={emailBad} canSave={f.canEdit} onDiscard={f.discard} onSave={f.save} />
        </>
      )}
    </Frame>
  )
}

function ApiTab() {
  const f = useSectionForm('api', 'API')
  const v = f.values
  const bad = !!v && (!URL_RE.test(v.baseUrl) || !URL_RE.test(v.dhruEndpoint) || v.idempotencyWindowHours < 1 || v.defaultRateLimit < 1)
  return (
    <Frame f={f} rows={6}>
      {v && (
        <>
          <div className="space-y-4">
            <SettingsCard title="Native API v1" description="Used by resellers’ systems and the storefront.">
              <SettingRow label="Base URL" changed={f.isChanged('baseUrl')}>
                <Input mono value={v.baseUrl} invalid={!URL_RE.test(v.baseUrl)} onChange={(e) => f.set('baseUrl', e.target.value)} disabled={!f.canEdit} className="max-w-lg" />
              </SettingRow>
              <SettingRow label="Idempotency window" description="Scoped to the account across every channel and key: the same Idempotency-Key within the window returns the original order, a different body gets 409." changed={f.isChanged('idempotencyWindowHours')}>
                <Input type="number" min={1} max={168} value={v.idempotencyWindowHours} onChange={(e) => f.set('idempotencyWindowHours', toInt(e.target.value, 1))} trailing={<span className="text-[12px]">hours</span>} disabled={!f.canEdit} className="max-w-[180px]" />
              </SettingRow>
              <SettingRow label="Default rate limit" description="Per API key, per minute. Keys can override it. 429 responses carry Retry-After." changed={f.isChanged('defaultRateLimit')}>
                <Input type="number" min={1} value={v.defaultRateLimit} onChange={(e) => f.set('defaultRateLimit', toInt(e.target.value, 1))} trailing={<span className="text-[12px]">req/min</span>} disabled={!f.canEdit} className="max-w-[200px]" />
              </SettingRow>
              <SettingRow label="Sandbox keys" description="Allow test keys (orx_test_…) that never reach a supplier." changed={f.isChanged('sandboxEnabled')}>
                <Switch checked={v.sandboxEnabled} onChange={(x) => f.set('sandboxEnabled', x)} disabled={!f.canEdit} label="Sandbox keys" />
              </SettingRow>
            </SettingsCard>
            <SettingsCard title="DHRU-compatible endpoint" description="Lets existing DHRU Fusion clients (e.g. a reseller POS) place orders without changes. Same PlaceOrder command as every channel.">
              <SettingRow label="Enabled" description="When off, the endpoint answers with an error; Native API keeps working." changed={f.isChanged('dhruCompatEnabled')}>
                <Switch checked={v.dhruCompatEnabled} onChange={(x) => f.set('dhruCompatEnabled', x)} disabled={!f.canEdit} label="DHRU compatibility" />
              </SettingRow>
              <SettingRow label="Endpoint URL" changed={f.isChanged('dhruEndpoint')}>
                <Input mono value={v.dhruEndpoint} invalid={!URL_RE.test(v.dhruEndpoint)} onChange={(e) => f.set('dhruEndpoint', e.target.value)} disabled={!f.canEdit} className="max-w-lg" />
              </SettingRow>
            </SettingsCard>
          </div>
          <SaveBar dirty={f.dirty} count={f.changed.length} saving={f.saving} invalid={bad} canSave={f.canEdit} onDiscard={f.discard} onSave={f.save} />
        </>
      )}
    </Frame>
  )
}

function EmailTab() {
  const f = useSectionForm('email', 'Email')
  const v = f.values
  const bad = !!v && !EMAIL_RE.test(v.fromAddress)
  return (
    <Frame f={f}>
      {v && (
        <div className="space-y-4">
          <Callout tone="neutral" icon={<Mail />} title="Email transport is simulated">
            Messages are rendered and recorded in the Notifications log, but nothing is delivered. A production installation points SMTP_URL at its own mail server.
          </Callout>
          <SettingsCard title="Sender" actions={<SimulatedBadge label="SMTP · simulated" />} footer={<span>Domain verification: {v.verified ? 'SPF/DKIM recorded as verified (simulated)' : 'not verified'}</span>}>
            <SettingRow label="Provider">
              <span className="text-[13px] text-fg">{v.provider}</span>
            </SettingRow>
            <SettingRow label="From name" changed={f.isChanged('fromName')}>
              <Input value={v.fromName} onChange={(e) => f.set('fromName', e.target.value)} disabled={!f.canEdit} className="max-w-md" />
            </SettingRow>
            <SettingRow label="From address" changed={f.isChanged('fromAddress')}>
              <Input value={v.fromAddress} invalid={bad} onChange={(e) => f.set('fromAddress', e.target.value)} disabled={!f.canEdit} className="max-w-md" />
            </SettingRow>
            <SettingRow label="SMTP host" description="Write-only — stored encrypted in the SMTP_URL secret.">
              <SecretField masked={v.smtpHostMasked} className="max-w-md" />
            </SettingRow>
          </SettingsCard>
          <SaveBar dirty={f.dirty} count={f.changed.length} saving={f.saving} invalid={bad} canSave={f.canEdit} onDiscard={f.discard} onSave={f.save} />
        </div>
      )}
    </Frame>
  )
}

function WebhooksTab() {
  const f = useSectionForm('webhooks', 'Webhook')
  const v = f.values
  const bad = !!v && (v.maxAttempts < 1 || v.maxAttempts > 20 || v.timeoutMs < 1000 || v.timeoutMs > 30000)
  return (
    <Frame f={f}>
      {v && (
        <div className="space-y-4">
          <SettingsCard title="Signing" description="Outbound webhooks follow the Standard Webhooks specification. Receivers verify the signature and de-duplicate by webhook-id." actions={<Badge tone="neutral" variant="outline">read-only</Badge>}>
            <SettingRow label="Scheme">
              <span className="font-mono text-[13px] text-fg">
                {v.signing} · {v.algorithm}
              </span>
            </SettingRow>
            <SettingRow label="Headers" description="Signed content is `${webhook-id}.${webhook-timestamp}.${body}` with the endpoint secret.">
              <CodeBlock lang="text" code={'webhook-id: msg_2Lk9…\nwebhook-timestamp: 1791113472\nwebhook-signature: v1,K5oZfzN95Z9UVu1EsfQmfVNQhnkZ2pj9o9NDN/H/pI4='} />
            </SettingRow>
            <SettingRow label="Retry schedule" description="After the first attempt fails. The webhook-id stays the same across retries.">
              <div className="flex flex-wrap gap-1.5">
                {v.schedule.split(',').map((s, i) => (
                  <span key={i} className="rounded-md border border-line bg-surface-2 px-2 py-0.5 font-mono text-[11.5px] text-fg-2">
                    {i + 1}. {s.trim()}
                  </span>
                ))}
              </div>
            </SettingRow>
          </SettingsCard>
          <SettingsCard title="Delivery limits">
            <SettingRow label="Max attempts" description="After the last attempt the delivery is marked failed and can be replayed manually." changed={f.isChanged('maxAttempts')}>
              <Input type="number" min={1} max={20} value={v.maxAttempts} onChange={(e) => f.set('maxAttempts', toInt(e.target.value, 1))} disabled={!f.canEdit} className="max-w-[160px]" invalid={v.maxAttempts < 1 || v.maxAttempts > 20} />
            </SettingRow>
            <SettingRow label="Timeout" description="Per attempt. A slow receiver counts as a failed attempt (1 000 – 30 000 ms)." changed={f.isChanged('timeoutMs')}>
              <Input type="number" min={1000} max={30000} step={500} value={v.timeoutMs} onChange={(e) => f.set('timeoutMs', toInt(e.target.value, 1000))} trailing={<span className="text-[12px]">ms</span>} disabled={!f.canEdit} className="max-w-[180px]" invalid={v.timeoutMs < 1000 || v.timeoutMs > 30000} />
            </SettingRow>
          </SettingsCard>
          <SaveBar dirty={f.dirty} count={f.changed.length} saving={f.saving} invalid={bad} canSave={f.canEdit} onDiscard={f.discard} onSave={f.save} />
        </div>
      )}
    </Frame>
  )
}

function LocalizationTab() {
  const f = useSectionForm('localization', 'Localization')
  const v = f.values
  return (
    <Frame f={f}>
      {v && (
        <>
          <SettingsCard title="Localization" description="Admin console defaults. Storefront locales are configured under Storefront → Settings." icon={<Globe />}>
            <SettingRow label="Language" changed={f.isChanged('language')}>
              <Select value={v.language} onChange={(e) => f.set('language', e.target.value)} options={['English (US)', 'English (UK)', 'Arabic', 'Turkish', 'German'].map((x) => ({ value: x, label: x }))} disabled={!f.canEdit} className="max-w-xs" />
            </SettingRow>
            <SettingRow label="Date format" changed={f.isChanged('dateFormat')}>
              <Select value={v.dateFormat} onChange={(e) => f.set('dateFormat', e.target.value)} options={['DD MMM YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY'].map((x) => ({ value: x, label: x }))} disabled={!f.canEdit} className="max-w-xs" />
            </SettingRow>
            <SettingRow label="Number format" changed={f.isChanged('numberFormat')}>
              <Select value={v.numberFormat} onChange={(e) => f.set('numberFormat', e.target.value)} options={['1,234.56', '1.234,56', '1 234,56'].map((x) => ({ value: x, label: x }))} disabled={!f.canEdit} className="max-w-xs" />
            </SettingRow>
          </SettingsCard>
          <SaveBar dirty={f.dirty} count={f.changed.length} saving={f.saving} canSave={f.canEdit} onDiscard={f.discard} onSave={f.save} />
        </>
      )}
    </Frame>
  )
}

function BrandingTab() {
  const f = useSectionForm('branding', 'Branding')
  const v = f.values
  const bad = !!v && !/^#[0-9a-f]{6}$/i.test(v.primaryColor)
  return (
    <Frame f={f}>
      {v && (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <SettingsCard title="Admin branding" description="The storefront has its own theme (Storefront → Theme).">
              <SettingRow label="Logo text" changed={f.isChanged('logoText')}>
                <Input value={v.logoText} onChange={(e) => f.set('logoText', e.target.value)} disabled={!f.canEdit} className="max-w-sm" />
              </SettingRow>
              <SettingRow label="Admin title" description="Browser tab and sign-in page." changed={f.isChanged('adminTitle')}>
                <Input value={v.adminTitle} onChange={(e) => f.set('adminTitle', e.target.value)} disabled={!f.canEdit} className="max-w-sm" />
              </SettingRow>
              <SettingRow label="Brand colour" changed={f.isChanged('primaryColor')}>
                <div className="flex items-center gap-2">
                  <input type="color" value={bad ? '#000000' : v.primaryColor} onChange={(e) => f.set('primaryColor', e.target.value)} disabled={!f.canEdit} className="h-9 w-11 cursor-pointer rounded-lg border border-line bg-surface p-1" aria-label="Brand colour" />
                  <Input mono value={v.primaryColor} invalid={bad} onChange={(e) => f.set('primaryColor', e.target.value)} disabled={!f.canEdit} className="max-w-[140px]" />
                </div>
              </SettingRow>
            </SettingsCard>
            <div className="rounded-xl border border-line bg-surface p-4">
              <div className="mono-label mb-3">Preview</div>
              <div className="overflow-hidden rounded-lg border border-line">
                <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-3 py-2.5">
                  <span className="grid size-6 place-items-center rounded-md text-[11px] font-bold text-white" style={{ background: bad ? 'var(--fg-3)' : v.primaryColor }}>
                    {v.logoText.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="text-[13px] font-semibold text-fg">{v.logoText}</span>
                </div>
                <div className="space-y-2 p-3">
                  <p className="text-[12px] text-fg-3">{v.adminTitle}</p>
                  <span className="inline-flex h-7 items-center rounded-md px-3 text-[12px] font-medium text-white" style={{ background: bad ? 'var(--fg-3)' : v.primaryColor }}>
                    Primary action
                  </span>
                </div>
              </div>
            </div>
          </div>
          <SaveBar dirty={f.dirty} count={f.changed.length} saving={f.saving} invalid={bad} canSave={f.canEdit} onDiscard={f.discard} onSave={f.save} />
        </>
      )}
    </Frame>
  )
}
