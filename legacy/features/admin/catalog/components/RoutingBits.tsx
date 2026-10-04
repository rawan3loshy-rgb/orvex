/**
 * Routing visuals shared by the Routing page and the service detail:
 * strategy picker, chain previews, animated simulation result, simulator form.
 */
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { ArrowRight, Ban, Check, ChevronRight, CircleCheck, FlaskConical, Hand, Inbox, Play, Sparkles } from 'lucide-react'
import { ProviderMark, ServiceIcon, categoryColor } from '@/components/brand'
import { Badge, Button, Card, CardHeader, Field, Input, Select, Skeleton, Tooltip } from '@/components/ui'
import { useInstMutation, useServices } from '@/hooks/installation'
import { routingService } from '@/services/installation'
import { cn } from '@/lib/cn'
import { money, num, time } from '@/lib/format'
import type { Provider, RoutingSimulation, RoutingStrategy, Service, ServiceMapping } from '@/types/installation'
import { exampleInput } from './examples'
import { COUNTRIES, ROLE_META, STRATEGIES, STRATEGY_ORDER, deliveryLabel, effectiveChain, useProviderMap, type ChainRole } from './shared'

/* ------------------------------------------------------------------------- */
/*  Connectors                                                               */
/* ------------------------------------------------------------------------- */

/** Animated connector: vertical on small screens, horizontal from `lg`. */
export function FlowConnector({ color = 'var(--accent)', delay = 0, dim, className, breakpoint = 'lg' }: { color?: string; delay?: number; dim?: boolean; className?: string; breakpoint?: 'md' | 'lg' | 'xl' }) {
  const bp = { md: ['md:hidden', 'md:flex', 'md:w-10 md:h-auto'], lg: ['lg:hidden', 'lg:flex', 'lg:w-10 lg:h-auto'], xl: ['xl:hidden', 'xl:flex', 'xl:w-10 xl:h-auto'] }[breakpoint]
  return (
    <div className={cn('relative flex h-7 shrink-0 items-center justify-center', bp[2], className)} aria-hidden>
      <div className={cn('relative h-full w-px', bp[0])} style={{ background: `color-mix(in oklab, ${color} ${dim ? 18 : 35}%, var(--line))` }}>
        {!dim && (
          <motion.span
            className="absolute left-1/2 size-1.5 -translate-x-1/2 rounded-full"
            style={{ background: color, boxShadow: `0 0 0 3px color-mix(in oklab, ${color} 16%, transparent)` }}
            initial={{ top: '-10%', opacity: 0 }}
            animate={{ top: ['-10%', '105%'], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.3, repeat: Infinity, ease: 'linear', delay }}
          />
        )}
      </div>
      <div className={cn('relative hidden h-px w-full items-center', bp[1])} style={{ background: `color-mix(in oklab, ${color} ${dim ? 18 : 35}%, var(--line))` }}>
        {!dim && (
          <motion.span
            className="absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full"
            style={{ background: color, boxShadow: `0 0 0 3px color-mix(in oklab, ${color} 16%, transparent)` }}
            initial={{ left: '-5%', opacity: 0 }}
            animate={{ left: ['-5%', '100%'], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.3, repeat: Infinity, ease: 'linear', delay }}
          />
        )}
        <ChevronRight className="absolute -right-1.5 size-3.5" style={{ color: `color-mix(in oklab, ${color} 60%, var(--fg-3))` }} />
      </div>
    </div>
  )
}

/** Compact "P1 → P2 → P3" chain of supplier marks. */
export function ChainPreview({ chain, providers, className, max = 3 }: { chain: ServiceMapping[]; providers: Map<string, Provider>; className?: string; max?: number }) {
  if (!chain.length) return <span className={cn('text-[12px] text-danger', className)}>No eligible supplier</span>
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {chain.slice(0, max).map((m, i) => (
        <Fragment key={m.id}>
          {i > 0 && <ArrowRight className="size-3 text-fg-3" />}
          <Tooltip content={`${providers.get(m.providerId)?.shortName ?? m.providerId} #${m.externalId} · ${money(m.cost)}`}>
            <ProviderMark id={m.providerId} size="xs" />
          </Tooltip>
        </Fragment>
      ))}
    </span>
  )
}

/* ------------------------------------------------------------------------- */
/*  Strategy cards                                                           */
/* ------------------------------------------------------------------------- */

export function StrategyCards({
  value,
  onChange,
  counts,
  preview,
  disabled,
  className,
}: {
  value?: RoutingStrategy
  onChange?: (s: RoutingStrategy) => void
  counts?: Partial<Record<RoutingStrategy, number>>
  preview?: (s: RoutingStrategy) => ReactNode
  disabled?: boolean
  className?: string
}) {
  return (
    <div role="radiogroup" className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-3', className)}>
      {STRATEGY_ORDER.map((s) => {
        const S = STRATEGIES[s]
        const active = value === s
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled || !onChange}
            onClick={() => onChange?.(s)}
            className={cn(
              'group relative flex flex-col rounded-xl border bg-surface p-4 text-left shadow-card transition-[border-color,box-shadow,background-color] duration-200 disabled:cursor-default',
              active ? 'border-accent/50 bg-accent/[0.035] ring-3 ring-accent/10' : 'border-line hover:border-line-strong hover:bg-surface-2/40',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-9 place-items-center rounded-lg" style={{ color: S.color, background: `color-mix(in oklab, ${S.color} 12%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${S.color} 24%, transparent)` }}>
                <S.icon className="size-4" />
              </span>
              {active ? (
                <span className="grid size-5 place-items-center rounded-full bg-accent text-accent-fg">
                  <Check className="size-3" />
                </span>
              ) : counts?.[s] != null ? (
                <span className="text-[11.5px] text-fg-3 tabular">{num(counts[s]!)} services</span>
              ) : null}
            </div>
            <div className="mt-3 text-[13.5px] font-semibold tracking-[-0.01em] text-fg">{S.label}</div>
            <div className="text-[12px] font-medium text-fg-3">{S.tagline}</div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-fg-2">{S.description}</p>
            {preview && <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-[11.5px] text-fg-3">{preview(s)}</div>}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/*  Simulation result                                                        */
/* ------------------------------------------------------------------------- */

export function RouteChainView({ sim, service, providers, context, runKey }: { sim: RoutingSimulation; service?: Service; providers: Map<string, Provider>; context?: { country?: string; amount?: number; override?: boolean }; runKey?: string | number }) {
  const eligible = sim.chain.filter((c) => c.eligible)
  const ineligible = sim.chain.filter((c) => !c.eligible)
  const held = sim.appliedRules.some((r) => /held for manual review/i.test(r.effect))
  return (
    <div key={runKey} className="space-y-5">
      <div className="flex flex-col xl:flex-row xl:items-stretch">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="rounded-xl border border-line bg-surface-2/60 p-3.5 xl:w-[200px] xl:shrink-0">
          <div className="mono-label flex items-center gap-1.5">
            <Inbox className="size-3" /> Incoming order
          </div>
          {service && (
            <div className="mt-2.5 flex items-center gap-2.5">
              <ServiceIcon icon={service.icon} category={service.category} size="sm" />
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">{service.name}</div>
                <div className="font-mono text-[11px] text-fg-3">{service.id}</div>
              </div>
            </div>
          )}
          {service && service.fields.length > 0 && (
            <dl className="mt-2.5 space-y-0.5 border-t border-line pt-2 font-mono text-[11px]">
              {Object.entries(exampleInput(service))
                .slice(0, 2)
                .map(([k, v]) => (
                  <div key={k} className="flex min-w-0 gap-1.5">
                    <dt className="shrink-0 text-fg-3">{k}</dt>
                    <dd className="truncate text-fg-2">{v}</dd>
                  </div>
                ))}
            </dl>
          )}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Badge>{context?.country ? `${context.country} · ${COUNTRIES.find((c) => c.code === context.country)?.region ?? ''}` : 'Any country'}</Badge>
            {context?.amount != null && <Badge>{money(context.amount)}</Badge>}
            <Badge variant={context?.override ? 'outline' : 'soft'}>{context?.override ? 'Override · ' : ''}{STRATEGIES[sim.strategy].label}</Badge>
          </div>
        </motion.div>
        {held ? (
          <>
            <FlowConnector breakpoint="xl" color="var(--warning)" />
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex flex-1 items-center gap-3 rounded-xl border border-warning/30 bg-warning/[0.06] p-4">
              <Hand className="size-5 shrink-0 text-warning" />
              <div>
                <div className="text-[13px] font-semibold text-fg">Held for manual review</div>
                <div className="text-[12.5px] text-fg-2">A hold rule matched. The order is parked in the review queue — nothing is sent to a supplier until an operator approves it; then it follows the chain below.</div>
              </div>
            </motion.div>
          </>
        ) : null}
        {!held &&
          (eligible.length ? (
            eligible.map((c, i) => (
              <Fragment key={`${c.providerId}-${i}`}>
                <FlowConnector breakpoint="xl" color={ROLE_META[c.role as ChainRole].color} delay={i * 0.25} />
                <ChainNode role={c.role as ChainRole} provider={providers.get(c.providerId)} cost={c.cost} reason={c.reason} index={i} price={service?.price} />
              </Fragment>
            ))
          ) : (
            <>
              <FlowConnector breakpoint="xl" color="var(--danger)" dim />
              <div className="flex flex-1 items-center gap-3 rounded-xl border border-danger/30 bg-danger/[0.05] p-4">
                <Ban className="size-5 shrink-0 text-danger" />
                <div>
                  <div className="text-[13px] font-semibold">No eligible supplier</div>
                  <div className="text-[12.5px] text-fg-2">
                    The order would fail with <code className="font-mono text-[12px]">no_route</code> and the customer would not be charged.
                  </div>
                </div>
              </div>
            </>
          ))}
      </div>
      {held && eligible.length > 0 && (
        <div className="flex flex-col xl:flex-row xl:items-stretch">
          {eligible.map((c, i) => (
            <Fragment key={`${c.providerId}-h${i}`}>
              {i > 0 && <FlowConnector breakpoint="xl" color={ROLE_META[c.role as ChainRole].color} dim />}
              <ChainNode role={c.role as ChainRole} provider={providers.get(c.providerId)} cost={c.cost} reason={c.reason} index={i} price={service?.price} muted />
            </Fragment>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-line">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-[12.5px] font-semibold">Applied rules</span>
            <span className="text-[11.5px] text-fg-3 tabular">{sim.appliedRules.length} matched</span>
          </div>
          {sim.appliedRules.length ? (
            <ul className="divide-y divide-line">
              {sim.appliedRules.map((r, i) => (
                <motion.li key={r.ruleId + i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.08 }} className="flex items-start gap-3 px-4 py-2.5">
                  <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent-ink" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[12.5px] font-medium text-fg">{r.name}</span>
                      <span className="font-mono text-[10.5px] text-fg-3">{r.ruleId}</span>
                    </div>
                    <div className="text-[12px] text-fg-2">{r.effect}</div>
                  </div>
                </motion.li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-5 text-[12.5px] text-fg-3">No rules matched this order — the strategy alone decides the chain.</p>
          )}
        </div>
        <div className="rounded-xl border border-line">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-[12.5px] font-semibold">Not in chain</span>
            <span className="text-[11.5px] text-fg-3 tabular">{ineligible.length} supplier{ineligible.length === 1 ? '' : 's'}</span>
          </div>
          {ineligible.length ? (
            <ul className="divide-y divide-line">
              {ineligible.map((c, i) => {
                const p = providers.get(c.providerId)
                return (
                  <li key={c.providerId + i} className="flex items-center gap-3 px-4 py-2.5">
                    <ProviderMark id={c.providerId} size="sm" className="opacity-60 grayscale" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-medium text-fg-2">{p?.name ?? c.providerId}</div>
                      <div className="truncate text-[12px] text-fg-3">{c.reason}</div>
                    </div>
                    <span className="text-[12px] text-fg-3 tabular">{money(c.cost)}</span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="flex items-center gap-2 px-4 py-5 text-[12.5px] text-fg-3">
              <CircleCheck className="size-4 text-success" /> Every mapped supplier is eligible.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function ChainNode({ role, provider, cost, reason, index, price, muted }: { role: ChainRole; provider?: Provider; cost: number; reason: string; index: number; price?: number; muted?: boolean }) {
  const meta = ROLE_META[role]
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: muted ? 0.6 : 1, y: 0, scale: 1 }}
      transition={{ delay: 0.15 + index * 0.22, type: 'spring', stiffness: 380, damping: 30 }}
      className={cn('relative min-w-0 flex-1 overflow-hidden rounded-xl border bg-surface p-3.5 shadow-card', role === 'primary' && !muted ? 'border-accent/40' : 'border-line')}
    >
      <span className="absolute inset-x-0 top-0 h-[2px]" style={{ background: meta.color, opacity: role === 'primary' ? 1 : 0.6 }} />
      <div className="flex items-center justify-between gap-2">
        <span className="mono-label" style={{ color: meta.ink }}>
          {meta.label}
        </span>
        <span className="text-[11px] text-fg-3">Attempt {index + 1}</span>
      </div>
      <div className="mt-2.5 flex items-center gap-2.5">
        {provider && <ProviderMark id={provider.id} name={provider.name} size="sm" />}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold">{provider?.name ?? '—'}</div>
          <div className="text-[11.5px] text-fg-3 tabular">
            {money(cost)} supplier cost{price != null ? ` · ${money(price - cost)} margin` : ''}
          </div>
        </div>
        {provider && provider.status !== 'operational' && <Badge tone="warning" dot>{provider.status}</Badge>}
      </div>
      <p className="mt-2 line-clamp-2 text-[12px] leading-snug text-fg-2">{reason}</p>
    </motion.div>
  )
}

/* ------------------------------------------------------------------------- */
/*  Simulator                                                                */
/* ------------------------------------------------------------------------- */

/** Ready-made GSM order contexts — each one exercises a different seeded routing rule. */
const SCENARIOS: { id: string; label: string; hint: string; serviceId: string; country: string; amount?: string }[] = [
  { id: 'eu-unlock', label: 'EU unlock · Orange FR', hint: 'EU unlocks prefer Global Unlock; degraded suppliers are skipped', serviceId: 'SVC-1011', country: 'FR' },
  { id: 'us-iphone', label: 'iPhone unlock · AT&T US', hint: 'High-value unlock orders are held for review', serviceId: 'SVC-1007', country: 'US' },
  { id: 'apac-code', label: 'NCK code · Singapore', hint: 'APAC codes prefer GSM Solutions — only while it is healthy', serviceId: 'SVC-1018', country: 'SG' },
  { id: 'imei-check', label: 'Instant IMEI check', hint: 'Tight 8s timeout for instant IMEI checks', serviceId: 'SVC-1001', country: '' },
  { id: 'frp', label: 'Samsung FRP · Germany', hint: 'Server service, fastest strategy', serviceId: 'SVC-1012', country: 'DE' },
]

/** Country quick-picks shown when the simulator is locked to one service. */
const QUICK_COUNTRIES = ['FR', 'GB', 'US', 'SG', 'AE']

export function RoutingSimulator({ defaultServiceId = 'SVC-1011', lockService, className, title = 'Routing simulator', description }: { defaultServiceId?: string; lockService?: boolean; className?: string; title?: ReactNode; description?: ReactNode }) {
  const services = useServices()
  const { map: providers } = useProviderMap()
  const [serviceId, setServiceId] = useState(defaultServiceId)
  const [country, setCountry] = useState(lockService ? '' : 'FR')
  const [amount, setAmount] = useState('')
  const [strategy, setStrategy] = useState<RoutingStrategy | ''>('')
  const [scenario, setScenario] = useState<string | null>(lockService ? null : 'eu-unlock')
  const [result, setResult] = useState<{ sim: RoutingSimulation; at: number; country?: string; amount?: number; override: boolean } | null>(null)
  const service = services.data?.find((s) => s.id === serviceId)
  // When a scenario switches service, the amount it wants survives the "service changed" reset below.
  const pending = useRef<{ serviceId: string; amount: string } | null>(null)

  const sim = useInstMutation((body: { serviceId: string; country?: string; amount?: number; strategy?: RoutingStrategy }) => routingService.simulate(body))

  const run = (o: { sid?: string; amt?: string; ctry?: string; strat?: RoutingStrategy | '' } = {}) => {
    const sid = o.sid ?? serviceId
    const amt = o.amt ?? amount
    const ctry = o.ctry ?? country
    const strat = o.strat ?? strategy
    const a = amt === '' ? undefined : Number(amt)
    sim.mutate(
      { serviceId: sid, country: ctry || undefined, amount: a, strategy: strat || undefined },
      { onSuccess: (r) => setResult({ sim: r, at: Date.now(), country: ctry || undefined, amount: a, override: !!strat }) },
    )
  }

  useEffect(() => {
    if (lockService) setServiceId(defaultServiceId)
  }, [defaultServiceId, lockService])

  // Run once the service is known (and whenever it changes).
  const svcPrice = service?.price
  useEffect(() => {
    if (svcPrice == null) return
    const a = pending.current?.serviceId === serviceId ? pending.current.amount : String(svcPrice)
    pending.current = null
    setAmount(a)
    run({ sid: serviceId, amt: a })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, svcPrice != null])

  const applyScenario = (id: string) => {
    const sc = SCENARIOS.find((x) => x.id === id)
    const svc = services.data?.find((x) => x.id === sc?.serviceId)
    if (!sc || !svc) return
    const amt = sc.amount ?? String(svc.price)
    setScenario(id)
    setCountry(sc.country)
    setStrategy('')
    if (sc.serviceId === serviceId) {
      setAmount(amt)
      run({ sid: sc.serviceId, amt, ctry: sc.country, strat: '' })
    } else {
      pending.current = { serviceId: sc.serviceId, amount: amt }
      setServiceId(sc.serviceId)
    }
  }

  const quickCountry = (code: string) => {
    setCountry(code)
    setScenario(null)
    run({ ctry: code })
  }

  const options = useMemo(() => (services.data ?? []).map((s) => ({ value: s.id, label: `${s.name} · ${s.id}` })), [services.data])
  const countryOptions = useMemo(() => [{ value: '', label: 'Any country' }, ...COUNTRIES.map((c) => ({ value: c.code, label: `${c.code} · ${c.name} — ${c.region}` }))], [])
  const available = SCENARIOS.filter((sc) => services.data?.some((s) => s.id === sc.serviceId))

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader
        icon={<FlaskConical />}
        title={title}
        description={description ?? 'Dry-run the routing engine with a hypothetical order. Nothing is submitted to suppliers and no balance is charged.'}
        actions={result && <span className="hidden font-mono text-[11px] text-fg-3 sm:inline">Ran {time(result.at, true)}</span>}
      />
      <div className="border-y border-line bg-surface-2/40 px-5 py-4">
        {!lockService && available.length > 0 && (
          <div className="mb-4">
            <div className="mono-label mb-2">Scenarios</div>
            <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0">
              {available.map((sc) => {
                const svc = services.data?.find((s) => s.id === sc.serviceId)
                const on = scenario === sc.id
                return (
                  <Tooltip key={sc.id} content={sc.hint}>
                    <button
                      type="button"
                      onClick={() => applyScenario(sc.id)}
                      className={cn(
                        'flex h-8 shrink-0 items-center gap-2 rounded-full border px-3 text-[12.5px] whitespace-nowrap transition-colors',
                        on ? 'border-accent/50 bg-accent/[0.06] text-fg' : 'border-line bg-surface text-fg-2 hover:border-line-strong hover:text-fg',
                      )}
                    >
                      <span className="size-1.5 rounded-full" style={{ background: svc ? categoryColor(svc.category) : 'var(--fg-3)' }} />
                      {sc.label}
                    </button>
                  </Tooltip>
                )
              })}
            </div>
          </div>
        )}
        <form
          className={cn('grid items-end gap-3 sm:grid-cols-2', lockService ? 'lg:grid-cols-[1fr_1fr_1fr_auto]' : 'lg:grid-cols-[1.4fr_1fr_0.8fr_1fr_auto]')}
          onSubmit={(e) => {
            e.preventDefault()
            setScenario(null)
            run()
          }}
        >
          {!lockService && (
            <Field label="Service">
              <Select
                value={serviceId}
                onChange={(e) => {
                  setScenario(null)
                  setServiceId(e.target.value)
                }}
                options={options}
              />
            </Field>
          )}
          <Field label="Carrier / order country">
            <Select
              value={country}
              onChange={(e) => {
                setScenario(null)
                setCountry(e.target.value)
              }}
              options={countryOptions}
            />
          </Field>
          <Field label="Order amount">
            <Input leading={<span className="text-[13px]">$</span>} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="tabular" />
          </Field>
          <Field label="Strategy">
            <Select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as RoutingStrategy | '')}
              options={[{ value: '', label: `Service default${service ? ` (${STRATEGIES[service.routingStrategy].label})` : ''}` }, ...STRATEGY_ORDER.map((s) => ({ value: s, label: `Override · ${STRATEGIES[s].label}` }))]}
            />
          </Field>
          <Button type="submit" variant="accent" leading={<Play />} loading={sim.isPending} className="sm:col-span-2 lg:col-span-1">
            Simulate
          </Button>
        </form>
        {!lockService && service && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-fg-3">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full" style={{ background: categoryColor(service.category) }} />
              {service.category}
            </span>
            <span>{deliveryLabel(service)}</span>
            <span>
              List price <span className="text-fg-2 tabular">{money(service.price)}</span>
            </span>
            <span>
              {service.providersCount} supplier{service.providersCount === 1 ? '' : 's'} mapped
            </span>
          </div>
        )}
        {lockService && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px] text-fg-3">
            <span className="mr-0.5">Try</span>
            {QUICK_COUNTRIES.map((code) => {
              const c = COUNTRIES.find((x) => x.code === code)!
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => quickCountry(code)}
                  className={cn('h-6 rounded-full border px-2 font-mono text-[11px] transition-colors', country === code ? 'border-accent/50 bg-accent/[0.06] text-fg' : 'border-line bg-surface text-fg-2 hover:border-line-strong')}
                >
                  {code} · {c.region}
                </button>
              )
            })}
            {service && service.category === 'Unlocking' && (
              <button
                type="button"
                onClick={() => {
                  setAmount('25')
                  run({ amt: '25' })
                }}
                className="h-6 rounded-full border border-line bg-surface px-2 text-[11px] text-fg-2 transition-colors hover:border-line-strong"
              >
                High-value · $25
              </button>
            )}
          </div>
        )}
      </div>
      <div className="p-5">
        {result ? (
          <RouteChainView sim={result.sim} service={services.data?.find((s) => s.id === result.sim.serviceId)} providers={providers} context={{ country: result.country, amount: result.amount, override: result.override }} runKey={result.at} />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[108px] flex-1 rounded-xl" />
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
          </div>
        )}
        {result && service && (
          <p className="mt-4 text-[12px] text-fg-3">
            Simulated against live supplier health. <Link to={`/admin/services/${service.id}?tab=mappings`} className="text-accent-ink hover:underline">Edit {service.name} mappings</Link> or{' '}
            <Link to="/admin/routing" className="text-accent-ink hover:underline">
              manage routing rules
            </Link>
            .
          </p>
        )}
      </div>
    </Card>
  )
}

/** Effective chain per strategy for previews on strategy cards. */
export function useStrategyPreview(mappings: ServiceMapping[] | undefined, providers: Map<string, Provider>) {
  return (s: RoutingStrategy) => {
    const chain = effectiveChain(mappings ?? [], s, providers)
    return (
      <>
        <span>Resulting chain</span>
        <ChainPreview chain={chain} providers={providers} />
      </>
    )
  }
}
