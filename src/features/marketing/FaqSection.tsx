import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { BookOpen, Mail, Plus } from 'lucide-react'
import { Button } from '@/components/ui'
import { brand } from '@/config/brand'
import { cn } from '@/lib/cn'
import { Container, Reveal, Section, SectionHeader } from './shared'
import { EASE } from './sharedUtils'

const FAQ: { q: string; a: string }[] = [
  {
    q: `Is ${brand.product} a complete platform or a routing layer?`,
    a: `A complete platform. One installation runs suppliers and catalog sync, services with versioned field schemas, pricing tiers, unified accounts with ledger-backed wallets, a storefront with checkout, a reseller portal, the Native API, a DHRU-compatible endpoint, payments, refunds, verification, notifications, audit and roles. GSM is the demo vertical; the core is generic for any digital service delivered by a supplier.`,
  },
  {
    q: 'How does it work with DHRU?',
    a: 'In three ways. The DHRU Fusion driver connects you to suppliers that run DHRU (HTTP form-POST with JSON replies — not SOAP). The DHRU-compatible endpoint lets your resellers keep their existing DHRU client: they change the URL, and their orders enter the same PlaceOrder command as every other channel. And the migration importer moves services, clients, price groups and credit balances from a DHRU panel — scan, dry run, diff, review, import, validate.',
  },
  {
    q: 'What happens when a supplier times out?',
    a: 'The order goes to Needs Review with the customer’s funds held. A timeout or ambiguous reply after the request was sent is an UNKNOWN outcome — the supplier may have accepted the order — so automatic failover is blocked to prevent a duplicate supplier order. Only definitive rejections classified failover-safe move on to the next offer. An operator checks the supplier and resolves the order as received or not received.',
  },
  {
    q: 'Self-hosted or vendor-managed — what’s the difference?',
    a: `Self-hosted: you run ${brand.coreProduct} on a server you control with Docker Compose (core-api, core-worker, core-scheduler, PostgreSQL, Caddy). Vendor-managed dedicated: ${brand.company} operates a dedicated server for your company alone. Either way it is a single-customer installation with its own PostgreSQL — never multi-tenant SaaS — and you can move between the two with a full database export.`,
  },
  {
    q: 'What happens when the license or update entitlement expires?',
    a: 'Nothing stops. The right to run the versions you installed is perpetual: orders, payments, the storefront, the reseller portal and the API keep working. Only releases published after your entitlement ends become unavailable until you renew. If our license server is unreachable, installations run from a cached validation for 30 days and then only show a notice — there is no remote kill switch.',
  },
  {
    q: `Who owns the data? Does anything reach ${brand.company}?`,
    a: 'You do. Orders, IMEIs, accounts, wallets, ledger entries, prices and supplier credentials are stored only in your installation’s PostgreSQL. The vendor platform receives a license heartbeat — license ID, installation ID, version and domain — and serves signed updates. Nothing else; no telemetry on your operations.',
  },
  {
    q: 'How do payments, wallets and refunds work?',
    a: 'Every account has a ledger-backed wallet and a pricing tier (Retail, Silver, Gold or Platinum). Placing an order holds its price; completion captures it, rejection releases it. Storefront checkout and top-ups run through payment gateway modules that post to the same double-entry ledger — simulated gateways in this demo. Refunds go to the wallet or the original method, are capped at what was captured, audited and idempotent.',
  },
  {
    q: 'Which databases are supported?',
    a: 'PostgreSQL 14–17 — bundled in the Compose stack or any managed PostgreSQL you trust, configured with a single DATABASE_URL. PostgreSQL also carries the job queue, so there is no Redis, Kafka or Kubernetes to operate.',
  },
  {
    q: 'How do updates work?',
    a: 'Each installation updates itself when you start it: download and verify the Ed25519 signature, preflight, backup, expand-only migration, worker drain, container swap and health check — with automatic rollback if the health check fails. Stable and beta channels; nothing installs automatically.',
  },
  {
    q: 'Do you help with deployment and migration?',
    a: 'Yes. The deployment package and go-live checklist are fully documented. Our engineers can also install and harden your server with you, run the DHRU import with your team, or build custom supplier drivers and extensions — included with Enterprise and available as professional services on every plan.',
  },
]

function Item({ item, open, onToggle, index }: { item: (typeof FAQ)[number]; open: boolean; onToggle: () => void; index: number }) {
  const id = `faq-${index}`
  return (
    <div className="border-b border-line">
      <h3>
        <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={id} className="group flex w-full items-center justify-between gap-6 py-5 text-left">
          <span className={cn('text-[15px] font-medium transition-colors sm:text-[16px]', open ? 'text-fg' : 'text-fg-2 group-hover:text-fg')}>{item.q}</span>
          <span className={cn('grid size-7 shrink-0 place-items-center rounded-full border transition-[transform,background-color,border-color] duration-300', open ? 'rotate-45 border-line-strong bg-surface-2 text-fg' : 'border-line text-fg-3 group-hover:border-line-strong')}>
            <Plus className="size-3.5" />
          </span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={id} role="region" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
            <p className="max-w-[640px] pb-6 text-[14px] leading-relaxed text-fg-2">{item.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <Section id="faq">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeader index="17" eyebrow="FAQ" title="Questions, answered." description="The questions we hear most from GSM service operators evaluating a platform they will run themselves." />
            <Reveal delay={0.08} className="mt-8 rounded-2xl border border-line bg-surface p-5 shadow-card">
              <div className="text-[14px] font-semibold text-fg">Still deciding?</div>
              <p className="mt-1 text-[13px] leading-relaxed text-fg-2">Talk to an engineer about your suppliers, your DHRU panel, reseller volumes and hosting setup.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" href={`mailto:${brand.salesEmail}`} leading={<Mail />}>
                  {brand.salesEmail}
                </Button>
                <Button variant="ghost" size="sm" href={brand.docsUrl} leading={<BookOpen />}>
                  Docs
                </Button>
              </div>
            </Reveal>
          </div>
          <Reveal delay={0.05} className="border-t border-line">
            {FAQ.map((f, i) => (
              <Item key={f.q} item={f} index={i} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />
            ))}
          </Reveal>
        </div>
      </Container>
    </Section>
  )
}
