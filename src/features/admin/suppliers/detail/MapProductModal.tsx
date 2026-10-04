import { useMemo, useState } from 'react'
import { ArrowRight, Link2 } from 'lucide-react'
import { Badge, Button, Field, Modal, Select, Skeleton } from '@/components/ui'
import { Money, PermissionHint } from '@/components/domain'
import { useInstMutation, useService, useServices } from '@/hooks/installation'
import { catalogService } from '@/services/installation'
import { sub } from '@/core/money'
import type { SupplierDetail } from '@/types/installation'
import { Callout } from '../../catalog/kit'
import { autoMapping } from '../../catalog/helpers'

type Product = SupplierDetail['productList'][number]

/**
 * Map a provider's product onto an ORVEX service as a new offer (lowest
 * priority). The service — its name, fields and price — is not changed.
 */
export function MapProductModal({ product, supplierName, onClose }: { product: Product | null; supplierName: string; onClose: () => void }) {
  const services = useServices()
  const [serviceId, setServiceId] = useState('')
  const detail = useService(serviceId || undefined)
  const taken = useMemo(() => new Set(product?.services.map((s) => s.id) ?? []), [product])
  const options = (services.data ?? []).filter((r) => r.service.status !== 'archived' && !taken.has(r.service.id)).sort((a, b) => a.service.name.localeCompare(b.service.name))
  const row = options.find((r) => r.service.id === serviceId)
  const fields = detail.data?.revision.fields ?? []
  const mapping = product && detail.data ? autoMapping(fields, product.remoteFields) : {}
  const unmapped = fields.filter((f) => f.required && !mapping[f.key])

  const add = useInstMutation(() => catalogService.addOffer(serviceId, { supplierProductId: product!.id, fieldMapping: mapping, maxCost: null }), {
    success: (o) => `Offer added to ${row?.service.name ?? 'service'} — priority ${o.priority}`,
    onSuccess: () => {
      setServiceId('')
      onClose()
    },
  })
  const close = () => {
    setServiceId('')
    onClose()
  }

  return (
    <Modal
      open={!!product}
      onClose={close}
      size="lg"
      icon={<Link2 />}
      title="Map product to an ORVEX service"
      description="Creates a supplier offer. Customers keep buying the ORVEX service; routing can now use this product."
      footer={
        <>
          <PermissionHint permission="catalog.manage" className="mr-auto" />
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="accent" disabled={!serviceId || !detail.data || unmapped.length > 0} loading={add.isPending} onClick={() => add.mutate()}>
            Add as offer
          </Button>
        </>
      }
    >
      {product && (
        <div className="grid gap-4">
          <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <div className="rounded-lg border border-dashed border-line-strong bg-surface-2/40 px-3 py-2.5">
              <div className="mono-label">Supplier product · {supplierName}</div>
              <div className="mt-0.5 truncate text-[13px] font-medium">{product.name}</div>
              <div className="font-mono text-[11.5px] text-fg-3">
                #{product.externalId} · cost <Money value={product.cost} /> · {product.remoteFields.join(', ')}
              </div>
            </div>
            <ArrowRight className="mx-auto size-4 rotate-90 text-fg-3 sm:rotate-0" />
            <div className="rounded-lg border border-line bg-surface px-3 py-2.5 shadow-card">
              <div className="mono-label">ORVEX service</div>
              {row ? (
                <>
                  <div className="mt-0.5 truncate text-[13px] font-medium">{row.service.name}</div>
                  <div className="text-[11.5px] text-fg-3">
                    retail <Money value={row.retail.amount} /> · {row.offers} offer{row.offers === 1 ? '' : 's'} today
                  </div>
                </>
              ) : (
                <div className="mt-0.5 text-[12.5px] text-fg-3">Choose below</div>
              )}
            </div>
          </div>

          <Field label="ORVEX service">
            <Select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              options={[{ value: '', label: services.isLoading ? 'Loading services…' : 'Select a service…' }, ...options.map((r) => ({ value: r.service.id, label: `${r.service.name} · #${r.service.code}` }))]}
            />
          </Field>

          {serviceId && !detail.data && <Skeleton className="h-20" />}
          {detail.data && (
            <div>
              <div className="mb-1.5 text-[12.5px] font-medium">Field mapping (ORVEX field → provider field)</div>
              <div className="divide-y divide-line overflow-hidden rounded-lg border border-line">
                {fields.map((f) => (
                  <div key={f.key} className="flex items-center justify-between gap-3 px-3 py-2 text-[12.5px]">
                    <span>
                      <span className="font-mono">{f.key}</span> <span className="text-fg-3">· {f.label}</span>
                    </span>
                    {mapping[f.key] ? <span className="font-mono text-fg-2">{mapping[f.key]}</span> : <Badge tone={f.required ? 'danger' : 'neutral'}>{f.required ? 'no match' : 'not sent'}</Badge>}
                  </div>
                ))}
              </div>
              {row && (
                <p className="mt-2 text-[12px] text-fg-3">
                  Retail margin on this offer: <Money value={sub(row.retail.amount, product.cost)} tone="auto" className="font-mono" /> (retail <Money value={row.retail.amount} /> − cost <Money value={product.cost} />). Prices stay controlled by pricing rules.
                </p>
              )}
              {unmapped.length > 0 && (
                <Callout tone="warning" className="mt-3">
                  The provider does not expect {unmapped.map((f) => f.key).join(', ')} — pick a service whose input fields this product can fulfil.
                </Callout>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
