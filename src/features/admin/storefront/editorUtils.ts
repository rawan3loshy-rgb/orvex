/** Non-component helpers of the storefront editor (operator console). */
import { useCategories } from '@/hooks/installation'
import type { StorefrontConfig, StorefrontTarget } from '@/types/installation'
import { resolveTarget } from '@/features/storefront/lib/storeContext'

/** The public (published) storefront. */
export const SITE_URL = '/site'

export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

export function move<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const j = index + dir
  if (j < 0 || j >= list.length) return list
  const next = [...list]
  ;[next[index], next[j]] = [next[j]!, next[index]!]
  return next
}

/** Preview a specific storefront path with the draft's admin preview token (taken from publishing.previewPath). */
export function previewHref(previewPath: string, path: string) {
  const query = previewPath.split('?')[1] ?? ''
  return query ? `${path}?${query}` : path
}

/** Structural comparison for "unsaved changes" — local edits vs. the saved draft. */
export const sameContent = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/* ------------------------------------------------------------------------- */
/*  Typed link targets                                                       */
/* ------------------------------------------------------------------------- */
export const TARGET_KINDS: { value: StorefrontTarget['kind']; label: string }[] = [
  { value: 'page', label: 'Page' },
  { value: 'category', label: 'Category' },
  { value: 'service', label: 'Service' },
  { value: 'search', label: 'Search results' },
  { value: 'track', label: 'Track order' },
  { value: 'account', label: 'Customer account' },
  { value: 'url', label: 'External URL' },
]

export function defaultTarget(kind: StorefrontTarget['kind'], config: StorefrontConfig, firstCategory?: string, firstService?: string): StorefrontTarget {
  switch (kind) {
    case 'page':
      return { kind, pageId: config.pages.find((p) => p.visibility === 'public')?.id ?? config.pages[0]?.id ?? '' }
    case 'category':
      return { kind, categoryId: firstCategory ?? '' }
    case 'service':
      return { kind, serviceId: firstService ?? '' }
    case 'search':
      return { kind, query: '' }
    case 'url':
      return { kind, url: 'https://' }
    default:
      return { kind }
  }
}

/** Resolved storefront path for display in the editor. */
export function useTargetPath(config: StorefrontConfig | undefined) {
  const cats = useCategories()
  return (t: StorefrontTarget) => (config ? resolveTarget(t, { pages: config.pages, categories: cats.data ?? [] }) : '')
}
