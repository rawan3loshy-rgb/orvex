import { useState } from 'react'
import { motion } from 'motion/react'
import { ArrowRight, Building, CalendarClock, Check, Code, Gauge, Layers, LifeBuoy, Minus, PackagePlus, Server, Sparkles, TriangleAlert } from 'lucide-react'
import { Badge, Button, Card, CardBody, CardFooter, CardHeader, ConfirmDialog, DescriptionList, Meter, Modal, PageHeader, Progress, Skeleton, StatusBadge, Switch } from '@/components/ui'
import { usePlans, useSubscription, useVendorInstallations, useVendorLicense, useVendorMutation } from '@/hooks/vendor'
import { billingService } from '@/services/vendor'
import { toast } from '@/stores/toast'
import { cn } from '@/lib/cn'
import { date, money, plural } from '@/lib/format'
import type { Plan, Subscription } from '@/types/vendor'
import { Callout, CardSkeleton, IconTile, Reveal, TopGlow } from './components/kit'
import { daysBetween, daysUntil, periodProgress } from './components/kitUtils'
import { NewTicketModal, type TicketDefaults } from './components/NewTicketModal'

const CYCLE: Record<Subscription['billingCycle'], { months: number; label: string; adjective: string }> = {
  monthly: { months: 1, label: 'month', adjective: 'Monthly' },
  quarterly: { months: 3, label: 'quarter', adjective: 'Quarterly' },
  annual: { months: 12, label: 'year', adjective: 'Annual' },
}

const RANK: Record<Plan['id'], number> = { starter: 0, professional: 1, enterprise: 2 }

/** Add-ons offered on top of the plan (catalogue, quoted by sales). */
const AVAILABLE_ADDONS = [
  { id: 'addon_staging', name: 'Additional staging installation', price: '$79 / month', description: 'One more non-production installation slot on your license.', icon: <Server /> },
  { id: 'addon_devhours', name: 'Professional services block', price: '$1,400 · 10 hours', description: 'Custom supplier drivers, field types, payment gateway modules and extensions built by our engineers.', icon: <Code /> },
  { id: 'addon_update', name: 'Vendor-assisted update window', price: '$350 per update', description: 'We run the update with your team in a low-traffic window, including a rollback plan.', icon: <CalendarClock /> },
]

const priceLabel = (v: number) => money(v).replace(/\.00$/, '')

interface TicketIntent {
  defaults: TicketDefaults
  title: string
  description: string
  success: string
  submitLabel: string
}

/* ------------------------------------------------------------------ */

function ChangePlanModal({
  open,
  onClose,
  initial,
  plans,
  sub,
  moduleNames,
  installCount,
  onScheduled,
  onContactSales,
}: {
  open: boolean
  onClose: () => void
  initial: Plan['id']
  plans: Plan[]
  sub: Subscription
  moduleNames: Record<string, string>
  installCount: number
  onScheduled: (p: Plan) => void
  onContactSales: () => void
}) {
  const [target, setTarget] = useState<Plan['id']>(initial)
  const [busy, setBusy] = useState(false)
  // Re-select the suggested plan when the modal opens (adjusted during render, not in an effect).
  const [prev, setPrev] = useState({ open, initial })
  if (prev.open !== open || prev.initial !== initial) {
    setPrev({ open, initial })
    if (open) setTarget(initial)
  }

  const current = plans.find((p) => p.id === sub.planId)!
  const next = plans.find((p) => p.id === target)!
  const months = CYCLE[sub.billingCycle].months
  const addOnTotal = sub.addOns.reduce((a, x) => a + x.price * months, 0)
  const newAmount = next.priceMonthly != null ? next.priceMonthly * months + addOnTotal : null
  const diff = newAmount != null ? newAmount - sub.amount : null
  const downgrade = RANK[next.id] < RANK[current.id]
  const lost = current.modules.filter((m) => !next.modules.includes(m))
  const same = next.id === current.id
  const enterprise = next.id === 'enterprise'

  const confirm = () => {
    setBusy(true)
    setTimeout(() => {
      setBusy(false)
      onScheduled(next)
      toast.success('Plan change scheduled', downgrade ? `${next.name} takes effect on ${date(sub.nextRenewalAt)}. You keep ${current.name} until then.` : `${next.name} is active now; the difference is prorated on your next invoice.`)
      onClose()
    }, 900)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={<Layers />}
      title="Change plan"
      description="Plan changes update your license entitlements at the next validation."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {enterprise ? (
            <Button
              variant="accent"
              onClick={() => {
                onClose()
                onContactSales()
              }}
              trailing={<ArrowRight />}
            >
              Contact sales
            </Button>
          ) : (
            <Button variant={downgrade ? 'primary' : 'accent'} disabled={same} loading={busy} onClick={confirm}>
              {downgrade ? `Schedule switch to ${next.name}` : `Upgrade to ${next.name}`}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Plan">
          {plans.map((p) => {
            const selected = p.id === target
            const isCurrent = p.id === current.id
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTarget(p.id)}
                className={cn(
                  'relative rounded-xl border p-3.5 text-left transition-[border-color,background-color,box-shadow] duration-150',
                  selected ? 'border-accent/60 bg-accent/[0.06] shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_14%,transparent)]' : 'border-line hover:border-line-strong hover:bg-surface-2/60',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13.5px] font-semibold text-fg">{p.name}</span>
                  <span className={cn('grid size-4 place-items-center rounded-full border', selected ? 'border-accent bg-accent' : 'border-line-strong')}>{selected && <span className="size-1.5 rounded-full bg-white" />}</span>
                </div>
                <p className="mt-1 text-[12px] text-fg-3">{p.priceMonthly != null ? `${priceLabel(p.priceMonthly)} / month` : 'Custom · annual'}</p>
                {isCurrent && (
                  <Badge tone="accent" className="mt-2">
                    Current
                  </Badge>
                )}
              </button>
            )
          })}
        </div>

        {same ? (
          <Callout icon={<Check />} tone="neutral">
            You’re on {current.name}. Pick another plan to see what changes.
          </Callout>
        ) : enterprise ? (
          <Callout icon={<Building />} tone="accent" title="Enterprise is sold on an annual agreement">
            Additional installations, a vendor-managed dedicated option, custom supplier drivers, white-label admin and a 1-hour critical SLA. Our team prepares a quote with you.
          </Callout>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-line bg-surface-2/50 p-4">
              <div>
                <p className="mono-label">Now</p>
                <p className="mt-1 text-[14px] font-semibold text-fg">{current.name}</p>
                <p className="text-[12.5px] text-fg-3 tabular">
                  {money(sub.amount)} / {CYCLE[sub.billingCycle].label}
                </p>
              </div>
              <ArrowRight className="size-4 text-fg-3" />
              <div>
                <p className="mono-label">{downgrade ? `From ${date(sub.nextRenewalAt)}` : 'Immediately'}</p>
                <p className="mt-1 text-[14px] font-semibold text-fg">{next.name}</p>
                <p className="text-[12.5px] text-fg-3 tabular">
                  {money(newAmount)} / {CYCLE[sub.billingCycle].label}
                  {diff != null && diff !== 0 && <span className={cn('ml-1.5 font-medium', diff < 0 ? 'text-success' : 'text-fg-2')}>{diff < 0 ? `−${money(Math.abs(diff))}` : `+${money(diff)}`}</span>}
                </p>
              </div>
            </div>
            {lost.length > 0 && (
              <Callout icon={<TriangleAlert />} tone="warning" title="Modules that will be disabled">
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {lost.map((m) => (
                    <Badge key={m} tone="warning" variant="outline">
                      {moduleNames[m] ?? m}
                    </Badge>
                  ))}
                </div>
                <p className="mt-2">Your installations will turn these off after their first license validation on the new plan. Configuration is kept, not deleted.</p>
              </Callout>
            )}
            {next.id === 'starter' && installCount > 1 && (
              <Callout icon={<Server />} tone="warning" title={`Starter includes ${next.installations.toLowerCase()}`}>
                You currently run {plural(installCount, 'installation')}. Deactivate your staging installation before {date(sub.nextRenewalAt)}.
              </Callout>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */

export default function SubscriptionPage() {
  const subQ = useSubscription()
  const plansQ = usePlans()
  const license = useVendorLicense()
  const installs = useVendorInstallations()
  const update = useVendorMutation(billingService.updateSubscription)

  const [confirmOff, setConfirmOff] = useState(false)
  const [changeOpen, setChangeOpen] = useState(false)
  const [changeInitial, setChangeInitial] = useState<Plan['id']>('professional')
  const [ticket, setTicket] = useState<TicketIntent | null>(null)
  const [scheduled, setScheduled] = useState<Plan | null>(null)

  const sub = subQ.data
  const plans = plansQ.data
  const currentPlan = plans?.find((p) => p.id === sub?.planId)
  const cycle = sub ? CYCLE[sub.billingCycle] : CYCLE.quarterly
  const moduleNames = Object.fromEntries((license.data?.modules ?? []).map((m) => [m.id, m.name]))
  const periodPct = sub ? periodProgress(sub.currentPeriodStart, sub.currentPeriodEnd) : 0
  const periodDays = sub ? daysBetween(sub.currentPeriodStart, sub.currentPeriodEnd) : 0

  const contactSales = () =>
    setTicket({
      title: 'Talk to sales about Enterprise',
      description: 'Our team replies within one business day with a tailored proposal.',
      submitLabel: 'Send to sales',
      success: 'Our sales team will reach out within one business day.',
      defaults: {
        subject: 'Enterprise plan inquiry — UnlockDesk Demo Ltd.',
        category: 'General',
        priority: 'normal',
        body: 'Hi, we’re on Professional and would like to discuss Enterprise for UnlockDesk Demo Ltd. — in particular an additional production installation, custom supplier drivers and the white-label admin.',
      },
    })

  const requestAddon = (name: string) =>
    setTicket({
      title: `Request: ${name}`,
      description: 'Your account manager confirms pricing and timing before anything changes.',
      submitLabel: 'Send request',
      success: 'Your account manager will confirm pricing within one business day.',
      defaults: {
        subject: `Add-on request: ${name}`,
        category: 'Billing',
        priority: 'low',
        body: `Hi, we’d like to add “${name}” to our ${sub?.planName ?? 'Professional'} subscription (${sub?.id ?? ''}). Please confirm pricing and when it would take effect.`,
      },
    })

  const setAutoRenew = (v: boolean) => {
    if (!sub) return
    if (!v) return setConfirmOff(true)
    update.mutate({ autoRenew: true }, { onSuccess: () => toast.success('Auto-renew turned on', `Your plan renews automatically on ${date(sub.nextRenewalAt)}.`) })
  }

  return (
    <div>
      <Reveal>
        <PageHeader
          title="Subscription"
          description="Your ORVEX Core plan, billing cycle and add-ons. Plan changes reach your installations through the next license validation."
          actions={
            <>
              <Button variant="secondary" to="/account/billing">
                Billing & payment
              </Button>
              <Button
                variant="primary"
                disabled={!sub}
                onClick={() => {
                  setChangeInitial(sub?.planId ?? 'professional')
                  setChangeOpen(true)
                }}
              >
                Change plan
              </Button>
            </>
          }
        />
      </Reveal>

      {scheduled && sub && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
          <Callout
            tone="accent"
            icon={<CalendarClock />}
            title={`Scheduled: switch to ${scheduled.name} on ${date(sub.nextRenewalAt)}`}
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setScheduled(null)
                  toast.info('Scheduled change cancelled', `You’ll stay on ${sub.planName}.`)
                }}
              >
                Keep {sub.planName}
              </Button>
            }
          >
            You keep every {sub.planName} feature until then.
          </Callout>
        </motion.div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Current plan */}
        <Reveal delay={0.05} className="lg:col-span-2">
          {sub && currentPlan ? (
            <Card className="relative h-full overflow-hidden">
              <TopGlow />
              <div className="flex flex-col gap-6 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <IconTile icon={<Layers />} tone="accent" size="lg" />
                    <div>
                      <p className="mono-label">Current plan</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2.5">
                        <h2 className="font-display text-[28px] leading-none font-semibold tracking-[-0.025em] text-fg">{sub.planName}</h2>
                        <StatusBadge status={sub.status} />
                      </div>
                      <p className="mt-2 max-w-md text-[13px] text-fg-2">{currentPlan.tagline}</p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="font-display text-[28px] leading-none font-semibold tracking-[-0.025em] text-fg tabular">{money(sub.amount)}</p>
                    <p className="mt-1.5 text-[12.5px] text-fg-3">per {cycle.label} · USD</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-[12px]">
                  {currentPlan.priceMonthly != null && (
                    <span className="rounded-md border border-line bg-surface-2/60 px-2 py-1 text-fg-2 tabular">
                      {currentPlan.name} {priceLabel(currentPlan.priceMonthly)} × {cycle.months} = <span className="text-fg">{money(currentPlan.priceMonthly * cycle.months)}</span>
                    </span>
                  )}
                  {sub.addOns.map((a) => (
                    <span key={a.id} className="rounded-md border border-line bg-surface-2/60 px-2 py-1 text-fg-2 tabular">
                      {a.name} {priceLabel(a.price)} × {cycle.months} = <span className="text-fg">{money(a.price * cycle.months)}</span>
                    </span>
                  ))}
                </div>

                <DescriptionList
                  columns={2}
                  items={[
                    { label: 'Billing cycle', value: cycle.adjective },
                    { label: 'Current period', value: `${date(sub.currentPeriodStart)} – ${date(sub.currentPeriodEnd)}` },
                    { label: 'Next renewal', value: date(sub.nextRenewalAt), hint: `in ${plural(Math.max(0, daysUntil(sub.nextRenewalAt)), 'day')}` },
                    { label: 'Customer since', value: date(sub.startedAt) },
                    { label: 'Payment method', value: `${sub.paymentMethod.brand} •••• ${sub.paymentMethod.last4}` },
                    { label: 'Subscription ID', value: sub.id, mono: true },
                  ]}
                />

                <div>
                  <div className="mb-2 flex items-center justify-between text-[12px] text-fg-3">
                    <span>Billing period</span>
                    <span className="tabular">
                      Day {Math.min(periodDays, Math.round(periodPct * periodDays))} of {periodDays}
                    </span>
                  </div>
                  <Progress value={periodPct * 100} />
                </div>
              </div>
              <div className="flex flex-col gap-3 border-t border-line bg-surface-2/40 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-fg">Auto-renew</p>
                  <p className="text-[12.5px] text-fg-3">
                    {sub.autoRenew ? `Renews on ${date(sub.nextRenewalAt)} and charges ${sub.paymentMethod.brand} •••• ${sub.paymentMethod.last4}.` : `Your subscription ends on ${date(sub.currentPeriodEnd)} unless you renew.`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {update.isPending && <span className="text-[12px] text-fg-3">Saving…</span>}
                  <Switch checked={sub.autoRenew} disabled={update.isPending} onChange={setAutoRenew} label="Auto-renew" />
                </div>
              </div>
            </Card>
          ) : (
            <CardSkeleton rows={8} className="h-full" />
          )}
        </Reveal>

        {/* Usage */}
        <Reveal delay={0.1}>
          {sub ? (
            <Card className="flex h-full flex-col">
              <CardHeader icon={<Gauge />} title="Usage this period" description="Measured against your plan’s limits" />
              <CardBody className="flex-1 space-y-5">
                {sub.usage.map((u) => (
                  <div key={u.label}>
                    <Meter label={u.label} value={u.used} max={u.limit} unit={u.unit} />
                    {u.limit != null && u.used >= u.limit && <p className="mt-1.5 text-[11.5px] text-fg-3">At your plan limit — Enterprise adds more installations.</p>}
                  </div>
                ))}
              </CardBody>
              <CardFooter>
                <span>Admin users are counted per installation.</span>
              </CardFooter>
            </Card>
          ) : (
            <CardSkeleton rows={6} className="h-full" />
          )}
        </Reveal>
      </div>

      {/* Add-ons */}
      <Reveal delay={0.15} className="mt-5">
        <Card>
          <CardHeader icon={<PackagePlus />} title="Add-ons" description="Extend your plan without changing it" />
          <CardBody>
            {sub ? (
              <div className="grid gap-3 md:grid-cols-2">
                {sub.addOns.map((a) => (
                  <div key={a.id} className="relative flex items-start gap-3 overflow-hidden rounded-xl border border-success/25 bg-success/[0.04] p-4">
                    <IconTile icon={<LifeBuoy />} tone="success" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13.5px] font-medium text-fg">{a.name}</p>
                        <StatusBadge status="active" />
                      </div>
                      <p className="mt-0.5 text-[12.5px] text-fg-3">{a.description}</p>
                      <p className="mt-2 text-[12px] text-fg-2 tabular">
                        {priceLabel(a.price)} / month · {money(a.price * cycle.months)} per {cycle.label}
                      </p>
                    </div>
                  </div>
                ))}
                {AVAILABLE_ADDONS.map((a) => (
                  <div key={a.id} className="group flex items-start gap-3 rounded-xl border border-line p-4 transition-colors hover:border-line-strong hover:bg-surface-2/40">
                    <IconTile icon={a.icon} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium text-fg">{a.name}</p>
                      <p className="mt-0.5 text-[12.5px] text-fg-3">{a.description}</p>
                      <p className="mt-2 text-[12px] text-fg-2">{a.price}</p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => requestAddon(a.name)}>
                      Request
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-[104px] rounded-xl" />
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </Reveal>

      {/* Plans */}
      <Reveal delay={0.2} className="mt-10 scroll-mt-32" id="plans">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-[19px] font-semibold tracking-[-0.02em]">Compare plans</h2>
            <p className="mt-0.5 text-[13px] text-fg-3">Every plan is self-hosted, includes signed updates and keeps your data on your infrastructure.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {plans
            ? plans.map((p) => {
                const isCurrent = p.id === sub?.planId
                const lower = sub ? RANK[p.id] < RANK[sub.planId] : false
                return (
                  <Card key={p.id} className={cn('relative flex flex-col p-5', isCurrent && 'border-accent/45 shadow-[0_0_0_1px_color-mix(in_oklab,var(--accent)_35%,transparent),var(--shadow-card)]')}>
                    {isCurrent && <TopGlow />}
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-display text-[17px] font-semibold tracking-[-0.015em] text-fg">{p.name}</p>
                      {isCurrent ? (
                        <Badge tone="accent" variant="solid">
                          Current plan
                        </Badge>
                      ) : p.highlighted ? (
                        <Badge tone="accent" icon={<Sparkles />}>
                          Popular
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1.5 min-h-[38px] text-[12.5px] text-fg-3">{p.tagline}</p>
                    <div className="mt-4 flex items-baseline gap-1.5">
                      {p.priceMonthly != null ? (
                        <>
                          <span className="font-display text-[30px] leading-none font-semibold tracking-[-0.03em] text-fg tabular">{priceLabel(p.priceMonthly)}</span>
                          <span className="text-[12.5px] text-fg-3">/ month</span>
                        </>
                      ) : (
                        <span className="font-display text-[30px] leading-none font-semibold tracking-[-0.03em] text-fg">Custom</span>
                      )}
                    </div>
                    <p className="mt-1 text-[12px] text-fg-3">{p.billingNote}</p>
                    <div className="mt-4 flex items-center gap-2 rounded-lg bg-surface-2/70 px-3 py-2 text-[12.5px] text-fg-2">
                      <Server className="size-3.5 text-fg-3" />
                      {p.installations}
                    </div>
                    <ul className="mt-4 flex-1 space-y-2">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-[12.5px] text-fg-2">
                          <Check className={cn('mt-0.5 size-3.5 shrink-0', isCurrent ? 'text-accent-ink' : 'text-success')} />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-5">
                      {isCurrent ? (
                        <Button variant="secondary" disabled className="w-full" leading={<Check />}>
                          Your plan
                        </Button>
                      ) : p.id === 'enterprise' ? (
                        <Button variant="primary" className="w-full" onClick={contactSales} trailing={<ArrowRight />}>
                          Contact sales
                        </Button>
                      ) : (
                        <Button
                          variant={lower ? 'outline' : 'accent'}
                          className="w-full"
                          leading={lower ? <Minus /> : undefined}
                          onClick={() => {
                            setChangeInitial(p.id)
                            setChangeOpen(true)
                          }}
                        >
                          {lower ? `Switch to ${p.name}` : `Upgrade to ${p.name}`}
                        </Button>
                      )}
                    </div>
                  </Card>
                )
              })
            : Array.from({ length: 3 }, (_, i) => <CardSkeleton key={i} rows={7} />)}
        </div>
      </Reveal>

      {sub && plans && (
        <ChangePlanModal
          open={changeOpen}
          onClose={() => setChangeOpen(false)}
          initial={changeInitial}
          plans={plans}
          sub={sub}
          moduleNames={moduleNames}
          installCount={installs.data?.length ?? 0}
          onScheduled={(p) => setScheduled(RANK[p.id] < RANK[sub.planId] ? p : null)}
          onContactSales={contactSales}
        />
      )}

      <NewTicketModal
        open={!!ticket}
        onClose={() => setTicket(null)}
        stay
        defaults={ticket?.defaults}
        title={ticket?.title}
        description={ticket?.description}
        submitLabel={ticket?.submitLabel}
        successMessage={ticket?.success}
        icon={<Building />}
      />

      <ConfirmDialog
        open={confirmOff}
        onClose={() => setConfirmOff(false)}
        tone="danger"
        title="Turn off auto-renew?"
        description={sub ? `Your ${sub.planName} subscription will end on ${date(sub.currentPeriodEnd)} unless you renew manually.` : undefined}
        confirmLabel="Turn off auto-renew"
        loading={update.isPending}
        onConfirm={() =>
          update.mutate(
            { autoRenew: false },
            {
              onSuccess: () => {
                setConfirmOff(false)
                toast.success('Auto-renew turned off', 'We’ll remind you 14 days before your period ends.')
              },
            },
          )
        }
      >
        <ul className="space-y-2 text-[12.5px] text-fg-2">
          <li className="flex gap-2">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-fg-3" />
            Update entitlement and Priority support end with the period.
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-fg-3" />
            Installations keep running on their installed version — nothing stops; only new releases become unavailable.
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-fg-3" />
            Your data stays in your own database — nothing is deleted.
          </li>
        </ul>
      </ConfirmDialog>
    </div>
  )
}
