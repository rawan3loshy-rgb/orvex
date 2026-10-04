import { CircleCheck, TriangleAlert } from 'lucide-react'
import { Tooltip } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { InstalledExtension } from '@/types/extensions'
import { satisfies } from '../updates/lib'
import { maintainerOf } from './meta'

export interface CompatContext {
  /** Version currently running. */
  current: string
  /** Version offered by the Update Center, if any. */
  next: string | null
}

export function compatFor(ext: InstalledExtension, ctx: CompatContext) {
  if (ctx.next) {
    return ext.compatibleWithNext
      ? { ok: true, label: `Compatible with ${ctx.next}`, hint: `Declares ${ext.coreRange} — keeps working after updating to ${ctx.next}.` }
      : { ok: false, label: `Not compatible with ${ctx.next}`, hint: `Declares ${ext.coreRange}, which excludes ${ctx.next}. It will be disabled during the update; ask ${maintainerOf(ext.author)} for a compatible release.` }
  }
  const ok = ext.status !== 'incompatible' && satisfies(ctx.current, ext.coreRange)
  return ok
    ? { ok: true, label: `Compatible with ${ctx.current}`, hint: `Declares ${ext.coreRange} — supports the running Core ${ctx.current}.` }
    : { ok: false, label: `Incompatible with ${ctx.current}`, hint: `Declares ${ext.coreRange}, which excludes Core ${ctx.current}. It stays disabled until a compatible version is installed.` }
}

export function CompatIndicator({ ext, ctx, className }: { ext: InstalledExtension; ctx: CompatContext; className?: string }) {
  const c = compatFor(ext, ctx)
  return (
    <Tooltip content={c.hint}>
      <span className={cn('inline-flex items-center gap-1.5 text-[12px] whitespace-nowrap', c.ok ? 'text-fg-2' : 'font-medium text-warning', className)}>
        {c.ok ? <CircleCheck className="size-3.5 text-success" /> : <TriangleAlert className="size-3.5" />}
        {c.label}
      </span>
    </Tooltip>
  )
}
