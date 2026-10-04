import { motion } from 'motion/react'
import { ChevronRight, Lock } from 'lucide-react'
import { Badge, Switch, Tooltip } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { InstalledExtension } from '@/types/extensions'
import { authorLabel, KIND_META, SOURCE_META } from './meta'
import { CompatIndicator, type CompatContext } from './Compat'

export function KindIcon({ kind, size = 'md' }: { kind: InstalledExtension['kind']; size?: 'sm' | 'md' | 'lg' }) {
  const m = KIND_META[kind]
  const Icon = m.icon
  return (
    <span
      className={cn('grid shrink-0 place-items-center', size === 'sm' ? 'size-7 rounded-md [&_svg]:size-3.5' : size === 'lg' ? 'size-11 rounded-xl [&_svg]:size-5' : 'size-9 rounded-lg [&_svg]:size-4')}
      style={{ color: m.color, background: `color-mix(in oklab, ${m.color} 11%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${m.color} 24%, transparent)` }}
    >
      <Icon />
    </span>
  )
}

export function SourceBadge({ source }: { source: InstalledExtension['source'] }) {
  const m = SOURCE_META[source]
  return (
    <Tooltip content={m.hint}>
      <Badge tone={m.tone} variant={source === 'core' ? 'outline' : 'soft'}>
        {m.label}
      </Badge>
    </Tooltip>
  )
}

export function ExtensionRow({
  ext,
  ctx,
  index,
  pending,
  onOpen,
  onToggle,
}: {
  ext: InstalledExtension
  ctx: CompatContext
  index: number
  pending: boolean
  onOpen: () => void
  onToggle: (enabled: boolean) => void
}) {
  const incompatible = ext.status === 'incompatible'
  const enabled = ext.status === 'enabled'
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 10) * 0.03, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())}
      role="button"
      tabIndex={0}
      className={cn(
        'group relative flex cursor-pointer flex-col gap-3 border-b border-line px-5 py-4 transition-colors last:border-b-0 hover:bg-surface-2/60 focus-visible:bg-surface-2/60 focus-visible:outline-none sm:flex-row sm:items-center sm:gap-5',
        !enabled && 'bg-bg-subtle/40',
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        <div className={cn('transition-opacity', !enabled && 'opacity-60')}>
          <KindIcon kind={ext.kind} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn('text-[13.5px] font-semibold tracking-[-0.01em]', enabled ? 'text-fg' : 'text-fg-2')}>{ext.name}</span>
            <SourceBadge source={ext.source} />
            <span className="font-mono text-[11.5px] text-fg-3">v{ext.version}</span>
            {incompatible && <Badge tone="warning">Incompatible</Badge>}
            {ext.status === 'disabled' && <Badge tone="neutral">Disabled</Badge>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-fg-3">
            <span className="font-mono text-[11.5px] text-fg-2">{ext.id}</span>
            <span>·</span>
            <span>{authorLabel(ext.author)}</span>
            <span>·</span>
            <span>
              Core <span className="font-mono text-[11.5px] text-fg-2">{ext.coreRange}</span>
            </span>
          </div>
          <p className="mt-1.5 line-clamp-1 text-[12.5px] text-fg-2">{ext.description}</p>
          {ext.permissions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {ext.permissions.map((p) => (
                <span key={p} className="inline-flex h-5 items-center gap-1 rounded-md border border-line bg-surface-2 px-1.5 font-mono text-[10.5px] text-fg-2">
                  <Lock className="size-2.5 text-fg-3" />
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 pl-[50px] sm:justify-end sm:pl-0">
        <CompatIndicator ext={ext} ctx={ctx} />
        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <Tooltip content={incompatible ? 'Incompatible with the running Core — install a compatible version to enable.' : enabled ? 'Disable extension' : 'Enable extension'}>
            <span className="inline-flex">
              <Switch checked={enabled} disabled={incompatible || pending} onChange={onToggle} label={`${enabled ? 'Disable' : 'Enable'} ${ext.name}`} />
            </span>
          </Tooltip>
          <ChevronRight className="hidden size-4 text-fg-3 transition-transform group-hover:translate-x-0.5 sm:block" />
        </div>
      </div>
    </motion.div>
  )
}
