import { AnimatePresence, motion } from 'motion/react'
import { Logo } from '@/components/brand'
import { brand } from '@/config/brand'
import { StatusBadge } from '@/components/ui'
import { cn } from '@/lib/cn'
import { date, money } from '@/lib/format'
import type { Invoice, VendorAccount } from '@/types/vendor'
import { BILLING_ADDRESS } from './kitUtils'

/** ORVEX Systems' own legal entity, as printed on invoices. */
const SELLER = {
  name: `${brand.company} GmbH`,
  lines: ['Torstraße 140', '10119 Berlin', 'Germany'],
  vat: 'DE 318 •••• 41',
  register: 'HRB 23•••• B · AG Charlottenburg',
  email: `billing@${brand.domain}`,
  web: brand.domain,
}

/**
 * A printable-looking invoice laid out like the PDF the customer receives.
 */
export function InvoiceDocument({ invoice, account, paidWith }: { invoice: Invoice; account?: VendorAccount; paidWith?: string }) {
  const billing = account?.team.find((m) => m.role === 'Billing')
  const isPaid = invoice.status === 'paid'
  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <div aria-hidden className="flex h-1 w-full">
        <span className="w-20 bg-accent" />
        <span className="flex-1 bg-line-strong" />
      </div>
      <AnimatePresence>
        {isPaid && (
          <motion.div
            key="stamp"
            initial={{ opacity: 0, scale: 1.6, rotate: -18 }}
            animate={{ opacity: 1, scale: 1, rotate: -12 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
            className="pointer-events-none absolute top-16 right-6 rounded-lg border-2 border-success/50 px-3 py-1 font-mono text-[15px] font-bold tracking-[0.2em] text-success/70 uppercase sm:top-20 sm:right-10"
          >
            Paid
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-7 p-5 sm:p-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Logo size="sm" />
            <p className="mt-2 text-[12px] text-fg-2">{SELLER.name}</p>
            <p className="text-[11.5px] text-fg-3">
              {brand.coreProduct} · {brand.descriptor}
            </p>
          </div>
          <div className="text-right">
            <p className="mono-label">Invoice</p>
            <p className="mt-1 font-mono text-[15px] font-semibold text-fg">{invoice.number}</p>
            <StatusBadge status={invoice.status} className="mt-2" noPulse />
          </div>
        </div>

        {/* Parties */}
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="mono-label mb-2">From</p>
            <p className="text-[13px] font-medium text-fg">{SELLER.name}</p>
            <div className="mt-0.5 text-[12.5px] leading-relaxed text-fg-2">
              {SELLER.lines.map((l) => (
                <p key={l}>{l}</p>
              ))}
              <p className="mt-1 font-mono text-[11.5px] text-fg-3">VAT {SELLER.vat}</p>
            </div>
          </div>
          <div>
            <p className="mono-label mb-2">Bill to</p>
            <p className="text-[13px] font-medium text-fg">{account?.company ?? 'UnlockDesk Demo Ltd.'}</p>
            <div className="mt-0.5 text-[12.5px] leading-relaxed text-fg-2">
              {billing && <p>Attn. {billing.name}</p>}
              {BILLING_ADDRESS.map((l) => (
                <p key={l}>{l}</p>
              ))}
              <p className="mt-1 font-mono text-[11.5px] text-fg-3">VAT {account?.vatId ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
          {[
            { label: 'Issued', value: date(invoice.issuedAt) },
            { label: 'Due', value: date(invoice.dueAt) },
            { label: 'Service period', value: invoice.periodStart === invoice.periodEnd ? date(invoice.periodStart) : `${date(invoice.periodStart)} – ${date(invoice.periodEnd)}` },
            { label: 'Terms', value: 'Net 14' },
          ].map((m) => (
            <div key={m.label} className="bg-surface-2/60 px-3.5 py-2.5">
              <p className="text-[11px] text-fg-3">{m.label}</p>
              <p className="mt-0.5 text-[12.5px] font-medium text-fg">{m.value}</p>
            </div>
          ))}
        </div>

        {/* Lines */}
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[440px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[11.5px] text-fg-3">
                <th className="py-2 pr-3 font-medium">Description</th>
                <th className="w-14 py-2 pr-3 text-right font-medium">Qty</th>
                <th className="w-28 py-2 pr-3 text-right font-medium">Unit price</th>
                <th className="w-28 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((l, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="py-3 pr-3 text-fg">{l.description}</td>
                  <td className="py-3 pr-3 text-right text-fg-2 tabular">{l.quantity}</td>
                  <td className="py-3 pr-3 text-right text-fg-2 tabular">{money(l.unitPrice)}</td>
                  <td className="py-3 text-right font-medium text-fg tabular">{money(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="ml-auto w-full max-w-[320px] space-y-1.5 text-[13px]">
          <div className="flex justify-between">
            <span className="text-fg-3">Subtotal</span>
            <span className="text-fg tabular">{money(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-fg-3">
              VAT <span className="text-fg-2">· Reverse charge</span>
            </span>
            <span className="text-fg tabular">{money(invoice.tax)}</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
            <span className="font-medium text-fg">Total</span>
            <span className="font-display text-[22px] font-semibold tracking-[-0.02em] text-fg tabular">{money(invoice.total)}</span>
          </div>
          <div className={cn('flex justify-between rounded-md px-2 py-1.5 text-[12.5px]', isPaid ? 'bg-success/[0.07] text-success' : 'bg-warning/[0.08] text-warning')}>
            <span>{isPaid ? 'Amount paid' : 'Amount due'}</span>
            <span className="font-medium tabular">{money(invoice.total)}</span>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2 border-t border-line pt-5 text-[12px] leading-relaxed text-fg-3">
          {invoice.lines.some((l) => /custom development|professional services/i.test(l.description)) && <p>Professional services are billed per started half hour against your plan’s custom development allowance. Deliverables are installed as extensions in your installation and remain yours.</p>}
          <p>VAT reverse charge — services supplied to a business in another EU member state (Art. 196 Council Directive 2006/112/EC). The recipient accounts for VAT.</p>
          {isPaid ? (
            <p>
              Paid on {date(invoice.paidAt)}
              {paidWith ? ` with ${paidWith}` : ''}. Thank you.
            </p>
          ) : (
            <p>
              Pay by card from your ORVEX account, or by bank transfer to IBAN DE•• •••• •••• •••• 4410 00 with reference <span className="font-mono text-fg-2">{invoice.number}</span>.
            </p>
          )}
          <p>
            Questions about this invoice? Reply from your account’s Support page or write to <span className="text-fg-2">{SELLER.email}</span>.
          </p>
        </div>
      </div>

      {/* Footer — ORVEX Systems legal line */}
      <div className="flex flex-col gap-1.5 border-t border-line bg-surface-2/50 px-5 py-3.5 text-[11px] text-fg-3 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span className="inline-flex items-center gap-2">
          <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
          <span>
            <span className="font-medium text-fg-2">{SELLER.name}</span> · {SELLER.lines.slice(0, 2).join(', ')} · VAT {SELLER.vat}
          </span>
        </span>
        <span className="font-mono">
          {SELLER.web} · {SELLER.register}
        </span>
      </div>
    </div>
  )
}
