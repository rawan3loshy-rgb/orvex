import { useMemo, useState } from 'react'
import { Check, CircleCheck, CircleX, Monitor, Palette, Search, Smartphone } from 'lucide-react'
import { useInstMutation, useStoreCatalog, useStorefrontAdmin } from '@/hooks/installation'
import { storefrontAdminService } from '@/services/installation'
import { PermissionHint } from '@/components/domain'
import { Badge, Card, CardBody, CardHeader, Field, Input, PageHeader, Segmented, Select } from '@/components/ui'
import { formatMoney } from '@/core/money'
import type { StorefrontTheme } from '@/types/installation'
import { cn } from '@/lib/cn'
import { contrastChecks, FONT_OPTIONS, fontStack, isValidHex, matchPreset, NEUTRALS, storefrontVars, THEME_PRESETS, type ThemeColors } from '@/features/storefront/lib/theme'
import { EditorSkeleton, LoadFailed, StorefrontTabs } from './shared'
import { sameContent } from './editorUtils'
import { PublishBar } from './PublishBar'

const COLOR_FIELDS: { key: keyof ThemeColors; label: string; hint: string }[] = [
  { key: 'primary', label: 'Primary', hint: 'Buttons, links, highlights' },
  { key: 'accent', label: 'Accent', hint: 'Secondary highlights' },
  { key: 'background', label: 'Background', hint: 'Page background' },
  { key: 'surface', label: 'Surface', hint: 'Bands and insets' },
  { key: 'text', label: 'Text', hint: 'Headings and body' },
  { key: 'muted', label: 'Muted text', hint: 'Secondary copy' },
]

export default function ThemePage() {
  const q = useStorefrontAdmin()
  if (q.isLoading) return <EditorSkeleton />
  if (q.isError || !q.data) return <LoadFailed message={q.error?.message} onRetry={() => void q.refetch()} />
  return <ThemeEditor key={JSON.stringify(q.data.theme)} saved={q.data.theme} />
}

function ThemeEditor({ saved }: { saved: StorefrontTheme }) {
  const [t, setT] = useState<StorefrontTheme>(saved)
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const dirty = !sameContent(t, saved)
  const save = useInstMutation((theme: StorefrontTheme) => storefrontAdminService.saveDraft({ theme }), { success: 'Theme saved to the draft — preview it, then publish' })
  const checks = useMemo(() => contrastChecks(t.colors), [t.colors])
  const invalid = Object.values(t.colors).some((c) => !isValidHex(c))
  const failing = checks.filter((c) => !c.pass).length

  const setColors = (colors: ThemeColors) => setT((x) => ({ ...x, colors, presetId: matchPreset(colors)?.preset.id ?? 'custom' }))
  const setMode = (mode: 'light' | 'dark') => {
    const m = matchPreset(t.colors)
    const colors = m ? m.preset[mode] : { ...t.colors, ...NEUTRALS[mode] }
    setT((x) => ({ ...x, mode, colors, presetId: m?.preset.id ?? 'custom' }))
  }

  return (
    <div>
      <PageHeader
        icon={<Palette />}
        title="Theme"
        description="Colours, typography and shape of the public storefront. Independent of the admin console theme."
      />
      <StorefrontTabs />
      <PublishBar dirty={dirty} saving={save.isPending} onSaveDraft={() => save.mutate(t)} onRevert={() => setT(saved)} saveBlockedReason={invalid ? 'Every colour must be a valid hex value (e.g. #0e7c66)' : undefined} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader title="Presets" description="Curated palettes tuned for WCAG AA in light and dark" />
            <CardBody className="grid gap-2 sm:grid-cols-2">
              {THEME_PRESETS.map((p) => {
                const pal = p[t.mode]
                const active = t.presetId === p.id
                return (
                  <button key={p.id} type="button" onClick={() => setT((x) => ({ ...x, presetId: p.id, colors: p[x.mode] }))} className={cn('flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors', active ? 'border-accent bg-accent/5' : 'border-line hover:border-line-strong')}>
                    <span className="flex h-9 w-14 shrink-0 overflow-hidden rounded-md border border-line">
                      <span className="flex-1" style={{ background: pal.background }} />
                      <span className="flex-1" style={{ background: pal.primary }} />
                      <span className="w-2" style={{ background: pal.accent }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                        {p.name}
                        {active && <Check className="size-3.5 text-accent-ink" />}
                      </span>
                      <span className="block truncate text-[11.5px] text-fg-3">{p.description}</span>
                    </span>
                  </button>
                )
              })}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Brand & mode" />
            <CardBody className="grid gap-3 sm:grid-cols-2">
              <Field label="Brand name">
                <Input inputSize="sm" value={t.brandName} onChange={(e) => setT({ ...t, brandName: e.target.value })} />
              </Field>
              <Field label="Logo text">
                <Input inputSize="sm" value={t.logoText} onChange={(e) => setT({ ...t, logoText: e.target.value })} />
              </Field>
              <Field label="Mode" hint="Light is recommended for commerce">
                <Segmented<'light' | 'dark'>
                  items={[
                    { value: 'light', label: 'Light' },
                    { value: 'dark', label: 'Dark' },
                  ]}
                  value={t.mode}
                  onChange={setMode}
                />
              </Field>
              <Field label={`Corner radius · ${t.radius}px`}>
                <input type="range" min={0} max={20} step={1} value={t.radius} onChange={(e) => setT({ ...t, radius: Number(e.target.value) })} className="h-8 w-full accent-[var(--accent)]" aria-label="Corner radius" />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Colours" description={t.presetId === 'custom' ? 'Custom palette' : `Based on ${THEME_PRESETS.find((p) => p.id === t.presetId)?.name ?? t.presetId}`} />
            <CardBody className="grid gap-3 sm:grid-cols-2">
              {COLOR_FIELDS.map((f) => {
                const v = t.colors[f.key]
                const ok = isValidHex(v)
                return (
                  <Field key={f.key} label={f.label} hint={ok ? f.hint : undefined} error={ok ? undefined : 'Use a hex colour like #0e7c66'}>
                    <div className="flex items-center gap-2">
                      <input type="color" value={ok && v.length === 7 ? v : '#000000'} onChange={(e) => setColors({ ...t.colors, [f.key]: e.target.value })} className="h-8 w-10 shrink-0 cursor-pointer rounded-md border border-line bg-transparent p-0.5" aria-label={`${f.label} colour`} />
                      <Input inputSize="sm" mono value={v} invalid={!ok} onChange={(e) => setColors({ ...t.colors, [f.key]: e.target.value.trim() })} />
                    </div>
                  </Field>
                )
              })}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Typography" description="Fonts are bundled with the installation — no third-party font requests" />
            <CardBody className="grid gap-3 sm:grid-cols-2">
              {(['fontHeading', 'fontBody'] as const).map((k) => (
                <Field key={k} label={k === 'fontHeading' ? 'Headings' : 'Body text'}>
                  <Select inputSize="sm" value={t[k]} onChange={(e) => setT({ ...t, [k]: e.target.value })} options={FONT_OPTIONS.map((f) => ({ value: f.value, label: `${f.label} — ${f.kind}` }))} />
                  <div className="mt-1.5 truncate rounded-md border border-line bg-surface-2 px-2.5 py-2 text-[15px]" style={{ fontFamily: fontStack(t[k]) }}>
                    {k === 'fontHeading' ? 'Know a phone before you buy' : 'Instant IMEI checks and official unlocks.'}
                  </div>
                </Field>
              ))}
            </CardBody>
          </Card>
        </div>

        <div className="grid content-start gap-4 xl:sticky xl:top-4 xl:self-start">
          <Card className="overflow-hidden">
            <CardHeader
              title="Live preview"
              description="Real catalog data — prices from the pricing engine"
              actions={
                <Segmented<'desktop' | 'mobile'>
                  size="xs"
                  items={[
                    { value: 'desktop', label: 'Desktop', icon: <Monitor className="size-3.5" /> },
                    { value: 'mobile', label: 'Mobile', icon: <Smartphone className="size-3.5" /> },
                  ]}
                  value={device}
                  onChange={setDevice}
                />
              }
            />
            <div className="border-t border-line bg-bg-subtle p-3">
              <div className={cn('mx-auto overflow-hidden rounded-lg border border-line shadow-pop transition-[max-width]', device === 'mobile' ? 'max-w-[340px]' : 'max-w-full')}>
                <MiniStorefront theme={t} mobile={device === 'mobile'} />
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader title="Contrast (WCAG 2.1)" description={failing ? `${failing} check${failing === 1 ? '' : 's'} below AA` : 'All checks pass AA'} actions={<Badge tone={failing ? 'warning' : 'success'}>{failing ? 'Review' : 'AA'}</Badge>} />
            <div className="divide-y divide-line border-t border-line">
              {checks.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-5 py-2 text-[12.5px]">
                  <span className="grid h-6 w-9 shrink-0 place-items-center rounded border border-line text-[11px] font-bold" style={{ background: c.bg, color: c.fg }}>
                    Aa
                  </span>
                  <span className="min-w-0 flex-1 truncate text-fg-2">{c.label}</span>
                  <span className="tabular w-12 text-right font-mono text-fg">{c.ratio.toFixed(2)}</span>
                  <span className="w-20 text-right text-[11px] text-fg-3">min {c.min}:1</span>
                  {c.pass ? <CircleCheck className="size-4 text-success" /> : <CircleX className="size-4 text-danger" />}
                </div>
              ))}
            </div>
          </Card>
          <PermissionHint permission="storefront.manage" />
        </div>
      </div>
    </div>
  )
}

/** Small storefront rendered with the draft theme, scoped to its own variables. */
function MiniStorefront({ theme, mobile }: { theme: StorefrontTheme; mobile: boolean }) {
  const vars = storefrontVars(theme)
  const cards = useStoreCatalog({ featured: true, limit: 3, sort: 'popular' })
  const r = 'rounded-[var(--sf-r)]'
  return (
    <div style={{ ...vars, fontFamily: fontStack(theme.fontBody) }} className="bg-bg text-fg">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <span className="grid size-6 place-items-center rounded-[calc(var(--sf-r)*0.7)] bg-accent text-[11px] font-bold text-accent-fg">{theme.logoText.slice(0, 1)}</span>
        <span className="text-[14px] font-semibold tracking-[-0.02em]" style={{ fontFamily: fontStack(theme.fontHeading) }}>
          {theme.logoText}
        </span>
        {!mobile && (
          <span className="ml-3 flex gap-3 text-[11.5px] text-fg-3">
            <span>IMEI Checks</span>
            <span>Unlocks</span>
            <span>Track order</span>
          </span>
        )}
        <span className={cn('ml-auto bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-fg', r)}>Check an IMEI</span>
      </div>
      <div className="px-4 py-6 text-center">
        <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-0.5 text-[10.5px] font-semibold text-fg-2">
          <span className="size-1 rounded-full bg-accent" /> Device checks & official unlocks
        </div>
        <div className={cn('mx-auto mt-2.5 max-w-md leading-[1.08] font-semibold tracking-[-0.025em]', mobile ? 'text-[22px]' : 'text-[28px]')} style={{ fontFamily: fontStack(theme.fontHeading) }}>
          Know a phone before you buy, sell or unlock it.
        </div>
        <p className="mx-auto mt-2 max-w-sm text-[12px] text-fg-3">Instant IMEI checks, carrier status and official unlocks.</p>
        <div className={cn('mx-auto mt-3.5 flex max-w-sm items-center gap-2 border border-line-strong bg-surface p-1 pl-2.5 text-left', r)}>
          <Search className="size-3.5 text-fg-3" />
          <span className="flex-1 text-[11.5px] text-fg-3">iPhone 15 unlock</span>
          <span className={cn('bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-fg', r)}>Search</span>
        </div>
      </div>
      <div className={cn('grid gap-2 border-t border-line bg-bg-subtle p-4', mobile ? 'grid-cols-1' : 'grid-cols-3')}>
        {(cards.data ?? []).map((c) => (
          <div key={c.id} className={cn('border border-line bg-surface p-3 shadow-card', 'rounded-[var(--sf-r-lg)]')}>
            <div className="line-clamp-1 text-[12px] font-semibold" style={{ fontFamily: fontStack(theme.fontHeading) }}>
              {c.name}
            </div>
            <div className="mt-0.5 line-clamp-2 text-[10.5px] text-fg-3">{c.summary}</div>
            <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
              <span className="text-[10.5px] text-fg-3">{c.available ? c.categoryName : 'Temporarily unavailable'}</span>
              <span className="text-[13px] font-semibold" style={{ fontFamily: fontStack(theme.fontHeading) }}>
                {formatMoney(c.price)}
              </span>
            </div>
          </div>
        ))}
        {cards.isLoading && [0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-[var(--sf-r-lg)] bg-fg/[0.06]" />)}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-3 rounded-[var(--sf-r-lg)] bg-accent px-4 py-3 text-accent-fg">
          <span className="text-[12.5px] font-semibold">Run a repair shop?</span>
          <span className={cn('bg-accent-fg px-2.5 py-1 text-[11px] font-semibold text-accent', r)}>Become a reseller</span>
        </div>
      </div>
    </div>
  )
}
