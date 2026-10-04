import { Fragment, useMemo, useState } from 'react'
import { Check, Lock, Minus, ShieldCheck, ShieldAlert, UserPlus, Users } from 'lucide-react'
import { Avatar, Badge, Button, Card, CardHeader, DataTable, Field, Input, Modal, PageHeader, Select, StatusBadge, Textarea, Tooltip, type Column } from '@/components/ui'
import { Guarded, PermissionHint, useCan } from '@/components/domain'
import { useInstMutation, useMe, usePermissionCatalog, useRoles, useUsers } from '@/hooks/installation'
import { systemService } from '@/services/installation'
import { cn } from '@/lib/cn'
import { relative } from '@/lib/format'
import type { AdminUser, Permission, Role } from '@/types/installation'
import { QueryError } from './shared'
import { EMAIL_RE } from './settings/sectionForm'

type UserRow = AdminUser & { roleName: string }
type RoleRow = Role & { users: number }

const hasPerm = (r: Role, p: string) => (r.permissions as string[]).includes('*') || (r.permissions as string[]).includes(p)

export default function RolesPage() {
  const users = useUsers()
  const roles = useRoles()
  const me = useMe()
  const canManage = useCan('roles.manage')
  const [change, setChange] = useState<{ user: UserRow; roleId: string } | null>(null)
  const [invite, setInvite] = useState(false)

  const columns: Column<UserRow>[] = [
    {
      key: 'name',
      header: 'User',
      cell: (u) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={u.name} color={u.color} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-fg">
              {u.name} {me.data?.userId === u.id && <span className="text-[11px] font-normal text-fg-3">(you)</span>}
            </p>
            <p className="truncate text-[11.5px] text-fg-3">{u.email}</p>
          </div>
        </div>
      ),
      sortValue: (u) => u.name,
    },
    {
      key: 'role',
      header: 'Role',
      width: 'w-[190px]',
      cell: (u) => (
        <Guarded permission="roles.manage">
          {(allowed) => (
            <Select
              inputSize="sm"
              value={u.roleId}
              disabled={!allowed}
              onChange={(e) => e.target.value !== u.roleId && setChange({ user: u, roleId: e.target.value })}
              options={(roles.data ?? []).map((r) => ({ value: r.id, label: r.name }))}
              className="w-[170px]"
            />
          )}
        </Guarded>
      ),
      sortValue: (u) => u.roleName,
    },
    { key: 'mfa', header: 'MFA', width: 'w-[90px]', cell: (u) => (u.mfa ? <Badge tone="success" icon={<ShieldCheck />}>On</Badge> : <Badge tone="warning" icon={<ShieldAlert />}>Off</Badge>) },
    { key: 'status', header: 'Status', width: 'w-[100px]', cell: (u) => <StatusBadge status={u.status} /> },
    { key: 'last', header: 'Last active', width: 'w-[140px]', hideBelow: 'md', cell: (u) => <span className="text-[12.5px] text-fg-2">{u.lastActiveAt ? relative(u.lastActiveAt) : 'never'}</span>, sortValue: (u) => (u.lastActiveAt ? +new Date(u.lastActiveAt) : 0) },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Users />}
        eyebrow="System"
        title="Roles & users"
        description="Operators of this installation. Sensitive commands check the role’s permissions on the server, not only in the UI."
        actions={
          <Guarded permission="roles.manage">
            {(allowed) => (
              <Button variant="accent" size="sm" leading={<UserPlus />} disabled={!allowed} onClick={() => setInvite(true)}>
                Invite user
              </Button>
            )}
          </Guarded>
        }
      />

      {users.isError && !users.data ? (
        <QueryError onRetry={() => users.refetch()} />
      ) : (
        <Card className="overflow-hidden">
          <CardHeader title="Users" description={users.data ? `${users.data.length} users · ${users.data.filter((u) => u.status === 'invited').length} invited` : undefined} actions={<PermissionHint permission="roles.manage" />} />
          <DataTable columns={columns} rows={users.data} rowKey={(u) => u.id} loading={users.isLoading} minWidth={700} skeletonRows={6} />
        </Card>
      )}

      <PermissionMatrix roles={roles.data} users={users.data} error={roles.isError} onRetry={() => roles.refetch()} />

      {change && <ChangeRoleModal key={change.user.id + change.roleId} user={change.user} role={roles.data?.find((r) => r.id === change.roleId)} onClose={() => setChange(null)} />}
      <InviteModal open={invite} onClose={() => setInvite(false)} roles={roles.data ?? []} canManage={canManage} />
    </div>
  )
}

function ChangeRoleModal({ user, role, onClose }: { user: UserRow; role?: RoleRow; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const m = useInstMutation(() => systemService.changeRole(user.id, role!.id, reason.trim() || undefined), { success: `${user.name} is now ${role?.name}`, onSuccess: onClose })
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Change role for ${user.name}`}
      description={`${user.roleName} → ${role?.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={m.isPending} disabled={reason.trim().length < 3} onClick={() => m.mutate()}>
            Change role
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {role && <p className="text-[12.5px] text-fg-3">{role.description}</p>}
        <Field label="Reason" hint="Recorded in the audit log with the role change.">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Moved to the finance team" autoFocus />
        </Field>
      </div>
    </Modal>
  )
}

function InviteModal({ open, onClose, roles, canManage }: { open: boolean; onClose: () => void; roles: RoleRow[]; canManage: boolean }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('role_support')
  const close = () => {
    setName('')
    setEmail('')
    onClose()
  }
  const m = useInstMutation(() => systemService.inviteUser({ name, email, roleId }), { success: `Invitation recorded for ${email} (email simulated)`, onSuccess: close })
  const valid = EMAIL_RE.test(email) && name.trim().length > 1
  return (
    <Modal
      open={open}
      onClose={close}
      size="sm"
      title="Invite user"
      description="The invitation email is simulated; the user appears as invited until they sign in with MFA."
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="accent" loading={m.isPending} disabled={!valid || !canManage} onClick={() => m.mutate()}>
            Send invitation
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Email">
          <Input type="email" value={email} invalid={!!email && !EMAIL_RE.test(email)} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Role" hint={roles.find((r) => r.id === roleId)?.description}>
          <Select value={roleId} onChange={(e) => setRoleId(e.target.value)} options={roles.map((r) => ({ value: r.id, label: r.name }))} />
        </Field>
      </div>
    </Modal>
  )
}

function PermissionMatrix({ roles, users, error, onRetry }: { roles?: RoleRow[]; users?: UserRow[]; error: boolean; onRetry: () => void }) {
  const catalog = usePermissionCatalog()
  const perms = useMemo(() => Object.entries(catalog.data ?? {}) as [Permission, { label: string; description: string; sensitive: boolean }][], [catalog.data])
  if (error && !roles) return <QueryError onRetry={onRetry} />
  return (
    <Card className="overflow-hidden">
      <CardHeader
        icon={<Lock />}
        title="Roles × permissions"
        description="Owner has every permission. Sensitive permissions move money, change prices or credentials, or change who can do what."
        actions={
          <Badge tone="warning" variant="soft" icon={<ShieldAlert />}>
            sensitive
          </Badge>
        }
      />
      {!roles || !catalog.data ? (
        <div className="space-y-2 px-5 pb-5">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="skeleton h-7 w-full" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-separate border-spacing-0 text-[12.5px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-[1] border-b border-line bg-surface px-5 py-2.5 text-left text-[11.5px] font-medium text-fg-3">Permission</th>
                {roles.map((r) => (
                  <th key={r.id} className="border-b border-line bg-surface px-3 py-2.5 text-center align-bottom">
                    <p className="text-[12.5px] font-semibold text-fg">{r.name}</p>
                    <div className="mt-1 flex justify-center -space-x-1.5">
                      {(users ?? [])
                        .filter((u) => u.roleId === r.id)
                        .slice(0, 4)
                        .map((u) => (
                          <Tooltip key={u.id} content={u.name}>
                            <span>
                              <Avatar name={u.name} color={u.color} size="xs" className="ring-2 ring-surface" />
                            </span>
                          </Tooltip>
                        ))}
                      {r.users === 0 && <span className="text-[11px] font-normal text-fg-3">no users</span>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {perms.map(([id, p]) => (
                <Fragment key={id}>
                  <tr className="group">
                    <td className="sticky left-0 z-[1] border-b border-line bg-surface px-5 py-2 group-hover:bg-surface-2">
                      <div className="flex items-center gap-2">
                        {p.sensitive && <ShieldAlert className="size-3.5 shrink-0 text-warning" />}
                        <div className="min-w-0">
                          <p className="truncate text-fg">{p.label}</p>
                          <p className="truncate font-mono text-[10.5px] text-fg-3" title={p.description}>
                            {id}
                          </p>
                        </div>
                      </div>
                    </td>
                    {roles.map((r) => {
                      const on = hasPerm(r, id)
                      return (
                        <td key={r.id} className={cn('border-b border-line px-3 py-2 text-center group-hover:bg-surface-2', on && p.sensitive && 'bg-warning/[0.04]')}>
                          {on ? <Check className={cn('mx-auto size-4', p.sensitive ? 'text-warning' : 'text-success')} strokeWidth={2.5} /> : <Minus className="mx-auto size-3.5 text-fg-3/50" />}
                        </td>
                      )
                    })}
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="border-t border-line px-5 py-3 text-[12px] text-fg-3">Role definitions are part of the installation configuration. Switch “Act as role” in DEMO / SIMULATION to see the console change — e.g. Support cannot refund.</p>
    </Card>
  )
}
