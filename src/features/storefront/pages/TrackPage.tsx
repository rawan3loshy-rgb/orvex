/**
 * Private tracking page (/site/track/:token). The random token is the only
 * thing that reveals results — an order reference alone never does.
 * Polls via useStoreTracking until the order reaches a final state.
 */
import { useParams, useSearchParams } from 'react-router'
import { Check, CircleCheck, CircleX, Clock, CreditCard, Hourglass, Lock, Mail, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { useStoreTracking } from '@/hooks/installation'
import { formatMoney } from '@/core/money'
import type { StoreTracking } from '@/types/installation'
import { dateTime } from '@/lib/format'
import { cn } from '@/lib/cn'
import { SfLink } from '../lib/store'
import { useDocTitle, useStore } from '../lib/storeContext'
import { publicStatusView } from '../lib/format'
import { StoreResult } from '../components/StoreResult'
import { Btn, cardCls, Container, ErrorState, Notice, Price, SfCopyButton, Skel, Spinner, StatusPill } from '../ui'
import { NotFoundView } from './NotFoundPage'

const FINAL = ['completed', 'rejected', 'cancelled']

export default function TrackPage() {
  const { token = '' } = useParams()
  const [params] = useSearchParams()
  const isNew = params.get('new') === '1'
  const tracking = useStoreTracking(token)
  const { to } = useStore()
  useDocTitle(tracking.data ? `Order ${tracking.data.ref}` : 'Order tracking')

  if (tracking.isLoading)
    return (
      <Container className="py-12">
        <Skel className="h-8 w-72" />
        <Skel className="mt-6 h-24 w-full" />
        <Skel className="mt-4 h-64 w-full" />
      </Container>
    )
  if (tracking.isError) {
    if (/not found/i.test(tracking.error?.message ?? '')) return <NotFoundView title="Tracking link not found" body="This tracking link is invalid. Use your order reference and email to find your order." />
    return (
      <Container className="py-12">
        <ErrorState message={tracking.error?.message} onRetry={() => void tracking.refetch()} />
      </Container>
    )
  }
  const t = tracking.data!
  const live = !FINAL.includes(t.status)
  const link = `${window.location.origin}/site/track/${token}`

  return (
    <Container className="py-8 sm:py-12">
      <div className="mx-auto max-w-4xl">
        {isNew && <Confirmation t={t} link={link} />}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[13px] font-semibold tracking-wide text-fg-3 uppercase">Order {t.ref}</div>
            <h1 className="sf-h mt-1 text-[26px] leading-tight font-semibold sm:text-[32px]">{t.serviceName}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] text-fg-3">
              <span>Placed {dateTime(t.createdAt)}</span>
              <span>{formatMoney(t.price)}</span>
              {t.payment && (
                <span className="inline-flex items-center gap-1.5">
                  <CreditCard className="size-3.5" />
                  {t.payment.method.replace('_', ' ')} · {t.payment.ref}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {live && (
              <span className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-3">
                <RefreshCw className="size-3.5 animate-spin [animation-duration:2.5s]" /> Updating live
              </span>
            )}
            <StatusPill status={t.status} detail={t.statusDetail} financial={t.financialStatus} />
          </div>
        </div>

        <Steps t={t} />

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="grid content-start gap-4">
            <StatusBody t={t} token={token} />
          </div>
          <aside className="grid content-start gap-4">
            <div className={cn(cardCls, 'p-5')}>
              <div className="text-[13px] font-semibold text-fg">Order details</div>
              <dl className="mt-3 grid gap-2 text-[13.5px]">
                {Object.entries(t.input).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-fg-3 capitalize">{k.replace(/_/g, ' ')}</dt>
                    <dd className="truncate font-mono font-medium">{v}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-3">Price</dt>
                  <dd>
                    <Price value={t.price} className="text-[14px]" />
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-3">Receipt sent to</dt>
                  <dd className="truncate font-medium">{t.email}</dd>
                </div>
                {t.completedAt && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-fg-3">Finished</dt>
                    <dd className="font-medium">{dateTime(t.completedAt)}</dd>
                  </div>
                )}
              </dl>
            </div>
            <div className="rounded-[var(--sf-r-lg)] border border-line bg-bg-subtle p-5 text-[13.5px] leading-relaxed text-fg-3">
              <div className="mb-1 flex items-center gap-2 font-semibold text-fg">
                <Lock className="size-4 text-accent-ink" /> This page is private
              </div>
              Anyone with this link can see the result, so share it carefully. Lost it?{' '}
              <SfLink href={to('/site/track')} className="font-semibold text-accent-ink hover:underline">
                Find your order
              </SfLink>{' '}
              with your reference and email.
            </div>
          </aside>
        </div>
      </div>
    </Container>
  )
}

function Confirmation({ t, link }: { t: StoreTracking; link: string }) {
  const awaiting = t.status === 'awaiting_payment'
  return (
    <div className={cn(cardCls, 'mb-8 overflow-hidden')}>
      <div className="flex flex-col items-center gap-3 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--success)_9%,transparent),transparent)] px-6 pt-8 pb-6 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-success text-white shadow-[0_8px_20px_-8px_var(--success)]">{awaiting ? <Hourglass className="size-6" /> : <Check className="size-7" strokeWidth={3} />}</span>
        <h2 className="sf-h text-[26px] font-semibold sm:text-[30px]">{awaiting ? 'Order placed — payment pending' : 'Thank you — your order is placed'}</h2>
        <p className="text-[15px] text-fg-3">
          Your order reference is <span className="font-mono font-semibold text-fg">{t.ref}</span>
        </p>
      </div>
      <div className="grid gap-3 border-t border-line px-5 py-5 sm:px-8">
        <div className="text-[14px] font-semibold text-fg">Your private tracking link</div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 truncate rounded-[var(--sf-r-sm)] border border-line bg-surface-2 px-3 py-2.5 font-mono text-[13px] text-fg-2">{link}</code>
          <SfCopyButton value={link} label="Copy link" className="justify-center py-2.5" />
        </div>
        <ul className="grid gap-1.5 text-[13.5px] text-fg-3">
          <li className="flex gap-2">
            <Lock className="mt-0.5 size-3.5 shrink-0 text-accent-ink" /> This link is private — it is the only way to see your result. Your order reference alone never reveals results.
          </li>
          <li className="flex gap-2">
            <Mail className="mt-0.5 size-3.5 shrink-0 text-accent-ink" /> We’ve emailed it to {t.email} (simulated in this demo).
          </li>
        </ul>
      </div>
    </div>
  )
}

function Steps({ t }: { t: StoreTracking }) {
  return (
    <ol className={cn(cardCls, 'mt-6 grid gap-0 p-5 sm:grid-cols-4 sm:p-6')} aria-label="Order progress">
      {t.steps.map((s, i) => {
        const last = i === t.steps.length - 1
        return (
          <li key={s.key} className="relative flex gap-3 pb-5 last:pb-0 sm:flex-col sm:gap-2.5 sm:pr-4 sm:pb-0" aria-current={s.state === 'current' ? 'step' : undefined}>
            {!last && <span aria-hidden className={cn('absolute top-8 bottom-0 left-[15px] w-0.5 sm:top-[15px] sm:right-0 sm:bottom-auto sm:left-9 sm:h-0.5 sm:w-auto', s.state === 'done' ? 'bg-success' : 'bg-line-strong')} />}
            <span
              className={cn(
                'relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2 text-[13px] font-bold',
                s.state === 'done' && 'border-success bg-success text-white',
                s.state === 'current' && 'border-accent bg-surface text-accent-ink',
                s.state === 'todo' && 'border-line-strong bg-surface text-fg-3',
                s.state === 'failed' && 'border-danger bg-danger text-white',
              )}
            >
              {s.state === 'done' ? <Check className="size-4" strokeWidth={3} /> : s.state === 'failed' ? <X className="size-4" strokeWidth={3} /> : s.state === 'current' ? <span className="size-2.5 animate-pulse rounded-full bg-accent" /> : i + 1}
            </span>
            <div className="min-w-0 pt-1 sm:pt-0">
              <div className={cn('text-[14px] font-semibold', s.state === 'todo' ? 'text-fg-3' : 'text-fg', s.state === 'failed' && 'text-danger')}>{s.label}</div>
              <div className="text-[12.5px] text-fg-3">{s.at ? dateTime(s.at) : s.state === 'current' ? 'In progress' : ''}</div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function StatusBody({ t, token }: { t: StoreTracking; token: string }) {
  const { to } = useStore()
  const view = publicStatusView(t.status, t.statusDetail, t.financialStatus)
  if (t.status === 'completed' && t.result)
    return (
      <>
        <div className="flex items-center gap-2 text-[15px] font-semibold text-success">
          <CircleCheck className="size-5" /> Your result is ready
        </div>
        <StoreResult result={t.result} schema={t.resultSchema} />
      </>
    )
  if (t.status === 'awaiting_payment')
    return (
      <div className={cn(cardCls, 'p-6')}>
        <div className="flex items-center gap-2 text-[17px] font-semibold">
          <CreditCard className="size-5 text-warning" /> Waiting for payment
        </div>
        <p className="mt-2 text-[14.5px] text-fg-3">{t.payment?.status === 'pending' ? 'We’re waiting for your payment to be confirmed. Processing starts automatically once it arrives.' : 'Your order is reserved. Complete the payment to start processing.'}</p>
        {t.payment?.status !== 'pending' && (
          <Btn href={to(`/site/pay/${token}`)} className="mt-5">
            Complete payment
          </Btn>
        )}
      </div>
    )
  if (t.status === 'rejected' || t.status === 'cancelled') {
    const released = ['released', 'refunded', 'partially_refunded'].includes(t.financialStatus)
    return (
      <div className={cn(cardCls, 'p-6')}>
        <div className="flex items-center gap-2 text-[17px] font-semibold">
          <CircleX className="size-5 text-danger" /> {t.status === 'cancelled' ? 'This order was cancelled' : 'We couldn’t complete this order'}
        </div>
        {t.rejection?.message && <p className="mt-2 text-[14.5px] text-fg-2">{t.rejection.message}</p>}
        <Notice tone="success" icon={<ShieldCheck />} className="mt-4" title={released ? 'Your money is safe' : 'You were not charged'}>
          {released ? `${formatMoney(t.price)} has been ${t.financialStatus === 'released' ? 'released' : 'refunded'} — you have not been charged for this order.` : 'No payment was captured for this order.'}
        </Notice>
        <Btn href={to('/site/services')} variant="secondary" className="mt-5">
          Browse services
        </Btn>
      </div>
    )
  }
  const underReview = t.statusDetail === 'under_review'
  return (
    <div className={cn(cardCls, 'p-6')}>
      <div className="flex items-center gap-3">
        {underReview ? <ShieldCheck className="size-6 text-accent-ink" /> : <Spinner className="size-6" />}
        <div className="text-[17px] font-semibold">{underReview ? 'Your order is being verified' : t.status === 'queued' ? 'Your order is in line' : 'We’re working on your order'}</div>
      </div>
      <p className="mt-3 text-[14.5px] leading-relaxed text-fg-3">
        {underReview
          ? 'Our team is verifying the result with the supplier to make sure you get an accurate answer. This can take a little longer than usual — you don’t need to do anything, and you will never be charged twice.'
          : view.description + ' This page updates automatically — feel free to leave and come back with your private link.'}
      </p>
      <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 text-[12.5px] text-fg-3">
        <Clock className="size-3.5" /> Started {dateTime(t.createdAt)}
      </div>
    </div>
  )
}
