import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type { Tone } from '@/types/common'
import { toneBg } from './badgeTones'

const soft: Record<Tone, string> = {
  neutral: 'bg-fg/[0.06] text-fg-2 ring-fg/[0.08]',
  accent: 'bg-accent/10 text-accent-ink ring-accent/20',
  success: 'bg-success/10 text-success ring-success/20',
  warning: 'bg-warning/12 text-warning ring-warning/25',
  danger: 'bg-danger/10 text-danger ring-danger/20',
  info: 'bg-info/10 text-info ring-info/20',
}

const solid: Record<Tone, string> = {
  neutral: 'bg-fg text-bg ring-transparent',
  accent: 'bg-accent text-white ring-transparent',
  success: 'bg-success text-white ring-transparent',
  warning: 'bg-warning text-black ring-transparent',
  danger: 'bg-danger text-white ring-transparent',
  info: 'bg-info text-white ring-transparent',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  variant?: 'soft' | 'solid' | 'outline'
  size?: 'sm' | 'md'
  dot?: boolean
  pulse?: boolean
  icon?: ReactNode
}

export function Badge({ tone = 'neutral', variant = 'soft', size = 'sm', dot, pulse, icon, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ring-1 ring-inset tabular [&_svg]:size-3',
        size === 'sm' ? 'h-5 px-2 text-[11.5px]' : 'h-6 px-2.5 text-xs',
        variant === 'solid' ? solid[tone] : variant === 'outline' ? cn('bg-transparent', soft[tone].split(' ').filter((c) => c.startsWith('text') || c.startsWith('ring')).join(' ')) : soft[tone],
        className,
      )}
      {...rest}
    >
      {dot && <Dot tone={tone} pulse={pulse} />}
      {icon}
      {children}
    </span>
  )
}

export function Dot({ tone = 'neutral', pulse, className }: { tone?: Tone; pulse?: boolean; className?: string }) {
  return (
    <span className={cn('relative inline-flex size-1.5 shrink-0', className)}>
      {pulse && <span className={cn('absolute inset-0 rounded-full animate-pulse-ring', toneBg[tone])} />}
      <span className={cn('relative inline-flex size-full rounded-full', toneBg[tone])} />
    </span>
  )
}
