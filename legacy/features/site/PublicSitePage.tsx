/**
 * The customer's public website (their-domain.com) — rendered full-screen,
 * exactly as visitors see it. Content, navigation and theme come from
 * Website settings in the installation admin; rendering is shared with the
 * admin previews (SiteCanvas → Shadow DOM, sanitized HTML, sandboxed JS).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpRight, PencilLine, X } from 'lucide-react'
import { LogoMark } from '@/components/brand'
import { Tooltip } from '@/components/ui'
import { normalizePath, splitHref } from './renderSite'
import { SiteCanvas, findPageBySlug, resolvePageSections, sitePath, useSiteRuntime } from './SiteRenderer'

const HEAD_ATTR = 'data-site-head'

/** Apply the safe subset of the custom <head> code (meta + link tags only). */
function useCustomHead(code: string | undefined) {
  useEffect(() => {
    if (!code) return
    const parsed = new DOMParser().parseFromString(`<!doctype html><html><head>${code}</head><body></body></html>`, 'text/html')
    const added: Element[] = []
    for (const el of Array.from(parsed.head.children)) {
      const tag = el.tagName
      if (tag === 'META') {
        if (el.hasAttribute('http-equiv') || el.hasAttribute('charset')) continue
        const meta = document.createElement('meta')
        for (const a of ['name', 'property', 'content']) {
          const v = el.getAttribute(a)
          if (v != null) meta.setAttribute(a, v)
        }
        meta.setAttribute(HEAD_ATTR, '')
        document.head.appendChild(meta)
        added.push(meta)
      } else if (tag === 'LINK') {
        const rel = (el.getAttribute('rel') ?? '').toLowerCase()
        const href = el.getAttribute('href') ?? ''
        if (!['preconnect', 'dns-prefetch', 'stylesheet', 'icon'].includes(rel) || !/^https:\/\//i.test(href)) continue
        const link = document.createElement('link')
        link.rel = rel
        link.href = href
        if (el.hasAttribute('crossorigin')) link.crossOrigin = 'anonymous'
        link.setAttribute(HEAD_ATTR, '')
        document.head.appendChild(link)
        added.push(link)
      }
      // <script>, <style>, <base> … are intentionally never applied in the preview.
    }
    return () => added.forEach((el) => el.remove())
  }, [code])
}

function useDocumentMeta(title: string | null, description: string | null) {
  useEffect(() => {
    if (title == null) return
    const prev = document.title
    document.title = title
    return () => {
      document.title = prev
    }
  }, [title])
  useEffect(() => {
    if (!description) return
    const meta = document.createElement('meta')
    meta.name = 'description'
    meta.content = description
    meta.setAttribute(HEAD_ATTR, 'seo')
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [description])
}

/** Paint the document behind the site in the site's own background (overscroll areas). */
function useSiteBackground(color: string | undefined, mode: 'light' | 'dark' | undefined) {
  useEffect(() => {
    if (!color) return
    const body = document.body.style
    const html = document.documentElement.style
    const prev = { bg: body.background, scheme: html.colorScheme }
    body.background = color
    html.colorScheme = mode ?? ''
    return () => {
      body.background = prev.bg
      html.colorScheme = prev.scheme
    }
  }, [color, mode])
}

export default function PublicSitePage() {
  const { pathname, hash } = useLocation()
  const navigate = useNavigate()
  const { site, ctx, ready, isError, refetch } = useSiteRuntime()

  const slug = normalizePath(pathname.replace(/^\/site/, '') || '/')
  const page = site ? findPageBySlug(site, slug) : undefined
  const sections = useMemo(() => (site && page ? resolvePageSections(site, page) : []), [site, page])

  const siteName = site?.theme.siteName ?? ''
  useDocumentMeta(site ? (page ? page.seo.title || `${page.title} — ${siteName}` : `Page not found — ${siteName}`) : null, page?.seo.description ?? null)
  useCustomHead(site?.customHead)
  useSiteBackground(site?.theme.background, site?.theme.mode)

  useEffect(() => {
    if (!hash) window.scrollTo({ top: 0 })
  }, [slug, hash])

  const onNavigate = useCallback(
    (href: string, opts: { newTab: boolean }) => {
      const { path, hash: h } = splitHref(href)
      const target = sitePath(path || '/') + (h ? `#${h}` : '')
      if (opts.newTab) window.open(target, '_blank', 'noopener')
      else navigate(target)
    },
    [navigate],
  )

  if (isError) return <SiteError onRetry={() => refetch()} />
  if (!site || !ready) return <SiteSkeleton />

  return (
    <>
      <SiteCanvas
        mode="live"
        theme={site.theme}
        nav={site.nav}
        sections={sections}
        ctx={ctx}
        activePath={page ? slug : null}
        banner={page?.status === 'draft' ? 'Draft preview — this page isn’t published yet. Only admins can see it.' : null}
        notFoundPath={page ? null : slug}
        hash={hash ? hash.slice(1) : null}
        onNavigate={onNavigate}
        minHeight="100dvh"
      />
      <AdminPill domain={site.domain} pageId={page?.id} />
    </>
  )
}

/* ----------------------------------------------------------------------------
 * Admin preview pill (admin chrome — uses app tokens)
 * ------------------------------------------------------------------------- */
function AdminPill({ domain, pageId }: { domain: string; pageId?: string }) {
  const [open, setOpen] = useState(true)
  return (
    // Stacked just above the prototype's Journey button (fixed bottom-right).
    <div className="pointer-events-none fixed right-4 bottom-[60px] z-50">
      <AnimatePresence mode="wait" initial={false}>
        {open ? (
          <motion.div
            key="pill"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34, delay: 0.25 }}
            className="glass pointer-events-auto flex items-center gap-1 rounded-full border border-line-strong py-1 pr-1 pl-1.5 text-[12px] text-fg shadow-pop"
          >
            <LogoMark className="size-6" />
            <span className="hidden pr-1 pl-1 text-fg-2 sm:inline">
              Preview of <span className="font-mono text-[11.5px] text-fg">{domain}</span>
            </span>
            <Link
              to={pageId ? `/admin/website/pages?page=${pageId}` : '/admin/website'}
              className="ml-0.5 inline-flex h-7 items-center gap-1.5 rounded-full bg-fg px-3 font-medium text-bg transition-opacity hover:opacity-90"
            >
              <PencilLine className="size-3.5" />
              Edit in admin
              <ArrowUpRight className="size-3.5 opacity-60" />
            </Link>
            <button type="button" onClick={() => setOpen(false)} className="grid size-7 place-items-center rounded-full text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg" aria-label="Hide preview bar">
              <X className="size-3.5" />
            </button>
          </motion.div>
        ) : (
          <motion.div key="dot" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="pointer-events-auto">
            <Tooltip content="Show admin preview bar" placement="left">
              <button type="button" onClick={() => setOpen(true)} className="glass grid size-10 place-items-center rounded-full border border-line-strong shadow-pop transition-transform hover:scale-105" aria-label="Show admin preview bar">
                <LogoMark className="size-6" />
              </button>
            </Tooltip>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Loading / error — neutral, site-like (no admin chrome)
 * ------------------------------------------------------------------------- */
// The site's own theme isn't known yet while loading, so these states use quiet
// warm neutrals that sit well under any customer palette (no admin chrome).
function SiteSkeleton() {
  const block = 'rounded-lg bg-[#efede8] animate-pulse'
  return (
    <div className="min-h-dvh bg-[#fcfbf8]" aria-busy="true" aria-label="Loading website">
      <div className="border-b border-[#ebe8e2]">
        <div className="mx-auto flex h-[68px] max-w-[1208px] items-center gap-6 px-6">
          <div className={`${block} size-[30px]`} />
          <div className={`${block} h-4 w-28`} />
          <div className="ml-auto hidden items-center gap-5 md:flex">
            {[64, 88, 52, 76, 60].map((w) => (
              <div key={w} className={`${block} h-3.5`} style={{ width: w }} />
            ))}
            <div className={`${block} h-10 w-32`} />
          </div>
        </div>
      </div>
      <div className="mx-auto grid max-w-[1160px] gap-16 px-6 pt-24 md:grid-cols-2">
        <div className="space-y-5">
          <div className={`${block} h-7 w-64 rounded-full`} />
          <div className={`${block} h-14 w-full`} />
          <div className={`${block} h-14 w-4/5`} />
          <div className={`${block} h-5 w-full`} />
          <div className={`${block} h-5 w-3/4`} />
          <div className="flex gap-3 pt-4">
            <div className={`${block} h-12 w-40`} />
            <div className={`${block} h-12 w-36`} />
          </div>
        </div>
        <div className={`${block} hidden h-[380px] rounded-2xl md:block`} />
      </div>
    </div>
  )
}

function SiteError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-[#fcfbf8] px-6 text-center text-[#1d1e1c]">
      <div className="max-w-sm">
        <p className="font-display text-[22px] font-semibold tracking-[-0.02em]">This site is temporarily unavailable</p>
        <p className="mt-2 text-[15px] text-[#5f605a]">We couldn’t load the website configuration. Please try again in a moment.</p>
        <button type="button" onClick={onRetry} className="mt-6 inline-flex h-11 items-center rounded-[10px] bg-[#1d1e1c] px-5 text-[14.5px] font-semibold text-[#fcfbf8] transition-opacity hover:opacity-90">
          Try again
        </button>
      </div>
    </div>
  )
}
