import { useMe } from '@/hooks/installation'
import type { Permission } from '@/types/installation'

/** Does the current operator's role grant this permission? (Server enforces it too.) */
export function useCan(permission: Permission): boolean {
  const me = useMe()
  return !!me.data?.permissions.includes(permission)
}
