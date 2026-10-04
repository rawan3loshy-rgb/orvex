/**
 * API clients = accounts with the Reseller API (native) or DHRU channel enabled.
 * Keys, pricing tier, service access, limits and wallet all belong to the
 * account — there is no separate "API client" record to keep in sync.
 */
import { useMemo } from 'react'
import { useAccounts, useApiKeys } from '@/hooks/installation'
import type { AccountRow, ApiKeyRow, ServiceAccess } from '@/types/installation'

export interface ApiClientRow {
  row: AccountRow
  keys: ApiKeyRow[]
  activeKeys: number
  requests24h: number
  lastUsedAt: string | null
}

export function useApiClients() {
  const accounts = useAccounts({ kind: 'customer', pageSize: 200 })
  const keys = useApiKeys()
  const data = useMemo<ApiClientRow[] | undefined>(() => {
    if (!accounts.data || !keys.data) return undefined
    return accounts.data.items
      .filter((r) => r.account.channels.api || r.account.channels.dhru)
      .map((row) => {
        const own = keys.data.filter((k) => k.accountId === row.account.id)
        const active = own.filter((k) => k.status === 'active')
        const lastUsedAt = own.map((k) => k.lastUsedAt).filter((x): x is string => !!x).sort().pop() ?? null
        return { row, keys: own, activeKeys: active.length, requests24h: active.reduce((a, k) => a + k.requests24h, 0), lastUsedAt }
      })
      .sort((a, b) => b.requests24h - a.requests24h || a.row.account.name.localeCompare(b.row.account.name))
  }, [accounts.data, keys.data])
  return { data, isLoading: accounts.isLoading || keys.isLoading, isError: accounts.isError || keys.isError, error: accounts.error ?? keys.error, refetch: () => Promise.all([accounts.refetch(), keys.refetch()]) }
}

export function accessLabel(sa: ServiceAccess, categoryNames?: Map<string, string>) {
  if (sa.mode === 'all') return 'All services'
  if (sa.mode === 'services') return `${sa.serviceIds.length} services`
  if (categoryNames && sa.categoryIds.length <= 2) return sa.categoryIds.map((id) => categoryNames.get(id) ?? id).join(', ')
  return `${sa.categoryIds.length} categories`
}
