import { Link } from 'react-router'
import { CodeXml, FlaskConical, Gauge } from 'lucide-react'
import { CodeBlock, Input, Select, Switch } from '@/components/ui'
import { num } from '@/lib/format'
import { FormSkeleton, SaveBar, SettingRow, SettingsCard, URL_RE, toInt, useSectionForm } from './form'

export function ApiTab() {
  const f = useSectionForm('api', 'API')
  if (!f.values) return <FormSkeleton rows={5} />
  const v = f.values
  const urlInvalid = !URL_RE.test(v.baseUrl)
  const rateInvalid = !(v.defaultRateLimit >= 10 && v.defaultRateLimit <= 10_000)

  const example = `# iPhone Unlock — USA Carriers, placed by reseller MobileHub
curl -X POST ${v.baseUrl.replace(/\/$/, '')}/orders \\
  -H "Authorization: Bearer orx_live_••••••••••••" \\
  -H "Idempotency-Key: 7c1f0e7a-2b8d-4d7e-9a51-0f3c2d1e4b6a" \\
  -H "Content-Type: application/json" \\
  -d '{"service_id":"SVC-1007","fields":{"imei":"356938035643809","network":"att_us"},"client_reference":"MH-77120"}'`

  return (
    <div>
      <SettingsCard icon={<CodeXml />} title="Reseller API" description="Defaults for every reseller integration. Individual API keys can override rate limits and IP allowlists." footer={
        <>
          <span>Keys, scopes and per-key limits are managed under Developer.</span>
          <Link to="/admin/developer/keys" className="font-medium text-accent-ink hover:underline">
            API keys →
          </Link>
        </>
      }>
        <SettingRow label="Reseller API base URL" description="Public URL your resellers integrate with to place IMEI, unlock and server orders. Served by this installation behind Caddy." changed={f.isChanged('baseUrl')} htmlFor="baseUrl">
          <Input id="baseUrl" mono value={v.baseUrl} invalid={urlInvalid} onChange={(e) => f.set('baseUrl', e.target.value)} className="max-w-lg" />
          {urlInvalid && <p className="mt-1.5 text-xs text-danger">Must be an https:// URL.</p>}
        </SettingRow>
        <SettingRow label="Default rate limit" description="Requests per minute per API key, unless the key sets its own limit. Bulk IMEI checks count one request per IMEI." changed={f.isChanged('defaultRateLimit')} htmlFor="rate">
          <div className="flex items-center gap-3">
            <Input id="rate" type="number" min={10} max={10000} step={10} value={v.defaultRateLimit} invalid={rateInvalid} onChange={(e) => f.set('defaultRateLimit', toInt(e.target.value))} className="w-32" />
            <span className="text-[12.5px] text-fg-3">
              req / min · ≈ {num(v.defaultRateLimit * 60 * 24, { compact: true })} per day
            </span>
          </div>
          {rateInvalid && <p className="mt-1.5 text-xs text-danger">Between 10 and 10,000 requests per minute.</p>}
        </SettingRow>
        <SettingRow label="Idempotency window" description="Repeated requests with the same Idempotency-Key within this window return the original response — a retried unlock order is never charged twice." changed={f.isChanged('idempotencyWindowHours')}>
          <Select
            value={String(v.idempotencyWindowHours)}
            onChange={(e) => f.set('idempotencyWindowHours', Number(e.target.value))}
            options={[1, 6, 12, 24, 48, 72].map((h) => ({ value: String(h), label: `${h} hour${h === 1 ? '' : 's'}` }))}
            className="w-48"
          />
        </SettingRow>
        <SettingRow label="Require IP allowlist" description="Reject API keys that don’t define at least one allowed IP range." changed={f.isChanged('requireIpAllowlist')}>
          <Switch checked={v.requireIpAllowlist} onChange={(x) => f.set('requireIpAllowlist', x)} label="Require IP allowlist" />
        </SettingRow>
      </SettingsCard>

      <SettingsCard className="mt-5" icon={<FlaskConical />} title="Sandbox" description="Test keys (orx_test_…) hit a simulated pipeline — no supplier is called, no IMEI is submitted and no balance is charged.">
        <SettingRow label="Enable sandbox" description="Lets resellers wire up their integration safely before going live. Test IMEIs return canned results — clean, blacklisted, NCK code." changed={f.isChanged('sandboxEnabled')}>
          <div className="flex items-center gap-3">
            <Switch checked={v.sandboxEnabled} onChange={(x) => f.set('sandboxEnabled', x)} label="Enable sandbox" />
            <span className="text-[12.5px] text-fg-2">{v.sandboxEnabled ? 'Test keys accepted' : 'Test keys rejected with 403'}</span>
          </div>
        </SettingRow>
      </SettingsCard>

      <div className="mt-5">
        <div className="mb-2 flex items-center gap-2 text-[12.5px] text-fg-3">
          <Gauge className="size-3.5" /> Example reseller request with these settings
        </div>
        <CodeBlock code={example} lang="bash" title="create-order.sh" />
      </div>

      <SaveBar dirty={f.dirty} count={f.changed.length} saving={f.saving} invalid={urlInvalid || rateInvalid} onDiscard={f.discard} onSave={f.save} />
    </div>
  )
}
