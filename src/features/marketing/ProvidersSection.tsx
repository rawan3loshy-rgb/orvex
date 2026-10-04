import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Blocks, Braces, CircleCheck, CodeXml, Hand, Wallet, type LucideIcon } from 'lucide-react'
import { Sparkline } from '@/components/charts'
import { HealthBadge } from '@/components/domain'
import { money, ms, pct } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Container, MockFrame, Reveal, Section, SectionHeader } from './shared'
import { EASE, useTicker } from './sharedUtils'
import { ROUTABLE, SUPPLIERS, type SupplierKey } from './demo'
import { SupplierMark } from './SupplierMark'

const DRIVERS: { name: string; tag: string; icon: LucideIcon; body: string }[] = [
  {
    name: 'DHRU Fusion driver',
    tag: 'driver.dhru-fusion',
    icon: CodeXml,
    body: 'Speaks the DHRU Fusion API most GSM suppliers run — HTTP form-POST with JSON replies for service list, place order, order status and balance. DHRU’s numeric statuses (0/1/3/4) are mapped at the edge; Core never sees them.',
  },
  { name: 'REST driver', tag: 'driver.orvex-rest', icon: Braces, body: 'Generic JSON over HTTPS with Bearer auth and signed result callbacks — for suppliers with a modern API, such as instant IMEI data providers.' },
  { name: 'Manual fulfilment driver', tag: 'driver.manual', icon: Hand, body: 'A work queue for suppliers who process by hand. Your team enters the result; the order completes and settles exactly like an automated one.' },
  { name: 'Custom drivers', tag: 'extensions', icon: Blocks, body: 'Anything proprietary — batch endpoints, unusual signing — ships as a signed extension built with the driver SDK. Core updates never overwrite it.' },
]

interface Prov {
  k: SupplierKey
  driver: string
  services: number
  base: number
  jitter: number
  success: number
  balance: number
}

/** Demo suppliers — fictional, mirrors the installation seed. */
const PROVS: Prov[] = [
  { k: 'alpha', driver: 'DHRU Fusion', services: 31, base: 420, jitter: 60, success: 98.6, balance: 1412.4 },
  { k: 'beta', driver: 'DHRU Fusion', services: 24, base: 510, jitter: 70, success: 97.9, balance: 2280 },
  { k: 'gamma', driver: 'REST', services: 28, base: 180, jitter: 24, success: 99.2, balance: 640.15 },
  { k: 'delta', driver: 'DHRU Fusion', services: 12, base: 1840, jitter: 420, success: 86.1, balance: 905.6 },
  { k: 'zeta', driver: 'REST', services: 14, base: 210, jitter: 30, success: 98.8, balance: 38.2 },
  { k: 'epsilon', driver: 'DHRU Fusion', services: 7, base: 0, jitter: 0, success: 0, balance: 312 },
  { k: 'kappa', driver: 'Manual', services: 6, base: 0, jitter: 0, success: 100, balance: 0 },
]

const TOASTS = [
  { title: 'Connection test passed', detail: 'GammaCheck IMEI API · REST · 182ms' },
  { title: 'Balance synced', detail: `DHRU Supplier Alpha · ${money(1412.4)} · reconciled with the ledger` },
  { title: 'Catalog sync: 3 changes for review', detail: 'Beta Unlock Source · 2 cost changes, 1 new product' },
]

const seedSeries = (p: Prov, n = 24) => Array.from({ length: n }, (_, i) => (p.base ? p.base + Math.sin(i * 0.9 + p.base) * p.jitter * 0.6 + ((i * 37 + p.base) % 11) * (p.jitter / 14) : 0))

function ProviderHealth() {
  const [series, setSeries] = useState(() => Object.fromEntries(PROVS.map((p) => [p.k, seedSeries(p)])) as Record<string, number[]>)
  const [toast, setToast] = useState<number | null>(null)

  const { ref } = useTicker<HTMLDivElement>(1900, true, (tick) => {
    setSeries((prev) => {
      const next: Record<string, number[]> = {}
      for (const p of PROVS) {
        const arr = prev[p.k]!
        if (!p.base) {
          next[p.k] = arr
          continue
        }
        const last = arr[arr.length - 1]!
        const v = Math.max(p.base * 0.7, Math.min(p.base * 1.45, last + (Math.random() - 0.5) * p.jitter * 1.4 + (p.base - last) * 0.25))
        next[p.k] = [...arr.slice(1), v]
      }
      return next
    })
    if (tick % 5 === 2) setToast(Math.floor(tick / 5) % TOASTS.length)
    if (tick % 5 === 4) setToast(null)
  })

  const t = toast == null ? null : TOASTS[toast]!

  return (
    <div ref={ref} className="relative">
      <MockFrame path="portal.unlockdesk-demo.com/admin/suppliers" right={<span className="rounded border border-dashed border-line-strong px-1.5 font-mono text-[9.5px] tracking-wider text-fg-3 uppercase">Simulated</span>}>
        <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_72px_72px_112px] items-center gap-4 border-b border-line px-4 py-2.5 sm:grid">
          {['Supplier', 'Latency · 15 min', 'p95', 'Success', 'Health'].map((h, i) => (
            <span key={h} className={cn('mono-label', i >= 2 && i < 4 && 'text-right')}>
              {h}
            </span>
          ))}
        </div>
        <ul>
          {PROVS.map((p) => {
            const s = SUPPLIERS[p.k]
            const vals = series[p.k]!
            const p95 = p.base ? Math.max(...vals.slice(-8)) : null
            const warn = s.health !== 'healthy'
            return (
              <li key={p.k} className={cn('grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-2/50 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_72px_72px_112px]', !ROUTABLE[s.health] && 'bg-hatch')}>
                <div className="flex min-w-0 items-center gap-3">
                  <SupplierMark k={p.k} size="md" />
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-medium text-fg">{s.name}</div>
                    <div className="truncate font-mono text-[11px] text-fg-3">
                      {p.driver} · {p.services} products{p.driver !== 'Manual' && ` · ${money(p.balance, { compact: true })}`}
                    </div>
                  </div>
                </div>
                <div className="order-last col-span-2 sm:order-none sm:col-span-1">
                  {p.base ? <Sparkline values={vals} color={warn ? 'var(--warning)' : s.color} height={26} /> : <span className="font-mono text-[11px] text-fg-3">{p.driver === 'Manual' ? 'work queue' : 'not routable'}</span>}
                </div>
                <span className={cn('hidden text-right font-mono text-[12px] tabular sm:block', s.health === 'degraded' ? 'text-warning' : 'text-fg')}>{p95 ? ms(p95) : '—'}</span>
                <span className="hidden text-right font-mono text-[12px] text-fg-2 tabular sm:block">{p.success ? pct(p.success) : '—'}</span>
                <span className="justify-self-end sm:justify-self-start">
                  <HealthBadge health={s.health} />
                </span>
              </li>
            )
          })}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-2/40 px-4 py-2.5 text-[12px] text-fg-3">
          <span className="flex items-center gap-1.5">
            <Wallet className="size-3.5" />
            Supplier balances reconciled against the ledger
          </span>
          <span>Auth errors, open circuits and maintenance are skipped by routing</span>
        </div>
      </MockFrame>

      <AnimatePresence>
        {t && (
          <motion.div
            key={t.title}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="absolute -bottom-5 left-4 flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-2.5 shadow-pop sm:left-auto sm:-right-4"
          >
            <CircleCheck className="size-4 text-success" />
            <div className="leading-tight">
              <div className="text-[12.5px] font-medium text-fg">{t.title}</div>
              <div className="font-mono text-[11px] text-fg-3">{t.detail}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function ProvidersSection() {
  return (
    <Section id="providers">
      <Container>
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
          <div>
            <SectionHeader
              index="04"
              eyebrow="Suppliers & drivers"
              title="Connect every supplier — DHRU Fusion, REST, manual or your own driver."
              description="Drivers translate each supplier’s protocol into Core’s order model. Catalog sync pulls their products and proposes changes for your review; credentials are encrypted and write-only; health and balance are tracked continuously."
            />
            <div className="mt-10 space-y-2">
              {DRIVERS.map((a, i) => (
                <Reveal key={a.name} delay={i * 0.05}>
                  <div className="group flex gap-4 rounded-xl border border-transparent p-3 transition-colors hover:border-line hover:bg-surface">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-surface text-fg-2 shadow-card transition-colors group-hover:border-accent/30 group-hover:text-accent-ink">
                      <a.icon className="size-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <span className="text-[14.5px] font-semibold text-fg">{a.name}</span>
                        <span className="font-mono text-[11px] text-fg-3">{a.tag}</span>
                      </div>
                      <p className="mt-1 text-[13.5px] leading-relaxed text-fg-2">{a.body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
          <Reveal delay={0.1} className="lg:pt-8">
            <ProviderHealth />
          </Reveal>
        </div>
      </Container>
    </Section>
  )
}
