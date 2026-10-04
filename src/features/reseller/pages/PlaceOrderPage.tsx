import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ArrowLeft, CircleAlert, Clock, Info, Layers, PackageSearch, RefreshCw, ShieldCheck, Wallet } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, SearchInput, Skeleton, Tooltip } from '@/components/ui'
import { FieldList, Money, useFieldForm } from '@/components/domain'
import { useInstMutation, usePortalServices } from '@/hooks/installation'
import { portalService } from '@/services/installation'
import { sub } from '@/core/money'
import type { PortalMe, PortalService } from '@/types/installation'
import { cn } from '@/lib/cn'
import { CategoryGlyph, ErrorCard, NoAccess } from '../kit'
import { newKey, PROCESSING_LABEL, savingPct, turnaroundLabel, usePortalSession } from '../kitUtils'

export default function PlaceOrderPage() {
  const { me, can, role } = usePortalSession()
  const services = usePortalServices()
  const [params, setParams] = useSearchParams()
  const serviceId = params.get('service') ?? ''
  const initialImei = params.get('imei') ?? ''
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')

  const all = useMemo(() => services.data ?? [], [services.data])
  const categories = useMemo(() => {
    const m = new Map<string, { id: string; name: string; count: number }>()
    for (const s of all) {
      const c = m.get(s.categoryId) ?? { id: s.categoryId, name: s.categoryName, count: 0 }
      c.count++
      m.set(s.categoryId, c)
    }
    return [...m.values()]
  }, [all])
  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((s) => (category === 'all' || s.categoryId === category) && (!q || [s.name, s.code, s.categoryName, ...s.tags].some((x) => x.toLowerCase().includes(q))))
  }, [all, search, category])
  const selected = all.find((s) => s.id === serviceId || s.code === serviceId)

  const select = (id: string | null) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        if (id) n.set('service', id)
        else n.delete('service')
        return n
      },
      { replace: true },
    )

  const header = <PageHeader title="Place order" description="Choose a service, enter the device details and confirm. Funds are reserved from your wallet and charged only when the order completes." actions={can.order && <Button to="/portal/bulk" leading={<Layers />}>Bulk orders</Button>} />

  if (me && !can.order)
    return (
      <div>
        {header}
        <NoAccess need="order" role={role} />
      </div>
    )

  return (
    <div>
      {header}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
        {/* Service browser */}
        <section className={cn('min-w-0', selected && 'hidden lg:block')} aria-label="Services">
          <div className="flex flex-col gap-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Search services, codes or tags…" />
            <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
              <Chip active={category === 'all'} onClick={() => setCategory('all')}>
                All <span className="text-fg-3">{all.length}</span>
              </Chip>
              {categories.map((c) => (
                <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
                  {c.name} <span className="text-fg-3">{c.count}</span>
                </Chip>
              ))}
            </div>
          </div>

          <div className="mt-4">
            {services.error ? (
              <ErrorCard error={services.error} onRetry={() => services.refetch()} />
            ) : services.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="h-[74px] rounded-xl" />
                ))}
              </div>
            ) : list.length === 0 ? (
              <Card>
                <EmptyState icon={<PackageSearch />} title="No services match" description="Try another search term or category." action={<Button size="sm" onClick={() => (setSearch(''), setCategory('all'))}>Clear filters</Button>} />
              </Card>
            ) : (
              <ul className="space-y-2">
                {list.map((s) => (
                  <li key={s.id}>
                    <ServiceRow service={s} active={selected?.id === s.id} onSelect={() => select(s.id)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Order form */}
        <aside className={cn('min-w-0', !selected && 'hidden lg:block')}>
          <div className="lg:sticky lg:top-20">
            {selected && me ? (
              <OrderForm key={selected.id} service={selected} me={me} initialImei={initialImei} onBack={() => select(null)} />
            ) : (
              <Card className="border-dashed">
                <EmptyState
                  icon={<ShieldCheck />}
                  title="Choose a service to start"
                  description="Every input is validated before anything is reserved: IMEIs must be 15 digits with a valid Luhn check digit."
                />
              </Card>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors', active ? 'border-fg bg-fg text-bg [&_span]:text-bg/60' : 'border-line bg-surface text-fg-2 hover:border-line-strong hover:text-fg')}
    >
      {children}
    </button>
  )
}

function ServiceRow({ service: s, active, onSelect }: { service: PortalService; active: boolean; onSelect: () => void }) {
  const save = savingPct(s.price, s.retailPrice)
  const row = (
    <button
      type="button"
      onClick={onSelect}
      disabled={!s.available}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border bg-surface px-3.5 py-3 text-left shadow-card transition-[border-color,box-shadow,background-color] sm:px-4',
        active ? 'border-accent/60 ring-3 ring-accent/12' : 'border-line hover:border-line-strong hover:shadow-pop',
        !s.available && 'cursor-not-allowed opacity-60 hover:shadow-card',
      )}
    >
      <CategoryGlyph categoryId={s.categoryId} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold">{s.name}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-fg-3">
          <span>{s.categoryName}</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" />
            {turnaroundLabel(s)}
          </span>
          {!s.available && <Badge tone="warning">Unavailable</Badge>}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[14px] font-semibold tabular">
          <Money value={s.price} />
        </div>
        {s.retailPrice > s.price ? (
          <div className="text-[11.5px] text-fg-3 tabular">
            <span className="line-through">
              <Money value={s.retailPrice} />
            </span>
            <span className="ml-1.5 font-medium text-success">−{save}%</span>
          </div>
        ) : (
          <div className="text-[11.5px] text-fg-3">Retail price</div>
        )}
      </div>
    </button>
  )
  return s.available ? row : <Tooltip content={s.unavailableReason ?? 'Temporarily unavailable'} className="flex w-full">{row}</Tooltip>
}

function OrderForm({ service, me, initialImei, onBack }: { service: PortalService; me: PortalMe; initialImei: string; onBack: () => void }) {
  const navigate = useNavigate()
  const imeiField = service.fields.find((f) => f.type === 'gsm.imei')
  const form = useFieldForm(service.fields, initialImei && imeiField ? { [imeiField.key]: initialImei } : undefined)
  const [clientRef, setClientRef] = useState('')
  const signature = JSON.stringify([service.id, form.values, clientRef])
  // One key per form session: a retry of the same request reuses it, a changed request gets a new one.
  const [idem, setIdem] = useState(() => ({ signature, key: newKey('portal') }))
  if (idem.signature !== signature) setIdem({ signature, key: newKey('portal') })
  const idemKey = idem.key

  const place = useInstMutation(portalService.placeOrder, {
    success: (o) => `Order ${o.ref} placed`,
    onSuccess: (o) => navigate(`/portal/orders/${o.ref}`),
  })

  const spendable = me.balance.spendable
  const affordable = service.price <= spendable
  const after = sub(spendable, service.price)
  const save = savingPct(service.price, service.retailPrice)

  const submit = () => {
    if (!form.submit() || !affordable || !service.available) return
    place.mutate({ serviceId: service.id, input: form.normalized, clientReference: clientRef.trim() || undefined, idempotencyKey: idemKey })
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-fg-3 hover:text-fg lg:hidden">
          <ArrowLeft className="size-3.5" /> Change service
        </button>
        <div className="flex items-start gap-3">
          <CategoryGlyph categoryId={service.categoryId} size="lg" />
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{service.name}</h2>
            <p className="mt-0.5 text-[12.5px] text-fg-3">{service.summary}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="neutral" icon={<Clock />}>
                {turnaroundLabel(service)}
              </Badge>
              <Badge tone="neutral">{PROCESSING_LABEL[service.processing] ?? service.processing}</Badge>
              <Badge tone="neutral" variant="outline" className="font-mono">
                {service.code}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <form
        className="space-y-4 px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        {!service.available && (
          <div className="flex gap-2 rounded-lg border border-warning/35 bg-warning/[0.07] px-3 py-2.5 text-[12.5px]">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>{service.unavailableReason ?? 'This service is temporarily unavailable.'}</span>
          </div>
        )}
        <FieldList fields={service.fields} form={form} size="lg" />
        <Field label="Your reference" optional hint="Shown on the order, statements and webhooks — e.g. your ticket or POS number." htmlFor="client_ref">
          <Input id="client_ref" value={clientRef} maxLength={64} placeholder="e.g. POS-10234" onChange={(e) => setClientRef(e.target.value)} />
        </Field>

        <div className="rounded-xl border border-line bg-surface-2/60">
          <div className="space-y-2 px-4 py-3 text-[13px]">
            <div className="flex items-center justify-between">
              <span className="text-fg-2">Your price · {me.tierName}</span>
              <Money value={service.price} className="text-[16px] font-semibold" />
            </div>
            {service.retailPrice > service.price && (
              <div className="flex items-center justify-between text-[12.5px] text-fg-3">
                <span>Retail price</span>
                <span>
                  <span className="line-through">
                    <Money value={service.retailPrice} />
                  </span>
                  <span className="ml-2 font-medium text-success">You save {save}%</span>
                </span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-line pt-2 text-[12.5px]">
              <span className="text-fg-3">Spendable now</span>
              <Money value={spendable} />
            </div>
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="text-fg-3">Spendable after this order</span>
              <Money value={after} tone="auto" className="font-medium" />
            </div>
          </div>
          {!affordable && (
            <div className="flex flex-col gap-2 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-2 text-[12.5px] text-danger">
                <Wallet className="size-4" /> Not enough balance — <Money value={sub(service.price, spendable)} /> more needed.
              </span>
              <Button to="/portal/wallet?topup=1" size="xs" variant="secondary">
                Top up
              </Button>
            </div>
          )}
        </div>

        <Button type="submit" variant="accent" size="lg" className="w-full" loading={place.isPending} disabled={!service.available || !affordable}>
          Place order · <Money value={service.price} />
        </Button>

        <div className="flex items-start gap-2 rounded-lg bg-surface-2/60 px-3 py-2.5 text-[11.5px] text-fg-3">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <div className="min-w-0">
            <span>
              <span className="font-medium text-fg-2">Safe to retry.</span> This request carries an idempotency key, so a double-click or a network retry never creates two orders.
            </span>
            <div className="mt-1 flex items-center gap-1.5">
              <code className="truncate font-mono text-[11px] text-fg-2">{idemKey}</code>
              <button type="button" onClick={() => setIdem({ signature, key: newKey('portal') })} className="text-fg-3 hover:text-fg" aria-label="Generate new key" title="Generate a new key">
                <RefreshCw className="size-3" />
              </button>
            </div>
          </div>
        </div>
      </form>
    </Card>
  )
}
