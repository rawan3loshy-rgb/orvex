import { Link } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpRight, LoaderCircle } from 'lucide-react'
import { Badge, Dot, Skeleton, StatusBadge } from '@/components/ui'
import { cn } from '@/lib/cn'
import { ago } from '@/lib/format'
import type { HealthComponent } from '@/types/installation'
import { COMPONENT_META, STATE_COLOR, STATE_TONE } from './meta'
import { useNow } from './useNow'

const ATTENTION_LABEL: Partial<Record<HealthComponent['id'], string>> = {
  updates: 'Update available',
  license: 'Action needed',
}

export function ComponentGrid({ components, checking, round }: { components: HealthComponent[] | undefined; checking: boolean; round: number }) {
  useNow(1000)
  if (!components) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="rounded-xl border border-line bg-surface p-4 shadow-card">
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-lg" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="mt-4 h-3.5 w-full" />
            <Skeleton className="mt-2 h-3.5 w-2/3" />
            <Skeleton className="mt-5 h-4 w-20" />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {components.map((c, i) => (
        <ComponentCard key={c.id} c={c} index={i} checking={checking} round={round} />
      ))}
    </div>
  )
}

function ComponentCard({ c, index, checking, round }: { c: HealthComponent; index: number; checking: boolean; round: number }) {
  const meta = COMPONENT_META[c.id]
  const Icon = meta.icon
  const color = STATE_COLOR[c.status]
  // Healthy components stay graphite; colour is reserved for what needs a look.
  const calm = c.status === 'healthy'
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.035, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
      <Link
        to={meta.to}
        className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface p-4 shadow-card transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-line-strong hover:shadow-pop"
      >
        {/* Re-check sweep */}
        <AnimatePresence>
          {checking && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-1/2"
              style={{ background: 'linear-gradient(90deg, transparent, color-mix(in oklab, var(--accent) 9%, transparent), transparent)' }}
              initial={{ left: '-50%', opacity: 0 }}
              animate={{ left: ['-50%', '110%'], opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ left: { duration: 1.1, repeat: Infinity, ease: 'easeInOut', delay: index * 0.07 }, opacity: { duration: 0.2 } }}
            />
          )}
        </AnimatePresence>
        {/* status tick — a short hairline in the component's status colour */}
        <span aria-hidden className="absolute top-0 left-4 h-0.5 w-8 rounded-b-sm" style={{ background: color }} />

        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cn('grid size-9 shrink-0 place-items-center rounded-lg [&_svg]:size-4', calm && 'border border-line bg-surface-2 text-fg-2')}
              style={calm ? undefined : { color, background: `color-mix(in oklab, ${color} 10%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 24%, transparent)` }}
            >
              <Icon />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold tracking-[-0.01em] text-fg">{c.name}</p>
              <p className="truncate text-[11.5px] text-fg-3">{meta.hint}</p>
            </div>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            {checking ? (
              <motion.span key="checking" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                <Badge tone="neutral" icon={<LoaderCircle className="animate-spin" />}>
                  Checking
                </Badge>
              </motion.span>
            ) : (
              <motion.span key={`s-${round}`} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: round ? index * 0.06 : 0 }}>
                {c.status === 'attention' ? (
                  <Badge tone={STATE_TONE[c.status]} dot>
                    {ATTENTION_LABEL[c.id] ?? 'Attention'}
                  </Badge>
                ) : (
                  <StatusBadge status={c.status} />
                )}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-3 line-clamp-2 min-h-[38px] text-[12.5px] leading-relaxed text-fg-2">{c.summary}</p>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
          <span className="truncate font-mono text-[12.5px] text-fg tabular">{c.metric}</span>
          <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-fg-3">
            <Dot tone={STATE_TONE[c.status]} pulse={!checking} />
            {checking ? <span className="font-mono text-[10.5px]">{meta.probe}…</span> : `${ago(c.checkedAt)} ago`}
            <ArrowUpRight className="size-3.5 -translate-x-1 opacity-0 transition-[opacity,transform] group-hover:translate-x-0 group-hover:opacity-100" />
          </span>
        </div>
      </Link>
    </motion.div>
  )
}
