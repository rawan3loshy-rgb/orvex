import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Bell,
  Building,
  Download,
  Ellipsis,
  KeyRound,
  Laptop,
  LockKeyhole,
  LogOut,
  Mail,
  ShieldCheck,
  Smartphone,
  Trash,
  TriangleAlert,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  ConfirmDialog,
  Field,
  Input,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  Modal,
  PageHeader,
  Popover,
  Select,
  Skeleton,
  Switch,
} from '@/components/ui'
import { useVendorAccount, useVendorMutation } from '@/hooks/vendor'
import { accountService } from '@/services/vendor'
import { useSession } from '@/stores/session'
import { toast } from '@/stores/toast'
import { cn } from '@/lib/cn'
import { relative } from '@/lib/format'
import type { Tone } from '@/types/common'
import type { VendorAccount } from '@/types/vendor'
import { Callout, CardSkeleton, IconTile, Reveal } from './components/kit'
import { COUNTRIES, useHashScroll } from './components/kitUtils'

type Role = VendorAccount['team'][number]['role']

const ROLES: { value: Role; label: string; description: string; tone: Tone; color: string }[] = [
  { value: 'Owner', label: 'Owner', description: 'Everything, including plan changes and closing the account.', tone: 'accent', color: 'var(--c1)' },
  { value: 'Billing', label: 'Billing', description: 'Invoices, payment methods and billing contacts.', tone: 'success', color: 'var(--c2)' },
  { value: 'Technical', label: 'Technical', description: 'License, installations, releases and support tickets.', tone: 'neutral', color: 'var(--c3)' },
]
const roleMeta = (r: Role) => ROLES.find((x) => x.value === r)!

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: <UserRound /> },
  { id: 'team', label: 'Team', icon: <Users /> },
  { id: 'security', label: 'Security', icon: <ShieldCheck /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell /> },
  { id: 'danger', label: 'Danger zone', icon: <TriangleAlert /> },
]

const NOTIFICATIONS = [
  {
    group: 'Billing',
    items: [
      { id: 'invoices', label: 'Invoices and receipts', description: 'When an invoice is issued or paid.', default: true },
      { id: 'payment_failed', label: 'Payment problems', description: 'Failed charges and expiring cards.', default: true },
    ],
  },
  {
    group: 'Releases',
    items: [
      { id: 'stable', label: 'Stable releases', description: 'New Core versions with release notes.', default: true },
      { id: 'beta', label: 'Beta releases', description: 'Previews on the beta channel.', default: false },
      { id: 'security', label: 'Security advisories', description: 'Always sent to Owners and Technical members.', default: true, locked: true },
    ],
  },
  {
    group: 'License & support',
    items: [
      { id: 'heartbeat', label: 'Installation offline', description: 'No license heartbeat for more than 24 hours.', default: true },
      { id: 'tickets', label: 'Ticket replies', description: 'When ORVEX support answers your ticket.', default: true },
    ],
  },
]

function Section({ id, children }: { id: string; children: ReactNode }) {
  return (
    <section id={id} data-section className="scroll-mt-32">
      {children}
    </section>
  )
}

/* ------------------------------------------------------------------ */

function ProfileCard({ acc }: { acc: VendorAccount }) {
  const init = () => ({ firstName: acc.firstName, lastName: acc.lastName, email: acc.email, company: acc.company, country: acc.country })
  const [form, setForm] = useState(init)
  const dirty = form.firstName !== acc.firstName || form.lastName !== acc.lastName || form.email !== acc.email || form.company !== acc.company || form.country !== acc.country
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
  const save = useVendorMutation(accountService.updateAccount, {
    success: 'Profile saved',
    onSuccess: (a) => useSession.getState().signInVendor(a.email, a.name),
  })

  return (
    <Card>
      <CardHeader icon={<UserRound />} title="Profile" description="Your personal details and company" />
      <CardBody className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar name={`${form.firstName} ${form.lastName}`} size="lg" className="size-14 text-base" />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-fg">
              {form.firstName} {form.lastName}
            </p>
            <p className="truncate text-[12.5px] text-fg-3">
              Owner · {acc.company} · member since {new Date(acc.createdAt).getFullYear()}
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name">
            <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          </Field>
          <Field label="Last name">
            <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </Field>
          <Field label="Email" error={!emailOk ? 'Enter a valid email address' : undefined} action={<Badge tone="success">Verified</Badge>}>
            <Input type="email" value={form.email} invalid={!emailOk} leading={<Mail />} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Company">
            <Input value={form.company} leading={<Building />} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </Field>
          <Field label="Country">
            <Select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} options={COUNTRIES} />
          </Field>
          <Field label="VAT ID" hint="Change it from Billing → Billing details.">
            <Input mono value={acc.vatId} disabled />
          </Field>
        </div>
      </CardBody>
      <CardFooter>
        <span>{dirty ? 'You have unsaved changes' : 'All changes saved'}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" disabled={!dirty || save.isPending} onClick={() => setForm(init())}>
            Discard
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={!dirty || !emailOk || !form.firstName.trim()}
            loading={save.isPending}
            onClick={() => save.mutate({ ...form, firstName: form.firstName.trim(), lastName: form.lastName.trim(), name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim() })}
          >
            Save changes
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}

/* ------------------------------------------------------------------ */

interface Member {
  id: string
  name: string
  email: string
  role: Role
  lastActiveAt: string | null
  invited?: boolean
}

function InviteModal({ open, onClose, onInvite }: { open: boolean; onClose: () => void; onInvite: (email: string, role: Role) => void }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('Technical')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  // Reset the form each time the modal opens (adjusted during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setEmail('')
      setRole('Technical')
      setTouched(false)
    }
  }
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const submit = () => {
    setTouched(true)
    if (!ok) return
    setBusy(true)
    setTimeout(() => {
      setBusy(false)
      onInvite(email.trim().toLowerCase(), role)
      onClose()
    }, 600)
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<UserPlus />}
      title="Invite a teammate"
      description="They get access to this ORVEX account — not to your installation’s admin."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" loading={busy} onClick={submit}>
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
        <Field label="Email address" error={touched && !ok ? 'Enter a valid email address' : undefined}>
          <Input autoFocus type="email" value={email} invalid={touched && !ok} leading={<Mail />} onChange={(e) => setEmail(e.target.value)} placeholder="name@unlockdesk-demo.com" />
        </Field>
        <div>
          <p className="mb-1.5 text-[12.5px] font-medium text-fg">Role</p>
          <div className="space-y-2" role="radiogroup" aria-label="Role">
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={role === r.value}
                onClick={() => setRole(r.value)}
                className={cn('flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors', role === r.value ? 'border-accent/50 bg-accent/[0.06]' : 'border-line hover:bg-surface-2/60')}
              >
                <span className={cn('mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border', role === r.value ? 'border-accent bg-accent' : 'border-line-strong')}>{role === r.value && <span className="size-1.5 rounded-full bg-white" />}</span>
                <span>
                  <span className="block text-[13px] font-medium text-fg">{r.label}</span>
                  <span className="block text-[12px] text-fg-3">{r.description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  )
}

function TeamCard({ acc }: { acc: VendorAccount }) {
  const [members, setMembers] = useState<Member[]>(() => acc.team.map((m) => ({ ...m })))
  const [inviteOpen, setInviteOpen] = useState(false)
  const [removing, setRemoving] = useState<Member | null>(null)

  const changeRole = (m: Member, role: Role) => {
    setMembers((list) => list.map((x) => (x.id === m.id ? { ...x, role } : x)))
    toast.success('Role updated', `${m.name} is now ${role}.`)
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader
        icon={<Users />}
        title="Team"
        description={`${members.length} people can sign in to this ORVEX account`}
        actions={
          <Button size="sm" variant="secondary" leading={<UserPlus />} onClick={() => setInviteOpen(true)}>
            Invite
          </Button>
        }
      />
      <div className="divide-y divide-line border-y border-line">
        <AnimatePresence initial={false}>
          {members.map((m) => {
            const meta = roleMeta(m.role)
            const self = m.email === acc.email
            return (
              <motion.div key={m.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2/40">
                  <Avatar name={m.invited ? m.email : m.name} color={meta.color} className={cn(m.invited && 'opacity-60')} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-[13.5px] font-medium text-fg">
                      {m.invited ? m.email : m.name}
                      {self && <Badge>You</Badge>}
                    </p>
                    <p className="truncate text-[12px] text-fg-3">{m.invited ? 'Invitation sent · expires in 7 days' : `${m.email} · active ${relative(m.lastActiveAt)}`}</p>
                  </div>
                  {m.invited ? (
                    <Badge tone="info" dot>
                      Invited
                    </Badge>
                  ) : (
                    <Badge tone={meta.tone} className="hidden sm:inline-flex">
                      {m.role}
                    </Badge>
                  )}
                  <Popover
                    placement="bottom-end"
                    className="w-[220px]"
                    trigger={({ toggle, open }) => (
                      <Button size="sm" variant="ghost" icon onClick={toggle} disabled={self} aria-label={`Actions for ${m.name}`} className={cn(open && 'bg-surface-2 text-fg')}>
                        <Ellipsis />
                      </Button>
                    )}
                  >
                    {(close) => (
                      <>
                        {m.invited ? (
                          <MenuItem
                            icon={<Mail />}
                            onClick={() => {
                              close()
                              toast.success('Invitation resent', m.email)
                            }}
                          >
                            Resend invitation
                          </MenuItem>
                        ) : (
                          <>
                            <MenuLabel>Change role</MenuLabel>
                            {ROLES.map((r) => (
                              <MenuItem
                                key={r.value}
                                active={r.value === m.role}
                                onClick={() => {
                                  close()
                                  if (r.value !== m.role) changeRole(m, r.value)
                                }}
                              >
                                {r.label}
                              </MenuItem>
                            ))}
                          </>
                        )}
                        <MenuSeparator />
                        <MenuItem
                          danger
                          icon={<Trash />}
                          onClick={() => {
                            close()
                            setRemoving(m)
                          }}
                        >
                          {m.invited ? 'Revoke invitation' : 'Remove from account'}
                        </MenuItem>
                      </>
                    )}
                  </Popover>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
      <CardBody className="pt-4">
        <Callout icon={<LockKeyhole />} tone="neutral">
          These people manage your ORVEX account only. Admin users of your installation live in its own user directory — add them at <span className="font-mono text-fg">portal.unlockdesk-demo.com/admin</span> → System → Users.
        </Callout>
      </CardBody>

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvite={(email, role) => {
          setMembers((list) => [...list, { id: `inv_${Date.now()}`, name: email, email, role, lastActiveAt: null, invited: true }])
          toast.success('Invitation sent', `${email} was invited as ${role}.`)
        }}
      />
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        tone="danger"
        title={removing?.invited ? 'Revoke invitation?' : `Remove ${removing?.name}?`}
        description={removing?.invited ? `${removing.email} will no longer be able to join.` : 'They lose access to this ORVEX account immediately. Their installation admin account is not affected.'}
        confirmLabel={removing?.invited ? 'Revoke' : 'Remove'}
        onConfirm={() => {
          if (!removing) return
          setMembers((list) => list.filter((x) => x.id !== removing.id))
          toast.success(removing.invited ? 'Invitation revoked' : 'Member removed', removing.invited ? removing.email : removing.name)
          setRemoving(null)
        }}
      />
    </Card>
  )
}

/* ------------------------------------------------------------------ */

function SecurityCard({ acc }: { acc: VendorAccount }) {
  const [sessions, setSessions] = useState(acc.security.sessions)
  const others = sessions.filter((s) => !s.current)
  const revoke = (id: string) => {
    const s = sessions.find((x) => x.id === id)
    setSessions((list) => list.filter((x) => x.id !== id))
    toast.success('Session revoked', s ? `${s.device} · ${s.location} was signed out.` : undefined)
  }
  return (
    <Card>
      <CardHeader icon={<ShieldCheck />} title="Security" description={`Last sign-in ${relative(acc.security.lastLoginAt)}`} />
      <CardBody className="space-y-3">
        <div className="flex flex-col gap-3 rounded-xl border border-line p-4 sm:flex-row sm:items-center">
          <IconTile icon={<ShieldCheck />} tone={acc.security.mfa ? 'success' : 'warning'} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[13.5px] font-medium text-fg">Two-factor authentication</p>
              <Badge tone={acc.security.mfa ? 'success' : 'warning'} dot>
                {acc.security.mfa ? 'Enabled' : 'Off'}
              </Badge>
            </div>
            <p className="text-[12.5px] text-fg-3">Authenticator app · 8 recovery codes remaining</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => toast.info('Demo: MFA settings', 'You’d re-confirm your password, then manage authenticator apps and recovery codes.')}>
            Manage
          </Button>
        </div>
        <div className="flex flex-col gap-3 rounded-xl border border-line p-4 sm:flex-row sm:items-center">
          <IconTile icon={<KeyRound />} />
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-medium text-fg">Password</p>
            <p className="text-[12.5px] text-fg-3">Used together with your authenticator code</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => toast.info('Demo: password reset', `We’d email a secure reset link to ${acc.email}.`)}>
            Change password
          </Button>
        </div>
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-line p-4 sm:flex-row sm:items-center">
          <IconTile icon={<LockKeyhole />} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[13.5px] font-medium text-fg-2">Single sign-on (SAML / OIDC)</p>
              <Badge variant="outline">Enterprise</Badge>
            </div>
            <p className="text-[12.5px] text-fg-3">Sign in to this account with your identity provider.</p>
          </div>
        </div>

        <div className="pt-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[13px] font-medium text-fg">Active sessions</p>
            {others.length > 0 && (
              <Button
                size="xs"
                variant="ghost"
                leading={<LogOut />}
                onClick={() => {
                  setSessions((list) => list.filter((s) => s.current))
                  toast.success('Signed out everywhere else', `${others.length} other session${others.length === 1 ? '' : 's'} revoked.`)
                }}
              >
                Sign out other sessions
              </Button>
            )}
          </div>
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            <AnimatePresence initial={false}>
              {sessions.map((s) => (
                <motion.div key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-fg-2 [&_svg]:size-4">{/iphone|android/i.test(s.device) ? <Smartphone /> : <Laptop />}</span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-[13px] font-medium text-fg">
                        {s.device}
                        {s.current && (
                          <Badge tone="success" dot pulse>
                            This device
                          </Badge>
                        )}
                      </p>
                      <p className="truncate text-[12px] text-fg-3">
                        {s.location} · {s.current ? 'active now' : `active ${relative(s.lastActiveAt)}`}
                      </p>
                    </div>
                    {!s.current && (
                      <Button size="sm" variant="ghost" onClick={() => revoke(s.id)}>
                        Revoke
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

/* ------------------------------------------------------------------ */

function NotificationsCard({ email }: { email: string }) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => Object.fromEntries(NOTIFICATIONS.flatMap((g) => g.items.map((i) => [i.id, i.default]))))
  return (
    <Card>
      <CardHeader icon={<Bell />} title="Notifications" description={`Email to ${email}`} />
      <CardBody className="space-y-5">
        {NOTIFICATIONS.map((g) => (
          <div key={g.group}>
            <p className="mono-label mb-1">{g.group}</p>
            <div className="divide-y divide-line">
              {g.items.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-fg">{i.label}</p>
                    <p className="text-[12px] text-fg-3">{i.description}</p>
                  </div>
                  <Switch
                    checked={!!prefs[i.id]}
                    disabled={'locked' in i && i.locked}
                    label={i.label}
                    onChange={(v) => {
                      setPrefs((p) => ({ ...p, [i.id]: v }))
                      toast.success('Preference saved', `${i.label}: ${v ? 'on' : 'off'}`)
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  )
}

/* ------------------------------------------------------------------ */

function DangerCard({ acc }: { acc: VendorAccount }) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  return (
    <Card className="border-danger/30">
      <CardHeader icon={<TriangleAlert />} title="Danger zone" description="Irreversible actions for the whole account" />
      <div className="divide-y divide-line border-t border-line">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-medium text-fg">Export account data</p>
            <p className="text-[12.5px] text-fg-3">Invoices, tickets and license history as a ZIP archive.</p>
          </div>
          <Button size="sm" variant="secondary" leading={<Download />} onClick={() => toast.success('Demo: export requested', `We’d email a download link to ${acc.email} within a few minutes.`)}>
            Export
          </Button>
        </div>
        <div className="flex flex-col gap-3 bg-danger/[0.03] px-5 py-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-medium text-fg">Close account</p>
            <p className="text-[12.5px] text-fg-3">Cancels your subscription and revokes the license at the end of the billing period.</p>
          </div>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              setTyped('')
              setOpen(true)
            }}
          >
            Close account
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        tone="danger"
        title="Close your ORVEX account?"
        description="This cancels your subscription at the end of the current period. Your installations keep running on the version they have."
        confirmLabel="Close account"
        onConfirm={() => {
          if (typed.trim() !== acc.company) {
            toast.error('Confirmation doesn’t match', `Type “${acc.company}” to confirm.`)
            return
          }
          setOpen(false)
          toast.info('Demo: closure requested', 'In production our team confirms by email before anything is cancelled.')
        }}
      >
        <div className="space-y-3">
          <ul className="space-y-1.5 text-[12.5px] text-fg-2">
            <li>· Your installations and their databases stay on your infrastructure.</li>
            <li>· They keep operating on their installed Core version (perpetual use) — only new releases and support end.</li>
            <li>· Invoices remain available on request for 10 years.</li>
          </ul>
          <Field label={<>Type <span className="font-mono">{acc.company}</span> to confirm</>}>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={acc.company} invalid={!!typed && typed.trim() !== acc.company} />
          </Field>
        </div>
      </ConfirmDialog>
    </Card>
  )
}

/* ------------------------------------------------------------------ */

export default function AccountSettingsPage() {
  const account = useVendorAccount()
  const acc = account.data
  const [active, setActive] = useState('profile')
  useHashScroll(!!acc)

  useEffect(() => {
    if (!acc) return
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-section]'))
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) setActive(visible.target.id)
      },
      { rootMargin: '-120px 0px -55% 0px' },
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [acc])

  return (
    <div>
      <Reveal>
        <PageHeader
          title="Account"
          description="Your ORVEX account — profile, team access, security and notifications. Admin users of your installation are managed inside the installation itself."
        />
      </Reveal>

      <div className="grid gap-8 lg:grid-cols-[190px_minmax(0,1fr)]">
        <nav className="hidden lg:block" aria-label="Account sections">
          <div className="sticky top-32 space-y-0.5">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  history.replaceState(null, '', `#${s.id}`)
                }}
                className={cn(
                  'relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors [&_svg]:size-4',
                  active === s.id ? 'text-fg' : 'text-fg-3 hover:bg-surface-2 hover:text-fg-2',
                  s.id === 'danger' && active !== s.id && 'hover:text-danger',
                )}
              >
                {active === s.id && <motion.span layoutId="settings-nav" className="absolute inset-0 rounded-lg bg-surface-3/80 shadow-[inset_0_0_0_1px_var(--line)]" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                <span className="relative flex items-center gap-2.5">
                  {s.icon}
                  {s.label}
                </span>
              </button>
            ))}
          </div>
        </nav>

        <div className="min-w-0 space-y-5">
          {acc ? (
            <>
              <Reveal delay={0.05}>
                <Section id="profile">
                  <ProfileCard acc={acc} />
                </Section>
              </Reveal>
              <Reveal delay={0.1}>
                <Section id="team">
                  <TeamCard acc={acc} />
                </Section>
              </Reveal>
              <Reveal delay={0.15}>
                <Section id="security">
                  <SecurityCard acc={acc} />
                </Section>
              </Reveal>
              <Reveal delay={0.2}>
                <Section id="notifications">
                  <NotificationsCard email={acc.email} />
                </Section>
              </Reveal>
              <Reveal delay={0.25}>
                <Section id="danger">
                  <DangerCard acc={acc} />
                </Section>
              </Reveal>
            </>
          ) : (
            <>
              <CardSkeleton rows={6} />
              <CardSkeleton rows={4} />
              <Skeleton className="h-64 rounded-xl" />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
