import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CircleCheck, OctagonAlert, RefreshCw, TriangleAlert } from 'lucide-react'
import { Button, Card, Dot, Skeleton, Tooltip } from '@/components/ui'
import { cn } from '@/lib/cn'
import { ago, date, duration, ms, pct, plural } from '@/lib/format'
import type { HealthSnapshot } from '@/types/installation'
import { OVERALL_COPY, STATE_COLOR, STATE_TONE } from './meta'
import { useNow } from './useNow'

const PROBE_INTERVAL_S = 10

export function HealthHero({ data, checking, onRefresh, domain, restartedAt }: { data: HealthSnapshot | undefined; checking: boolean; onRefresh: () => void; domain?: string; restartedAt?: string }) {
  const now = useNow(1000)
  if (!data) return <HeroSkeleton />

  const healthy = data.components.filter((c) => c.status === 'healthy').length
  const attention = data.components.filter((c) => c.status === 'attention')
  const problems = data.components.filter((c) => c.status === 'degraded' || c.status === 'down')
  const copy = OVERALL_COPY[data.overall]
  const color = STATE_COLOR[data.overall]
  const since = restartedAt && new Date(restartedAt) > new Date(data.uptime.since) ? restartedAt : data.uptime.since
  const sinceRestart = Math.max(0, (now - new Date(since).getTime()) / 1000)
  const sinceCheck = Math.max(0, Math.floor((now - new Date(data.checkedAt).getTime()) / 1000))
  const nextProbe = PROBE_INTERVAL_S - (sinceCheck % PROBE_INTERVAL_S)
  const Icon = data.overall === 'down' ? OctagonAlert : data.overall === 'degraded' ? TriangleAlert : CircleCheck

  return (
    <Card className="overflow-hidden">
      {/* Status rail — a single hairline in the overall status colour */}
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 transition-colors duration-500" style={{ background: color }} />

      <div className="relative grid lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
        <div className="flex min-w-0 items-start gap-4 p-5 sm:gap-5 sm:p-6">
          <StatusOrb color={color} checking={checking}>
            <Icon className="size-6" style={{ color }} />
          </StatusOrb>
          <div className="min-w-0 flex-1">
            <div className="mono-label flex flex-wrap items-center gap-x-2 gap-y-1">
              <Dot tone={STATE_TONE[data.overall]} pulse={!checking} />
              Installation status
              {domain && <span className="font-mono tracking-normal normal-case text-fg-3">· {domain}</span>}
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.h2
                key={checking ? 'checking' : copy.title}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
                className="mt-2 font-display text-[24px] leading-tight font-semibold tracking-[-0.025em] text-fg sm:text-[28px]"
              >
                {checking ? 'Running health checks…' : copy.title}
              </motion.h2>
            </AnimatePresence>
            <p className="mt-1 max-w-xl text-[13.5px] text-fg-2">
              {checking ? `Probing ${plural(data.components.length, 'component')} — database, order queue, Reseller API, storage and license cache.` : copy.lead}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-fg-3">
              <span className="text-fg-2">
                <span className="font-medium text-fg tabular">{healthy}</span>/{data.components.length} healthy
              </span>
              {attention.length > 0 && (
                <span>
                  · <span className="text-fg-2">{attention.length} awaiting action</span> ({attention.map((a) => a.name).join(', ')})
                </span>
              )}
              {problems.length > 0 && <span className="text-warning">· {problems.map((p) => p.name).join(', ')} affected</span>}
              <span>· Last checked {ago(data.checkedAt)} ago</span>
            </div>
            <ProbeTrack data={data} checking={checking} healthy={healthy} />
          </div>
        </div>

        {/* Readout */}
        <div className="flex min-w-0 flex-col justify-between gap-5 border-t border-line bg-surface-2/40 p-5 sm:p-6 lg:border-t-0 lg:border-l">
          <dl className="grid grid-cols-3 divide-x divide-line">
            <HeroStat label="Uptime · 30d" value={pct(data.uptime.percent30d, 2)} sub="SLA target 99.9%" keyMetric />
            <HeroStat label="Since restart" value={duration(sinceRestart).replace(/ \d+s$/, '')} sub={`since ${date(since)}`} />
            <HeroStat label="API p50" value={ms(data.metrics.apiLatencyP50)} sub={`p95 ${ms(data.metrics.apiLatencyP95)}`} />
          </dl>
          <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
            <span className="min-w-0 truncate font-mono text-[11px] text-fg-3 tabular">{checking ? 'probing…' : `interval ${PROBE_INTERVAL_S}s · next in ${nextProbe}s`}</span>
            <Button variant="secondary" size="sm" onClick={onRefresh} disabled={checking} leading={<RefreshCw className={cn(checking && 'animate-spin')} />} className="shrink-0">
              {checking ? 'Checking…' : 'Run checks'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

function HeroStat({ label, value, sub, keyMetric }: { label: string; value: string; sub: string; keyMetric?: boolean }) {
  return (
    <div className="min-w-0 px-3 first:pl-0 last:pr-0 sm:px-4">
      <dt className="mono-label flex items-center gap-1.5 truncate">
        {keyMetric && <span aria-hidden className="inline-block size-1.5 shrink-0 rounded-[1px] bg-accent" />}
        <span className="truncate">{label}</span>
      </dt>
      <dd className="mt-2 truncate font-display text-[21px] leading-none font-semibold tracking-[-0.02em] text-fg tabular sm:text-[24px]">{value}</dd>
      <dd className="mt-1.5 truncate text-[11.5px] text-fg-3">{sub}</dd>
    </div>
  )
}

/** Instrument-style status dial: a dashed bezel, a sweep arc while probing. */
function StatusOrb({ color, checking, children }: { color: string; checking: boolean; children: ReactNode }) {
  return (
    <div className="relative grid size-14 shrink-0 place-items-center sm:size-16">
      <svg aria-hidden viewBox="0 0 64 64" className="absolute inset-0 size-full">
        <circle cx="32" cy="32" r="31" fill="none" stroke={color} strokeOpacity={0.4} strokeWidth="1" strokeDasharray="1.5 3.5" />
      </svg>
      {checking && (
        <motion.svg aria-hidden viewBox="0 0 64 64" className="absolute inset-0 size-full" animate={{ rotate: 360 }} transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}>
          <circle cx="32" cy="32" r="31" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeDasharray="34 161" />
        </motion.svg>
      )}
      <span className="absolute inset-1.5 rounded-full" style={{ background: `color-mix(in oklab, ${color} 10%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 28%, transparent)` }} />
      <span className="relative">{children}</span>
    </div>
  )
}

/** One segment per probe on a hatched track. */
function ProbeTrack({ data, checking, healthy }: { data: HealthSnapshot; checking: boolean; healthy: number }) {
  return (
    <div className="mt-4 max-w-md">
      <div className="flex gap-0.75 rounded-sm bg-hatch p-0.75 shadow-[inset_0_0_0_1px_var(--line)]">
        {data.components.map((c, i) => (
          <Tooltip key={c.id} content={`${c.name} · ${c.status === 'attention' ? 'needs attention' : c.status}`} className="flex-1">
            <motion.span
              className="block h-1.5 w-full rounded-[1.5px]"
              style={{ background: STATE_COLOR[c.status] }}
              animate={checking ? { opacity: [1, 0.2, 1] } : { opacity: c.status === 'healthy' ? 0.8 : 1 }}
              transition={checking ? { duration: 0.9, repeat: Infinity, delay: i * 0.08 } : { duration: 0.3 }}
            />
          </Tooltip>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10.5px] text-fg-3 tabular">
        <span>{plural(data.components.length, 'probe')}</span>
        <span>
          {healthy}/{data.components.length} passing
        </span>
      </div>
    </div>
  )
}

function HeroSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
        <div className="flex items-start gap-5 p-6">
          <Skeleton className="size-16 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-7 w-72 max-w-full" />
            <Skeleton className="h-3.5 w-80 max-w-full" />
            <Skeleton className="mt-4 h-3 w-96 max-w-full" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-6 border-t border-line p-6 lg:border-t-0 lg:border-l">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
