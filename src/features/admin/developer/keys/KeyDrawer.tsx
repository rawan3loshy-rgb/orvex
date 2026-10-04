import { useState } from 'react'
import { Link } from 'react-router'
import { Ban, KeyRound, ScrollText, Terminal } from 'lucide-react'
import { useInstMutation } from '@/hooks/installation'
import { developerService } from '@/services/installation'
import type { ApiKeyRow } from '@/types/installation'
import { Button, ConfirmDialog, Drawer, Field, StatusBadge, Textarea } from '@/components/ui'
import { Guarded, PermissionHint } from '@/components/domain'
import { dateTime, num } from '@/lib/format'
import { Cell, DhruChip, EnvBadge, KeyId } from '../shared'
import { SCOPES, sinceShort } from '../helpers'

export function RevokeKeyDialog({ apiKey, open, onClose }: { apiKey: ApiKeyRow | null; open: boolean; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const revoke = useInstMutation((v: { id: string; reason: string }) => developerService.revokeApiKey(v.id, v.reason), {
    success: 'API key revoked',
    onSuccess: () => {
      setReason('')
      onClose()
    },
  })
  return (
    <ConfirmDialog
      open={open && !!apiKey}
      onClose={onClose}
      tone="danger"
      title="Revoke API key?"
      description={apiKey ? `${apiKey.accountName} · ${apiKey.name}` : undefined}
      confirmLabel="Revoke key"
      loading={revoke.isPending}
      onConfirm={() => apiKey && reason.trim() && revoke.mutate({ id: apiKey.id, reason: reason.trim() })}
    >
      <div className="space-y-3">
        <p className="text-[13px] text-fg-2">
          Requests with <span className="font-mono text-fg">{apiKey?.prefix}_…</span> are refused immediately with <span className="font-mono">401 invalid_api_key</span>
          {apiKey?.dhruCompat ? ', including the DHRU-compatible endpoint' : ''}. This cannot be undone.
        </p>
        <Field label="Reason" hint="Written to the audit log.">
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Key exposed in a support ticket" autoFocus />
        </Field>
      </div>
    </ConfirmDialog>
  )
}

export function KeyDrawer({ apiKey: k, open, onClose, onRevoke }: { apiKey: ApiKeyRow | undefined; open: boolean; onClose: () => void; onRevoke: (k: ApiKeyRow) => void }) {
  return (
    <Drawer
      open={open && !!k}
      onClose={onClose}
      width="md"
      icon={<KeyRound />}
      title={k?.name}
      description={k && <KeyId apiKey={k} />}
      footer={
        k && (
          <>
            {k.status === 'active' && <PermissionHint permission="developer.manage" className="mr-auto" />}
            <Button variant="ghost" leading={<ScrollText />} to={`/admin/developer/logs?search=${encodeURIComponent(k.prefix)}`}>
              Logs
            </Button>
            {k.status === 'active' && (
              <Guarded permission="developer.manage">
                {(ok) => (
                  <Button variant="danger" leading={<Ban />} disabled={!ok} onClick={() => onRevoke(k)}>
                    Revoke
                  </Button>
                )}
              </Guarded>
            )}
          </>
        )
      }
    >
      {k && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">
            <Cell label="Account">
              <Link to={`/admin/accounts/${k.accountId}`} className="hover:text-accent-ink">
                {k.accountName}
              </Link>
            </Cell>
            <Cell label="Status">
              <StatusBadge status={k.status} />
            </Cell>
            <Cell label="Environment">
              <EnvBadge env={k.environment} />
            </Cell>
            <Cell label="DHRU compatible">{k.dhruCompat ? <DhruChip /> : <span className="text-fg-3">No</span>}</Cell>
            <Cell label="Requests · 24h">{num(k.requests24h)}</Cell>
            <Cell label="Rate limit">{num(k.rateLimitPerMin)}/min</Cell>
            <Cell label="Last used">{sinceShort(k.lastUsedAt)}</Cell>
            <Cell label="Expires">{k.expiresAt ? dateTime(k.expiresAt) : 'Never'}</Cell>
            <Cell label="Created" className="col-span-2">
              {dateTime(k.createdAt)} <span className="text-fg-3">· by {k.createdBy}</span>
            </Cell>
          </div>

          <section>
            <h4 className="mb-2 text-[13px] font-semibold">Stored hash</h4>
            <div className="rounded-lg border border-line bg-surface-2/50 px-3 py-2 font-mono text-[12px] break-all text-fg-2">{k.hash}</div>
            <p className="mt-1.5 text-[12px] text-fg-3">The secret itself was shown once at creation. Only this sha256 hash is stored, so it can be verified but never displayed.</p>
          </section>

          <section>
            <h4 className="mb-2 text-[13px] font-semibold">Scopes</h4>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
              {SCOPES.map((s) => {
                const on = k.scopes.includes(s.id)
                return (
                  <li key={s.id} className="flex items-start gap-3 px-3 py-2.5">
                    <span className={on ? 'mt-1 size-2 shrink-0 rounded-full bg-success' : 'mt-1 size-2 shrink-0 rounded-full border border-line-strong'} />
                    <div className="min-w-0">
                      <code className={on ? 'font-mono text-[12px] text-fg' : 'font-mono text-[12px] text-fg-3 line-through'}>{s.id}</code>
                      <p className="text-[12px] text-fg-3">{s.description}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>

          <section>
            <h4 className="mb-2 text-[13px] font-semibold">IP allow-list</h4>
            {k.ipAllowlist.length ? (
              <div className="flex flex-wrap gap-1.5">
                {k.ipAllowlist.map((ip) => (
                  <code key={ip} className="rounded-md border border-line bg-surface-2 px-2 py-0.5 font-mono text-[12px] text-fg">
                    {ip}
                  </code>
                ))}
              </div>
            ) : (
              <p className="text-[12.5px] text-fg-3">Any IP — no allow-list configured.</p>
            )}
          </section>

          {k.status === 'active' && (
            <Button variant="secondary" leading={<Terminal />} to="/admin/developer/api?view=console" className="w-full">
              Try this key in the API console
            </Button>
          )}
        </div>
      )}
    </Drawer>
  )
}
