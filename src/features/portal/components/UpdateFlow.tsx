import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { ArchiveRestore, CloudDownload, Database, HeartPulse, Package, RefreshCw, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/cn'
import { EASE } from './kitUtils'

const UPDATE_STEPS = [
  { id: 'preflight', label: 'Preflight', detail: 'Signature, entitlement, disk & extension checks', icon: ShieldCheck },
  { id: 'backup', label: 'Backup', detail: 'Database snapshot and config archive', icon: ArchiveRestore },
  { id: 'migrate', label: 'Migrate (expand)', detail: 'Additive only — old workers keep running', icon: Database },
  { id: 'drain', label: 'Drain workers', detail: 'core-worker finishes in-flight jobs', icon: CloudDownload },
  { id: 'swap', label: 'Swap containers', detail: 'core-api, worker and scheduler on the new image', icon: Package },
  { id: 'health', label: 'Health check', detail: 'Automatic rollback if checks fail', icon: HeartPulse },
  { id: 'complete', label: 'Complete', detail: 'Heartbeat reports the new version', icon: RefreshCw },
] as const

/**
 * Visual explanation of the in-installation update pipeline. A soft highlight
 * walks through the steps so the order reads at a glance.
 */
export function UpdateFlow({ migration, className }: { migration?: { from: string; to: string } | null; className?: string }) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const t = setInterval(() => setActive((a) => (a + 1) % (UPDATE_STEPS.length + 2)), 1100)
    return () => clearInterval(t)
  }, [paused])

  const current = Math.min(active, UPDATE_STEPS.length - 1)
  const done = active >= UPDATE_STEPS.length
  const n = UPDATE_STEPS.length

  return (
    <div className={cn('relative', className)} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {/* Desktop rail */}
      <div aria-hidden className="absolute top-5 hidden h-px bg-line lg:block" style={{ left: `${50 / n}%`, right: `${50 / n}%` }} />
      <motion.div
        aria-hidden
        className="absolute top-5 hidden h-px bg-accent lg:block"
        style={{ left: `${50 / n}%` }}
        animate={{ width: `${(current / (n - 1)) * (100 - 100 / n)}%` }}
        transition={{ duration: 0.6, ease: EASE }}
      />
      {/* Mobile rail */}
      <div aria-hidden className="absolute top-5 bottom-5 left-5 w-px bg-line lg:hidden" />

      <ol className="relative grid gap-4 lg:grid-cols-7 lg:gap-2">
        {UPDATE_STEPS.map((s, i) => {
          const Icon = s.icon
          const state = done || i < current ? 'done' : i === current ? 'active' : 'todo'
          const detail = s.id === 'migrate' && migration ? `Schema ${migration.from} → ${migration.to}, expand-only` : s.detail
          return (
            <li key={s.id} className="relative flex items-start gap-3.5 lg:flex-col lg:items-center lg:gap-3 lg:text-center" onMouseEnter={() => setActive(i)}>
              <span
                className={cn(
                  'relative z-[1] grid size-10 shrink-0 place-items-center rounded-xl border transition-[background-color,border-color,color,box-shadow] duration-300 [&_svg]:size-4',
                  state === 'active' && 'border-accent bg-accent text-accent-fg shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent)_16%,transparent)]',
                  state === 'done' && 'border-accent/30 bg-surface text-accent-ink',
                  state === 'todo' && 'border-line bg-surface text-fg-3',
                )}
              >
                <Icon />
                <span className="absolute -top-1.5 -right-1.5 grid size-4 place-items-center rounded-full border border-line bg-surface font-mono text-[9px] text-fg-3 tabular">{i + 1}</span>
              </span>
              <div className="min-w-0 pt-0.5 lg:pt-0">
                <p className={cn('text-[13px] font-medium transition-colors', state === 'todo' ? 'text-fg-2' : 'text-fg')}>{s.label}</p>
                <p className="mt-0.5 text-[12px] leading-snug text-fg-3">{detail}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
