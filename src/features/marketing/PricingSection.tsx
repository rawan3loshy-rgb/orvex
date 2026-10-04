import { ArrowRight, Check, Server, ShieldCheck } from 'lucide-react'
import { Badge, Button, Skeleton } from '@/components/ui'
import { usePublicPlans } from '@/hooks/vendor'
import { brand } from '@/config/brand'
import { money } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Plan } from '@/types/vendor'
import { Container, Reveal, Section, SectionHeader } from './shared'

const INCLUDED = ['Storefront & checkout', 'Reseller portal', 'Native API & DHRU compatibility', 'DHRU migration importer', 'Double-entry ledger & payments', 'Guarded failover routing', 'Roles, audit log & MFA', 'Signed updates · perpetual use']

function PlanCard({ plan, index }: { plan: Plan; index: number }) {
  const hi = plan.highlighted
  const custom = plan.priceMonthly == null
  return (
    <Reveal delay={index * 0.06} className="h-full">
      <div className={cn('relative flex h-full flex-col overflow-hidden rounded-2xl border p-6 sm:p-7', hi ? 'border-accent/50 bg-surface shadow-pop' : 'border-line bg-surface shadow-card')}>
        {hi && <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-accent" />}
        <div className="relative mb-4 font-mono text-[10.5px] tracking-[0.09em] text-fg-3 uppercase tabular">
          0{index + 1} · {plan.id === 'enterprise' ? 'Multi-installation' : 'Self-hosted license'}
        </div>
        <div className="relative flex items-center justify-between gap-3">
          <h3 className="font-display text-[20px] font-semibold tracking-[-0.02em] text-fg">{plan.name}</h3>
          {hi && (
            <Badge tone="accent" variant="solid">
              Most popular
            </Badge>
          )}
        </div>
        <p className="relative mt-2 min-h-[42px] text-[13.5px] leading-relaxed text-fg-2">{plan.tagline}</p>

        <div className="relative mt-6 flex items-baseline gap-1.5">
          <span className="font-display text-[40px] leading-none font-semibold tracking-[-0.035em] text-fg tabular font-wide">{custom ? 'Custom' : money(plan.priceMonthly).replace(/\.00$/, '')}</span>
          {!custom && <span className="text-[13.5px] text-fg-3">/ month</span>}
        </div>
        <div className="relative mt-1.5 text-[12.5px] text-fg-3">{plan.billingNote}</div>

        <div className="relative mt-5 flex items-center gap-2 rounded-lg border border-line bg-surface-2/60 px-3 py-2 text-[12.5px] text-fg-2">
          <Server className="size-3.5 shrink-0 text-fg-3" />
          {plan.installations}
        </div>

        <ul className="relative mt-6 flex-1 space-y-2.5">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-[13.5px] text-fg-2">
              <Check className={cn('mt-0.5 size-4 shrink-0', hi ? 'text-accent-ink' : 'text-fg-3')} />
              {f}
            </li>
          ))}
        </ul>

        <div className="relative mt-7">
          {plan.id === 'enterprise' ? (
            <Button variant="secondary" size="lg" className="w-full" href={`mailto:${brand.salesEmail}?subject=${encodeURIComponent(`${brand.product} Enterprise`)}`}>
              Talk to sales
            </Button>
          ) : (
            <Button variant={hi ? 'accent' : 'secondary'} size="lg" className="w-full" to="/login" trailing={<ArrowRight />}>
              {hi ? 'Start with Professional' : `Start with ${plan.name}`}
            </Button>
          )}
        </div>
      </div>
    </Reveal>
  )
}

export function PricingSection() {
  const { data: plans, isLoading } = usePublicPlans()
  return (
    <Section id="pricing">
      <Container>
        <SectionHeader
          align="center"
          index="16"
          eyebrow="Pricing"
          title="Simple, self-hosted licensing."
          description={`Pay for the license, not for your growth. The complete platform in every plan — no per-order fees, no per-IMEI fees and no usage meters on your business. The right to run your installed version never expires.`}
        >
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] text-fg-2 shadow-card">
            <ShieldCheck className="size-3.5 text-fg-3" />
            Every plan is a <span className="font-medium text-fg">self-hosted license</span> · vendor-managed dedicated servers on Enterprise
          </div>
        </SectionHeader>

        <div className="mt-12 grid items-stretch gap-4 md:grid-cols-3 lg:mt-14">
          {isLoading || !plans
            ? Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="rounded-2xl border border-line bg-surface p-7">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="mt-3 h-4 w-full" />
                  <Skeleton className="mt-8 h-10 w-36" />
                  <div className="mt-8 space-y-3">
                    {Array.from({ length: 5 }, (_, j) => (
                      <Skeleton key={j} className="h-4 w-4/5" />
                    ))}
                  </div>
                </div>
              ))
            : plans.map((p, i) => <PlanCard key={p.id} plan={p} index={i} />)}
        </div>

        <Reveal className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong px-5 py-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <span className="mono-label shrink-0">Included in every plan</span>
          <ul className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 sm:justify-end">
            {INCLUDED.map((f) => (
              <li key={f} className="flex items-center gap-1.5 text-[12.5px] text-fg-2">
                <Check className="size-3.5 text-fg-3" />
                {f}
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </Section>
  )
}
