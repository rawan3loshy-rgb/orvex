import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { MotionConfig } from 'motion/react'
import { brand } from '@/config/brand'
import { Navbar } from './Navbar'
import { Hero } from './Hero'
import { ArchitectureSection } from './ArchitectureSection'
import { WhySection } from './WhySection'
import { ProvidersSection } from './ProvidersSection'
import { CatalogSection } from './CatalogSection'
import { RoutingSection } from './RoutingSection'
import { ApiSection } from './ApiSection'
import { AutomationSection } from './AutomationSection'
import { LedgerSection } from './LedgerSection'
import { SelfHostedSection } from './SelfHostedSection'
import { SecuritySection } from './SecuritySection'
import { AnalyticsSection } from './AnalyticsSection'
import { WebsiteBuilderSection } from './WebsiteBuilderSection'
import { UpdatesSection } from './UpdatesSection'
import { WorkflowSection } from './WorkflowSection'
import { PricingSection } from './PricingSection'
import { FaqSection } from './FaqSection'
import { FinalCta, Footer } from './FinalCta'
import { SectionRule } from './shared'
import { scrollToId } from './sharedUtils'

/**
 * Public marketing site of the vendor (orvex.io).
 * Route: `/` — the start of the prototype journey.
 */
export default function LandingPage() {
  const { hash } = useLocation()
  // Only the hash the page was opened with scrolls on mount; later in-page links scroll themselves.
  const [initialHash] = useState(hash)

  useEffect(() => {
    document.title = `${brand.product} — ${brand.descriptor} · ${brand.tagline}`
    if (initialHash) {
      const id = initialHash.slice(1)
      const t = setTimeout(() => scrollToId(id), 60)
      return () => clearTimeout(t)
    }
    window.scrollTo({ top: 0 })
    return undefined
  }, [initialHash])

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-dvh overflow-x-clip bg-bg text-fg">
        <Navbar />
        <main>
          <Hero />
          <SectionRule />
          <ArchitectureSection />
          <SectionRule />
          <WhySection />
          <SectionRule />
          <ProvidersSection />
          <CatalogSection />
          <RoutingSection />
          <AutomationSection />
          <SectionRule />
          <LedgerSection />
          <ApiSection />
          <WebsiteBuilderSection />
          <SelfHostedSection />
          <SecuritySection />
          <SectionRule />
          <AnalyticsSection />
          <SectionRule />
          <UpdatesSection />
          <WorkflowSection />
          <PricingSection />
          <SectionRule />
          <FaqSection />
          <FinalCta />
        </main>
        <Footer />
      </div>
    </MotionConfig>
  )
}
