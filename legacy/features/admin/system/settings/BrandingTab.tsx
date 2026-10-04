import { Link } from 'react-router'
import { Palette } from 'lucide-react'
import { Input } from '@/components/ui'
import { useInstallation, useSettings } from '@/hooks/installation'
import { FormSkeleton, SaveBar, SettingRow, SettingsCard, useSectionForm } from './form'

const HEX_RE = /^#[0-9a-f]{6}$/i
/** The customer's own palette — UnlockDesk emerald first. Deliberately no blues: they read as vendor chrome. */
const DEFAULT_COLOR = '#0e7c66'
const SWATCHES = [DEFAULT_COLOR, '#b4232c', '#a16207', '#4d7c0f', '#9d174d', '#27272a']

export function BrandingTab() {
  const f = useSectionForm('branding', 'Branding')
  const settings = useSettings()
  const installation = useInstallation()
  if (!f.values) return <FormSkeleton rows={3} />
  const v = f.values
  const colorInvalid = !HEX_RE.test(v.primaryColor)
  const color = colorInvalid ? DEFAULT_COLOR : v.primaryColor
  const prefix = settings.data?.general.orderPrefix ?? '#'
  const sender = settings.data?.email.fromName ?? v.logoText
  const domain = installation.data?.domain ?? 'portal.unlockdesk-demo.com'
  const initial = (v.adminTitle || v.logoText || 'U').trim()[0]?.toUpperCase() ?? 'U'

  return (
    <div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <SettingsCard
          icon={<Palette />}
          title="Admin & email branding"
          description="Your brand inside this installation — on the admin, order emails and reseller statements. ORVEX branding is never shown to your resellers."
          footer={
            <>
              <span>The public website has its own theme.</span>
              <Link to="/admin/website/theme" className="font-medium text-accent-ink hover:underline">
                Website theme →
              </Link>
            </>
          }
        >
          <SettingRow label="Admin title" description="Shown in the sidebar, browser tab and sign-in page." changed={f.isChanged('adminTitle')} htmlFor="adminTitle">
            <Input id="adminTitle" value={v.adminTitle} placeholder="UnlockDesk Ops" onChange={(e) => f.set('adminTitle', e.target.value)} className="max-w-md" />
          </SettingRow>
          <SettingRow label="Logo text" description="Wordmark used in order emails and reseller statements." changed={f.isChanged('logoText')} htmlFor="logoText">
            <Input id="logoText" value={v.logoText} placeholder="UnlockDesk" onChange={(e) => f.set('logoText', e.target.value)} className="max-w-md" />
          </SettingRow>
          <SettingRow label="Primary color" description="Buttons and links in emails, and the accent of your admin mark." changed={f.isChanged('primaryColor')}>
            <div className="flex flex-wrap items-center gap-3">
              <label className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-line shadow-card" style={{ background: color }}>
                <input type="color" value={color} onChange={(e) => f.set('primaryColor', e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Pick primary color" />
              </label>
              <Input value={v.primaryColor} mono invalid={colorInvalid} onChange={(e) => f.set('primaryColor', e.target.value)} className="w-32" />
              <div className="flex gap-1.5">
                {SWATCHES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => f.set('primaryColor', s)}
                    className="size-6 rounded-md ring-offset-2 ring-offset-surface transition-transform hover:scale-110 data-[on=true]:ring-2 data-[on=true]:ring-fg/40"
                    data-on={s.toLowerCase() === v.primaryColor.toLowerCase()}
                    style={{ background: s }}
                    aria-label={`Use ${s}${s === DEFAULT_COLOR ? ' (UnlockDesk emerald)' : ''}`}
                  />
                ))}
              </div>
            </div>
            {colorInvalid ? (
              <p className="mt-1.5 text-xs text-danger">Use a 6-digit hex color, e.g. {DEFAULT_COLOR}.</p>
            ) : (
              <p className="mt-1.5 font-mono text-[11px] text-fg-3">Your brand colour — independent of the ORVEX admin theme.</p>
            )}
          </SettingRow>
        </SettingsCard>

        {/* Live preview — customer brand colors are data, rendered as inline styles on purpose */}
        <div className="space-y-4">
          <div className="mono-label">Preview</div>
          <div className="overflow-hidden rounded-xl border border-line bg-bg-subtle shadow-card">
            <div className="flex items-center gap-2.5 border-b border-line px-3.5 py-3">
              <span className="relative grid size-7 shrink-0 place-items-center overflow-hidden rounded-lg font-display text-[12px] font-bold text-white" style={{ background: color }}>
                {initial}
                <span className="absolute right-[18%] bottom-[18%] size-[14%] rounded-full" style={{ background: `color-mix(in oklab, ${color} 45%, #fff)` }} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-fg">{v.adminTitle || 'Admin'}</p>
                <p className="truncate font-mono text-[10.5px] text-fg-3">{domain}</p>
              </div>
            </div>
            <div className="space-y-1 p-2.5">
              {['Overview', 'Orders', 'Resellers', 'Services'].map((n, i) => (
                <div key={n} className="flex h-7 items-center gap-2 rounded-md px-2 text-[12.5px]" style={i === 1 ? { background: `color-mix(in oklab, ${color} 14%, transparent)`, color: 'var(--fg)' } : undefined}>
                  <span className="size-1.5 rounded-full" style={{ background: i === 1 ? color : 'var(--fg-3)' }} />
                  <span className={i === 1 ? 'font-medium' : 'text-fg-2'}>{n}</span>
                  {i === 1 && <span className="ml-auto font-mono text-[10.5px] text-fg-3">14 in flight</span>}
                </div>
              ))}
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
            <div className="border-b border-line px-4 py-2.5 font-mono text-[11px] text-fg-3">
              <span className="text-fg-2">Subject:</span> Your unlock order {prefix}100482 is complete
            </div>
            <div className="px-4 pt-4 pb-4">
              <p className="font-display text-[15px] font-semibold" style={{ color }}>
                {v.logoText || 'Your brand'}
              </p>
              <p className="mt-2 text-[12.5px] text-fg-2">
                Your unlock order {prefix}100482 is complete. The device is ready to use with any carrier — insert a new SIM card to confirm.
              </p>
              <dl className="mt-3 space-y-1 rounded-lg border border-line bg-surface-2/50 px-3 py-2.5 text-[12px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-3">Service</dt>
                  <dd className="truncate text-right text-fg">iPhone Unlock — USA Carriers</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-3">IMEI</dt>
                  <dd className="font-mono text-fg">356938•••••3809</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-3">Result</dt>
                  <dd className="truncate text-right text-fg">Unlocked — whitelisted</dd>
                </div>
              </dl>
              <span className="mt-3 inline-flex h-8 items-center rounded-md px-3 text-[12px] font-medium text-white" style={{ background: color }}>
                View order
              </span>
            </div>
            <div className="border-t border-line px-4 py-2 font-mono text-[10.5px] text-fg-3">order.completed · from {sender}</div>
          </div>
        </div>
      </div>

      <SaveBar dirty={f.dirty} count={f.changed.length} saving={f.saving} invalid={colorInvalid} onDiscard={f.discard} onSave={f.save} />
    </div>
  )
}
