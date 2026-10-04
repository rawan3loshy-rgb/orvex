import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Check, CodeXml, Database, Globe, LayoutGrid, Lock, MousePointerClick, Plug, Route, Store, type LucideIcon } from 'lucide-react'
import { num } from '@/lib/format'
import { cn } from '@/lib/cn'
import { brand } from '@/config/brand'
import { Container, CornerMarks, CountUp, Reveal, Section, SectionHeader } from './shared'
import { EASE, ringArc, ringPoint } from './sharedUtils'
import { SUPPLIERS as ALL, type SupplierKey } from './demo'
import { SupplierMark } from './SupplierMark'

interface Layer {
  id: string
  name: string
  short: string
  icon: LucideIcon
  description: string
  points: string[]
  modules: string[]
  lives: string
}

const LAYERS: Layer[] = [
  {
    id: 'edge',
    name: 'Customers & resellers',
    short: 'Shoppers, reseller shops, partners, legacy clients',
    icon: Store,
    description: 'Everyone who buys from you: retail customers and guests on your storefront, reseller shops in their portal, partners integrating your API — and resellers who keep their existing DHRU client. None of them ever talks to your suppliers.',
    points: ['Retail, reseller, business & API-only accounts', 'Guests check out and track by private link', 'Each account has its own pricing tier', 'Wallets with credit limits, backed by the ledger'],
    modules: ['Accounts', 'Identity'],
    lives: 'Outside your installation',
  },
  {
    id: 'api',
    name: 'Sales channels',
    short: 'Storefront · reseller portal · Native API · DHRU endpoint',
    icon: CodeXml,
    description: 'Four channels, one entry point. Storefront checkout, the reseller portal, the Native API v1 and the DHRU-compatible endpoint all enter the same PlaceOrder command — same validation, same prices, same ledger postings.',
    points: ['Catalog-driven storefront with checkout', 'Reseller portal: orders, wallet, keys, webhooks', 'Native API v1 · account-scoped idempotency', 'Standard Webhooks signing (webhook-id / -timestamp / -signature)'],
    modules: ['Storefront', 'Resellers', 'Native API', 'DHRU compatibility'],
    lives: `${brand.coreProduct} · core-api`,
  },
  {
    id: 'catalog',
    name: 'Catalog & pricing',
    short: 'Services, field schemas, offers, tiers',
    icon: LayoutGrid,
    description: 'Each service has a versioned field schema from the GSM vertical pack — IMEI (15 digits + Luhn), serial, brand, model, carrier — and a list of supplier offers in priority order. Prices for Retail, Silver, Gold and Platinum are calculated live from the offer cost, never copied.',
    points: ['Service revisions with versioned field schemas', 'Offers in priority order per service', 'Tier rules: fixed, cost + %, cost + fixed, minimum margin', '“Why this price?” on every quote'],
    modules: ['Catalog'],
    lives: `${brand.coreProduct} · catalog module`,
  },
  {
    id: 'engine',
    name: 'Orders, routing & ledger',
    short: 'Priority routing · guarded failover · double-entry',
    icon: Route,
    description: 'Orders are routed to offers in priority order. Only a definitive rejection classified failover-safe moves an order on; a timeout after sending is an UNKNOWN outcome and goes to Needs Review with funds held. Every cent moves through a double-entry ledger: held on order, captured on completion, released on rejection.',
    points: ['Priority routing + guarded failover', 'Margin guard skips offers that would lose money', 'Needs Review for UNKNOWN supplier outcomes', 'Refunds to wallet or original method — capped, idempotent'],
    modules: ['Orders', 'Routing', 'Ledger', 'Payments'],
    lives: `${brand.coreProduct} · core-worker`,
  },
  {
    id: 'adapters',
    name: 'Suppliers & drivers',
    short: 'DHRU Fusion · REST · manual · custom',
    icon: Plug,
    description: 'Drivers speak each supplier’s protocol: the DHRU Fusion driver (HTTP form-POST + JSON, DHRU statuses mapped at the edge), a generic REST driver, a manual fulfilment queue — and custom drivers as extensions. Catalog sync proposes changes for review; reconciliation compares the ledger with supplier balances.',
    points: ['DHRU Fusion, REST & manual drivers built in', 'Custom drivers as extensions — updates never overwrite them', 'Health tracking with circuit breaker', 'Catalog sync review & supplier reconciliation'],
    modules: ['Suppliers', 'Drivers'],
    lives: `${brand.coreProduct} + extensions`,
  },
  {
    id: 'infra',
    name: 'Your server & PostgreSQL',
    short: 'Modular monolith on your infrastructure',
    icon: Database,
    description: 'Core is a modular monolith — core-api, core-worker and core-scheduler behind Caddy — on a server you choose, with its own PostgreSQL. No Kafka, no Redis, no Kubernetes. Orders, accounts, ledger and supplier credentials never leave it.',
    points: ['Docker Compose on any Linux host', 'PostgreSQL job queue — no extra broker', 'Notifications: email, Telegram, WhatsApp', `No operational data sent to ${brand.company}`],
    modules: ['Notifications', 'Audit', 'System · Licensing · Updates'],
    lives: 'Your servers',
  },
]

const SUPPLY: SupplierKey[] = ['alpha', 'beta', 'gamma', 'delta', 'zeta', 'kappa']

/** All Core modules — one codebase, one deployment. */
const MODULES = ['Identity', 'Accounts', 'Catalog', 'Suppliers', 'Drivers', 'Routing', 'Orders', 'Ledger', 'Payments', 'Resellers', 'Storefront', 'Native API', 'DHRU compatibility', 'Notifications', 'Audit', 'System · Licensing · Updates']

/* ------------------------------------------------------------------ */
/*  Schematic                                                          */
/* ------------------------------------------------------------------ */
interface SchematicProps {
  peek: number
  active: number
  onSelect: (i: number) => void
  onHover: (i: number | null) => void
}

function Block({ i, peek, active, onSelect, onHover, className, children }: { i: number; className?: string; children: ReactNode } & SchematicProps) {
  const on = i === peek
  const sel = i === active
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={`Show layer ${LAYERS[i]!.name}`}
      onClick={() => onSelect(i)}
      onMouseEnter={() => onHover(i)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        'group relative block w-full rounded-xl border p-3 text-left transition-[border-color,background-color] duration-300',
        on ? 'border-accent/55 bg-accent/[0.05]' : 'border-line bg-surface hover:border-line-strong',
        className,
      )}
    >
      <span className="flex items-center gap-2">
        <span className={cn('font-mono text-[10.5px] tabular transition-colors', on ? 'text-accent-ink' : 'text-fg-3')}>0{i + 1}</span>
        <span className={cn('truncate text-[12.5px] font-semibold transition-colors', on ? 'text-fg' : 'text-fg-2')}>{LAYERS[i]!.name}</span>
        {sel && <span className="ml-auto size-1.5 shrink-0 rounded-full bg-accent" />}
      </span>
      <span className="mt-2 block">{children}</span>
    </button>
  )
}

function Connector({ label, on, reduce }: { label: string; on: boolean; reduce: boolean }) {
  return (
    <div className="relative flex h-9 items-center justify-center">
      <svg className="absolute inset-y-0 left-1/2 h-full w-2 -translate-x-1/2 overflow-visible" aria-hidden>
        <line x1={4} x2={4} y1={0} y2="100%" stroke="var(--line-strong)" />
        <line x1={4} x2={4} y1={0} y2="100%" stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="3 4" className={cn('transition-opacity duration-300', !reduce && 'animate-dash')} style={{ opacity: on ? 1 : 0 }} />
      </svg>
      <span className={cn('relative mr-auto ml-[calc(50%+14px)] min-w-0 truncate font-mono text-[10px] transition-colors sm:text-[10.5px]', on ? 'text-accent-ink' : 'text-fg-3')}>{label}</span>
    </div>
  )
}

function Tag({ children, on }: { children: ReactNode; on?: boolean }) {
  return <span className={cn('inline-flex h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] whitespace-nowrap transition-colors', on ? 'border-accent/30 text-fg-2' : 'border-line text-fg-3')}>{children}</span>
}

function MiniRing({ on }: { on: boolean }) {
  const [nx, ny] = ringPoint(9, -45)
  return (
    <svg viewBox="-15 -15 30 30" className="size-9 shrink-0" aria-hidden>
      <circle r={14} fill="none" stroke="var(--line-strong)" strokeDasharray="1.5 2.5" />
      <path d={ringArc(9)} fill="none" stroke="var(--fg)" strokeWidth={3.2} />
      <circle cx={nx} cy={ny} r={2.6} fill={on ? 'var(--accent)' : 'var(--fg-3)'} className="transition-[fill] duration-300" />
    </svg>
  )
}

function Schematic(props: SchematicProps) {
  const reduce = !!useReducedMotion()
  const { peek } = props
  return (
    <div className="relative">
      {/* outside — demand */}
      <div className={cn('rounded-xl border border-dashed p-1 transition-colors duration-300', peek === 0 ? 'border-accent/45' : 'border-line-strong')}>
        <div className="px-2 pt-1 pb-1.5 font-mono text-[9.5px] tracking-[0.12em] text-fg-3 uppercase">Outside · demand</div>
        <Block i={0} {...props} className="border-transparent bg-transparent p-2 hover:border-transparent">
          <span className="flex flex-wrap gap-1">
            <Tag on={peek === 0}>
              <Globe className="size-3" />
              storefront guests
            </Tag>
            {['ABC GSM', 'TechRepair Pro'].map((n) => (
              <Tag key={n} on={peek === 0}>
                <Store className="size-3" />
                {n}
              </Tag>
            ))}
            <Tag on={peek === 0}>
              <Plug className="size-3" />
              DHRU client
            </Tag>
          </span>
        </Block>
      </div>

      <Connector label="HTTPS · checkout · portal · /v1 · /api/dhru" on={peek === 0 || peek === 1} reduce={reduce} />

      {/* boundary — your server */}
      <div className={cn('relative rounded-2xl border p-2.5 transition-[border-color,background-color] duration-300 sm:p-3', peek === 5 ? 'border-accent/55 bg-accent/[0.03]' : 'border-line-strong bg-bg/60')}>
        <CornerMarks className="-inset-1.5" />
        <div className="mb-2.5 flex items-center justify-between gap-2 px-0.5">
          <span className={cn('font-mono text-[9.5px] tracking-[0.12em] uppercase transition-colors', peek === 5 ? 'text-accent-ink' : 'text-fg-3')}>Your server · {brand.coreProduct} 2.4.1</span>
          <Lock className="size-3 text-fg-3" />
        </div>
        <div className="space-y-2">
          <Block i={1} {...props}>
            <span className="flex flex-wrap gap-1">
              <Tag on={peek === 1}>checkout</Tag>
              <Tag on={peek === 1}>portal</Tag>
              <Tag on={peek === 1}>POST /v1/orders</Tag>
              <Tag on={peek === 1}>POST /api/dhru</Tag>
              <Tag on={peek === 1}>→ PlaceOrder</Tag>
            </span>
          </Block>
          <div className="grid grid-cols-2 gap-2">
            <Block i={2} {...props}>
              <span className="flex flex-wrap gap-1">
                <Tag on={peek === 2}>54 services</Tag>
                <Tag on={peek === 2}>offers</Tag>
                <Tag on={peek === 2}>4 tiers</Tag>
              </span>
            </Block>
            <Block i={3} {...props}>
              <span className="flex items-center gap-2">
                <MiniRing on={peek === 3} />
                <span className="min-w-0 font-mono text-[10px] leading-snug text-fg-3">
                  priority · guarded
                  <br />
                  hold · capture
                </span>
              </span>
            </Block>
          </div>
          <Block i={4} {...props}>
            <span className="flex flex-wrap gap-1">
              {['DHRU Fusion', 'REST / JSON', 'Manual', 'Custom driver'].map((t) => (
                <Tag key={t} on={peek === 4}>
                  {t}
                </Tag>
              ))}
            </span>
          </Block>
          <Block i={5} {...props} className={cn(peek !== 5 && 'bg-surface-2/60')}>
            <span className="flex flex-wrap items-center gap-1">
              <span className="mr-1 inline-flex items-center gap-1.5 font-mono text-[10.5px] text-fg-2">
                <Database className="size-3.5 text-fg-3" />
                postgres://…/orvex
              </span>
              {['orders', 'accounts', 'ledger_entries'].map((t) => (
                <Tag key={t} on={peek === 5}>
                  {t}
                </Tag>
              ))}
              <Tag on={peek === 5}>
                credentials
                <Lock className="size-2.5" />
              </Tag>
            </span>
          </Block>
        </div>
      </div>

      <Connector label="Supplier APIs · health & circuit breaker" on={peek === 4} reduce={reduce} />

      {/* outside — supply */}
      <div className={cn('rounded-xl border border-dashed px-2 pt-1 pb-2 transition-colors duration-300', peek === 4 ? 'border-accent/45' : 'border-line-strong')}>
        <div className="px-0.5 pt-1 pb-1.5 font-mono text-[9.5px] tracking-[0.12em] text-fg-3 uppercase">Outside · supply</div>
        <div className="flex flex-wrap gap-1.5">
          {SUPPLY.map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface py-0.5 pr-2 pl-0.5 text-[11.5px] text-fg-2">
              <SupplierMark k={k} size="xs" />
              {ALL[k].short}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function Detail({ layer, index }: { layer: Layer; index: number }) {
  return (
    <motion.div key={layer.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.28, ease: EASE }}>
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-accent-ink">
          <layer.icon className="size-[18px]" />
        </span>
        <div>
          <div className="font-mono text-[10.5px] tracking-[0.08em] text-fg-3 uppercase">Layer 0{index + 1}</div>
          <h3 className="font-display text-[19px] font-semibold tracking-[-0.02em] text-fg">{layer.name}</h3>
        </div>
      </div>
      <p className="mt-4 text-[14px] leading-relaxed text-fg-2">{layer.description}</p>
      <ul className="mt-4 grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {layer.points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-[13px] text-fg-2">
            <Check className="mt-0.5 size-3.5 shrink-0 text-fg-3" />
            {p}
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-line pt-4 text-[12px] text-fg-3">
        <span className="mono-label">Modules</span>
        {layer.modules.map((m) => (
          <span key={m} className="rounded border border-accent/25 bg-accent/[0.06] px-1.5 py-px font-mono text-[10.5px] text-fg-2">
            {m}
          </span>
        ))}
        <span className="ml-auto font-mono text-fg-2">{layer.lives}</span>
      </div>
    </motion.div>
  )
}

const FACTS = [
  { label: 'Core modules in one codebase', value: 16, format: (v: number) => num(Math.round(v)) },
  { label: 'Built-in supplier drivers', value: 3, format: (v: number) => num(Math.round(v)) },
  { label: 'Sales channels into one PlaceOrder', value: 4, format: (v: number) => num(Math.round(v)) },
  { label: `Bytes of operational data sent to ${brand.company}`, value: 0, format: (v: number) => num(Math.round(v)) },
]

function ModuleStrip() {
  return (
    <Reveal className="mt-16 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <span className="mono-label">{brand.coreProduct} · modular monolith</span>
        <span className="font-mono text-[11px] text-fg-3">core-api · core-worker · core-scheduler · PostgreSQL · Caddy</span>
      </div>
      <div className="flex flex-wrap gap-1.5 border-b border-line px-5 py-4">
        {MODULES.map((m) => (
          <span key={m} className="inline-flex h-7 items-center rounded-md border border-line bg-surface-2/60 px-2.5 text-[12px] text-fg-2">
            {m}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4">
        {FACTS.map((m, i) => (
          <div key={m.label} className="border-line p-5 sm:p-6 [&:nth-child(odd)]:border-r lg:border-r lg:last:border-r-0 [&:nth-child(-n+2)]:border-b lg:[&:nth-child(-n+2)]:border-b-0">
            <div className="mb-3 flex items-center gap-2 font-mono text-[10.5px] text-fg-3 tabular">
              <span className={cn('size-1.5 rounded-full', i === 3 ? 'bg-accent' : 'bg-fg/25')} />
              0{i + 1}
            </div>
            <CountUp to={m.value} from={0} format={m.format} className={cn('block font-display text-[30px] leading-none font-semibold tracking-[-0.03em] tabular font-wide sm:text-[38px]', i === 3 ? 'text-accent-ink' : 'text-fg')} />
            <div className="mt-2.5 text-[13px] text-fg-3">{m.label}</div>
          </div>
        ))}
      </div>
    </Reveal>
  )
}

export function ArchitectureSection() {
  const [active, setActive] = useState(3)
  const [hover, setHover] = useState<number | null>(null)
  const peek = hover ?? active

  return (
    <Section id="architecture">
      <Container>
        <SectionHeader
          index="02"
          eyebrow="Architecture"
          title="A complete platform. One codebase. Every layer on your server."
          description={`${brand.product} covers the whole business between the suppliers you buy from and the customers you sell to — catalog, pricing, channels, orders, ledger and payments. Select a layer to see what it does and which Core modules implement it.`}
        />

        <div className="mt-12 grid items-start gap-8 lg:mt-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-12">
          <Reveal className="relative rounded-2xl border border-line bg-bg-subtle/60 px-3 pt-4 pb-3 sm:px-6 sm:pt-6">
            <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl bg-hatch [mask-image:linear-gradient(180deg,black,transparent_40%,transparent_60%,black)]" />
            <div className="relative">
              <Schematic peek={peek} active={active} onSelect={setActive} onHover={setHover} />
            </div>
            <div className="relative mt-4 flex min-h-9 items-center gap-2 border-t border-line pt-3 text-[12.5px] text-fg-3">
              <MousePointerClick className="size-3.5 shrink-0" />
              <span className="truncate">
                <span className="font-medium text-fg-2">{LAYERS[peek]!.name}</span> — {LAYERS[peek]!.short}
              </span>
            </div>
          </Reveal>

          <Reveal delay={0.08} className="space-y-4">
            <div role="tablist" aria-label="Platform layers" className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
              {LAYERS.map((l, i) => {
                const isActive = i === active
                return (
                  <button
                    key={l.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActive(i)}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    className={cn('relative flex w-full items-center gap-3.5 border-b border-line px-4 py-3 text-left transition-colors last:border-b-0', isActive ? 'bg-surface-2' : 'hover:bg-surface-2/60')}
                  >
                    {isActive && <motion.span layoutId="arch-active" className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-accent" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                    <span className={cn('w-5 font-mono text-[11px] tabular', isActive ? 'text-accent-ink' : 'text-fg-3')}>0{i + 1}</span>
                    <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg border transition-colors', isActive ? 'border-accent/30 bg-accent/10 text-accent-ink' : 'border-line bg-surface-2 text-fg-3')}>
                      <l.icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-[13.5px] font-medium', isActive ? 'text-fg' : 'text-fg-2')}>{l.name}</span>
                      <span className="block truncate text-[12px] text-fg-3">{l.short}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="min-h-[268px] rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
              <AnimatePresence mode="wait" initial={false}>
                <Detail layer={LAYERS[active]!} index={active} />
              </AnimatePresence>
            </div>
          </Reveal>
        </div>

        <ModuleStrip />
      </Container>
    </Section>
  )
}
