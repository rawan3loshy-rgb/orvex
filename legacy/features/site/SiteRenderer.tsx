/**
 * React bindings for the shared website renderer.
 *
 *   useSiteRuntime()  → site config + render context (stats, live catalog)
 *   <SiteCanvas …/>   → mounts the site (or a subset of sections) in Shadow DOM
 *
 * The admin editors and the public site both render through <SiteCanvas>, so
 * previews are pixel-identical to what visitors see.
 */
import { useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react'
import { useHealth, useOrderStats, useServices, useSite } from '@/hooks/installation'
import { num } from '@/lib/format'
import type { SiteConfig, SiteNavItem, SitePage, SiteSection, SiteTheme } from '@/types/installation'
import { normalizePath, type CatalogService, type SiteRenderContext } from './renderSite'
import { SiteEngine, type SiteHandlers, type SiteMode } from './siteEngine'

/* ----------------------------------------------------------------------------
 * Data
 * ------------------------------------------------------------------------- */
export function useSiteRuntime() {
  const site = useSite()
  const services = useServices()
  const orderStats = useOrderStats()
  const health = useHealth({ live: false })

  const catalog = useMemo<CatalogService[]>(
    () =>
      (services.data ?? [])
        .filter((s) => s.status === 'active' && s.visibility.website)
        .sort((a, b) => b.orders30d - a.orders30d || a.name.localeCompare(b.name))
        .map((s) => ({ id: s.id, name: s.name, category: s.category, description: s.description, price: s.price, delivery: s.delivery, turnaround: s.turnaround })),
    [services.data],
  )

  // Stats are a snapshot taken when the page loads (like a server-rendered site),
  // so the live order simulation doesn't re-render sections every few seconds.
  const ordersRef = useRef<number | null>(null)
  if (ordersRef.current == null && orderStats.data?.all != null) ordersRef.current = orderStats.data.all
  const orders = ordersRef.current
  const uptime = health.data?.uptime.percent30d
  const siteName = site.data?.theme.siteName ?? ''
  const footerNav = site.data?.footerNav

  const ctx = useMemo<SiteRenderContext>(
    () => ({
      siteName,
      year: new Date().getFullYear(),
      stats: {
        orders: orders != null ? num(orders) : '—',
        uptime: uptime != null ? `${uptime.toFixed(2)}%` : '—',
        services: String(catalog.length),
      },
      services: catalog,
      footerNav: footerNav ?? [],
    }),
    [siteName, orders, uptime, catalog, footerNav],
  )

  const ready = !!site.data && (!!services.data || services.isError) && (orders != null || orderStats.isError) && (!!health.data || health.isError)

  return { site: site.data, ctx, ready, isLoading: site.isLoading, isError: site.isError, refetch: site.refetch }
}

/* ----------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */
export function resolvePageSections(site: Pick<SiteConfig, 'sections'>, page: Pick<SitePage, 'sectionIds'>, opts?: { includeDisabled?: boolean }) {
  const byId = new Map(site.sections.map((s) => [s.id, s]))
  return page.sectionIds.map((id) => byId.get(id)).filter((s): s is SiteSection => !!s && (opts?.includeDisabled || s.enabled))
}

export function findPageBySlug(site: Pick<SiteConfig, 'pages'>, slug: string) {
  const target = normalizePath(slug)
  return site.pages.find((p) => normalizePath(p.slug) === target)
}

/** Public URL of a page inside this prototype (/site + slug). */
export function sitePath(slug: string) {
  const s = normalizePath(slug)
  return s === '/' ? '/site' : `/site${s}`
}

/* ----------------------------------------------------------------------------
 * Canvas
 * ------------------------------------------------------------------------- */
export interface SiteCanvasProps {
  theme: SiteTheme
  sections: SiteSection[]
  ctx: SiteRenderContext
  nav?: SiteNavItem[]
  footerNav?: SiteNavItem[]
  mode?: SiteMode
  /** Render the site header (logo + navigation). */
  chrome?: boolean
  activePath?: string | null
  banner?: string | null
  notFoundPath?: string | null
  /** Add a minimal footer when the page has no footer section. */
  fallbackFooter?: boolean
  emptyMessage?: string | null
  dimmedIds?: string[]
  focusId?: string | null
  hash?: string | null
  onNavigate?: SiteHandlers['onNavigate']
  minHeight?: string
  className?: string
  style?: CSSProperties
}

export function SiteCanvas({
  theme,
  sections,
  ctx,
  nav = [],
  footerNav,
  mode = 'preview',
  chrome = true,
  activePath = null,
  banner = null,
  notFoundPath = null,
  fallbackFooter = true,
  emptyMessage = 'This page has no sections yet',
  dimmedIds,
  focusId = null,
  hash = null,
  onNavigate,
  minHeight,
  className,
  style,
}: SiteCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<SiteEngine | null>(null)
  const handlersRef = useRef<SiteHandlers>({})

  const fullCtx = useMemo<SiteRenderContext>(() => ({ ...ctx, siteName: theme.siteName, footerNav: footerNav ?? ctx.footerNav }), [ctx, theme.siteName, footerNav])

  useLayoutEffect(() => {
    const engine = new SiteEngine(hostRef.current!, () => handlersRef.current)
    engineRef.current = engine
    return () => {
      engine.destroy()
      engineRef.current = null
    }
  }, [])

  useLayoutEffect(() => {
    handlersRef.current = { onNavigate }
    engineRef.current?.update({
      theme,
      nav,
      sections,
      ctx: fullCtx,
      mode,
      chrome,
      activePath: activePath != null ? normalizePath(activePath) : null,
      banner,
      notFoundPath,
      fallbackFooter,
      emptyMessage,
      dimmedIds,
      focusId,
      hash,
    })
  })

  return (
    <div
      ref={hostRef}
      className={className}
      // Inline styles on the host win over the shadow :host reset (which re-enables pointer events).
      style={{ ...(minHeight ? ({ '--site-min-height': minHeight } as CSSProperties) : null), ...(mode === 'static' ? { pointerEvents: 'none', userSelect: 'none' } : null), ...style }}
    />
  )
}
