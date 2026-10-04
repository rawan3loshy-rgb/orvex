import { BookOpen, Calculator } from 'lucide-react'
import { usd, type Micros } from '@/core/money'
import { LEDGER_GROUPS, type LedgerGroup } from '@/core/domain'
import { LedgerEntries, Money } from '@/components/domain'
import { Badge, Card, CardBody, CardHeader } from '@/components/ui'
import { cn } from '@/lib/cn'
import { Explainer } from '../shared'
import { previewTx } from '../helpers'

interface Rule {
  event: string
  kind: string
  dr: string[]
  cr: string[]
  when: string
}

const RULES: Rule[] = [
  { event: 'Wallet top-up', kind: 'top_up', dr: ['Gateway Clearing (method)'], cr: ['Customer Available'], when: 'A payment succeeds (card, PayPal) or finance confirms a bank transfer / manual payment. Exactly once per payment, even if the gateway webhook arrives twice.' },
  { event: 'Order hold', kind: 'order_hold', dr: ['Customer Available'], cr: ['Customer Held'], when: 'PlaceOrder accepts an order on any channel. The price is reserved before a supplier is called.' },
  { event: 'Hold release', kind: 'order_release', dr: ['Customer Held'], cr: ['Customer Available'], when: 'The order is rejected or cancelled — funds return to the wallet.' },
  { event: 'Settlement', kind: 'order_settlement', dr: ['Customer Held (price)', 'Cost of Sales (cost)'], cr: ['Revenue (price)', 'Supplier Prepaid (cost)'], when: 'The order completes. Revenue is recognised and the supplier cost consumes prepaid supplier credit.' },
  { event: 'Refund → wallet', kind: 'refund', dr: ['Refunds (contra-revenue)'], cr: ['Customer Available'], when: 'An operator refunds a completed order to the wallet. Capped at what was paid; idempotent.' },
  { event: 'Refund → original method', kind: 'refund', dr: ['Refunds (contra-revenue)'], cr: ['Gateway Clearing (method)'], when: 'Refund back to the card / PayPal used for the original payment.' },
  { event: 'Chargeback', kind: 'chargeback', dr: ['Customer Available (amount)', 'Chargeback Fees (fee)'], cr: ['Gateway Clearing (amount + fee)'], when: 'The card network reclaims a payment. Can push a wallet below zero — flagged by the integrity checks.' },
  { event: 'Goodwill credit', kind: 'adjustment', dr: ['Goodwill'], cr: ['Customer Available'], when: 'Manual credit with a mandatory reason (permission ledger.adjust). A manual debit is the reverse posting.' },
  { event: 'Supplier top-up', kind: 'supplier_top_up', dr: ['Supplier Prepaid'], cr: ['Bank'], when: 'Finance prepays credit at a supplier. Reconciliation then compares the expected and reported supplier balances.' },
  { event: 'Gateway payout', kind: 'gateway_payout', dr: ['Bank'], cr: ['Gateway Clearing'], when: 'The payment gateway pays collected funds out to the operator’s bank account.' },
]

const ACC = 'acc_abcgsm'
const NAMES = { [ACC]: 'ABC GSM', sup_alpha: 'DHRU Supplier Alpha' }

const STEPS = [
  {
    title: '1 · Top-up $100',
    note: 'ABC GSM pays $100 by card. The gateway holds the cash (asset); we owe it to the customer (liability).',
    tx: previewTx('top_up', 'Card top-up', [
      { account: 'gateway_clearing:card', direction: 'debit', amount: usd(100) },
      { account: `customer_available:${ACC}`, direction: 'credit', amount: usd(100) },
    ]),
  },
  {
    title: '2 · Order $25',
    note: 'An unlock order is placed. $25 moves from available to held — still the customer’s money, now reserved.',
    tx: previewTx('order_hold', 'Order hold', [
      { account: `customer_available:${ACC}`, direction: 'debit', amount: usd(25) },
      { account: `customer_held:${ACC}`, direction: 'credit', amount: usd(25) },
    ]),
  },
  {
    title: '3 · Completion, supplier cost $18',
    note: 'The supplier delivers. The hold becomes revenue; the $18 supplier cost is expensed and consumes prepaid supplier credit.',
    tx: previewTx('order_settlement', 'Settlement', [
      { account: `customer_held:${ACC}`, direction: 'debit', amount: usd(25) },
      { account: 'cost_of_sales', direction: 'debit', amount: usd(18) },
      { account: 'revenue', direction: 'credit', amount: usd(25) },
      { account: 'supplier_prepaid:sup_alpha', direction: 'credit', amount: usd(18) },
    ]),
  },
]

const TRACKED: { code: string; group: LedgerGroup }[] = [
  { code: 'gateway_clearing:card', group: 'gateway_clearing' },
  { code: `customer_available:${ACC}`, group: 'customer_available' },
  { code: `customer_held:${ACC}`, group: 'customer_held' },
  { code: 'revenue', group: 'revenue' },
  { code: 'cost_of_sales', group: 'cost_of_sales' },
  { code: 'supplier_prepaid:sup_alpha', group: 'supplier_prepaid' },
]

/** Balance after the first n steps, signed in the account's normal direction. */
function balanceAfter(code: string, group: LedgerGroup, n: number): Micros {
  const debitNormal = LEDGER_GROUPS[group].type === 'asset' || LEDGER_GROUPS[group].type === 'expense'
  let b = 0
  for (const s of STEPS.slice(0, n))
    for (const e of s.tx.entries) {
      if (e.account !== code) continue
      const signed = e.direction === 'debit' ? e.amount : -e.amount
      b += debitNormal ? signed : -signed
    }
  return b as Micros
}

function Side({ items, dir }: { items: string[]; dir: 'DR' | 'CR' }) {
  return (
    <div className="space-y-0.5">
      {items.map((x) => (
        <div key={x} className="flex items-baseline gap-1.5 text-[12.5px]">
          <span className={cn('w-6 shrink-0 font-mono text-[10.5px] font-semibold', dir === 'DR' ? 'text-fg-2' : 'text-fg-3')}>{dir}</span>
          <span>{x}</span>
        </div>
      ))}
    </div>
  )
}

export function PostingRulesTab() {
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader icon={<BookOpen />} title="Posting rules" description="LedgerService is the only writer of money movements. Every command maps to exactly one of these balanced postings." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr className="text-left text-[11.5px] tracking-wide text-fg-3">
                <th className="border-y border-line py-2.5 pr-3 pl-5 font-medium">Event</th>
                <th className="border-y border-line px-3 py-2.5 font-medium">Debit</th>
                <th className="border-y border-line px-3 py-2.5 font-medium">Credit</th>
                <th className="border-y border-line py-2.5 pr-5 pl-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {RULES.map((r) => (
                <tr key={r.event} className="align-top hover:bg-surface-2/40">
                  <td className="border-b border-line py-3 pr-3 pl-5">
                    <div className="font-medium">{r.event}</div>
                    <div className="font-mono text-[10.5px] text-fg-3">{r.kind}</div>
                  </td>
                  <td className="border-b border-line px-3 py-3"><Side items={r.dr} dir="DR" /></td>
                  <td className="border-b border-line px-3 py-3 pl-6"><Side items={r.cr} dir="CR" /></td>
                  <td className="max-w-[380px] border-b border-line py-3 pr-5 pl-3 text-[12px] leading-relaxed text-fg-3">{r.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader icon={<Calculator />} title="Worked example" description="One reseller, one order — from card payment to completed unlock." actions={<Badge tone="neutral" variant="outline">Illustration — not posted</Badge>} />
        <CardBody className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.title} className="flex flex-col">
                <div className="text-[13px] font-semibold">{s.title}</div>
                <p className="mt-0.5 mb-2 min-h-[36px] text-[12px] leading-relaxed text-fg-3">{s.note}</p>
                <LedgerEntries tx={s.tx} names={NAMES} showHeader={false} />
              </div>
            ))}
          </div>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[620px] text-[12.5px]">
              <thead>
                <tr className="bg-surface-2/50 text-left text-[11px] tracking-wide text-fg-3 uppercase">
                  <th className="px-3 py-2 font-medium">Account balance after…</th>
                  <th className="px-3 py-2 text-right font-medium">Step 1</th>
                  <th className="px-3 py-2 text-right font-medium">Step 2</th>
                  <th className="px-3 py-2 text-right font-medium">Step 3</th>
                </tr>
              </thead>
              <tbody>
                {TRACKED.map((t) => (
                  <tr key={t.code} className="border-t border-line/70">
                    <td className="px-3 py-1.5">
                      {LEDGER_GROUPS[t.group].name}
                      {t.code.includes(':') && <span className="text-fg-3"> · {NAMES[t.code.split(':')[1] as keyof typeof NAMES] ?? t.code.split(':')[1]}</span>}
                    </td>
                    {[1, 2, 3].map((n) => (
                      <td key={n} className="px-3 py-1.5 text-right font-mono tabular">
                        <Money value={balanceAfter(t.code, t.group, n)} tone="auto" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[12px] leading-relaxed text-fg-3">
            After step 3 the customer’s wallet shows <span className="font-mono text-fg-2">$75.00</span> available and <span className="font-mono text-fg-2">$0.00</span> held, the business has earned <span className="font-mono text-fg-2">$25.00</span> revenue against <span className="font-mono text-fg-2">$18.00</span> cost (<span className="font-mono text-fg-2">$7.00</span> gross margin), and supplier prepaid credit dropped by <span className="font-mono text-fg-2">$18.00</span>. Every step balanced on its own.
          </p>
        </CardBody>
      </Card>

      <Explainer title="Why a ledger and not a balance column">
        A mutable balance can drift silently — a retried request, a duplicated gateway webhook or a crash between two writes leaves no trace. Here every movement is an immutable, balanced transaction with an idempotency key; balances are recomputed from entries and the integrity checks prove it continuously.
      </Explainer>
    </div>
  )
}
