/**
 * Starter templates offered when creating a new section.
 * They only use theme variables, so they adapt to any theme automatically.
 * Example copy is written for a GSM service storefront (IMEI checks, unlocks,
 * codes) — authors replace it with their own.
 */
import type { SectionType } from '@/types/installation'

export interface SectionTemplate {
  id: string
  name: string
  type: SectionType
  description: string
  html: string
  css: string
  js?: string
}

const ICON = {
  bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
  refund: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 8v8"/></svg>',
}

export const SECTION_TEMPLATES: SectionTemplate[] = [
  {
    id: 'blank',
    name: 'Blank section',
    type: 'custom',
    description: 'A centered heading and paragraph to start from scratch.',
    html: `<section class="block">
  <div class="wrap">
    <h2>New section</h2>
    <p>Write something useful for {{site.name}} customers.</p>
  </div>
</section>`,
    css: `.block { padding: 96px 24px; text-align: center; }
.wrap { max-width: 720px; margin: 0 auto; }
h2 { font-size: clamp(30px, 4vw, 44px); letter-spacing: -0.03em; line-height: 1.1; margin: 0 0 12px; }
p { color: var(--site-muted); font-size: 18px; margin: 0; }`,
  },
  {
    id: 'hero-centered',
    name: 'Centered hero',
    type: 'hero',
    description: 'Eyebrow, headline, lead and two calls to action.',
    html: `<section class="hero">
  <div class="wrap">
    <span class="eyebrow">Official carrier unlocks</span>
    <h1>Unlock your phone by IMEI — permanently</h1>
    <p class="lead">Network unlocks for iPhone, Samsung and Xiaomi from US, UK and EU carriers. Clean-IMEI check included, and your money back if it can’t be done.</p>
    <div class="actions">
      <a class="btn primary" href="/services#unlocking">See unlock prices</a>
      <a class="btn ghost" href="/services#imei">Check an IMEI first</a>
    </div>
  </div>
</section>`,
    css: `.hero { padding: 120px 24px 104px; text-align: center; background: linear-gradient(180deg, var(--site-surface), var(--site-bg)); }
.wrap { max-width: 820px; margin: 0 auto; }
.eyebrow { display: inline-block; font-size: 13px; font-weight: 600; color: var(--site-primary); padding: 6px 12px; border-radius: 999px; background: color-mix(in srgb, var(--site-primary) 10%, transparent); }
h1 { font-size: clamp(38px, 6vw, 64px); line-height: 1.03; letter-spacing: -0.035em; margin: 22px 0 18px; text-wrap: balance; }
.lead { font-size: 19px; color: var(--site-muted); max-width: 620px; margin: 0 auto; }
.actions { margin-top: 34px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.btn { display: inline-flex; align-items: center; height: 48px; padding: 0 22px; border-radius: var(--site-radius); font-weight: 600; text-decoration: none; }
.btn.primary { background: var(--site-primary); color: var(--site-on-primary); }
.btn.ghost { color: var(--site-text); border: 1px solid color-mix(in srgb, var(--site-text) 15%, transparent); }`,
  },
  {
    id: 'feature-grid',
    name: 'Feature grid',
    type: 'features',
    description: 'Three feature cards with icons.',
    html: `<section class="features">
  <div class="wrap">
    <h2>Why customers choose {{site.name}}</h2>
    <div class="grid">
      <article><span class="icon">${ICON.bolt}</span><h3>Fast turnaround</h3><p>IMEI checks in seconds, most network unlocks in 1–6 hours.</p></article>
      <article><span class="icon">${ICON.shield}</span><h3>Clean-IMEI guarantee</h3><p>Every unlock starts with a GSMA blacklist check.</p></article>
      <article><span class="icon">${ICON.refund}</span><h3>Money-back promise</h3><p>If the carrier rejects an unlock, you get a full refund.</p></article>
    </div>
  </div>
</section>`,
    css: `.features { padding: 96px 24px; }
.wrap { max-width: 1100px; margin: 0 auto; }
h2 { font-size: clamp(30px, 3.6vw, 42px); letter-spacing: -0.03em; margin: 0 0 40px; text-align: center; }
.grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
article { padding: 28px; border-radius: calc(var(--site-radius) * 1.3); background: var(--site-surface); border: 1px solid color-mix(in srgb, var(--site-text) 8%, transparent); }
.icon { display: grid; place-items: center; width: 44px; height: 44px; border-radius: var(--site-radius); background: var(--site-bg); color: var(--site-primary); margin-bottom: 18px; }
.icon svg { width: 22px; height: 22px; }
h3 { margin: 0 0 6px; font-size: 18px; }
p { margin: 0; color: var(--site-muted); }
@media (max-width: 760px) { .grid { grid-template-columns: 1fr; } }`,
  },
  {
    id: 'catalog',
    name: 'Live service catalog',
    type: 'services',
    description: 'Heading plus the dynamic service-catalog block.',
    html: `<section class="services">
  <div class="wrap">
    <h2>Popular services</h2>
    <p class="sub">Prices and turnaround update automatically from your catalog.</p>
    <div data-block="service-catalog" data-limit="6"></div>
  </div>
</section>`,
    css: `.services { padding: 96px 24px; background: var(--site-surface); }
.wrap { max-width: 1160px; margin: 0 auto; }
h2 { font-size: clamp(30px, 3.6vw, 42px); letter-spacing: -0.03em; margin: 0; }
.sub { color: var(--site-muted); margin: 8px 0 32px; }`,
  },
  {
    id: 'category-prices',
    name: 'Category price list',
    type: 'services',
    description: 'One category of the live catalog — e.g. only unlock codes.',
    html: `<section class="prices" id="codes">
  <div class="wrap">
    <div class="head">
      <h2>Unlock codes</h2>
      <span class="eta">Instant – 2 h</span>
    </div>
    <p class="sub">NCK, MCK and SP codes for devices that accept code entry. Insert a non-accepted SIM, then enter the code when prompted.</p>
    <div data-block="service-catalog" data-category="Codes" data-limit="9"></div>
  </div>
</section>`,
    css: `.prices { padding: 88px 24px; }
.wrap { max-width: 1160px; margin: 0 auto; }
.head { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
h2 { font-size: clamp(28px, 3.2vw, 38px); letter-spacing: -0.03em; margin: 0; }
.eta { font-size: 13px; font-weight: 600; color: var(--site-primary); padding: 6px 12px; border-radius: 999px; background: color-mix(in srgb, var(--site-primary) 10%, transparent); }
.sub { color: var(--site-muted); margin: 10px 0 30px; max-width: 640px; }`,
  },
  {
    id: 'testimonial',
    name: 'Testimonial',
    type: 'testimonials',
    description: 'A single, large customer quote.',
    html: `<section class="quote">
  <figure>
    <blockquote>“We run a full IMEI report on every trade-in before it hits the shelf. {{site.name}} gives us blacklist, FMI and carrier in one go.”</blockquote>
    <figcaption><strong>Sam Okafor</strong> · Owner, Example Phone Repair (demo)</figcaption>
  </figure>
</section>`,
    css: `.quote { padding: 104px 24px; text-align: center; }
figure { max-width: 820px; margin: 0 auto; }
blockquote { margin: 0; font-family: var(--site-font-heading); font-size: clamp(24px, 3vw, 34px); line-height: 1.3; letter-spacing: -0.02em; }
figcaption { margin-top: 22px; color: var(--site-muted); }
strong { color: var(--site-text); }`,
  },
  {
    id: 'cta-banner',
    name: 'CTA banner',
    type: 'cta',
    description: 'Full-width banner in your primary colour.',
    html: `<section class="cta">
  <div class="box">
    <h2>Check your IMEI in seconds</h2>
    <p>Blacklist, carrier, SIM-lock and FMI status — before you buy, sell or unlock.</p>
    <a class="btn" href="/services#imei">Check an IMEI</a>
  </div>
</section>`,
    css: `.cta { padding: 32px 24px 96px; }
.box { max-width: 1100px; margin: 0 auto; padding: 64px 32px; text-align: center; border-radius: calc(var(--site-radius) * 2); background: var(--site-primary); color: var(--site-on-primary); }
h2 { font-size: clamp(30px, 4vw, 44px); letter-spacing: -0.03em; margin: 0 0 10px; }
p { opacity: .85; margin: 0 0 28px; }
.btn { display: inline-flex; height: 48px; align-items: center; padding: 0 22px; border-radius: var(--site-radius); background: var(--site-on-primary); color: var(--site-primary); font-weight: 600; text-decoration: none; }`,
  },
  {
    id: 'faq',
    name: 'FAQ accordion',
    type: 'faq',
    description: 'Native, accessible disclosure list.',
    html: `<section class="faq">
  <div class="wrap">
    <h2>Questions &amp; answers</h2>
    <details open><summary>How do I find my IMEI?</summary><p>Dial *#06# on the phone’s keypad — the 15-digit IMEI appears on screen. It’s also under Settings → About phone.</p></details>
    <details><summary>What if my phone can’t be unlocked?</summary><p>If the carrier rejects the request, you get a full refund to your card or balance — automatically.</p></details>
    <details><summary>Can you unlock a blacklisted phone?</summary><p>No. Network unlocks need a clean IMEI, so we run a GSMA blacklist check before processing.</p></details>
  </div>
</section>`,
    css: `.faq { padding: 96px 24px; }
.wrap { max-width: 760px; margin: 0 auto; }
h2 { font-size: 36px; letter-spacing: -0.03em; margin: 0 0 24px; }
details { border-bottom: 1px solid color-mix(in srgb, var(--site-text) 10%, transparent); padding: 18px 0; }
summary { cursor: pointer; font-weight: 600; font-size: 17px; }
details p { color: var(--site-muted); margin: 10px 0 0; }`,
  },
  {
    id: 'notice',
    name: 'Announcement bar',
    type: 'custom',
    description: 'A slim notice — holiday hours, carrier delays, promotions.',
    html: `<section class="notice">
  <p><strong>Carrier update:</strong> T-Mobile US unlocks are taking up to 24 h this week. IMEI checks and codes are unaffected.</p>
</section>`,
    css: `.notice { padding: 10px 24px; text-align: center; background: color-mix(in srgb, var(--site-primary) 10%, var(--site-bg)); border-bottom: 1px solid color-mix(in srgb, var(--site-primary) 20%, transparent); }
p { margin: 0; font-size: 14px; color: var(--site-text); }
strong { color: var(--site-primary); }`,
  },
  {
    id: 'ticker',
    name: 'Live counter (JS)',
    type: 'stats',
    description: 'Animated counter — demonstrates sandboxed JavaScript.',
    html: `<section class="ticker">
  <p class="label">Orders completed this month</p>
  <strong class="value" id="count">{{stats.orders}}</strong>
  <p class="hint">Enable JavaScript in the JS tab to animate this counter.</p>
</section>`,
    css: `.ticker { padding: 88px 24px; text-align: center; }
.label { color: var(--site-muted); margin: 0 0 8px; font-weight: 500; }
.value { display: block; font-family: var(--site-font-heading); font-size: clamp(48px, 8vw, 96px); letter-spacing: -0.04em; line-height: 1; color: var(--site-primary); font-variant-numeric: tabular-nums; }
.hint { color: var(--site-muted); font-size: 13px; margin: 16px 0 0; }`,
    js: `// Runs in a sandboxed iframe (allow-scripts, opaque origin).
const el = document.getElementById('count');
const target = parseInt(el.textContent.replace(/[^0-9]/g, ''), 10) || 0;
let current = Math.max(0, target - 120);
document.querySelector('.hint').textContent = 'Updating live';
setInterval(() => {
  current += Math.floor(Math.random() * 3);
  el.textContent = current.toLocaleString('en-US');
}, 900);`,
  },
]
