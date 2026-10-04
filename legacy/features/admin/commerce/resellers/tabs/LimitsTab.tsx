import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Gauge, Layers, ReceiptText, Wallet } from 'lucide-react'
import { useApiLogs, useInstMutation, useOrders, useResellerUsage } from '@/hooks/installation'
import { resellersService } from '@/services/installation'
import type { OrderStatus, Reseller } from '@/types/installation'
import { Button, Card, CardFooter, CardHeader, Field, Input, Meter, Progress } from '@/components/ui'
import { cn } from '@/lib/cn'
import { money } from '@/lib/format'

interface Form {
  ratePerMinute: string
  dailyOrders: string
  maxConcurrent: string
  creditLimit: string
}

const fromReseller = (r: Reseller): Form => ({ ratePerMinute: String(r.limits.ratePerMinute), dailyOrders: String(r.limits.dailyOrders), maxConcurrent: String(r.limits.maxConcurrent), creditLimit: String(r.creditLimit) })

export function LimitsTab({ reseller }: { reseller: Reseller }) {
  const storedKey = JSON.stringify(fromReseller(reseller))
  const [form, setForm] = useState<Form>(() => fromReseller(reseller))
  useEffect(() => setForm(JSON.parse(storedKey) as Form), [storedKey])

  const usage = useResellerUsage(reseller.id)
  const logs = useApiLogs({ clientId: reseller.id, pageSize: 200 })
  const inflight = useOrders({ resellerId: reseller.id, status: 'in_flight' as OrderStatus, pageSize: 1 })

  const live = useMemo(() => {
    const items = logs.data?.items ?? []
    const now = Date.now()
    const buckets = new Map<number, number>()
    let lastMinute = 0
    for (const l of items) {
      const t = new Date(l.at).getTime()
      if (now - t <= 60_000) lastMinute++
      const m = Math.floor(t / 60_000)
      buckets.set(m, (buckets.get(m) ?? 0) + 1)
    }
    return { lastMinute, peak: Math.max(0, ...buckets.values()) }
  }, [logs.data])

  const today = usage.data?.daily.at(-1)?.orders ?? 0
  const concurrent = inflight.data?.total ?? 0
  const creditUsed = Math.max(0, -reseller.balance)

  const n = (k: keyof Form) => Number(form[k])
  const errors: Partial<Record<keyof Form, string>> = {}
  if (!Number.isInteger(n('ratePerMinute')) || n('ratePerMinute') < 1 || n('ratePerMinute') > 10000) errors.ratePerMinute = '1 – 10,000'
  if (!Number.isInteger(n('dailyOrders')) || n('dailyOrders') < 1) errors.dailyOrders = 'At least 1'
  if (!Number.isInteger(n('maxConcurrent')) || n('maxConcurrent') < 1 || n('maxConcurrent') > 1000) errors.maxConcurrent = '1 – 1,000'
  if (form.creditLimit === '' || Number.isNaN(n('creditLimit')) || n('creditLimit') < 0) errors.creditLimit = 'Must be 0 or more'
  else if (n('creditLimit') < creditUsed) errors.creditLimit = `Cannot be lower than credit in use (${money(creditUsed)})`
  const invalid = Object.keys(errors).length > 0
  const dirty = JSON.stringify(form) !== storedKey

  const save = useInstMutation((body: Partial<Reseller>) => resellersService.update(reseller.id, body), { success: 'Limits updated' })
  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = () => {
    if (invalid || !dirty) return
    save.mutate({ limits: { ratePerMinute: n('ratePerMinute'), dailyOrders: n('dailyOrders'), maxConcurrent: n('maxConcurrent') }, creditLimit: n('creditLimit') })
  }

  return (
    <Card>
      <CardHeader icon={<Gauge />} title="Limits & credit" description="Enforced by the API gateway per reseller across all of its keys — protects your supplier quotas from bulk IMEI bursts. Exceeding a limit returns 429 with a Retry-After header." />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="divide-y divide-line border-t border-line"
      >
        <LimitRow
          icon={<Gauge />}
          title="Rate limit"
          description="Requests per minute, sliding window."
          field={
            <Field error={errors.ratePerMinute}>
              <Input type="number" min={1} value={form.ratePerMinute} onChange={(e) => set('ratePerMinute', e.target.value)} trailing={<span className="text-[12px]">/ min</span>} invalid={!!errors.ratePerMinute} />
            </Field>
          }
          meter={<Meter label={`Peak minute · 24h (now ${live.lastMinute})`} value={live.peak} max={n('ratePerMinute') || null} />}
        />
        <LimitRow
          icon={<ReceiptText />}
          title="Daily orders"
          description="IMEI checks, unlocks and codes created per calendar day (installation timezone)."
          field={
            <Field error={errors.dailyOrders}>
              <Input type="number" min={1} value={form.dailyOrders} onChange={(e) => set('dailyOrders', e.target.value)} trailing={<span className="text-[12px]">/ day</span>} invalid={!!errors.dailyOrders} />
            </Field>
          }
          meter={<Meter label="Orders today" value={today} max={n('dailyOrders') || null} />}
        />
        <LimitRow
          icon={<Layers />}
          title="Max concurrent"
          description="Orders in progress at once — e.g. unlocks still waiting on a supplier."
          field={
            <Field error={errors.maxConcurrent}>
              <Input type="number" min={1} value={form.maxConcurrent} onChange={(e) => set('maxConcurrent', e.target.value)} trailing={<span className="text-[12px]">orders</span>} invalid={!!errors.maxConcurrent} />
            </Field>
          }
          meter={<Meter label="In progress now" value={concurrent} max={n('maxConcurrent') || null} />}
        />
        <LimitRow
          icon={<Wallet />}
          title="Credit limit"
          description="How far the balance may go negative before orders are rejected with 402."
          field={
            <Field error={errors.creditLimit}>
              <Input type="number" min={0} step="50" value={form.creditLimit} onChange={(e) => set('creditLimit', e.target.value)} leading={<span className="text-[13px]">$</span>} invalid={!!errors.creditLimit} />
            </Field>
          }
          meter={
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between text-[12.5px]">
                <span className="text-fg-2">Credit in use</span>
                <span className="text-fg tabular">
                  {money(creditUsed)}
                  <span className="text-fg-3"> / {n('creditLimit') ? money(n('creditLimit')) : 'No credit'}</span>
                </span>
              </div>
              <Progress value={creditUsed} max={n('creditLimit') || 1} size="sm" tone={creditUsed > n('creditLimit') * 0.75 ? 'warning' : 'accent'} />
              <p className="text-[11.5px] text-fg-3 tabular">
                Available to spend: <span className={cn(reseller.balance + n('creditLimit') < 100 ? 'text-warning' : 'text-fg-2')}>{money(Math.max(0, reseller.balance + (n('creditLimit') || 0)))}</span>
              </p>
            </div>
          }
        />
        <button type="submit" className="hidden" />
      </form>
      <CardFooter>
        <span>{dirty ? <span className="text-warning">Unsaved changes</span> : `Default for new resellers: 120/min · 500/day · 10 concurrent`}</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" disabled={!dirty} onClick={() => setForm(JSON.parse(storedKey) as Form)}>
            Discard
          </Button>
          <Button size="sm" variant="primary" disabled={!dirty || invalid} loading={save.isPending} onClick={submit}>
            Save limits
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}

function LimitRow({ icon, title, description, field, meter }: { icon: ReactNode; title: string; description: string; field: ReactNode; meter: ReactNode }) {
  return (
    <div className="grid gap-4 px-5 py-4 md:grid-cols-[minmax(0,1.2fr)_180px_minmax(0,1fr)] md:items-center md:gap-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-fg-3 [&_svg]:size-4">{icon}</span>
        <div>
          <p className="text-[13.5px] font-medium text-fg">{title}</p>
          <p className="text-[12.5px] text-fg-3">{description}</p>
        </div>
      </div>
      <div>{field}</div>
      <div>{meter}</div>
    </div>
  )
}
