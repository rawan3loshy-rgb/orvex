import { ArrowUpRight, ShieldCheck } from 'lucide-react'
import { Button, Card, EmptyState, PageHeader } from '@/components/ui'
import { useInstallation, useLicense, useUsers } from '@/hooks/installation'
import { LicenseHero } from './license/LicenseHero'
import { ValidationPanel } from './license/ValidationPanel'
import { ResilienceCard } from './license/ResilienceCard'
import { EntitlementsCard } from './license/EntitlementsCard'
import { PrivacyCard, VendorCard } from './license/PrivacyCard'

export default function LicensePage() {
  const license = useLicense()
  const installation = useInstallation()
  const users = useUsers()
  const data = license.data

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<ShieldCheck />}
        title="License"
        description="The signed license of this ORVEX Core installation. It is verified on your own server, so the installation keeps working even when the license server is temporarily unreachable."
        actions={
          <Button variant="secondary" to="/account/license" trailing={<ArrowUpRight />}>
            Manage subscription
          </Button>
        }
      />

      {license.isError && !data ? (
        <Card>
          <EmptyState icon={<ShieldCheck />} title="License details unavailable" description="The installation could not read its license file. Order processing is not affected." action={<Button onClick={() => license.refetch()}>Try again</Button>} />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <LicenseHero license={data} coreVersion={installation.data?.version} />
            </div>
            <ValidationPanel license={data} />
          </div>

          <ResilienceCard graceDays={data?.validation.gracePeriodDays ?? 14} />

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <EntitlementsCard license={data} users={users.data} />
            </div>
            <div className="space-y-4">
              <PrivacyCard license={data} version={installation.data?.version} />
              <VendorCard />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
