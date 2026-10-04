/**
 * Storefront — catalog-driven, typed blocks.
 *
 * Pages are lists of typed blocks. Catalog blocks reference services by id or
 * query; they never store prices, field lists or availability. The renderer
 * resolves those live from the catalog + pricing engine, so a price change in
 * the admin shows up on the website without touching any page.
 *
 * Content (pages, blocks, navigation, theme, templates, SEO) is versioned:
 * admins edit a DRAFT revision, preview it with an admin-only token, and
 * PUBLISH it atomically. The public site only ever renders the published
 * revision. The operational catalog is never versioned with content.
 */
import type { ISODate } from './common'

export interface StorefrontLink {
  label: string
  target: StorefrontTarget
}

export type StorefrontTarget =
  | { kind: 'page'; pageId: string }
  | { kind: 'category'; categoryId: string }
  | { kind: 'service'; serviceId: string }
  | { kind: 'search'; query: string }
  | { kind: 'track' }
  | { kind: 'account' }
  | { kind: 'url'; url: string }

export interface CatalogQuery {
  categoryId?: string
  serviceIds?: string[]
  featured?: boolean
  tag?: string
  limit: number
  sort: 'popular' | 'price_asc' | 'name'
}

export type Block =
  | { id: string; type: 'hero'; eyebrow: string; title: string; subtitle: string; primary: StorefrontLink; secondary: StorefrontLink | null; search: boolean; mediaId: string | null }
  | { id: string; type: 'rich_text'; title: string; body: string }
  | { id: string; type: 'image'; mediaId: string; caption: string; width: 'content' | 'wide' }
  | { id: string; type: 'faq'; title: string; items: { q: string; a: string }[] }
  | { id: string; type: 'testimonials'; title: string; items: { quote: string; name: string; role: string }[] }
  | { id: string; type: 'cta'; title: string; body: string; cta: StorefrontLink; tone: 'brand' | 'neutral' }
  | { id: string; type: 'catalog_grid'; title: string; subtitle: string; query: CatalogQuery; showPrices: boolean; layout: 'grid' | 'list' }
  | { id: string; type: 'service_spotlight'; serviceId: string; title: string; body: string }
  | { id: string; type: 'category_tiles'; title: string; categoryIds: string[] | 'all' }
  | { id: string; type: 'trust_bar'; items: { label: string; value: string }[] }
  | { id: string; type: 'steps'; title: string; items: { title: string; body: string }[] }
  | { id: string; type: 'quick_check'; title: string; serviceId: string; body: string }
  | { id: string; type: 'custom_embed'; label: string; html: string }

export type BlockType = Block['type']

export interface StorefrontPage {
  id: string
  slug: string
  title: string
  kind: 'home' | 'page' | 'legal'
  /**
   * Whether the page is reachable on the site once its revision is published.
   * Hidden pages are still drafted, previewed and published with the rest of the
   * content — they are simply not routable (e.g. a campaign page in preparation).
   */
  visibility: 'public' | 'hidden'
  blocks: Block[]
  seo: { title: string; description: string; noindex: boolean }
  /** Last time this page was edited in a draft. */
  updatedAt: ISODate
}

export interface StorefrontNavItem {
  id: string
  label: string
  target: StorefrontTarget
  highlight?: boolean
}

export type ServiceTemplateSection = 'form' | 'description' | 'result_preview' | 'turnaround' | 'faq' | 'related' | 'trust'

export interface ServiceTemplate {
  id: string
  name: string
  description: string
  sections: ServiceTemplateSection[]
  isDefault: boolean
}

export interface MediaAsset {
  id: string
  name: string
  kind: 'image' | 'logo' | 'icon'
  width: number
  height: number
  sizeKb: number
  /** CSS background (gradient / svg data) — demo assets are generated, not uploaded. */
  preview: string
  alt: string
  uploadedAt: ISODate
}

export interface StorefrontTheme {
  presetId: string
  brandName: string
  logoText: string
  colors: { primary: string; accent: string; background: string; surface: string; text: string; muted: string }
  radius: number
  fontHeading: string
  fontBody: string
  mode: 'light' | 'dark'
}

/* ------------------------------------------------------------------------- */
/*  Content vs. live settings                                                */
/* ------------------------------------------------------------------------- */

/**
 * Storefront CONTENT — everything that goes through Draft → Preview → Publish.
 * Edits only ever change the draft revision; visitors are served the published one.
 */
export interface StorefrontContent {
  theme: StorefrontTheme
  pages: StorefrontPage[]
  nav: StorefrontNavItem[]
  footerNav: StorefrontNavItem[]
  /** Section layout of catalog-driven service pages. */
  templates: ServiceTemplate[]
  locales: { default: string; enabled: { code: string; name: string; completeness: number }[] }
  seo: { titleSuffix: string; defaultDescription: string; analyticsId: string | null; sitemap: boolean }
}

export type StorefrontContentSection = Exclude<keyof StorefrontContent, 'pages'>

/**
 * Live site settings — infrastructure and commerce configuration, not versioned.
 * Changes apply immediately (like the catalog, pricing and supplier availability,
 * which are never part of storefront content at all).
 */
export interface StorefrontSettings {
  /** Asset library. Content references assets by id. */
  media: MediaAsset[]
  domain: { primary: string; aliases: string[]; tls: 'active' | 'pending'; verifiedAt: ISODate | null }
  checkout: { guestCheckout: boolean; methods: string[]; termsPageId: string | null }
}

/* ------------------------------------------------------------------------- */
/*  Revisions                                                                */
/* ------------------------------------------------------------------------- */

/** draft → published → superseded (kept in history, never edited again). */
export type StorefrontRevisionStatus = 'draft' | 'published' | 'superseded'

export interface StorefrontRevision {
  id: string
  /** Monotonic. A draft carries the version it will get when published. */
  version: number
  status: StorefrontRevisionStatus
  content: StorefrontContent
  /** Published version this draft was forked from. */
  basedOnVersion: number | null
  createdAt: ISODate
  updatedAt: ISODate
  updatedBy: string | null
  publishedAt: ISODate | null
  publishedBy: string | null
  /**
   * Unguessable token that unlocks previewing this draft on the public site.
   * Rotates whenever a new draft is forked (publish / discard), so old preview
   * links stop working. Null on published revisions.
   */
  previewToken: string | null
}

/** Persisted storefront state: exactly one draft and one published revision. */
export interface StorefrontState {
  settings: StorefrontSettings
  draft: StorefrontRevision
  published: StorefrontRevision
  /** Superseded published revisions, newest first. */
  history: StorefrontRevision[]
}

export interface StorefrontRevisionRef {
  id: string
  version: number
  status: StorefrontRevisionStatus
  updatedAt: ISODate
  updatedBy: string | null
  publishedAt: ISODate | null
  publishedBy: string | null
}

/**
 * A renderable storefront: one revision's content merged with the live settings.
 * `revision` says which revision the content came from.
 */
export interface StorefrontConfig extends StorefrontContent, StorefrontSettings {
  revision: StorefrontRevisionRef
}

/** One difference between the draft and the published revision. */
export interface StorefrontChange {
  kind: 'page_added' | 'page_removed' | 'page_changed' | 'section_changed'
  /** Page id, or the content section key. */
  target: string
  label: string
}

/** Publishing status shown in the editor. */
export interface StorefrontPublishing {
  draft: StorefrontRevisionRef & { basedOnVersion: number | null }
  published: StorefrontRevisionRef
  /** Draft content differs from published content. */
  hasUnpublishedChanges: boolean
  changes: StorefrontChange[]
  /** Reasons the draft cannot be published (it would produce a broken live site). */
  blockers: string[]
  /** Per draft page: does it differ from the published revision? */
  pageStates: Record<string, 'new' | 'changed' | 'unchanged'>
  /** Path to preview the draft on the real storefront (admin-only token). */
  previewPath: string
  history: StorefrontRevisionRef[]
}

/** What the admin editor works on: the DRAFT revision + live settings + publishing status. */
export interface StorefrontEditorView extends StorefrontConfig {
  publishing: StorefrontPublishing
}
