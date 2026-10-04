/**
 * Simulated payment step. Nothing is processed: the "Demo Card Gateway" /
 * "Demo PayPal" outcome is chosen by the visitor and sent to
 * storeService.completePayment. A failed payment can be retried with a new
 * payment intent (storeService.retryPayment).
 */
import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { ArrowRight, CircleX, CreditCard, Landmark, Lock, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useInstMutation, useStoreTracking } from '@/hooks/installation'
import { storeService } from '@/services/installation'
import { formatMoney, type Micros } from '@/core/money'
import type { PaymentMethodKind, StoreCheckoutResult } from '@/types/installation'
import { cn } from '@/lib/cn'
import { SfLink } from '../lib/store'
import { useDocTitle, useStore } from '../lib/storeContext'
import { Btn, cardCls, Container, ErrorState, FormField, inputCls, Notice, Pill, Price, Skel } from '../ui'
import { NotFoundView } from './NotFoundPage'

interface Intent {
  id: string
  ref: string
  amount: Micros
  method: string
}

export default function PayPage() {
  const { token = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { config, to } = useStore()
  const tracking = useStoreTracking(token)
  const initial = location.state as StoreCheckoutResult | null
  const [intent, setIntent] = useState<Intent | null>(initial?.paymentIntentId ? { id: initial.paymentIntentId, ref: initial.paymentRef, amount: initial.amount, method: initial.method } : null)
  const [failure, setFailure] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<'succeed' | 'fail'>('succeed')
  const [retryMethod, setRetryMethod] = useState<PaymentMethodKind>((initial?.method as PaymentMethodKind) ?? config.paymentMethods[0]?.id ?? 'card')
  useDocTitle('Payment')

  const complete = useInstMutation((v: { id: string; outcome: 'succeed' | 'fail' | 'pending' }) => storeService.completePayment(v.id, v.outcome), {
    onSuccess: (res) => {
      if (res.status === 'succeeded') navigate(to(`/site/track/${token}?new=1`), { replace: true })
      else if (res.status === 'pending') navigate(to(`/site/track/${token}?new=1`), { replace: true })
      else setFailure(res.failureReason ?? 'The payment was declined.')
    },
  })
  const retry = useInstMutation((method: PaymentMethodKind) => storeService.retryPayment(token, method), {
    onSuccess: (res) => {
      setFailure(null)
      setIntent({ id: res.paymentIntentId, ref: res.paymentRef, amount: res.amount, method: res.method })
    },
  })

  if (tracking.isLoading)
    return (
      <Container className="py-14">
        <Skel className="h-8 w-64" />
        <Skel className="mt-6 h-80 w-full max-w-3xl" />
      </Container>
    )
  if (tracking.isError) {
    if (/not found/i.test(tracking.error?.message ?? '')) return <NotFoundView title="Payment link not found" body="This payment link is invalid or has expired." />
    return (
      <Container className="py-14">
        <ErrorState message={tracking.error?.message} onRetry={() => void tracking.refetch()} />
      </Container>
    )
  }
  const t = tracking.data!

  if (t.status !== 'awaiting_payment' && !complete.isPending) {
    return (
      <Container className="py-16">
        <div className={cn(cardCls, 'mx-auto max-w-lg p-8 text-center')}>
          <ShieldCheck className="mx-auto size-9 text-success" />
          <h1 className="sf-h mt-4 text-[24px] font-semibold">This order is already paid</h1>
          <p className="mt-2 text-[15px] text-fg-3">Order {t.ref} doesn’t need a payment anymore.</p>
          <Btn href={to(`/site/track/${token}`)} className="mt-6" trailing={<ArrowRight />}>
            Go to order tracking
          </Btn>
        </div>
      </Container>
    )
  }

  const method = (intent?.method ?? retryMethod) as PaymentMethodKind
  const methodCfg = config.paymentMethods.find((m) => m.id === method)

  return (
    <Container className="py-8 sm:py-12">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="sf-h text-[28px] font-semibold sm:text-[34px]">Complete your payment</h1>
            <Pill tone="warning">Simulated</Pill>
          </div>
          <p className="mt-2 text-[15px] text-fg-3">
            Order <span className="font-mono font-semibold text-fg-2">{t.ref}</span> is reserved. Nothing is processed until you confirm below.
          </p>

          <div className="mt-6 rounded-[var(--sf-r)] border border-dashed border-warning/50 bg-warning/[0.06] px-4 py-3 text-[13.5px] text-fg-2">
            <span className="font-semibold text-fg">Demo payment page.</span> This prototype uses a simulated gateway ({methodCfg?.gateway ?? 'Demo Card Gateway'}). No real card, PayPal account or bank is contacted and no money moves.
          </div>

          {failure && (
            <Notice tone="danger" icon={<CircleX />} title="Payment failed" className="mt-5">
              {failure} Your order is still reserved — you can try again{intent ? '' : ' with any method'}.
            </Notice>
          )}

          <div className={cn(cardCls, 'mt-5 p-5 sm:p-6')}>
            {!intent || failure ? (
              <RetryPanel methods={config.paymentMethods.map((m) => ({ id: m.id, name: m.name, gateway: m.gateway }))} value={retryMethod} onChange={setRetryMethod} loading={retry.isPending} onStart={() => retry.mutate(retryMethod)} failed={!!failure} />
            ) : intent.method === 'paypal' ? (
              <PayPalPanel amount={intent.amount} loading={complete.isPending} onApprove={() => complete.mutate({ id: intent.id, outcome: 'succeed' })} onDecline={() => complete.mutate({ id: intent.id, outcome: 'fail' })} />
            ) : intent.method === 'bank_transfer' ? (
              <BankPanel amount={intent.amount} reference={intent.ref} instructions={methodCfg?.instructions} loading={complete.isPending} onSent={() => complete.mutate({ id: intent.id, outcome: 'pending' })} />
            ) : (
              <CardPanel amount={intent.amount} outcome={outcome} setOutcome={setOutcome} loading={complete.isPending} onPay={() => complete.mutate({ id: intent.id, outcome })} />
            )}
            {complete.error && <p className="mt-4 text-[13.5px] font-medium text-danger">{complete.error.message}</p>}
            {retry.error && <p className="mt-4 text-[13.5px] font-medium text-danger">{retry.error.message}</p>}
          </div>
        </div>

        <aside className={cn(cardCls, 'h-fit p-5 sm:p-6 lg:sticky lg:top-24')}>
          <div className="text-[13px] font-semibold tracking-wide text-fg-3 uppercase">Order summary</div>
          <div className="mt-3 text-[16px] font-semibold text-fg">{t.serviceName}</div>
          <dl className="mt-3 grid gap-1.5 text-[14px]">
            {Object.entries(t.input).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-fg-3 capitalize">{k.replace(/_/g, ' ')}</dt>
                <dd className="truncate font-mono font-medium">{v}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-3">
              <dt className="text-fg-3">Reference</dt>
              <dd className="font-mono font-medium">{t.ref}</dd>
            </div>
          </dl>
          <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
            <span className="font-semibold">Total</span>
            <Price value={t.price} className="text-[22px]" />
          </div>
          <p className="mt-4 flex gap-2 text-[12.5px] leading-relaxed text-fg-3">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            Your price is locked. If we can’t complete the order, the payment is released automatically.
          </p>
          <SfLink href={to(`/site/track/${token}`)} className="mt-4 inline-block text-[13px] font-semibold text-accent-ink hover:underline">
            View order status
          </SfLink>
        </aside>
      </div>
    </Container>
  )
}

function CardPanel({ amount, outcome, setOutcome, loading, onPay }: { amount: Micros; outcome: 'succeed' | 'fail'; setOutcome: (o: 'succeed' | 'fail') => void; loading: boolean; onPay: () => void }) {
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        onPay()
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[15px] font-semibold">
          <CreditCard className="size-[18px] text-fg-3" /> Card details
        </div>
        <span className="text-[12px] font-medium text-fg-3">Demo Card Gateway · test card prefilled</span>
      </div>
      <FormField label="Card number" htmlFor="sf_cc">
        <input id="sf_cc" className={cn(inputCls, 'font-mono tracking-wider')} defaultValue="4242 4242 4242 4242" inputMode="numeric" autoComplete="off" />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Expiry" htmlFor="sf_exp">
          <input id="sf_exp" className={cn(inputCls, 'font-mono')} defaultValue="12 / 30" autoComplete="off" />
        </FormField>
        <FormField label="CVC" htmlFor="sf_cvc">
          <input id="sf_cvc" className={cn(inputCls, 'font-mono')} defaultValue="123" autoComplete="off" />
        </FormField>
      </div>
      <FormField label="Name on card" htmlFor="sf_name">
        <input id="sf_name" className={inputCls} defaultValue="Demo Customer" autoComplete="off" />
      </FormField>
      <OutcomeChooser outcome={outcome} setOutcome={setOutcome} />
      <Btn type="submit" size="lg" full loading={loading} leading={<Lock />}>
        Pay {formatMoney(amount)} (simulated)
      </Btn>
    </form>
  )
}

function OutcomeChooser({ outcome, setOutcome }: { outcome: 'succeed' | 'fail'; setOutcome: (o: 'succeed' | 'fail') => void }) {
  return (
    <fieldset className="rounded-[var(--sf-r)] border border-dashed border-line-strong p-3">
      <legend className="px-1 text-[12.5px] font-semibold text-fg-3">Demo: choose the gateway’s answer</legend>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ['succeed', 'Approve payment'],
            ['fail', 'Decline payment'],
          ] as const
        ).map(([v, label]) => (
          <label key={v} className={cn('flex cursor-pointer items-center gap-2 rounded-[var(--sf-r-sm)] border px-3 py-2.5 text-[14px] font-medium transition-colors', outcome === v ? 'border-accent bg-accent/[0.05] text-fg' : 'border-line text-fg-2 hover:border-line-strong')}>
            <input type="radio" name="sf-outcome" className="accent-[var(--accent)]" checked={outcome === v} onChange={() => setOutcome(v)} />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function PayPalPanel({ amount, loading, onApprove, onDecline }: { amount: Micros; loading: boolean; onApprove: () => void; onDecline: () => void }) {
  return (
    <div className="grid gap-4">
      <div className="rounded-[var(--sf-r)] border border-line bg-surface-2 p-5 text-center">
        <div className="text-[13px] font-semibold tracking-wide text-fg-3 uppercase">Demo PayPal</div>
        <div className="sf-h mt-2 text-[26px] font-semibold">{formatMoney(amount)}</div>
        <p className="mx-auto mt-2 max-w-sm text-[13.5px] text-fg-3">In a live store you would be redirected to PayPal to approve. Here you decide the outcome.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Btn size="lg" full loading={loading} onClick={onApprove}>
          Approve (simulated)
        </Btn>
        <Btn size="lg" variant="secondary" full disabled={loading} onClick={onDecline}>
          Cancel / decline
        </Btn>
      </div>
    </div>
  )
}

function BankPanel({ amount, reference, instructions, loading, onSent }: { amount: Micros; reference: string; instructions?: string; loading: boolean; onSent: () => void }) {
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2 text-[15px] font-semibold">
        <Landmark className="size-[18px] text-fg-3" /> Bank transfer
      </div>
      <dl className="grid gap-2 rounded-[var(--sf-r)] border border-line bg-surface-2 p-4 text-[14px]">
        <div className="flex justify-between">
          <dt className="text-fg-3">Amount</dt>
          <dd className="font-semibold">{formatMoney(amount)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-fg-3">Payment reference</dt>
          <dd className="font-mono font-semibold">{reference}</dd>
        </div>
      </dl>
      {instructions && <p className="text-[14px] text-fg-3">{instructions}</p>}
      <Notice tone="neutral" icon={<TriangleAlert />}>
        Processing starts once our team confirms the transfer (simulated in this demo).
      </Notice>
      <Btn size="lg" full loading={loading} onClick={onSent}>
        I’ve sent the transfer
      </Btn>
    </div>
  )
}

function RetryPanel({ methods, value, onChange, onStart, loading, failed }: { methods: { id: PaymentMethodKind; name: string; gateway: string }[]; value: PaymentMethodKind; onChange: (m: PaymentMethodKind) => void; onStart: () => void; loading: boolean; failed: boolean }) {
  return (
    <div className="grid gap-4">
      <div className="text-[15px] font-semibold">{failed ? 'Try again' : 'Choose how to pay'}</div>
      <div className="grid gap-2">
        {methods.map((m) => (
          <label key={m.id} className={cn('flex cursor-pointer items-center gap-3 rounded-[var(--sf-r)] border p-3.5 transition-colors', value === m.id ? 'border-accent bg-accent/[0.05]' : 'border-line hover:border-line-strong')}>
            <input type="radio" name="sf-retry" className="accent-[var(--accent)]" checked={value === m.id} onChange={() => onChange(m.id)} />
            <span className="flex-1">
              <span className="block text-[14.5px] font-semibold">{m.name}</span>
              <span className="block text-[12.5px] text-fg-3">{m.gateway} · simulated</span>
            </span>
          </label>
        ))}
      </div>
      <Btn size="lg" full loading={loading} onClick={onStart} trailing={<ArrowRight />}>
        {failed ? 'Retry payment' : 'Continue to payment'}
      </Btn>
    </div>
  )
}
