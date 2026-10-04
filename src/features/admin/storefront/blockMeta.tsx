/**
 * Typed block metadata, defaults, summaries and validation (no components).
 * Catalog blocks only store references (service ids / a query) — never prices,
 * fields or availability.
 */
import type { ReactNode } from 'react'
import { CircleCheck, CircleHelp, Code, Footprints, Grid3x3, Image, LayoutGrid, Megaphone, MessageSquareQuote, ScanBarcode, Sparkles, Star, Type } from 'lucide-react'
import type { Block, BlockType, StorefrontConfig, StorefrontLink } from '@/types/installation'
import { uid } from './editorUtils'

export const BLOCK_META: Record<BlockType, { label: string; description: string; icon: ReactNode; catalog?: boolean }> = {
  hero: { label: 'Hero', description: 'Headline, subtitle, search box and two links', icon: <Sparkles /> },
  rich_text: { label: 'Text', description: 'Title and paragraphs', icon: <Type /> },
  image: { label: 'Image', description: 'Media library image with caption', icon: <Image /> },
  faq: { label: 'FAQ', description: 'Accordion of questions and answers', icon: <CircleHelp /> },
  testimonials: { label: 'Testimonials', description: 'Customer quotes', icon: <MessageSquareQuote /> },
  cta: { label: 'Call to action', description: 'Banner with one link', icon: <Megaphone /> },
  catalog_grid: { label: 'Catalog grid', description: 'Services by query or pick — priced live', icon: <LayoutGrid />, catalog: true },
  service_spotlight: { label: 'Service spotlight', description: 'Feature one service — priced live', icon: <Star />, catalog: true },
  category_tiles: { label: 'Category tiles', description: 'Links to catalog categories', icon: <Grid3x3 />, catalog: true },
  trust_bar: { label: 'Trust bar', description: 'Key figures in a row', icon: <CircleCheck /> },
  steps: { label: 'Steps', description: 'Numbered “how it works”', icon: <Footprints /> },
  quick_check: { label: 'Quick check', description: 'Inline IMEI input → service with IMEI prefilled', icon: <ScanBarcode />, catalog: true },
  custom_embed: { label: 'Custom embed', description: 'Sanitised HTML — scripts are stripped', icon: <Code /> },
}

export const BLOCK_ORDER: BlockType[] = ['hero', 'catalog_grid', 'service_spotlight', 'quick_check', 'category_tiles', 'trust_bar', 'steps', 'rich_text', 'image', 'faq', 'testimonials', 'cta', 'custom_embed']

export function newBlock(type: BlockType, config: StorefrontConfig): Block {
  const id = uid('b')
  const link: StorefrontLink = { label: 'Browse services', target: { kind: 'page', pageId: config.pages.find((p) => p.slug === 'services')?.id ?? config.pages[0]?.id ?? '' } }
  switch (type) {
    case 'hero':
      return { id, type, eyebrow: '', title: 'New headline', subtitle: '', primary: link, secondary: null, search: true, mediaId: null }
    case 'rich_text':
      return { id, type, title: 'Title', body: 'First paragraph.\n\nSecond paragraph.' }
    case 'image':
      return { id, type, mediaId: config.media.find((m) => m.kind === 'image')?.id ?? '', caption: '', width: 'wide' }
    case 'faq':
      return { id, type, title: 'Questions', items: [{ q: 'Question?', a: 'Answer.' }] }
    case 'testimonials':
      return { id, type, title: 'What customers say', items: [{ quote: 'Quote', name: 'Name', role: 'Role' }] }
    case 'cta':
      return { id, type, title: 'Ready to start?', body: '', cta: link, tone: 'brand' }
    case 'catalog_grid':
      return { id, type, title: 'Services', subtitle: '', query: { featured: true, limit: 6, sort: 'popular' }, showPrices: true, layout: 'grid' }
    case 'service_spotlight':
      return { id, type, serviceId: '', title: '', body: '' }
    case 'category_tiles':
      return { id, type, title: 'Browse by category', categoryIds: 'all' }
    case 'trust_bar':
      return { id, type, items: [{ label: 'Label', value: 'Value' }] }
    case 'steps':
      return { id, type, title: 'How it works', items: [{ title: 'Step', body: '' }] }
    case 'quick_check':
      return { id, type, title: 'Check an IMEI', serviceId: '', body: '' }
    case 'custom_embed':
      return { id, type, label: 'Embed', html: '<p>Hello</p>' }
  }
}

export function blockSummary(b: Block): string {
  switch (b.type) {
    case 'hero':
    case 'rich_text':
    case 'faq':
    case 'testimonials':
    case 'cta':
    case 'steps':
    case 'category_tiles':
    case 'quick_check':
      return b.title || '—'
    case 'catalog_grid': {
      const q = b.query
      if (q.serviceIds?.length) return `${b.title || 'Untitled'} · ${q.serviceIds.length} picked services`
      return `${b.title || 'Untitled'} · ${[q.categoryId && 'category', q.featured && 'featured', q.tag && `#${q.tag}`].filter(Boolean).join(', ') || 'all services'} · ${q.limit} max`
    }
    case 'service_spotlight':
      return b.title || b.serviceId || '—'
    case 'image':
      return b.caption || b.mediaId
    case 'trust_bar':
      return b.items.map((i) => i.value).join(' · ')
    case 'custom_embed':
      return b.label
  }
}

export const EMBED_FORBIDDEN = /<script|on\w+\s*=|javascript:/i

export function blockErrors(b: Block): string[] {
  const e: string[] = []
  if ((b.type === 'service_spotlight' || b.type === 'quick_check') && !b.serviceId) e.push('Pick a service')
  if (b.type === 'custom_embed' && EMBED_FORBIDDEN.test(b.html)) e.push('Scripts, event handlers and javascript: URLs are not allowed')
  if (b.type === 'catalog_grid' && (b.query.limit < 1 || b.query.limit > 60)) e.push('Limit must be 1–60')
  if (b.type === 'image' && !b.mediaId) e.push('Choose an image')
  return e
}

/* ------------------------------------------------------------------------- */
/*  Form helpers                                                             */
/* ------------------------------------------------------------------------- */
