import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useBlocker } from 'react-router'
import { motion } from 'motion/react'
import { CaseSensitive, Check, Moon, Palette, RotateCcw, Save, Sun, SwatchBook, TriangleAlert, Type } from 'lucide-react'
import { Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, Field, Input, PageHeader, Segmented, Select, Skeleton, Tooltip } from '@/components/ui'
import { useInstMutation } from '@/hooks/installation'
import { websiteService } from '@/services/installation'
import { cn } from '@/lib/cn'
import { toast } from '@/stores/toast'
import type { SiteTheme } from '@/types/installation'
import { SiteCanvas, findPageBySlug, resolvePageSections, useSiteRuntime } from '@/features/site/SiteRenderer'
import { FONT_OPTIONS, contrastRatio, fontStack, isValidHex, onColor, splitHref } from '@/features/site/renderSite'
import { DevicePreview, DeviceToggle, UnsavedBar, WebsiteCrumb, modKey, useBeforeUnload, useSaveShortcut, type DeviceId } from './shared'
import { DEFAULT_PRESET, NEUTRALS, THEME_PRESETS, colorsOf, matchPreset, sameColors, type ThemeColors } from './themePresets'

const THEME_KEYS: (keyof SiteTheme)[] = ['siteName', 'logoText', 'primary', 'accent', 'background', 'surface', 'text', 'muted', 'radius', 'fontHeading', 'fontBody', 'mode']
const sameTheme = (a: SiteTheme, b: SiteTheme) => THEME_KEYS.every((k) => String(a[k]).toLowerCase() === String(b[k]).toLowerCase())

const COLOR_FIELDS: { key: keyof ThemeColors; label: string; hint: string }[] = [
  { key: 'primary', label: 'Primary', hint: 'Buttons, links and highlights' },
  { key: 'accent', label: 'Accent', hint: 'Secondary highlights — icons, turnaround dots' },
  { key: 'background', label: 'Background', hint: 'Page background' },
  { key: 'surface', label: 'Surface', hint: 'Cards and alternate bands' },
  { key: 'text', label: 'Text', hint: 'Headings and body copy' },
  { key: 'muted', label: 'Muted text', hint: 'Descriptions and captions' },
]

export default function ThemePage() {
  const { site, ctx, isLoading, isError, refetch } = useSiteRuntime()
  const [draft, setDraft] = useState<SiteTheme | null>(null)
  const [device, setDevice] = useState<DeviceId>('desktop')
  const [pageId, setPageId] = useState<string | null>(null)

  useEffect(() => {
    if (site && !draft) setDraft({ ...site.theme })
  }, [site, draft])

  const [savedSnap, setSavedSnap] = useState<SiteTheme | null>(null)
  const dirty = !!site && !!draft && !sameTheme(draft, site.theme) && !(savedSnap && sameTheme(draft, savedSnap))
  const invalidColors = draft ? COLOR_FIELDS.filter((f) => !isValidHex(draft[f.key])).length : 0

  const save = useInstMutation((t: SiteTheme) => websiteService.updateTheme(t))
  const doSave = () => {
    if (!draft || !dirty || save.isPending) return
    if (invalidColors) {
      toast.error('Fix invalid colors first', 'Colors must be hex values like #0e7c66.')
      return
    }
    if (!draft.siteName.trim()) {
      toast.error('Site name is required')
      return
    }
    save.mutate(
      { ...draft, siteName: draft.siteName.trim(), logoText: draft.logoText.trim() || draft.siteName.trim() },
      {
        onSuccess: (s) => {
          setDraft({ ...s.theme })
          setSavedSnap({ ...s.theme })
          toast.success('Theme saved', 'Your website now uses the new look.')
        },
      },
    )
  }
  const reset = () => site && setDraft({ ...site.theme })

  useSaveShortcut(doSave)
  useBeforeUnload(dirty)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)

  const patch = (p: Partial<SiteTheme>) => setDraft((d) => (d ? { ...d, ...p } : d))
  const match = draft ? matchPreset(draft) : null

  const setMode = (mode: SiteTheme['mode']) => {
    if (!draft || mode === draft.mode) return
    patch(match ? { mode, ...match.preset[mode] } : { mode, ...NEUTRALS[mode] })
  }

  const page = site ? (site.pages.find((p) => p.id === pageId) ?? site.pages.find((p) => p.isHome) ?? site.pages[0]) : undefined
  const sections = useMemo(() => (site && page ? resolvePageSections(site, page) : []), [site, page])

  return (
    <div className="pb-20">
      <PageHeader
        eyebrow={<WebsiteCrumb current="Theme" />}
        title="Theme"
        description="Your storefront’s own brand — colors, typography and shape. Every section reads these as CSS variables, so changes apply everywhere at once."
        actions={
          <>
            <Button variant="ghost" leading={<RotateCcw />} onClick={reset} disabled={!dirty}>
              Reset to saved
            </Button>
            <Tooltip content={`${modKey}+S`}>
              <Button variant="accent" leading={<Save />} onClick={doSave} disabled={!dirty || invalidColors > 0} loading={save.isPending}>
                Save theme
              </Button>
            </Tooltip>
          </>
        }
      />

      {isError ? (
        <Card>
          <EmptyState icon={<TriangleAlert />} title="Couldn’t load the theme" action={<Button onClick={() => refetch()}>Try again</Button>} />
        </Card>
      ) : isLoading || !site || !draft ? (
        <div className="grid gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
          <div className="space-y-5">
            <Skeleton className="h-[200px] w-full rounded-xl" />
            <Skeleton className="h-[240px] w-full rounded-xl" />
            <Skeleton className="h-[360px] w-full rounded-xl" />
          </div>
          <Skeleton className="h-[640px] w-full rounded-xl" />
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
          {/* Controls */}
          <div className="space-y-5">
            <Card>
              <CardHeader icon={<Type />} title="Brand" description="How your site introduces itself." />
              <div className="space-y-4 px-5 pb-5">
                <Field label="Site name" hint="Used for {{site.name}}, page titles and search listings.">
                  <Input value={draft.siteName} onChange={(e) => patch({ siteName: e.target.value })} invalid={!draft.siteName.trim()} />
                </Field>
                <Field label="Logo text" hint="Shown next to the mark in the header.">
                  <Input value={draft.logoText} onChange={(e) => patch({ logoText: e.target.value })} placeholder={draft.siteName} />
                </Field>
                <div className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5" style={{ background: draft.background }}>
                  <SiteMark name={draft.logoText || draft.siteName} primary={draft.primary} radius={draft.radius} font={draft.fontHeading} />
                  <span className="truncate text-[17px] font-semibold tracking-[-0.02em]" style={{ color: draft.text, fontFamily: fontStack(draft.fontHeading) }}>
                    {draft.logoText || draft.siteName || 'Your brand'}
                  </span>
                  <span className="ml-auto text-[11px]" style={{ color: draft.muted }}>
                    Header preview
                  </span>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader icon={<SwatchBook />} title="Presets" description="Curated palettes tuned for light and dark mode. Emerald is your brand palette." />
              <div className="grid grid-cols-2 gap-2.5 px-5 pb-5 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
                {THEME_PRESETS.map((p) => {
                  const colors = p[draft.mode]
                  const active = sameColors(colorsOf(draft), colors)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => patch({ ...colors })}
                      className={cn('group rounded-xl border p-1.5 text-left transition-[border-color,box-shadow] duration-200', active ? 'border-accent/60 shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_16%,transparent)]' : 'border-line hover:border-line-strong')}
                    >
                      <PresetSwatch colors={colors} radius={draft.radius} />
                      <div className="flex items-center justify-between px-1 pt-2 pb-0.5">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-[12.5px] font-medium text-fg">{p.name}</span>
                          {p.id === DEFAULT_PRESET.id && <span className="rounded border border-line-strong px-1 font-mono text-[9px] leading-[14px] font-semibold tracking-wide text-fg-3 uppercase">Brand</span>}
                        </span>
                        {active && <Check className="size-3.5 shrink-0 text-accent-ink" />}
                      </div>
                      <p className="truncate px-1 text-[11px] text-fg-3">{p.description}</p>
                    </button>
                  )
                })}
              </div>
            </Card>

            <Card>
              <CardHeader icon={<Palette />} title="Colors" description="Click a swatch to pick, or type a hex value." actions={match ? <Badge dot>{match.preset.name}</Badge> : <Badge variant="outline">Custom</Badge>} />
              <div className="space-y-3 px-5 pb-4">
                {COLOR_FIELDS.map((f) => (
                  <ColorRow key={f.key} label={f.label} hint={f.hint} value={draft[f.key]} onChange={(v) => patch({ [f.key]: v } as Partial<SiteTheme>)} />
                ))}
              </div>
              <ContrastChecks theme={draft} />
            </Card>

            <Card>
              <CardHeader icon={<CaseSensitive />} title="Typography & shape" description="Fonts are bundled with ORVEX Core — no external requests." />
              <div className="space-y-5 px-5 pb-5">
                <Field label="Mode" hint="Switching mode swaps in matching background and text colors.">
                  <Segmented
                    size="sm"
                    value={draft.mode}
                    onChange={setMode}
                    items={[
                      { value: 'light', label: 'Light', icon: <Sun /> },
                      { value: 'dark', label: 'Dark', icon: <Moon /> },
                    ]}
                  />
                </Field>
                <FontField label="Heading font" value={draft.fontHeading} onChange={(v) => patch({ fontHeading: v })} sample={<span className="text-[22px] leading-tight font-semibold tracking-[-0.025em]">Unlocked in hours.</span>} />
                <FontField label="Body font" value={draft.fontBody} onChange={(v) => patch({ fontBody: v })} sample={<span className="text-[13.5px] leading-relaxed">IMEI checks, network unlocks and unlock codes — with a clean-IMEI guarantee and money back if it fails.</span>} />
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[12.5px] font-medium text-fg">Corner radius</span>
                    <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11.5px] text-fg-2 tabular">{draft.radius}px</span>
                  </div>
                  <input type="range" min={0} max={24} step={1} value={draft.radius} onChange={(e) => patch({ radius: Number(e.target.value) })} className="w-full cursor-pointer [accent-color:var(--accent)]" aria-label="Corner radius" />
                  <div className="mt-3 flex items-center gap-3">
                    <span className="inline-flex h-9 items-center px-4 text-[12.5px] font-semibold" style={{ borderRadius: draft.radius, background: draft.primary, color: onColor(draft.primary) }}>
                      Button
                    </span>
                    <span className="h-9 flex-1 border" style={{ borderRadius: draft.radius * 1.2, background: draft.surface, borderColor: `color-mix(in srgb, ${draft.text} 10%, transparent)` }} />
                    <span className="size-9 border" style={{ borderRadius: draft.radius * 0.9, background: `color-mix(in srgb, ${draft.primary} 12%, ${draft.background})`, borderColor: `color-mix(in srgb, ${draft.primary} 25%, transparent)` }} />
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Preview */}
          <div className="xl:sticky xl:top-[76px] xl:self-start">
            <Card className="flex h-[620px] flex-col overflow-hidden xl:h-[calc(100dvh-108px)] xl:min-h-[560px]">
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
                <div className="min-w-0">
                  <h3 className="text-[14px] font-semibold tracking-[-0.01em]">Live preview</h3>
                  <motion.p key={dirty ? 'd' : 's'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cn('text-[12px]', dirty ? 'text-warning' : 'text-fg-3')}>
                    {dirty ? 'Showing unsaved changes' : 'Matches your live site'}
                  </motion.p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Select inputSize="sm" className="w-[150px]" value={page?.id ?? ''} onChange={(e) => setPageId(e.target.value)} options={site.pages.map((p) => ({ value: p.id, label: p.title }))} aria-label="Preview page" />
                  <DeviceToggle value={device} onChange={setDevice} />
                </div>
              </div>
              <div className="relative min-h-0 flex-1 bg-dots">
                {page && (
                  <DevicePreview device={device} path={page.slug} padding={16}>
                    <SiteCanvas
                      theme={draft}
                      nav={site.nav}
                      sections={sections}
                      ctx={ctx}
                      activePath={page.slug}
                      banner={page.status === 'draft' ? 'Draft preview — this page isn’t published yet.' : null}
                      onNavigate={(href) => {
                        const target = findPageBySlug(site, splitHref(href).path || '/')
                        if (target) setPageId(target.id)
                      }}
                      style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}
                    />
                  </DevicePreview>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      <UnsavedBar show={dirty} onDiscard={reset} onSave={doSave} saving={save.isPending} disabled={invalidColors > 0} hint="Theme changes apply to every page" />

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
        title="Leave without saving?"
        description="Your theme changes haven’t been saved and will be lost."
        confirmLabel="Discard & leave"
        tone="danger"
      />
    </div>
  )
}

/* ============================================================================
 * Pieces
 * ========================================================================= */
function PresetSwatch({ colors, radius }: { colors: ThemeColors; radius: number }) {
  return (
    <div className="relative h-[68px] overflow-hidden rounded-lg ring-1 ring-black/5" style={{ background: colors.background }}>
      <div className="flex items-center gap-1.5 px-2 pt-2">
        <span className="size-2.5 rounded-[3px]" style={{ background: colors.primary }} />
        <span className="h-1.5 w-8 rounded-full" style={{ background: colors.text, opacity: 0.85 }} />
        <span className="ml-auto h-2.5 w-6" style={{ background: colors.primary, borderRadius: Math.min(6, radius / 2) }} />
      </div>
      <div className="mt-2 space-y-1 px-2">
        <span className="block h-1.5 w-16 rounded-full" style={{ background: colors.text }} />
        <span className="block h-1 w-12 rounded-full" style={{ background: colors.muted }} />
      </div>
      <div className="absolute right-2 bottom-2 left-2 flex gap-1">
        <span className="h-3 flex-1 rounded-[3px]" style={{ background: colors.surface, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${colors.text} 10%, transparent)` }} />
        <span className="size-3 rounded-full" style={{ background: colors.accent }} />
      </div>
    </div>
  )
}

/** Mirrors the site header mark (renderSite.ts): initial on primary with a small tinted node. */
function SiteMark({ name, primary, radius, font }: { name: string; primary: string; radius: number; font: string }) {
  const valid = isValidHex(primary)
  const fg = valid ? onColor(primary) : '#ffffff'
  return (
    <span
      className="relative grid size-[30px] shrink-0 place-items-center text-[14px] leading-none font-bold shadow-[inset_0_1px_0_rgb(255_255_255/0.2)]"
      style={{ background: valid ? primary : 'var(--surface-3)', color: fg, borderRadius: Math.max(4, radius * 0.8), fontFamily: fontStack(font) }}
      aria-hidden
    >
      {Array.from(name.trim())[0]?.toUpperCase() ?? 'S'}
      <span className="absolute right-[18%] bottom-[18%] size-[15%] rounded-full" style={{ background: `color-mix(in srgb, ${fg} 55%, ${valid ? primary : 'transparent'})` }} />
    </span>
  )
}

function toHex6(v: string) {
  const h = v.trim()
  if (/^#[0-9a-f]{3}$/i.test(h)) return `#${h.slice(1).split('').map((c) => c + c).join('')}`.toLowerCase()
  return isValidHex(h) ? h.toLowerCase() : '#000000'
}

function ColorRow({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  const valid = isValidHex(text)
  return (
    <div className="flex items-center gap-3">
      <label className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-lg shadow-card ring-1 ring-line-strong transition-transform hover:scale-105" style={{ background: isValidHex(value) ? value : 'transparent' }}>
        <input type="color" value={toHex6(value)} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" aria-label={`${label} color`} />
      </label>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-fg">{label}</div>
        <div className="truncate text-[11.5px] text-fg-3">{hint}</div>
      </div>
      <Input
        inputSize="sm"
        mono
        value={text}
        invalid={!valid}
        onChange={(e) => {
          let v = e.target.value.trim()
          if (v && !v.startsWith('#')) v = `#${v}`
          setText(v)
          if (isValidHex(v)) onChange(v.toLowerCase())
        }}
        onBlur={() => !valid && setText(value)}
        className="w-[104px]"
        aria-label={`${label} hex value`}
      />
    </div>
  )
}

function grade(ratio: number): { label: string; tone: 'success' | 'warning' | 'danger' } {
  if (ratio >= 7) return { label: 'AAA', tone: 'success' }
  if (ratio >= 4.5) return { label: 'AA', tone: 'success' }
  if (ratio >= 3) return { label: 'AA large', tone: 'warning' }
  return { label: 'Low', tone: 'danger' }
}

function ContrastChecks({ theme }: { theme: SiteTheme }) {
  if (![theme.text, theme.background, theme.muted, theme.primary, theme.surface].every(isValidHex)) return null
  const rows = [
    { label: 'Text on background', fg: theme.text, bg: theme.background },
    { label: 'Muted text on background', fg: theme.muted, bg: theme.background },
    { label: 'Text on surface', fg: theme.text, bg: theme.surface },
    { label: 'Button label on primary', fg: onColor(theme.primary), bg: theme.primary },
  ]
  return (
    <div className="border-t border-line px-5 py-4">
      <div className="mb-2.5 mono-label">Accessibility · WCAG contrast</div>
      <div className="space-y-2">
        {rows.map((r) => {
          const ratio = contrastRatio(r.fg, r.bg)
          const g = grade(ratio)
          return (
            <div key={r.label} className="flex items-center gap-3">
              <span className="grid h-6 w-9 shrink-0 place-items-center rounded-md text-[11px] font-semibold ring-1 ring-line" style={{ background: r.bg, color: r.fg }}>
                Aa
              </span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg-2">{r.label}</span>
              <span className="font-mono text-[11.5px] text-fg-3 tabular">{ratio.toFixed(1)}:1</span>
              <Badge tone={g.tone} className="w-[64px] justify-center">
                {g.label}
              </Badge>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FontField({ label, value, onChange, sample }: { label: string; value: string; onChange: (v: string) => void; sample: ReactNode }) {
  return (
    <div>
      <Field label={label}>
        <Select value={value} onChange={(e) => onChange(e.target.value)} options={FONT_OPTIONS.map((f) => ({ value: f.value, label: `${f.label} — ${f.kind}` }))} />
      </Field>
      <div className="mt-2 rounded-lg border border-line bg-surface-2/60 px-3 py-2.5 text-fg" style={{ fontFamily: fontStack(value) }}>
        {sample}
      </div>
    </div>
  )
}
