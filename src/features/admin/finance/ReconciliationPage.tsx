import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { motion } from 'motion/react'
import { ArrowRightLeft, Banknote, ChevronRight, CircleCheck, RefreshCw, Scale, TriangleAlert } from 'lucide-react'
import { formatMoney, parseMoney, ZERO, type Micros } from '@/core/money'
import type { ReconciliationRow } from '@/types/installation'
import { suppliersService } from '@/services/installation'
import { useInstMutation, useReconciliation } from '@/hooks/installation'
import { Guarded, HealthBadge, LedgerEntries, Money, PermissionHint, ScenarioTag, SimulatedBadge } from '@/components/domain'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Skeleton } from '@/components/ui'
import { relative } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Explainer, LoadError } from './shared'
import { newIdempotencyKey, previewTx } from './helpers'

export default function ReconciliationPage() {
  const q = useReconciliation()
  const [params] = useSearchParams()
  const focus = params.get('supplier')
  const [topUp, setTopUp] = useState<ReconciliationRow | null>(null)
  const rows = q.data ?? []
  const drifting = rows.filter((r) => r.reconciliation.drift !== 0)
  const totalDrift = rows.reduce((a, r) => a + r.reconciliation.drift, 0) as Micros
  const totalExpected = rows.reduce((a, r) => a + r.reconciliation.expected, 0) as Micros
  const sorted = [...rows].sort((a, b) => (a.supplier.id === focus ? -1 : b.supplier.id === focus ? 1 : Math.abs(b.reconciliation.drift) - Math.abs(a.reconciliation.drift)))

  return (
    <div>
      <PageHeader
        icon={<Scale />}
        title="Supplier reconciliation"
        description="External reconciliation: what our ledger says each supplier should hold, versus the balance the supplier reports through its driver. It checks the suppliers — it does not replace the customer ledger."
      />

      <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card className="grid grid-cols-3 gap-px overflow-hidden bg-line">
          <Tile label="Suppliers" value={q.isLoading ? null : String(rows.length)} />
          <Tile label="Drifting" value={q.isLoading ? null : String(drifting.length)} tone={drifting.length ? 'warning' : 'success'} />
          <Tile label="Net drift" value={q.isLoading ? null : <Money value={totalDrift} sign tone="auto" />} sub={<>expected <Money value={totalExpected} compact /></>} />
        </Card>
        <Explainer icon={<ArrowRightLeft />} title="How it is computed">
          <span className="font-mono text-[12px]">Expected = Ledger (Supplier Prepaid) − In-flight</span>, where in-flight is the cost of orders the supplier accepted but we have not settled yet. <span className="font-mono text-[12px]">Drift = Actual − Expected</span>. A negative drift usually means the supplier charged an order whose outcome is still UNKNOWN to us.
        </Explainer>
      </div>

      {q.isError ? (
        <Card>
          <LoadError what="reconciliation" onRetry={() => q.refetch()} />
        </Card>
      ) : q.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Scale />} title="No suppliers connected" description="Connect a supplier to start reconciling its prepaid balance." action={<Button to="/admin/suppliers">Suppliers</Button>} />
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((r, i) => (
            <SupplierRecon key={r.supplier.id} r={r} focused={r.supplier.id === focus} i={i} onTopUp={() => setTopUp(r)} />
          ))}
        </div>
      )}

      <Explainer className="mt-5" title="Why this matters">
        Suppliers are paid in advance. If a supplier silently charges more than our records say (a timeout we treated as unknown, a manual charge, a missing refund), the difference is real money. Reconciling every few minutes surfaces it while the order is still fresh — and links it to the exact orders to review. Customer wallets are unaffected: they are governed by the ledger and the integrity checks.
      </Explainer>

      <TopUpModal row={topUp} onClose={() => setTopUp(null)} />
    </div>
  )
}

function Tile({ label, value, sub, tone }: { label: string; value: ReactNode | null; sub?: ReactNode; tone?: 'warning' | 'success' }) {
  return (
    <div className="bg-surface px-4 py-3.5">
      <div className="mono-label">{label}</div>
      {value == null ? <Skeleton className="mt-2 h-5 w-16" /> : <div className={cn('mt-1.5 font-mono text-[18px] leading-none font-semibold tabular', tone === 'warning' && 'text-warning', tone === 'success' && 'text-success')}>{value}</div>}
      {sub && <div className="mt-1.5 text-[11px] text-fg-3">{sub}</div>}
    </div>
  )
}

function SupplierRecon({ r, focused, i, onTopUp }: { r: ReconciliationRow; focused: boolean; i: number; onTopUp: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const d = r.reconciliation
  const [lastCheck, setLastCheck] = useState<string | null>(null)
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focused])
  const refresh = useInstMutation(() => suppliersService.balance(r.supplier.id), {
    onSuccess: (res) => setLastCheck(res.ok ? `Supplier reports ${formatMoney(res.balance)}` : res.message),
  })
  const drift = d.drift
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
      <Card className={cn('overflow-hidden', focused && 'ring-2 ring-accent/50', drift !== 0 && !focused && 'border-warning/40')}>
        <div className="flex flex-col gap-3 px-5 pt-4 pb-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/admin/suppliers/${r.supplier.id}`} className="text-[14.5px] font-semibold hover:text-accent-ink">
                {r.supplier.name}
              </Link>
              <HealthBadge health={r.health} />
              <Badge tone="neutral" variant="outline">
                {r.driver.name}
              </Badge>
              <SimulatedBadge />
            </div>
            <div className="mt-0.5 text-[12px] text-fg-3">Reported balance checked {relative(r.supplier.balanceCheckedAt)}{lastCheck ? ` · ${lastCheck}` : ''}</div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" leading={<RefreshCw className={cn(refresh.isPending && 'animate-spin')} />} loading={false} disabled={refresh.isPending} onClick={() => refresh.mutate()}>
              Refresh reported balance
            </Button>
            <Guarded permission="ledger.adjust">
              {(allowed) => (
                <Button size="sm" leading={<Banknote />} disabled={!allowed} onClick={onTopUp}>
                  Record supplier top-up
                </Button>
              )}
            </Guarded>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px border-y border-line bg-line sm:grid-cols-5">
          <Num label="Ledger balance" hint="Σ Supplier Prepaid" value={<Money value={d.ledger} />} />
          <Num label="In-flight" hint="accepted, unsettled" value={<Money value={d.inFlight ? (-d.inFlight as Micros) : ZERO} />} />
          <Num label="Expected" hint="ledger − in-flight" value={<Money value={d.expected} />} strong />
          <Num label="Actual" hint="supplier-reported" value={<Money value={d.actual} />} strong />
          <Num
            label="Drift"
            hint="actual − expected"
            value={
              <span className={cn('inline-flex items-center gap-1.5', drift === 0 ? 'text-success' : 'text-warning')}>
                {drift === 0 ? <CircleCheck className="size-4" /> : <TriangleAlert className="size-4" />}
                <Money value={drift} sign />
              </span>
            }
            strong
            className="col-span-2 sm:col-span-1"
          />
        </div>

        <div className="flex flex-col gap-3 px-5 py-3.5 lg:flex-row lg:items-start lg:justify-between">
          <p className={cn('max-w-3xl text-[12.5px] leading-relaxed', drift === 0 ? 'text-fg-3' : 'text-fg-2')}>{r.explanation}</p>
          {d.unknown.length > 0 && (
            <div className="shrink-0 lg:w-[320px]">
              <div className="mb-1.5 text-[11.5px] font-medium text-fg-3 uppercase">Orders with UNKNOWN outcome</div>
              <ul className="space-y-1">
                {d.unknown.map((u) => (
                  <li key={u.orderId}>
                    <Link to={`/admin/orders/${u.orderId}`} className="flex items-center justify-between gap-2 rounded-lg border border-danger/25 bg-danger/5 px-2.5 py-1.5 text-[12.5px] transition-colors hover:border-danger/50">
                      <span className="flex items-center gap-2">
                        <span className="font-mono font-medium">{u.orderRef}</span>
                        {r.supplier.id === 'sup_alpha' && <ScenarioTag id="C" />}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-fg-2 tabular">
                        <Money value={u.cost as Micros} /> <ChevronRight className="size-3.5 text-fg-3" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  )
}

function Num({ label, hint, value, strong, className }: { label: string; hint: string; value: ReactNode; strong?: boolean; className?: string }) {
  return (
    <div className={cn('bg-surface px-4 py-3', className)}>
      <div className="text-[11.5px] text-fg-3">{label}</div>
      <div className={cn('mt-1 font-mono text-[15px] tabular', strong ? 'font-semibold' : 'text-fg-2')}>{value}</div>
      <div className="mt-0.5 text-[10.5px] text-fg-3">{hint}</div>
    </div>
  )
}

function TopUpModal({ row, onClose }: { row: ReconciliationRow | null; onClose: () => void }) {
  const [amount, setAmount] = useState('')
  const [key, setKey] = useState(() => newIdempotencyKey('stu'))
  const [tried, setTried] = useState(false)
  // Start clean (with a fresh idempotency key) for each supplier row opened — adjusted during render, not in an effect.
  const [openedRow, setOpenedRow] = useState(row)
  if (row !== openedRow) {
    setOpenedRow(row)
    if (row) {
      setAmount('')
      setTried(false)
      setKey(newIdempotencyKey('stu'))
    }
  }
  const m = parseMoney(amount)
  const error = m == null ? 'Enter an amount like 500.00' : m <= 0 ? 'Amount must be positive' : undefined
  const mut = useInstMutation(() => suppliersService.topUp(row!.supplier.id, { amount: m!, idempotencyKey: key }), { success: (tx) => `${tx.ref} posted · supplier prepaid +${formatMoney(m)}`, onSuccess: onClose })
  const amt = m && m > 0 ? m : ZERO
  return (
    <Modal
      open={!!row}
      onClose={onClose}
      icon={<Banknote />}
      title={row ? `Record top-up · ${row.supplier.name}` : ''}
      description="Record a prepayment you sent to the supplier (bank transfer from your account). The supplier’s actual balance updates when it reports it — refresh afterwards."
      footer={
        <>
          <PermissionHint permission="ledger.adjust" className="mr-auto" />
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
            Post top-up
          </Button>
        </>
      }
    >
      {row && (
        <div className="space-y-4">
          <Field label="Amount sent" error={tried ? error : undefined}>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} mono inputMode="decimal" leading={<span className="text-[13px]">$</span>} placeholder="0.00" invalid={tried && !!error} autoFocus />
          </Field>
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2 text-[12px]">
              <span className="font-medium text-fg-2">Posting that will be created</span>
              <span className="font-mono text-[11px] text-fg-3" title="Idempotency key — retries can never post twice">
                {key}
              </span>
            </div>
            <LedgerEntries
              showHeader={false}
              names={{ [row.supplier.id]: row.supplier.name }}
              tx={previewTx('supplier_top_up', 'Supplier prepaid top-up', [
                { account: `supplier_prepaid:${row.supplier.id}`, direction: 'debit', amount: amt },
                { account: 'bank', direction: 'credit', amount: amt },
              ])}
            />
          </div>
        </div>
      )}
    </Modal>
  )
}
