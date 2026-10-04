import { TriangleAlert } from 'lucide-react'
import { useInstMutation } from '@/hooks/installation'
import { developerService } from '@/services/installation'
import type { ApiKey } from '@/types/installation'
import { ConfirmDialog } from '@/components/ui'
import { num } from '@/lib/format'
import { EnvBadge, KeyId, sinceShort } from '../shared'

/** Confirmation + mutation for revoking an API key. Pass `apiKey={null}` to close. */
export function RevokeKeyDialog({ apiKey, ownerName, onClose, onRevoked }: { apiKey: ApiKey | null; ownerName?: string; onClose: () => void; onRevoked?: (k: ApiKey) => void }) {
  const revoke = useInstMutation((id: string) => developerService.revokeApiKey(id), {
    success: (k) => `Revoked “${k.name}”`,
    onSuccess: (k) => {
      onRevoked?.(k)
      onClose()
    },
  })
  return (
    <ConfirmDialog
      open={!!apiKey}
      onClose={onClose}
      tone="danger"
      title="Revoke API key?"
      description="New requests with this key fail immediately with 401 invalid_api_key. Orders already placed — unlocks in progress, pending codes — still complete and fire their webhooks. This cannot be undone."
      confirmLabel="Revoke key"
      loading={revoke.isPending}
      onConfirm={() => apiKey && revoke.mutate(apiKey.id)}
    >
      {apiKey && (
        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-surface-2/60 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-[13px] font-medium text-fg">{apiKey.name}</span>
              <EnvBadge env={apiKey.environment} />
            </div>
            <KeyId apiKey={apiKey} className="mt-1" />
            <div className="mt-1.5 text-[12px] text-fg-3">
              {ownerName ?? 'Internal'} · {num(apiKey.requests24h)} requests in 24h · last request {sinceShort(apiKey.lastUsedAt).toLowerCase()}
            </div>
          </div>
          {apiKey.requests24h > 0 && (
            <p className="flex items-start gap-2 text-[12.5px] text-warning">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              This key is actively used. Make sure {ownerName ?? 'the integration'} has switched its shop or panel to a new key first.
            </p>
          )}
        </div>
      )}
    </ConfirmDialog>
  )
}
