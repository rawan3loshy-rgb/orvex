import { motion } from 'motion/react'
import { ArrowDown, ArrowRight } from 'lucide-react'
import { ServiceIcon } from '@/components/brand'
import { Button } from '@/components/ui'
import { brand } from '@/config/brand'
import { Container, RingMotif, SignalStop } from './shared'
import { EASE, scrollToId } from './sharedUtils'
import { HeroDiagram } from './HeroDiagram'
import { ICON_BUCKET, SERVICES } from './demo'

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: EASE },
})

const SPEC: { k: string; v: string }[] = [
  { k: 'Demo vertical', v: 'GSM — IMEI checks, carrier, warranty, unlock codes' },
  { k: 'Suppliers', v: 'DHRU Fusion · REST · manual · custom drivers' },
  { k: 'Sell through', v: 'Storefront · reseller portal · API · DHRU endpoint' },
  { k: 'Money', v: 'Double-entry ledger · wallets · payments' },
  { k: 'Runs on', v: 'Your server + your own PostgreSQL' },
]

/** Services from the demo catalog (DEMO data — legitimate checks and carrier-authorised unlocks). */
const TICKER = SERVICES.map((s) => ({ name: s.name, icon: s.icon, category: ICON_BUCKET[s.category] }))

function ServiceTicker() {
  const items = [...TICKER, ...TICKER]
  return (
    <div className="relative mt-14 border-y border-line py-3 sm:mt-16">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="mono-label">Demo catalog · GSM vertical pack</span>
        <span className="hidden font-mono text-[10.5px] text-fg-3 sm:inline">IMEI checks · Carrier & network · Warranty · Device · Unlock codes · Serial</span>
      </div>
      <div className="overflow-hidden mask-fade-x">
        <motion.ul className="flex w-max gap-2" animate={{ x: ['0%', '-50%'] }} transition={{ duration: 70, repeat: Infinity, ease: 'linear' }}>
          {items.map((s, i) => (
            <li key={`${s.name}-${i}`} aria-hidden={i >= TICKER.length} className="flex shrink-0 items-center gap-2 rounded-lg border border-line bg-surface/70 py-1 pr-3 pl-1">
              <ServiceIcon icon={s.icon} category={s.category} size="sm" className="size-6 rounded-md [&_svg]:size-3" />
              <span className="text-[12.5px] whitespace-nowrap text-fg-2">{s.name}</span>
            </li>
          ))}
        </motion.ul>
      </div>
    </div>
  )
}

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-28 pb-20 sm:pt-36 sm:pb-28">
      {/* backdrop — calibrated dial + grid, no colour glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-grid [mask-image:linear-gradient(180deg,black,transparent_62%)]" />
        <RingMotif className="top-[-260px] right-[-420px] size-[980px] [mask-image:radial-gradient(circle_at_center,black_35%,transparent_70%)] sm:right-[-300px] lg:top-[-200px] lg:right-[-180px]" />
      </div>

      <Container className="relative">
        <motion.div {...fade(0)}>
          <button
            type="button"
            onClick={() => scrollToId('updates')}
            className="group inline-flex items-center gap-2.5 rounded-full border border-line bg-surface/70 py-1 pr-3 pl-1 text-[12.5px] text-fg-2 shadow-card backdrop-blur transition-colors hover:border-line-strong hover:text-fg"
          >
            <span className="rounded-full bg-fg px-2 py-0.5 font-mono text-[11px] font-medium text-bg">Core 2.5</span>
            <span className="sm:hidden">Signed updates · expand-only migrations</span>
            <span className="hidden sm:inline">Review-queue lookups · webhook message ids · minimum margins</span>
            <ArrowRight className="size-3.5 text-fg-3 transition-transform group-hover:translate-x-0.5" />
          </button>
        </motion.div>

        <div className="mt-10 grid gap-10 lg:mt-14 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7">
            <motion.div {...fade(0.04)} className="flex items-center gap-3">
              <span className="mono-label text-fg-2!">{brand.product}</span>
              <span className="h-px w-8 bg-line-strong" />
              <span className="mono-label">{brand.descriptor}</span>
            </motion.div>
            <motion.h1 {...fade(0.08)} className="mt-5 font-display text-[58px] leading-[0.92] font-semibold tracking-[-0.04em] text-fg font-wide sm:text-[96px] xl:text-[112px]">
              <span className="block">
                Connect<SignalStop />
              </span>
              <span className="block">
                Route<SignalStop />
              </span>
              <span className="block">
                Fulfill<SignalStop />
              </span>
            </motion.h1>
          </div>

          <div className="flex flex-col justify-end lg:col-span-5">
            <motion.p {...fade(0.16)} className="font-display text-[21px] leading-[1.25] font-medium tracking-[-0.015em] text-balance text-fg sm:text-[24px]">
              Run your digital-service business on your own server.
            </motion.p>
            <motion.p {...fade(0.2)} className="mt-4 text-[15px] leading-relaxed text-pretty text-fg-2 sm:text-[16px]">
              One licensed platform for the whole operation: connect suppliers, sync their catalogs, price every service per tier, and sell through your storefront, reseller portal, API and DHRU-compatible endpoint. Every order is routed with guarded failover and settled in a double-entry ledger — on your server, in your own PostgreSQL.
            </motion.p>
            <motion.div {...fade(0.26)} className="mt-7 flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center">
              <Button variant="accent" size="lg" to="/login" trailing={<ArrowRight />}>
                Explore the platform
              </Button>
              <Button variant="secondary" size="lg" onClick={() => scrollToId('architecture')} trailing={<ArrowDown />}>
                View architecture
              </Button>
            </motion.div>
          </div>
        </div>

        <motion.dl {...fade(0.32)} className="mt-12 grid border-t border-line sm:grid-cols-2 lg:mt-14 lg:grid-cols-5">
          {SPEC.map((s, i) => (
            <div key={s.k} className="border-b border-line py-3.5 sm:pr-5 lg:border-r lg:border-b-0 lg:py-4 lg:pl-5 lg:first:pl-0 lg:last:border-r-0">
              <dt className="flex items-center gap-2 font-mono text-[10.5px] tracking-[0.09em] text-fg-3 uppercase">
                <span className="tabular text-fg-2">0{i + 1}</span>
                {s.k}
              </dt>
              <dd className="mt-1.5 text-[13.5px] leading-snug text-fg">{s.v}</dd>
            </div>
          ))}
        </motion.dl>

        <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.36, ease: EASE }} className="relative mt-12 sm:mt-16">
          <HeroDiagram />
        </motion.div>

        <ServiceTicker />
      </Container>
    </section>
  )
}
