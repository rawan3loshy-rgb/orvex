import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { ChevronRight, FileSignature, Percent, Tag } from 'lucide-react'
import type { PriceRow, PricingGroup } from '@/types/installation'
import { Card, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { money, pct } from '@/lib/format'
import { rulePrice } from './shared'

/** Visual explanation of the three-step price resolution, using a real service of the selected group. */
export function PricingModel({ group, sample }: { group?: PricingGroup; sample?: PriceRow }) {
  const ready = group && sample
  const rule = ready ? rulePrice(sample.publicPrice, group.discountPercent) : 0
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-1 border-b border-line px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-[14px] font-semibold tracking-[-0.01em]">How a price is resolved</h3>
          <p className="mt-0.5 text-[12.5px] text-fg-3">Evaluated for every order at creation time, then frozen on the order.</p>
        </div>
        {ready ? (
          <p className="text-[12px] text-fg-3">
            Example · <span className="text-fg-2">{sample.serviceName}</span> in <span className="text-fg-2">{group.name}</span>
          </p>
        ) : (
          <Skeleton className="h-3.5 w-56" />
        )}
      </div>
      <div className="grid gap-px bg-line md:grid-cols-[1fr_1fr_1fr_1.1fr]">
        <Step n={1} icon={<Tag />} title="Public price" body="List price set on the service. Charged on the website and to Standard-group shops." value={ready ? money(sample.publicPrice) : null} />
        <Step
          n={2}
          icon={<Percent />}
          title="Group discount"
          body="A percentage off the public price, applied to every check, unlock and code in the group."
          value={ready ? (group.discountPercent ? <>−{group.discountPercent}% → {money(rule)}</> : 'No discount') : null}
          muted={ready ? group.discountPercent === 0 : false}
        />
        <Step
          n={3}
          icon={<FileSignature />}
          title="Contract override"
          body="A fixed per-service price negotiated with a distributor or contract partner. Always wins over the discount."
          value={ready ? (sample.overridden ? money(sample.groupPrice) : 'None for this service') : null}
          muted={ready ? !sample.overridden : false}
        />
        <div className="relative flex flex-col justify-between gap-3 bg-[color-mix(in_oklab,var(--accent)_5%,var(--surface))] p-5">
          <div className="mono-label text-accent-ink">Effective price</div>
          {ready ? (
            <motion.div key={`${group.id}-${sample.groupPrice}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
              <div className="font-display text-[30px] leading-none font-semibold tracking-[-0.03em] text-fg tabular">{money(sample.groupPrice)}</div>
              <div className="mt-2 text-[12px] text-fg-3">
                Supplier cost {money(sample.cost)} · margin <span className={cn('font-medium', sample.marginPercent < 30 ? 'text-warning' : 'text-fg')}>{pct(sample.marginPercent)}</span>
              </div>
            </motion.div>
          ) : (
            <Skeleton className="h-8 w-24" />
          )}
        </div>
      </div>
    </Card>
  )
}

function Step({ n, icon, title, body, value, muted }: { n: number; icon: ReactNode; title: string; body: string; value: ReactNode; muted?: boolean }) {
  return (
    <div className="relative flex flex-col gap-3 bg-surface p-5">
      <div className="flex items-center gap-2.5">
        <span className="grid size-7 place-items-center rounded-lg border border-line bg-surface-2 text-fg-2 [&_svg]:size-3.5">{icon}</span>
        <span className="text-[13px] font-medium text-fg">
          <span className="mr-1.5 font-mono text-[11px] text-fg-3">0{n}</span>
          {title}
        </span>
      </div>
      <p className="text-[12.5px] leading-relaxed text-fg-3">{body}</p>
      <div className={cn('mt-auto font-mono text-[13px] tabular', muted ? 'text-fg-3' : 'text-fg')}>{value ?? <Skeleton className="h-4 w-20" />}</div>
      <ChevronRight className="absolute top-1/2 -right-[11px] z-[1] hidden size-5 -translate-y-1/2 rounded-full border border-line bg-surface p-0.5 text-fg-3 md:block" />
    </div>
  )
}
