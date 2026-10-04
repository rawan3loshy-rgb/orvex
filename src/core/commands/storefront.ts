/**
 * Storefront commands — Draft → Preview → Publish.
 *
 * Every content edit mutates the DRAFT revision only. Publishing promotes the
 * saved draft to the published revision in one step (no partial state is ever
 * observable), archives the previous published revision and forks a fresh draft.
 * Live settings (checkout) are not versioned and apply immediately.
 */
import type { CoreContext } from '../ports'
import type { Actor, StorefrontContent, StorefrontContentSection, StorefrontPage, StorefrontRevision, StorefrontSettings, StorefrontState } from '../domain'
import { conflict, forbidden, invalid, notFound } from '../errors'
import { requirePermission } from '../services/access'
import { audit } from '../services/audit'
import { diffContent, editorView, publishBlockers, resolveDraft } from '../services/storefront'

/** How many superseded published revisions are kept. */
const HISTORY_LIMIT = 10

type ContentPatch = Partial<Pick<StorefrontContent, StorefrontContentSection>>

const CONTENT_SECTIONS: StorefrontContentSection[] = ['theme', 'nav', 'footerNav', 'templates', 'locales', 'seo']

/** Fork a new draft from a published revision (fresh id, version and preview token). */
export function forkDraft(ctx: CoreContext, from: StorefrontRevision, actor: string | null): StorefrontRevision {
  const now = ctx.clock.iso()
  return {
    id: ctx.ids.id('sfr'),
    version: from.version + 1,
    status: 'draft',
    content: structuredClone(from.content),
    basedOnVersion: from.version,
    createdAt: now,
    updatedAt: now,
    updatedBy: actor,
    publishedAt: null,
    publishedBy: null,
    previewToken: ctx.ids.token(32),
  }
}

function touchDraft(ctx: CoreContext, state: StorefrontState, actor: Actor) {
  state.draft.updatedAt = ctx.clock.iso()
  state.draft.updatedBy = actor.name
}

export function updateStorefrontDraft(ctx: CoreContext, p: { patch: ContentPatch; actor: Actor }) {
  requirePermission(ctx, p.actor, 'storefront.manage')
  const state = ctx.repo.storefront.get()
  const keys = Object.keys(p.patch) as StorefrontContentSection[]
  const unknown = keys.filter((k) => !CONTENT_SECTIONS.includes(k))
  if (unknown.length) throw invalid(`Not storefront content: ${unknown.join(', ')}`)
  if (p.patch.templates && p.patch.templates.filter((t) => t.isDefault).length !== 1) throw invalid('Exactly one service page template must be the default')
  for (const k of keys) Object.assign(state.draft.content, { [k]: structuredClone(p.patch[k]) })
  touchDraft(ctx, state, p.actor)
  audit(ctx, { actor: p.actor, action: 'storefront.draft_updated', target: { type: 'storefront', id: state.draft.id, label: `Draft v${state.draft.version}` }, summary: `Saved draft: ${keys.join(', ')}`, permission: 'storefront.manage' })
  return editorView(state)
}

export function saveDraftPage(ctx: CoreContext, p: { page: StorefrontPage; actor: Actor }) {
  requirePermission(ctx, p.actor, 'storefront.manage')
  const state = ctx.repo.storefront.get()
  const pages = state.draft.content.pages
  if (!/^[a-z0-9-]*$/.test(p.page.slug)) throw invalid('Slug may contain lowercase letters, digits and dashes')
  if (pages.some((x) => x.slug === p.page.slug && x.id !== p.page.id)) throw conflict('duplicate_slug', `Another page already uses /${p.page.slug}`)
  if (p.page.visibility !== 'public' && p.page.visibility !== 'hidden') throw invalid('Page visibility must be public or hidden')
  for (const b of p.page.blocks) {
    if (b.type === 'catalog_grid' && 'prices' in (b as object)) throw invalid('Catalog blocks may not store prices')
    if (b.type === 'custom_embed' && /<script|on\w+=|javascript:/i.test(b.html)) throw invalid('Custom embeds may not contain scripts or event handlers')
  }
  const idx = pages.findIndex((x) => x.id === p.page.id)
  if (idx >= 0 && pages[idx]!.kind === 'home' && p.page.visibility !== 'public') throw invalid('The home page must be public')
  const page: StorefrontPage = { ...structuredClone(p.page), updatedAt: ctx.clock.iso() }
  if (idx >= 0) pages[idx] = page
  else pages.push(page)
  touchDraft(ctx, state, p.actor)
  audit(ctx, { actor: p.actor, action: idx >= 0 ? 'storefront.page_saved' : 'storefront.page_created', target: { type: 'storefront_page', id: page.id, label: page.title }, summary: `${idx >= 0 ? 'Saved' : 'Created'} page /${page.slug} in draft v${state.draft.version}`, permission: 'storefront.manage' })
  return page
}

export function deleteDraftPage(ctx: CoreContext, p: { pageId: string; actor: Actor }) {
  requirePermission(ctx, p.actor, 'storefront.manage')
  const state = ctx.repo.storefront.get()
  const page = state.draft.content.pages.find((x) => x.id === p.pageId)
  if (!page) throw notFound('Page', p.pageId)
  if (page.kind === 'home') throw conflict('home_page', 'The home page cannot be deleted')
  state.draft.content.pages = state.draft.content.pages.filter((x) => x.id !== p.pageId)
  touchDraft(ctx, state, p.actor)
  audit(ctx, { actor: p.actor, action: 'storefront.page_deleted', target: { type: 'storefront_page', id: page.id, label: page.title }, summary: `Deleted page /${page.slug} from draft v${state.draft.version}`, severity: 'notice', permission: 'storefront.manage' })
}

/**
 * Publish the saved draft. `expectedDraftUpdatedAt` is the draft the admin
 * reviewed — if someone saved the draft since, publishing is refused instead of
 * shipping changes nobody previewed.
 */
export function publishStorefront(ctx: CoreContext, p: { actor: Actor; expectedDraftUpdatedAt?: string }) {
  requirePermission(ctx, p.actor, 'storefront.manage')
  const state = ctx.repo.storefront.get()
  if (p.expectedDraftUpdatedAt && p.expectedDraftUpdatedAt !== state.draft.updatedAt) {
    throw conflict('draft_changed', 'The draft was changed since you reviewed it — reload and preview it again before publishing')
  }
  const { changes } = diffContent(state.published.content, state.draft.content)
  if (!changes.length) throw conflict('nothing_to_publish', `The draft has no changes since v${state.published.version}`)
  const blockers = publishBlockers(state)
  if (blockers.length) throw invalid(blockers[0]!, { blockers })

  const now = ctx.clock.iso()
  const published: StorefrontRevision = { ...state.draft, content: structuredClone(state.draft.content), status: 'published', publishedAt: now, publishedBy: p.actor.name, previewToken: null }
  const superseded: StorefrontRevision = { ...state.published, status: 'superseded' }
  // Single assignment of the whole state — readers see either the old or the new site, never a mix.
  ctx.repo.storefront.set({
    settings: state.settings,
    published,
    draft: forkDraft(ctx, published, p.actor.name),
    history: [superseded, ...state.history].slice(0, HISTORY_LIMIT),
  })
  audit(ctx, {
    actor: p.actor,
    action: 'storefront.published',
    target: { type: 'storefront', id: published.id, label: `v${published.version} · ${state.settings.domain.primary}` },
    summary: `Published storefront v${published.version} (${changes.length} change${changes.length === 1 ? '' : 's'}: ${changes.map((c) => c.label).join('; ')})`,
    severity: 'notice',
    permission: 'storefront.manage',
  })
  return editorView(ctx.repo.storefront.get())
}

/** Throw away all draft edits: the draft becomes a fresh copy of the published revision. */
export function discardStorefrontDraft(ctx: CoreContext, p: { actor: Actor }) {
  requirePermission(ctx, p.actor, 'storefront.manage')
  const state = ctx.repo.storefront.get()
  const { changes } = diffContent(state.published.content, state.draft.content)
  ctx.repo.storefront.set({ ...state, draft: forkDraft(ctx, state.published, p.actor.name) })
  audit(ctx, { actor: p.actor, action: 'storefront.draft_discarded', target: { type: 'storefront', id: state.draft.id, label: `Draft v${state.draft.version}` }, summary: `Discarded draft v${state.draft.version} (${changes.length} unpublished change${changes.length === 1 ? '' : 's'})`, severity: 'notice', permission: 'storefront.manage' })
  return editorView(ctx.repo.storefront.get())
}

/** Live (unversioned) commerce settings. */
export function updateStorefrontSettings(ctx: CoreContext, p: { patch: Partial<Pick<StorefrontSettings, 'checkout'>>; actor: Actor }) {
  requirePermission(ctx, p.actor, 'storefront.manage')
  const state = ctx.repo.storefront.get()
  const keys = Object.keys(p.patch)
  if (keys.some((k) => k !== 'checkout')) throw invalid('Only checkout settings can be changed here')
  if (p.patch.checkout) state.settings.checkout = structuredClone(p.patch.checkout)
  audit(ctx, { actor: p.actor, action: 'storefront.settings_updated', target: { type: 'storefront', id: 'settings', label: keys.join(', ') }, summary: `Updated live storefront settings: ${keys.join(', ')}`, severity: 'notice', permission: 'storefront.manage' })
  return editorView(state)
}

/** Resolve the draft for an admin preview link. A stale or forged token never falls back to anything. */
export function previewStorefront(ctx: CoreContext, token: string) {
  const state = ctx.repo.storefront.get()
  if (!token || token !== state.draft.previewToken) throw forbidden('preview_invalid', 'This preview link is invalid or has expired — open a new preview from the storefront editor')
  return resolveDraft(state)
}
