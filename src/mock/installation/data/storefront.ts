/**
 * DEMO DATA — UnlockDesk storefront (the customer's own website), typed blocks only.
 * Catalog blocks hold service ids / queries — never prices, fields or availability.
 *
 * The site is live at published revision v12; the editor starts on draft v13,
 * an untouched fork of v12 (no unpublished changes).
 */
import type { Block, StorefrontContent, StorefrontRevision, StorefrontSettings, StorefrontState } from '@/core/domain'
import type { IdGenerator } from '@/core/ids'

export function buildStorefront(now: number, ids: IdGenerator): StorefrontState {
  const at = (h: number) => new Date(now - h * 3600_000).toISOString()
  const home: Block[] = [
    { id: 'b_hero', type: 'hero', eyebrow: 'Device checks & official unlocks', title: 'Know a phone before you buy, sell or unlock it.', subtitle: 'Instant IMEI checks, carrier and SIM-lock status, warranty lookups and carrier-authorised unlocks — trusted by repair shops in 40 countries.', primary: { label: 'Check an IMEI', target: { kind: 'service', serviceId: 'svc_4001' } }, secondary: { label: 'Browse services', target: { kind: 'page', pageId: 'pg_services' } }, search: true, mediaId: 'med_hero' },
    { id: 'b_trust', type: 'trust_bar', items: [{ label: 'Checks delivered', value: '1.2M+' }, { label: 'Average result time', value: '< 2 min' }, { label: 'Countries', value: '40' }, { label: 'Refund if we can’t deliver', value: '100%' }] },
    { id: 'b_popular', type: 'catalog_grid', title: 'Most popular', subtitle: 'Live prices from our catalog', query: { featured: true, limit: 6, sort: 'popular' }, showPrices: true, layout: 'grid' },
    { id: 'b_quick', type: 'quick_check', title: 'Check an iPhone 15 now', serviceId: 'svc_4001', body: 'Carrier, SIM-lock and blacklist status in about a minute. Enter the IMEI — we validate it before you pay.' },
    { id: 'b_cats', type: 'category_tiles', title: 'Browse by category', categoryIds: 'all' },
    { id: 'b_steps', type: 'steps', title: 'How it works', items: [{ title: 'Enter the IMEI', body: 'We check the format and Luhn digit instantly, so typos never cost you money.' }, { title: 'Pay securely', body: 'Card, PayPal or your UnlockDesk wallet. Your price is locked when you order.' }, { title: 'Get the result', body: 'Most checks finish in minutes. Track your order with a private link — no account needed.' }] },
    { id: 'b_unlock', type: 'service_spotlight', serviceId: 'svc_4037', title: 'Official T-Mobile unlock for eligible iPhones', body: 'Carrier-authorised, permanent and warranty-safe. We check eligibility first.' },
    { id: 'b_testimonials', type: 'testimonials', title: 'Repair shops use UnlockDesk every day', items: [{ quote: 'Blacklist checks at the counter take seconds now. We stopped buying phones we couldn’t resell.', name: 'Grace O.', role: 'Trade-in desk, London' }, { quote: 'The reseller API just works — idempotent orders, clear statuses, signed webhooks.', name: 'Marcus R.', role: 'MobileHub' }, { quote: 'When a supplier is slow, the order is held safely instead of being charged twice.', name: 'Karim H.', role: 'ABC GSM, Dubai' }] },
    { id: 'b_faq', type: 'faq', title: 'Questions', items: [{ q: 'Do I need an account?', a: 'No. Guest checkout gives you a private tracking link by email. Create an account to keep a wallet and order history.' }, { q: 'What if a check fails?', a: 'If we cannot deliver a result your money is released automatically — you are never charged for a failed order.' }, { q: 'Are unlocks legal?', a: 'We only offer carrier-authorised unlocks for eligible devices and read-only checks. We do not offer activation-lock or account removal.' }] },
    { id: 'b_cta', type: 'cta', title: 'Run a repair shop or trade-in desk?', body: 'Get reseller pricing, a prepaid wallet, bulk ordering and API access.', cta: { label: 'Become a reseller', target: { kind: 'page', pageId: 'pg_resellers' } }, tone: 'brand' },
  ]
  const content: StorefrontContent = {
    theme: { presetId: 'emerald', brandName: 'UnlockDesk', logoText: 'UnlockDesk', colors: { primary: '#0e7c66', accent: '#b7791f', background: '#fcfbf8', surface: '#f3f1eb', text: '#1d1e1c', muted: '#5f605a' }, radius: 10, fontHeading: 'Instrument Sans Variable', fontBody: 'Inter Variable', mode: 'light' },
    pages: [
      { id: 'pg_home', slug: '', title: 'Home', kind: 'home', visibility: 'public', blocks: home, seo: { title: 'UnlockDesk — IMEI checks & official unlocks', description: 'Instant IMEI, carrier, blacklist and warranty checks plus carrier-authorised unlocks.', noindex: false }, updatedAt: at(31) },
      {
        id: 'pg_services',
        slug: 'services',
        title: 'All services',
        kind: 'page',
        visibility: 'public',
        blocks: [
          { id: 'b_s_hero', type: 'rich_text', title: 'All services', body: 'Every service below is priced live from our catalog. Prices shown are what you pay.' },
          { id: 'b_s_imei', type: 'catalog_grid', title: 'IMEI Checks', subtitle: '', query: { categoryId: 'cat_imei', limit: 20, sort: 'popular' }, showPrices: true, layout: 'list' },
          { id: 'b_s_carrier', type: 'catalog_grid', title: 'Carrier & Network', subtitle: '', query: { categoryId: 'cat_carrier', limit: 20, sort: 'popular' }, showPrices: true, layout: 'list' },
          { id: 'b_s_unlock', type: 'catalog_grid', title: 'Unlock Codes', subtitle: 'Carrier-authorised — eligible devices only', query: { categoryId: 'cat_unlock', limit: 20, sort: 'popular' }, showPrices: true, layout: 'list' },
          { id: 'b_s_warranty', type: 'catalog_grid', title: 'Warranty', subtitle: '', query: { categoryId: 'cat_warranty', limit: 20, sort: 'popular' }, showPrices: true, layout: 'list' },
          { id: 'b_s_device', type: 'catalog_grid', title: 'Device Information', subtitle: '', query: { categoryId: 'cat_device', limit: 20, sort: 'popular' }, showPrices: true, layout: 'list' },
          { id: 'b_s_serial', type: 'catalog_grid', title: 'Serial Checks', subtitle: '', query: { categoryId: 'cat_serial', limit: 20, sort: 'popular' }, showPrices: true, layout: 'list' },
        ],
        seo: { title: 'All services — UnlockDesk', description: 'Full catalog of IMEI checks, unlock codes and device services.', noindex: false },
        updatedAt: at(52),
      },
      {
        id: 'pg_resellers',
        slug: 'resellers',
        title: 'Reseller program',
        kind: 'page',
        visibility: 'public',
        blocks: [
          { id: 'b_r_hero', type: 'hero', eyebrow: 'For repair shops & distributors', title: 'Wholesale pricing, one wallet, every channel.', subtitle: 'Order from the portal, in bulk, or through our API — or keep your existing DHRU-compatible integration.', primary: { label: 'Apply now', target: { kind: 'url', url: 'mailto:partners@unlockdesk-demo.com' } }, secondary: null, search: false, mediaId: null },
          { id: 'b_r_steps', type: 'steps', title: 'What you get', items: [{ title: 'Tiered pricing', body: 'Silver, Gold and Platinum tiers — your price is calculated live and shown before you order.' }, { title: 'Prepaid wallet', body: 'Top up by card or bank transfer. Funds are only held while an order is open and captured when it completes.' }, { title: 'API & DHRU compatibility', body: 'Native REST API with idempotency keys and signed webhooks — or point your DHRU client at our compatible endpoint.' }] },
          { id: 'b_r_faq', type: 'faq', title: 'Reseller FAQ', items: [{ q: 'Can I keep my DHRU integration?', a: 'Yes. Use the DHRU-compatible endpoint with your username and API key; statuses are mapped automatically.' }, { q: 'Do you offer credit?', a: 'Established resellers can be granted a credit limit by our finance team.' }] },
        ],
        seo: { title: 'Reseller program — UnlockDesk', description: 'Wholesale pricing, wallet, API and DHRU-compatible endpoint.', noindex: false },
        updatedAt: at(140),
      },
      {
        id: 'pg_about',
        slug: 'about',
        title: 'About',
        kind: 'page',
        visibility: 'public',
        blocks: [
          { id: 'b_a_text', type: 'rich_text', title: 'About UnlockDesk', body: 'UnlockDesk is an independent device-services company based in Dubai. We work with vetted suppliers and only offer legitimate checks and carrier-authorised unlocks.\n\nOur platform runs on our own servers — your order data never leaves our infrastructure.' },
          { id: 'b_a_img', type: 'image', mediaId: 'med_team', caption: 'The UnlockDesk operations desk', width: 'wide' },
        ],
        seo: { title: 'About — UnlockDesk', description: 'Who we are.', noindex: false },
        updatedAt: at(400),
      },
      { id: 'pg_terms', slug: 'terms', title: 'Terms of service', kind: 'legal', visibility: 'public', blocks: [{ id: 'b_t_text', type: 'rich_text', title: 'Terms of service', body: 'Demo terms. Orders are processed by third-party suppliers. Funds are held while an order is open and released automatically if it cannot be completed. Refunds for delivered results are handled through verification requests.' }], seo: { title: 'Terms — UnlockDesk', description: 'Terms of service.', noindex: true }, updatedAt: at(900) },
      { id: 'pg_unlockweek', slug: 'unlock-week', title: 'Unlock Week', kind: 'page', visibility: 'hidden', blocks: [{ id: 'b_u_hero', type: 'hero', eyebrow: 'Campaign in preparation', title: 'Unlock Week — official unlocks for less', subtitle: 'Campaign page in preparation.', primary: { label: 'See unlock services', target: { kind: 'category', categoryId: 'cat_unlock' } }, secondary: null, search: false, mediaId: null }, { id: 'b_u_grid', type: 'catalog_grid', title: 'Official unlocks', subtitle: '', query: { categoryId: 'cat_unlock', tag: 'official', limit: 6, sort: 'price_asc' }, showPrices: true, layout: 'grid' }], seo: { title: 'Unlock Week', description: '', noindex: true }, updatedAt: at(31) },
    ],
    nav: [
      { id: 'n1', label: 'Check an IMEI', target: { kind: 'service', serviceId: 'svc_4006' }, highlight: true },
      { id: 'n2', label: 'IMEI Checks', target: { kind: 'category', categoryId: 'cat_imei' } },
      { id: 'n3', label: 'Unlocks', target: { kind: 'category', categoryId: 'cat_unlock' } },
      { id: 'n4', label: 'All services', target: { kind: 'page', pageId: 'pg_services' } },
      { id: 'n5', label: 'Resellers', target: { kind: 'page', pageId: 'pg_resellers' } },
      { id: 'n6', label: 'Track order', target: { kind: 'track' } },
    ],
    footerNav: [
      { id: 'f1', label: 'About', target: { kind: 'page', pageId: 'pg_about' } },
      { id: 'f2', label: 'Terms', target: { kind: 'page', pageId: 'pg_terms' } },
      { id: 'f3', label: 'Reseller program', target: { kind: 'page', pageId: 'pg_resellers' } },
      { id: 'f4', label: 'Track an order', target: { kind: 'track' } },
    ],
    templates: [
      { id: 'tpl_check', name: 'Instant check', description: 'Form first, result preview, turnaround and FAQ.', sections: ['form', 'result_preview', 'turnaround', 'description', 'faq', 'related'], isDefault: true },
      { id: 'tpl_unlock', name: 'Official unlock', description: 'Eligibility notice and trust section before the form.', sections: ['description', 'trust', 'form', 'turnaround', 'faq', 'related'], isDefault: false },
    ],
    locales: { default: 'en', enabled: [{ code: 'en', name: 'English', completeness: 100 }, { code: 'ar', name: 'العربية (Arabic)', completeness: 86 }, { code: 'es', name: 'Español', completeness: 64 }] },
    seo: { titleSuffix: ' — UnlockDesk', defaultDescription: 'IMEI checks, carrier status and official unlocks.', analyticsId: 'G-DEMO123456', sitemap: true },
  }
  const settings: StorefrontSettings = {
    media: [
      { id: 'med_hero', name: 'hero-device-desk.jpg', kind: 'image', width: 1600, height: 1000, sizeKb: 184, preview: 'linear-gradient(135deg,#0e7c66 0%,#0b5a4a 45%,#1d1e1c 100%)', alt: 'Phones on a repair desk', uploadedAt: at(700) },
      { id: 'med_team', name: 'ops-desk.jpg', kind: 'image', width: 1400, height: 800, sizeKb: 162, preview: 'linear-gradient(120deg,#f3f1eb 0%,#d8d3c4 60%,#b7791f 100%)', alt: 'Operations desk', uploadedAt: at(650) },
      { id: 'med_logo', name: 'unlockdesk-logo.svg', kind: 'logo', width: 240, height: 64, sizeKb: 4, preview: 'linear-gradient(90deg,#0e7c66,#0e7c66)', alt: 'UnlockDesk logo', uploadedAt: at(900) },
      { id: 'med_icon', name: 'favicon.png', kind: 'icon', width: 64, height: 64, sizeKb: 2, preview: 'radial-gradient(circle,#0e7c66 40%,#fcfbf8 41%)', alt: 'Favicon', uploadedAt: at(900) },
    ],
    domain: { primary: 'unlockdesk-demo.com', aliases: ['www.unlockdesk-demo.com'], tls: 'active', verifiedAt: at(5000) },
    checkout: { guestCheckout: true, methods: ['card', 'paypal', 'bank_transfer'], termsPageId: 'pg_terms' },
  }
  const published: StorefrontRevision = { id: ids.id('sfr'), version: 12, status: 'published', content, basedOnVersion: 11, createdAt: at(34), updatedAt: at(31), updatedBy: 'Sarah Chen', publishedAt: at(30), publishedBy: 'Sarah Chen', previewToken: null }
  const draft: StorefrontRevision = { id: ids.id('sfr'), version: 13, status: 'draft', content: structuredClone(content), basedOnVersion: 12, createdAt: at(30), updatedAt: at(30), updatedBy: 'Sarah Chen', publishedAt: null, publishedBy: null, previewToken: ids.token(32) }
  return { settings, published, draft, history: [] }
}
