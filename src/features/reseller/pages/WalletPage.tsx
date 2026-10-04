import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Building2, CircleCheck, CircleX, Clock, CreditCard, Info, Landmark, Loader2, Plus, ReceiptText, Wallet } from 'lucide-react'
import { Badge, Button, Card, CardHeader, CopyButton, DataTable, EmptyState, Field, Input, Modal, PageHeader, Pagination, Segmented, Skeleton, StatusBadge, type Column } from '@/components/ui'
import { Money, SimulatedBadge } from '@/components/domain'
import { useInstMutation, usePortalDashboard, usePortalWallet } from '@/hooks/installation'
import { portalService } from '@/services/installation'
import { formatMoney, parseMoney, usd, type Micros } from '@/core/money'
import type { AccountBalance, PaymentIntent, PaymentMethodKind, WalletLine } from '@/types/installation'
import { dateTime, relative } from '@/lib/format'
import { cn } from '@/lib/cn'
import { DemoNote, ErrorCard, NoAccess } from '../kit'
import { usePortalSession, WALLET_FILTERS, WALLET_KIND } from '../kitUtils'

/** Bank details shown for transfers (seeded installation payment settings). */
const BANK = { iban: 'AE07 0331 2345 6789 0123 456', beneficiary: 'UnlockDesk Demo Ltd.', bank: 'Demo Bank (simulated)' }

export default function WalletPage() {
  const { me, can, role } = usePortalSession()
  const [params, setParams] = useSearchParams()
  const [kind, setKind] = useState('all')
  const [page, setPage] = useState(1)
  const [topUp, setTopUp] = useState(false)
  const wallet = usePortalWallet({ page, kind: kind === 'all' ? undefined : kind })
  const dash = usePortalDashboard()

  // `?topup=1` opens the top-up modal (adjusted during render), then the param is stripped from the URL.
  const topUpRequested = !!params.get('topup') && can.finance
  if (topUpRequested && !topUp) setTopUp(true)
  useEffect(() => {
    if (!topUpRequested) return
    setParams((p) => {
      const n = new URLSearchParams(p)
      n.delete('topup')
      return n
    }, { replace: true })
  }, [topUpRequested, setParams])

  const balance = wallet.data?.balance ?? me?.balance
  return (
    <div>
      <PageHeader
        title="Wallet"
        description="Your balance is calculated from the ledger: top-ups add funds, orders reserve them, completion charges them and rejections release them."
        actions={
          can.finance && (
            <Button variant="accent" leading={<Plus />} onClick={() => setTopUp(true)}>
              Top up
            </Button>
          )
        }
      />

      {balance ? <BalanceProjection balance={balance} openOrders={dash.data?.processing} /> : <Skeleton className="h-[150px] rounded-xl" />}

      {me && !can.finance ? (
        <NoAccess need="finance" role={role} className="mt-4" />
      ) : (
        <>
          <PendingPayments payments={wallet.data?.payments} />
          <Card className="mt-4 overflow-hidden">
            <CardHeader title="Transactions" description="Each line shows its effect on your available and held balances" />
            <div className="no-scrollbar overflow-x-auto px-5 pb-3">
              <Segmented
                items={WALLET_FILTERS.map((f) => ({ value: f.value, label: f.label }))}
                value={kind}
                onChange={(v) => {
                  setKind(v)
                  setPage(1)
                }}
              />
            </div>
            {wallet.error ? <ErrorCard className="m-4" error={wallet.error} onRetry={() => wallet.refetch()} /> : <Transactions lines={wallet.data?.items} loading={wallet.isLoading} />}
            {wallet.data && wallet.data.total > 0 && <Pagination page={wallet.data.page} pageSize={wallet.data.pageSize} total={wallet.data.total} onPage={setPage} />}
          </Card>
        </>
      )}

      {can.finance && <TopUpModal open={topUp} onClose={() => setTopUp(false)} />}
    </div>
  )
}

function BalanceProjection({ balance: b, openOrders }: { balance: AccountBalance; openOrders?: number }) {
  return (
    <Card className="overflow-hidden">
      <div className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
        <Cell label="Available" value={b.available} big hint="Ready to spend now" />
        <Cell label="Held" value={b.held} hint={b.held > 0 ? `${formatMoney(b.held)} reserved for ${openOrders ?? '…'} open order${openOrders === 1 ? '' : 's'}` : 'Nothing reserved right now'} />
        <Cell label="Credit limit" value={b.creditLimit} hint="Post-paid allowance from UnlockDesk" />
        <Cell label="Spendable" value={b.spendable} hint="Available + credit limit" accent />
      </div>
      <div className="flex items-start gap-2 border-t border-line bg-surface-2/50 px-5 py-3 text-[12px] text-fg-3">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          When you place an order its price moves from <span className="text-fg-2">available</span> to <span className="text-fg-2">held</span>. If it completes, the held amount is charged; if it’s rejected or cancelled, it’s released back to available. You’re never charged for an order that didn’t deliver.
        </span>
      </div>
    </Card>
  )
}

function Cell({ label, value, hint, big, accent }: { label: string; value: Micros; hint: string; big?: boolean; accent?: boolean }) {
  return (
    <div className="px-5 py-4">
      <div className="mono-label">{label}</div>
      <div className={cn('mt-1.5 font-display leading-none font-semibold tracking-[-0.02em] tabular', big ? 'text-[30px]' : 'text-[22px]', accent && 'text-accent-ink')}>
        <Money value={value} tone="auto" />
      </div>
      <div className="mt-1.5 text-[12px] text-fg-3">{hint}</div>
    </div>
  )
}

function Delta({ v }: { v: Micros }) {
  if (!v) return <span className="text-fg-3">—</span>
  return <Money value={v} sign tone="auto" className="font-medium" />
}

function Transactions({ lines, loading }: { lines?: WalletLine[]; loading: boolean }) {
  const columns: Column<WalletLine>[] = [
    { key: 'at', header: 'Date', cell: (l) => <span className="text-[12px] whitespace-nowrap text-fg-2">{dateTime(l.at)}</span> },
    {
      key: 'desc',
      header: 'Description',
      cell: (l) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge tone={WALLET_KIND[l.kind]?.tone ?? 'neutral'}>{WALLET_KIND[l.kind]?.label ?? l.kind}</Badge>
            {l.orderRef && (
              <Link to={`/portal/orders/${l.orderRef}`} className="font-mono text-[11.5px] text-accent-ink hover:underline">
                {l.orderRef}
              </Link>
            )}
          </div>
          <div className="mt-0.5 max-w-[360px] truncate text-[12px] text-fg-3">{l.description}</div>
        </div>
      ),
    },
    { key: 'avail', header: 'Available', align: 'right', cell: (l) => <Delta v={l.available} /> },
    { key: 'held', header: 'Held', align: 'right', cell: (l) => <Delta v={l.held} /> },
    {
      key: 'after',
      header: 'Balance after',
      align: 'right',
      cell: (l) => (
        <div>
          <Money value={l.availableAfter} className="font-medium" />
          {l.heldAfter > 0 && (
            <div className="text-[11px] text-fg-3">
              <Money value={l.heldAfter} /> held
            </div>
          )}
        </div>
      ),
    },
  ]
  return (
    <>
      <div className="hidden md:block">
        <DataTable columns={columns} rows={lines} rowKey={(l) => l.txId} loading={loading} minWidth={720} dense empty={<EmptyState compact icon={<ReceiptText />} title="No transactions" description="Nothing matches this filter yet." />} />
      </div>
      <div className="md:hidden">
        {loading && !lines ? (
          <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : lines?.length ? (
          <ul className="divide-y divide-line border-t border-line">
            {lines.map((l) => (
              <li key={l.txId} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <Badge tone={WALLET_KIND[l.kind]?.tone ?? 'neutral'}>{WALLET_KIND[l.kind]?.label ?? l.kind}</Badge>
                  <div className="mt-1 truncate text-[12.5px] text-fg-2">{l.orderRef ?? l.description}</div>
                  <div className="text-[11px] text-fg-3">{dateTime(l.at)}</div>
                </div>
                <div className="shrink-0 text-right text-[12.5px]">
                  {l.available !== 0 && <Money value={l.available} sign tone="auto" className="block font-medium" />}
                  {l.held !== 0 && (
                    <span className="block text-[11.5px] text-fg-3">
                      <Money value={l.held} sign /> held
                    </span>
                  )}
                  <span className="block text-[11px] text-fg-3">
                    = <Money value={l.availableAfter} />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact icon={<ReceiptText />} title="No transactions" />
        )}
      </div>
    </>
  )
}

const METHOD_LABEL: Record<string, string> = { card: 'Card', paypal: 'PayPal', bank_transfer: 'Bank transfer', manual: 'Manual' }

function PendingPayments({ payments }: { payments?: PaymentIntent[] }) {
  const recent = (payments ?? []).slice(0, 5)
  if (!recent.length) return null
  return (
    <Card className="mt-4">
      <CardHeader title="Recent top-ups" description="Bank transfers stay pending until UnlockDesk finance confirms receipt" actions={<SimulatedBadge label="Payments simulated" />} />
      <ul className="divide-y divide-line border-t border-line">
        {recent.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5">
            <span className="font-mono text-[12px] text-fg-2">{p.ref}</span>
            <span className="text-[12.5px] text-fg-3">{METHOD_LABEL[p.method] ?? p.method}</span>
            <span className="text-[12px] text-fg-3">{relative(p.createdAt)}</span>
            <span className="ml-auto flex items-center gap-3">
              <Money value={p.amount} className="font-medium" />
              <StatusBadge status={p.status} />
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  Top-up flow (simulated payments)                                   */
/* ------------------------------------------------------------------ */

const PRESETS = [50, 100, 250, 500]
const METHODS: { id: PaymentMethodKind; label: string; sub: string; icon: typeof CreditCard }[] = [
  { id: 'card', label: 'Card', sub: 'Demo Card Gateway · instant', icon: CreditCard },
  { id: 'paypal', label: 'PayPal', sub: 'Demo PayPal sandbox · instant', icon: Wallet },
  { id: 'bank_transfer', label: 'Bank transfer', sub: 'No fee · credited after confirmation', icon: Landmark },
]

type Step = 'form' | 'paying' | 'done'

function TopUpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [amountText, setAmountText] = useState('100')
  const [method, setMethod] = useState<PaymentMethodKind>('card')
  const [step, setStep] = useState<Step>('form')
  const [intent, setIntent] = useState<PaymentIntent | null>(null)
  const amount = parseMoney(amountText)
  const amountError = amount == null ? 'Enter an amount, e.g. 150 or 99.50' : amount < usd(5) ? 'Minimum top-up is $5.00' : amount > usd(25_000) ? 'Maximum single top-up is $25,000.00' : null

  const complete = useInstMutation((p: { id: string; outcome: 'succeed' | 'pending' }) => portalService.completePayment(p.id, p.outcome), {
    onSuccess: (pi) => {
      setIntent(pi)
      setStep('done')
    },
    onError: () => setStep('form'),
  })
  const create = useInstMutation(portalService.topUp, {
    onSuccess: (pi) => {
      setIntent(pi)
      if (pi.method === 'bank_transfer') setStep('done')
      else {
        setStep('paying')
        // Simulated gateway: card / PayPal confirm immediately.
        setTimeout(() => complete.mutate({ id: pi.id, outcome: 'succeed' }), 900)
      }
    },
  })

  const close = () => {
    onClose()
    setTimeout(() => {
      setStep('form')
      setIntent(null)
      setAmountText('100')
      setMethod('card')
    }, 250)
  }

  const isBank = intent?.method === 'bank_transfer'
  return (
    <Modal
      open={open}
      onClose={close}
      icon={<Wallet />}
      title={step === 'done' ? (isBank ? 'Transfer instructions' : intent?.status === 'succeeded' ? 'Wallet topped up' : 'Payment not completed') : 'Top up wallet'}
      description={step === 'form' ? 'Funds are added to your available balance as soon as the payment succeeds.' : undefined}
      footer={
        step === 'form' ? (
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="accent" disabled={!!amountError} loading={create.isPending} onClick={() => amount && create.mutate({ amount, method })}>
              {method === 'bank_transfer' ? 'Get transfer details' : `Pay ${amount ? formatMoney(amount) : ''}`}
            </Button>
          </>
        ) : step === 'done' ? (
          isBank && intent?.status === 'requires_payment' ? (
            <>
              <Button variant="ghost" onClick={close}>
                Later
              </Button>
              <Button variant="primary" loading={complete.isPending} onClick={() => complete.mutate({ id: intent.id, outcome: 'pending' })}>
                I’ve sent the transfer
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={close}>
              Done
            </Button>
          )
        ) : undefined
      }
    >
      {step === 'form' && (
        <div className="space-y-5">
          <Field label="Amount" error={amountText ? (amountError ?? undefined) : undefined} htmlFor="tu_amount">
            <Input id="tu_amount" inputSize="lg" inputMode="decimal" leading={<span className="text-[15px]">$</span>} value={amountText} onChange={(e) => setAmountText(e.target.value)} />
          </Field>
          <div className="-mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button key={p} type="button" onClick={() => setAmountText(String(p))} className={cn('h-8 rounded-full border px-3 text-[12.5px] font-medium tabular transition-colors', amount === usd(p) ? 'border-fg bg-fg text-bg' : 'border-line text-fg-2 hover:border-line-strong')}>
                ${p}
              </button>
            ))}
          </div>
          <div>
            <div className="mb-2 text-[12.5px] font-medium">Payment method</div>
            <div className="grid gap-2">
              {METHODS.map((m) => {
                const Icon = m.icon
                const active = method === m.id
                return (
                  <button key={m.id} type="button" onClick={() => setMethod(m.id)} className={cn('flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors', active ? 'border-accent/60 bg-accent/[0.05] ring-3 ring-accent/12' : 'border-line hover:border-line-strong')}>
                    <span className={cn('grid size-9 place-items-center rounded-lg border', active ? 'border-accent/30 text-accent-ink' : 'border-line text-fg-3')}>
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-medium">{m.label}</span>
                      <span className="block text-[11.5px] text-fg-3">{m.sub}</span>
                    </span>
                    <span className={cn('size-4 rounded-full border-2', active ? 'border-accent bg-accent shadow-[inset_0_0_0_2px_var(--surface)]' : 'border-line-strong')} />
                  </button>
                )
              })}
            </div>
          </div>
          <DemoNote>Payments are simulated — no card is charged and no real gateway is contacted.</DemoNote>
        </div>
      )}

      {step === 'paying' && (
        <div className="flex flex-col items-center py-8 text-center">
          <Loader2 className="size-8 animate-spin text-accent-ink" />
          <p className="mt-4 text-[14px] font-medium">Confirming with {intent?.method === 'paypal' ? 'Demo PayPal (sandbox)' : 'Demo Card Gateway'}…</p>
          <p className="mt-1 text-[12.5px] text-fg-3">Simulated payment · {intent && formatMoney(intent.amount)}</p>
        </div>
      )}

      {step === 'done' && intent && (isBank ? <BankInstructions intent={intent} /> : <PaymentOutcome intent={intent} />)}
    </Modal>
  )
}

function PaymentOutcome({ intent }: { intent: PaymentIntent }) {
  const ok = intent.status === 'succeeded'
  const pending = intent.status === 'pending'
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <span className={cn('grid size-14 place-items-center rounded-2xl', ok ? 'bg-success/12 text-success' : pending ? 'bg-warning/12 text-warning' : 'bg-danger/10 text-danger')}>{ok ? <CircleCheck className="size-7" /> : pending ? <Clock className="size-7" /> : <CircleX className="size-7" />}</span>
      <p className="mt-4 font-display text-[22px] font-semibold">
        <Money value={intent.amount} sign={ok} />
      </p>
      <p className="mt-1 max-w-sm text-[13px] text-fg-2">
        {ok ? 'Added to your available balance. The top-up is recorded in your ledger and statement.' : pending ? 'The payment is pending at the gateway. Your wallet is credited automatically when it succeeds.' : (intent.failureReason ?? 'The payment was declined. Nothing was charged — try again or use another method.')}
      </p>
      <p className="mt-3 font-mono text-[11.5px] text-fg-3">
        {intent.ref} · {intent.gatewayRef}
      </p>
    </div>
  )
}

function BankInstructions({ intent }: { intent: PaymentIntent }) {
  const rows = [
    { label: 'Beneficiary', value: BANK.beneficiary },
    { label: 'IBAN', value: BANK.iban, mono: true },
    { label: 'Amount', value: formatMoney(intent.amount), mono: true },
    { label: 'Reference (required)', value: intent.ref, mono: true },
  ]
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <StatusBadge status={intent.status} />
        <span className="text-[12.5px] text-fg-3">{intent.status === 'pending' ? 'Waiting for UnlockDesk finance to confirm receipt' : 'Send the transfer, then let us know'}</span>
      </div>
      <dl className="divide-y divide-line rounded-xl border border-line">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
            <dt className="text-[12.5px] text-fg-3">{r.label}</dt>
            <dd className={cn('flex items-center gap-1 text-right text-[13px]', r.mono && 'font-mono text-[12.5px]')}>
              {r.value}
              <CopyButton value={r.value} />
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex gap-2 rounded-lg bg-surface-2/70 px-3 py-2.5 text-[12px] text-fg-2">
        <Building2 className="mt-0.5 size-4 shrink-0 text-fg-3" />
        <span>Always include the reference so we can match your transfer. Your balance is credited once UnlockDesk finance confirms the money has arrived — usually within one business day. It stays <span className="font-medium">pending</span> until then.</span>
      </div>
      <DemoNote>Simulated: in the demo, an operator confirms the transfer from the admin console (Finance → Payments).</DemoNote>
    </div>
  )
}
