import { useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { CircleCheck, Calculator, ExternalLink, Tag } from 'lucide-react'
import { Badge, Button, Card, CardBody, CardHeader, Field, Input, Textarea } from '@/components/ui'
import { Guarded, MarginGuardBadge, Money, PermissionHint, PriceSteps } from '@/components/domain'
import { useInstMutation, usePricing } from '@/hooks/installation'
import { catalogService } from '@/services/installation'
import { formatBps, formatMoney, parseMoney, type Micros } from '@/core/money'
import type { ServiceDetail } from '@/types/installation'
import { cn } from '@/lib/cn'
import { dateTime } from '@/lib/format'
import { Callout } from '../../catalog/kit'
import { METHOD_LABEL, ruleValueLabel } from './pricingLabels'

export function PricingTab({ d }: { d: ServiceDetail }) {
  const pricing = usePricing()
  const defaultTier = pricing.data?.tiers.find((t) => t.isDefault)
  const retail = d.quotes.find((q) => q.tierId === defaultTier?.id) ?? d.quotes[0]
  const [amount, setAmount] = useState(retail ? formatMoney(retail.amount).replace('$', '') : '')
  const [reason, setReason] = useState('')
  const [saved, setSaved] = useState<Micros | null>(null)
  const parsed = parseMoney(amount)
  const usedRuleIds = new Set(d.quotes.map((q) => q.ruleId))

  const setPrice = useInstMutation((v: { amount: Micros; reason: string }) => catalogService.setPrice(d.service.id, { tierId: retail!.tierId, amount: v.amount, reason: v.reason || undefined }), {
    success: (_, v) => `${retail?.tierName ?? 'Retail'} price set to ${formatMoney(v.amount)}`,
    onSuccess: (_, v) => {
      setSaved(v.amount)
      setReason('')
    },
  })

  const changed = parsed != null && retail != null && parsed !== retail.amount
  const belowCost = parsed != null && retail?.referenceCost != null && parsed < retail.referenceCost

  return (
    <div className="grid gap-4">
      <Callout icon={<Calculator />} title="Prices are calculated, never copied">
        Each tier price is computed live from the pricing rules and the cost of the first routable offer. The storefront, portal, API and DHRU endpoint all ask the same engine — nothing is duplicated into the website. Every order snapshots its quote, so later changes never alter placed orders.
      </Callout>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid content-start gap-4 md:grid-cols-2">
          {d.quotes.map((q, i) => (
            <motion.div key={q.tierId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="h-full">
                <div className="flex items-start justify-between gap-3 px-4 pt-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ background: pricing.data?.tiers.find((t) => t.id === q.tierId)?.color ?? 'var(--fg-3)' }} />
                      <span className="text-[13px] font-semibold">{q.tierName}</span>
                      {q.inheritedFrom && (
                        <Badge tone="neutral" variant="outline">
                          inherits {q.inheritedFrom}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 font-display text-[26px] leading-none font-semibold tabular">
                      <Money value={q.amount} />
                    </div>
                  </div>
                  <div className="text-right">
                    <MarginGuardBadge guard={q.guard} />
                    <div className="mt-1 text-[11.5px] text-fg-3">
                      margin <Money value={q.margin} tone="auto" /> · {formatBps(q.marginBps)}
                    </div>
                  </div>
                </div>
                <div className="p-4 pt-3">
                  <div className="mono-label mb-1.5">Why this price?</div>
                  <PriceSteps quote={q} compact />
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid content-start gap-4">
          <Card className={cn(saved != null && 'border-success/40')}>
            <CardHeader title={`Set ${retail?.tierName ?? 'retail'} price`} description="Fixed list price for this service. Creates or edits the service-scoped rule." icon={<Tag />} />
            <CardBody className="space-y-3">
              <Field label="Price" hint={retail?.referenceCost != null ? `Current supplier cost ${formatMoney(retail.referenceCost)} (first routable offer)` : undefined} error={amount && parsed == null ? 'Enter an amount like 4.00' : belowCost ? 'Below supplier cost — the margin guard would block routing' : undefined}>
                <Input mono inputSize="lg" leading={<span className="text-[14px]">$</span>} value={amount} invalid={!!amount && parsed == null} onChange={(e) => setAmount(e.target.value)} />
              </Field>
              <Field label="Reason" optional hint="Recorded in the audit log with the before/after prices.">
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Supplier cost increase" className="min-h-14" />
              </Field>
              <div className="flex items-center justify-between gap-2">
                <PermissionHint permission="pricing.manage" />
                <Guarded permission="pricing.manage">
                  {(ok) => (
                    <Button variant="accent" size="sm" disabled={!ok || !changed} loading={setPrice.isPending} onClick={() => parsed != null && setPrice.mutate({ amount: parsed, reason: reason.trim() })}>
                      Save price
                    </Button>
                  )}
                </Guarded>
              </div>
              {saved != null && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-success/30 bg-success/[0.06] p-3">
                  <div className="flex items-center gap-2 text-[12.5px] font-medium text-success">
                    <CircleCheck className="size-4" /> Live everywhere now — <Money value={saved} />
                  </div>
                  <p className="mt-1 text-[12px] text-fg-2">No publish step: the storefront reads the price from the pricing engine on every request.</p>
                  <Button size="sm" className="mt-2" leading={<ExternalLink />} to={`/site/services/${d.service.slug}`}>
                    Open on storefront
                  </Button>
                </motion.div>
              )}
              {saved == null && d.service.visibility.storefront && (
                <Link to={`/site/services/${d.service.slug}`} className="inline-flex items-center gap-1 text-[12px] text-accent-ink hover:underline">
                  <ExternalLink className="size-3" /> View on storefront
                </Link>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Rules that apply" description="Precedence inside a tier: service → category → all. A tier without a rule inherits the default tier." />
            <div className="divide-y divide-line border-t border-line">
              {d.rules
                .slice()
                .sort((a, b) => (pricing.data?.tiers.findIndex((t) => t.id === a.tierId) ?? 0) - (pricing.data?.tiers.findIndex((t) => t.id === b.tierId) ?? 0))
                .map((r) => {
                  const used = usedRuleIds.has(r.id)
                  return (
                    <div key={r.id} className={cn('px-4 py-2.5', !used && 'opacity-60')}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12.5px] font-medium">{pricing.data?.tiers.find((t) => t.id === r.tierId)?.name ?? r.tierId}</span>
                        <span className="font-mono text-[12px]">{ruleValueLabel(r)}</span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2 text-[11.5px] text-fg-3">
                        <span className="truncate">
                          {r.scope.kind === 'service' ? 'This service' : r.scope.kind === 'category' ? d.category.name : 'All services'} · {METHOD_LABEL[r.method]}
                          {r.note ? ` · ${r.note}` : ''}
                        </span>
                        {used ? <Badge tone="success">in use</Badge> : <span>overridden</span>}
                      </div>
                      <div className="text-[11px] text-fg-3">
                        {r.updatedBy} · {dateTime(r.updatedAt)}
                      </div>
                    </div>
                  )
                })}
            </div>
            <div className="border-t border-line px-4 py-2.5">
              <Link to="/admin/pricing" className="text-[12px] text-accent-ink hover:underline">
                All pricing rules →
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
