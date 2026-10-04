import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { BookOpenCheck, CircleCheck, CreditCard, Scale, ShieldCheck, TriangleAlert, Undo2, type LucideIcon } from 'lucide-react'
import { DemoTag, Segmented } from '@/components/ui'
import { money } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Container, MockFrame, Reveal, Section, SectionHeader } from './shared'
import { EASE } from './sharedUtils'
import { SUPPLIERS, type SupplierKey } from './demo'
import { SupplierMark } from './SupplierMark'

const POINTS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: BookOpenCheck, title: 'Double-entry ledger', body: 'Every movement is a balanced transaction of debits and credits. Wallet balances are projections of entries — there is no balance column anyone can overwrite.' },
  { icon: Scale, title: 'Hold → capture → release', body: 'Placing an order holds the price in the wallet. Completion captures it and books the supplier cost; a rejection releases it. Nothing is “auto-refunded” because nothing was taken.' },
  { icon: CreditCard, title: 'Payments', body: 'Storefront checkout and wallet top-ups run through payment intents and gateway modules that post into the ledger. In this demo the card, PayPal and bank-transfer gateways are simulated.' },
  { icon: Undo2, title: 'Refunds & verification', body: 'Refund to wallet or original method — capped at what was captured, audited and idempotent. Customers can request verification of a result; approved cases refund through the same path.' },
]

interface Line {
  account: string
  dr?: number
  cr?: number
}

const TXS: { ref: string; kind: string; at: string; note: string; lines: Line[] }[] = [
  {
    ref: 'LTX-8F2K1Q',
    kind: 'order_hold',
    at: '10:14:03',
    note: 'ORD-9T1V6B placed — Gold price held',
    lines: [
      { account: 'Customer Available · ABC GSM', dr: 9 },
      { account: 'Customer Held · ABC GSM', cr: 9 },
    ],
  },
  {
    ref: 'LTX-8F2K7W',
    kind: 'order_settlement',
    at: '11:02:41',
    note: 'Completed by Delta GSM Server (offer P2)',
    lines: [
      { account: 'Customer Held · ABC GSM', dr: 9 },
      { account: 'Revenue', cr: 9 },
      { account: 'Cost of Sales', dr: 6.1 },
      { account: 'Supplier Prepaid · Delta GSM Server', cr: 6.1 },
    ],
  },
]

const RECON: { k: SupplierKey; expected: number; reported: number; note?: string }[] = [
  { k: 'alpha', expected: 1423.4, reported: 1412.4, note: 'ORD-2H5R8N — UNKNOWN attempt; supplier charged, order in review' },
  { k: 'beta', expected: 2280, reported: 2280 },
  { k: 'gamma', expected: 640.15, reported: 640.15 },
  { k: 'delta', expected: 905.6, reported: 905.6 },
  { k: 'zeta', expected: 38.2, reported: 38.2 },
]

function LedgerView() {
  return (
    <motion.div key="ledger" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: EASE }} className="space-y-3 p-4 sm:p-5">
      {TXS.map((t) => {
        const dr = t.lines.reduce((a, l) => a + (l.dr ?? 0), 0)
        const cr = t.lines.reduce((a, l) => a + (l.cr ?? 0), 0)
        return (
          <div key={t.ref} className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-3.5 py-2">
              <span className="font-mono text-[12px] font-medium text-fg">{t.ref}</span>
              <span className="rounded bg-fg/[0.06] px-1.5 py-px font-mono text-[10.5px] text-fg-2">{t.kind}</span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-fg-3">{t.note}</span>
              <span className="font-mono text-[11px] text-fg-3">{t.at}</span>
            </div>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-fg-3">
                  <th className="px-3.5 py-1.5 font-normal">Account</th>
                  <th className="w-20 px-3.5 py-1.5 text-right font-normal">DR</th>
                  <th className="w-20 px-3.5 py-1.5 text-right font-normal">CR</th>
                </tr>
              </thead>
              <tbody>
                {t.lines.map((l) => (
                  <tr key={l.account + (l.dr ?? l.cr)} className="border-t border-line">
                    <td className={cn('px-3.5 py-1.5 text-fg-2', l.cr != null && 'pl-7')}>{l.account}</td>
                    <td className="px-3.5 py-1.5 text-right font-mono text-fg tabular">{l.dr != null ? money(l.dr) : ''}</td>
                    <td className="px-3.5 py-1.5 text-right font-mono text-fg tabular">{l.cr != null ? money(l.cr) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t border-line bg-surface-2/50 px-3.5 py-1.5 text-[11.5px]">
              <span className="flex items-center gap-1.5 text-success">
                <CircleCheck className="size-3.5" /> Balanced
              </span>
              <span className="font-mono text-fg-3 tabular">
                Σ DR {money(dr)} = Σ CR {money(cr)}
              </span>
            </div>
          </div>
        )
      })}
      <p className="text-[12px] leading-relaxed text-fg-3">Margin on this order: {money(2.9)} — revenue {money(9)} minus cost of sales {money(6.1)}. Every posting carries an idempotency key, so a retried command or duplicated webhook can never post twice.</p>
    </motion.div>
  )
}

function ReconView() {
  return (
    <motion.div key="recon" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: EASE }} className="p-4 sm:p-5">
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="hidden grid-cols-[minmax(0,1fr)_96px_96px_84px] gap-3 border-b border-line px-3.5 py-2 sm:grid">
          {['Supplier', 'Ledger', 'Supplier says', 'Drift'].map((h, i) => (
            <span key={h} className={cn('mono-label', i > 0 && 'text-right')}>
              {h}
            </span>
          ))}
        </div>
        <ul>
          {RECON.map((r) => {
            const drift = r.reported - r.expected
            return (
              <li key={r.k} className="border-b border-line px-3.5 py-2.5 last:border-b-0">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_96px_96px_84px]">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <SupplierMark k={r.k} size="sm" />
                    <span className="truncate text-[12.5px] font-medium text-fg">{SUPPLIERS[r.k].name}</span>
                  </span>
                  <span className="hidden text-right font-mono text-[12px] text-fg-2 tabular sm:block">{money(r.expected)}</span>
                  <span className="hidden text-right font-mono text-[12px] text-fg-2 tabular sm:block">{money(r.reported)}</span>
                  <span className={cn('text-right font-mono text-[12px] tabular', drift ? 'text-warning' : 'text-success')}>{drift ? money(drift) : 'in sync'}</span>
                </div>
                {r.note && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-[11.5px] text-warning">
                    <TriangleAlert className="mt-px size-3 shrink-0" /> {r.note}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-fg-3">Expected balances come from the ledger’s Supplier Prepaid accounts; reported balances from each driver’s balance call. Drift is flagged, explained and resolved — never silently adjusted.</p>
    </motion.div>
  )
}

function Point({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface text-fg-2 shadow-card">
        <Icon className="size-4" />
      </span>
      <div>
        <div className="text-[14px] font-semibold text-fg">{title}</div>
        <p className="mt-1 text-[13px] leading-relaxed text-fg-2">{children}</p>
      </div>
    </div>
  )
}

export function LedgerSection() {
  const [view, setView] = useState<'ledger' | 'recon'>('ledger')
  return (
    <Section id="ledger">
      <Container>
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
          <div>
            <SectionHeader
              index="08"
              eyebrow="Ledger, payments & refunds"
              title="Money that always balances."
              description="Wallets, payments, supplier costs and refunds all post to one double-entry ledger inside your installation — so every balance can be explained, entry by entry, and reconciled against what suppliers report."
            />
            <div className="mt-10 grid gap-x-6 gap-y-6">
              {POINTS.map((p, i) => (
                <Reveal key={p.title} delay={i * 0.04}>
                  <Point icon={p.icon} title={p.title}>
                    {p.body}
                  </Point>
                </Reveal>
              ))}
            </div>
          </div>
          <Reveal delay={0.1} className="lg:pt-6">
            <MockFrame
              path={view === 'ledger' ? 'portal.unlockdesk-demo.com/admin/finance/ledger' : 'portal.unlockdesk-demo.com/admin/finance/reconciliation'}
              right={<DemoTag className="hidden sm:inline-flex" />}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
                <div className="flex items-center gap-2 text-[13.5px] font-semibold text-fg">
                  <ShieldCheck className="size-4 text-success" />
                  Integrity checks passing
                </div>
                <Segmented
                  size="sm"
                  value={view}
                  onChange={setView}
                  items={[
                    { value: 'ledger', label: 'Order ledger' },
                    { value: 'recon', label: 'Supplier reconciliation' },
                  ]}
                />
              </div>
              <AnimatePresence mode="wait" initial={false}>
                {view === 'ledger' ? <LedgerView /> : <ReconView />}
              </AnimatePresence>
            </MockFrame>
          </Reveal>
        </div>
      </Container>
    </Section>
  )
}
