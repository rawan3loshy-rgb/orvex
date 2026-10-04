import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { Tooltip } from '@/components/ui'
import { usePermissionCatalog } from '@/hooks/installation'
import type { Permission } from '@/types/installation'
import { cn } from '@/lib/cn'
import { useCan } from './useCan'

/** Small "Requires …" hint shown next to sensitive actions. */
export function PermissionHint({ permission, className }: { permission: Permission; className?: string }) {
  const catalog = usePermissionCatalog()
  const can = useCan(permission)
  const label = catalog.data?.[permission]?.label ?? permission
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11.5px]', can ? 'text-fg-3' : 'text-warning', className)} title={catalog.data?.[permission]?.description}>
      <Lock className="size-3" />
      Requires {label}
      {!can && ' — your role does not have it'}
    </span>
  )
}

/**
 * Wrap a sensitive action. Without the permission the child is shown disabled
 * with an explanation (the API would also refuse with 403 permission_denied).
 */
export function Guarded({ permission, children, className }: { permission: Permission; children: (allowed: boolean) => ReactNode; className?: string }) {
  const can = useCan(permission)
  const catalog = usePermissionCatalog()
  if (can) return <>{children(true)}</>
  return (
    <Tooltip content={`Requires “${catalog.data?.[permission]?.label ?? permission}” — switch role in DEMO / SIMULATION to try it`}>
      <span className={cn('inline-flex', className)}>{children(false)}</span>
    </Tooltip>
  )
}
