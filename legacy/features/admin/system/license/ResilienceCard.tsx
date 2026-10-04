import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { BellRing, CloudOff, DatabaseZap, FileKey, Globe, ShieldCheck } from 'lucide-react'
import { Card, CardHeader, Segmented } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { Tone } from '@/types/common'

type Mode = 'normal' | 'outage'

interface Node {
  id: string
  icon: typeof FileKey
  title: string
  normal: { text: string; tone: Tone; tag: string }
  outage: { text: string; tone: Tone; tag: string }
}

const NODES: Node[] = [
  {
    id: 'file',
    icon: FileKey,
    title: 'Signed license file',
    normal: { text: 'Issued by ORVEX Systems, signed with Ed25519, stored on your server.', tone: 'neutral', tag: 'On disk' },
    outage: { text: 'Unchanged — the signed file never depends on a network connection.', tone: 'neutral', tag: 'On disk' },
  },
  {
    id: 'local',
    icon: ShieldCheck,
    title: 'Local verification',
    normal: { text: 'ORVEX Core verifies the signature at every start with the public key it ships with.', tone: 'success', tag: 'Verified' },
    outage: { text: 'Still verified locally on every start — no call home needed.', tone: 'success', tag: 'Verified' },
  },
  {
    id: 'online',
    icon: Globe,
    title: 'Periodic online check',
    normal: { text: 'Every 24 h Core checks in with license.orvex.io and receives a signed validation.', tone: 'success', tag: 'Reachable' },
    outage: { text: 'License server unreachable. Core retries every hour in the background.', tone: 'danger', tag: 'Unreachable' },
  },
  {
    id: 'cache',
    icon: DatabaseZap,
    title: 'Cached validation',
    normal: { text: 'The last signed validation is cached for 14 days of headroom.', tone: 'neutral', tag: 'Standby' },
    outage: { text: 'The cached signed validation keeps the installation fully operational.', tone: 'success', tag: 'Active · day 3 of 14' },
  },
  {
    id: 'warn',
    icon: BellRing,
    title: 'Advance warnings',
    normal: { text: 'Nothing to report — warnings only appear if validation keeps failing.', tone: 'neutral', tag: 'Idle' },
    outage: { text: 'Admins are warned by banner and email from day 7 — long before any restriction.', tone: 'warning', tag: 'From day 7' },
  },
]

const tile: Record<Tone, string> = {
  neutral: 'border-line bg-surface-2 text-fg-2',
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  danger: 'border-danger/30 bg-danger/10 text-danger',
  accent: 'border-accent/30 bg-accent/10 text-accent-ink',
  info: 'border-info/30 bg-info/10 text-info',
}
const tagTone: Record<Tone, string> = {
  neutral: 'text-fg-3',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  accent: 'text-accent-ink',
  info: 'text-info',
}

export function ResilienceCard({ graceDays = 14 }: { graceDays?: number }) {
  const [mode, setMode] = useState<Mode>('normal')
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Keeps running when the license server doesn’t"
        description="Licensing is designed for self-hosting: verification happens on your server, and a temporary outage at ORVEX Systems never stops your business."
        actions={
          <Segmented
            size="xs"
            value={mode}
            onChange={setMode}
            items={[
              { value: 'normal', label: 'Normal' },
              { value: 'outage', label: 'Server unreachable', icon: <CloudOff /> },
            ]}
          />
        }
      />
      <div className="px-5 pb-5">
        <div className="relative grid gap-3 lg:grid-cols-5">
          {NODES.map((n, i) => {
            const s = n[mode]
            return (
              <div key={n.id} className="relative">
                {i < NODES.length - 1 && <Connector broken={mode === 'outage' && n.id === 'local'} />}
                <motion.div
                  layout
                  className={cn('relative h-full rounded-xl border bg-surface p-3.5 transition-colors duration-300', mode === 'outage' && s.tone !== 'neutral' ? (s.tone === 'danger' ? 'border-danger/30' : s.tone === 'warning' ? 'border-warning/30' : 'border-success/30') : 'border-line')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('grid size-8 place-items-center rounded-lg border transition-colors duration-300 [&_svg]:size-4', tile[s.tone])}>
                      <n.icon />
                    </span>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span key={s.tag} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className={cn('font-mono text-[10.5px] tracking-wide uppercase', tagTone[s.tone])}>
                        {s.tag}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                  <p className="mt-3 text-[13px] font-semibold text-fg">
                    <span className="mr-1.5 font-mono text-[10.5px] font-normal text-fg-3">{i + 1}</span>
                    {n.title}
                  </p>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.p key={s.text} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="mt-1 text-[12px] leading-relaxed text-fg-3">
                      {s.text}
                    </motion.p>
                  </AnimatePresence>
                </motion.div>
              </div>
            )
          })}
        </div>

        <GraceTimeline mode={mode} days={graceDays} />
      </div>
    </Card>
  )
}

function Connector({ broken }: { broken: boolean }) {
  return (
    <svg aria-hidden className="pointer-events-none absolute top-1/2 -right-3 z-[1] hidden h-2 w-3 -translate-y-1/2 overflow-visible lg:block" viewBox="0 0 12 8">
      <line x1="0" y1="4" x2="12" y2="4" stroke={broken ? 'var(--line-strong)' : 'var(--accent)'} strokeWidth="1.5" strokeDasharray="3 3" className={broken ? '' : 'animate-dash'} />
    </svg>
  )
}

function GraceTimeline({ mode, days }: { mode: Mode; days: number }) {
  const today = mode === 'outage' ? 3 : 0
  const markers: { day: number; label: ReactNode; tone: Tone; above?: boolean }[] = [
    { day: 0, label: mode === 'outage' ? 'Last successful check' : 'Validated today', tone: 'success' },
    { day: 7, label: 'Banner + email to admins', tone: 'warning' },
    { day: 12, label: 'Final notice', tone: 'warning', above: true },
    { day: days, label: 'Configuration changes paused', tone: 'danger' },
  ]
  return (
    <div className="mt-5 rounded-xl border border-line bg-bg-subtle/60 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] font-medium text-fg">{days}-day grace period</p>
        <p className="text-[12px] text-fg-3">{mode === 'outage' ? 'Preview: license server unreachable for 3 days — everything still works.' : 'Each successful check restarts the full grace period.'}</p>
      </div>
      <div className="relative mt-8 mb-9">
        <div className="flex h-2 gap-[3px]">
          {Array.from({ length: days }, (_, i) => (
            <span
              key={i}
              className="flex-1 rounded-[2px] transition-colors duration-500"
              style={{
                transitionDelay: `${i * 25}ms`,
                backgroundColor:
                  mode === 'outage' && i < today
                    ? 'var(--success)'
                    : i >= 12
                      ? 'color-mix(in oklab, var(--danger) 30%, transparent)'
                      : i >= 7
                        ? 'color-mix(in oklab, var(--warning) 30%, transparent)'
                        : 'color-mix(in oklab, var(--success) 25%, transparent)',
              }}
            />
          ))}
        </div>
        {markers.map((m) => (
          <div key={m.day} className="absolute top-0 h-2" style={{ left: `${(m.day / days) * 100}%` }}>
            <span className={cn('absolute -top-1 h-4 w-px -translate-x-1/2', m.tone === 'success' ? 'bg-success' : m.tone === 'warning' ? 'bg-warning' : 'bg-danger')} />
            <span
              className={cn(
                'absolute text-[11px] whitespace-nowrap text-fg-3',
                m.above ? '-top-6' : 'top-4',
                m.day === 0 ? 'left-0' : m.day === days ? 'right-0' : '-translate-x-1/2',
                m.above && 'hidden sm:block',
              )}
            >
              <span className="font-mono text-fg-2">Day {m.day}</span>
              <span className="hidden md:inline"> · {m.label}</span>
            </span>
          </div>
        ))}
        <AnimatePresence>
          {mode === 'outage' && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute -top-7" style={{ left: `${(today / days) * 100}%` }}>
              <span className="inline-block -translate-x-1/2 rounded-md bg-fg px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap text-bg">Today</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="text-[12px] text-fg-3">
        IMEI checks, unlock orders, supplier callbacks, the Reseller API and your website keep running throughout — after day {days} only configuration changes are paused until the license validates again.
      </p>
    </div>
  )
}
