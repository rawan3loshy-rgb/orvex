import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ArrowDown, ArrowRight, ArrowUp, Ban, Check, ChevronDown, Info, PackageSearch, Plus, Route, ShieldAlert, Trash2 } from 'lucide-react'
import { Badge, Button, Card, CardBody, CardHeader, ConfirmDialog, Drawer, EmptyState, Field, Input, SearchInput, Select, Skeleton, Switch, Tooltip } from '@/components/ui'
import { Guarded, HealthBadge, Money, PermissionHint, SimulatedBadge, useCan } from '@/components/domain'
import { useInstMutation, useProducts, useSuppliers } from '@/hooks/installation'
import { catalogService, type ProductRow } from '@/services/installation'
import { formatMoney, parseMoney, sub, type Micros } from '@/core/money'
import type { FieldDef, OfferView, ServiceDetail } from '@/types/installation'
import { cn } from '@/lib/cn'
import { Callout, SupplierMark } from '../../catalog/kit'
import { DRIVER_META, autoMapping } from '../../catalog/helpers'

export function OffersTab({ d }: { d: ServiceDetail }) {
  const [adding, setAdding] = useState(false)
  const can = useCan('catalog.manage')
  const reorder = useInstMutation((ids: string[]) => catalogService.reorderOffers(d.service.id, ids), { success: 'Priority order saved' })
  const move = (i: number, dir: -1 | 1) => {
    const ids = d.offers.map((o) => o.offer.id)
    const j = i + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
    reorder.mutate(ids)
  }

  return (
    <div className="grid gap-4">
      <Callout icon={<Route />} title="V1 routing: priority + guarded failover">
        Offers are tried strictly top to bottom. An offer is skipped when it is disabled, its product was removed, its supplier cannot take orders, or its cost exceeds the order price (margin guard) or the offer’s max cost. Failover to the next offer happens only after a definitive, failover-safe rejection — a <b>timeout is UNKNOWN</b> and goes to review, never to the next supplier. <Link to="/admin/routing" className="text-accent-ink hover:underline">Routing policy →</Link>
      </Callout>

      <Card>
        <CardHeader
          title="Offers in priority order"
          description={`${d.availability.routableOffers} of ${d.availability.totalOffers} routable at the retail price. The supplier product owns the cost — the offer never copies it.`}
          actions={
            <Guarded permission="catalog.manage">
              {(ok) => (
                <Button size="sm" variant="accent" leading={<Plus />} disabled={!ok} onClick={() => setAdding(true)}>
                  Add offer
                </Button>
              )}
            </Guarded>
          }
        />
        {d.offers.length === 0 ? (
          <EmptyState compact icon={<PackageSearch />} title="No supplier offers" description="Map a supplier product to make this service orderable." />
        ) : (
          <div className="border-t border-line">
            {d.offers.map((o, i) => (
              <OfferRow key={o.offer.id} o={o} index={i} count={d.offers.length} fields={d.revision.fields} canEdit={can} busy={reorder.isPending} onMove={(dir) => move(i, dir)} />
            ))}
          </div>
        )}
      </Card>

      <MarginMatrix d={d} />

      <AddOfferDrawer open={adding} onClose={() => setAdding(false)} d={d} />
    </div>
  )
}

function OfferRow({ o, index, count, fields, canEdit, busy, onMove }: { o: OfferView; index: number; count: number; fields: FieldDef[]; canEdit: boolean; busy: boolean; onMove: (dir: -1 | 1) => void }) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [mapping, setMapping] = useState<Record<string, string>>(o.offer.fieldMapping)
  const [maxCost, setMaxCost] = useState(o.offer.maxCost != null ? formatMoney(o.offer.maxCost).replace('$', '') : '')
  const update = useInstMutation((patch: Parameters<typeof catalogService.updateOffer>[1]) => catalogService.updateOffer(o.offer.id, patch), { success: 'Offer updated' })
  const remove = useInstMutation(() => catalogService.removeOffer(o.offer.id), { success: 'Offer removed', onSuccess: () => setConfirm(false) })
  const remote = o.product?.remoteFields ?? []
  const parsedMax = maxCost.trim() ? parseMoney(maxCost) : null
  const maxInvalid = maxCost.trim() !== '' && parsedMax == null
  const priceUp = o.product?.previousCost != null && o.product.cost > o.product.previousCost

  return (
    <div className={cn('border-b border-line last:border-0', !o.routable && 'bg-surface-2/30')}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 lg:flex-nowrap">
        <div className="flex items-center gap-1.5">
          <div className="flex flex-col">
            <button type="button" disabled={!canEdit || busy || index === 0} onClick={() => onMove(-1)} className="grid h-4 w-5 place-items-center rounded text-fg-3 hover:bg-surface-3 hover:text-fg disabled:opacity-30" aria-label="Move up">
              <ArrowUp className="size-3" />
            </button>
            <button type="button" disabled={!canEdit || busy || index === count - 1} onClick={() => onMove(1)} className="grid h-4 w-5 place-items-center rounded text-fg-3 hover:bg-surface-3 hover:text-fg disabled:opacity-30" aria-label="Move down">
              <ArrowDown className="size-3" />
            </button>
          </div>
          <span className={cn('grid size-7 place-items-center rounded-md font-mono text-[12px] font-semibold', o.routable ? 'bg-fg text-bg' : 'bg-surface-3 text-fg-3')} title={`Priority ${o.offer.priority}`}>
            P{index + 1}
          </span>
        </div>

        <div className="flex min-w-[220px] flex-1 items-center gap-3">
          <SupplierMark name={o.supplier.name} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link to={`/admin/suppliers/${o.supplier.id}`} className="truncate text-[13px] font-medium hover:underline">
                {o.supplier.name}
              </Link>
              <HealthBadge health={o.supplier.health} />
            </div>
            <div className="truncate text-[11.5px] text-fg-3">
              {o.product ? (
                <>
                  {o.product.name} <span className="font-mono">#{o.product.externalId}</span> · {DRIVER_META[o.supplier.driver].label}
                </>
              ) : (
                'Product missing'
              )}
            </div>
          </div>
        </div>

        <div className="w-[96px] text-right">
          <Money value={o.cost} className="font-mono text-[13px] font-medium" />
          {o.product?.previousCost != null && (
            <div className={cn('text-[11px]', priceUp ? 'text-warning' : 'text-success')}>
              was <Money value={o.product.previousCost} />
            </div>
          )}
          {o.offer.maxCost != null && <div className="text-[11px] text-fg-3">max <Money value={o.offer.maxCost} /></div>}
        </div>

        <div className="w-[230px] min-w-0">
          {o.routable ? (
            <Badge tone="success" dot>
              Routable
            </Badge>
          ) : (
            <div>
              <Badge tone="danger" dot>
                Not routable
              </Badge>
              <ul className="mt-0.5 space-y-px">
                {o.reasons.map((r) => (
                  <li key={r} className="truncate text-[11.5px] text-fg-3" title={r}>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Tooltip content={o.offer.enabled ? 'Enabled — routing may use this offer' : (o.offer.disabledReason ?? 'Disabled')}>
            <span>
              <Switch checked={o.offer.enabled} disabled={!canEdit || update.isPending} onChange={(v) => update.mutate({ enabled: v })} label="Offer enabled" />
            </span>
          </Tooltip>
          <Button size="sm" variant="ghost" icon onClick={() => setOpen(!open)} aria-label="Mapping and limits">
            <ChevronDown className={cn('transition-transform', open && 'rotate-180')} />
          </Button>
        </div>
      </div>

      {open && (
        <div className="grid gap-4 border-t border-line bg-surface-2/30 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div>
            <div className="mono-label mb-2">Field mapping · service field → supplier field</div>
            <div className="space-y-1.5">
              {fields.map((f) => (
                <div key={f.key} className="flex items-center gap-2">
                  <span className="w-36 truncate rounded-md border border-line bg-surface px-2 py-1.5 font-mono text-[12px]">{f.key}</span>
                  <ArrowRight className="size-3.5 shrink-0 text-fg-3" />
                  <Select
                    inputSize="sm"
                    className="w-44"
                    disabled={!canEdit}
                    value={mapping[f.key] ?? ''}
                    onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                    options={[{ value: '', label: 'Not sent' }, ...remote.map((r) => ({ value: r, label: r }))]}
                  />
                  {f.required && !mapping[f.key] && <span className="text-[11.5px] text-warning">required field not sent</span>}
                </div>
              ))}
            </div>
            {o.offer.disabledReason && (
              <Callout tone="warning" icon={<ShieldAlert />} className="mt-3">
                {o.offer.disabledReason}
              </Callout>
            )}
          </div>
          <div className="space-y-3">
            <Field label="Max cost" optional hint="Never route if the supplier cost rises above this.">
              <Input inputSize="sm" mono leading={<span className="text-[12px]">$</span>} value={maxCost} invalid={maxInvalid} disabled={!canEdit} onChange={(e) => setMaxCost(e.target.value)} placeholder="no limit" />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="primary" disabled={!canEdit || maxInvalid} loading={update.isPending} onClick={() => update.mutate({ fieldMapping: Object.fromEntries(Object.entries(mapping).filter(([, v]) => v)), maxCost: parsedMax })}>
                Save
              </Button>
              <Button size="sm" variant="ghost" leading={<Trash2 />} disabled={!canEdit} onClick={() => setConfirm(true)} className="text-danger hover:text-danger">
                Remove
              </Button>
            </div>
            {!canEdit && <PermissionHint permission="catalog.manage" />}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        tone="danger"
        title="Remove this offer?"
        description={`${o.supplier.name} will no longer be used for this service. Orders already placed keep their attempts; the remaining offers move up in priority.`}
        confirmLabel="Remove offer"
      />
    </div>
  )
}

/** Which offers can each tier's price actually use? (margin guard per tier) */
function MarginMatrix({ d }: { d: ServiceDetail }) {
  if (!d.offers.length) return null
  return (
    <Card>
      <CardHeader title="Margin guard by tier" description="The router skips an offer whose cost is above the order price. A low tier price can make the cheapest supplier the only usable one — or none." icon={<ShieldAlert />} />
      <div className="overflow-x-auto border-t border-line">
        <table className="w-full min-w-[640px] text-[12.5px]">
          <thead>
            <tr className="border-b border-line text-left text-[11.5px] text-fg-3">
              <th className="py-2 pr-3 pl-5 font-medium">Tier · price</th>
              {d.offers.map((o, i) => (
                <th key={o.offer.id} className="px-3 py-2 font-medium">
                  <span className="flex items-center gap-1.5">
                    <span className="font-mono">P{i + 1}</span>
                    <span className="truncate text-fg-2">{o.supplier.name.replace(/^DHRU Supplier /, '')}</span>
                    <Money value={o.cost} className="font-mono text-fg-3" />
                  </span>
                </th>
              ))}
              <th className="py-2 pr-5 pl-3 font-medium">Routes to</th>
            </tr>
          </thead>
          <tbody>
            {d.quotes.map((q) => {
              const first = d.offers.find((o) => o.routable && o.cost <= q.amount)
              return (
                <tr key={q.tierId} className="border-b border-line last:border-0">
                  <td className="py-2 pr-3 pl-5">
                    <div className="font-medium">{q.tierName}</div>
                    <Money value={q.amount} className="font-mono text-[12px] text-fg-2" />
                  </td>
                  {d.offers.map((o) => {
                    const blocked = o.cost > q.amount
                    const state = !o.routable ? 'off' : blocked ? 'blocked' : 'ok'
                    const margin = sub(q.amount, o.cost as Micros)
                    return (
                      <td key={o.offer.id} className="px-3 py-2">
                        {state === 'ok' ? (
                          <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11.5px]', first?.offer.id === o.offer.id ? 'bg-success/12 text-success' : 'text-fg-2')}>
                            <Check className="size-3" /> +{formatMoney(margin)}
                          </span>
                        ) : state === 'blocked' ? (
                          <Tooltip content={`Cost ${formatMoney(o.cost)} > price ${formatMoney(q.amount)} — the margin guard skips this offer`}>
                            <span className="inline-flex items-center gap-1 rounded-md bg-danger/10 px-1.5 py-0.5 font-mono text-[11.5px] text-danger">
                              <ShieldAlert className="size-3" /> {formatMoney(margin)}
                            </span>
                          </Tooltip>
                        ) : (
                          <Tooltip content={o.reasons.join(' · ')}>
                            <span className="inline-flex items-center gap-1 text-[11.5px] text-fg-3">
                              <Ban className="size-3" /> unroutable
                            </span>
                          </Tooltip>
                        )}
                      </td>
                    )
                  })}
                  <td className="py-2 pr-5 pl-3">{first ? <span className="text-fg">{first.supplier.name.replace(/^DHRU Supplier /, '')}</span> : <Badge tone="danger">No usable offer</Badge>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 border-t border-line px-5 py-2.5 text-[11.5px] text-fg-3">
        <Info className="size-3.5" /> Margin shown is price − supplier cost at today’s cost. Orders snapshot the price at placement.
      </div>
    </Card>
  )
}

function AddOfferDrawer({ open, onClose, d }: { open: boolean; onClose: () => void; d: ServiceDetail }) {
  const suppliers = useSuppliers()
  const [supplierId, setSupplierId] = useState('')
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<ProductRow | null>(null)
  const [maxCost, setMaxCost] = useState('')
  const products = useProducts(supplierId ? { supplierId, search: search || undefined } : undefined)
  const mapping = useMemo(() => (picked ? autoMapping(d.revision.fields, picked.remoteFields) : {}), [picked, d.revision.fields])
  const existing = new Set(d.offers.map((o) => o.offer.supplierProductId))
  const parsedMax = maxCost.trim() ? parseMoney(maxCost) : null

  const add = useInstMutation(() => catalogService.addOffer(d.service.id, { supplierProductId: picked!.id, fieldMapping: mapping, maxCost: parsedMax }), {
    success: 'Offer added at the lowest priority',
    onSuccess: () => {
      setPicked(null)
      setMaxCost('')
      onClose()
    },
  })

  const sup = suppliers.data?.find((s) => s.supplier.id === supplierId)
  const retail = d.quotes[0]

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="lg"
      icon={<Plus />}
      title="Add supplier offer"
      description={`Map a synced supplier product to ${d.service.name}. New offers join at the lowest priority.`}
      footer={
        <>
          <PermissionHint permission="catalog.manage" className="mr-auto" />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" disabled={!picked || (maxCost.trim() !== '' && parsedMax == null)} loading={add.isPending} onClick={() => add.mutate()}>
            Add offer
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Supplier">
          <Select
            value={supplierId}
            onChange={(e) => {
              setSupplierId(e.target.value)
              setPicked(null)
            }}
            options={[{ value: '', label: 'Choose a supplier…' }, ...(suppliers.data ?? []).map((s) => ({ value: s.supplier.id, label: `${s.supplier.name} — ${s.health.replace('_', ' ')}` }))]}
          />
        </Field>
        {sup && (
          <div className="flex items-center gap-2 text-[12px] text-fg-3">
            <HealthBadge health={sup.health} /> {sup.driver.name} · {sup.products} products <SimulatedBadge />
          </div>
        )}

        {supplierId && (
          <div>
            <SearchInput value={search} onChange={setSearch} placeholder="Search products or external id…" />
            <div className="mt-2 max-h-[300px] overflow-y-auto rounded-lg border border-line">
              {products.isLoading ? (
                <div className="space-y-2 p-3">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Skeleton key={i} className="h-9" />
                  ))}
                </div>
              ) : products.data?.length === 0 ? (
                <div className="px-4 py-8 text-center text-[12.5px] text-fg-3">No available products{search ? ' match' : ''}.</div>
              ) : (
                products.data?.map((p) => {
                  const already = existing.has(p.id)
                  const over = retail && p.cost > retail.amount
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={already}
                      onClick={() => setPicked(p)}
                      className={cn('flex w-full items-center gap-3 border-b border-line px-3 py-2 text-left last:border-0 hover:bg-surface-2/60 disabled:opacity-50', picked?.id === p.id && 'bg-accent/[0.06]')}
                    >
                      <span className="w-12 shrink-0 font-mono text-[11.5px] text-fg-3">#{p.externalId}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px]">{p.name}</span>
                        <span className="block truncate font-mono text-[10.5px] text-fg-3">fields: {p.remoteFields.join(', ') || '—'}</span>
                      </span>
                      {already ? <Badge tone="neutral">mapped</Badge> : p.mapped > 0 ? <span className="text-[11px] text-fg-3">{p.mapped} offers</span> : null}
                      <Money value={p.cost} className={cn('w-16 text-right font-mono text-[12.5px]', over && 'text-danger')} />
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}

        {picked && (
          <Card className="bg-surface-2/40">
            <CardBody className="space-y-3 pt-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[13px] font-medium">{picked.name}</div>
                <Money value={picked.cost} className="font-mono text-[13px]" />
              </div>
              {retail && picked.cost > retail.amount && (
                <Callout tone="danger" icon={<ShieldAlert />}>
                  Cost is above the {retail.tierName} price (<Money value={retail.amount} />). The margin guard will skip this offer for that tier until the price is raised.
                </Callout>
              )}
              <div>
                <div className="mono-label mb-1.5">Suggested field mapping</div>
                {d.revision.fields.map((f) => (
                  <div key={f.key} className="flex items-center gap-2 py-0.5 text-[12px]">
                    <span className="w-32 font-mono">{f.key}</span>
                    <ArrowRight className="size-3 text-fg-3" />
                    {mapping[f.key] ? <span className="font-mono text-fg">{mapping[f.key]}</span> : <span className="text-warning">not sent — edit after adding</span>}
                  </div>
                ))}
              </div>
              <Field label="Max cost" optional hint="Leave empty for no limit.">
                <Input inputSize="sm" mono value={maxCost} onChange={(e) => setMaxCost(e.target.value)} placeholder="e.g. 1.00" leading={<span className="text-[12px]">$</span>} invalid={maxCost.trim() !== '' && parsedMax == null} />
              </Field>
            </CardBody>
          </Card>
        )}
      </div>
    </Drawer>
  )
}
