import { useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ChevronDown, Database, Lock, ShieldCheck } from 'lucide-react'
import { Switch } from '@/components/ui'
import { cn } from '@/lib/cn'
import { Container, Reveal, Section, SectionHeader } from './shared'
import { useAutoStep } from './sharedUtils'
import { brand } from '@/config/brand'

function Pillar({ letter, kicker, title, body, visual, className, delay }: { letter: string; kicker: string; title: string; body: string; visual: ReactNode; className?: string; delay?: number }) {
  return (
    <Reveal delay={delay} className={cn('group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-[border-color,box-shadow] duration-300 hover:border-line-strong hover:shadow-pop', className)}>
      <div className="relative h-[188px] overflow-hidden border-b border-line bg-bg-subtle/70">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-hatch [mask-image:radial-gradient(ellipse_at_center,transparent_30%,black_85%)]" />
        <span aria-hidden className="absolute top-3 left-4 font-mono text-[10.5px] text-fg-3 tabular">{letter}</span>
        <div className="relative flex h-full items-center justify-center p-5">{visual}</div>
      </div>
      <div className="p-6">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-accent" />
          <span className="mono-label text-fg-2!">{kicker}</span>
        </div>
        <h3 className="mt-2 font-display text-[19px] font-semibold tracking-[-0.02em] text-fg">{title}</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-fg-2">{body}</p>
      </div>
    </Reveal>
  )
}

function ControlVisual() {
  const [skip, setSkip] = useState(true)
  const [cap, setCap] = useState(true)
  return (
    <div className="w-full max-w-[340px] space-y-1 rounded-xl border border-line bg-surface p-2 shadow-card">
      <div className="flex items-center justify-between rounded-lg px-2.5 py-1">
        <span className="text-[12.5px] text-fg-2">Routing</span>
        <span className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 px-2 py-0.5 text-[12px] font-medium text-fg">
          Priority + guarded failover <ChevronDown className="size-3 text-fg-3" />
        </span>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-surface-2/60 px-2.5 py-1">
        <span className="text-[12.5px] text-fg-2">Margin guard</span>
        <Switch size="sm" checked={skip} onChange={setSkip} label="Margin guard" />
      </div>
      <div className="flex items-center justify-between rounded-lg px-2.5 py-1">
        <span className="text-[12.5px] text-fg-2">Gold minimum margin</span>
        <span className="flex items-center gap-2">
          <span className={cn('font-mono text-[12px] tabular transition-opacity', cap ? 'text-fg' : 'text-fg-3 line-through opacity-60')}>10.00%</span>
          <Switch size="sm" checked={cap} onChange={setCap} label="Gold minimum margin" />
        </span>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-surface-2/60 px-2.5 py-1">
        <span className="text-[12.5px] text-fg-2">On timeout</span>
        <span className="font-mono text-[12px] text-fg tabular">Needs Review · funds held</span>
      </div>
    </div>
  )
}

const CHAIN = ['order.created', 'imei.validated', 'funds.held', 'attempt.rejected', 'order.failover', 'order.completed', 'funds.captured']

function AutomationVisual() {
  const { ref, step } = useAutoStep<HTMLDivElement>(CHAIN.length + 1, (s) => (s === CHAIN.length ? 1600 : 650))
  return (
    <div ref={ref} className="flex w-full max-w-[360px] flex-wrap items-center justify-center gap-1.5">
      {CHAIN.map((e, i) => {
        const on = i < step
        const warn = e === 'attempt.rejected'
        return (
          <span key={e} className="flex items-center gap-1.5">
            <span
              className={cn(
                'rounded-md border px-2 py-1 font-mono text-[11px] transition-[background-color,border-color,color] duration-300',
                on ? (warn ? 'border-warning/40 bg-warning/10 text-warning' : 'border-accent/35 bg-accent/10 text-accent-ink') : 'border-line bg-surface text-fg-3',
              )}
            >
              {e}
            </span>
            {i < CHAIN.length - 1 && <span className={cn('h-px w-2.5 transition-colors duration-300', i < step - 1 ? 'bg-accent/60' : 'bg-line-strong')} />}
          </span>
        )
      })}
    </div>
  )
}

function OwnershipVisual() {
  return (
    <div className="relative w-full max-w-[320px]">
      <div className="rounded-xl border border-line bg-surface p-3.5 shadow-card">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg border border-line-strong bg-surface-3 text-fg-2">
            <Database className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="text-[12.5px] font-medium text-fg">PostgreSQL 16</div>
            <div className="truncate font-mono text-[10.5px] text-fg-3">db.internal:5432/orvex</div>
          </div>
          <Lock className="ml-auto size-3.5 text-fg-3" />
        </div>
        <div className="mt-3 space-y-1">
          {[
            ['orders', '1.2M rows'],
            ['ledger_entries', '4.8M rows'],
            ['supplier_credentials', 'encrypted'],
          ].map(([t, v]) => (
            <div key={t} className="flex items-center justify-between rounded-md bg-surface-2/70 px-2.5 py-1 font-mono text-[11px]">
              <span className="text-fg-2">{t}</span>
              <span className="text-fg-3">{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -right-2 -bottom-3 flex items-center gap-1.5 rounded-full border border-success/30 bg-surface px-2.5 py-1 text-[11px] font-medium text-success shadow-pop">
        <ShieldCheck className="size-3.5" />0 bytes shared with the vendor
      </div>
    </div>
  )
}

const BARS = [18, 22, 21, 27, 31, 30, 36, 41, 46, 44, 53, 61, 66, 74]

function ScaleVisual() {
  const reduce = useReducedMotion()
  return (
    <div className="w-full max-w-[320px]">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="mono-label">Orders / day</span>
        <span className="font-mono text-[11px] text-success">+38% QoQ</span>
      </div>
      <div className="flex h-[96px] items-end gap-1.5">
        {BARS.map((h, i) => (
          <motion.span
            key={i}
            className={cn('flex-1 origin-bottom rounded-[3px]', i === BARS.length - 1 ? 'bg-accent' : 'bg-fg/15')}
            style={{ height: `${h + 20}%` }}
            initial={reduce ? false : { scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: i * 0.035, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10.5px] text-fg-3">
        <span>1 supplier · storefront</span>
        <span>10 suppliers · 4 channels</span>
      </div>
    </div>
  )
}

export function WhySection() {
  return (
    <Section id="platform">
      <Container>
        <SectionHeader
          index="03"
          eyebrow={`Why ${brand.product}`}
          title="One platform for your whole service business."
          description={`Not a router bolted onto your old panel: ${brand.product} is the complete system — suppliers, catalog, pricing, storefront, reseller portal, API, orders, ledger and payments — decided in one place, by you.`}
        />
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:mt-14 lg:grid-cols-12">
          <Pillar letter="A" className="lg:col-span-7" kicker="Control" title="Decide every route, price and limit." body="Offer priorities, margin guards, pricing tiers and account limits live in your admin — audited, explainable and changeable in seconds." visual={<ControlVisual />} />
          <Pillar letter="B" className="lg:col-span-5" delay={0.06} kicker="Automation" title="Fulfilment that runs itself — and stops when it should." body="Orders move from IMEI to result on their own, including safe failover after a definitive rejection. When a supplier outcome is unknown, the order waits for a human instead of risking a duplicate." visual={<AutomationVisual />} />
          <Pillar letter="C" className="lg:col-span-5" kicker="Ownership" title="Your data never leaves your servers." body={`${brand.product} runs on your server with your own PostgreSQL. Orders, IMEIs, wallets, ledger and supplier credentials stay where you put them.`} visual={<OwnershipVisual />} />
          <Pillar letter="D" className="lg:col-span-7" delay={0.06} kicker="Scale" title="From one supplier to a reseller network." body="Add suppliers, services, channels and reseller accounts without re-architecting. The installation that runs your first IMEI check runs your millionth order." visual={<ScaleVisual />} />
        </div>
      </Container>
    </Section>
  )
}
