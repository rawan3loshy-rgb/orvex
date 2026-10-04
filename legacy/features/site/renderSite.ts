/**
 * Shared website renderer — pure helpers.
 *
 * Used by BOTH the admin previews (Website → Sections / Pages / Theme / Navigation)
 * and the public site (/site/*) so that what an editor sees is exactly what a
 * visitor gets.
 *
 * Security model
 * ──────────────
 * 1. Section HTML is sanitized with DOMPurify: <script>, <iframe>, <object>,
 *    inline event handlers (onclick=…) and javascript: URLs are removed.
 * 2. Each section renders inside its own Shadow DOM root, so its CSS can't leak
 *    into other sections, the site chrome, or the admin app.
 * 3. Custom JavaScript only runs when a section explicitly enables it, and then
 *    only inside an <iframe sandbox="allow-scripts"> (never allow-same-origin):
 *    it gets an opaque origin with no access to cookies, storage or the parent DOM.
 */
import DOMPurify from 'dompurify'
import type { SiteNavItem, SiteSection, SiteTheme } from '@/types/installation'

/* ----------------------------------------------------------------------------
 * Render context
 * ------------------------------------------------------------------------- */
export interface CatalogService {
  id: string
  name: string
  category: string
  description: string
  price: number
  delivery: 'instant' | 'async' | 'manual'
  /** Expected turnaround in seconds (from the catalog). */
  turnaround?: { min: number; max: number }
}

export interface SiteRenderContext {
  siteName: string
  year: number
  stats: { orders: string; uptime: string; services: string }
  services: CatalogService[]
  footerNav: SiteNavItem[]
}

/* ----------------------------------------------------------------------------
 * Template variables & dynamic blocks (documented in the admin UI)
 * ------------------------------------------------------------------------- */
export interface TemplateVariable {
  key: string
  token: string
  label: string
  description: string
  resolve: (ctx: SiteRenderContext) => string
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { key: 'site.name', token: '{{site.name}}', label: 'Site name', description: 'Brand name from Theme settings', resolve: (c) => c.siteName },
  { key: 'stats.orders', token: '{{stats.orders}}', label: 'Orders processed', description: 'Orders handled in the last 30 days', resolve: (c) => c.stats.orders },
  { key: 'stats.uptime', token: '{{stats.uptime}}', label: 'API uptime', description: 'Rolling 30-day availability from Health', resolve: (c) => c.stats.uptime },
  { key: 'stats.services', token: '{{stats.services}}', label: 'Live services', description: 'Active services visible on the website', resolve: (c) => c.stats.services },
  { key: 'year', token: '{{year}}', label: 'Current year', description: 'Useful for copyright lines', resolve: (c) => String(c.year) },
]

const VAR_BY_KEY = new Map(TEMPLATE_VARIABLES.map((v) => [v.key, v]))

export interface DynamicBlock {
  id: string
  label: string
  description: string
  snippet: string
}

export const DYNAMIC_BLOCKS: DynamicBlock[] = [
  {
    id: 'service-catalog',
    label: 'Service catalog',
    description: 'Live service cards (name, category, description, “from $X”, turnaround) from your catalog — active services marked visible on the website.',
    snippet: '<div data-block="service-catalog" data-limit="6"></div>',
  },
  {
    id: 'footer-links',
    label: 'Footer links',
    description: 'The footer links managed in Website → Navigation.',
    snippet: '<nav data-block="footer-links"></nav>',
  },
]

/* ----------------------------------------------------------------------------
 * Escaping helpers
 * ------------------------------------------------------------------------- */
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ESC[c]!)
}

/** Only allow navigational URL schemes in generated markup. */
export function safeHref(href: string) {
  const h = href.trim()
  if (/^(https?:|mailto:|tel:)/i.test(h) || h.startsWith('/') || h.startsWith('#')) return h
  return '#'
}

export function isExternalHref(href: string) {
  return /^(https?:|mailto:|tel:)/i.test(href.trim()) || href.trim().startsWith('//')
}

/** Split "/path#hash" into its parts (path defaults to "" for pure anchors). */
export function splitHref(href: string): { path: string; hash: string } {
  const i = href.indexOf('#')
  if (i === -1) return { path: href, hash: '' }
  return { path: href.slice(0, i), hash: href.slice(i + 1) }
}

/** Normalise a site path: leading slash, no trailing slash (except root). */
export function normalizePath(p: string) {
  let s = (p || '/').split('?')[0]!.split('#')[0]!
  if (!s.startsWith('/')) s = `/${s}`
  if (s.length > 1) s = s.replace(/\/+$/, '')
  return s || '/'
}

/* ----------------------------------------------------------------------------
 * Theme → CSS variables
 * ------------------------------------------------------------------------- */
export const FONT_OPTIONS = [
  { value: 'Instrument Sans Variable', label: 'Instrument Sans', kind: 'Display sans' },
  { value: 'Inter Variable', label: 'Inter', kind: 'Neutral sans' },
  { value: 'Archivo Variable', label: 'Archivo', kind: 'Grotesque' },
  { value: 'Geist Variable', label: 'Geist', kind: 'Technical sans' },
  { value: 'JetBrains Mono Variable', label: 'JetBrains Mono', kind: 'Monospace' },
  { value: 'system-ui', label: 'System UI', kind: 'Native sans' },
  { value: 'Georgia', label: 'Georgia', kind: 'Serif' },
] as const

export function fontStack(name: string) {
  switch (name) {
    case 'Instrument Sans Variable':
      return '"Instrument Sans Variable", "Inter Variable", ui-sans-serif, system-ui, sans-serif'
    case 'Inter Variable':
      return '"Inter Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
    case 'Archivo Variable':
      return '"Archivo Variable", "Inter Variable", ui-sans-serif, system-ui, sans-serif'
    case 'Geist Variable':
      return '"Geist Variable", "Inter Variable", ui-sans-serif, system-ui, sans-serif'
    case 'JetBrains Mono Variable':
      return '"JetBrains Mono Variable", ui-monospace, SFMono-Regular, Menlo, monospace'
    case 'Georgia':
      return 'Georgia, Cambria, "Times New Roman", serif'
    case 'system-ui':
      return 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif'
    default:
      return `"${name.replace(/"/g, '')}", ui-sans-serif, system-ui, sans-serif`
  }
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().replace('#', '')
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  if (!/^[0-9a-f]{6}$/i.test(full)) return null
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)]
}

export function relativeLuminance(hex: string) {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string) {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

export function isValidHex(hex: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex.trim())
}

/** Readable foreground on top of the primary colour (white or a warm near-black). */
const ON_DARK_INK = '#151614'
export function onColor(hex: string) {
  return contrastRatio(hex, '#ffffff') >= contrastRatio(hex, ON_DARK_INK) ? '#ffffff' : ON_DARK_INK
}

export function themeVars(theme: SiteTheme): Record<string, string> {
  return {
    '--site-primary': theme.primary,
    '--site-accent': theme.accent,
    '--site-bg': theme.background,
    '--site-surface': theme.surface,
    '--site-text': theme.text,
    '--site-muted': theme.muted,
    '--site-radius': `${Math.max(0, Math.min(32, Number(theme.radius) || 0))}px`,
    '--site-font-heading': fontStack(theme.fontHeading),
    '--site-font-body': fontStack(theme.fontBody),
    '--site-on-primary': onColor(theme.primary),
  }
}

export function themeDeclarations(theme: SiteTheme) {
  return Object.entries(themeVars(theme))
    .map(([k, v]) => `${k}: ${v.replace(/[;{}<>]/g, '')};`)
    .join(' ')
}

/** Every CSS variable exposed to sections, for the admin reference panel. */
export const THEME_VARIABLES = [
  { name: '--site-primary', hint: 'Brand colour — buttons, links' },
  { name: '--site-accent', hint: 'Secondary highlight (icons, speed dots)' },
  { name: '--site-bg', hint: 'Page background' },
  { name: '--site-surface', hint: 'Cards & alternate bands' },
  { name: '--site-text', hint: 'Primary text' },
  { name: '--site-muted', hint: 'Secondary text' },
  { name: '--site-radius', hint: 'Corner radius (px)' },
  { name: '--site-font-heading', hint: 'Heading font stack' },
  { name: '--site-font-body', hint: 'Body font stack' },
  { name: '--site-on-primary', hint: 'Readable text on primary' },
]

/* ----------------------------------------------------------------------------
 * Template interpolation
 * ------------------------------------------------------------------------- */
const VAR_RE = /\{\{\s*([a-z][a-z0-9_.]*)\s*\}\}/gi

export function interpolate(src: string, ctx: SiteRenderContext) {
  return src.replace(VAR_RE, (m, key: string) => {
    const v = VAR_BY_KEY.get(key.toLowerCase())
    return v ? escapeHtml(v.resolve(ctx)) : m
  })
}

/** Values a section depends on — used to skip re-rendering unaffected sections. */
export function sectionDependencies(section: Pick<SiteSection, 'html'>, ctx: SiteRenderContext) {
  const parts: string[] = []
  const seen = new Set<string>()
  for (const m of section.html.matchAll(VAR_RE)) {
    const key = m[1]!.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const v = VAR_BY_KEY.get(key)
    if (v) parts.push(`${key}=${v.resolve(ctx)}`)
  }
  if (section.html.includes('service-catalog')) parts.push(`svc=${servicesSignature(ctx.services)}`)
  if (section.html.includes('footer-links')) parts.push(`fnav=${ctx.footerNav.map((n) => `${n.label}|${n.href}`).join(',')}`)
  return parts.join(';')
}

const svcSigCache = new WeakMap<CatalogService[], string>()
function servicesSignature(list: CatalogService[]) {
  let s = svcSigCache.get(list)
  if (!s) {
    s = list.map((x) => `${x.id}:${x.price}:${x.name}:${x.category}:${x.delivery}:${x.turnaround?.min ?? ''}-${x.turnaround?.max ?? ''}`).join(',')
    svcSigCache.set(list, s)
  }
  return s
}

/* ----------------------------------------------------------------------------
 * Sanitization
 * ------------------------------------------------------------------------- */
let purifier: ReturnType<typeof DOMPurify> | null = null
function getPurifier() {
  if (!purifier) {
    // Private instance: hooks here never affect other DOMPurify users in the app.
    purifier = DOMPurify(window)
    purifier.addHook('afterSanitizeAttributes', (node) => {
      if (node instanceof Element && node.tagName === 'A' && node.getAttribute('target') === '_blank') {
        node.setAttribute('rel', 'noopener noreferrer')
      }
    })
  }
  return purifier
}

const PURIFY_CONFIG = {
  // <style> belongs in the CSS tab, where it is sanitized and scoped.
  FORBID_TAGS: ['script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'base', 'meta', 'link', 'noscript', 'portal'],
  FORBID_ATTR: ['srcdoc', 'formaction', 'ping'],
  ADD_ATTR: ['target'],
  ALLOW_DATA_ATTR: true,
}

/** Sanitize section HTML into a DOM fragment (no scripts, no inline handlers). */
export function sanitizeToFragment(html: string): DocumentFragment {
  return getPurifier().sanitize(html, { ...PURIFY_CONFIG, RETURN_DOM_FRAGMENT: true })
}

/** Sanitize an HTML string (used for diagnostics and the <head> preview). */
export function sanitizeToString(html: string) {
  return getPurifier().sanitize(html, PURIFY_CONFIG)
}

/** Count what the sanitizer would strip — surfaced as a hint in the editor. */
export function sanitizeReport(html: string) {
  const p = getPurifier()
  p.sanitize(html, PURIFY_CONFIG)
  const removed = p.removed ?? []
  let elements = 0
  let attributes = 0
  for (const r of removed) {
    if ('element' in r) elements++
    else attributes++
  }
  return { elements, attributes, total: elements + attributes }
}

/** CSS can't execute scripts, but strip remote imports and legacy script vectors. */
export function sanitizeCss(css: string) {
  return css
    .replace(/@import[^;]*;?/gi, '/* @import is not allowed */')
    .replace(/expression\s*\(/gi, 'blocked(')
    .replace(/javascript\s*:/gi, 'blocked:')
    .replace(/behavior\s*:/gi, 'blocked:')
    .replace(/-moz-binding/gi, 'blocked')
    .replace(/<\/style/gi, '<\\/style')
}

/**
 * Width-based @media queries are rewritten to container queries (and vw → cqi)
 * so device-width previews behave exactly like a real viewport of that width.
 */
export function adaptResponsiveCss(css: string) {
  return css
    .replace(/@media\s+([^{]+)\{/gi, (m, cond: string) => {
      const stripped = cond.trim().replace(/^(only\s+)?screen\s+and\s+/i, '')
      if (/^(\(\s*(min|max)-width\s*:\s*[\d.]+\s*(px|em|rem)\s*\)\s*(and\s+)?)+$/i.test(stripped)) return `@container ${stripped} {`
      return m
    })
    .replace(/(\d*\.?\d+)vw\b/g, '$1cqi')
}

/* ----------------------------------------------------------------------------
 * Dynamic blocks
 * ------------------------------------------------------------------------- */
/** Icons for the GSM service categories (keys match the catalog category, case-insensitive). */
const CATEGORY_ICONS: Record<string, string> = {
  'imei services': '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M8 7v10"/><path d="M12 7v10"/><path d="M16 7v10"/>',
  unlocking: '<rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 7.7-1.6"/>',
  'server services': '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  codes: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3"/><path d="m16 7 3 3"/><path d="m19 4 2 2"/>',
  'other services': '<path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 4v16"/>',
}

function categoryIcon(category: string) {
  const body = CATEGORY_ICONS[category.toLowerCase()] ?? '<rect x="5" y="2" width="14" height="20" rx="2.5"/><path d="M11 18h2"/>'
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`
}

const priceFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
const DELIVERY_LABEL: Record<CatalogService['delivery'], string> = { instant: 'Instant', async: 'Minutes', manual: 'Reviewed' }

/** Compact duration for a turnaround bound: 45 s · 10 min · 6 h · 2 d. */
function shortDuration(sec: number) {
  if (sec < 60) return { v: Math.max(1, Math.round(sec)), u: 's' }
  if (sec < 3600) return { v: Math.round(sec / 60), u: 'min' }
  if (sec < 86_400) return { v: Math.round((sec / 3600) * 2) / 2, u: 'h' }
  return { v: Math.round(sec / 86_400), u: 'd' }
}

/** “Instant”, “10 min – 2 h”, “1–6 h” … from the service's expected turnaround. */
export function turnaroundLabel(s: Pick<CatalogService, 'delivery' | 'turnaround'>) {
  const t = s.turnaround
  if (!t) return DELIVERY_LABEL[s.delivery]
  if (s.delivery === 'instant' || t.max <= 60) return 'Instant'
  const a = shortDuration(t.min)
  const b = shortDuration(t.max)
  if (a.u === b.u) return a.v === b.v ? `~${b.v} ${b.u}` : `${a.v}–${b.v} ${b.u}`
  return `${a.v} ${a.u} – ${b.v} ${b.u}`
}

export function buildCatalogHtml(services: CatalogService[], opts: { limit?: number; category?: string | null }) {
  const limit = Math.max(1, Math.min(60, opts.limit ?? 9))
  const list = services.filter((s) => !opts.category || s.category.toLowerCase() === opts.category.toLowerCase()).slice(0, limit)
  if (!list.length) {
    return '<div class="sv-empty"><strong>No services to show yet</strong><span>Services marked “Visible on website” in your catalog appear here automatically.</span></div>'
  }
  const cards = list
    .map(
      (s) => `<article class="sv-card">
  <div class="sv-top"><span class="sv-icon">${categoryIcon(s.category)}</span><span class="sv-cat">${escapeHtml(s.category)}</span></div>
  <h3>${escapeHtml(s.name)}</h3>
  <p>${escapeHtml(s.description)}</p>
  <div class="sv-foot"><span class="sv-price">from <strong>${priceFmt.format(s.price)}</strong></span><span class="sv-speed sv-${s.delivery}" title="Expected turnaround">${escapeHtml(turnaroundLabel(s))}</span></div>
</article>`,
    )
    .join('')
  return `<div class="sv-catalog">${cards}</div>`
}

export function buildFooterLinksHtml(items: SiteNavItem[]) {
  return items
    .map((n) => {
      const href = safeHref(n.href)
      const ext = isExternalHref(href)
      return `<a class="sv-link" href="${escapeHtml(href)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(n.label)}</a>`
    })
    .join('')
}

/** Fill every data-block placeholder inside a sanitized fragment. */
export function expandBlocks(root: DocumentFragment | Element, ctx: SiteRenderContext) {
  root.querySelectorAll<HTMLElement>('[data-block]').forEach((el) => {
    const kind = el.getAttribute('data-block')
    if (kind === 'service-catalog') {
      el.innerHTML = buildCatalogHtml(ctx.services, { limit: Number(el.getAttribute('data-limit')) || 9, category: el.getAttribute('data-category') })
    } else if (kind === 'footer-links') {
      el.classList.add('sv-links')
      el.innerHTML = buildFooterLinksHtml(ctx.footerNav)
    }
  })
}

/* ----------------------------------------------------------------------------
 * CSS shared by all sections
 * ------------------------------------------------------------------------- */
const COMMON_CSS = `
*, *::before, *::after { box-sizing: border-box; }
.__root { container-type: inline-size; display: flow-root; }
img, video { max-width: 100%; height: auto; }
a { color: var(--site-primary); }
h1, h2, h3, h4, h5, h6 { font-family: var(--site-font-heading); }
button, input, select, textarea { font: inherit; color: inherit; }
[id] { scroll-margin-top: 84px; }
`

/** Styles for dynamic blocks — namespaced with sv- so they never clash with author CSS. */
export const BLOCK_CSS = `
.sv-catalog { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
@container (max-width: 960px) { .sv-catalog { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@container (max-width: 620px) { .sv-catalog { grid-template-columns: 1fr; } }
.sv-card { display: flex; flex-direction: column; gap: 10px; padding: 22px 22px 18px; text-align: left; background: var(--site-bg); color: var(--site-text);
  border: 1px solid color-mix(in srgb, var(--site-text) 9%, transparent); border-radius: calc(var(--site-radius) * 1.2);
  transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease; }
.sv-card:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--site-primary) 35%, transparent);
  box-shadow: 0 18px 36px -20px color-mix(in srgb, var(--site-primary) 45%, transparent); }
.sv-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.sv-icon { width: 40px; height: 40px; display: grid; place-items: center; border-radius: calc(var(--site-radius) * .9); color: var(--site-primary);
  background: color-mix(in srgb, var(--site-primary) 9%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--site-primary) 16%, transparent); }
.sv-icon svg { width: 20px; height: 20px; }
.sv-cat { font-size: 12px; font-weight: 600; color: var(--site-muted); padding: 4px 10px; border-radius: 999px; background: color-mix(in srgb, var(--site-text) 5%, transparent); }
.sv-card h3 { margin: 0; font-size: 17px; font-weight: 600; letter-spacing: -.01em; line-height: 1.3; }
.sv-card p { margin: 0; flex: 1; color: var(--site-muted); font-size: 14.5px; line-height: 1.55; }
.sv-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; padding-top: 14px; font-size: 13.5px;
  border-top: 1px dashed color-mix(in srgb, var(--site-text) 12%, transparent); }
.sv-price { color: var(--site-muted); }
.sv-price strong { color: var(--site-text); font-family: var(--site-font-heading); font-size: 18px; font-weight: 600; letter-spacing: -.02em; margin-left: 2px; }
.sv-speed { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 500; color: var(--site-muted); }
.sv-speed::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--site-accent); }
.sv-speed.sv-async::before { background: var(--site-primary); }
.sv-empty { display: grid; gap: 4px; place-items: center; text-align: center; padding: 40px 24px; border-radius: var(--site-radius); color: var(--site-muted);
  border: 1px dashed color-mix(in srgb, var(--site-text) 16%, transparent); }
.sv-empty strong { color: var(--site-text); }
.sv-links { display: flex; flex-wrap: wrap; gap: 6px 22px; }
.sv-link { color: inherit; text-decoration: none; transition: color .2s ease; }
.sv-link:hover { color: var(--site-text); }
.sv-success { display: grid; justify-items: center; gap: 8px; text-align: center; padding: 48px 28px; border-radius: calc(var(--site-radius) * 1.5);
  background: color-mix(in srgb, var(--site-primary) 6%, var(--site-bg)); border: 1px solid color-mix(in srgb, var(--site-primary) 28%, transparent); animation: sv-in .4s ease both; }
.sv-success svg { width: 44px; height: 44px; padding: 10px; border-radius: 50%; color: var(--site-primary); background: color-mix(in srgb, var(--site-primary) 13%, transparent); }
.sv-success strong { font-family: var(--site-font-heading); font-size: 20px; color: var(--site-text); }
.sv-success span { color: var(--site-muted); font-size: 15px; max-width: 360px; }
@keyframes sv-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
`

/** Stylesheet placed inside each section's shadow root. */
export function sectionStylesheet(css: string) {
  return `:host { display: block; }\n${COMMON_CSS}\n${BLOCK_CSS}\n/* section */\n${adaptResponsiveCss(sanitizeCss(css))}`
}

/* ----------------------------------------------------------------------------
 * Sandboxed JS sections
 * ------------------------------------------------------------------------- */
let fontFaceCache: string | null = null
/** Copy the app's bundled @font-face rules (best effort) so sandboxed sections use the same fonts. */
function collectFontFaces() {
  if (fontFaceCache !== null) return fontFaceCache
  const out: string[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue
    }
    const base = sheet.href ?? document.baseURI
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSFontFaceRule) {
        out.push(
          rule.cssText.replace(/url\((['"]?)([^'")]+)\1\)/g, (_m, _q: string, u: string) => {
            try {
              return `url("${new URL(u, base).href}")`
            } catch {
              return `url("${u}")`
            }
          }),
        )
      }
    }
  }
  fontFaceCache = out.join('\n')
  return fontFaceCache
}

export const SANDBOX_MESSAGE = '__orvexSite'

/**
 * Full HTML document for a JS-enabled section. Loaded into
 * <iframe sandbox="allow-scripts"> — opaque origin, no same-origin access.
 */
/** CSP nonce issued by the server for this page (absent in dev). srcdoc frames inherit the page's policy. */
function cspNonceAttr() {
  const n = document.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]')?.content
  return n && n !== '__CSP_NONCE__' ? ` nonce="${n.replace(/"/g, '')}"` : ''
}

export function buildSandboxDocument(opts: { id: string; bodyHtml: string; css: string; js: string; theme: SiteTheme }) {
  const { id, bodyHtml, css, js, theme } = opts
  const nonce = cspNonceAttr()
  const safeJs = js.replace(/<\/script/gi, '<\\/script')
  const bootstrap = `(function(){var id=${JSON.stringify(id)};var M=${JSON.stringify(SANDBOX_MESSAGE)};
function h(){parent.postMessage({__orvexSite:M,type:'height',id:id,h:Math.ceil(document.documentElement.getBoundingClientRect().height)},'*')}
try{new ResizeObserver(h).observe(document.documentElement)}catch(e){}
window.addEventListener('load',h);setTimeout(h,60);h();
document.addEventListener('visibilitychange',h);try{document.fonts.ready.then(h)}catch(e){}
document.addEventListener('click',function(e){var t=e.target;var a=t&&t.closest?t.closest('a[href]'):null;if(!a)return;e.preventDefault();parent.postMessage({__orvexSite:M,type:'nav',id:id,href:a.getAttribute('href')||''},'*')});
document.addEventListener('submit',function(e){e.preventDefault()});})();`
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>${collectFontFaces()}</style>
<style>:root { ${themeDeclarations(theme)} color-scheme: ${theme.mode}; }
html, body { margin: 0; padding: 0; background: transparent; }
body { color: var(--site-text); font-family: var(--site-font-body); font-size: 16px; line-height: 1.6; -webkit-font-smoothing: antialiased; overflow: hidden; }
${COMMON_CSS}
${BLOCK_CSS}
${adaptResponsiveCss(sanitizeCss(css))}</style></head>
<body><div class="__root">${bodyHtml}</div><script${nonce}>${bootstrap}</script><script${nonce}>${safeJs}</script></body></html>`
}

/* ----------------------------------------------------------------------------
 * Site chrome (header, banner, fallback footer, 404, empty)
 * ------------------------------------------------------------------------- */
/** Site logo mark: the brand's initial on the primary colour, with a small tinted node. */
function markHtml(name: string, extra = '') {
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? 'S'
  return `<span class="sh-mark${extra}" aria-hidden="true">${escapeHtml(initial)}<i></i></span>`
}
const EXT_SVG = '<svg class="sh-ext" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>'

function navLink(item: SiteNavItem, cls: string, activePath: string | null) {
  const href = safeHref(item.href)
  const ext = item.kind === 'external' || isExternalHref(href)
  const current = !ext && activePath != null && normalizePath(splitHref(href).path || '/') === activePath && !splitHref(href).hash
  return `<a class="${cls}" href="${escapeHtml(href)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}${current ? ' aria-current="page"' : ''}>${escapeHtml(item.label)}${ext && !item.highlight ? EXT_SVG : ''}</a>`
}

export function buildHeaderHtml(opts: { logoText: string; nav: SiteNavItem[]; activePath: string | null }) {
  const regular = opts.nav.filter((n) => !n.highlight)
  const ctas = opts.nav.filter((n) => n.highlight)
  const desktop = regular.map((n) => navLink(n, 'sh-link', opts.activePath)).join('') + ctas.map((n) => navLink(n, 'sh-cta', opts.activePath)).join('')
  const mobile = regular.map((n) => navLink(n, 'sh-mlink', opts.activePath)).join('') + ctas.map((n) => navLink(n, 'sh-cta sh-mcta', opts.activePath)).join('')
  return `<header class="sh">
  <div class="sh-inner">
    <a class="sh-logo" href="/">${markHtml(opts.logoText || 'Site')}<span>${escapeHtml(opts.logoText || 'Site')}</span></a>
    <nav class="sh-nav" aria-label="Main">${desktop}</nav>
    <button class="sh-toggle" type="button" data-menu-toggle aria-label="Open menu"><span></span><span></span></button>
  </div>
  <div class="sh-menu"><nav aria-label="Mobile">${mobile || '<span class="sh-none">No navigation items</span>'}</nav></div>
</header>`
}

export function buildFallbackFooterHtml(opts: { siteName: string; year: number; footerNav: SiteNavItem[] }) {
  return `<footer class="sf"><div class="sf-inner">
  <span class="sf-brand">${markHtml(opts.siteName, ' sf-mark')}${escapeHtml(opts.siteName)}</span>
  <span class="sf-copy">© ${opts.year} ${escapeHtml(opts.siteName)}</span>
  <nav class="sf-links">${buildFooterLinksHtml(opts.footerNav)}</nav>
</div></footer>`
}

export function buildNotFoundHtml(path: string) {
  return `<section class="nf"><div class="nf-glow" aria-hidden="true"></div><div class="nf-inner">
  <span class="nf-code">404</span>
  <h1>This page doesn’t exist</h1>
  <p>We couldn’t find <code>${escapeHtml(path)}</code>. It may have moved, or the link may be out of date.</p>
  <div class="nf-actions"><a class="nf-btn nf-primary" href="/">Back to home</a><a class="nf-btn" href="/contact">Contact us</a></div>
</div></section>`
}

export function buildEmptyHtml(message: string) {
  return `<section class="se"><div class="se-box"><strong>${escapeHtml(message)}</strong><span>Add sections to this page from the section library.</span></div></section>`
}

/** Stylesheet for the outer shadow root (site chrome only — sections have their own). */
export const CHROME_CSS = `
:host { all: initial; display: block; }
.site { position: relative; flex: 1 0 auto; min-height: var(--site-min-height, 0px); background: var(--site-bg); color: var(--site-text); font-family: var(--site-font-body);
  font-size: 16px; line-height: 1.6; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility;
  container: site / inline-size; overflow-x: clip; display: flex; flex-direction: column; }
.site[data-mode="dark"] { color-scheme: dark; }
.site[data-mode="light"] { color-scheme: light; }
.site *, .site *::before, .site *::after { box-sizing: border-box; }
.site-main { flex: 1; }
.s-host { display: block; position: relative; }
.s-host[data-focus] { outline: 2px solid color-mix(in srgb, var(--site-primary) 75%, transparent); outline-offset: -2px; }
.s-host[data-disabled] { opacity: .55; }

.sh { position: sticky; top: 0; z-index: 40; background: color-mix(in srgb, var(--site-bg) 84%, transparent); -webkit-backdrop-filter: saturate(160%) blur(14px); backdrop-filter: saturate(160%) blur(14px);
  border-bottom: 1px solid color-mix(in srgb, var(--site-text) 8%, transparent); }
.sh-inner { max-width: 1208px; margin: 0 auto; padding: 0 24px; height: 68px; display: flex; align-items: center; gap: 24px; }
.sh-logo { display: inline-flex; align-items: center; gap: 10px; font-family: var(--site-font-heading); font-weight: 600; font-size: 18px; letter-spacing: -.02em; color: var(--site-text); text-decoration: none; white-space: nowrap; }
.sh-mark { position: relative; width: 30px; height: 30px; flex: none; border-radius: calc(var(--site-radius) * .8); display: grid; place-items: center;
  color: var(--site-on-primary); background: var(--site-primary); box-shadow: inset 0 1px 0 rgb(255 255 255 / .2);
  font-family: var(--site-font-heading); font-size: 14px; font-weight: 700; letter-spacing: 0; line-height: 1; }
.sh-mark i { position: absolute; right: 18%; bottom: 18%; width: 15%; height: 15%; border-radius: 50%; background: color-mix(in srgb, var(--site-on-primary) 55%, var(--site-primary)); }
.sh-nav { margin-left: auto; display: flex; align-items: center; gap: 2px; }
.sh-link { display: inline-flex; align-items: center; gap: 3px; padding: 8px 12px; border-radius: 8px; color: var(--site-muted); font-size: 14.5px; font-weight: 500; text-decoration: none; transition: color .2s ease, background-color .2s ease; white-space: nowrap; }
.sh-link:hover, .sh-link[aria-current="page"] { color: var(--site-text); background: color-mix(in srgb, var(--site-text) 5%, transparent); }
.sh-ext { width: 12px; height: 12px; opacity: .55; }
.sh-cta { display: inline-flex; align-items: center; justify-content: center; margin-left: 10px; height: 40px; padding: 0 16px; border-radius: var(--site-radius); background: var(--site-primary); color: var(--site-on-primary);
  font-size: 14.5px; font-weight: 600; text-decoration: none; white-space: nowrap; box-shadow: 0 1px 0 rgb(255 255 255 / .2) inset, 0 6px 16px -8px color-mix(in srgb, var(--site-primary) 70%, transparent); transition: transform .15s ease, filter .2s ease; }
.sh-cta:hover { transform: translateY(-1px); filter: brightness(1.05); }
.sh-toggle { display: none; margin-left: auto; width: 42px; height: 42px; border-radius: 10px; border: 1px solid color-mix(in srgb, var(--site-text) 12%, transparent); background: transparent; cursor: pointer; place-content: center; gap: 5px; padding: 0; }
.sh-toggle span { display: block; width: 18px; height: 1.6px; border-radius: 2px; background: var(--site-text); transition: transform .25s ease; }
.sh.open .sh-toggle span:first-child { transform: translateY(3.3px) rotate(45deg); }
.sh.open .sh-toggle span:last-child { transform: translateY(-3.3px) rotate(-45deg); }
.sh-menu { display: none; }
.sh-menu nav { display: grid; padding: 8px 24px 20px; }
.sh-mlink { display: flex; align-items: center; gap: 6px; padding: 13px 2px; font-size: 16px; font-weight: 500; color: var(--site-text); text-decoration: none; border-bottom: 1px solid color-mix(in srgb, var(--site-text) 7%, transparent); }
.sh-mcta { margin: 16px 0 0; height: 46px; }
.sh-none { padding: 12px 2px; color: var(--site-muted); font-size: 14px; }
@container site (max-width: 860px) {
  .sh-nav { display: none; }
  .sh-toggle { display: grid; }
  .sh.open .sh-menu { display: block; animation: sh-in .22s ease both; }
}
@keyframes sh-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }

.sb { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 8px 16px; font-size: 13px; font-weight: 500;
  color: color-mix(in srgb, var(--site-text) 80%, transparent); background: repeating-linear-gradient(-45deg, color-mix(in srgb, #e0a100 14%, var(--site-bg)) 0 10px, color-mix(in srgb, #e0a100 9%, var(--site-bg)) 10px 20px);
  border-bottom: 1px solid color-mix(in srgb, #e0a100 30%, transparent); }
.sb b { font-weight: 600; color: var(--site-text); }
.sb i { width: 7px; height: 7px; border-radius: 50%; background: #e0a100; }

.sf { border-top: 1px solid color-mix(in srgb, var(--site-text) 9%, transparent); padding: 28px 24px; font-size: 14px; color: var(--site-muted); }
.sf-inner { max-width: 1160px; margin: 0 auto; display: flex; align-items: center; gap: 12px 24px; flex-wrap: wrap; }
.sf-brand { display: inline-flex; align-items: center; gap: 8px; font-family: var(--site-font-heading); font-weight: 600; color: var(--site-text); }
.sf-mark { width: 24px; height: 24px; font-size: 12px; }
.sf-links { margin-left: auto; display: flex; flex-wrap: wrap; gap: 6px 20px; }
.sf a { color: inherit; text-decoration: none; }
.sf a:hover { color: var(--site-text); }

.nf { position: relative; overflow: hidden; padding: 120px 24px 140px; text-align: center; }
.nf-glow { position: absolute; inset: -30% 0 auto; height: 560px; pointer-events: none; background: radial-gradient(40% 50% at 50% 30%, color-mix(in srgb, var(--site-primary) 14%, transparent), transparent 70%); }
.nf-inner { position: relative; max-width: 560px; margin: 0 auto; }
.nf-code { display: block; font-family: var(--site-font-heading); font-size: clamp(88px, 16cqi, 140px); font-weight: 600; letter-spacing: -.06em; line-height: 1;
  background: linear-gradient(180deg, var(--site-text), color-mix(in srgb, var(--site-text) 20%, transparent)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.nf h1 { font-family: var(--site-font-heading); font-size: 30px; letter-spacing: -.03em; font-weight: 600; margin: 18px 0 10px; }
.nf p { color: var(--site-muted); margin: 0 0 32px; font-size: 16.5px; }
.nf code { font-family: "JetBrains Mono Variable", ui-monospace, monospace; font-size: 14px; padding: 2px 7px; border-radius: 6px; background: var(--site-surface); color: var(--site-text); }
.nf-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.nf-btn { display: inline-flex; align-items: center; height: 46px; padding: 0 20px; border-radius: var(--site-radius); font-weight: 600; font-size: 15px; text-decoration: none; color: var(--site-text);
  border: 1px solid color-mix(in srgb, var(--site-text) 14%, transparent); }
.nf-primary { background: var(--site-primary); color: var(--site-on-primary); border-color: transparent; }

.se { padding: 96px 24px; }
.se-box { max-width: 520px; margin: 0 auto; display: grid; gap: 6px; text-align: center; padding: 48px 24px; border-radius: calc(var(--site-radius) * 1.4);
  border: 1.5px dashed color-mix(in srgb, var(--site-text) 16%, transparent); color: var(--site-muted); font-size: 14.5px; }
.se-box strong { color: var(--site-text); font-size: 17px; }
`
