/**
 * Shared building blocks for the Website area of the installation admin.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import {
  Boxes,
  ChartColumn,
  ChevronRight,
  CircleQuestionMark,
  CodeXml,
  Layers,
  LayoutGrid,
  Lock,
  Monitor,
  MousePointerClick,
  PanelBottom,
  Quote,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tablet,
  type LucideIcon,
} from 'lucide-react'
import { Button, Segmented, Tooltip } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { SectionType, SiteConfig, SitePage, SiteSection } from '@/types/installation'

/* ----------------------------------------------------------------------------
 * Hooks
 * ------------------------------------------------------------------------- */
/** Element size via ResizeObserver; works with conditionally mounted elements. */
export function useElementSize<T extends HTMLElement = HTMLDivElement>() {
  const [el, setEl] = useState<T | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    if (!el) return
    const update = () => setSize((s) => (s.width === el.clientWidth && s.height === el.clientHeight ? s : { width: el.clientWidth, height: el.clientHeight }))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])
  return [setEl, size] as const
}

export function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/** Warn before closing the tab with unsaved work. */
export function useBeforeUnload(active: boolean) {
  useEffect(() => {
    if (!active) return
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [active])
}

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)
export const modKey = isMac ? '⌘' : 'Ctrl'

/* ----------------------------------------------------------------------------
 * Devices & preview frame
 * ------------------------------------------------------------------------- */
export type DeviceId = 'desktop' | 'tablet' | 'mobile'

export const DEVICES: Record<DeviceId, { width: number; label: string; icon: LucideIcon }> = {
  desktop: { width: 1280, label: 'Desktop', icon: Monitor },
  tablet: { width: 768, label: 'Tablet', icon: Tablet },
  mobile: { width: 390, label: 'Mobile', icon: Smartphone },
}

export function DeviceToggle({ value, onChange, devices = ['desktop', 'tablet', 'mobile'], size = 'xs' }: { value: DeviceId; onChange: (d: DeviceId) => void; devices?: DeviceId[]; size?: 'xs' | 'sm' }) {
  return (
    <Segmented
      size={size}
      value={value}
      onChange={onChange}
      items={devices.map((d) => {
        const Icon = DEVICES[d].icon
        return {
          value: d,
          label: (
            <span className="flex items-center gap-1.5" title={`${DEVICES[d].label} · ${DEVICES[d].width}px`}>
              <Icon />
              <span className="hidden tabular 2xl:inline">{DEVICES[d].width}</span>
            </span>
          ),
        }
      })}
    />
  )
}

const SPRING = { type: 'spring' as const, stiffness: 240, damping: 32, mass: 0.9 }

/**
 * Renders children at a real device width and scales the result to fit the
 * available space (smoothly animated when the device changes).
 */
export function DevicePreview({
  device,
  path = '/',
  domain = 'portal.unlockdesk-demo.com',
  children,
  scroll = true,
  chromeBar = true,
  interactive = true,
  padding = 0,
  maxScale = 1,
  className,
  frameClassName,
  onScale,
}: {
  device: DeviceId
  path?: string
  domain?: string
  children: ReactNode
  scroll?: boolean
  chromeBar?: boolean
  interactive?: boolean
  padding?: number
  maxScale?: number
  className?: string
  frameClassName?: string
  onScale?: (scale: number) => void
}) {
  const [ref, size] = useElementSize<HTMLDivElement>()
  const W = DEVICES[device].width
  const barH = chromeBar ? 34 : 0
  const availW = Math.max(0, size.width - padding * 2)
  const s = availW > 0 ? Math.min(maxScale, availW / W) : 0
  const frameW = W * s
  const frameH = Math.max(0, size.height - padding * 2)
  const innerH = Math.max(0, frameH - barH)

  useEffect(() => {
    if (s > 0) onScale?.(s)
  }, [s, onScale])

  return (
    <div ref={ref} className={cn('relative h-full w-full overflow-hidden', className)}>
      {s > 0 && (
        <motion.div
          className={cn('absolute flex flex-col overflow-hidden border border-line-strong bg-surface shadow-pop', device === 'mobile' ? 'rounded-[20px]' : 'rounded-xl', frameClassName)}
          initial={false}
          animate={{ width: frameW, left: (size.width - frameW) / 2, top: padding, height: frameH }}
          transition={SPRING}
        >
          {chromeBar && <BrowserBar domain={domain} path={path} width={W} compact={frameW < 520} />}
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <motion.div
              className={cn('absolute top-0 left-0 overscroll-contain', scroll ? 'no-scrollbar overflow-y-auto' : 'overflow-hidden', !interactive && 'pointer-events-none select-none')}
              initial={false}
              animate={{ width: W, scale: s }}
              style={{ height: innerH / s, originX: 0, originY: 0 }}
              transition={SPRING}
              aria-hidden={!interactive || undefined}
            >
              {children}
            </motion.div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

function BrowserBar({ domain, path, width, compact }: { domain: string; path: string; width: number; compact: boolean }) {
  return (
    <div className="flex h-[34px] shrink-0 items-center gap-3 border-b border-line bg-surface-2 px-3">
      <div className="flex shrink-0 gap-1.5" aria-hidden>
        <span className="size-2.5 rounded-full bg-fg/15" />
        <span className="size-2.5 rounded-full bg-fg/15" />
        <span className="size-2.5 rounded-full bg-fg/15" />
      </div>
      <div className="mx-auto flex h-[22px] max-w-[440px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md bg-surface px-2.5 text-[11px] text-fg-3 ring-1 ring-line">
        <Lock className="size-3 shrink-0" />
        <span className="truncate font-mono">
          {compact ? '' : domain}
          <span className="text-fg-2">{compact ? path : path === '/' ? '' : path}</span>
        </span>
      </div>
      {!compact && <span className="shrink-0 font-mono text-[10.5px] text-fg-3 tabular">{width}px</span>}
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Section types
 * ------------------------------------------------------------------------- */
/**
 * Section type metadata. Tints come from the muted chart palette (sage, ochre,
 * mauve, stone, graphite) — coral is reserved for actions and selection.
 */
export const SECTION_TYPES: Record<SectionType, { label: string; icon: LucideIcon; color: string }> = {
  hero: { label: 'Hero', icon: Sparkles, color: 'var(--c5)' },
  stats: { label: 'Stats', icon: ChartColumn, color: 'var(--c2)' },
  features: { label: 'Features', icon: LayoutGrid, color: 'var(--c3)' },
  services: { label: 'Services', icon: Boxes, color: 'var(--c4)' },
  testimonials: { label: 'Testimonials', icon: Quote, color: 'var(--c5)' },
  faq: { label: 'FAQ', icon: CircleQuestionMark, color: 'var(--c2)' },
  cta: { label: 'Call to action', icon: MousePointerClick, color: 'var(--c4)' },
  footer: { label: 'Footer', icon: PanelBottom, color: 'var(--c6)' },
  custom: { label: 'Custom', icon: CodeXml, color: 'var(--c6)' },
}

/** Small mono chip marking a section with sandboxed JavaScript enabled. */
export function JsChip({ className }: { className?: string }) {
  return (
    <span className={cn('shrink-0 rounded border border-line-strong bg-surface-2 px-1 font-mono text-[9.5px] leading-4 font-semibold text-fg-2', className)} title="Sandboxed JavaScript">
      JS
    </span>
  )
}

export const SECTION_TYPE_ORDER: SectionType[] = ['hero', 'stats', 'features', 'services', 'testimonials', 'faq', 'cta', 'footer', 'custom']

export function SectionTypeIcon({ type, size = 'md', className }: { type: SectionType; size?: 'xs' | 'sm' | 'md'; className?: string }) {
  const meta = SECTION_TYPES[type] ?? SECTION_TYPES.custom
  const Icon = meta.icon
  const s = size === 'xs' ? 'size-5 rounded-[5px] [&_svg]:size-3' : size === 'sm' ? 'size-7 rounded-md [&_svg]:size-3.5' : 'size-8 rounded-lg [&_svg]:size-4'
  return (
    <span
      className={cn('inline-grid shrink-0 place-items-center', s, className)}
      style={{ color: meta.color, background: `color-mix(in oklab, ${meta.color} 12%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${meta.color} 24%, transparent)` }}
      aria-hidden
    >
      <Icon />
    </span>
  )
}

/** Library order: by type, then by creation order. */
export function sortSections(sections: SiteSection[]) {
  return sections
    .map((s, i) => ({ s, i }))
    .sort((a, b) => SECTION_TYPE_ORDER.indexOf(a.s.type) - SECTION_TYPE_ORDER.indexOf(b.s.type) || a.i - b.i)
    .map((x) => x.s)
}

/** sectionId → pages that include it. */
export function sectionUsage(site: Pick<SiteConfig, 'pages'>) {
  const map = new Map<string, SitePage[]>()
  for (const p of site.pages) for (const id of p.sectionIds) map.set(id, [...(map.get(id) ?? []), p])
  return map
}

/** Content edited since the last publish. */
export function pendingChanges(site: SiteConfig) {
  const since = new Date(site.publishedAt).getTime()
  const sections = site.sections.filter((s) => new Date(s.updatedAt).getTime() > since)
  const pages = site.pages.filter((p) => new Date(p.updatedAt).getTime() > since)
  return { sections, pages, total: sections.length + pages.length }
}

export function slugify(title: string) {
  const s = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
  return `/${s}`
}

export function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

/* ----------------------------------------------------------------------------
 * Security model explainer
 * ------------------------------------------------------------------------- */
const SECURITY_POINTS = [
  { icon: ShieldCheck, title: 'Sanitized HTML', body: 'DOMPurify removes <script>, iframes, inline event handlers (onclick…) and javascript: links before anything renders.' },
  { icon: Layers, title: 'Isolated styles', body: 'Every section renders in its own Shadow DOM root — its CSS can’t leak into other sections, the site header or this admin.' },
  { icon: Lock, title: 'Sandboxed JavaScript', body: 'Custom JS runs only when enabled per section, inside an iframe with sandbox="allow-scripts" — never allow-same-origin, so it can’t read cookies, storage or the page.' },
]

export function SecurityModel({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn(compact ? 'space-y-3' : 'grid gap-4 md:grid-cols-3', className)}>
      {SECURITY_POINTS.map((p) => (
        <div key={p.title} className="flex gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-success/10 text-success ring-1 ring-success/20 ring-inset [&_svg]:size-4">
            <p.icon />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-fg">{p.title}</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-fg-3">{p.body}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Layout helpers
 * ------------------------------------------------------------------------- */
export function WebsiteCrumb({ current }: { current: string }) {
  return (
    <>
      <Link to="/admin/website" className="transition-colors hover:text-fg">
        Website
      </Link>
      <ChevronRight className="size-3.5 text-fg-3/60" />
      <span className="text-fg-2">{current}</span>
    </>
  )
}

/** Floating “unsaved changes” bar for form-style editors. */
export function UnsavedBar({ show, onDiscard, onSave, saving, label = 'You have unsaved changes', disabled, hint }: { show: boolean; onDiscard: () => void; onSave: () => void; saving?: boolean; label?: string; disabled?: boolean; hint?: ReactNode }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          className="fixed inset-x-3 bottom-[64px] z-40 mx-auto flex max-w-[560px] items-center gap-3 rounded-xl border border-line-strong bg-surface/95 py-2 pr-2 pl-4 shadow-pop backdrop-blur lg:bottom-6"
          role="status"
        >
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-warning" />
            <span className="relative size-2 rounded-full bg-warning" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-fg">{label}</p>
            {hint && <p className="truncate text-[11.5px] text-fg-3">{hint}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={onDiscard}>
            Discard
          </Button>
          <Tooltip content={`${modKey}+S`}>
            <Button variant="accent" size="sm" onClick={onSave} loading={saving} disabled={disabled}>
              Save changes
            </Button>
          </Tooltip>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Ctrl/⌘+S handler bound to the latest callback. */
export function useSaveShortcut(handler: () => void, enabled = true) {
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })
  useEffect(() => {
    if (!enabled) return
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        ref.current()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [enabled, ref])
}
