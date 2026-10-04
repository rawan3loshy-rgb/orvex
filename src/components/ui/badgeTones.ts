import type { Tone } from '@/types/common'

/** Solid tone fill (as used by status dots). */
export const toneBg: Record<Tone, string> = {
  neutral: 'bg-fg-3',
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
}

export const toneText: Record<Tone, string> = {
  neutral: 'text-fg-2',
  accent: 'text-accent-ink',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
}
