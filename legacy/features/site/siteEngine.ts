/**
 * Imperative renderer that mounts a customer website into a Shadow DOM root.
 *
 * Structure:
 *   host (light DOM, owned by React)
 *   └─ #shadow-root               ← site chrome stylesheet (CHROME_CSS)
 *      └─ .site  (theme CSS variables)
 *         ├─ banner / header
 *         ├─ main
 *         │   ├─ .s-host  #shadow-root  ← one isolated root per section
 *         │   └─ .s-host  #shadow-root  ← or a sandboxed iframe when JS is enabled
 *         └─ fallback footer
 *
 * Sections are diffed by a content signature so typing in the editor only
 * re-renders the section being edited, and live stats only touch sections that
 * actually reference them.
 */
import type { SiteNavItem, SiteSection, SiteTheme } from '@/types/installation'
import {
  CHROME_CSS,
  SANDBOX_MESSAGE,
  buildEmptyHtml,
  buildFallbackFooterHtml,
  buildHeaderHtml,
  buildNotFoundHtml,
  buildSandboxDocument,
  escapeHtml,
  expandBlocks,
  interpolate,
  isExternalHref,
  normalizePath,
  sanitizeToFragment,
  sectionDependencies,
  sectionStylesheet,
  splitHref,
  themeDeclarations,
  themeVars,
  type SiteRenderContext,
} from './renderSite'

export type SiteMode = 'live' | 'preview' | 'static'

export interface SiteModel {
  theme: SiteTheme
  nav: SiteNavItem[]
  sections: SiteSection[]
  ctx: SiteRenderContext
  mode: SiteMode
  chrome: boolean
  activePath: string | null
  banner: string | null
  notFoundPath: string | null
  fallbackFooter: boolean
  emptyMessage: string | null
  /** Section ids rendered dimmed (disabled sections shown in editor previews). */
  dimmedIds?: string[]
  /** Section id to outline and scroll into view. */
  focusId?: string | null
  /** Anchor id to scroll to once rendered. */
  hash?: string | null
}

export interface SiteHandlers {
  /** Internal navigation, e.g. "/services" or "/#faq". */
  onNavigate?: (href: string, opts: { newTab: boolean }) => void
}

interface SectionEntry {
  key: string
  el: HTMLElement
  sig: string
  iframe?: HTMLIFrameElement
}

const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>'

function findScrollParent(start: Element): HTMLElement | null {
  let node: Node | null = start
  while (node) {
    const parent: Node | null = node instanceof ShadowRoot ? node.host : node.parentNode
    if (!parent || parent === document.body || parent === document.documentElement || parent instanceof Document) return null
    if (parent instanceof HTMLElement) {
      const oy = getComputedStyle(parent).overflowY
      if ((oy === 'auto' || oy === 'scroll') && parent.scrollHeight > parent.clientHeight) return parent
    }
    node = parent
  }
  return null
}

export class SiteEngine {
  private host: HTMLElement
  private shadow: ShadowRoot
  private root: HTMLDivElement
  private bannerEl: HTMLDivElement
  private headerEl: HTMLDivElement
  private main: HTMLElement
  private footerEl: HTMLDivElement
  private entries = new Map<string, SectionEntry>()
  private sigs = { header: '', banner: '', footer: '', main: '' }
  private model: SiteModel | null = null
  private lastFocus: string | null = null
  private lastHash: string | null = null
  private getHandlers: () => SiteHandlers
  private destroyed = false

  constructor(host: HTMLElement, getHandlers: () => SiteHandlers) {
    this.host = host
    this.getHandlers = getHandlers
    this.shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = CHROME_CSS
    this.root = document.createElement('div')
    this.root.className = 'site'
    this.bannerEl = document.createElement('div')
    this.headerEl = document.createElement('div')
    this.main = document.createElement('main')
    this.main.className = 'site-main'
    this.footerEl = document.createElement('div')
    // Slots generate no box, so the sticky header is constrained by .site, not its wrapper.
    for (const slot of [this.bannerEl, this.headerEl, this.footerEl]) slot.style.display = 'contents'
    this.root.append(this.bannerEl, this.headerEl, this.main, this.footerEl)
    this.shadow.replaceChildren(style, this.root)
    this.shadow.addEventListener('click', this.onClick)
    window.addEventListener('message', this.onMessage)
  }

  destroy() {
    this.destroyed = true
    this.shadow.removeEventListener('click', this.onClick)
    window.removeEventListener('message', this.onMessage)
  }

  /* ------------------------------------------------------------------ render */
  update(model: SiteModel) {
    if (this.destroyed) return
    this.model = model
    const { theme } = model

    // Theme variables live on the root; they inherit into every section's shadow root.
    for (const [k, v] of Object.entries(themeVars(theme))) this.root.style.setProperty(k, v)
    this.root.dataset.mode = theme.mode

    // Banner
    const bannerSig = model.banner ?? ''
    if (bannerSig !== this.sigs.banner) {
      this.sigs.banner = bannerSig
      this.bannerEl.innerHTML = model.banner ? `<div class="sb" role="status"><i></i><span>${escapeHtml(model.banner)}</span></div>` : ''
    }

    // Header
    const headerSig = model.chrome ? JSON.stringify([theme.logoText, model.nav, model.activePath]) : ''
    if (headerSig !== this.sigs.header) {
      this.sigs.header = headerSig
      this.headerEl.innerHTML = model.chrome ? buildHeaderHtml({ logoText: theme.logoText, nav: model.nav, activePath: model.activePath }) : ''
    }

    // Main
    if (model.notFoundPath != null) {
      this.clearSections()
      const sig = `404:${model.notFoundPath}`
      if (this.sigs.main !== sig) {
        this.sigs.main = sig
        this.main.innerHTML = buildNotFoundHtml(model.notFoundPath)
      }
    } else if (!model.sections.length) {
      this.clearSections()
      const sig = `empty:${model.emptyMessage ?? ''}`
      if (this.sigs.main !== sig) {
        this.sigs.main = sig
        this.main.innerHTML = model.emptyMessage ? buildEmptyHtml(model.emptyMessage) : ''
      }
    } else {
      if (!this.sigs.main.startsWith('sections')) {
        this.main.replaceChildren()
        this.sigs.main = 'sections'
      }
      this.renderSections(model)
    }

    // Fallback footer when the page has no footer section of its own
    const needsFooter = model.fallbackFooter && (model.notFoundPath != null || !model.sections.some((s) => s.type === 'footer'))
    const footerSig = needsFooter ? JSON.stringify([theme.siteName, model.ctx.year, model.ctx.footerNav]) : ''
    if (footerSig !== this.sigs.footer) {
      this.sigs.footer = footerSig
      this.footerEl.innerHTML = needsFooter ? buildFallbackFooterHtml({ siteName: theme.siteName, year: model.ctx.year, footerNav: model.ctx.footerNav }) : ''
    }

    // Focus & anchors
    const focus = model.focusId ?? null
    if (focus !== this.lastFocus) {
      this.lastFocus = focus
      if (focus) requestAnimationFrame(() => this.scrollToSection(focus))
    }
    const hash = model.hash ?? null
    if (hash !== this.lastHash) {
      this.lastHash = hash
      if (hash) requestAnimationFrame(() => this.scrollToAnchor(hash, false))
    }
  }

  private clearSections() {
    for (const e of this.entries.values()) e.el.remove()
    this.entries.clear()
  }

  private renderSections(model: SiteModel) {
    const seen = new Map<string, number>()
    const keep = new Set<string>()
    const ordered: SectionEntry[] = []
    const themeSig = themeDeclarations(model.theme) + model.theme.mode
    const dimmed = new Set(model.dimmedIds ?? [])

    for (const section of model.sections) {
      const n = seen.get(section.id) ?? 0
      seen.set(section.id, n + 1)
      const key = n ? `${section.id}#${n}` : section.id
      keep.add(key)
      const usesJs = section.jsEnabled && section.js.trim().length > 0
      const sig = [section.html, section.css, usesJs ? section.js : '', usesJs ? themeSig : '', String(usesJs), sectionDependencies(section, model.ctx), model.mode].join('\u0001')
      let entry = this.entries.get(key)
      if (!entry) {
        const el = document.createElement('div')
        el.className = 's-host'
        el.dataset.section = section.id
        entry = { key, el, sig: '' }
        this.entries.set(key, entry)
      }
      if (entry.sig !== sig) {
        entry.sig = sig
        this.renderSection(entry, section, model, usesJs)
      }
      entry.el.toggleAttribute('data-disabled', dimmed.has(section.id))
      entry.el.toggleAttribute('data-focus', model.focusId === section.id)
      ordered.push(entry)
    }

    for (const [key, e] of this.entries) {
      if (!keep.has(key)) {
        e.el.remove()
        this.entries.delete(key)
      }
    }
    ordered.forEach((e, i) => {
      if (this.main.children[i] !== e.el) this.main.insertBefore(e.el, this.main.children[i] ?? null)
    })
  }

  private renderSection(entry: SectionEntry, section: SiteSection, model: SiteModel, usesJs: boolean) {
    const sr = entry.el.shadowRoot ?? this.attachSectionRoot(entry.el)
    const fragment = sanitizeToFragment(interpolate(section.html, model.ctx))
    expandBlocks(fragment, model.ctx)
    const style = document.createElement('style')

    if (usesJs) {
      const holder = document.createElement('div')
      holder.append(fragment)
      const iframe = document.createElement('iframe')
      // Opaque origin: scripts run, but can't touch the parent page, cookies or storage.
      iframe.setAttribute('sandbox', 'allow-scripts')
      iframe.setAttribute('referrerpolicy', 'no-referrer')
      iframe.setAttribute('title', `${section.name} (sandboxed)`)
      iframe.style.cssText = `display:block;width:100%;height:${entry.iframe?.style.height || '240px'};border:0;background:transparent;color-scheme:${model.theme.mode};`
      iframe.srcdoc = buildSandboxDocument({ id: entry.key, bodyHtml: holder.innerHTML, css: section.css, js: section.js, theme: model.theme })
      style.textContent = ':host { display: block; }'
      sr.replaceChildren(style, iframe)
      entry.iframe = iframe
    } else {
      style.textContent = sectionStylesheet(section.css)
      const root = document.createElement('div')
      root.className = '__root'
      root.append(fragment)
      sr.replaceChildren(style, root)
      entry.iframe = undefined
    }
  }

  private attachSectionRoot(el: HTMLElement) {
    const sr = el.attachShadow({ mode: 'open' })
    // `submit` doesn't cross shadow boundaries, so each section root listens itself.
    sr.addEventListener('submit', this.onSubmit)
    return sr
  }

  /* ------------------------------------------------------------------ events */
  private onSubmit = (e: Event) => {
    e.preventDefault()
    const form = e.target
    if (!(form instanceof HTMLFormElement) || this.model?.mode === 'static') return
    const msg = form.getAttribute('data-success') || 'Thanks — your message has been received.'
    const done = document.createElement('div')
    done.className = 'sv-success'
    done.setAttribute('role', 'status')
    done.innerHTML = `${CHECK_SVG}<strong>Message sent</strong><span>${escapeHtml(msg)}</span>`
    form.replaceWith(done)
  }

  private onClick = (e: Event) => {
    const model = this.model
    if (!model || model.mode === 'static') {
      e.preventDefault()
      return
    }
    const me = e as MouseEvent
    for (const node of e.composedPath()) {
      if (!(node instanceof Element)) continue
      if (node.hasAttribute('data-menu-toggle')) {
        const header = this.headerEl.querySelector('.sh')
        const open = header?.classList.toggle('open') ?? false
        node.setAttribute('aria-label', open ? 'Close menu' : 'Open menu')
        return
      }
      if (node instanceof HTMLAnchorElement || node.tagName === 'A') {
        const href = node.getAttribute('href') ?? ''
        e.preventDefault()
        this.headerEl.querySelector('.sh')?.classList.remove('open')
        this.handleHref(href, me.metaKey || me.ctrlKey || me.button === 1)
        return
      }
      if (node === this.root) return
    }
  }

  private onMessage = (e: MessageEvent) => {
    const d = e.data as { __orvexSite?: string; type?: string; id?: string; h?: number; href?: string } | null
    if (!d || typeof d !== 'object' || d.__orvexSite !== SANDBOX_MESSAGE) return
    for (const entry of this.entries.values()) {
      if (!entry.iframe || entry.iframe.contentWindow !== e.source) continue
      if (d.type === 'height') {
        const h = Math.max(24, Math.min(8000, Number(d.h) || 0))
        entry.iframe.style.height = `${h}px`
      } else if (d.type === 'nav' && typeof d.href === 'string' && this.model?.mode !== 'static') {
        this.handleHref(d.href, false)
      }
      return
    }
  }

  private handleHref(raw: string, newTab: boolean) {
    const href = raw.trim()
    if (!href || href === '#') return
    if (href.startsWith('#')) {
      this.scrollToAnchor(href.slice(1), true)
      return
    }
    if (isExternalHref(href)) {
      if (/^javascript:/i.test(href)) return
      window.open(href, '_blank', 'noopener,noreferrer')
      return
    }
    if (href.startsWith('/')) {
      const { path, hash } = splitHref(href)
      const target = normalizePath(path || '/')
      if (hash && this.model?.activePath === target && !newTab) {
        this.scrollToAnchor(hash, true)
        return
      }
      this.getHandlers().onNavigate?.(href, { newTab })
    }
  }

  /* ------------------------------------------------------------------ scrolling */
  private findById(id: string): Element | null {
    const direct = this.shadow.getElementById(id)
    if (direct) return direct
    for (const e of this.entries.values()) {
      const found = e.el.shadowRoot?.getElementById(id)
      if (found) return found
    }
    return null
  }

  private scrollToElement(el: Element, smooth: boolean, offset: number) {
    const behavior: ScrollBehavior = smooth ? 'smooth' : 'auto'
    const scroller = findScrollParent(this.host)
    const r = el.getBoundingClientRect()
    if (!scroller) {
      window.scrollTo({ top: window.scrollY + r.top - offset, behavior })
      return
    }
    const sr = scroller.getBoundingClientRect()
    const scale = scroller.clientHeight ? sr.height / scroller.clientHeight : 1
    scroller.scrollTo({ top: scroller.scrollTop + (r.top - sr.top) / (scale || 1) - offset, behavior })
  }

  scrollToAnchor(id: string, smooth: boolean) {
    const el = this.findById(decodeURIComponent(id))
    if (el) this.scrollToElement(el, smooth, this.model?.chrome ? 76 : 8)
  }

  scrollToSection(id: string) {
    const entry = this.entries.get(id)
    if (entry) this.scrollToElement(entry.el, true, this.model?.chrome ? 68 : 0)
  }
}
