import { useState } from 'react'
import { ShieldCheck, ShieldOff, UserPlus, Users } from 'lucide-react'
import type { AccountDetail, AccountMember, MemberRole } from '@/types/installation'
import { accountsService } from '@/services/installation'
import { useInstMutation } from '@/hooks/installation'
import { Guarded, PermissionHint, useCan } from '@/components/domain'
import { Avatar, Button, Card, CardHeader, DataTable, EmptyState, Field, Input, Modal, Select, StatusBadge, Tooltip, type Column } from '@/components/ui'
import { relative } from '@/lib/format'
import { MEMBER_ROLE_HINT, MEMBER_ROLES } from '../helpers'

const roleOptions = MEMBER_ROLES.map((r) => ({ value: r, label: r[0]!.toUpperCase() + r.slice(1) }))

export function MembersTab({ d }: { d: AccountDetail }) {
  const a = d.account
  const can = useCan('accounts.manage')
  const [invite, setInvite] = useState(false)
  const update = useInstMutation(({ id, patch }: { id: string; patch: Partial<Pick<AccountMember, 'role' | 'status'>> }) => accountsService.updateMember(id, patch), { success: 'Member updated' })

  if (a.kind === 'guest')
    return (
      <Card>
        <EmptyState icon={<Users />} title="Guest accounts have no members" description="A guest account is created by storefront checkout with just an email. If the customer registers later, the account becomes a regular retail account with an owner." />
      </Card>
    )

  const columns: Column<AccountMember>[] = [
    {
      key: 'name',
      header: 'Member',
      cell: (m) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={m.name} size="sm" />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium">{m.name}</div>
            <div className="truncate font-mono text-[11.5px] text-fg-3">{m.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      cell: (m) => (
        <Tooltip content={MEMBER_ROLE_HINT[m.role]}>
          <Select inputSize="sm" className="w-[130px]" value={m.role} disabled={!can || update.isPending || m.status === 'disabled'} onChange={(e) => update.mutate({ id: m.id, patch: { role: e.target.value as MemberRole } })} options={roleOptions} />
        </Tooltip>
      ),
    },
    { key: 'status', header: 'Status', cell: (m) => <StatusBadge status={m.status} /> },
    {
      key: 'mfa',
      header: 'MFA',
      hideBelow: 'sm',
      cell: (m) =>
        m.mfa ? (
          <span className="inline-flex items-center gap-1 text-[12px] text-success">
            <ShieldCheck className="size-3.5" /> On
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[12px] text-fg-3">
            <ShieldOff className="size-3.5" /> Off
          </span>
        ),
    },
    { key: 'last', header: 'Last active', hideBelow: 'md', cell: (m) => <span className="text-[12.5px] text-fg-2">{m.lastActiveAt ? relative(m.lastActiveAt) : m.status === 'invited' ? 'Invitation sent' : '—'}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (m) =>
        m.status === 'disabled' ? (
          <Button size="xs" variant="ghost" disabled={!can || update.isPending} onClick={() => update.mutate({ id: m.id, patch: { status: 'active' } })}>
            Re-enable
          </Button>
        ) : (
          <Button size="xs" variant="ghost" disabled={!can || update.isPending} onClick={() => update.mutate({ id: m.id, patch: { status: 'disabled' } })}>
            Disable
          </Button>
        ),
    },
  ]

  return (
    <Card className="overflow-hidden">
      <CardHeader
        icon={<Users />}
        title="Members"
        description={`People who sign in to the ${a.tier === 'retail' ? 'storefront account' : 'reseller portal'} for ${a.name}. Roles decide who may order, see finance or manage API keys.`}
        actions={
          <>
            <PermissionHint permission="accounts.manage" className="hidden sm:inline-flex" />
            <Guarded permission="accounts.manage">
              {(allowed) => (
                <Button size="sm" variant="accent" leading={<UserPlus />} disabled={!allowed} onClick={() => setInvite(true)}>
                  Invite member
                </Button>
              )}
            </Guarded>
          </>
        }
      />
      <DataTable columns={columns} rows={d.members} rowKey={(m) => m.id} dense minWidth={640} empty={<EmptyState compact icon={<Users />} title="No members yet" description="Invite the owner first — every account needs at least one owner." />} />
      <InviteModal open={invite} onClose={() => setInvite(false)} d={d} />
    </Card>
  )
}

function InviteModal({ open, onClose, d }: { open: boolean; onClose: () => void; d: AccountDetail }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const memberCount = d.members.length
  const [role, setRole] = useState<MemberRole>(memberCount ? 'orderer' : 'owner')
  const [tried, setTried] = useState(false)
  // Reset the form whenever the modal (re)opens — adjusted during render, not in an effect.
  const [resetFor, setResetFor] = useState({ open, memberCount })
  if (resetFor.open !== open || resetFor.memberCount !== memberCount) {
    setResetFor({ open, memberCount })
    if (open) {
      setName('')
      setEmail('')
      setRole(memberCount ? 'orderer' : 'owner')
      setTried(false)
    }
  }
  const emailErr = !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? 'Enter a valid email' : undefined
  const m = useInstMutation(() => accountsService.inviteMember(d.account.id, { name: name.trim(), email: email.trim(), role }), { success: (x) => `Invitation sent to ${x.email} (simulated email)`, onSuccess: onClose })
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<UserPlus />}
      title={`Invite member to ${d.account.name}`}
      description="They receive an invitation email (simulated in the prototype) and set their own password and MFA."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="accent"
            loading={m.isPending}
            onClick={() => {
              setTried(true)
              if (!emailErr) m.mutate()
            }}
          >
            Send invitation
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" optional>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus />
        </Field>
        <Field label="Email" error={tried ? emailErr : undefined}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" invalid={tried && !!emailErr} />
        </Field>
        <Field label="Role" hint={MEMBER_ROLE_HINT[role]} className="sm:col-span-2">
          <Select value={role} onChange={(e) => setRole(e.target.value as MemberRole)} options={roleOptions} />
        </Field>
      </div>
    </Modal>
  )
}
