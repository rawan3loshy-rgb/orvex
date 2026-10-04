import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowRight, Lock, PackageSearch, TriangleAlert } from 'lucide-react'
import { useInstMutation } from '@/hooks/installation'
import { storeService } from '@/services/installation'
import { cn } from '@/lib/cn'
import { SfLink } from '../lib/store'
import { useDocTitle, useStore } from '../lib/storeContext'
import { isEmail } from '../lib/format'
import { Btn, cardCls, Container, FormField, inputCls, Notice } from '../ui'

/** Find an order: reference + email together reveal the private tracking link. */
export default function TrackLookupPage() {
  const { to, config } = useStore()
  const navigate = useNavigate()
  const [ref, setRef] = useState('')
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  useDocTitle('Track your order')
  const lookup = useInstMutation((v: { ref: string; email: string }) => storeService.lookup(v.ref, v.email), {
    error: 'No order found',
    onSuccess: (res) => navigate(to(`/site/track/${res.trackingToken}`)),
  })
  const refOk = /^ORD-[A-Z0-9]{4,}$/i.test(ref.trim())
  const emailOk = isEmail(email)

  return (
    <Container className="py-12 sm:py-20">
      <div className="mx-auto grid max-w-4xl gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
        <div>
          <span className="grid size-12 place-items-center rounded-full bg-accent/10 text-accent-ink">
            <PackageSearch className="size-6" />
          </span>
          <h1 className="sf-h mt-5 text-[32px] leading-tight font-semibold sm:text-[40px]">Track your order</h1>
          <p className="mt-3 text-[16px] leading-relaxed text-fg-3">Enter your order reference and the email you used at checkout. We’ll take you to your private tracking page.</p>
          <div className="mt-6 flex gap-3 text-[14px] leading-relaxed text-fg-3">
            <Lock className="mt-0.5 size-4 shrink-0 text-accent-ink" />
            <span>For your privacy, a reference number alone never shows a result — the matching email is required.</span>
          </div>
          {config.customer && (
            <p className="mt-4 text-[14px] text-fg-3">
              Signed in as {config.customer.name}?{' '}
              <SfLink href={to('/site/account')} className="font-semibold text-accent-ink hover:underline">
                See all your orders
              </SfLink>
            </p>
          )}
        </div>
        <form
          className={cn(cardCls, 'grid gap-5 p-6 sm:p-8')}
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            setSubmitted(true)
            if (refOk && emailOk) lookup.mutate({ ref: ref.trim().toUpperCase(), email: email.trim().toLowerCase() })
          }}
        >
          <FormField label="Order reference" htmlFor="sf_ref" hint="Looks like ORD-7K3P9Q — it’s in your confirmation email." error={submitted && !refOk ? 'Enter a reference like ORD-7K3P9Q' : undefined}>
            <input id="sf_ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="ORD-XXXXXX" autoComplete="off" aria-invalid={submitted && !refOk} className={cn(inputCls, 'font-mono tracking-wider uppercase')} />
          </FormField>
          <FormField label="Email address" htmlFor="sf_lemail" error={submitted && !emailOk ? 'Enter the email used at checkout' : undefined}>
            <input id="sf_lemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" aria-invalid={submitted && !emailOk} className={inputCls} />
          </FormField>
          {lookup.isError && (
            <Notice tone="danger" icon={<TriangleAlert />} title="We couldn’t find that order">
              Check the reference and use the same email you entered at checkout.
            </Notice>
          )}
          <Btn type="submit" size="lg" full loading={lookup.isPending} trailing={<ArrowRight />}>
            Find my order
          </Btn>
        </form>
      </div>
    </Container>
  )
}
