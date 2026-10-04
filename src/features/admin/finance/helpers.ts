/** Non-component helpers shared by the Finance screens (ledger, integrity, reconciliation, payments). */
import { useMemo } from 'react'
import { useSuppliers } from '@/hooks/installation'

export { newIdempotencyKey, previewTx } from '@/features/admin/accounts/helpers'

/** Subject-id → display name for ledger account codes (`supplier_prepaid:sup_alpha` → "DHRU Supplier Alpha"). */
export function useSupplierNames(extra?: Record<string, string>) {
  const sup = useSuppliers()
  return useMemo(() => {
    const m: Record<string, string> = {}
    for (const s of sup.data ?? []) m[s.supplier.id] = s.supplier.name
    return { ...m, ...extra }
  }, [sup.data, extra])
}

export const METHOD_LABEL: Record<string, string> = { card: 'Card', paypal: 'PayPal', bank_transfer: 'Bank transfer', manual: 'Manual' }
