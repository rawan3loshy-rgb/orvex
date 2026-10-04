import { Languages } from 'lucide-react'
import { Select } from '@/components/ui'
import { useSettings } from '@/hooks/installation'
import { FormSkeleton, SaveBar, SettingRow, SettingsCard, useSectionForm } from './form'

const LANGUAGES = ['English (US)', 'English (UK)', 'Deutsch', 'Français', 'Español', 'Português (Brasil)', 'Türkçe', 'Nederlands']
const DATE_FORMATS = ['DD MMM YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY', 'DD.MM.YYYY']
const NUMBER_FORMATS = ['1,234.56', '1.234,56', '1 234,56', "1'234.56"]
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDate(d: Date, fmt: string) {
  const DD = String(d.getDate()).padStart(2, '0')
  const MM = String(d.getMonth() + 1).padStart(2, '0')
  const YYYY = String(d.getFullYear())
  return fmt.replace('YYYY', YYYY).replace('MMM', MONTHS[d.getMonth()]!).replace('MM', MM).replace('DD', DD)
}

function formatNumber(n: number, fmt: string) {
  const group = fmt[1] === '2' ? '' : fmt[1]!
  const dec = fmt[fmt.length - 3]!
  const [int, frac] = n.toFixed(2).split('.')
  return `${int!.replace(/\B(?=(\d{3})+(?!\d))/g, group)}${dec}${frac}`
}

export function LocalizationTab() {
  const f = useSectionForm('localization', 'Localization')
  const settings = useSettings()
  if (!f.values) return <FormSkeleton rows={3} />
  const v = f.values
  const now = new Date()
  const currency = settings.data?.general.currency ?? 'USD'

  return (
    <div>
      <SettingsCard icon={<Languages />} title="Formats" description="Applied to the admin, emails and reseller statements. The Reseller API always uses ISO-8601 and plain decimals.">
        <SettingRow label="Language" description="Admin interface and system emails." changed={f.isChanged('language')}>
          <Select value={v.language} onChange={(e) => f.set('language', e.target.value)} options={LANGUAGES.map((l) => ({ value: l, label: l }))} className="w-60" />
        </SettingRow>
        <SettingRow label="Date format" changed={f.isChanged('dateFormat')}>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={v.dateFormat} onChange={(e) => f.set('dateFormat', e.target.value)} options={DATE_FORMATS.map((d) => ({ value: d, label: d }))} className="w-60" />
            <span className="font-mono text-[12.5px] text-fg-2">{formatDate(now, v.dateFormat)}</span>
          </div>
        </SettingRow>
        <SettingRow label="Number format" changed={f.isChanged('numberFormat')}>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={v.numberFormat} onChange={(e) => f.set('numberFormat', e.target.value)} options={NUMBER_FORMATS.map((n) => ({ value: n, label: n }))} className="w-60" />
            <span className="font-mono text-[12.5px] text-fg-2">{formatNumber(48210.5, v.numberFormat)}</span>
          </div>
        </SettingRow>
      </SettingsCard>

      <div className="mt-5 rounded-xl border border-line bg-surface-2/40 p-4">
        <div className="mono-label">Preview · reseller statement</div>
        <div className="mt-3 grid gap-3 text-[13px] sm:grid-cols-4">
          <div className="min-w-0">
            <p className="text-fg-3">Reseller</p>
            <p className="truncate font-medium text-fg">MobileHub · 412 orders</p>
          </div>
          <div>
            <p className="text-fg-3">Date</p>
            <p className="font-medium text-fg">{formatDate(now, v.dateFormat)}</p>
          </div>
          <div>
            <p className="text-fg-3">Statement total</p>
            <p className="font-medium text-fg tabular">
              {currency} {formatNumber(1284.9, v.numberFormat)}
            </p>
          </div>
          <div>
            <p className="text-fg-3">Language</p>
            <p className="font-medium text-fg">{v.language}</p>
          </div>
        </div>
        <p className="mt-3 text-[12px] text-fg-3">Timezone and base currency are set under General.</p>
      </div>

      <SaveBar dirty={f.dirty} count={f.changed.length} saving={f.saving} onDiscard={f.discard} onSave={f.save} />
    </div>
  )
}
