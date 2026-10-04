import { useState } from 'react'
import { HeartPulse, RefreshCw, ServerCrash } from 'lucide-react'
import { Badge, Button, Card, EmptyState, PageHeader, SectionTitle } from '@/components/ui'
import { useHealth, useInstallation, useUpdates } from '@/hooks/installation'
import { toast } from '@/stores/toast'
import { plural } from '@/lib/format'
import { HealthHero } from './health/HealthHero'
import { ComponentGrid } from './health/ComponentGrid'
import { PerformanceCharts } from './health/PerformanceCharts'
import { ResourcesCard } from './health/ResourcesCard'
import { IncidentsCard } from './health/IncidentsCard'
import { ProvidersCard } from './health/ProvidersCard'
import { OrderQueueCard } from './health/OrderQueueCard'
import { withMinDuration } from './health/useNow'

export default function HealthPage() {
  const health = useHealth()
  const installation = useInstallation()
  const updates = useUpdates()
  // Core restarts on every update — the latest successful update is the latest restart.
  const lastUpdate = updates.data?.history.filter((h) => h.status === 'success').sort((a, b) => +new Date(b.installedAt) - +new Date(a.installedAt))[0]?.installedAt
  const [checking, setChecking] = useState(false)
  const [round, setRound] = useState(0)

  const refresh = async () => {
    if (checking) return
    setChecking(true)
    const res = await withMinDuration(health.refetch(), 1500)
    setChecking(false)
    setRound((r) => r + 1)
    const snap = res.data
    if (!snap) {
      toast.error('Health check failed', 'Core did not answer the health endpoint. Retrying automatically.')
      return
    }
    const problems = snap.components.filter((c) => c.status === 'degraded' || c.status === 'down')
    if (problems.length) toast.warning('Health check complete', `${problems.map((p) => p.name).join(', ')} need${problems.length === 1 ? 's' : ''} attention.`)
    else toast.success('Health check complete', `${plural(snap.components.length, 'component')} checked — all responding normally.`)
  }

  const data = health.data

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<HeartPulse />}
        title="System health"
        description="Live health of this ORVEX Core installation — application, database, order queue and integrations. Checks run every 10 seconds on your own server."
        actions={
          <Badge tone="success" dot pulse size="md">
            Live · 10s
          </Badge>
        }
      />

      {health.isError && !data ? (
        <Card>
          <EmptyState
            icon={<ServerCrash />}
            title="Health endpoint unreachable"
            description="The admin UI could not reach /api/admin/health. Core may be restarting — this page retries automatically."
            action={
              <Button variant="secondary" leading={<RefreshCw />} onClick={() => health.refetch()}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <HealthHero data={data} checking={checking} onRefresh={refresh} domain={installation.data?.domain} restartedAt={lastUpdate} />

          <section>
            <SectionTitle title="Components" description="Each component is probed independently. Select one to open its area." />
            <ComponentGrid components={data?.components} checking={checking} round={round} />
          </section>

          <section>
            <SectionTitle title="Fulfilment path" description="Where orders are right now and how your suppliers are answering. A degraded supplier is routed around — it never marks Core unhealthy." />
            <div className="grid gap-4 xl:grid-cols-2">
              <OrderQueueCard />
              <ProvidersCard />
            </div>
          </section>

          <PerformanceCharts data={data} />

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <IncidentsCard data={data} />
            </div>
            <ResourcesCard data={data} installation={installation.data} />
          </div>
        </>
      )}
    </div>
  )
}
