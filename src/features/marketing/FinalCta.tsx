import type { MouseEvent } from 'react'
import { ArrowRight, Mail } from 'lucide-react'
import { Logo } from '@/components/brand'
import { Button, Dot } from '@/components/ui'
import { brand } from '@/config/brand'
import { toast } from '@/stores/toast'
import { Container, CornerMarks, Reveal, RingMotif, Section, SignalStop } from './shared'
import { scrollToId, useStartDemo } from './sharedUtils'

export function FinalCta() {
  const startDemo = useStartDemo()
  return (
    <Section className="pt-10 sm:pt-16">
      <Container>
        <Reveal>
          <div className="relative overflow-hidden rounded-[28px] border border-line bg-surface px-6 py-16 shadow-pop sm:px-12 sm:py-20">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-hatch [mask-image:linear-gradient(90deg,transparent_40%,black)]" />
            <RingMotif className="top-1/2 right-[-340px] size-[760px] -translate-y-1/2 opacity-90 sm:right-[-220px] lg:right-[-120px]" />
            <CornerMarks className="inset-4 sm:inset-5" />
            <div className="relative max-w-[720px]">
              <div className="flex items-center gap-3">
                <span className="mono-label text-fg-2!">{brand.product}</span>
                <span className="h-px w-8 bg-line-strong" />
                <span className="mono-label">{brand.descriptor}</span>
              </div>
              <h2 className="mt-6 font-display text-[44px] leading-[0.95] font-semibold tracking-[-0.04em] text-fg font-wide sm:text-[72px]">
                Connect<SignalStop /> Route<SignalStop />
                <br />
                Fulfill<SignalStop />
              </h2>
              <p className="mt-6 max-w-[540px] text-[15.5px] leading-relaxed text-fg-2 sm:text-[17px]">
                Run your digital-service business on a server you own — suppliers, catalog, pricing, storefront, reseller portal, API and ledger in one licensed platform. Start with the demo installation of UnlockDesk.
              </p>
              <div className="mt-9 flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center">
                <Button variant="accent" size="lg" to="/login" trailing={<ArrowRight />}>
                  Explore the platform
                </Button>
                <Button variant="secondary" size="lg" onClick={startDemo}>
                  Open the demo installation
                </Button>
                <Button variant="ghost" size="lg" href={`mailto:${brand.salesEmail}`} leading={<Mail />}>
                  Talk to sales
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  )
}

const COLUMNS: { title: string; links: { label: string; section?: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Platform', section: 'platform' },
      { label: 'Architecture', section: 'architecture' },
      { label: 'Suppliers', section: 'providers' },
      { label: 'Routing & failover', section: 'routing' },
      { label: 'Ledger & payments', section: 'ledger' },
      { label: 'API & DHRU', section: 'developers' },
      { label: 'Storefront & portal', section: 'website' },
      { label: 'Self-hosting', section: 'self-hosted' },
      { label: 'Pricing', section: 'pricing' },
    ],
  },
  {
    title: 'Developers',
    links: [{ label: 'Documentation' }, { label: 'API reference' }, { label: 'Driver SDK' }, { label: 'Changelog', section: 'updates' }, { label: 'Status' }],
  },
  {
    title: 'Company',
    links: [{ label: 'About' }, { label: 'Customers' }, { label: 'Careers' }, { label: 'Contact' }],
  },
  {
    title: 'Legal',
    links: [{ label: 'Terms of service' }, { label: 'Privacy policy' }, { label: 'License agreement' }, { label: 'Data processing' }, { label: 'Responsible disclosure' }],
  },
]

export function Footer() {
  const onLink = (e: MouseEvent, section?: string) => {
    e.preventDefault()
    if (section) scrollToId(section)
    else toast.info('Not part of this prototype', 'This page would live on the public vendor site.')
  }
  return (
    <footer className="relative border-t border-line">
      <Container className="py-14 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)]">
          <div className="max-w-[340px]">
            <Logo />
            <p className="mt-4 text-[13.5px] leading-relaxed text-fg-2">The licensed, self-hostable platform for running a digital-service resale business — GSM first, any supplier-delivered service next.</p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-[12px] text-fg-2">
              <Dot tone="success" pulse />
              All vendor systems operational
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {COLUMNS.map((c) => (
              <div key={c.title}>
                <div className="mono-label">{c.title}</div>
                <ul className="mt-4 space-y-2.5">
                  {c.links.map((l) => (
                    <li key={l.label}>
                      <a href={l.section ? `#${l.section}` : '#'} onClick={(e) => onLink(e, l.section)} className="text-[13.5px] text-fg-2 transition-colors hover:text-fg">
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-14 flex flex-col gap-3 border-t border-line pt-6 text-[12.5px] text-fg-3 sm:flex-row sm:items-center sm:justify-between">
          <span>
            © 2026 {brand.company}. All rights reserved. <span className="text-fg-3/80">Demo data — all suppliers, accounts and integrations are fictional and simulated.</span>
          </span>
          <span className="font-mono text-[11.5px]">
            {brand.domain} · {brand.supportEmail}
          </span>
        </div>
      </Container>
    </footer>
  )
}
