import { useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { CloudDownload, Plus, ReceiptText } from 'lucide-react'
import { useHealth, useProviders, useUpdates } from '@/hooks/installation'
import { Button, DemoTag, Dot, PageHeader } from '@/components/ui'
import { demoInstallation } from '@/config/brand'
import { ApiTraffic } from './ApiTraffic'
import { KpiRow, ServiceMixCard, VolumeCard } from './Commercial'
import { OpsStrip } from './OpsStrip'
import { OrderFlow } from './OrderFlow'
import { ActivityCard, LiveOrdersCard, SystemHealthCard } from './Platform'
import { ProviderNetwork } from './ProviderNetwork'
import { ResellerActivity } from './ResellerActivity'
import { SectionLabel } from './parts'

function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

/**
 * Operations center of the installation (/admin).
 * Hierarchy: live status → order flow & supplier network → commercial → resellers & API → event stream.
 */
export default function OverviewPage() {
  const navigate = useNavigate()
  const today = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  return (
    <div className="space-y-4">
      <PageHeader
        className="mb-2"
        eyebrow={
          <>
            <span className="font-medium text-fg-2">{demoInstallation.adminTitle}</span>
            <span className="text-fg-3/50">·</span>
            <span>Operations center</span>
            <span className="hidden text-fg-3/50 sm:inline">·</span>
            <span className="hidden sm:inline">{today}</span>
          </>
        }
        title={`${greeting()}, Alex`}
        description={
          <>
            Live order flow, supplier network and reseller traffic for <span className="text-fg">{demoInstallation.domain}</span> — IMEI checks, unlocks, server jobs and codes.
          </>
        }
        actions={
          <>
            <Button variant="secondary" leading={<ReceiptText />} to="/admin/reports">
              Reports
            </Button>
            <Button variant="primary" leading={<Plus />} onClick={() => navigate('/admin/orders?create=1')}>
              Test order
            </Button>
          </>
        }
      />

      <UpdateBanner />

      <SectionLabel index="01" title="Live operations" aside={<SystemStatus />} />
      <OpsStrip />
      <div className="grid gap-4 xl:grid-cols-12">
        <OrderFlow className="xl:col-span-7" />
        <ProviderNetwork className="xl:col-span-5" />
      </div>

      <SectionLabel index="02" title="Commercial · last 24h" aside={<DemoTag />} />
      <KpiRow />
      <div className="grid gap-4 xl:grid-cols-12">
        <VolumeCard className="xl:col-span-8" />
        <ServiceMixCard className="xl:col-span-4" />
      </div>

      <SectionLabel index="03" title="Resellers, API & platform" />
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-12">
        <ResellerActivity className="lg:col-span-2 xl:col-span-5" />
        <ApiTraffic className="xl:col-span-4" />
        <SystemHealthCard className="xl:col-span-3" />
      </div>

      <SectionLabel index="04" title="Event stream" />
      <div className="grid gap-4 xl:grid-cols-12">
        <LiveOrdersCard className="xl:col-span-8" />
        <ActivityCard className="xl:col-span-4" />
      </div>
    </div>
  )
}

/** One-line platform verdict shown next to the "Live operations" label. */
function SystemStatus() {
  const providers = useProviders()
  const health = useHealth()
  if (!providers.data || !health.data) return <span className="text-fg-3">Checking…</span>
  const impaired = providers.data.filter((p) => p.status === 'degraded' || p.status === 'outage')
  const coreOk = health.data.overall === 'healthy'
  if (!impaired.length && coreOk)
    return (
      <span className="flex items-center gap-1.5">
        <Dot tone="success" pulse /> All systems operational
      </span>
    )
  return (
    <span className="flex items-center gap-1.5">
      <Dot tone="warning" />
      <span className="hidden sm:inline">{coreOk ? 'Core healthy' : 'Core degraded'} ·</span>
      {impaired.length ? `${impaired.length} supplier${impaired.length === 1 ? '' : 's'} degraded` : 'checks need attention'}
    </span>
  )
}

function UpdateBanner() {
  const updates = useUpdates()
  const rel = updates.data?.available
  if (!rel) return null
  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-xl border border-accent/25 bg-accent/[0.04] py-3 pr-4 pl-5">
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-accent" />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent-ink">
            <CloudDownload className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-medium text-fg">
              ORVEX Core {rel.version} is available <span className="text-fg-3">— {rel.title}</span>
            </p>
            <p className="text-[12.5px] text-fg-3">
              Signed release
              {rel.migration ? ` · database migration ${rel.migration.from} → ${rel.migration.to}` : ''} · automatic backup before install
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="ghost" to="/admin/system/updates">
            Release notes
          </Button>
          <Button size="sm" variant="accent" leading={<CloudDownload />} to="/admin/system/updates">
            Backup &amp; update
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
