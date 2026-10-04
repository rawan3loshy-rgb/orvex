import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import { Check, Search, ShieldCheck, TriangleAlert, X } from 'lucide-react'
import { Badge, Button, Field, Input, Modal, SearchInput, Select, Skeleton } from '@/components/ui'
import { FieldList, Guarded, Money, PriceSteps, useFieldForm } from '@/components/domain'
import { ACCOUNT_TIER_LABEL } from '@/core/domain'
import { formatMoney } from '@/core/money'
import { useAccounts, useInstMutation, useQuote, useService, useServices } from '@/hooks/installation'
import { ordersService } from '@/services/installation'
import type { AccountRow, OrderRow } from '@/types/installation'
import { cn } from '@/lib/cn'
import { newIdempotencyKey } from './helpers'

/**
 * Admin order — goes through the same PlaceOrder command as every other
 * channel (wallet hold → routing → supplier), with a client idempotency key.
 */
export function CreateOrderModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (row: OrderRow) => void }) {
  const [account, setAccount] = useState<AccountRow | null>(null)
  const [accountSearch, setAccountSearch] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [clientRef, setClientRef] = useState('')
  const [idemKey, setIdemKey] = useState(() => newIdempotencyKey('adm'))

  // Start clean (with a fresh idempotency key) every time the modal opens — adjusted during render, not in an effect.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setAccount(null)
      setAccountSearch('')
      setServiceId('')
      setClientRef('')
      setIdemKey(newIdempotencyKey('adm'))
    }
  }

  const accounts = useAccounts({ search: accountSearch.trim() || undefined, kind: 'customer', pageSize: 6 })
  const services = useServices({ status: 'active' })
  const service = useService(serviceId || undefined)
  const fields = service.data?.revision.fields
  const form = useFieldForm(fields)
  const quote = useQuote(serviceId || undefined, account?.account.pricingTierId)

  // reset field values when the service changes
  const resetFields = useEffectEvent(() => form.reset())
  useEffect(() => {
    resetFields()
  }, [serviceId])

  const serviceOptions = useMemo(() => {
    const rows = (services.data ?? []).filter((r) => r.service.status === 'active').slice().sort((a, b) => a.categoryName.localeCompare(b.categoryName) || a.service.name.localeCompare(b.service.name))
    return [{ value: '', label: 'Select a service…' }, ...rows.map((r) => ({ value: r.service.id, label: `${r.categoryName} · ${r.service.name}${r.available ? '' : ' (unavailable)'}` }))]
  }, [services.data])
  const serviceRow = services.data?.find((r) => r.service.id === serviceId)

  const create = useInstMutation(
    () =>
      ordersService.create({
        accountId: account!.account.id,
        serviceId,
        input: form.normalized,
        clientReference: clientRef.trim() || undefined,
        idempotencyKey: idemKey,
      }),
    {
      success: (row) => `Order ${row.ref} placed`,
      error: 'Order was not placed',
      onSuccess: (row) => onCreated(row),
    },
  )

  const price = quote.data?.amount
  const spendable = account?.balance.spendable
  const insufficient = price != null && spendable != null && spendable < price
  const frozen = account && account.account.status !== 'active'
  const canSubmit = !!account && !!serviceId && !!fields && form.valid && !frozen && !create.isPending

  const submit = () => {
    if (!form.submit() || !canSubmit) return
    create.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      icon={<ShieldCheck />}
      title="Create admin order"
      description="Placed on behalf of an account through the same PlaceOrder command as every channel: price snapshot → wallet hold → priority routing."
      footer={
        <>
          <span className="mr-auto hidden font-mono text-[11px] text-fg-3 sm:inline" title="Generated once for this form — a retried submit can never create a second order">
            Idempotency-Key {idemKey}
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Guarded permission="orders.manage">
            {(allowed) => (
              <Button variant="accent" onClick={submit} loading={create.isPending} disabled={!allowed || !account || !serviceId || !!frozen}>
                Place order{price != null ? ` · ${formatMoney(price)}` : ''}
              </Button>
            )}
          </Guarded>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid content-start gap-5">
          {/* Account */}
          <section>
            <div className="mono-label mb-2">1 · Account</div>
            {account ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2/40 px-3.5 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13.5px] font-medium">{account.account.name}</span>
                    <Badge tone="neutral">{account.tierName}</Badge>
                    {account.account.status !== 'active' && <Badge tone="danger">{account.account.status}</Badge>}
                  </div>
                  <div className="mt-0.5 truncate text-[12px] text-fg-3">
                    {account.account.number} · {ACCOUNT_TIER_LABEL[account.account.tier]} · {account.account.email}
                  </div>
                </div>
                <Button size="xs" variant="ghost" leading={<X />} onClick={() => setAccount(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-line">
                <div className="border-b border-line p-2">
                  <SearchInput value={accountSearch} onChange={setAccountSearch} placeholder="Search accounts by name, email or number…" autoFocus />
                </div>
                <ul className="max-h-[230px] overflow-y-auto p-1">
                  {accounts.isLoading &&
                    Array.from({ length: 4 }, (_, i) => (
                      <li key={i} className="px-2.5 py-2">
                        <Skeleton className="h-3.5 w-40" />
                      </li>
                    ))}
                  {accounts.data?.items.map((a) => (
                    <li key={a.account.id}>
                      <button type="button" onClick={() => setAccount(a)} className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left hover:bg-surface-2">
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium">{a.account.name}</span>
                          <span className="block truncate text-[11.5px] text-fg-3">
                            {a.tierName} · {a.account.number}
                            {a.account.status !== 'active' && <span className="text-danger"> · {a.account.status}</span>}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <Money value={a.balance.spendable} className="block font-mono text-[12.5px]" />
                          <span className="block text-[10.5px] text-fg-3">spendable</span>
                        </span>
                      </button>
                    </li>
                  ))}
                  {accounts.data && accounts.data.items.length === 0 && (
                    <li className="flex items-center gap-2 px-2.5 py-4 text-[12.5px] text-fg-3">
                      <Search className="size-3.5" /> No account matches “{accountSearch}”.
                    </li>
                  )}
                </ul>
              </div>
            )}
          </section>

          {/* Service */}
          <section>
            <div className="mono-label mb-2">2 · Service</div>
            <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)} options={serviceOptions} disabled={services.isLoading} />
            {serviceRow && !serviceRow.available && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-warning">
                <TriangleAlert className="size-3.5" /> {serviceRow.unavailableReason ?? 'No routable offer'} — the order will be rejected by routing and the hold released.
              </p>
            )}
          </section>

          {/* Fields */}
          {serviceId && (
            <section>
              <div className="mono-label mb-2 flex items-center justify-between">
                <span>3 · Order fields</span>
                {service.data && <span className="normal-case tracking-normal text-fg-3">revision {service.data.revision.number}</span>}
              </div>
              {service.isLoading || !fields ? (
                <div className="grid gap-3">
                  <Skeleton className="h-9" />
                  <Skeleton className="h-9" />
                </div>
              ) : fields.length === 0 ? (
                <p className="text-[12.5px] text-fg-3">This service needs no input.</p>
              ) : (
                <FieldList fields={fields} form={form} />
              )}
              <Field label="Client reference" optional hint="Free-text reference returned in the API and webhooks" className="mt-4">
                <Input value={clientRef} onChange={(e) => setClientRef(e.target.value)} placeholder="e.g. ticket #4411" />
              </Field>
            </section>
          )}
        </div>

        {/* Price */}
        <aside className="grid content-start gap-3">
          <div className="mono-label">Price</div>
          {!account || !serviceId ? (
            <div className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-[12.5px] text-fg-3">Pick an account and a service to see the live price for the account’s pricing tier.</div>
          ) : quote.isLoading || !quote.data ? (
            <Skeleton className="h-[180px] rounded-lg" />
          ) : (
            <PriceSteps quote={quote.data} />
          )}
          {account && (
            <div className="rounded-lg border border-line px-3.5 py-2.5 text-[12.5px]">
              <div className="flex items-center justify-between">
                <span className="text-fg-3">Wallet spendable</span>
                <Money value={account.balance.spendable} className={cn('font-mono', insufficient && 'text-danger')} />
              </div>
              <div className="mt-1 flex items-center justify-between text-[11.5px] text-fg-3">
                <span>available · held · credit</span>
                <span className="font-mono">
                  {formatMoney(account.balance.available)} · {formatMoney(account.balance.held)} · {formatMoney(account.balance.creditLimit)}
                </span>
              </div>
              {price != null && (
                <div className={cn('mt-2 flex items-center gap-1.5 border-t border-line pt-2 text-[12px]', insufficient ? 'text-danger' : 'text-success')}>
                  {insufficient ? <TriangleAlert className="size-3.5" /> : <Check className="size-3.5" />}
                  {insufficient ? 'Insufficient funds — PlaceOrder will refuse the hold' : `${formatMoney(price)} will be held, captured on completion`}
                </div>
              )}
            </div>
          )}
          {frozen && <p className="text-[12px] text-danger">This account is {account!.account.status} — orders are refused.</p>}
        </aside>
      </div>
    </Modal>
  )
}
