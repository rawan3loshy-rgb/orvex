import { ArrowRight, LogOut, Package, ShoppingBag, UserRound, Wallet } from 'lucide-react'
import { useDemoState, useInstMutation, useStoreAccount } from '@/hooks/installation'
import { storeService } from '@/services/installation'
import { formatMoney } from '@/core/money'
import { dateShort } from '@/lib/format'
import { cn } from '@/lib/cn'
import { SfLink } from '../lib/store'
import { useDocTitle, useStore } from '../lib/storeContext'
import { Btn, cardCls, Container, EmptyBlock, ErrorState, Pill, Price, Skel, StatusPill } from '../ui'

export default function AccountPage() {
  const { config } = useStore()
  useDocTitle(config.customer ? 'My account' : 'Sign in')
  return config.customer ? <SignedIn /> : <SignIn />
}

function SignIn() {
  const { to, config } = useStore()
  const demo = useDemoState()
  const session = useInstMutation((id: string | null) => storeService.session(id), { success: (r) => (r.accountId ? 'Signed in (demo)' : 'Signed out') })
  const customers = demo.data?.customers ?? []
  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className={cn(cardCls, 'p-6 sm:p-8')}>
          <h1 className="sf-h text-[28px] font-semibold sm:text-[34px]">Sign in</h1>
          <p className="mt-2 text-[15px] text-fg-3">Keep a wallet, see your order history and get your customer pricing.</p>
          <div className="mt-6 rounded-[var(--sf-r)] border border-dashed border-warning/50 bg-warning/[0.06] p-4">
            <div className="flex items-center gap-2 text-[13.5px] font-semibold text-fg">
              <Pill tone="warning">Demo sign-in</Pill> Choose a demo customer — no password in this prototype
            </div>
            <div className="mt-3 grid gap-2">
              {demo.isLoading ? (
                [0, 1, 2].map((i) => <Skel key={i} className="h-14" />)
              ) : demo.isError ? (
                <ErrorState title="Demo customers unavailable" message={demo.error?.message} onRetry={() => void demo.refetch()} />
              ) : !customers.length ? (
                <p className="text-[14px] text-fg-3">No demo customers are configured.</p>
              ) : (
                customers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={session.isPending}
                    onClick={() => session.mutate(c.id)}
                    className="flex items-center gap-3 rounded-[var(--sf-r)] border border-line bg-surface p-3 text-left transition-colors hover:border-accent hover:bg-accent/[0.04] disabled:opacity-60"
                  >
                    <span className="grid size-10 place-items-center rounded-full bg-accent/12 text-[14px] font-bold text-accent-ink">{c.name.slice(0, 1)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold text-fg">{c.name}</span>
                      <span className="block truncate text-[12.5px] text-fg-3">{c.email}</span>
                    </span>
                    <ArrowRight className="size-4 text-fg-3" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
        <div className="grid content-start gap-4">
          <div className={cn(cardCls, 'p-6')}>
            <ShoppingBag className="size-6 text-accent-ink" />
            <h2 className="sf-h mt-3 text-[19px] font-semibold">Continue as guest</h2>
            <p className="mt-1.5 text-[14.5px] text-fg-3">{config.checkout.guestCheckout ? 'No account needed — order with just your email and follow progress with a private tracking link.' : 'This store requires an account to order.'}</p>
            {config.checkout.guestCheckout && (
              <Btn href={to('/site/services')} variant="secondary" className="mt-4" trailing={<ArrowRight />}>
                Browse services
              </Btn>
            )}
          </div>
          <div className={cn(cardCls, 'p-6')}>
            <Package className="size-6 text-accent-ink" />
            <h2 className="sf-h mt-3 text-[19px] font-semibold">Already ordered?</h2>
            <p className="mt-1.5 text-[14.5px] text-fg-3">Find any order with its reference and your email.</p>
            <Btn href={to('/site/track')} variant="secondary" className="mt-4">
              Track an order
            </Btn>
          </div>
        </div>
      </div>
    </Container>
  )
}

function SignedIn() {
  const { config, to } = useStore()
  const customer = config.customer!
  const acct = useStoreAccount(true)
  const session = useInstMutation((id: string | null) => storeService.session(id), { success: 'Signed out' })
  const bal = acct.data?.balance ?? customer.balance

  return (
    <Container className="py-10 sm:py-14">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-full bg-accent text-[22px] font-bold text-accent-fg">{customer.name.slice(0, 1)}</span>
          <div>
            <h1 className="sf-h text-[26px] font-semibold sm:text-[32px]">{customer.name}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[14px] text-fg-3">
              {customer.email}
              <Pill tone="brand">{customer.tierName} pricing</Pill>
            </div>
          </div>
        </div>
        <Btn variant="secondary" size="sm" leading={<LogOut />} loading={session.isPending} onClick={() => session.mutate(null)}>
          Sign out
        </Btn>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className={cn(cardCls, 'p-5')}>
          <div className="flex items-center gap-2 text-[13.5px] font-medium text-fg-3">
            <Wallet className="size-4" /> Wallet balance
          </div>
          <Price value={bal.available} className="mt-2 block text-[30px]" />
          <div className="mt-1 text-[12.5px] text-fg-3">Spendable {formatMoney(bal.spendable)}</div>
        </div>
        <div className={cn(cardCls, 'p-5')}>
          <div className="text-[13.5px] font-medium text-fg-3">Reserved for open orders</div>
          <Price value={bal.held} className="mt-2 block text-[30px]" />
          <div className="mt-1 text-[12.5px] text-fg-3">Captured when an order completes, released if it can’t be.</div>
        </div>
        <div className={cn(cardCls, 'p-5')}>
          <div className="flex items-center gap-2 text-[13.5px] font-medium text-fg-3">
            <UserRound className="size-4" /> Your pricing
          </div>
          <div className="sf-h mt-2 text-[24px] font-semibold">{customer.tierName}</div>
          <div className="mt-1 text-[12.5px] text-fg-3">Prices across the store are shown for your tier.</div>
        </div>
      </div>

      <h2 className="sf-h mt-10 mb-4 text-[22px] font-semibold">Order history</h2>
      {acct.isLoading ? (
        <div className={cn(cardCls, 'divide-y divide-line')}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skel className="h-4 flex-1" />
              <Skel className="h-6 w-24" />
            </div>
          ))}
        </div>
      ) : acct.isError ? (
        <ErrorState title="Orders could not be loaded" message={acct.error?.message} onRetry={() => void acct.refetch()} />
      ) : !acct.data?.orders.length ? (
        <EmptyBlock icon={<Package />} title="No orders yet" body="Your orders and results will appear here." action={<Btn href={to('/site/services')}>Browse services</Btn>} />
      ) : (
        <div className={cn(cardCls, 'divide-y divide-line overflow-hidden')}>
          <div className="hidden grid-cols-[130px_1fr_110px_90px_170px_80px] gap-4 bg-bg-subtle px-5 py-2.5 text-[12.5px] font-semibold text-fg-3 md:grid">
            <span>Reference</span>
            <span>Service</span>
            <span>Date</span>
            <span className="text-right">Price</span>
            <span>Status</span>
            <span />
          </div>
          {acct.data.orders.map((o) => (
            <div key={o.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 px-5 py-4 md:grid-cols-[130px_1fr_110px_90px_170px_80px]">
              <span className="font-mono text-[13.5px] font-semibold text-fg">{o.ref}</span>
              <span className="text-right md:order-none md:text-left">
                <Price value={o.price} className="text-[14.5px] md:hidden" />
                <span className="hidden truncate text-[14.5px] font-medium text-fg md:inline">{o.serviceName}</span>
              </span>
              <span className="truncate text-[14px] text-fg-2 md:hidden">{o.serviceName}</span>
              <span className="text-right text-[13px] text-fg-3 md:text-left">{dateShort(o.createdAt)}</span>
              <Price value={o.price} className="hidden text-right text-[14.5px] md:block" />
              <span>
                <StatusPill status={o.status} detail={o.statusDetail} financial={o.financialStatus} />
              </span>
              <span className="text-right">
                {o.trackingToken ? (
                  <SfLink href={to(`/site/track/${o.trackingToken}`)} className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-accent-ink hover:underline">
                    Track <ArrowRight className="size-3.5" />
                  </SfLink>
                ) : (
                  <span className="text-[12.5px] text-fg-3">—</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </Container>
  )
}
