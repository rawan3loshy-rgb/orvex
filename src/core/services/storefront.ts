/**
 * Storefront publishing — pure functions over StorefrontState.
 *
 * resolve*()  → a renderable StorefrontConfig for one revision (+ live settings)
 * diffContent → what a publish would change
 * publishBlockers → reasons the draft cannot go live
 */
import type {
  StorefrontChange,
  StorefrontConfig,
  StorefrontContent,
  StorefrontContentSection,
  StorefrontEditorView,
  StorefrontPage,
  StorefrontRevision,
  StorefrontRevisionRef,
  StorefrontState,
} from '../domain'
import { stableStringify } from '../ids'

export const SITE_BASE_PATH = '/site'

const SECTION_LABEL: Record<StorefrontContentSection, string> = {
  theme: 'Theme & branding',
  nav: 'Header navigation',
  footerNav: 'Footer navigation',
  templates: 'Service page templates',
  locales: 'Languages',
  seo: 'SEO defaults',
}

export function revisionRef(r: StorefrontRevision): StorefrontRevisionRef {
  return { id: r.id, version: r.version, status: r.status, updatedAt: r.updatedAt, updatedBy: r.updatedBy, publishedAt: r.publishedAt, publishedBy: r.publishedBy }
}

function resolve(state: StorefrontState, r: StorefrontRevision): StorefrontConfig {
  return { ...structuredClone(r.content), ...structuredClone(state.settings), revision: revisionRef(r) }
}

/** What visitors see. Hidden pages are not routable, so they are not served. */
export function resolvePublished(state: StorefrontState): StorefrontConfig {
  const cfg = resolve(state, state.published)
  return { ...cfg, pages: cfg.pages.filter((p) => p.visibility === 'public') }
}

/** The draft exactly as it would be published (hidden pages kept so admins can review them). */
export function resolveDraft(state: StorefrontState): StorefrontConfig {
  return resolve(state, state.draft)
}

/** Edit timestamps are bookkeeping, not content: re-saving an unchanged page is not a change. */
const pageKey = (p: StorefrontPage) => stableStringify({ ...p, updatedAt: undefined })

export function diffContent(published: StorefrontContent, draft: StorefrontContent) {
  const changes: StorefrontChange[] = []
  const pageStates: Record<string, 'new' | 'changed' | 'unchanged'> = {}
  const before = new Map(published.pages.map((p) => [p.id, p]))
  for (const p of draft.pages) {
    const old = before.get(p.id)
    if (!old) {
      pageStates[p.id] = 'new'
      changes.push({ kind: 'page_added', target: p.id, label: `New page “${p.title}”` })
    } else if (pageKey(old) !== pageKey(p)) {
      pageStates[p.id] = 'changed'
      changes.push({ kind: 'page_changed', target: p.id, label: `Edited page “${p.title}”` })
    } else pageStates[p.id] = 'unchanged'
  }
  for (const old of published.pages) {
    if (!draft.pages.some((p) => p.id === old.id)) changes.push({ kind: 'page_removed', target: old.id, label: `Removed page “${old.title}”` })
  }
  for (const key of Object.keys(SECTION_LABEL) as StorefrontContentSection[]) {
    if (stableStringify(published[key]) !== stableStringify(draft[key])) changes.push({ kind: 'section_changed', target: key, label: SECTION_LABEL[key] })
  }
  return { changes, pageStates }
}

export function previewPath(state: StorefrontState) {
  return `${SITE_BASE_PATH}?preview=${state.draft.previewToken}`
}

export function editorView(state: StorefrontState): StorefrontEditorView {
  const { changes, pageStates } = diffContent(state.published.content, state.draft.content)
  return {
    ...resolveDraft(state),
    publishing: {
      draft: { ...revisionRef(state.draft), basedOnVersion: state.draft.basedOnVersion },
      published: revisionRef(state.published),
      hasUnpublishedChanges: changes.length > 0,
      changes,
      blockers: publishBlockers(state),
      pageStates,
      previewPath: previewPath(state),
      history: state.history.map(revisionRef),
    },
  }
}

/** Reasons the draft would produce a broken live site. Empty = publishable. */
export function publishBlockers(state: StorefrontState): string[] {
  const c = state.draft.content
  const out: string[] = []
  const pub = new Map(c.pages.filter((p) => p.visibility === 'public').map((p) => [p.id, p]))
  const home = c.pages.find((p) => p.kind === 'home')
  if (!home) out.push('The site needs a home page')
  else if (home.visibility !== 'public') out.push('The home page must be public')
  for (const n of [...c.nav, ...c.footerNav]) {
    if (n.target.kind === 'page' && !pub.has(n.target.pageId)) out.push(`Navigation link “${n.label}” points to a page that is hidden or deleted`)
  }
  for (const p of pub.values()) {
    for (const b of p.blocks) {
      const links = b.type === 'hero' ? [b.primary, b.secondary] : b.type === 'cta' ? [b.cta] : []
      for (const l of links) {
        if (l?.target.kind === 'page' && !pub.has(l.target.pageId)) out.push(`Button “${l.label}” on “${p.title}” points to a page that is hidden or deleted`)
      }
    }
  }
  const terms = state.settings.checkout.termsPageId
  if (terms && !pub.has(terms)) out.push('The checkout terms page is hidden or deleted in this draft')
  if (!c.templates.some((t) => t.isDefault)) out.push('One service page template must be the default')
  return out
}
