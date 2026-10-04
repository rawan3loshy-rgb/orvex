import { useState, type CSSProperties, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, CreditCard, Eye, EyeOff, GripVertical, Link2, Monitor, Plus, Store, Wallet } from 'lucide-react'
import { ServiceIcon } from '@/components/brand'
import { CodeBlock, Segmented } from '@/components/ui'
import { money } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Container, MockFrame, Reveal, Section, SectionHeader } from './shared'
import { EASE } from './sharedUtils'
import { ICON_BUCKET, svc } from './demo'

type SectionId = 'hero' | 'services' | 'steps' | 'pricing' | 'faq' | 'custom'

const SECTIONS: { id: SectionId; name: string; type: string }[] = [
  { id: 'hero', name: 'Hero + IMEI search', type: 'hero' },
  { id: 'services', name: 'Service grid', type: 'service_grid' },
  { id: 'steps', name: 'How it works', type: 'steps' },
  { id: 'pricing', name: 'Reseller program', type: 'tier_cta' },
  { id: 'faq', name: 'FAQ', type: 'faq' },
  { id: 'custom', name: 'Trust banner', type: 'custom_embed' },
]

/** The customer's own site palette (UnlockDesk brand) — theme-independent swatches. */
const ACCENTS = [
  { name: 'Emerald', value: '#0e7c66' },
  { name: 'Signal', value: '#d9482b' },
  { name: 'Plum', value: '#8a4a7a' },
  { name: 'Ochre', value: '#a8690c' },
]

type Radius = 'sharp' | 'soft' | 'round'
const RADIUS: Record<Radius, string> = { sharp: '2px', soft: '8px', round: '16px' }
type Font = 'sans' | 'display'
type View = 'preview' | 'config'

/** Typed block configuration — blocks reference services by query; prices are resolved live per visitor tier. */
const CONFIG: Record<SectionId, string> = {
  hero: `{
  "type": "hero",
  "eyebrow": "IMEI checks · Carrier & warranty · Official unlocks",
  "title": "Check any IMEI. Unlock eligible phones.",
  "search": { "enabled": true, "placeholder": "IMEI or serial" },
  "cta": { "label": "Browse services", "href": "/services" }
}`,
  services: `{
  "type": "service_grid",
  "source": { "query": "featured", "limit": 3 },
  "show": ["name", "turnaround", "price"]
}
// price is never stored here — it is quoted live
// for the visitor's tier (guests see Retail)`,
  steps: `{
  "type": "steps",
  "items": ["Enter the IMEI", "Pay by card or wallet", "Track the result privately"]
}`,
  pricing: `{
  "type": "tier_cta",
  "tiers": ["tier_silver", "tier_gold"],
  "cta": { "label": "Apply for a reseller account", "href": "/apply" }
}`,
  faq: `{
  "type": "faq",
  "items": "faq_storefront_default"
}`,
  custom: `{
  "type": "custom_embed",
  "sandbox": "allow-scripts",
  "src": "embed_trust_banner_v2"
}
// rendered in a sandboxed iframe —
// cannot read sessions, cart or prices`,
}

const soft = (pct: number) => `color-mix(in oklab, var(--site-accent) ${pct}%, transparent)`

function Block({ id, selected, onSelect, children, label }: { id: SectionId; selected: boolean; onSelect: (id: SectionId) => void; children: ReactNode; label: string }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: EASE }}
      onClick={() => onSelect(id)}
      className={cn('relative cursor-pointer outline-offset-[-1px] transition-[outline-color]', selected ? 'outline-2 outline-dashed' : 'outline-1 outline-transparent hover:outline-dashed hover:outline-line-strong')}
      style={selected ? { outlineColor: 'var(--site-accent)' } : undefined}
    >
      {selected && (
        <span className="absolute top-0 left-0 z-[1] rounded-br-md px-1.5 py-0.5 font-mono text-[9.5px] text-white" style={{ background: 'var(--site-accent)' }}>
          {label}
        </span>
      )}
      {children}
    </motion.div>
  )
}

function SitePreview({ visible, selected, onSelect, font }: { visible: Record<SectionId, boolean>; selected: SectionId; onSelect: (id: SectionId) => void; font: Font }) {
  const display = font === 'display' ? 'font-display' : 'font-sans'
  const r = 'var(--site-radius)'
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-bg text-fg">
      {/* site nav */}
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="flex items-center gap-1.5">
          <span className="grid size-5 place-items-center text-[10px] font-bold text-white" style={{ background: 'var(--site-accent)', borderRadius: 'calc(var(--site-radius) * 0.6)' }}>
            U
          </span>
          <span className={cn('text-[12px] font-semibold', display)}>UnlockDesk</span>
        </span>
        <span className="hidden items-center gap-3 text-[10.5px] text-fg-3 sm:flex">
          <span>Services</span>
          <span>Track order</span>
          <span>Resellers</span>
        </span>
        <span className="px-2 py-1 text-[10px] font-medium text-white" style={{ background: 'var(--site-accent)', borderRadius: r }}>
          Sign in
        </span>
      </div>
      <AnimatePresence initial={false}>
        {visible.hero && (
          <Block key="hero" id="hero" label="Hero" selected={selected === 'hero'} onSelect={onSelect}>
            <div className="px-5 pt-7 pb-6 text-center" style={{ background: `linear-gradient(180deg, ${soft(10)}, transparent)` }}>
              <div className="font-mono text-[9px] tracking-[0.12em] uppercase" style={{ color: 'var(--site-accent)' }}>
                IMEI checks · Carrier & warranty · Official unlocks
              </div>
              <div className={cn('mx-auto mt-2 max-w-[340px] text-[19px] leading-[1.15] font-semibold tracking-[-0.02em]', display)}>Check any IMEI. Unlock eligible phones.</div>
              <div className="mx-auto mt-2 max-w-[300px] text-[11px] text-fg-3">GSMA blacklist checks, carrier checks and carrier-authorised unlocks — instant results and private order tracking.</div>
              <div className="mx-auto mt-3 flex max-w-[260px] items-center gap-1.5 border border-line bg-surface px-2 py-1.5 text-left" style={{ borderRadius: r }}>
                <span className="flex-1 truncate font-mono text-[10px] text-fg-3">IMEI · 356938035643809</span>
                <span className="px-2 py-0.5 text-[9.5px] font-medium text-white" style={{ background: 'var(--site-accent)', borderRadius: `calc(${r} * 0.7)` }}>
                  Check
                </span>
              </div>
              <div className="mt-3 flex justify-center gap-2">
                <span className="px-3 py-1.5 text-[10.5px] font-medium text-white" style={{ background: 'var(--site-accent)', borderRadius: r }}>
                  Browse services
                </span>
                <span className="border border-line-strong px-3 py-1.5 text-[10.5px] font-medium text-fg-2" style={{ borderRadius: r }}>
                  API docs
                </span>
              </div>
            </div>
          </Block>
        )}
        {visible.services && (
          <Block key="services" id="services" label="Service grid" selected={selected === 'services'} onSelect={onSelect}>
            <div className="grid grid-cols-3 gap-2 px-4 py-4">
              {['4001', '4006', '4040'].map((code) => {
                const x = svc(code)
                return { n: x.name, i: x.icon, c: ICON_BUCKET[x.category], p: x.tiers.retail }
              }).map((s) => (
                <div key={s.n} className="border border-line bg-surface p-2.5" style={{ borderRadius: r }}>
                  <ServiceIcon icon={s.i} category={s.c} size="sm" className="size-6" />
                  <div className={cn('mt-2 truncate text-[10.5px] font-semibold', display)}>{s.n}</div>
                  <div className="font-mono text-[9.5px] text-fg-3">{money(s.p)}</div>
                </div>
              ))}
            </div>
          </Block>
        )}
        {visible.steps && (
          <Block key="steps" id="steps" label="How it works" selected={selected === 'steps'} onSelect={onSelect}>
            <div className="grid grid-cols-3 gap-3 px-4 py-4">
              {['Enter the IMEI', 'Pay or use wallet', 'Track privately'].map((t, i) => (
                <div key={t} className="flex items-center gap-2">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full text-[9.5px] font-semibold" style={{ background: soft(16), color: 'var(--site-accent)' }}>
                    {i + 1}
                  </span>
                  <span className="truncate text-[10px] text-fg-2">{t}</span>
                </div>
              ))}
            </div>
          </Block>
        )}
        {visible.pricing && (
          <Block key="pricing" id="pricing" label="Pricing" selected={selected === 'pricing'} onSelect={onSelect}>
            <div className="grid grid-cols-2 gap-2 px-4 py-4">
              {['Silver', 'Gold'].map((p, i) => (
                <div key={p} className="border p-2.5" style={{ borderRadius: r, borderColor: i === 1 ? 'var(--site-accent)' : 'var(--line)', background: i === 1 ? soft(7) : 'var(--surface)' }}>
                  <div className={cn('text-[10.5px] font-semibold', display)}>{p}</div>
                  <div className="mt-1 h-1.5 w-2/3 rounded-full bg-fg/10" />
                  <div className="mt-1 h-1.5 w-1/2 rounded-full bg-fg/[0.07]" />
                </div>
              ))}
            </div>
          </Block>
        )}
        {visible.faq && (
          <Block key="faq" id="faq" label="FAQ" selected={selected === 'faq'} onSelect={onSelect}>
            <div className="space-y-1.5 px-4 py-4">
              {[72, 58, 64].map((w) => (
                <div key={w} className="flex items-center justify-between border-b border-line pb-1.5">
                  <span className="h-1.5 rounded-full bg-fg/10" style={{ width: `${w}%` }} />
                  <Plus className="size-3 text-fg-3" />
                </div>
              ))}
            </div>
          </Block>
        )}
        {visible.custom && (
          <Block key="custom" id="custom" label="Custom embed · sandboxed" selected={selected === 'custom'} onSelect={onSelect}>
            <div className="px-4 pt-1 pb-4">
              <div className="py-2 text-center text-[10.5px] text-fg-2" style={{ background: soft(9), borderRadius: r }}>
                Trusted by{' '}
                <strong className="font-semibold" style={{ color: 'var(--site-accent)' }}>
                  1,200+
                </strong>{' '}
                repair shops worldwide
              </div>
            </div>
          </Block>
        )}
      </AnimatePresence>
    </div>
  )
}

function Editor() {
  const [visible, setVisible] = useState<Record<SectionId, boolean>>({ hero: true, services: true, steps: true, pricing: true, faq: true, custom: true })
  const [selected, setSelected] = useState<SectionId>('hero')
  const [accent, setAccent] = useState(ACCENTS[0]!.value)
  const [radius, setRadius] = useState<Radius>('soft')
  const [font, setFont] = useState<Font>('display')
  const [view, setView] = useState<View>('preview')
  const vars = { '--site-accent': accent, '--site-radius': RADIUS[radius] } as CSSProperties
  const sel = SECTIONS.find((s) => s.id === selected)!

  return (
    <MockFrame
      path="portal.unlockdesk-demo.com/admin/storefront"
      right={
        <span className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 text-[11.5px] text-fg-3 sm:flex">
            <Check className="size-3.5 text-success" />
            Saved
          </span>
          <span className="rounded-md bg-accent px-2 py-0.5 text-[11.5px] font-medium text-accent-fg">Publish</span>
        </span>
      }
    >
      <div className="grid lg:grid-cols-[200px_minmax(0,1fr)_228px]" style={vars}>
        {/* sections */}
        <div className="border-b border-line p-3 lg:border-r lg:border-b-0">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="mono-label">Blocks</span>
            <Plus className="size-3.5 text-fg-3" />
          </div>
          <ul className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {SECTIONS.map((s) => {
              const on = visible[s.id]
              const isSel = s.id === selected
              return (
                <li key={s.id} className="shrink-0">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(s.id)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSelected(s.id))}
                    className={cn('group flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[12.5px] transition-colors', isSel ? 'border-line-strong bg-surface-2 text-fg' : 'border-transparent text-fg-2 hover:bg-surface-2/60', !on && 'opacity-50')}
                  >
                    <GripVertical className="hidden size-3.5 text-fg-3 lg:block" />
                    <span className="flex-1 whitespace-nowrap">{s.name}</span>
                    <span className="hidden font-mono text-[9.5px] text-fg-3 xl:inline">{s.type}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setVisible((v) => ({ ...v, [s.id]: !v[s.id] }))
                      }}
                      className="grid size-5 place-items-center rounded text-fg-3 hover:bg-surface-3 hover:text-fg"
                      aria-label={on ? `Hide ${s.name}` : `Show ${s.name}`}
                    >
                      {on ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        {/* canvas */}
        <div className="min-w-0 bg-bg-subtle/60 p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Segmented size="xs" items={[{ value: 'preview', label: 'Preview', icon: <Monitor /> }, { value: 'config', label: 'Block config' }]} value={view} onChange={setView} />
            <span className="truncate font-mono text-[11px] text-fg-3">{sel.name} · {sel.type}</span>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={view === 'preview' ? 'p' : `${view}-${selected}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {view === 'preview' ? (
                <SitePreview visible={visible} selected={selected} onSelect={setSelected} font={font} />
              ) : (
                <CodeBlock lang="json" code={CONFIG[selected]} lineNumbers className="bg-surface" />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* theme */}
        <div className="space-y-5 border-t border-line p-4 lg:border-t-0 lg:border-l">
          <div>
            <div className="mono-label mb-2">Accent</div>
            <div className="flex gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.name}
                  type="button"
                  onClick={() => setAccent(a.value)}
                  className={cn('relative grid size-8 place-items-center rounded-full ring-offset-2 ring-offset-surface transition-shadow', accent === a.value ? 'ring-2 ring-fg/60' : 'hover:ring-1 hover:ring-line-strong')}
                  style={{ background: a.value }}
                  aria-label={`${a.name} accent`}
                >
                  {accent === a.value && <Check className="size-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mono-label mb-2">Corner radius</div>
            <Segmented size="xs" items={[{ value: 'sharp', label: 'Sharp' }, { value: 'soft', label: 'Soft' }, { value: 'round', label: 'Round' }]} value={radius} onChange={setRadius} />
          </div>
          <div>
            <div className="mono-label mb-2">Heading font</div>
            <Segmented size="xs" items={[{ value: 'display', label: 'Archivo' }, { value: 'sans', label: 'Geist' }]} value={font} onChange={setFont} />
          </div>
          <div className="rounded-lg border border-line bg-bg-subtle/60 p-2.5 font-mono text-[10.5px] leading-[1.7] text-fg-3">
            <div>
              --site-accent: <span className="text-fg-2">{ACCENTS.find((a) => a.value === accent)?.name.toLowerCase()}</span>
            </div>
            <div>
              --site-radius: <span className="text-fg-2">{RADIUS[radius]}</span>
            </div>
            <div>
              --site-font: <span className="text-fg-2">{font === 'display' ? 'archivo' : 'geist'}</span>
            </div>
          </div>
        </div>
      </div>
    </MockFrame>
  )
}

const CHANNEL_CARDS: { icon: typeof Store; title: string; body: string; lines: [string, string][] }[] = [
  {
    icon: CreditCard,
    title: 'Checkout & guest tracking',
    body: 'Guests and signed-in customers pay through a payment intent; the order is placed only when payment succeeds. Guests get a private tracking link — no account needed.',
    lines: [
      ['IMEI Blacklist Check (GSMA)', '$0.90'],
      ['Payment · Demo Card Gateway', 'succeeded'],
      ['Tracking', '/t/9xQ2…k4  (private)'],
    ],
  },
  {
    icon: Store,
    title: 'Reseller portal',
    body: 'ABC GSM signs in to its own portal: the catalog at its Gold prices, orders, wallet statements, members, API keys and webhooks. Customers see “under review” — never your supplier details.',
    lines: [
      ['ABC GSM · Gold', 'available $842.50'],
      ['Held for open orders', '$27.00'],
      ['Credit limit', '$250.00'],
    ],
  },
]

function ChannelCards() {
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      {CHANNEL_CARDS.map((c, i) => (
        <Reveal key={c.title} delay={0.1 + i * 0.05}>
          <div className="h-full rounded-2xl border border-line bg-surface p-5 shadow-card">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-lg border border-line bg-surface-2 text-fg-2">
                <c.icon className="size-4" />
              </span>
              <span className="text-[14.5px] font-semibold text-fg">{c.title}</span>
            </div>
            <p className="mt-2.5 text-[13px] leading-relaxed text-fg-2">{c.body}</p>
            <div className="mt-4 divide-y divide-line overflow-hidden rounded-lg border border-line">
              {c.lines.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3 bg-bg-subtle/50 px-3 py-2 text-[12px]">
                  <span className="truncate text-fg-2">{k}</span>
                  <span className="shrink-0 font-mono text-fg tabular">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  )
}

export function WebsiteBuilderSection() {
  return (
    <Section id="website">
      <Container>
        <SectionHeader
          index="10"
          eyebrow="Storefront & reseller portal"
          title="Your storefront and reseller portal, driven by the catalog."
          description="Compose your public storefront from typed blocks — IMEI search, service grids, tier call-to-action, FAQ — that reference services, not copies of them. Prices are quoted live for each visitor’s tier; custom code runs only in a sandboxed embed."
        />
        <Reveal delay={0.08} className="mt-12 lg:mt-14">
          <Editor />
        </Reveal>
        <ChannelCards />
        <p className="mt-4 flex items-center gap-2 text-[12px] text-fg-3">
          <Link2 className="size-3.5" />
          <Wallet className="size-3.5" />
          Storefront, portal, Native API and DHRU orders all enter the same PlaceOrder command and post to the same ledger.
        </p>
      </Container>
    </Section>
  )
}
