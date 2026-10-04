/**
 * Storefront runtime context — the resolved config (theme, pages, nav,
 * categories, signed-in customer) plus link helpers that keep the admin
 * preview token on every internal link while previewing a draft.
 */
import { createContext, useContext, useEffect } from 'react'
import type { StoreConfigResponse } from '@/services/installation'
import type { StorefrontPage, StorefrontTarget } from '@/types/installation'

export const SITE = '/site'

export interface StoreCtx {
  config: StoreConfigResponse
  /** Admin preview token when rendering the DRAFT revision; null on the public (published) site. */
  previewToken: string | null
  preview: boolean
  /** Prefix a storefront path and keep preview mode. */
  to: (path: string) => string
  hrefOf: (t: StorefrontTarget) => string
  pageHref: (p: Pick<StorefrontPage, 'slug' | 'kind'>) => string
}

export const StoreContext = createContext<StoreCtx | null>(null)

export function useStore(): StoreCtx {
  const v = useContext(StoreContext)
  if (!v) throw new Error('useStore must be used inside the storefront layout')
  return v
}

export function withPreview(path: string, previewToken: string | null) {
  if (!previewToken || /^[a-z]+:/i.test(path)) return path
  const [base, hash] = path.split('#') as [string, string | undefined]
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}preview=${encodeURIComponent(previewToken)}${hash ? `#${hash}` : ''}`
}

export function pagePath(p: Pick<StorefrontPage, 'slug' | 'kind'>) {
  return p.kind === 'home' || !p.slug ? SITE : `${SITE}/${p.slug}`
}

/** Resolve a typed target to a storefront route (or external URL). */
export function resolveTarget(t: StorefrontTarget, config: Pick<StoreConfigResponse, 'pages' | 'categories'>): string {
  switch (t.kind) {
    case 'page': {
      const p = config.pages.find((x) => x.id === t.pageId)
      return p ? pagePath(p) : SITE
    }
    case 'category': {
      const c = config.categories.find((x) => x.id === t.categoryId)
      return c ? `${SITE}/c/${c.slug}` : `${SITE}/services`
    }
    case 'service':
      return `${SITE}/services/${encodeURIComponent(t.serviceId)}`
    case 'search':
      return `${SITE}/search?q=${encodeURIComponent(t.query)}`
    case 'track':
      return `${SITE}/track`
    case 'account':
      return `${SITE}/account`
    case 'url':
      return t.url
  }
}

export const isExternal = (href: string) => /^(https?:|mailto:|tel:)/i.test(href)

/** Sets the document title using the storefront title suffix. */
export function useDocTitle(title: string | undefined) {
  const v = useContext(StoreContext)
  const suffix = v?.config.seo.titleSuffix ?? ''
  useEffect(() => {
    if (!title) return
    const prev = document.title
    document.title = title.endsWith(suffix.trim()) || !suffix ? title : `${title}${suffix}`
    return () => {
      document.title = prev
    }
  }, [title, suffix])
}
