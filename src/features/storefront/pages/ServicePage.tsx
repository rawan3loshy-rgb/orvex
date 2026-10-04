/**
 * Service detail → order form → checkout.
 *
 * Fields, price and availability come from the storefront API (useStoreService):
 * price is resolved live by the PricingEngine for the visitor's tier, so an
 * admin price change shows up here without editing any page. Section order
 * follows the service template (detail.templateSections).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, ArrowRight, BadgeCheck, Check, ChevronRight, Clock, CreditCard, Landmark, Lock, Mail, ShieldCheck, TriangleAlert, Wallet, Zap } from 'lucide-react'
import { useInstMutation, useStoreService } from '@/hooks/installation'
import { storeService } from '@/services/installation'
import { useFieldForm, type FieldFormState } from '@/components/domain'
import { fieldType } from '@/core/fields'
import { formatMoney } from '@/core/money'
import type { FieldDef, PaymentMethodKind, ResultFieldDef, StoreServiceDetail } from '@/types/installation'
import { cn } from '@/lib/cn'
import { SfLink } from '../lib/store'
import { useDocTitle, useStore } from '../lib/storeContext'
import { isEmail, newIdempotencyKey, turnaroundLabel } from '../lib/format'
import { Accordion } from '../blocks/Blocks'
import { ResultValue } from '../components/StoreResult'
import { Btn, cardCls, Checks, Container, ErrorState, FormField, IconTile, inputCls, Notice, Pill, Price, ServiceCard, Skel, Turnaround } from '../ui'
import { NotFoundView } from './NotFoundPage'

export default function ServicePage() {
  const { slug } = useParams()
  const { to, previewToken } = useStore()
  const svc = useStoreService(slug, previewToken)
  const navigate = useNavigate()
  const location = useLocation()

  // Service links may use the id (from typed targets) — canonicalise to the slug.
  useEffect(() => {
    if (svc.data && slug !== svc.data.slug) navigate(`/site/services/${svc.data.slug}${location.search}`, { replace: true })
  }, [svc.data, slug, navigate, location.search])

  if (svc.isLoading) return <ServiceSkeleton />
  if (svc.isError) {
    const msg = svc.error?.message ?? ''
    if (/not found/i.test(msg) || (svc.error as { status?: number } | null)?.status === 404) return <NotFoundView title="Service not found" body="This service is no longer offered or the link is incorrect." />
    return (
      <Container className="py-16">
        <ErrorState title="This service could not be loaded" message={msg} onRetry={() => void svc.refetch()} />
      </Container>
    )
  }
  if (!svc.data) return null
  return <ServiceDetailView key={svc.data.id} detail={svc.data} toHref={to} />
}

function ServiceDetailView({ detail, toHref }: { detail: StoreServiceDetail; toHref: (p: string) => string }) {
  const { config } = useStore()
  const [params] = useSearchParams()
  useDocTitle(detail.name)
  // Prefill from the URL once (this view is keyed by service) — later URL changes shouldn't wipe what the customer typed.
  const [initial] = useState(() => {
    const v: Record<string, string> = {}
    for (const f of detail.fields) {
      const p = params.get(f.key)
      if (p) v[f.key] = p
    }
    return v
  })

  const sections = detail.templateSections.length ? detail.templateSections : ['form', 'description', 'result_preview', 'turnaround', 'faq', 'related']
  const formIdx = sections.indexOf('form')
  const body = sections.filter((s) => s !== 'form' && s !== 'related')
  const before = formIdx < 0 ? [] : sections.slice(0, formIdx).filter((s) => s !== 'related')
  const after = body.filter((s) => !before.includes(s))
  const cat = config.categories.find((c) => c.id === detail.categoryId)

  return (
    <>
      <div className="border-b border-line bg-bg-subtle">
        <Container className="py-7 sm:py-10">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[13.5px] text-fg-3">
            <SfLink href={toHref('/site')} className="hover:text-fg">
              Home
            </SfLink>
            <ChevronRight className="size-3.5" />
            {cat ? (
              <SfLink href={toHref(`/site/c/${cat.slug}`)} className="hover:text-fg">
                {cat.name}
              </SfLink>
            ) : (
              <span>{detail.categoryName}</span>
            )}
            <ChevronRight className="size-3.5" />
            <span className="font-medium text-fg-2" aria-current="page">
              {detail.name}
            </span>
          </nav>
          <div className="mt-5 flex items-start gap-4">
            <IconTile name={detail.icon} size="lg" className="hidden sm:grid" />
            <div className="min-w-0">
              <h1 className="sf-h text-[30px] leading-[1.1] font-semibold text-balance sm:text-[40px]">{detail.name}</h1>
              <p className="mt-3 max-w-2xl text-[16.5px] leading-relaxed text-fg-3">{detail.summary}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {detail.available ? (
                  <Pill tone="success" dot>
                    Available now
                  </Pill>
                ) : (
                  <Pill tone="warning" icon={<TriangleAlert />}>
                    Temporarily unavailable
                  </Pill>
                )}
                <Pill icon={detail.processing === 'instant' ? <Zap /> : <Clock />}>{turnaroundLabel(detail.turnaround, detail.processing)}</Pill>
                <Pill icon={<Lock />}>Price locked when you order</Pill>
              </div>
            </div>
          </div>
        </Container>
      </div>

      <Container className="py-8 sm:py-12">
        <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_420px]">
          {before.length > 0 && (
            <div className="grid gap-8 lg:col-start-1 lg:row-start-1">
              {before.map((s) => (
                <SectionView key={s} id={s} detail={detail} />
              ))}
            </div>
          )}
          <div className={cn('lg:col-start-2 lg:row-start-1', after.length && before.length && 'lg:row-span-2')}>
            <div className="lg:sticky lg:top-24">
              <OrderPanel detail={detail} initial={initial} />
            </div>
          </div>
          <div className={cn('grid content-start gap-8 lg:col-start-1', before.length ? 'lg:row-start-2' : 'lg:row-start-1')}>
            {after.map((s) => (
              <SectionView key={s} id={s} detail={detail} />
            ))}
          </div>
        </div>
      </Container>

      {sections.includes('related') && detail.related.length > 0 && (
        <div className="border-t border-line bg-bg-subtle">
          <Container className="py-10 sm:py-14">
            <h2 className="sf-h mb-6 text-[24px] font-semibold">Related services</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {detail.related.map((r) => (
                <ServiceCard key={r.id} card={r} />
              ))}
            </div>
          </Container>
        </div>
      )}
    </>
  )
}

/* ------------------------------------------------------------------------- */
/*  Template sections                                                        */
/* ------------------------------------------------------------------------- */
function Block({ title, children, icon }: { title: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <section>
      <h2 className="sf-h mb-4 flex items-center gap-2 text-[21px] font-semibold">
        {icon && <span className="text-accent-ink [&_svg]:size-5">{icon}</span>}
        {title}
      </h2>
      {children}
    </section>
  )
}

function SectionView({ id, detail }: { id: string; detail: StoreServiceDetail }) {
  switch (id) {
    case 'description':
      return <DescriptionSection detail={detail} />
    case 'result_preview':
      return <ResultPreviewSection schema={detail.resultSchema} />
    case 'turnaround':
      return <TurnaroundSection detail={detail} />
    case 'faq':
      return <FaqSection detail={detail} />
    case 'trust':
      return <TrustSection />
    default:
      return null
  }
}

function DescriptionSection({ detail }: { detail: StoreServiceDetail }) {
  const paras = (detail.description || detail.summary).split(/\n\s*\n/).filter(Boolean)
  return (
    <Block title="About this service">
      <div className="sf-prose text-[16px] leading-[1.75] text-fg-2">
        {paras.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <div className={cn(cardCls, 'mt-5 p-5')}>
        <div className="text-[14px] font-semibold text-fg">What you’ll need</div>
        <ul className="mt-3 grid gap-2.5">
          {detail.fields.map((f) => (
            <li key={f.key} className="flex gap-2.5 text-[14.5px]">
              <Check className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2.6} />
              <span>
                <span className="font-semibold text-fg">{f.label}</span>
                {!f.required && <span className="text-fg-3"> (optional)</span>}
                {f.help && <span className="text-fg-3"> — {f.help}</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Block>
  )
}

const EXAMPLES: Record<string, string | boolean> = {
  carrier: 'T-Mobile US',
  status: 'clean',
  sim_lock: 'unlocked',
  unlock_eligible: true,
  model: 'iPhone 15 Pro',
  reason: 'No reports found',
  registries: 'GSMA, US, EU',
  warranty: 'active',
  purchase_country: 'United States',
  storage: '256 GB',
  colour: 'Natural Titanium',
  manufactured: 'Week 38, 2023',
  coverage_end: '2026-11-14',
  purchase_date: '2025-11-14',
  activation_lock: 'off',
  first_activation: '2023-10-02',
  compatibility: 'full',
  lte: true,
  nr5g: true,
  volte: true,
  code: '••••••••••••••••',
  instructions: 'Insert a non-accepted SIM and enter the code when prompted.',
  attempts_remaining: '5',
  carrier_reference: 'TMO-•••••••',
}

function ResultPreviewSection({ schema }: { schema: ResultFieldDef[] }) {
  if (!schema.length) return null
  return (
    <Block title="What you’ll receive">
      <div className={cn(cardCls, 'overflow-hidden')}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <span className="text-[12.5px] font-semibold tracking-wide text-fg-3 uppercase">Example result</span>
          <span className="text-[12.5px] text-fg-3">Your result will show your device’s real data</span>
        </div>
        <dl className="divide-y divide-line">
          {schema.map((f) => (
            <div key={f.key} className="flex items-center justify-between gap-4 px-5 py-3">
              <dt className="text-[14px] text-fg-3">{f.label}</dt>
              <dd className="text-right text-[14.5px] font-semibold text-fg">
                {f.kind === 'code' ? <span className="font-mono tracking-wider text-fg-3">{String(EXAMPLES[f.key] ?? '••••••')}</span> : <ResultValue f={f} v={EXAMPLES[f.key] ?? (f.kind === 'boolean' ? true : 'Example')} />}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Block>
  )
}

function TurnaroundSection({ detail }: { detail: StoreServiceDetail }) {
  const mode = detail.processing === 'instant' ? 'Automated — results usually arrive within minutes.' : detail.processing === 'manual' ? 'Handled by our team — we will update your tracking page as soon as it is done.' : 'Processed with our network partner — progress is shown live on your tracking page.'
  return (
    <Block title="Delivery time">
      <div className={cn(cardCls, 'grid gap-4 p-5 sm:grid-cols-[auto_1fr] sm:items-center')}>
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-accent/10 text-accent-ink">{detail.processing === 'instant' ? <Zap className="size-5" /> : <Clock className="size-5" />}</span>
          <div>
            <div className="sf-h text-[20px] font-semibold">{turnaroundLabel(detail.turnaround)}</div>
            <div className="text-[13px] text-fg-3">typical delivery</div>
          </div>
        </div>
        <p className="text-[14.5px] leading-relaxed text-fg-3 sm:border-l sm:border-line sm:pl-5">{mode} You’ll get a private tracking link right after checkout — no account needed.</p>
      </div>
    </Block>
  )
}

function FaqSection({ detail }: { detail: StoreServiceDetail }) {
  const hasImei = detail.fields.some((f) => f.type === 'gsm.imei')
  const items = [
    ...(hasImei ? [{ q: 'How do I find my IMEI?', a: 'Dial *#06# on the phone, or open Settings → About (General → About on iPhone). Dual-SIM phones show two IMEIs — either one works.' }] : []),
    { q: 'What happens if you can’t deliver a result?', a: 'Your payment is only captured when the order completes. If we can’t complete it, the funds are released automatically — you are never charged for a failed order.' },
    { q: 'Is my input checked before I pay?', a: 'Yes. Every field is validated instantly (for IMEIs: 15 digits and the Luhn check digit), so a typo never costs you money.' },
    { q: 'Do I need an account?', a: 'No. Guest checkout gives you a private tracking link. Signed-in customers also get a wallet and order history.' },
  ]
  return (
    <Block title="Questions">
      <Accordion items={items} />
    </Block>
  )
}

function TrustSection() {
  const items = [
    { icon: <BadgeCheck />, title: 'Carrier-authorised', body: 'Only legitimate checks and official unlocks for eligible devices.' },
    { icon: <ShieldCheck />, title: 'Validated before payment', body: 'We check your input before anything is charged.' },
    { icon: <Wallet />, title: 'Funds released if not delivered', body: 'No result, no charge — automatically.' },
    { icon: <Lock />, title: 'Private tracking', body: 'Results are only visible through your private link.' },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((t) => (
        <div key={t.title} className={cn(cardCls, 'flex gap-3 p-4')}>
          <span className="mt-0.5 text-accent-ink [&_svg]:size-5">{t.icon}</span>
          <div>
            <div className="text-[14.5px] font-semibold text-fg">{t.title}</div>
            <div className="mt-0.5 text-[13.5px] text-fg-3">{t.body}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/*  Order panel: details → checkout                                          */
/* ------------------------------------------------------------------------- */
function OrderPanel({ detail, initial }: { detail: StoreServiceDetail; initial: Record<string, string> }) {
  const form = useFieldForm(detail.fields, initial)
  const [step, setStep] = useState<'details' | 'checkout'>('details')

  return (
    <div className={cn(cardCls, 'overflow-hidden')} id="order">
      <div className="flex items-end justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
        <div>
          <div className="text-[13px] font-medium text-fg-3">{detail.tierName && detail.tierName !== 'Retail' ? `Your ${detail.tierName} price` : 'Price'}</div>
          <Price value={detail.price} unavailable={!detail.available} className="text-[34px] leading-none" />
        </div>
        <Turnaround card={detail} className="pb-1" />
      </div>

      {!detail.available ? (
        <div className="grid gap-4 p-5 sm:p-6">
          <Notice tone="warning" icon={<TriangleAlert />} title="Temporarily unavailable">
            This service can’t be ordered right now. We’re working to restore it — please check back soon or choose a related service below.
          </Notice>
          <Btn variant="secondary" full disabled>
            Temporarily unavailable
          </Btn>
        </div>
      ) : step === 'details' ? (
        <DetailsStep detail={detail} form={form} onContinue={() => setStep('checkout')} />
      ) : (
        <CheckoutStep detail={detail} form={form} onBack={() => setStep('details')} />
      )}

      <div className="flex items-center justify-center gap-2 border-t border-line bg-bg-subtle px-5 py-3 text-[12.5px] text-fg-3">
        <ShieldCheck className="size-3.5 text-accent-ink" />
        Validated before you pay · funds released if we can’t deliver
      </div>
    </div>
  )
}

function StoreFieldInput({ field, form }: { field: FieldDef; form: FieldFormState }) {
  const t = fieldType(field.type)
  const id = `sf_${field.key}`
  const err = form.errorOf(field.key)
  const value = form.values[field.key] ?? ''
  const options = field.options ?? []
  const mono = field.type === 'gsm.imei' || field.type === 'gsm.serial'
  return (
    <FormField label={field.label} htmlFor={id} hint={field.help} error={err} optional={!field.required}>
      {t.inputMode === 'select' || options.length ? (
        <select id={id} value={value} onChange={(e) => form.set(field.key, e.target.value)} onBlur={() => form.touch(field.key)} aria-invalid={!!err} aria-describedby={err ? `${id}-err` : undefined} className={cn(inputCls, 'appearance-auto')}>
          <option value="">Select {field.label.toLowerCase()}…</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          value={value}
          onChange={(e) => form.set(field.key, e.target.value)}
          onBlur={() => form.touch(field.key)}
          inputMode={t.inputMode === 'numeric' ? 'numeric' : t.inputMode === 'email' ? 'email' : t.inputMode === 'tel' ? 'tel' : 'text'}
          autoComplete="off"
          placeholder={field.placeholder ?? t.example}
          aria-invalid={!!err}
          aria-describedby={err ? `${id}-err` : undefined}
          className={cn(inputCls, mono && 'font-mono tracking-wider')}
        />
      )}
      {value && <Checks checks={form.checksOf(field.key)} />}
    </FormField>
  )
}

function DetailsStep({ detail, form, onContinue }: { detail: StoreServiceDetail; form: FieldFormState; onContinue: () => void }) {
  const imei = detail.fields.find((f) => f.type === 'gsm.imei')
  return (
    <form
      className="grid gap-5 p-5 sm:p-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (form.submit()) onContinue()
      }}
    >
      <div className="text-[15px] font-semibold text-fg">1 · Device details</div>
      {detail.fields.map((f) => (
        <StoreFieldInput key={f.key} field={f} form={form} />
      ))}
      {imei && !form.values[imei.key] && (
        <button type="button" onClick={() => form.set(imei.key, '356938035643809')} className="-mt-2 justify-self-start text-[12.5px] font-semibold text-fg-3 underline decoration-dotted underline-offset-4 hover:text-fg">
          Demo: use IMEI 356938035643809
        </button>
      )}
      <Btn type="submit" size="lg" full trailing={<ArrowRight />}>
        Continue to checkout
      </Btn>
    </form>
  )
}

const METHOD_ICON: Record<string, ReactNode> = { card: <CreditCard />, paypal: <span className="text-[13px] font-black italic">P</span>, bank_transfer: <Landmark />, manual: <Landmark /> }

function CheckoutStep({ detail, form, onBack }: { detail: StoreServiceDetail; form: FieldFormState; onBack: () => void }) {
  const { config, to, preview } = useStore()
  const navigate = useNavigate()
  const customer = config.customer
  const methods = config.paymentMethods
  const canWallet = !!customer && customer.balance.spendable >= detail.price
  const [method, setMethod] = useState<PaymentMethodKind | 'wallet' | ''>(customer && canWallet ? 'wallet' : (methods[0]?.id ?? ''))
  const [email, setEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const guestAllowed = config.checkout.guestCheckout
  const emailErr = !customer && emailTouched && !isEmail(email) ? 'Enter a valid email — we send your private tracking link there' : undefined
  const terms = config.checkout.termsPageId ? config.pages.find((p) => p.id === config.checkout.termsPageId) : undefined

  // One idempotency key per checkout payload: double-clicks and retries of the same order never create two orders.
  const attempt = useRef<{ payload: string; key: string } | null>(null)

  const checkout = useInstMutation(storeService.checkout, {
    onSuccess: (res) => {
      if (res.method === 'wallet') navigate(to(`/site/track/${res.trackingToken}?new=1`))
      else navigate(to(`/site/pay/${res.trackingToken}`), { state: res })
    },
  })

  const submit = () => {
    setEmailTouched(true)
    if (!customer && (!guestAllowed || !isEmail(email))) return
    if (!method || preview) return
    const body = { serviceId: detail.id, input: form.normalized, email: customer ? undefined : email.trim().toLowerCase(), method }
    const payload = JSON.stringify([body, customer?.id ?? null])
    if (attempt.current?.payload !== payload) attempt.current = { payload, key: newIdempotencyKey() }
    checkout.mutate({ ...body, idempotencyKey: attempt.current.key })
  }

  return (
    <div className="grid gap-5 p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="text-[15px] font-semibold text-fg">2 · Checkout</div>
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-accent-ink hover:underline">
          <ArrowLeft className="size-3.5" /> Edit details
        </button>
      </div>

      <div className="rounded-[var(--sf-r)] border border-line bg-surface-2 p-3.5">
        <div className="text-[14px] font-semibold text-fg">{detail.name}</div>
        <dl className="mt-1.5 grid gap-1">
          {detail.fields
            .filter((f) => form.normalized[f.key])
            .map((f) => (
              <div key={f.key} className="flex justify-between gap-3 text-[13.5px]">
                <dt className="text-fg-3">{f.label}</dt>
                <dd className={cn('truncate font-medium text-fg', (f.type === 'gsm.imei' || f.type === 'gsm.serial') && 'font-mono')}>{f.options?.find((o) => o.value === form.normalized[f.key])?.label ?? form.normalized[f.key]}</dd>
              </div>
            ))}
        </dl>
      </div>

      {customer ? (
        <div className="flex items-center gap-3 rounded-[var(--sf-r)] border border-line p-3.5">
          <span className="grid size-9 place-items-center rounded-full bg-accent text-[14px] font-bold text-accent-fg">{customer.name.slice(0, 1)}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold">{customer.name}</div>
            <div className="truncate text-[12.5px] text-fg-3">
              {customer.email} · {customer.tierName}
            </div>
          </div>
        </div>
      ) : guestAllowed ? (
        <FormField label="Email for your receipt & tracking link" htmlFor="sf_email" error={emailErr}>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-fg-3" />
            <input id="sf_email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setEmailTouched(true)} placeholder="you@example.com" aria-invalid={!!emailErr} aria-describedby={emailErr ? 'sf_email-err' : undefined} className={cn(inputCls, 'pl-10')} />
          </div>
          <p className="text-[12.5px] text-fg-3">
            Guest checkout — or{' '}
            <SfLink href={to('/site/account')} className="font-semibold text-accent-ink hover:underline">
              sign in
            </SfLink>{' '}
            to pay from your wallet.
          </p>
        </FormField>
      ) : (
        <Notice tone="brand" icon={<Lock />} title="Sign in to order">
          This store requires an account.{' '}
          <SfLink href={to('/site/account')} className="font-semibold text-accent-ink underline">
            Sign in or continue
          </SfLink>
        </Notice>
      )}

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-[14px] font-semibold text-fg">Payment method</legend>
        {customer && (
          <MethodOption checked={method === 'wallet'} disabled={!canWallet} onSelect={() => setMethod('wallet')} icon={<Wallet />} title="Wallet balance" sub={canWallet ? `${formatMoney(customer.balance.available)} available` : `Insufficient balance (${formatMoney(customer.balance.available)})`} />
        )}
        {methods.map((m) => (
          <MethodOption key={m.id} checked={method === m.id} onSelect={() => setMethod(m.id)} icon={METHOD_ICON[m.id] ?? <CreditCard />} title={m.name} sub={`${m.gateway} · simulated`} />
        ))}
        {!methods.length && !customer && <Notice tone="warning">No payment methods are enabled for this store.</Notice>}
      </fieldset>

      <div className="flex items-center justify-between border-t border-line pt-4">
        <span className="text-[15px] font-semibold text-fg">Total</span>
        <Price value={detail.price} className="text-[24px]" />
      </div>

      {checkout.error && (
        <Notice tone="danger" icon={<TriangleAlert />} title="Order not placed">
          {checkout.error.message}
        </Notice>
      )}

      {preview && (
        <Notice tone="warning" icon={<Lock />} title="Checkout is disabled in preview">
          You are previewing an unpublished draft. Orders are real operations, so they can only be placed on the published site.
        </Notice>
      )}

      <Btn size="lg" full loading={checkout.isPending} disabled={preview || !method || (!customer && !guestAllowed)} onClick={submit} leading={<Lock />}>
        {method === 'wallet' ? `Pay ${formatMoney(detail.price)} from wallet` : `Place order · ${formatMoney(detail.price)}`}
      </Btn>
      <p className="-mt-2 text-center text-[12px] leading-relaxed text-fg-3">
        Demo store — no real payment is taken.
        {terms && (
          <>
            {' '}
            By ordering you agree to the{' '}
            <SfLink href={to(`/site/${terms.slug}`)} className="underline underline-offset-2 hover:text-fg">
              {terms.title.toLowerCase()}
            </SfLink>
            .
          </>
        )}
      </p>
    </div>
  )
}

function MethodOption({ checked, onSelect, icon, title, sub, disabled }: { checked: boolean; onSelect: () => void; icon: ReactNode; title: string; sub: string; disabled?: boolean }) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-3 rounded-[var(--sf-r)] border p-3.5 transition-colors', checked ? 'border-accent bg-accent/[0.05] shadow-[0_0_0_1px_var(--accent)]' : 'border-line hover:border-line-strong', disabled && 'cursor-not-allowed opacity-55')}>
      <input type="radio" name="sf-method" className="size-4 accent-[var(--accent)]" checked={checked} disabled={disabled} onChange={onSelect} />
      <span className="grid size-9 place-items-center rounded-[var(--sf-r-sm)] bg-surface-2 text-fg-2 [&_svg]:size-[18px]">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold text-fg">{title}</span>
        <span className="block truncate text-[12.5px] text-fg-3">{sub}</span>
      </span>
    </label>
  )
}

function ServiceSkeleton() {
  return (
    <>
      <div className="border-b border-line bg-bg-subtle">
        <Container className="py-10">
          <Skel className="h-4 w-56" />
          <Skel className="mt-6 h-10 w-full max-w-xl" />
          <Skel className="mt-3 h-5 w-full max-w-2xl" />
        </Container>
      </div>
      <Container className="grid gap-10 py-10 lg:grid-cols-[1fr_420px]">
        <div className="grid content-start gap-4">
          <Skel className="h-6 w-48" />
          <Skel className="h-40 w-full" />
          <Skel className="h-28 w-full" />
        </div>
        <Skel className="h-[420px] w-full" />
      </Container>
    </>
  )
}
