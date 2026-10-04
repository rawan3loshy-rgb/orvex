import { useState } from 'react'
import { Fingerprint, Gauge, Hash, KeyRound, Laptop, Lock, LogOut, Network, Plus, Repeat, ScrollText, ShieldCheck, ShieldAlert, Timer, X } from 'lucide-react'
import { Avatar, Badge, Button, Card, CardHeader, ConfirmDialog, Input, PageHeader, SecretField, Switch } from '@/components/ui'
import { Guarded, PermissionHint, useCan } from '@/components/domain'
import { useInstMutation, useMe, useSettings, useUsers } from '@/hooks/installation'
import { systemService } from '@/services/installation'
import { relative } from '@/lib/format'
import type { AdminSession, AdminUser, InstallationSettings } from '@/types/installation'
import { CardSkeleton, KV, PrototypeNote, QueryError } from './shared'
import { toInt } from './settings/sectionForm'

type UserRow = AdminUser & { roleName: string }
const CIDR_RE = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/

export default function SecurityPage() {
  const settings = useSettings()
  const users = useUsers()
  const sec = settings.data?.security

  return (
    <div className="space-y-6">
      <PageHeader icon={<ShieldCheck />} eyebrow="System" title="Security" description="How access to this installation and its secrets is controlled." actions={<PermissionHint permission="system.manage" />} />
      <PrototypeNote>
        <span className="font-medium text-fg-2">Prototype representation.</span> These screens show how ORVEX handles authentication, sessions and secrets. Policy values are stored and audited, but this browser prototype does not actually enforce
        network allow-lists, MFA challenges or encryption — a production installation does this in core-api.
      </PrototypeNote>

      {settings.isError && !sec ? (
        <QueryError onRetry={() => settings.refetch()} />
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            {sec ? <AccessPolicy sec={sec} /> : <CardSkeleton rows={6} />}
            <MfaCard users={users.data} enforced={sec?.enforceMfa} />
          </div>
          <SessionsCard users={users.data} loading={users.isLoading} />
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <SecretsCard />
            <ApiKeysCard />
            <LimitsCard api={settings.data?.api} webhooks={settings.data?.webhooks} />
          </div>
        </>
      )}
    </div>
  )
}

function AccessPolicy({ sec }: { sec: InstallationSettings['security'] }) {
  const canEdit = useCan('system.manage')
  const [ip, setIp] = useState('')
  const [num, setNum] = useState({ sessionTimeoutMin: String(sec.sessionTimeoutMin), passwordMinLength: String(sec.passwordMinLength), auditRetentionDays: String(sec.auditRetentionDays) })
  const save = useInstMutation((patch: Partial<InstallationSettings['security']>) => systemService.updateSettings('security', patch), { success: 'Security policy updated (audited as warning)' })
  const ipValid = CIDR_RE.test(ip.trim())
  const numChanged = Number(num.sessionTimeoutMin) !== sec.sessionTimeoutMin || Number(num.passwordMinLength) !== sec.passwordMinLength || Number(num.auditRetentionDays) !== sec.auditRetentionDays

  return (
    <Card>
      <CardHeader icon={<Lock />} title="Access policy" description="Applies to every admin user. Changes are audited with severity “warning”." />
      <div className="space-y-5 px-5 pb-5">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface-2/40 p-3.5">
          <div>
            <p className="text-[13px] font-medium text-fg">Enforce MFA for all admin users</p>
            <p className="text-[12px] text-fg-3">TOTP or passkey required at sign-in. Users without MFA are asked to enrol.</p>
          </div>
          <Guarded permission="system.manage">{(allowed) => <Switch checked={sec.enforceMfa} disabled={!allowed || save.isPending} onChange={(v) => save.mutate({ enforceMfa: v })} label="Enforce MFA" />}</Guarded>
        </div>

        <div>
          <p className="mb-1 flex items-center gap-1.5 text-[13px] font-medium text-fg">
            <Network className="size-3.5 text-fg-3" /> Admin IP allow-list
          </p>
          <p className="mb-2 text-[12px] text-fg-3">The admin console answers only from these networks. Storefront, portal and APIs are unaffected (API keys have their own allow-lists).</p>
          <div className="flex flex-wrap gap-1.5">
            {sec.ipAllowlistAdmin.map((c) => (
              <span key={c} className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 py-0.5 pr-1 pl-2 font-mono text-[12px] text-fg">
                {c}
                <button type="button" disabled={!canEdit || save.isPending} onClick={() => save.mutate({ ipAllowlistAdmin: sec.ipAllowlistAdmin.filter((x) => x !== c) })} className="rounded p-0.5 text-fg-3 hover:bg-surface-3 hover:text-fg disabled:opacity-40" aria-label={`Remove ${c}`}>
                  <X className="size-3" />
                </button>
              </span>
            ))}
            {sec.ipAllowlistAdmin.length === 0 && <span className="text-[12px] text-warning">Empty — the console is reachable from any network.</span>}
          </div>
          <div className="mt-2 flex gap-2">
            <Input inputSize="sm" mono placeholder="203.0.113.0/24" value={ip} onChange={(e) => setIp(e.target.value)} invalid={!!ip && !ipValid} disabled={!canEdit} className="max-w-[220px]" />
            <Button
              size="sm"
              variant="secondary"
              leading={<Plus />}
              disabled={!canEdit || !ipValid || sec.ipAllowlistAdmin.includes(ip.trim())}
              onClick={() => save.mutate({ ipAllowlistAdmin: [...sec.ipAllowlistAdmin, ip.trim()] }, { onSuccess: () => setIp('') })}
            >
              Add
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ['sessionTimeoutMin', 'Session timeout', 'minutes idle', Timer],
              ['passwordMinLength', 'Password minimum', 'characters', KeyRound],
              ['auditRetentionDays', 'Audit retention', 'days', ScrollText],
            ] as const
          ).map(([k, label, unit, Icon]) => (
            <label key={k} className="block rounded-xl border border-line p-3">
              <span className="mono-label flex items-center gap-1.5">
                <Icon className="size-3" /> {label}
              </span>
              <Input inputSize="sm" type="number" min={1} value={num[k]} onChange={(e) => setNum({ ...num, [k]: e.target.value })} disabled={!canEdit} className="mt-2" />
              <span className="mt-1 block text-[11px] text-fg-3">{unit}</span>
            </label>
          ))}
        </div>
        {numChanged && (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setNum({ sessionTimeoutMin: String(sec.sessionTimeoutMin), passwordMinLength: String(sec.passwordMinLength), auditRetentionDays: String(sec.auditRetentionDays) })}>
              Discard
            </Button>
            <Button size="sm" variant="primary" loading={save.isPending} disabled={!canEdit} onClick={() => save.mutate({ sessionTimeoutMin: toInt(num.sessionTimeoutMin, sec.sessionTimeoutMin), passwordMinLength: Math.max(8, toInt(num.passwordMinLength, sec.passwordMinLength)), auditRetentionDays: toInt(num.auditRetentionDays, sec.auditRetentionDays) })}>
              Save policy
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}

function MfaCard({ users, enforced }: { users?: UserRow[]; enforced?: boolean }) {
  if (!users) return <CardSkeleton rows={6} />
  const without = users.filter((u) => !u.mfa && u.status !== 'disabled')
  return (
    <Card>
      <CardHeader icon={<Fingerprint />} title="MFA status" description={`${users.length - without.length} of ${users.length} users enrolled`} actions={enforced ? <Badge tone="success">Enforced</Badge> : <Badge tone="warning">Not enforced</Badge>} />
      <ul className="divide-y divide-line px-5 pb-3">
        {users.map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar name={u.name} color={u.color} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-[13px] text-fg">{u.name}</p>
                <p className="truncate text-[11.5px] text-fg-3">
                  {u.roleName} · {u.status}
                </p>
              </div>
            </div>
            {u.mfa ? (
              <Badge tone="success" icon={<ShieldCheck />}>
                Enrolled
              </Badge>
            ) : (
              <Badge tone="warning" icon={<ShieldAlert />}>
                {u.status === 'invited' ? 'Enrols at first sign-in' : enforced ? 'Blocked until enrolled' : 'Not enrolled'}
              </Badge>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}

function SessionsCard({ users, loading }: { users?: UserRow[]; loading: boolean }) {
  const me = useMe()
  const [revoke, setRevoke] = useState<{ user: UserRow; session: AdminSession } | null>(null)
  const m = useInstMutation((v: { userId: string; sessionId: string }) => systemService.revokeSession(v.userId, v.sessionId), { success: 'Session revoked', onSettled: () => setRevoke(null) })
  if (loading || !users) return <CardSkeleton rows={5} />
  const withSessions = users.filter((u) => u.sessions.length)
  return (
    <Card>
      <CardHeader icon={<Laptop />} title="Active sessions" description="Revoking signs the device out on its next request. You can always revoke your own sessions; others need “Change roles”." actions={<PermissionHint permission="roles.manage" />} />
      <div className="divide-y divide-line">
        {withSessions.map((u) => (
          <div key={u.id} className="grid gap-3 px-5 py-3.5 md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="flex items-center gap-2.5">
              <Avatar name={u.name} color={u.color} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-fg">{u.name}</p>
                <p className="truncate text-[11.5px] text-fg-3">{u.roleName}</p>
              </div>
            </div>
            <ul className="space-y-1.5">
              {u.sessions.map((s) => {
                const own = me.data?.userId === u.id
                return (
                  <li key={s.id} className="flex flex-col gap-2 rounded-lg border border-line px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 text-[12.5px]">
                      <p className="text-fg">
                        {s.device} {s.current && <Badge tone="accent" className="ml-1">this session</Badge>}
                      </p>
                      <p className="font-mono text-[11.5px] text-fg-3">
                        {s.ip} · {s.location} · last seen {relative(s.lastSeenAt)}
                      </p>
                    </div>
                    {own ? (
                      <Button size="xs" variant="ghost" leading={<LogOut />} disabled={s.current} onClick={() => setRevoke({ user: u, session: s })}>
                        Revoke
                      </Button>
                    ) : (
                      <Guarded permission="roles.manage">
                        {(allowed) => (
                          <Button size="xs" variant="ghost" leading={<LogOut />} disabled={!allowed} onClick={() => setRevoke({ user: u, session: s })}>
                            Revoke
                          </Button>
                        )}
                      </Guarded>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
        {withSessions.length === 0 && <p className="px-5 py-6 text-center text-[12.5px] text-fg-3">No active sessions.</p>}
      </div>
      <ConfirmDialog
        open={!!revoke}
        onClose={() => setRevoke(null)}
        tone="danger"
        title="Revoke session?"
        description={revoke ? `${revoke.user.name} · ${revoke.session.device} (${revoke.session.ip}) will be signed out. Recorded in the audit log.` : undefined}
        confirmLabel="Revoke"
        loading={m.isPending}
        onConfirm={() => revoke && m.mutate({ userId: revoke.user.id, sessionId: revoke.session.id })}
      />
    </Card>
  )
}

function SecretsCard() {
  return (
    <Card>
      <CardHeader icon={<KeyRound />} title="Supplier credentials" description="Write-only, encrypted at rest" />
      <div className="space-y-3 px-5 pb-5 text-[12.5px] text-fg-2">
        <SecretField masked="api_key ••••••••••••3f9a" />
        <ul className="space-y-1.5">
          <li>• Encrypted with ENCRYPTION_KEY (AES-256-GCM) before they reach PostgreSQL.</li>
          <li>• Never returned by any API — the UI only shows the last characters.</li>
          <li>• Replacing them requires “Change supplier credentials” and is audited.</li>
          <li>• Drivers decrypt them in core-worker at request time only.</li>
        </ul>
      </div>
    </Card>
  )
}

function ApiKeysCard() {
  return (
    <Card>
      <CardHeader icon={<Hash />} title="API key storage" description="Native API v1 and DHRU-compatible keys" />
      <div className="space-y-3 px-5 pb-5 text-[12.5px] text-fg-2">
        <div className="rounded-lg border border-line bg-bg-subtle px-3 py-2 font-mono text-[11.5px]">
          <p className="text-fg">orx_live_4f2a…9c1e</p>
          <p className="text-fg-3">sha256: 7d1b0c…e44f</p>
        </div>
        <ul className="space-y-1.5">
          <li>• The secret is shown exactly once, when the key is created.</li>
          <li>• Only a SHA-256 hash and a public prefix are stored — a lost key is revoked and replaced, never recovered.</li>
          <li>• Keys carry scopes, an IP allow-list, a rate limit and an optional expiry.</li>
        </ul>
        <Button variant="link" size="sm" to="/admin/developer/keys">
          Manage API keys
        </Button>
      </div>
    </Card>
  )
}

function LimitsCard({ api, webhooks }: { api?: InstallationSettings['api']; webhooks?: InstallationSettings['webhooks'] }) {
  return (
    <Card>
      <CardHeader icon={<Gauge />} title="Rate limits & idempotency" description="Defaults — see Settings → API" />
      <dl className="px-5 pb-3">
        <KV label="Default rate limit">{api ? `${api.defaultRateLimit} req/min per key` : '—'}</KV>
        <KV label="Idempotency window">{api ? `${api.idempotencyWindowHours} h` : '—'}</KV>
        <KV label="Idempotency scope">account · all channels</KV>
        <KV label="Webhook signing">{webhooks ? 'Standard Webhooks · HMAC-SHA256' : '—'}</KV>
      </dl>
      <p className="flex items-start gap-2 px-5 pb-4 text-[12px] text-fg-3">
        <Repeat className="mt-0.5 size-3.5 shrink-0" />
        A retried request with the same Idempotency-Key returns the original order; the same key with a different body is rejected with 409 — on every channel.
      </p>
    </Card>
  )
}
