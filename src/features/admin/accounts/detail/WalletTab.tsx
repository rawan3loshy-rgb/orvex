import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowDownLeft, ArrowUpRight, Banknote, ChevronRight, RefreshCw, Scale, Wallet } from 'lucide-react'
import { formatMoney, parseMoney, ZERO, type Micros } from '@/core/money'
import type { AccountDetail, WalletLine } from '@/types/installation'
import { accountsService } from '@/services/installation'
import { useInstMutation } from '@/hooks/installation'
import { Guarded, LedgerEntries, Money, PermissionHint, ledgerKindLabel } from '@/components/domain'
import { Badge, Button, Card, CardHeader, DataTable, EmptyState, Field, Input, Modal, Segmented, Textarea, type Column } from '@/components/ui'
import { dateTime } from '@/lib/format'
import { cn } from '@/lib/cn'
import { newIdempotencyKey, previewTx } from '../helpers'

export function WalletTab({ d }: { d: AccountDetail }) {
  const a = d.account
  const [topUp, setTopUp] = useState(false)
  const [adjust, setAdjust] = useState(false)

  const columns: Column<WalletLine>[] = [
    {
      key: 'at',
      header: 'Date',
      width: 'w-[150px]',
      cell: (l) => (
        <div>
          <div className="text-[12.5px] whitespace-nowrap text-fg-2">{dateTime(l.at)}</div>
          <Link to={`/admin/finance/ledger?search=${encodeURIComponent(l.ref)}`} className="font-mono text-[11px] text-fg-3 hover:text-accent-ink" onClick={(e) => e.stopPropagation()}>
            {l.ref}
          </Link>
        </div>
      ),
    },
    {
      key: 'desc',
      header: 'Movement',
      cell: (l) => (
        <div className="min-w-0">
          <div className="text-[13px] font-medium">{ledgerKindLabel(l.kind)}</div>
          <div className="truncate text-[11.5px] text-fg-3">
            {l.description}
            {l.orderRef && (
              <>
                {' · '}
                <Link to={`/admin/orders/${l.orderId}`} className="font-mono text-accent-ink hover:underline">
                  {l.orderRef}
                </Link>
              </>
            )}
          </div>
        </div>
      ),
    },
    { key: 'da', header: 'Δ Available', align: 'right', cell: (l) => <Delta value={l.available} /> },
    { key: 'dh', header: 'Δ Held', align: 'right', hideBelow: 'sm', cell: (l) => <Delta value={l.held} /> },
    { key: 'aa', header: 'Available after', align: 'right', hideBelow: 'md', cell: (l) => <Money value={l.availableAfter} tone="auto" className="font-mono text-[12.5px]" /> },
    { key: 'ha', header: 'Held after', align: 'right', hideBelow: 'lg', cell: (l) => <Money value={l.heldAfter} className="font-mono text-[12.5px] text-fg-2" /> },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <ActionCard
          icon={<Banknote />}
          title="Record top-up"
          body="Bank transfer or manual (cash / offline) payment received by finance. Creates a payment intent and posts DR Gateway Clearing / CR Customer Available."
          permission="payments.manage"
          label="Record top-up"
          onClick={() => setTopUp(true)}
          disabled={a.status === 'closed'}
        />
        <ActionCard
          icon={<Scale />}
          title="Manual adjustment"
          body="Goodwill credit or manual debit with a mandatory reason. Posts against Goodwill, carries an idempotency key and is logged as a critical audit event."
          permission="ledger.adjust"
          label="Adjust wallet"
          onClick={() => setAdjust(true)}
          disabled={a.status === 'closed'}
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          icon={<Wallet />}
          title="Wallet history"
          description="Every line is a ledger transaction touching this account’s Customer Available or Customer Held — newest first, with running balances."
          actions={
            <Button size="sm" variant="ghost" to={`/admin/finance/ledger?accountId=${a.id}`} trailing={<ChevronRight />}>
              Full postings
            </Button>
          }
        />
        <DataTable
          columns={columns}
          rows={d.wallet}
          rowKey={(l) => l.txId}
          dense
          minWidth={720}
          empty={<EmptyState compact icon={<Wallet />} title="No wallet movements yet" description="Top-ups, holds, settlements, refunds and adjustments will appear here as they are posted." />}
        />
        {d.wallet.length >= 60 && <div className="border-t border-line px-5 py-2.5 text-[12px] text-fg-3">Showing the latest 60 movements — see the ledger for the full history.</div>}
      </Card>

      <TopUpModal open={topUp} onClose={() => setTopUp(false)} d={d} />
      <AdjustModal open={adjust} onClose={() => setAdjust(false)} d={d} />
    </div>
  )
}

function Delta({ value }: { value: Micros }) {
  if (!value) return <span className="font-mono text-[12.5px] text-fg-3">—</span>
  return <Money value={value} sign tone="auto" className="font-mono text-[12.5px] font-medium" />
}

function ActionCard({ icon, title, body, permission, label, onClick, disabled }: { icon: ReactNode; title: string; body: string; permission: 'payments.manage' | 'ledger.adjust'; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-fg-2 [&_svg]:size-4">{icon}</span>
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold">{title}</div>
          <p className="mt-0.5 text-[12px] leading-relaxed text-fg-3">{body}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 pl-11">
        <PermissionHint permission={permission} />
        <Guarded permission={permission}>
          {(allowed) => (
            <Button size="sm" onClick={onClick} disabled={!allowed || disabled}>
              {label}
            </Button>
          )}
        </Guarded>
      </div>
    </Card>
  )
}

/* ------------------------------ Top-up ------------------------------ */
function TopUpModal({ open, onClose, d }: { open: boolean; onClose: () => void; d: AccountDetail }) {
  const a = d.account
  const [method, setMethod] = useState<'bank_transfer' | 'manual'>('bank_transfer')
  const [amount, setAmount] = useState('')
  const [tried, setTried] = useState(false)
  // Start clean every time the modal opens (adjusted during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setAmount('')
      setTried(false)
      setMethod('bank_transfer')
    }
  }
  const m = parseMoney(amount)
  const error = m == null ? 'Enter an amount like 100 or 100.00' : m <= 0 ? 'Amount must be positive' : undefined
  const mut = useInstMutation(() => accountsService.topUp(a.id, { amount: m!, method }), {
    success: (p) => `Top-up ${p.ref} recorded · ${formatMoney(p.amount)} credited`,
    onSuccess: onClose,
  })
  const amt = m && m > 0 ? m : ZERO
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<Banknote />}
      title={`Record top-up for ${a.name}`}
      description="Use when finance has received funds outside the card/PayPal flows. The wallet is credited by a ledger posting — never by editing a balance."
      footer={
        <>
          <PermissionHint permission="payments.manage" className="mr-auto" />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="accent"
            loading={mut.isPending}
            onClick={() => {
              setTried(true)
              if (!error) mut.mutate()
            }}
          >
            Record & credit wallet
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Method">
          <Segmented<'bank_transfer' | 'manual'>
            items={[
              { value: 'bank_transfer', label: 'Bank transfer' },
              { value: 'manual', label: 'Manual (cash / offline)' },
            ]}
            value={method}
            onChange={setMethod}
          />
        </Field>
        <Field label="Amount received" error={tried ? error : undefined}>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} mono inputMode="decimal" leading={<span className="text-[13px]">$</span>} placeholder="0.00" invalid={tried && !!error} autoFocus />
        </Field>
        <div>
          <div className="mb-1.5 text-[12px] font-medium text-fg-2">Posting that will be created</div>
          <LedgerEntries
            showHeader={false}
            names={{ [a.id]: a.name }}
            tx={previewTx('top_up', 'Wallet top-up', [
              { account: `gateway_clearing:${method}`, direction: 'debit', amount: amt },
              { account: `customer_available:${a.id}`, direction: 'credit', amount: amt },
            ])}
          />
          <p className="mt-2 text-[11.5px] text-fg-3">A payment intent (PAY-…) is created and confirmed in one step; it appears under Payments & refunds and in Finance → Payments.</p>
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------ Manual adjustment ------------------------------ */
function AdjustModal({ open, onClose, d }: { open: boolean; onClose: () => void; d: AccountDetail }) {
  const a = d.account
  const [dir, setDir] = useState<'credit' | 'debit'>('credit')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [key, setKey] = useState(() => newIdempotencyKey('adj'))
  const [tried, setTried] = useState(false)
  // Start clean (with a fresh idempotency key) every time the modal opens — adjusted during render, not in an effect.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDir('credit')
      setAmount('')
      setReason('')
      setTried(false)
      setKey(newIdempotencyKey('adj'))
    }
  }
  const m = parseMoney(amount)
  const amt = m && m > 0 ? m : ZERO
  const exceeds = dir === 'debit' && amt > d.balance.spendable
  const errors = {
    amount: m == null ? 'Enter an amount like 5.00' : m <= 0 ? 'Enter a positive amount — pick credit or debit above' : exceeds ? `Debit exceeds spendable (${formatMoney(d.balance.spendable)})` : undefined,
    reason: reason.trim().length < 6 ? 'A clear reason is required (it is shown in the audit log and on the customer statement)' : undefined,
  }
  const mut = useInstMutation(() => accountsService.adjust(a.id, { amount: (dir === 'credit' ? amt : -amt) as Micros, reason: reason.trim(), idempotencyKey: key }), {
    success: (tx) => `${tx.ref} posted · ${dir === 'credit' ? 'credited' : 'debited'} ${formatMoney(amt)}`,
    onSuccess: onClose,
  })
  const lines =
    dir === 'credit'
      ? [
          { account: 'goodwill', direction: 'debit' as const, amount: amt },
          { account: `customer_available:${a.id}`, direction: 'credit' as const, amount: amt },
        ]
      : [
          { account: `customer_available:${a.id}`, direction: 'debit' as const, amount: amt },
          { account: 'goodwill', direction: 'credit' as const, amount: amt },
        ]
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<Scale />}
      title={`Manual adjustment · ${a.name}`}
      description="For goodwill credits and corrections only. Refunds of orders go through the order (capped at what was paid). Every adjustment is a balanced ledger posting plus a critical audit event."
      footer={
        <>
          <PermissionHint permission="ledger.adjust" className="mr-auto" />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={dir === 'debit' ? 'danger' : 'accent'}
            loading={mut.isPending}
            onClick={() => {
              setTried(true)
              if (!errors.amount && !errors.reason) mut.mutate()
            }}
          >
            Post {dir}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Segmented<'credit' | 'debit'>
          items={[
            { value: 'credit', label: 'Credit wallet', icon: <ArrowDownLeft /> },
            { value: 'debit', label: 'Debit wallet', icon: <ArrowUpRight /> },
          ]}
          value={dir}
          onChange={setDir}
        />
        <Field label="Amount" error={tried ? errors.amount : undefined} hint={`Current available ${formatMoney(d.balance.available)} · spendable ${formatMoney(d.balance.spendable)}`}>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} mono inputMode="decimal" leading={<span className="text-[13px]">$</span>} placeholder="0.00" invalid={tried && !!errors.amount} autoFocus />
        </Field>
        <Field label="Reason" error={tried ? errors.reason : undefined}>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={dir === 'credit' ? 'e.g. Goodwill for delayed unlock ORD-… (approved by Alex)' : 'e.g. Correction: duplicate bank credit on 12 Sep'} invalid={tried && !!errors.reason} />
        </Field>
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[12px] font-medium text-fg-2">Posting that will be created</span>
            <span className="inline-flex items-center gap-1.5">
              <Badge tone="neutral" variant="outline" className="font-mono" title="Retrying with the same key returns the original transaction — it can never post twice">
                {key}
              </Badge>
              <button type="button" className="grid size-6 place-items-center rounded-md text-fg-3 hover:bg-surface-2 hover:text-fg" title="New idempotency key" onClick={() => setKey(newIdempotencyKey('adj'))}>
                <RefreshCw className="size-3.5" />
              </button>
            </span>
          </div>
          <LedgerEntries showHeader={false} names={{ [a.id]: a.name }} tx={previewTx('adjustment', dir === 'credit' ? 'Goodwill credit' : 'Manual debit', lines)} />
          <p className={cn('mt-2 text-[11.5px]', exceeds ? 'text-danger' : 'text-fg-3')}>
            {exceeds ? 'The server refuses debits that would push available below the credit limit.' : 'Idempotency key: submitting twice (double click, retry) returns the same transaction instead of posting again.'}
          </p>
        </div>
      </div>
    </Modal>
  )
}
