import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Braces, Calculator, Clock, Layers, Tags } from 'lucide-react'
import { ServiceIcon } from '@/components/brand'
import { Badge, DemoTag, EmptyState, SearchInput, Segmented } from '@/components/ui'
import { money, pct } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Container, MockFrame, Reveal, Section, SectionHeader } from './shared'
import { EASE } from './sharedUtils'
import { FIELD_HINT, ICON_BUCKET, ROUTABLE, SERVICES, SUPPLIERS, type Category, type DemoService } from './demo'
import { SupplierMark } from './SupplierMark'

const CATS: { value: 'All' | Category; label: string }[] = [
  { value: 'All', label: 'All' },
  { value: 'IMEI Checks', label: 'IMEI' },
  { value: 'Carrier & Network', label: 'Carrier' },
  { value: 'Warranty', label: 'Warranty' },
  { value: 'Unlock Codes', label: 'Unlock' },
  { value: 'Serial', label: 'Serial' },
]
type CatFilter = (typeof CATS)[number]['value']

const TIERS: { key: keyof DemoService['tiers']; label: string }[] = [
  { key: 'retail', label: 'Retail' },
  { key: 'silver', label: 'Silver' },
  { key: 'gold', label: 'Gold' },
  { key: 'platinum', label: 'Platinum' },
]

function OfferPane({ svc }: { svc: DemoService }) {
  const firstRoutable = svc.offers.findIndex((o) => ROUTABLE[SUPPLIERS[o.k].health])
  const cost = svc.offers[firstRoutable]?.cost ?? svc.offers[0]!.cost
  return (
    <motion.div key={svc.code} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: EASE }} className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <ServiceIcon icon={svc.icon} category={ICON_BUCKET[svc.category]} size="lg" />
        <div className="min-w-0">
          <div className="text-[15px] leading-snug font-semibold tracking-[-0.01em] text-fg">{svc.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-fg-3">
            {svc.code} · {svc.processing.toLowerCase()} · revision 1
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] text-fg-2">
        <Clock className="size-3.5 text-fg-3" />
        Turnaround <span className="ml-auto font-mono text-fg tabular">{svc.turnaround}</span>
      </div>

      <div className="mt-5">
        <div className="mono-label mb-2 flex items-center gap-1.5">
          <Braces className="size-3" /> Field schema · GSM pack
        </div>
        <div className="flex flex-wrap gap-1.5">
          {svc.fields.map((f) => (
            <span key={f} className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-fg-2">
              {f}
              {FIELD_HINT[f] && <span className="text-fg-3"> · {FIELD_HINT[f]}</span>}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <div className="mono-label mb-2 flex items-center gap-1.5">
          <Layers className="size-3" /> Offers · priority order
        </div>
        <ol className="space-y-1.5">
          {svc.offers.map((o, i) => {
            const s = SUPPLIERS[o.k]
            const routable = ROUTABLE[s.health]
            const primary = i === firstRoutable
            return (
              <li key={o.k} className={cn('relative flex items-center gap-2.5 overflow-hidden rounded-lg border bg-surface px-2.5 py-2', primary ? 'border-accent/35' : 'border-line', !routable && 'bg-hatch opacity-70')}>
                {primary && <span className="absolute inset-y-0 left-0 w-[2px] bg-accent" />}
                <span className="w-5 font-mono text-[10.5px] text-fg-3">P{i + 1}</span>
                <SupplierMark k={o.k} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-medium text-fg">{s.name}</div>
                  <div className="truncate font-mono text-[10.5px] text-fg-3">
                    {s.driver} · {o.external}
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn('text-[10.5px] font-medium', primary ? 'text-accent-ink' : routable ? 'text-fg-3' : 'text-danger')}>{primary ? 'Routes first' : routable ? 'Failover' : 'Skipped · ' + s.health.replace('_', ' ')}</div>
                  <div className="font-mono text-[11px] text-fg-2 tabular">cost {money(o.cost)}</div>
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="mt-5">
        <div className="mono-label mb-2 flex items-center gap-1.5">
          <Calculator className="size-3" /> Tier prices · calculated live
        </div>
        <div className="grid grid-cols-4 overflow-hidden rounded-lg border border-line">
          {TIERS.map((t, i) => {
            const price = svc.tiers[t.key]
            const margin = ((price - cost) / price) * 100
            return (
              <div key={t.key} className={cn('bg-surface px-2 py-2 text-center', i > 0 && 'border-l border-line')}>
                <div className="text-[10.5px] text-fg-3">{t.label}</div>
                <div className="mt-0.5 font-mono text-[12.5px] font-medium text-fg tabular">{money(price)}</div>
                <div className="font-mono text-[10px] text-success tabular">{pct(margin, 0)}</div>
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-fg-3">{svc.rule}. Recalculated whenever a supplier cost changes — no price is copied into pages or exports.</p>
      </div>
    </motion.div>
  )
}

function CatalogMock() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<CatFilter>('All')
  const [selected, setSelected] = useState('4040')
  const rows = useMemo(() => SERVICES.filter((s) => (cat === 'All' || s.category === cat) && (!q || `${s.name} ${s.code}`.toLowerCase().includes(q.toLowerCase()))), [q, cat])
  const current = SERVICES.find((s) => s.code === selected) ?? SERVICES[0]!

  return (
    <MockFrame
      path="portal.unlockdesk-demo.com/admin/catalog/services"
      right={
        <span className="flex items-center gap-2">
          <Badge tone="neutral">{SERVICES.length} of 54 shown</Badge>
          <DemoTag className="hidden sm:inline-flex" />
        </span>
      }
    >
      <div className="grid lg:grid-cols-[minmax(0,1fr)_370px]">
        <div className="min-w-0 border-line lg:border-r">
          <div className="flex flex-col gap-2.5 border-b border-line p-3 sm:flex-row sm:items-center">
            <SearchInput value={q} onChange={setQ} placeholder="Search IMEI, carrier, warranty…" className="sm:w-56" />
            <div className="no-scrollbar -mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
              <Segmented size="xs" items={CATS.map((c) => ({ value: c.value, label: c.label }))} value={cat} onChange={setCat} />
            </div>
          </div>
          <div className="max-h-[560px] overflow-y-auto">
            {rows.length === 0 ? (
              <EmptyState compact icon={<Tags />} title="No services match" description="Try a different search or category." />
            ) : (
              <ul>
                {rows.map((s) => {
                  const isSel = s.code === current.code
                  return (
                    <li key={s.code}>
                      <button
                        type="button"
                        onClick={() => setSelected(s.code)}
                        className={cn('relative grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-3 py-2.5 text-left transition-colors sm:grid-cols-[minmax(0,1fr)_84px_72px_72px]', isSel ? 'bg-accent/[0.06]' : 'hover:bg-surface-2/60')}
                      >
                        {isSel && <motion.span layoutId="cat-sel" className="absolute inset-y-0 left-0 w-[2px] bg-accent" />}
                        <span className="flex min-w-0 items-center gap-3">
                          <ServiceIcon icon={s.icon} category={ICON_BUCKET[s.category]} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-medium text-fg">{s.name}</span>
                            <span className="block truncate font-mono text-[10.5px] text-fg-3">
                              {s.code} · {s.category} · {s.turnaround}
                            </span>
                          </span>
                        </span>
                        <span className="hidden -space-x-1 sm:flex">
                          {s.offers.map((o) => (
                            <SupplierMark key={o.k} k={o.k} size="xs" />
                          ))}
                        </span>
                        <span className="hidden text-right font-mono text-[12px] text-fg tabular sm:block">{money(s.tiers.retail)}</span>
                        <span className="justify-self-end font-mono text-[11px] text-fg-3 tabular">
                          <span className="sm:hidden">{money(s.tiers.retail)}</span>
                          <span className="hidden sm:inline">Gold {money(s.tiers.gold)}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
        <div className="border-t border-line bg-bg-subtle/50 lg:border-t-0">
          <AnimatePresence mode="wait" initial={false}>
            <OfferPane svc={current} />
          </AnimatePresence>
        </div>
      </div>
    </MockFrame>
  )
}

const POINTS = [
  { title: 'Versioned field schemas', body: 'Every service declares its fields from the GSM vertical pack — IMEI (15 digits + Luhn), serial, brand, model, carrier. Invalid input is rejected before a supplier is ever called.' },
  { title: 'Offers in priority order', body: 'Map each service to supplier products from synced catalogs, in the order they should be tried. Catalog sync proposes cost and availability changes for review.' },
  { title: 'Pricing tiers, calculated live', body: 'Retail, Silver, Gold and Platinum prices come from rules — fixed, cost + %, cost + fixed, minimum margin — evaluated on every quote. Change a cost once; every channel follows.' },
]

export function CatalogSection() {
  return (
    <Section id="catalog" className="bg-bg-subtle/50">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-line" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-line" />
      <Container>
        <SectionHeader
          index="05"
          eyebrow="Catalog & pricing"
          title="One catalog. Every supplier behind it. Every price explained."
          description="Define each service once — its fields, its turnaround and the supplier offers that can fulfil it. Customers see one clean catalog at their own tier price; which supplier fulfils it, and at what margin, stays yours."
        />
        <div className="mt-10 grid gap-6 sm:grid-cols-3 lg:mt-12">
          {POINTS.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.05} className="border-l border-line-strong pl-4">
              <div className="flex items-center gap-1.5 text-[14px] font-semibold text-fg">
                {p.title}
                <ArrowRight className="size-3.5 text-fg-3" />
              </div>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-2">{p.body}</p>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.1} className="mt-10">
          <CatalogMock />
        </Reveal>
      </Container>
    </Section>
  )
}
