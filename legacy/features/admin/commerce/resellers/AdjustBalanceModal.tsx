import { useEffect, useState } from 'react'
import { ArrowRight, Minus, Plus, Wallet } from 'lucide-react'
import { useInstMutation } from '@/hooks/installation'
import { resellersService } from '@/services/installation'
import type { Reseller } from '@/types/installation'
import { Button, Field, Input, Modal, Segmented, Textarea } from '@/components/ui'
import { cn } from '@/lib/cn'
import { money } from '@/lib/format'

type Kind = 'top_up' | 'deduction'

const QUICK = [100, 250, 500, 1000, 2500]

export function AdjustBalanceModal({ reseller, open, onClose }: { reseller: Reseller; open: boolean; onClose: () => void }) {
  const [kind, setKind] = useState<Kind>('top_up')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (open) {
      setKind('top_up')
      setAmount('')
      setNote('')
      setSubmitted(false)
    }
  }, [open])

  const value = Number(amount)
  const signed = kind === 'top_up' ? value : -value
  const next = +(reseller.balance + (Number.isFinite(signed) ? signed : 0)).toFixed(2)
  const floor = -reseller.creditLimit
  const error = !amount || !Number.isFinite(value) || value <= 0 ? 'Enter an amount greater than 0' : value > 100000 ? 'Maximum single adjustment is $100,000' : kind === 'deduction' && next < floor ? `Exceeds available funds (${money(reseller.balance + reseller.creditLimit)} incl. credit)` : undefined
  const noteError = kind === 'deduction' && !note.trim() ? 'A reason is required for deductions (shown in the ledger and audit log)' : undefined

  const adjust = useInstMutation((body: { amount: number; note?: string; kind?: 'top_up' | 'adjustment' }) => resellersService.adjustBalance(reseller.id, body), {
    success: (r) => `Balance updated · ${money(r.balance)}`,
    onSuccess: onClose,
  })

  const submit = () => {
    setSubmitted(true)
    if (error || noteError) return
    adjust.mutate({ amount: signed, note: note.trim() || undefined, kind: kind === 'top_up' ? 'top_up' : 'adjustment' })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<Wallet />}
      title="Adjust balance"
      description={`${reseller.name} · recorded in the transaction ledger and audit log`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={kind === 'deduction' ? 'danger' : 'accent'} onClick={submit} loading={adjust.isPending}>
            {kind === 'top_up' ? 'Add funds' : 'Deduct funds'}
            {value > 0 && !error ? ` · ${money(value)}` : ''}
          </Button>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Segmented<Kind>
          value={kind}
          onChange={setKind}
          size="md"
          className="flex w-full [&>button]:flex-1 [&>button]:justify-center"
          items={[
            { value: 'top_up', label: 'Top-up', icon: <Plus /> },
            { value: 'deduction', label: 'Deduction', icon: <Minus /> },
          ]}
        />

        <Field label="Amount" error={submitted ? error : undefined}>
          <Input autoFocus inputSize="lg" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} leading={<span className="text-[15px]">$</span>} placeholder="0.00" invalid={submitted && !!error} className="tabular" />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {QUICK.map((q) => (
              <button key={q} type="button" onClick={() => setAmount(String(q))} className={cn('h-6 rounded-md border px-2 text-[12px] tabular transition-colors', value === q ? 'border-accent/40 bg-accent/10 text-accent-ink' : 'border-line text-fg-2 hover:border-line-strong hover:text-fg')}>
                {money(q).replace('.00', '')}
              </button>
            ))}
          </div>
        </Field>

        <Field label={kind === 'deduction' ? 'Reason' : 'Note'} optional={kind === 'top_up'} error={submitted ? noteError : undefined}>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === 'top_up' ? 'Bank transfer ref. 2026-10-0142' : 'Correction for duplicate top-up on 28 Sep'} invalid={submitted && !!noteError} />
        </Field>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-line bg-surface-2/50 p-4">
          <div>
            <div className="mono-label">Current</div>
            <div className={cn('mt-1.5 font-display text-[20px] font-semibold tracking-[-0.02em] tabular', reseller.balance < 0 ? 'text-danger' : 'text-fg')}>{money(reseller.balance)}</div>
          </div>
          <ArrowRight className="size-4 text-fg-3" />
          <div className="text-right">
            <div className="mono-label">After</div>
            <div className={cn('mt-1.5 font-display text-[20px] font-semibold tracking-[-0.02em] tabular transition-colors', next < floor ? 'text-danger' : next < 0 ? 'text-warning' : next > reseller.balance ? 'text-success' : 'text-fg')}>{money(next)}</div>
          </div>
          <div className="col-span-3 border-t border-line pt-2.5 text-[12px] text-fg-3">
            Credit limit {money(reseller.creditLimit)} · available after adjustment <span className="text-fg-2 tabular">{money(Math.max(0, next + reseller.creditLimit))}</span>
          </div>
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}
