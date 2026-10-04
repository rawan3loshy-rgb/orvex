import { BadgeCheck, FileKey, KeyRound, Lock, ScrollText, ShieldCheck, UserCheck, type LucideIcon } from 'lucide-react'
import { Avatar, Badge, ProgressRing, SecretField } from '@/components/ui'
import { cn } from '@/lib/cn'
import { Container, Reveal, Section, SectionHeader } from './shared'
import { brand } from '@/config/brand'

const ITEMS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Lock, title: 'Encrypted at rest', body: 'Supplier credentials are sealed with AES-256-GCM using a key only your installation holds.' },
  { icon: KeyRound, title: 'Write-only secrets', body: 'Once saved, a secret can be replaced or rotated — never read back by anyone, including admins.' },
  { icon: ShieldCheck, title: 'Scoped keys + IP allowlists', body: 'Every API and DHRU key belongs to an account, carries explicit scopes and can be pinned to the networks that account uses.' },
  { icon: UserCheck, title: 'Roles, permissions + MFA', body: 'Owner, Admin, Finance, Support and Developer roles. Sensitive commands — refunds, wallet adjustments, review resolutions — are permission-checked server-side.' },
  { icon: ScrollText, title: 'Full audit log', body: 'Who changed what, when and from where — for every price rule, refund, wallet adjustment, key and credential.' },
  { icon: BadgeCheck, title: 'Signed releases', body: 'Updates are verified against our Ed25519 release key before a single file is installed.' },
  { icon: FileKey, title: 'Signed license, no kill switch', body: 'Licenses are verified locally with a 30-day offline cache. An expired update entitlement never stops operations — only new releases wait for renewal.' },
]

const AUDIT = [
  { who: 'Alex Morgan', what: 'resolved Needs Review for', target: 'ORD-2H5R8N', at: '2m ago', color: 'var(--c1)' },
  { who: 'Maya Lindqvist', what: 'created API key for', target: 'ABC GSM', at: '1h ago', color: 'var(--c3)' },
  { who: 'Sarah Chen', what: 'refunded $1.20 to wallet on', target: 'ORD-6C2W4K', at: '3h ago', color: 'var(--c4)' },
  { who: 'System', what: 'verified signature of', target: 'release 2.5.0', at: 'Yesterday', color: 'var(--c2)' },
]

function SecurityVisual() {
  return (
    <div className="relative space-y-3">
      <div className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13.5px] font-semibold text-fg">Supplier credentials</span>
          <Badge tone="success" icon={<Lock />}>
            AES-256-GCM
          </Badge>
        </div>
        <div className="mt-3 space-y-2">
          <SecretField masked="••••-••••-••••-K19Q" label="DHRU Supplier Alpha · DHRU API access key" />
          <SecretField masked="gc_••••••••••••••••7f2c" label="GammaCheck IMEI API · Bearer token" />
        </div>
        <p className="mt-2.5 text-[11.5px] text-fg-3">Write-only. Stored values can be replaced, never revealed.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-fg">API key</span>
            <span className="font-mono text-[11px] text-fg-3">orx_live_7Hq2… · ABC GSM</span>
          </div>
          <div className="mono-label mt-3 mb-1.5">Scopes</div>
          <div className="flex flex-wrap gap-1">
            {['orders:write', 'orders:read', 'services:read', 'account:read'].map((s) => (
              <span key={s} className="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[10.5px] text-accent-ink">
                {s}
              </span>
            ))}
          </div>
          <div className="mono-label mt-3 mb-1.5">IP allowlist</div>
          <div className="flex flex-wrap gap-1">
            {['203.0.113.0/24', '198.51.100.14'].map((s) => (
              <span key={s} className="rounded bg-fg/[0.06] px-1.5 py-0.5 font-mono text-[10.5px] text-fg-2">
                {s}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-4 shadow-card">
          <span className="text-[13px] font-semibold text-fg">License</span>
          <div className="mt-3 flex items-center gap-3">
            <ProgressRing value={100} tone="success" size={46}>
              <ShieldCheck className="size-4 text-success" />
            </ProgressRing>
            <div className="min-w-0 leading-tight">
              <div className="text-[12.5px] font-medium text-fg">Signature valid</div>
              <div className="font-mono text-[10.5px] text-fg-3">Ed25519 · verified locally</div>
            </div>
          </div>
          <div className="mt-3 rounded-lg bg-fg/[0.04] px-2.5 py-1.5 text-[11.5px] text-fg-2">
            Offline cache: <span className="font-medium text-fg">30 days</span> · no kill switch
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <span className="text-[13px] font-semibold text-fg">Audit log</span>
          <span className="font-mono text-[11px] text-fg-3">immutable · exportable</span>
        </div>
        <ul>
          {AUDIT.map((a, i) => (
            <li key={i} className={cn('flex items-center gap-3 px-4 py-2.5', i < AUDIT.length - 1 && 'border-b border-line')}>
              <Avatar name={a.who} size="xs" color={a.color} />
              <p className="min-w-0 flex-1 truncate text-[12.5px] text-fg-2">
                <span className="font-medium text-fg">{a.who}</span> {a.what} <span className="font-medium text-fg">{a.target}</span>
              </p>
              <span className="shrink-0 font-mono text-[10.5px] text-fg-3">{a.at}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function SecuritySection() {
  return (
    <Section id="security">
      <Container>
        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-14">
          <div>
            <SectionHeader
              index="12"
              eyebrow="Security"
              title="Secure by default. Auditable by design."
              description={`${brand.product} handles supplier credentials, customer wallets and payments. Every layer is built on the assumption that it will be audited.`}
            />
            <div className="mt-10 grid gap-x-6 gap-y-6 sm:grid-cols-2">
              {ITEMS.map((it, i) => (
                <Reveal key={it.title} delay={(i % 2) * 0.05}>
                  <div className="flex gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface text-fg-2 shadow-card">
                      <it.icon className="size-4" />
                    </span>
                    <div>
                      <div className="text-[14px] font-semibold text-fg">{it.title}</div>
                      <p className="mt-1 text-[13px] leading-relaxed text-fg-2">{it.body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
          <Reveal delay={0.1} className="lg:pt-6">
            <SecurityVisual />
          </Reveal>
        </div>
      </Container>
    </Section>
  )
}
