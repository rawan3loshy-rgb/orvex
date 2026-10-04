import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { BadgeCheck, Box, Check, Container as ContainerIcon, Database, Equal, Globe, HardDrive, Lock, Plus, Puzzle, Server, ShieldCheck, SlidersHorizontal, Terminal, Users, type LucideIcon } from 'lucide-react'
import { CodeBlock } from '@/components/ui'
import { LogoMark } from '@/components/brand'
import { brand } from '@/config/brand'
import { cn } from '@/lib/cn'
import { Container, CornerMarks, Reveal, Section, SectionHeader } from './shared'
import { EASE } from './sharedUtils'

const INSTALLS = [
  { key: 'A', org: 'UnlockDesk Demo Ltd.', domain: 'portal.unlockdesk-demo.com', ext: 1, version: '2.4.1', db: 'Self-hosted PostgreSQL', host: 'ORVEX-DEMO-001 · self-hosted' },
  { key: 'B', org: 'GSM Wholesale BV', domain: 'app.gsm-wholesale.example', ext: 0, version: '2.5.0', db: 'Managed PostgreSQL', host: 'Self-hosted · cloud VM' },
  { key: 'C', org: 'FixNet Asia', domain: 'panel.fixnet-asia.example', ext: 2, version: '2.4.1', db: 'Dedicated PostgreSQL', host: 'Vendor-managed dedicated' },
  { key: 'N', org: 'Your company', domain: 'your-domain.com', ext: 0, version: '2.5.0', db: 'Your own PostgreSQL', host: 'wherever you choose' },
]

const DATABASES = ['Self-hosted PostgreSQL', 'Supabase', 'Neon', 'AWS RDS', 'Hetzner', 'Any PostgreSQL-compatible']

const STACK: { icon: LucideIcon; name: string; detail: string }[] = [
  { icon: Globe, name: 'Caddy', detail: 'automatic TLS · reverse proxy' },
  { icon: Box, name: 'ORVEX Core', detail: 'api · worker · scheduler' },
  { icon: Database, name: 'PostgreSQL', detail: 'data + job queue' },
  { icon: ContainerIcon, name: 'Docker Compose', detail: 'one-command deploy' },
  { icon: Server, name: 'Linux', detail: 'any modern distribution' },
]

function FanOut({ cols }: { cols: number }) {
  const xs = Array.from({ length: cols }, (_, i) => ((i + 0.5) / cols) * 1000)
  return (
    <svg viewBox="0 0 1000 80" preserveAspectRatio="none" className="block h-16 w-full sm:h-20" aria-hidden>
      {xs.map((x) => {
        const d = `M500,0 C500,44 ${x},36 ${x},80`
        return (
          <g key={x}>
            <path d={d} fill="none" stroke="var(--line-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <path d={d} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="4 6" vectorEffect="non-scaling-stroke" className="animate-dash" />
          </g>
        )
      })}
    </svg>
  )
}

function InstallColumn({ inst, i }: { inst: (typeof INSTALLS)[number]; i: number }) {
  const ghost = inst.key === 'N'
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 0.6, delay: 0.1 + i * 0.08, ease: EASE }}
      className={cn('relative flex flex-col rounded-2xl border border-dashed p-2.5 sm:p-3', ghost ? 'border-line-strong/70' : 'border-line-strong')}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2 px-1">
        <span className="truncate text-[11.5px] font-medium text-fg-2">
          Customer {inst.key}
          <span className="hidden text-fg-3 sm:inline"> · infrastructure</span>
        </span>
        <Lock className="size-3 shrink-0 text-fg-3" />
      </div>

      {/* installation */}
      <div className={cn('rounded-xl border bg-surface p-3 shadow-card', ghost ? 'border-line border-dashed' : 'border-line')}>
        <div className="flex items-center gap-2">
          <LogoMark className="size-5" />
          <span className="truncate text-[12.5px] font-semibold text-fg">{ghost ? 'Your installation' : inst.org}</span>
        </div>
        <div className="mt-1.5 truncate font-mono text-[10.5px] text-fg-3">{inst.domain}</div>
        <div className="mt-2.5 flex flex-wrap gap-1">
          <span className="rounded bg-accent/10 px-1.5 py-px font-mono text-[10px] text-accent-ink">core {inst.version}</span>
          <span className="rounded bg-fg/[0.06] px-1.5 py-px font-mono text-[10px] text-fg-2">config</span>
          {inst.ext > 0 && <span className="rounded bg-fg/[0.06] px-1.5 py-px font-mono text-[10px] text-fg-2">+{inst.ext} ext</span>}
        </div>
      </div>

      {/* local link */}
      <div className="relative mx-auto h-8 w-px bg-line-strong">
        <span className="absolute top-1/2 left-2 -translate-y-1/2 font-mono text-[9.5px] whitespace-nowrap text-fg-3">DATABASE_URL</span>
      </div>

      {/* database */}
      <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-2/70 p-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line-strong bg-surface-3 text-fg-2">
          <Database className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-medium text-fg">PostgreSQL {inst.key}</div>
          <div className="truncate text-[11px] text-fg-3">{inst.db}</div>
        </div>
      </div>
      <div className="mt-2 truncate px-1 font-mono text-[10px] text-fg-3">{inst.host}</div>
    </motion.div>
  )
}

function EquationTile({ label, body, icon: Icon, accent }: { label: string; body: string; icon: LucideIcon; accent?: boolean }) {
  return (
    <div className={cn('relative flex-1 overflow-hidden rounded-xl border p-4', accent ? 'border-accent/50 bg-surface' : 'border-line bg-surface')}>
      {accent && <span aria-hidden className="absolute inset-x-0 top-0 h-[2px] bg-accent" />}
      <div className="flex items-center gap-2">
        <Icon className={cn('size-4', accent ? 'text-accent-ink' : 'text-fg-3')} />
        <span className={cn('font-mono text-[11.5px] font-medium tracking-[0.08em]', accent ? 'text-accent-ink' : 'text-fg')}>{label}</span>
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-fg-3">{body}</p>
    </div>
  )
}

function Operator({ children }: { children: ReactNode }) {
  return <span className="grid size-7 shrink-0 place-items-center self-center rounded-full border border-line bg-surface text-fg-3 [&_svg]:size-3.5">{children}</span>
}

function Panel({ title, kicker, children, className }: { title: string; kicker: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6', className)}>
      <div className="mono-label">{kicker}</div>
      <h3 className="mt-1.5 text-[16px] font-semibold tracking-[-0.01em] text-fg">{title}</h3>
      <div className="mt-4 flex-1">{children}</div>
    </div>
  )
}

export function SelfHostedSection() {
  return (
    <Section id="self-hosted" className="overflow-hidden bg-bg-subtle/60">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-line" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-line" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_60%_40%_at_50%_20%,black,transparent)]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-hatch [mask-image:linear-gradient(0deg,black,transparent)]" />
      <Container className="relative">
        <SectionHeader
          align="center"
          index="11"
          eyebrow="Self-hosted architecture"
          title="One Core. Many independent installations. Zero shared data."
          description={`Every business runs its own installation of ${brand.coreProduct} — on its own server with its own PostgreSQL, or on a dedicated server we operate for it alone. Never multi-tenant SaaS. Signed releases flow down; orders, IMEIs and balances never flow back up.`}
        />

        {/* Diagram */}
        <div className="mx-auto mt-14 max-w-[1080px]">
          <Reveal className="flex justify-center">
            <div className="relative flex items-center gap-3 rounded-2xl border border-line-strong bg-surface px-4 py-3 shadow-pop sm:px-5">
              <CornerMarks className="-inset-1.5" />
              <LogoMark className="size-9" />
              <div>
                <div className="text-[14px] font-semibold text-fg">{brand.coreProduct} · release 2.5.0</div>
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-fg-3">
                  <BadgeCheck className="size-3.5 text-success" /> Ed25519-signed · one codebase
                </div>
              </div>
            </div>
          </Reveal>

          <div className="relative">
            <div className="hidden lg:block">
              <FanOut cols={4} />
            </div>
            <div className="lg:hidden">
              <FanOut cols={2} />
            </div>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="rounded-full border border-line bg-bg px-2.5 py-0.5 font-mono text-[10.5px] text-fg-3">code flows down · data never flows up</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {INSTALLS.map((inst, i) => (
              <InstallColumn key={inst.key} inst={inst} i={i} />
            ))}
          </div>

          <Reveal className="mt-6 flex items-start gap-3 rounded-2xl border border-success/25 bg-success/[0.05] px-4 py-3.5 sm:items-center sm:px-5">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success sm:mt-0" />
            <p className="text-[13.5px] leading-relaxed text-fg-2">
              <span className="font-semibold text-fg">Customer data never leaves their infrastructure.</span> The vendor platform only ever sees license validation and update checks — never orders, IMEIs, accounts, wallets, ledger entries, prices or supplier credentials.
            </p>
          </Reveal>
        </div>

        {/* Equation */}
        <Reveal className="mx-auto mt-16 max-w-[1080px]">
          <div className="mb-4 text-center">
            <span className="mono-label">How an installation is composed</span>
          </div>
          <div className="flex flex-col items-stretch gap-2.5 lg:flex-row lg:items-stretch">
            <EquationTile label="CORE" icon={Box} body="The identical signed codebase every customer runs." />
            <Operator>
              <Plus />
            </Operator>
            <EquationTile label="CONFIGURATION" icon={SlidersHorizontal} body="Your suppliers, services, pricing tiers, storefront and branding — stored in your DB." />
            <Operator>
              <Plus />
            </Operator>
            <EquationTile label="EXTENSIONS" icon={Puzzle} body="Custom supplier drivers, payment gateways and modules that updates never overwrite." />
            <Operator>
              <Equal />
            </Operator>
            <EquationTile accent label="CUSTOMER INSTALLATION" icon={Users} body="Unique to you — and upgradable exactly like everyone else’s." />
          </div>
        </Reveal>

        {/* Panels */}
        <div className="mx-auto mt-14 grid max-w-[1080px] gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Reveal>
            <Panel kicker="Database" title="Bring any PostgreSQL" className="h-full">
              <p className="text-[13.5px] leading-relaxed text-fg-2">Core is configured by a single connection string. PostgreSQL also carries the job queue — no Redis, no Kafka, no Kubernetes.</p>
              <CodeBlock className="mt-4" lang="bash" code={`# .env\nDATABASE_URL=postgresql://orvex:••••@10.0.4.12:5432/orvex`} wrap />
              <div className="mt-4 flex flex-wrap gap-1.5">
                {DATABASES.map((d) => (
                  <span key={d} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2/70 px-2 py-1 text-[11.5px] text-fg-2">
                    <Database className="size-3 text-fg-3" />
                    {d}
                  </span>
                ))}
              </div>
            </Panel>
          </Reveal>

          <Reveal delay={0.06}>
            <Panel kicker="Deployment stack" title="Boring, proven, portable" className="h-full">
              <div className="space-y-1.5">
                {STACK.map((s, i) => (
                  <div key={s.name} className="mx-auto flex items-center gap-3 rounded-lg border border-line bg-surface-2/60 px-3 py-2" style={{ width: `${82 + i * 4.5}%` }}>
                    <s.icon className="size-3.5 shrink-0 text-fg-3" />
                    <span className="text-[12.5px] font-medium text-fg">{s.name}</span>
                    <span className="ml-auto hidden truncate font-mono text-[10.5px] text-fg-3 sm:inline">{s.detail}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-fg/[0.04] px-3 py-2 font-mono text-[11.5px] text-fg-2">
                <Terminal className="size-3.5 text-fg-3" />
                docker compose up -d
              </div>
            </Panel>
          </Reveal>

          <Reveal delay={0.12} className="md:col-span-2 lg:col-span-1">
            <Panel kicker="Deployment" title="Self-hosted — or dedicated, operated by us" className="h-full">
              <div className="space-y-3">
                {[
                  { icon: HardDrive, name: 'Self-hosted', body: 'Your team runs it with our deployment package. Full root access, your change windows — assisted installation available.', points: ['Install guide & go-live checklist', 'Stable and beta channels'] },
                  { icon: Users, name: 'Vendor-managed dedicated', body: `${brand.company} operates a dedicated server for your company alone — its own PostgreSQL, its own data. Move to self-hosted any time.`, points: ['Single-customer, never shared', 'Backups & updates operated for you'] },
                ].map((o) => (
                  <div key={o.name} className="rounded-xl border border-line p-3.5">
                    <div className="flex items-center gap-2">
                      <o.icon className="size-4 text-accent-ink" />
                      <span className="text-[13.5px] font-semibold text-fg">{o.name}</span>
                    </div>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-2">{o.body}</p>
                    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                      {o.points.map((p) => (
                        <li key={p} className="flex items-center gap-1 text-[11.5px] text-fg-3">
                          <Check className="size-3 text-fg-3" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Panel>
          </Reveal>
        </div>
      </Container>
    </Section>
  )
}
