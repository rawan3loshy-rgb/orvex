import { useMemo, useState, type ReactNode } from 'react'
import { Gauge, Layers, Pencil, Radio, ShieldAlert, UserRound } from 'lucide-react'
import { formatMoney, parseMoney, type Micros } from '@/core/money'
import type { Account, AccountChannels, AccountDetail, AccountLimits, ServiceAccess } from '@/types/installation'
import { accountsService } from '@/services/installation'
import { useCategories, useInstMutation, usePricing } from '@/hooks/installation'
import { CHANNEL_META, Guarded, Money, PermissionHint, useCan } from '@/components/domain'
import { Badge, Button, Card, CardBody, CardHeader, Checkbox, DescriptionList, Field, Input, Modal, Segmented, Select, Switch, Textarea } from '@/components/ui'
import { date, relative } from '@/lib/format'
import { cn } from '@/lib/cn'
import { PricingTierChip } from '../shared'
import { moneyInput, tierColor } from '../helpers'

const CHANNEL_KEYS: (keyof AccountChannels)[] = ['storefront', 'portal', 'api', 'dhru']

function tierAdvice(a: Account): string {
  if (a.kind === 'guest') return 'Guest accounts come from storefront checkout: no login, no members and no API. Each payment funds this wallet, then the order holds it — the same pipeline as every other account.'
  switch (a.tier) {
    case 'retail':
      return 'Retail customers usually order on the storefront and pay per order; API and DHRU access are normally off.'
    case 'reseller':
      return 'Resellers typically use the portal for manual and bulk orders, the native API for integrations and the DHRU-compatible endpoint for legacy POS systems.'
    case 'business':
      return 'Business accounts usually order through the portal with several members (orderers, finance). API access is optional.'
    case 'api_only':
      return 'API-only integrations talk to the native API v1. Storefront and portal are usually off.'
  }
}

export function OverviewTab({ d }: { d: AccountDetail }) {
  const a = d.account
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader icon={<UserRound />} title="Profile" description={a.kind === 'guest' ? 'Captured at guest checkout' : 'Contact and business details'} />
          <CardBody>
            <DescriptionList
              items={[
                { label: 'Contact', value: a.contactName || '—' },
                { label: 'Email', value: a.email, mono: true },
                { label: 'Phone', value: a.phone ?? '—', mono: !!a.phone },
                { label: 'Company', value: a.company ?? '—' },
                { label: 'Website', value: a.website ?? '—' },
                { label: 'Country', value: a.country },
                { label: 'Account number', value: a.number, mono: true },
                { label: 'Account id', value: a.id, mono: true },
                { label: 'Created', value: date(a.createdAt) },
                { label: 'Last active', value: relative(a.lastActiveAt) },
              ]}
            />
            {a.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {a.tags.map((t) => (
                  <Badge key={t} tone="neutral">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
            {a.notes && <div className="mt-3 rounded-lg border border-line bg-surface-2/50 px-3 py-2.5 text-[12.5px] leading-relaxed text-fg-2">{a.notes}</div>}
          </CardBody>
        </Card>
        <ServiceAccessCard a={a} />
      </div>

      <div className="space-y-4">
        <CommercialCard d={d} />
        <ChannelsCard a={a} />
        <LimitsCard a={a} />
      </div>
    </div>
  )
}

/* ------------------------------ Commercial terms ------------------------------ */
function CommercialCard({ d }: { d: AccountDetail }) {
  const a = d.account
  const pricing = usePricing()
  const [open, setOpen] = useState(false)
  return (
    <Card>
      <CardHeader
        icon={<ShieldAlert />}
        title="Commercial terms"
        description="Sensitive — changes require a reason and are audited"
        actions={
          <Guarded permission="accounts.manage">
            {(allowed) => (
              <Button size="sm" leading={<Pencil />} disabled={!allowed} onClick={() => setOpen(true)}>
                Change
              </Button>
            )}
          </Guarded>
        }
      />
      <CardBody>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-line px-3.5 py-3">
            <div className="mono-label">Pricing tier</div>
            <div className="mt-2">
              <PricingTierChip name={d.tierName} color={tierColor(pricing.data?.tiers, a.pricingTierId)} className="text-[14px] font-semibold text-fg" />
            </div>
            <div className="mt-1.5 text-[11.5px] text-fg-3">{pricing.data?.tiers.find((t) => t.id === a.pricingTierId)?.description ?? 'Prices resolve live from this tier’s rules.'}</div>
          </div>
          <div className="rounded-lg border border-line px-3.5 py-3">
            <div className="mono-label">Credit limit</div>
            <div className="mt-2 font-mono text-[15px] font-semibold tabular">
              <Money value={a.creditLimit} />
            </div>
            <div className="mt-1.5 text-[11.5px] text-fg-3">{a.creditLimit ? 'Post-paid: available may go negative to this amount.' : 'Prepaid only.'}</div>
          </div>
        </div>
        <p className="mt-3 text-[11.5px] text-fg-3">{tierAdvice(a)}</p>
      </CardBody>
      <CommercialModal open={open} onClose={() => setOpen(false)} d={d} />
    </Card>
  )
}

function CommercialModal({ open, onClose, d }: { open: boolean; onClose: () => void; d: AccountDetail }) {
  const a = d.account
  const pricing = usePricing()
  const tiers = useMemo(() => [...(pricing.data?.tiers ?? [])].sort((x, y) => x.sort - y.sort), [pricing.data])
  const [tierId, setTierId] = useState(a.pricingTierId)
  const [credit, setCredit] = useState(() => moneyInput(a.creditLimit))
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)

  // Re-seed the form from the account whenever the modal opens (adjusted during render, not in an effect).
  const [seededFor, setSeededFor] = useState({ open, pricingTierId: a.pricingTierId, creditLimit: a.creditLimit })
  if (seededFor.open !== open || seededFor.pricingTierId !== a.pricingTierId || seededFor.creditLimit !== a.creditLimit) {
    setSeededFor({ open, pricingTierId: a.pricingTierId, creditLimit: a.creditLimit })
    if (open) {
      setTierId(a.pricingTierId)
      setCredit(moneyInput(a.creditLimit))
      setReason('')
      setTried(false)
    }
  }

  const creditM = parseMoney(credit)
  const patch: Partial<Account> = {}
  if (tierId !== a.pricingTierId) patch.pricingTierId = tierId
  if (creditM != null && creditM !== a.creditLimit) patch.creditLimit = creditM
  const changed = Object.keys(patch).length > 0
  const errors = {
    credit: creditM == null ? 'Enter an amount like 250.00' : creditM < 0 ? 'Cannot be negative' : undefined,
    reason: reason.trim().length < 4 ? 'A reason is required for pricing and credit changes' : undefined,
  }
  const m = useInstMutation(() => accountsService.update(a.id, patch, reason.trim()), { success: 'Commercial terms updated', onSuccess: onClose })
  const newSpendable = creditM != null ? ((d.balance.available + creditM) as Micros) : null

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<ShieldAlert />}
      title="Change commercial terms"
      description={`${a.name} · ${a.number}. Both fields are sensitive: the change, the old and new values and your reason go to the audit log.`}
      footer={
        <>
          <PermissionHint permission="accounts.manage" className="mr-auto" />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="accent"
            disabled={!changed}
            loading={m.isPending}
            onClick={() => {
              setTried(true)
              if (!errors.credit && !errors.reason && changed) m.mutate()
            }}
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pricing tier" hint={tierId !== a.pricingTierId ? 'New orders are quoted with the new tier. Placed orders keep their snapshot price.' : 'Current tier'}>
            <Select value={tierId} onChange={(e) => setTierId(e.target.value)} options={tiers.map((t) => ({ value: t.id, label: t.name }))} />
          </Field>
          <Field label="Credit limit" error={tried ? errors.credit : undefined} hint={newSpendable != null ? `Spendable would be ${formatMoney(newSpendable)}` : undefined}>
            <Input value={credit} onChange={(e) => setCredit(e.target.value)} mono inputMode="decimal" leading={<span className="text-[13px]">$</span>} invalid={tried && !!errors.credit} />
          </Field>
        </div>
        <Field label="Reason" error={tried ? errors.reason : undefined}>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Volume above $5k/month for 3 months — promoted to Gold (approved by Alex)" invalid={tried && !!errors.reason} />
        </Field>
      </div>
    </Modal>
  )
}

/* ------------------------------ Channels ------------------------------ */
export function ChannelsCard({ a }: { a: Account }) {
  const can = useCan('accounts.manage')
  const m = useInstMutation((ch: AccountChannels) => accountsService.update(a.id, { channels: ch }, 'Channel access changed'), { success: 'Channels updated' })
  const guest = a.kind === 'guest'
  return (
    <Card>
      <CardHeader icon={<Radio />} title="Channels" description="Every channel enters the same PlaceOrder command and wallet" actions={<PermissionHint permission="accounts.manage" />} />
      <CardBody className="space-y-1">
        {CHANNEL_KEYS.map((k) => {
          const meta = CHANNEL_META[k]
          const Icon = meta.icon
          const disabledForGuest = guest && k !== 'storefront'
          return (
            <div key={k} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-surface-2/60">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-md border border-line bg-surface-2 text-fg-2">
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium">{meta.label}</div>
                  <div className="truncate text-[11.5px] text-fg-3">{disabledForGuest ? 'Not available for guest accounts' : meta.hint}</div>
                </div>
              </div>
              <Switch checked={a.channels[k]} disabled={!can || m.isPending || disabledForGuest} label={`${meta.label} channel`} onChange={(v) => m.mutate({ ...a.channels, [k]: v })} />
            </div>
          )
        })}
      </CardBody>
    </Card>
  )
}

/* ------------------------------ Service access ------------------------------ */
export function ServiceAccessCard({ a }: { a: Account }) {
  const cats = useCategories()
  const [open, setOpen] = useState(false)
  const names = new Map((cats.data ?? []).map((c) => [c.id, c.name]))
  const sa = a.serviceAccess
  return (
    <Card>
      <CardHeader
        icon={<Layers />}
        title="Service access"
        description="Which catalog services this account may order"
        actions={
          <Guarded permission="accounts.manage">
            {(allowed) => (
              <Button size="sm" leading={<Pencil />} disabled={!allowed} onClick={() => setOpen(true)}>
                Edit
              </Button>
            )}
          </Guarded>
        }
      />
      <CardBody>
        {sa.mode === 'all' ? (
          <div className="text-[13px] text-fg-2">
            <Badge tone="success" dot>
              All services
            </Badge>
            <span className="ml-2 text-[12px] text-fg-3">Every published service, priced by the account’s tier.</span>
          </div>
        ) : sa.mode === 'categories' ? (
          <div>
            <div className="mb-2 text-[12px] text-fg-3">Restricted to {sa.categoryIds.length} categor{sa.categoryIds.length === 1 ? 'y' : 'ies'}:</div>
            <div className="flex flex-wrap gap-1.5">
              {sa.categoryIds.map((id) => (
                <Badge key={id} tone="neutral" variant="outline">
                  {names.get(id) ?? id}
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-[12.5px] text-fg-2">Restricted to {sa.serviceIds.length} specific services.</div>
        )}
      </CardBody>
      <AccessModal open={open} onClose={() => setOpen(false)} a={a} />
    </Card>
  )
}

function AccessModal({ open, onClose, a }: { open: boolean; onClose: () => void; a: Account }) {
  const cats = useCategories()
  const [mode, setMode] = useState<'all' | 'categories'>(a.serviceAccess.mode === 'categories' ? 'categories' : 'all')
  const [ids, setIds] = useState<string[]>(a.serviceAccess.mode === 'categories' ? a.serviceAccess.categoryIds : [])
  // Re-seed from the account whenever the modal opens (adjusted during render, not in an effect).
  const [seededFor, setSeededFor] = useState({ open, access: a.serviceAccess })
  if (seededFor.open !== open || seededFor.access !== a.serviceAccess) {
    setSeededFor({ open, access: a.serviceAccess })
    if (open) {
      setMode(a.serviceAccess.mode === 'categories' ? 'categories' : 'all')
      setIds(a.serviceAccess.mode === 'categories' ? a.serviceAccess.categoryIds : [])
    }
  }
  const next: ServiceAccess = mode === 'all' ? { mode: 'all' } : { mode: 'categories', categoryIds: ids }
  const m = useInstMutation(() => accountsService.update(a.id, { serviceAccess: next }, 'Service access changed'), { success: 'Service access updated', onSuccess: onClose })
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<Layers />}
      title="Service access"
      description="Restricting access hides services on the portal and storefront and refuses API/DHRU orders for anything else."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" loading={m.isPending} disabled={mode === 'categories' && ids.length === 0} onClick={() => m.mutate()}>
            Save access
          </Button>
        </>
      }
    >
      <Segmented<'all' | 'categories'>
        items={[
          { value: 'all', label: 'All services' },
          { value: 'categories', label: 'Selected categories' },
        ]}
        value={mode}
        onChange={setMode}
      />
      {a.serviceAccess.mode === 'services' && <p className="mt-2 text-[12px] text-warning">This account currently has a per-service list; saving replaces it.</p>}
      {mode === 'categories' && (
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {(cats.data ?? []).map((c) => (
            <Checkbox key={c.id} checked={ids.includes(c.id)} onChange={(v) => setIds((x) => (v ? [...x, c.id] : x.filter((y) => y !== c.id)))} label={c.name} description={`${c.services} services`} />
          ))}
        </div>
      )}
    </Modal>
  )
}

/* ------------------------------ Limits ------------------------------ */
export function LimitsCard({ a }: { a: Account }) {
  const [open, setOpen] = useState(false)
  const l = a.limits
  return (
    <Card>
      <CardHeader
        icon={<Gauge />}
        title="Limits & alerts"
        description="Enforced by PlaceOrder on every channel"
        actions={
          <Guarded permission="accounts.manage">
            {(allowed) => (
              <Button size="sm" leading={<Pencil />} disabled={!allowed} onClick={() => setOpen(true)}>
                Edit
              </Button>
            )}
          </Guarded>
        }
      />
      <CardBody>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
          <Limit label="Orders / minute" value={l.ordersPerMinute} />
          <Limit label="Daily orders" value={l.dailyOrders} />
          <Limit label="Max concurrent" value={l.maxConcurrent} />
          <Limit label="Max order value" value={<Money value={l.maxOrderValue} />} />
          <Limit label="Low-balance alert" value={a.lowBalanceAlert == null ? <span className="text-fg-3">Off</span> : <Money value={a.lowBalanceAlert} />} className="col-span-1 sm:col-span-2" />
        </div>
      </CardBody>
      <LimitsModal open={open} onClose={() => setOpen(false)} a={a} />
    </Card>
  )
}

function Limit({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn('bg-surface px-3 py-2.5', className)}>
      <div className="text-[11.5px] text-fg-3">{label}</div>
      <div className="mt-0.5 font-mono text-[13.5px] font-medium tabular">{value}</div>
    </div>
  )
}

function LimitsModal({ open, onClose, a }: { open: boolean; onClose: () => void; a: Account }) {
  const fromAccount = (acc: Account) => ({
    opm: String(acc.limits.ordersPerMinute),
    daily: String(acc.limits.dailyOrders),
    conc: String(acc.limits.maxConcurrent),
    max: moneyInput(acc.limits.maxOrderValue),
    alert: moneyInput(acc.lowBalanceAlert),
  })
  const [f, setF] = useState(() => fromAccount(a))
  // Re-seed from the account whenever the modal opens (adjusted during render, not in an effect).
  const [seededFor, setSeededFor] = useState({ open, a })
  if (seededFor.open !== open || seededFor.a !== a) {
    setSeededFor({ open, a })
    if (open) setF(fromAccount(a))
  }
  const int = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s) : null)
  const maxM = parseMoney(f.max)
  const alertM = f.alert.trim() ? parseMoney(f.alert) : null
  const valid = int(f.opm) != null && int(f.daily) != null && int(f.conc) != null && maxM != null && maxM > 0 && (!f.alert.trim() || (alertM != null && alertM >= 0))
  const limits: AccountLimits | null = valid ? { ordersPerMinute: int(f.opm)!, dailyOrders: int(f.daily)!, maxConcurrent: int(f.conc)!, maxOrderValue: maxM! } : null
  const m = useInstMutation(() => accountsService.update(a.id, { limits: limits!, lowBalanceAlert: alertM }, 'Limits changed'), { success: 'Limits updated', onSuccess: onClose })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<Gauge />}
      title="Limits & alerts"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" disabled={!valid} loading={m.isPending} onClick={() => m.mutate()}>
            Save limits
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Orders per minute">
          <Input value={f.opm} onChange={set('opm')} mono inputMode="numeric" />
        </Field>
        <Field label="Daily orders">
          <Input value={f.daily} onChange={set('daily')} mono inputMode="numeric" />
        </Field>
        <Field label="Max concurrent open orders">
          <Input value={f.conc} onChange={set('conc')} mono inputMode="numeric" />
        </Field>
        <Field label="Max order value">
          <Input value={f.max} onChange={set('max')} mono inputMode="decimal" leading={<span className="text-[13px]">$</span>} />
        </Field>
        <Field label="Low-balance alert" optional hint="Notify the account (and flag it here) when available drops below this. Empty = off." className="sm:col-span-2">
          <Input value={f.alert} onChange={set('alert')} mono inputMode="decimal" leading={<span className="text-[13px]">$</span>} placeholder="Off" />
        </Field>
      </div>
    </Modal>
  )
}
