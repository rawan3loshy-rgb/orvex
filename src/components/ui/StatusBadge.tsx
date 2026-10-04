import type { Tone } from '@/types/common'
import { Badge, type BadgeProps } from './Badge'
import { STATUS_META, statusLabel } from './statusMeta'

export function StatusBadge({ status, label, noPulse, ...rest }: { status: string; label?: string; noPulse?: boolean } & Omit<BadgeProps, 'tone'>) {
  const m = STATUS_META[status] ?? { tone: 'neutral' as Tone, label: statusLabel(status) }
  return (
    <Badge tone={m.tone} dot pulse={!noPulse && m.pulse} {...rest}>
      {label ?? m.label}
    </Badge>
  )
}
