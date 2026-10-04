import { useMemo, useState } from 'react'
import { Database, MoreHorizontal, Send, ShieldCheck, ShieldOff, UserMinus, UserPlus, UserRoundCheck } from 'lucide-react'
import { Avatar, Badge, Button, Card, CardHeader, DataTable, Field, Input, Meter, MenuItem, MenuSeparator, Modal, Popover, SearchInput, Select, StatusBadge, Tooltip, type Column } from '@/components/ui'
import { useQueryClient } from '@tanstack/react-query'
import { INST, useInstMutation, useLicense, useRoles, useSettings, useUsers } from '@/hooks/installation'
import { systemService } from '@/services/installation'
import { toast } from '@/stores/toast'
import { relative } from '@/lib/format'
import type { AdminUser, Role } from '@/types/installation'
import { EMAIL_RE } from './form'

const SELF_ID = 'usr_alex'

export function UsersTab() {
  const users = useUsers()
  const roles = useRoles()
  const license = useLicense()
  const settings = useSettings()
  const [search, setSearch] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)

  const qc = useQueryClient()
  const update = useInstMutation((v: { id: string; body: Partial<AdminUser> }) => systemService.updateUser(v.id, v.body), {
    success: (d, v) => (v.body.roleId ? `${d.name} is now ${roles.data?.find((r) => r.id === d.roleId)?.name ?? 'updated'}` : v.body.status ? `${d.name} ${d.status === 'disabled' ? 'disabled' : 'enabled'}` : `${d.name} updated`),
    onMutate: (v) => {
      qc.setQueryData<AdminUser[]>([INST, 'users'], (old) => old?.map((u) => (u.id === v.id ? { ...u, ...v.body } : u)))
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: [INST, 'users'] })
    },
  })

  const roleById = useMemo(() => new Map((roles.data ?? []).map((r) => [r.id, r])), [roles.data])
  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (users.data ?? []).filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  }, [users.data, search])

  const seatLimit = Number.parseInt(license.data?.limits.find((l) => /admin users/i.test(l.label))?.value ?? '', 10)
  const seatsUsed = (users.data ?? []).filter((u) => u.status !== 'disabled').length
  const enforceMfa = settings.data?.security.enforceMfa
  const roleOptions = (roles.data ?? []).map((r) => ({ value: r.id, label: r.name }))

  const columns: Column<AdminUser>[] = [
    {
      key: 'user',
      header: 'User',
      sortValue: (u) => u.name,
      cell: (u) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={u.name} color={u.color} />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate font-medium text-fg">
              {u.name}
              {u.id === SELF_ID && <Badge tone="neutral">You</Badge>}
            </p>
            <p className="truncate text-[12px] text-fg-3">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      sortValue: (u) => roleById.get(u.roleId)?.name ?? '',
      cell: (u) => {
        const locked = u.id === SELF_ID || u.roleId === 'role_owner'
        return locked ? (
          <Tooltip content={u.id === SELF_ID ? 'You can’t change your own role.' : 'Ownership is transferred from the Owner’s profile.'}>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-line px-3 text-[13px] text-fg-2">{roleById.get(u.roleId)?.name ?? u.roleId}</span>
          </Tooltip>
        ) : (
          <Select
            inputSize="sm"
            value={u.roleId}
            disabled={update.isPending && update.variables?.id === u.id}
            onChange={(e) => update.mutate({ id: u.id, body: { roleId: e.target.value } })}
            options={roleOptions.filter((o) => o.value !== 'role_owner')}
            className="w-40"
            aria-label={`Role for ${u.name}`}
          />
        )
      },
    },
    {
      key: 'mfa',
      header: 'MFA',
      hideBelow: 'md',
      sortValue: (u) => (u.mfa ? 1 : 0),
      cell: (u) =>
        u.mfa ? (
          <Badge tone="success" icon={<ShieldCheck />}>
            Enabled
          </Badge>
        ) : (
          <Tooltip content={enforceMfa ? 'MFA is enforced — they will enrol at next sign-in.' : 'MFA is optional on this installation.'}>
            <Badge tone={enforceMfa ? 'warning' : 'neutral'} icon={<ShieldOff />}>
              Not set up
            </Badge>
          </Tooltip>
        ),
    },
    { key: 'status', header: 'Status', sortValue: (u) => u.status, cell: (u) => <StatusBadge status={u.status} /> },
    {
      key: 'last',
      header: 'Last active',
      hideBelow: 'lg',
      sortValue: (u) => (u.lastActiveAt ? +new Date(u.lastActiveAt) : 0),
      cell: (u) => <span className="text-fg-2">{u.lastActiveAt ? relative(u.lastActiveAt) : u.status === 'invited' ? 'Invitation pending' : 'Never'}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 'w-[52px]',
      cell: (u) =>
        u.id === SELF_ID ? null : (
          <Popover
            placement="bottom-end"
            trigger={({ toggle }) => (
              <Button variant="ghost" size="sm" icon onClick={toggle} aria-label={`Actions for ${u.name}`}>
                <MoreHorizontal />
              </Button>
            )}
          >
            {(close) => (
              <>
                {u.status === 'invited' && (
                  <MenuItem
                    icon={<Send />}
                    onClick={() => {
                      close()
                      toast.success('Invitation re-sent', `A new sign-in link was emailed to ${u.email}. It expires in 72 hours.`)
                    }}
                  >
                    Resend invitation
                  </MenuItem>
                )}
                {u.status !== 'disabled' ? (
                  <MenuItem
                    danger
                    icon={<UserMinus />}
                    disabled={u.roleId === 'role_owner'}
                    onClick={() => {
                      close()
                      update.mutate({ id: u.id, body: { status: 'disabled' } })
                    }}
                  >
                    Disable user
                  </MenuItem>
                ) : (
                  <MenuItem
                    icon={<UserRoundCheck />}
                    onClick={() => {
                      close()
                      update.mutate({ id: u.id, body: { status: 'active' } })
                    }}
                  >
                    Re-enable user
                  </MenuItem>
                )}
                <MenuSeparator />
                <div className="px-2.5 py-1.5 text-[11.5px] text-fg-3">Sessions are revoked immediately when a user is disabled.</div>
              </>
            )}
          </Popover>
        ),
    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-2/50 p-4">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface text-fg-2">
          <Database className="size-4" />
        </span>
        <div className="text-[13px]">
          <p className="font-medium text-fg">Your operators — support, operations, finance — are stored in this installation’s own database.</p>
          <p className="mt-0.5 text-fg-2">ORVEX Systems can’t see, create or sign in as these users. Your vendor account (billing, licenses) lives separately on account.orvex.io.</p>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Admin users"
          description={users.data ? `${users.data.length} users · ${users.data.filter((u) => u.status === 'invited').length} pending invitation` : 'Loading…'}
          actions={
            <Button variant="primary" size="sm" leading={<UserPlus />} onClick={() => setInviteOpen(true)}>
              Invite user
            </Button>
          }
        />
        <div className="flex flex-col gap-3 border-t border-line px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name or email…" className="sm:w-72" />
          {Number.isFinite(seatLimit) && <Meter label="Seats" value={seatsUsed} max={seatLimit} className="sm:w-56" />}
        </div>
        <DataTable columns={columns} rows={users.data ? list : undefined} rowKey={(u) => u.id} loading={users.isLoading} skeletonRows={6} minWidth={640} empty={<div className="py-12 text-center text-[13px] text-fg-3">No users match “{search}”.</div>} />
      </Card>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} roles={roles.data ?? []} existing={(users.data ?? []).map((u) => u.email.toLowerCase())} />
    </div>
  )
}

function InviteModal({ open, onClose, roles, existing }: { open: boolean; onClose: () => void; roles: Role[]; existing: string[] }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [roleId, setRoleId] = useState('role_support')
  const [touched, setTouched] = useState(false)

  const reset = () => {
    setEmail('')
    setName('')
    setRoleId('role_support')
    setTouched(false)
  }
  const invite = useInstMutation((body: { name?: string; email: string; roleId: string }) => systemService.inviteUser(body), {
    success: (d) => `Invitation sent to ${d.email}`,
    onSuccess: () => {
      reset()
      onClose()
    },
  })

  const emailError = !EMAIL_RE.test(email.trim()) ? 'Enter a valid email address' : existing.includes(email.trim().toLowerCase()) ? 'This person already has access' : null
  const role = roles.find((r) => r.id === roleId)
  const submit = () => {
    setTouched(true)
    if (emailError) return
    invite.mutate({ email: email.trim(), name: name.trim() || undefined, roleId })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<UserPlus />}
      title="Invite user"
      description="They’ll receive an email with a sign-in link for portal.unlockdesk-demo.com/admin."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={invite.isPending} onClick={submit} leading={<Send />}>
            Send invitation
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Field label="Email" error={touched ? emailError : null}>
          <Input type="email" autoFocus value={email} invalid={touched && !!emailError} placeholder="name@unlockdesk-demo.com" onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Name" optional>
          <Input value={name} placeholder="Jordan Lee" onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Role" hint={role?.description}>
          <Select value={roleId} onChange={(e) => setRoleId(e.target.value)} options={roles.filter((r) => r.id !== 'role_owner').map((r) => ({ value: r.id, label: r.name }))} />
        </Field>
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-[12px] text-fg-3">The account is created in this installation’s database. MFA enrolment is required at first sign-in when enforced under Security.</p>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}
