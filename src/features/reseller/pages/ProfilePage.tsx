import { useState } from 'react'
import { Building, Mail, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal, PageHeader, Select, Skeleton, StatusBadge } from '@/components/ui'
import { Money } from '@/components/domain'
import { useInstMutation, usePortalMembers } from '@/hooks/installation'
import { portalService } from '@/services/installation'
import { ACCOUNT_TIER_LABEL } from '@/core/domain'
import type { AccountMember, MemberRole } from '@/types/installation'
import { date, relative } from '@/lib/format'
import { ErrorCard, InfoRow } from '../kit'
import { ROLE_DESC, ROLE_LABEL, usePortalSession } from '../kitUtils'

const ROLES: MemberRole[] = ['owner', 'admin', 'orderer', 'finance', 'developer', 'viewer']
const CHANNEL_LABEL: Record<string, string> = { storefront: 'Storefront', portal: 'Partner portal', api: 'Native API', dhru: 'DHRU endpoint' }

export default function ProfilePage() {
  const { me, can, error, refetch } = usePortalSession()
  const members = usePortalMembers()
  const [invite, setInvite] = useState(false)
  if (error) return <ErrorCard error={error} onRetry={() => refetch()} />

  const a = me?.account
  return (
    <div>
      <PageHeader title="Profile" description="Your company account at UnlockDesk and the people who can use it." />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader icon={<Building />} title="Account" description="Contact UnlockDesk to change company details or pricing." />
            {!a || !me ? (
              <div className="space-y-2 px-5 pb-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-5" />)}</div>
            ) : (
              <dl className="px-5 pb-3">
                <InfoRow label="Company">{a.company ?? a.name}</InfoRow>
                <InfoRow label="Account number" mono>
                  {a.number}
                </InfoRow>
                <InfoRow label="Account type">{ACCOUNT_TIER_LABEL[a.tier]}</InfoRow>
                <InfoRow label="Pricing tier">
                  <Badge tone="accent">{me.tierName}</Badge>
                </InfoRow>
                <InfoRow label="Credit limit">
                  <Money value={a.creditLimit} />
                </InfoRow>
                <InfoRow label="Low-balance alert">{a.lowBalanceAlert != null ? <Money value={a.lowBalanceAlert} /> : 'Default ($100.00)'}</InfoRow>
                <InfoRow label="Country">{a.country}</InfoRow>
                <InfoRow label="Contact">{a.contactName}</InfoRow>
                <InfoRow label="Email">{a.email}</InfoRow>
                {a.phone && <InfoRow label="Phone">{a.phone}</InfoRow>}
                {a.website && <InfoRow label="Website">{a.website}</InfoRow>}
                <InfoRow label="Customer since">{date(a.createdAt)}</InfoRow>
              </dl>
            )}
          </Card>
          {a && (
            <Card>
              <CardHeader icon={<ShieldCheck />} title="Channels & limits" />
              <div className="space-y-3 px-5 pb-5">
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(a.channels).map(([k, on]) => (
                    <Badge key={k} tone={on ? 'success' : 'neutral'} dot variant={on ? 'soft' : 'outline'}>
                      {CHANNEL_LABEL[k] ?? k}
                    </Badge>
                  ))}
                </div>
                <dl>
                  <InfoRow label="Orders per minute">{a.limits.ordersPerMinute}</InfoRow>
                  <InfoRow label="Daily orders">{a.limits.dailyOrders.toLocaleString()}</InfoRow>
                  <InfoRow label="Max order value">
                    <Money value={a.limits.maxOrderValue} />
                  </InfoRow>
                </dl>
              </div>
            </Card>
          )}
        </div>

        <Card className="min-w-0 self-start">
          <CardHeader
            icon={<Users />}
            title="Members"
            description={can.members ? 'Invite colleagues and choose what they can do.' : 'Only owners and admins can invite or change members.'}
            actions={
              can.members && (
                <Button size="sm" variant="accent" leading={<UserPlus />} onClick={() => setInvite(true)}>
                  Invite
                </Button>
              )
            }
          />
          {members.error ? (
            <ErrorCard error={members.error} onRetry={() => members.refetch()} className="m-4" />
          ) : members.isLoading ? (
            <div className="space-y-2 px-5 pb-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : !members.data?.length ? (
            <EmptyState compact title="No members" />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {members.data.map((m) => (
                <MemberRow key={m.id} m={m} isMe={m.id === me?.member.id} canEdit={can.members} />
              ))}
            </ul>
          )}
          <div className="border-t border-line px-5 py-3">
            <div className="mb-2 mono-label">Roles</div>
            <ul className="grid gap-x-6 gap-y-1 text-[12px] sm:grid-cols-2">
              {ROLES.map((r) => (
                <li key={r}>
                  <span className="font-medium text-fg-2">{ROLE_LABEL[r]}</span> <span className="text-fg-3">— {ROLE_DESC[r]}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
      <InviteModal open={invite} onClose={() => setInvite(false)} />
    </div>
  )
}

function MemberRow({ m, isMe, canEdit }: { m: AccountMember; isMe: boolean; canEdit: boolean }) {
  const change = useInstMutation((role: MemberRole) => portalService.updateMember(m.id, { role }), { success: (_, role) => `${m.name} is now ${ROLE_LABEL[role]}` })
  return (
    <li className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={m.name} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13.5px] font-medium">{m.name}</span>
            {isMe && <Badge tone="accent">You</Badge>}
            {m.status !== 'active' && <StatusBadge status={m.status} />}
          </div>
          <div className="flex items-center gap-2 text-[12px] text-fg-3">
            <span className="truncate">{m.email}</span>
            {m.mfa && <Badge tone="success" variant="outline">2FA</Badge>}
          </div>
          <div className="text-[11px] text-fg-3">{m.lastActiveAt ? `Active ${relative(m.lastActiveAt)}` : 'Not signed in yet'}</div>
        </div>
      </div>
      {canEdit ? (
        <Select inputSize="sm" className="sm:w-[140px]" value={m.role} disabled={change.isPending} onChange={(e) => change.mutate(e.target.value as MemberRole)} options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} aria-label={`Role of ${m.name}`} />
      ) : (
        <Badge tone="neutral" className="self-start sm:self-auto">
          {ROLE_LABEL[m.role]}
        </Badge>
      )}
    </li>
  )
}

function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<MemberRole>('orderer')
  const inviteM = useInstMutation(portalService.inviteMember, {
    success: (m) => `Invitation sent to ${m.email} (simulated email)`,
    onSuccess: () => {
      onClose()
      setName('')
      setEmail('')
      setRole('orderer')
    },
  })
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<Mail />}
      title="Invite a member"
      description="They’ll get an email to set a password. Invitations are simulated in the demo."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" loading={inviteM.isPending} disabled={!valid} onClick={() => inviteM.mutate({ name: name.trim(), email: email.trim(), role })}>
            Send invite
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" optional htmlFor="inv_name">
          <Input id="inv_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sara Khalil" />
        </Field>
        <Field label="Email" htmlFor="inv_email" error={email && !valid ? 'Enter a valid email address' : undefined}>
          <Input id="inv_email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sara@abcgsm.example" />
        </Field>
        <Field label="Role" hint={ROLE_DESC[role]} htmlFor="inv_role">
          <Select id="inv_role" value={role} onChange={(e) => setRole(e.target.value as MemberRole)} options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
        </Field>
      </div>
    </Modal>
  )
}
