import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, ArrowUpRight, Eraser, FlaskConical, KeyRound, Minus, Play, Plus, Wand2, Wrench } from 'lucide-react'
import { Badge, Button, Card, CardHeader, Input, Select, Switch } from '@/components/ui'
import { Guarded, HealthBadge, Money, OrderStatusBadge } from '@/components/domain'
import { useInstMutation, useOrder } from '@/hooks/installation'
import { demoService, ordersService } from '@/services/installation'
import { usd } from '@/core/money'
import { relative } from '@/lib/format'
import type { DemoState, OrderRow } from '@/types/installation'

const TEST_ORDER = { accountId: 'acc_abcgsm', serviceId: 'svc_4001', imei: '356938035643809' }

const newKey = () => `demo-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`

/* ------------------------------------------------------------------ */
/*  Behaviour simulator + recipes + test order                         */
/* ------------------------------------------------------------------ */
export function BehaviourSimulator({ state }: { state: DemoState }) {
  const [supplierId, setSupplierId] = useState(state.suppliers[0]?.id ?? 'sup_alpha')
  const [behaviour, setBehaviour] = useState('timeout')
  const [mode, setMode] = useState<'count' | 'until'>('count')
  const [count, setCount] = useState('1')
  const [placed, setPlaced] = useState<OrderRow | null>(null)
  const name = (id: string) => state.suppliers.find((s) => s.id === id)?.name ?? id
  const label = (id: string) => state.behaviours.find((b) => b.id === id)?.label ?? id

  const apply = useInstMutation((v: { supplierId: string; behaviour: string; remaining: number | null }) => demoService.supplierBehaviour(v), {
    success: (_, v) => `${name(v.supplierId)} → ${label(v.behaviour)}${v.remaining == null ? ' (until cleared)' : ` (next ${v.remaining})`}`,
  })
  const recipe = useInstMutation(
    async (steps: { supplierId: string; behaviour: string; remaining: number | null }[]) => {
      let s: DemoState | null = null
      for (const step of steps) s = await demoService.supplierBehaviour(step)
      return s
    },
    { success: 'Recipe armed — place a test order to see it' },
  )
  const clear = useInstMutation(() => demoService.clearBehaviours(), { success: 'All behaviour rules cleared — suppliers back to realistic' })
  const place = useInstMutation(() => ordersService.create({ accountId: TEST_ORDER.accountId, serviceId: TEST_ORDER.serviceId, input: { imei: TEST_ORDER.imei }, idempotencyKey: newKey(), clientReference: 'demo-control-center' }), {
    success: (o) => `Placed ${o.ref} for ABC GSM`,
    onSuccess: (o) => setPlaced(o),
  })
  const selected = state.behaviours.find((b) => b.id === behaviour)

  return (
    <Card id="suppliers" className="scroll-mt-20">
      <CardHeader icon={<FlaskConical />} title="Supplier behaviour simulator" description="Force what a simulated supplier answers to the next attempts. Routing, failover guards and Needs Review react exactly as they would to a real supplier." />
      <div className="grid gap-5 px-5 pb-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mono-label">Supplier</span>
              <Select className="mt-1.5" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} options={state.suppliers.map((s) => ({ value: s.id, label: s.name }))} />
            </label>
            <label className="block">
              <span className="mono-label">Behaviour</span>
              <Select className="mt-1.5" value={behaviour} onChange={(e) => setBehaviour(e.target.value)} options={state.behaviours.map((b) => ({ value: b.id, label: b.label }))} />
            </label>
          </div>
          {selected && <p className="rounded-lg bg-surface-2/70 px-3 py-2 text-[12.5px] text-fg-2">{selected.effect}</p>}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-1 rounded-lg border border-line p-0.5">
              {(['count', 'until'] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)} className={`h-7 rounded-md px-2.5 text-[12.5px] ${mode === m ? 'bg-surface-3 font-medium text-fg' : 'text-fg-3 hover:text-fg'}`}>
                  {m === 'count' ? 'Next N attempts' : 'Until cleared'}
                </button>
              ))}
            </div>
            {mode === 'count' && <Input inputSize="sm" type="number" min={1} max={50} value={count} onChange={(e) => setCount(e.target.value)} className="w-20" aria-label="Number of attempts" />}
            <Button size="sm" variant="primary" leading={<Wand2 />} loading={apply.isPending} onClick={() => apply.mutate({ supplierId, behaviour, remaining: behaviour === 'auto' ? null : mode === 'until' ? null : Math.max(1, Number.parseInt(count, 10) || 1) })}>
              Apply
            </Button>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="mono-label">Active rules</span>
              <Button size="xs" variant="ghost" leading={<Eraser />} disabled={!state.rules.length} loading={clear.isPending} onClick={() => clear.mutate()}>
                Clear all
              </Button>
            </div>
            {state.rules.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line-strong px-3 py-3 text-[12.5px] text-fg-3">No rules — every supplier answers according to its health profile (realistic).</p>
            ) : (
              <ul className="space-y-1.5">
                {state.rules.map((r, i) => (
                  <li key={`${r.supplierId}-${r.orderRef ?? ''}-${i}`} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px]">
                    <span className="min-w-0 truncate">
                      <span className="font-medium text-fg">{name(r.supplierId)}</span> <ArrowRight className="inline size-3 text-fg-3" /> {label(r.behaviour)}
                      {r.orderRef && <span className="font-mono text-fg-3"> · only {r.orderRef}</span>}
                    </span>
                    <span className="shrink-0 font-mono text-[11.5px] text-fg-3">
                      {r.remaining == null ? 'until cleared' : `${r.remaining} left`} · {relative(r.setAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <span className="mono-label">One-click recipes</span>
          <RecipeButton
            title="Alpha → Timeout (next order)"
            detail="Alpha receives the request and never answers. Outcome UNKNOWN → failover blocked → order goes to Needs Review; the hold stays."
            loading={recipe.isPending}
            onClick={() => recipe.mutate([{ supplierId: 'sup_alpha', behaviour: 'timeout', remaining: 1 }])}
          />
          <RecipeButton
            title="Alpha rejects (failover-safe) → Beta succeeds"
            detail="Alpha answers with a definitive, failover-safe rejection; guarded failover routes to Beta under the margin guard and the order completes."
            loading={recipe.isPending}
            onClick={() =>
              recipe.mutate([
                { supplierId: 'sup_alpha', behaviour: 'rejected_safe', remaining: 1 },
                { supplierId: 'sup_beta', behaviour: 'success', remaining: 1 },
              ])
            }
          />
          <div className="rounded-xl border border-accent/35 bg-accent/[0.04] p-4">
            <p className="text-[13px] font-semibold text-fg">Place a test order now</p>
            <p className="mt-0.5 text-[12px] text-fg-3">
              ABC GSM (Gold) · iPhone 15 Carrier Check (Alpha → Beta) · IMEI <span className="font-mono">{TEST_ORDER.imei}</span> · fresh idempotency key · paid from wallet hold.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Guarded permission="orders.manage">
                {(allowed) => (
                  <Button variant="accent" size="sm" leading={<Play />} disabled={!allowed} loading={place.isPending} onClick={() => place.mutate()}>
                    Place test order
                  </Button>
                )}
              </Guarded>
              {placed && <PlacedOrder order={placed} />}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

function RecipeButton({ title, detail, onClick, loading }: { title: string; detail: string; onClick: () => void; loading: boolean }) {
  return (
    <button type="button" disabled={loading} onClick={onClick} className="group flex w-full items-start gap-3 rounded-xl border border-line bg-surface p-3.5 text-left transition-colors hover:border-line-strong hover:bg-surface-2 disabled:opacity-60">
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent-ink">
        <Wand2 className="size-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-fg">{title}</span>
        <span className="mt-0.5 block text-[12px] text-fg-3">{detail}</span>
      </span>
    </button>
  )
}

function PlacedOrder({ order }: { order: OrderRow }) {
  const live = useOrder(order.id)
  const status = live.data?.order.status ?? order.status
  return (
    <Link to={`/admin/orders/${order.id}`} className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1 text-[12.5px] hover:border-line-strong">
      <span className="font-mono text-fg">{order.ref}</span>
      <OrderStatusBadge status={status} />
      <span className="text-accent-ink">Watch</span>
      <ArrowUpRight className="size-3.5 text-accent-ink" />
    </Link>
  )
}

/* ------------------------------------------------------------------ */
/*  Supplier remote state                                              */
/* ------------------------------------------------------------------ */
export function SupplierStateCard({ state }: { state: DemoState }) {
  const m = useInstMutation((v: { supplierId: string; credentialsValid?: boolean; maintenance?: boolean; balanceDelta?: number }) => demoService.supplierState({ ...v, balanceDelta: v.balanceDelta == null ? undefined : usd(v.balanceDelta) }), { success: 'Supplier state changed' })
  return (
    <Card>
      <CardHeader icon={<Wrench />} title="Supplier state" description="The simulated supplier’s side: its credentials, maintenance window and the balance it reports. Core notices on the next call or balance check." />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[12.5px]">
          <thead>
            <tr className="text-left text-[11.5px] text-fg-3">
              <th className="border-b border-line px-5 py-2 font-medium">Supplier</th>
              <th className="border-b border-line px-3 py-2 font-medium">Health (Core view)</th>
              <th className="border-b border-line px-3 py-2 font-medium">
                <KeyRound className="mr-1 inline size-3" />
                Credentials valid
              </th>
              <th className="border-b border-line px-3 py-2 font-medium">Maintenance</th>
              <th className="border-b border-line px-5 py-2 text-right font-medium">Remote balance</th>
            </tr>
          </thead>
          <tbody>
            {state.suppliers.map((s) => (
              <tr key={s.id} className="hover:bg-surface-2/60">
                <td className="border-b border-line px-5 py-2">
                  <Link to={`/admin/suppliers/${s.id}`} className="text-fg hover:underline">
                    {s.name}
                  </Link>
                </td>
                <td className="border-b border-line px-3 py-2">
                  <HealthBadge health={s.health} />
                </td>
                <td className="border-b border-line px-3 py-2">
                  <Switch size="sm" checked={s.credentialsValid} disabled={m.isPending} onChange={(v) => m.mutate({ supplierId: s.id, credentialsValid: v })} label={`Credentials valid for ${s.name}`} />
                </td>
                <td className="border-b border-line px-3 py-2">
                  <Switch size="sm" checked={s.maintenance} disabled={m.isPending} onChange={(v) => m.mutate({ supplierId: s.id, maintenance: v })} label={`Maintenance for ${s.name}`} />
                </td>
                <td className="border-b border-line px-5 py-2">
                  <div className="flex items-center justify-end gap-1.5">
                    <Money value={s.remoteBalance} className="mr-1 font-mono tabular" />
                    <Button size="xs" variant="secondary" icon aria-label="Decrease balance by $100" disabled={m.isPending} onClick={() => m.mutate({ supplierId: s.id, balanceDelta: -100 })}>
                      <Minus />
                    </Button>
                    <Button size="xs" variant="secondary" icon aria-label="Increase balance by $100" disabled={m.isPending} onClick={() => m.mutate({ supplierId: s.id, balanceDelta: 100 })}>
                      <Plus />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-5 py-3 text-[12px] text-fg-3">
        ± adjusts by <Badge tone="neutral" variant="outline">$100</Badge>. Lowering a balance below its threshold shows the low-balance alert; invalid credentials make attempts fail as “not accepted” (failover-safe).
      </p>
    </Card>
  )
}
