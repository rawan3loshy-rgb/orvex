import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CircleCheck, FingerprintPattern, Network, Plus, ShieldAlert, ShieldCheck, TriangleAlert, X } from 'lucide-react'
import { Badge, Button, Input, Select, Switch } from '@/components/ui'
import { useUsers } from '@/hooks/installation'
import { FormSkeleton, SaveBar, SettingRow, SettingsCard, useSectionForm } from './form'

/** Demo: the admin's current address as seen by Core. */
const CURRENT_IP = '10.0.4.23'

function ipToInt(ip: string) {
  const p = ip.split('.').map(Number)
  if (p.length !== 4 || p.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return null
  return ((p[0]! << 24) >>> 0) + (p[1]! << 16) + (p[2]! << 8) + p[3]!
}

export function parseCidr(s: string) {
  const [ip, bitsRaw] = s.trim().split('/')
  const base = ipToInt(ip ?? '')
  const bits = bitsRaw === undefined ? 32 : Number(bitsRaw)
  if (base == null || !Number.isInteger(bits) || bits < 0 || bits > 32) return null
  return { base, bits }
}

function inCidr(ip: string, cidr: string) {
  const c = parseCidr(cidr)
  const n = ipToInt(ip)
  if (!c || n == null) return false
  const mask = c.bits === 0 ? 0 : (~0 << (32 - c.bits)) >>> 0
  return (n & mask) >>> 0 === (c.base & mask) >>> 0
}

export function SecurityTab() {
  const f = useSectionForm('security', 'Security')
  const users = useUsers()
  const [entry, setEntry] = useState('')
  const [entryError, setEntryError] = useState<string | null>(null)
  if (!f.values) return <FormSkeleton rows={6} />
  const v = f.values

  const noMfa = (users.data ?? []).filter((u) => u.status === 'active' && !u.mfa)
  const allow = v.ipAllowlistAdmin
  const selfAllowed = allow.length === 0 || allow.some((c) => inCidr(CURRENT_IP, c))

  const add = () => {
    const val = entry.trim()
    if (!val) return
    if (!parseCidr(val)) return setEntryError('Enter an IPv4 address or CIDR range, e.g. 203.0.113.0/24')
    if (allow.includes(val)) return setEntryError('Already in the allowlist')
    f.set('ipAllowlistAdmin', [...allow, val])
    setEntry('')
    setEntryError(null)
  }

  return (
    <div>
      <SettingsCard icon={<FingerprintPattern />} title="Authentication" description="Applies to every admin user of this installation.">
        <SettingRow label="Require multi-factor authentication" description="Users without MFA are asked to enrol a TOTP app or passkey at their next sign-in." changed={f.isChanged('enforceMfa')}>
          <div className="flex items-start gap-3">
            <Switch checked={v.enforceMfa} onChange={(x) => f.set('enforceMfa', x)} label="Require MFA" />
            <div className="text-[12.5px]">
              <p className="text-fg">{v.enforceMfa ? 'Enforced for all users' : 'Optional'}</p>
              {noMfa.length > 0 && (
                <p className="mt-0.5 text-fg-3">
                  {noMfa.map((u) => u.name).join(', ')} {noMfa.length === 1 ? 'has' : 'have'} not enrolled yet{v.enforceMfa ? ' — prompted at next sign-in.' : '.'}
                </p>
              )}
            </div>
          </div>
        </SettingRow>
        <SettingRow label="Password policy" description="Minimum length for admin passwords. Passwords are hashed with Argon2id and checked against common-password lists locally." changed={f.isChanged('passwordMinLength')}>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={String(v.passwordMinLength)} onChange={(e) => f.set('passwordMinLength', Number(e.target.value))} options={[8, 10, 12, 14, 16, 20].map((n) => ({ value: String(n), label: `${n} characters minimum` }))} className="w-56" />
            {v.passwordMinLength < 12 && (
              <Badge tone="warning" icon={<TriangleAlert />}>
                Below recommended 12
              </Badge>
            )}
          </div>
        </SettingRow>
        <SettingRow label="Session timeout" description="Idle admin sessions are signed out after this period." changed={f.isChanged('sessionTimeoutMin')}>
          <Select
            value={String(v.sessionTimeoutMin)}
            onChange={(e) => f.set('sessionTimeoutMin', Number(e.target.value))}
            options={[15, 30, 60, 120, 240, 480].map((m) => ({ value: String(m), label: m < 60 ? `${m} minutes` : `${m / 60} hour${m === 60 ? '' : 's'}` }))}
            className="w-56"
          />
        </SettingRow>
      </SettingsCard>

      <SettingsCard className="mt-5" icon={<Network />} title="Admin network access" description="Restrict who can reach /admin. The Reseller API has its own per-key allowlists.">
        <SettingRow label="IP allowlist" description="Only these addresses or CIDR ranges can sign in to the admin. Leave empty to allow any address." changed={f.isChanged('ipAllowlistAdmin')}>
          <div className="max-w-lg space-y-3">
            <div className="flex min-h-9 flex-wrap gap-1.5">
              <AnimatePresence initial={false}>
                {allow.map((c) => (
                  <motion.span
                    key={c}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-line bg-surface-2 pr-1 pl-2.5 font-mono text-[12px] text-fg"
                  >
                    {c}
                    {inCidr(CURRENT_IP, c) && <span className="font-sans text-[10.5px] text-success">you</span>}
                    <button type="button" onClick={() => f.set('ipAllowlistAdmin', allow.filter((x) => x !== c))} className="grid size-5 place-items-center rounded-md text-fg-3 hover:bg-surface-3 hover:text-fg" aria-label={`Remove ${c}`}>
                      <X className="size-3" />
                    </button>
                  </motion.span>
                ))}
              </AnimatePresence>
              {allow.length === 0 && <span className="self-center text-[12.5px] text-fg-3">No restriction — any address can reach the admin sign-in.</span>}
            </div>
            <div className="flex gap-2">
              <Input
                value={entry}
                mono
                placeholder="203.0.113.0/24"
                invalid={!!entryError}
                onChange={(e) => {
                  setEntry(e.target.value)
                  setEntryError(null)
                }}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
                className="flex-1"
              />
              <Button variant="secondary" leading={<Plus />} onClick={add}>
                Add
              </Button>
            </div>
            {entryError && <p className="text-xs text-danger">{entryError}</p>}
            <div className={selfAllowed ? 'flex items-center gap-2 text-[12px] text-fg-3' : 'flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/[0.06] px-3 py-2 text-[12px] text-danger'}>
              {selfAllowed ? <CircleCheck className="size-3.5 text-success" /> : <ShieldAlert className="size-3.5" />}
              {selfAllowed ? (
                <span>
                  Your current address <span className="font-mono text-fg-2">{CURRENT_IP}</span> is allowed.
                </span>
              ) : (
                <span>
                  Your current address <span className="font-mono">{CURRENT_IP}</span> is not in the list — saving would lock you out.
                </span>
              )}
            </div>
          </div>
        </SettingRow>
      </SettingsCard>

      <SettingsCard className="mt-5" icon={<ShieldCheck />} title="Audit log" description="Every admin action is recorded in your own database.">
        <SettingRow label="Retention" description="Audit entries older than this are pruned nightly. Security changes are always logged as critical events." changed={f.isChanged('auditRetentionDays')}>
          <Select
            value={String(v.auditRetentionDays)}
            onChange={(e) => f.set('auditRetentionDays', Number(e.target.value))}
            options={[90, 180, 365, 730, 1095].map((d) => ({ value: String(d), label: d < 365 ? `${d} days` : `${d / 365} year${d === 365 ? '' : 's'}` }))}
            className="w-56"
          />
        </SettingRow>
      </SettingsCard>

      <SaveBar dirty={f.dirty} count={f.changed.length} saving={f.saving} invalid={!selfAllowed} onDiscard={f.discard} onSave={f.save} />
    </div>
  )
}
