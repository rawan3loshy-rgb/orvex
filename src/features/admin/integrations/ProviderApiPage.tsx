import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui'
import { Guarded } from '@/components/domain'
import { ConnectSupplierDrawer } from '../suppliers/ConnectSupplierDrawer'
import { ApiFlow, DirectionHero } from './flow'
import { ProviderDemoCard } from './ProviderDemo'
import { AdapterCard, CatalogMappingCard, ProvidersCard, SyncHistoryCard } from './parts'

/**
 * Provider API (inbound): ORVEX consumes supplier APIs. A provider's whole
 * catalog is imported as supplier products; mapped products become offers
 * behind ORVEX's own customer-facing services.
 */
export default function ProviderApiPage() {
  const [connecting, setConnecting] = useState(false)
  return (
    <div>
      <DirectionHero
        direction="inbound"
        title="Provider integrations"
        description="Connect external service providers, synchronize their catalogs, map their products and use them as supplier offers inside ORVEX."
        actions={
          <Guarded permission="suppliers.manage">
            {(ok) => (
              <Button variant="accent" leading={<Plus />} disabled={!ok} onClick={() => setConnecting(true)}>
                Connect provider API
              </Button>
            )}
          </Guarded>
        }
        other={{ to: '/admin/developer', label: 'Reseller API', text: 'External businesses consume ORVEX’s API' }}
      >
        <ApiFlow
          nodes={[
            { title: 'Provider API', sub: 'URL + API key · e.g. 100 GSM services', side: 'external' },
            { title: 'Get services', sub: 'GET /v1/products', side: 'orvex', mono: true },
            { title: 'Normalization', sub: 'names, groups, fields, costs → one model', side: 'orvex' },
            { title: 'Supplier products / offers', sub: 'source data · owns the cost', side: 'orvex' },
            { title: 'ORVEX service catalog', sub: 'customer-facing · ORVEX-controlled', side: 'orvex' },
          ]}
        />
      </DirectionHero>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ProviderDemoCard />
        <AdapterCard />
      </div>

      <div className="mt-4">
        <CatalogMappingCard serviceId="svc_4006" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ProvidersCard />
        <SyncHistoryCard />
      </div>

      <ConnectSupplierDrawer open={connecting} onClose={() => setConnecting(false)} />
    </div>
  )
}
