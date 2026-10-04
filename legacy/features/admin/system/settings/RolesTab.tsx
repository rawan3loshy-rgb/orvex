import { useState } from 'react'
import { motion } from 'motion/react'
import { Check, KeyRound, Lock, Minus } from 'lucide-react'
import { Avatar, Badge, Card, CardHeader, Skeleton, Tooltip } from '@/components/ui'
import { useRoles, useUsers } from '@/hooks/installation'
import { cn } from '@/lib/cn'
import { plural } from '@/lib/format'
import type { Role } from '@/types/installation'

const AREAS: { id: string; label: string; hint: string }[] = [
  { id: 'orders', label: 'Orders', hint: 'View, retry, refund and cancel IMEI & unlock orders' },
  { id: 'services', label: 'Services', hint: 'Catalog, input fields and prices' },
  { id: 'providers', label: 'Providers', hint: 'Supplier connections and credentials' },
  { id: 'routing', label: 'Routing', hint: 'Priorities, fallback and rules' },
  { id: 'resellers', label: 'Resellers', hint: 'Accounts, balances, groups and limits' },
  { id: 'pricing', label: 'Pricing', hint: 'Dealer / distributor groups and overrides' },
  { id: 'transactions', label: 'Transactions', hint: 'Ledger, top-ups and refunds' },
  { id: 'reports', label: 'Reports', hint: 'Revenue, margin and supplier analytics' },
  { id: 'developer', label: 'Developer', hint: 'API keys, webhooks, logs' },
  { id: 'website', label: 'Website', hint: 'Pages, sections, theme' },
  { id: 'settings', label: 'Settings', hint: 'Installation configuration' },
  { id: 'users', label: 'Users', hint: 'Invite and manage admins' },
  { id: 'license', label: 'License', hint: 'License and updates' },
]

/** Resolve read/write for an area from permission strings (supports 'area:*' and '*'). */
export function access(perms: string[], area: string) {
  if (perms.includes('*')) return { read: true, write: true, via: '*' }
  if (perms.includes(`${area}:*`)) return { read: true, write: true, via: `${area}:*` }
  const write = perms.includes(`${area}:write`)
  const read = write || perms.includes(`${area}:read`)
  return { read, write, via: write ? `${area}:write` : read ? `${area}:read` : null }
}

export function RolesTab() {
  const roles = useRoles()
  const users = useUsers()
  const [selected, setSelected] = useState<string>('role_ops')
  const list = roles.data ?? []
  const sel = list.find((r) => r.id === selected) ?? list[0]

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {roles.isLoading
          ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[132px] rounded-xl" />)
          : list.map((r, i) => {
              const members = (users.data ?? []).filter((u) => u.roleId === r.id)
              const areas = AREAS.filter((a) => access(r.permissions, a.id).read).length
              const active = sel?.id === r.id
              return (
                <motion.button
                  key={r.id}
                  type="button"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => setSelected(r.id)}
                  className={cn('relative flex flex-col overflow-hidden rounded-xl border bg-surface p-4 text-left shadow-card transition-[border-color,box-shadow]', active ? 'border-accent/50' : 'border-line hover:border-line-strong hover:shadow-pop')}
                >
                  {active && <motion.span layoutId="role-selected" aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-accent" />}
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-[14px] font-semibold text-fg">
                      <KeyRound className={cn('size-3.5', active ? 'text-accent-ink' : 'text-fg-3')} />
                      {r.name}
                    </span>
                    {r.system ? (
                      <Badge tone="neutral" icon={<Lock />}>
                        Built-in
                      </Badge>
                    ) : (
                      <Badge tone="info">Custom</Badge>
                    )}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[12.5px] text-fg-3">{r.description}</p>
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <div className="flex -space-x-1.5">
                      {members.slice(0, 4).map((u) => (
                        <Tooltip key={u.id} content={u.name}>
                          <Avatar name={u.name} color={u.color} size="sm" className="ring-2 ring-surface" />
                        </Tooltip>
                      ))}
                      {members.length === 0 && <span className="text-[12px] text-fg-3">No members</span>}
                    </div>
                    <span className="text-[12px] text-fg-3">
                      {plural(members.length, 'member')} · {areas}/{AREAS.length} areas
                    </span>
                  </div>
                </motion.button>
              )
            })}
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Permissions matrix"
          description="R = read · W = create, edit & delete. Wildcards: “orders:*” grants both on an area, “*” grants everything."
          actions={sel && <Badge tone="neutral" variant="outline">{sel.name} highlighted</Badge>}
        />
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full min-w-[760px] border-separate border-spacing-0 text-[12.5px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-[1] border-b border-line bg-surface px-5 py-2.5 text-left font-medium text-fg-3">Area</th>
                {list.map((r) => (
                  <th key={r.id} className={cn('border-b border-line px-2 py-2.5 text-center font-medium whitespace-nowrap transition-colors', sel?.id === r.id ? 'bg-accent/[0.07] text-fg' : 'text-fg-3')}>
                    <button type="button" onClick={() => setSelected(r.id)} className="hover:text-fg">
                      {r.name}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AREAS.map((a) => (
                <tr key={a.id} className="group">
                  <td className="sticky left-0 z-[1] border-b border-line bg-surface px-5 py-2 group-last:border-b-0 group-hover:bg-surface-2">
                    <p className="font-medium text-fg">{a.label}</p>
                    <p className="text-[11.5px] text-fg-3">{a.hint}</p>
                  </td>
                  {list.map((r) => (
                    <td key={r.id} className={cn('border-b border-line px-2 py-2 text-center group-last:border-b-0 group-hover:bg-surface-2/60', sel?.id === r.id && 'bg-accent/[0.05]')}>
                      <AccessCell role={r} area={a.id} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sel && (
          <div className="border-t border-line px-5 py-3.5">
            <p className="mb-2 text-[12px] text-fg-3">Permission strings for {sel.name}</p>
            <div className="flex flex-wrap gap-1.5">
              {sel.permissions.map((p) => (
                <span key={p} className="inline-flex h-6 items-center rounded-md border border-line bg-surface-2 px-2 font-mono text-[11.5px] text-fg-2">
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

function AccessCell({ role, area }: { role: Role; area: string }) {
  const a = access(role.permissions, area)
  return (
    <Tooltip content={a.via ? `Granted by “${a.via}”` : 'No access'}>
      <span className="inline-flex gap-1">
        <Pill on={a.read} label="R" />
        <Pill on={a.write} label="W" />
      </span>
    </Tooltip>
  )
}

function Pill({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={cn('inline-flex h-5 w-7 items-center justify-center gap-0.5 rounded-md font-mono text-[10px] font-medium', on ? 'bg-success/12 text-success ring-1 ring-success/25 ring-inset' : 'bg-fg/[0.04] text-fg-3/60')}>
      {on ? <Check className="size-2.5" strokeWidth={3} /> : <Minus className="size-2.5" />}
      {label}
    </span>
  )
}
