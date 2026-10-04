import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpRight, Boxes, CircleCheck, Cloud, Container, Cpu, Database, Download, Globe, HardDrive, Handshake, Layers, ListChecks, Network, Rocket, Server, ShieldCheck, Wrench } from 'lucide-react'
import { Badge, Button, Card, CardBody, CardFooter, CardHeader, CodeBlock, CopyButton, Field, Input, Modal, MonoValue, PageHeader, Select, Skeleton, StatusBadge, Textarea, Tooltip } from '@/components/ui'
import { useReleases, useTickets, useVendorInstallations, useVendorLicense, useVendorMutation } from '@/hooks/vendor'
import { supportService } from '@/services/vendor'
import { toast } from '@/stores/toast'
import { cn } from '@/lib/cn'
import { date, titleCase } from '@/lib/format'
import type { InstallationRef, SupportTicket } from '@/types/vendor'
import { Callout, CardSkeleton, EnvBadge, Heartbeat, IconTile, Reveal } from './components/kit'
import { cmpVersion, deploymentLabel, latestStable, useHashScroll } from './components/kitUtils'
import { DataOwnership, VendorScopeNote } from './components/DataOwnership'

/* ------------------------------------------------------------------ */
/*  Deployment package                                                 */
/* ------------------------------------------------------------------ */

const compose = (v: string) => `# ORVEX Core ${v} — reference single-server deployment
# One installation = one customer: its own server, its own PostgreSQL.
# Using a managed PostgreSQL instead? Remove the postgres service and
# point DATABASE_URL at it.
name: orvex

x-core: &core
  image: registry.orvex.io/core:${v}
  env_file: .env
  restart: unless-stopped
  depends_on:
    postgres:
      condition: service_healthy

services:
  core-api:
    <<: *core
    command: ["orvex", "serve", "api"]
    expose:
      - "8080"
    healthcheck:
      test: ["CMD", "orvex", "healthcheck", "--role", "api"]
      interval: 15s
      timeout: 5s
      retries: 5

  core-worker:        # order dispatch, supplier polling, webhooks
    <<: *core
    command: ["orvex", "serve", "worker"]

  core-scheduler:     # catalog sync, reconciliation, licence check
    <<: *core
    command: ["orvex", "serve", "scheduler"]

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: orvex
      POSTGRES_USER: orvex
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U orvex"]
      interval: 10s
      retries: 5

  caddy:
    image: caddy:2.8-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
    depends_on:
      - core-api

volumes:
  pgdata:
  caddy_data:
`

const envFile = (keyPrefix: string) => `# ── Application ─────────────────────────────────────────
APP_URL=https://portal.your-domain.com
APP_ENV=production

# ── Database · this installation's own PostgreSQL 14–17 ─
POSTGRES_PASSWORD=<replace-with-a-strong-password>
DATABASE_URL=postgres://orvex:\${POSTGRES_PASSWORD}@postgres:5432/orvex

# ── License · full key: Account → License ───────────────
LICENSE_KEY=${keyPrefix}-XXXX-XXXX
LICENSE_SERVER_URL=https://license.orvex.io

# ── Updates ─────────────────────────────────────────────
RELEASE_SERVER_URL=https://releases.orvex.io
UPDATE_CHANNEL=stable

# ── Security · generate with: openssl rand -base64 32 ───
ENCRYPTION_KEY=<replace-with-32-byte-base64-secret>
`

const installSh = `# 1 · Authenticate to the ORVEX registry with your license key
echo "$LICENSE_KEY" | docker login registry.orvex.io -u license --password-stdin

# 2 · Pull images and start core-api, core-worker, core-scheduler, postgres, caddy
docker compose pull
docker compose up -d

# 3 · Create the schema in your PostgreSQL and the first Owner
docker compose run --rm core-api orvex migrate --initial
docker compose run --rm core-api orvex init --owner-email you@your-domain.com

# 4 · Activate the license (binds installation ID + domain; metadata only)
docker compose run --rm core-api orvex license activate

# 5 · Verify, then open https://portal.your-domain.com/admin → System → Go-live
docker compose exec core-api orvex healthcheck --role api`

const caddyfile = `portal.your-domain.com {
  encode zstd gzip
  reverse_proxy core-api:8080
}`

const STEPS = [
  { title: 'Provision a server', detail: 'Any Linux host with Docker ≥ 24 and Compose v2 — 4 vCPU, 8 GB RAM and 80 GB SSD is a comfortable start. It runs only your installation.' },
  { title: 'Configure .env', detail: 'Set APP_URL, a PostgreSQL password, your LICENSE_KEY and a fresh ENCRYPTION_KEY (it seals supplier credentials — keep a copy offline).' },
  { title: 'Start the stack', detail: 'docker compose up -d starts core-api, core-worker, core-scheduler, postgres and caddy. Caddy obtains TLS for your domain automatically.' },
  { title: 'Migrate, create the Owner, activate', detail: 'Create the schema, the first Owner and activate the license. Admin users live in your installation, not in this account.' },
  { title: 'Work through the go-live checklist', detail: 'In your admin (System → Go-live): connect suppliers, sync and review catalogs, map offers, set pricing tiers, configure payments, place test orders — then open the storefront, reseller portal and API.' },
]

const MODELS: { title: string; icon: ReactNode; body: string; points: string[]; current?: boolean }[] = [
  {
    title: 'Self-hosted',
    icon: <Server />,
    current: true,
    body: 'You run the installation on a server you control. We provide signed releases, the deployment package, documentation and support.',
    points: ['Root access and your own change windows', 'Your backups, your PostgreSQL, your encryption key', 'Updates install only when you start them'],
  },
  {
    title: 'Vendor-managed dedicated',
    icon: <Handshake />,
    body: 'We operate a dedicated server for your company alone — the same Core, the same single-customer installation, with its own PostgreSQL. Not shared SaaS.',
    points: ['Server, backups and updates operated by ORVEX', 'Operator access only under the data processing agreement', 'Move to self-hosted any time with a full database export'],
  },
]

/* ------------------------------------------------------------------ */
/*  Vendor-assisted deployment request                                 */
/* ------------------------------------------------------------------ */

function AssistedModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const blank = { domain: '', environment: 'production', hosting: 'docker', database: 'self-hosted', window: '', notes: '' }
  const [form, setForm] = useState(blank)
  const [touched, setTouched] = useState(false)
  const [created, setCreated] = useState<SupportTicket | null>(null)

  // Reset the request each time the modal opens (adjusted during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setForm(blank)
      setTouched(false)
      setCreated(null)
    }
  }

  const create = useVendorMutation(supportService.create, { onSuccess: (t) => setCreated(t) })
  const domainOk = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(form.domain.trim())

  const HOSTING: Record<string, string> = { docker: 'Self-hosted — Docker Compose on our server', dedicated: 'Vendor-managed dedicated server (ORVEX operates it)', undecided: 'Not decided — advise us' }
  const DATABASES: Record<string, string> = { 'self-hosted': 'PostgreSQL in the Compose stack', managed: 'Our managed PostgreSQL', advice: 'Need advice' }

  const submit = () => {
    setTouched(true)
    if (!domainOk) return
    create.mutate({
      subject: `Vendor-assisted deployment — ${form.domain.trim()}`,
      category: 'Installation',
      priority: 'normal',
      installationId: null,
      body: [
        'Vendor-assisted deployment request',
        '',
        `Target domain: ${form.domain.trim()}`,
        `Environment: ${titleCase(form.environment)}`,
        `Hosting: ${HOSTING[form.hosting]}`,
        `Database: ${DATABASES[form.database]}`,
        `Preferred window: ${form.window.trim() || 'Flexible'}`,
        ...(form.notes.trim() ? ['', 'Notes:', form.notes.trim()] : []),
      ].join('\n'),
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={<Handshake />}
      title={created ? undefined : 'Request vendor-assisted deployment'}
      description={created ? undefined : 'Professional Services installs Core with you — on your server, or on a dedicated server we operate for you alone. Either way the installation, its PostgreSQL and its data are yours.'}
      hideClose={!!created}
      footer={
        created ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Done
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                onClose()
                navigate(`/account/support/${created.id}`)
              }}
            >
              View ticket
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="accent" loading={create.isPending} onClick={submit}>
              Send request
            </Button>
          </>
        )
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {created ? (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-6 text-center">
            <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 18, delay: 0.05 }} className="grid size-14 place-items-center rounded-2xl bg-success/12 text-success ring-1 ring-success/25">
              <CircleCheck className="size-7" />
            </motion.span>
            <p className="mt-4 text-[16px] font-semibold text-fg">Request sent</p>
            <p className="mt-1 font-mono text-[12.5px] text-fg-2">{created.id}</p>
            <p className="mt-3 max-w-sm text-[13px] text-fg-3">Professional Services will propose a deployment window within one business day. You’ll get access requirements and a checklist before we start.</p>
          </motion.div>
        ) : (
          <motion.div key="form" className="space-y-4">
            <Field label="Target domain" error={touched && !domainOk ? 'Enter the domain the installation will use, e.g. eu.unlockdesk-demo.com' : undefined} hint="We’ll bind it to your license once a slot is free.">
              <Input autoFocus mono value={form.domain} invalid={touched && !domainOk} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="eu.unlockdesk-demo.com" leading={<Globe />} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Environment">
                <Select value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })} options={[{ value: 'production', label: 'Production' }, { value: 'staging', label: 'Staging' }]} />
              </Field>
              <Field label="Hosting">
                <Select value={form.hosting} onChange={(e) => setForm({ ...form, hosting: e.target.value })} options={Object.entries(HOSTING).map(([value, label]) => ({ value, label }))} />
              </Field>
              <Field label="Database">
                <Select value={form.database} onChange={(e) => setForm({ ...form, database: e.target.value })} options={Object.entries(DATABASES).map(([value, label]) => ({ value, label }))} />
              </Field>
              <Field label="Preferred window" optional>
                <Input value={form.window} onChange={(e) => setForm({ ...form, window: e.target.value })} placeholder="e.g. week of 12 Oct, mornings CET" />
              </Field>
            </div>
            <Field label="Notes" optional>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Suppliers to connect (DHRU Fusion, REST, manual), a DHRU panel to migrate, payment gateways, IP allowlists, data residency…" />
            </Field>
            <p className="text-[12px] text-fg-3">Creates a support ticket in the Installation category. Typical engagement: half a day, quoted before we start.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/*  Installation detail card                                           */
/* ------------------------------------------------------------------ */

function Cell({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 bg-surface px-4 py-3', className)}>
      <p className="mono-label">{label}</p>
      <div className="mt-1 truncate text-[13.5px] font-medium text-fg">{children}</div>
    </div>
  )
}

/** Ticket categories that describe engineering work on an installation (drivers, updates, custom extensions). */
const ENGINEERING: SupportTicket['category'][] = ['Provider adapter', 'Custom development', 'Update']

function InstallationCard({ inst, latest, work }: { inst: InstallationRef; latest?: string; work?: SupportTicket[] }) {
  const behind = latest ? cmpVersion(latest, inst.version) > 0 : false
  const managed = /managed|neon|serverless|rds/i.test(inst.database)
  const prod = inst.environment === 'production'
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <IconTile icon={<Server />} size="lg" tone={prod ? 'accent' : 'warning'} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[16px] font-semibold tracking-[-0.015em] text-fg">{inst.name}</h3>
              <EnvBadge env={inst.environment} />
            </div>
            <div className="mt-0.5 flex items-center gap-1">
              <span className="truncate font-mono text-[12.5px] text-fg-2">{inst.domain}</span>
              <CopyButton value={`https://${inst.domain}`} label="Copy URL" />
            </div>
            <Heartbeat status={inst.status} at={inst.lastHeartbeatAt} className="mt-1" />
          </div>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <Button size="sm" variant="secondary" to="/admin/login" trailing={<ArrowUpRight />}>
            Open admin
          </Button>
          <span className="text-[11px] text-fg-3">Separate sign-in</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px border-y border-line bg-line sm:grid-cols-4">
        <Cell label="Core">
          <span className="flex items-center gap-1.5">
            <span className="font-mono">v{inst.version}</span>
            {behind ? (
              <Badge tone="accent" className="h-4.5 px-1.5 text-[10.5px]">
                {latest}
              </Badge>
            ) : (
              <CircleCheck className="size-3.5 text-success" />
            )}
          </span>
        </Cell>
        <Cell label="Schema">
          <span className="font-mono">{inst.schemaVersion}</span>
        </Cell>
        <Cell label="Channel">
          <span className="capitalize">{inst.updateChannel}</span>
        </Cell>
        <Cell label="Deployment">
          <span>{deploymentLabel(inst.deployment)}</span>
        </Cell>
      </div>

      <CardBody className="flex-1 space-y-4 pt-4">
        <div className={cn('flex items-start gap-3 rounded-xl border p-3.5', managed ? 'border-c3/25 bg-c3/[0.05]' : 'border-success/25 bg-success/[0.04]')}>
          <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg [&_svg]:size-4', managed ? 'bg-c3/12 text-c3' : 'bg-success/12 text-success')}>{managed ? <Cloud /> : <Database />}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-medium text-fg">{inst.database}</p>
              <Badge tone={managed ? 'neutral' : 'success'}>{managed ? 'Managed' : 'Self-hosted'}</Badge>
            </div>
            <p className="mt-0.5 text-[12px] text-fg-3">Dedicated to this installation. Not shared with other installations — and never with ORVEX.</p>
          </div>
        </div>
        <dl className="grid gap-x-6 gap-y-3 text-[12.5px] sm:grid-cols-2">
          {[
            { icon: <HardDrive />, label: 'Hosting', value: inst.hosting },
            { icon: <Network />, label: 'Region', value: inst.region },
            { icon: <Rocket />, label: 'Activated', value: date(inst.activatedAt) },
            { icon: <Layers />, label: 'Installation ID', value: <MonoValue value={inst.id} /> },
          ].map((r) => (
            <div key={r.label} className="flex min-w-0 items-start gap-2.5">
              <span className="mt-0.5 text-fg-3 [&_svg]:size-3.5">{r.icon}</span>
              <div className="min-w-0">
                <dt className="text-fg-3">{r.label}</dt>
                <dd className="truncate text-fg">{r.value}</dd>
              </div>
            </div>
          ))}
        </dl>
        {work && work.length > 0 && (
          <div>
            <p className="mono-label mb-2 flex items-center gap-1.5">
              <Wrench className="size-3" /> Drivers, updates & custom work
            </p>
            <div className="divide-y divide-line overflow-hidden rounded-lg border border-line">
              {work.slice(0, 3).map((t) => (
                <Link key={t.id} to={`/account/support/${t.id}`} className="flex items-center gap-3 px-3 py-2 text-[12.5px] transition-colors hover:bg-surface-2/60">
                  <span className="shrink-0 font-mono text-[11.5px] text-fg-3">{t.id}</span>
                  <span className="min-w-0 flex-1 truncate text-fg-2">{t.subject}</span>
                  <StatusBadge status={t.status} className="shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardBody>
      <CardFooter>
        <span className="truncate">
          Admin at <span className="font-mono text-fg-2">{inst.domain}/admin</span> · own user directory
        </span>
        {behind && (
          <Button size="xs" variant="link" to="/account/updates">
            Update available
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

/* ------------------------------------------------------------------ */

export default function InstallationPage() {
  const installs = useVendorInstallations()
  const license = useVendorLicense()
  const releases = useReleases()
  const tickets = useTickets()
  const [assistOpen, setAssistOpen] = useState(false)
  useHashScroll(!!installs.data)

  const latest = latestStable(releases.data)
  const version = latest?.version ?? '2.5.0'
  const keyPrefix = license.data?.keyMasked.split('-').slice(0, 3).join('-') ?? 'LX-0000-XXXX'
  const used = installs.data?.length ?? 0
  const max = license.data?.maxInstallations ?? 0
  const full = !!license.data && used >= max

  return (
    <div>
      <Reveal>
        <PageHeader
          title="Installations"
          description="Each installation is an independent, single-customer deployment of ORVEX Core — its own server, its own PostgreSQL, its own admin users. This page shows the metadata your installations report with their license check."
          actions={
            <>
              <Button variant="secondary" leading={<Container />} onClick={() => document.getElementById('deploy')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                Deploy a new installation
              </Button>
              <Button variant="primary" leading={<Handshake />} onClick={() => setAssistOpen(true)}>
                Vendor-assisted deployment
              </Button>
            </>
          }
        />
      </Reveal>

      <Reveal delay={0.03} className="mb-5">
        <VendorScopeNote />
      </Reveal>

      <div className="grid gap-5 xl:grid-cols-2">
        {installs.data
          ? installs.data.map((i, idx) => (
              <Reveal key={i.id} delay={0.05 + idx * 0.05}>
                <InstallationCard
                  inst={i}
                  latest={latest?.version}
                  work={tickets.data?.filter((t) => t.installationId === i.id && ENGINEERING.includes(t.category)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))}
                />
              </Reveal>
            ))
          : Array.from({ length: 2 }, (_, i) => <CardSkeleton key={i} rows={8} />)}
      </div>

      {/* Data ownership */}
      <Reveal delay={0.15} className="mt-5">
        <Card>
          <CardHeader icon={<ShieldCheck />} title="Who holds what" description="Operational data lives only in your infrastructure. This portal only knows your commercial relationship with ORVEX Systems." />
          <CardBody>
            <DataOwnership />
          </CardBody>
        </Card>
      </Reveal>

      {/* Deployment models */}
      <Reveal delay={0.18} className="mt-5">
        <div className="grid gap-4 md:grid-cols-2">
          {MODELS.map((m) => (
            <Card key={m.title} className="relative overflow-hidden p-5">
              {m.current && <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-accent" />}
              <div className="flex items-start gap-3">
                <IconTile icon={m.icon} tone={m.current ? 'accent' : 'neutral'} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[14px] font-semibold text-fg">{m.title}</h3>
                    {m.current && <Badge tone="accent">Your installations</Badge>}
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-fg-2">{m.body}</p>
                  <ul className="mt-3 space-y-1.5">
                    {m.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2 text-[12.5px] text-fg-3">
                        <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-fg-3" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Reveal>

      {/* Deploy */}
      <section id="deploy" className="mt-12 scroll-mt-32">
        <Reveal delay={0.2}>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mono-label mb-1.5">Deployment package · Core {version}</p>
              <h2 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-fg">Deploy a new installation</h2>
              <p className="mt-1 max-w-2xl text-[13px] text-fg-2">Everything you need to run Core yourself: a reference Docker Compose stack (core-api, core-worker, core-scheduler, postgres, caddy), an environment template and the install commands. No Kubernetes, message broker or cache cluster required.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" leading={<Download />} onClick={() => toast.success('Demo: package generated', `orvex-core-${version}-deploy.tar.gz — compose file, .env template and Caddyfile.`)}>
                Download package
              </Button>
              <Button variant="accent" leading={<Handshake />} onClick={() => setAssistOpen(true)}>
                Request vendor-assisted deployment
              </Button>
            </div>
          </div>

          {full && (
            <Callout
              tone="warning"
              icon={<Boxes />}
              className="mb-5"
              title={`All ${max} installation slots on your license are in use`}
              action={
                <Button size="sm" variant="secondary" to="/account/subscription#plans">
                  Compare plans
                </Button>
              }
            >
              A new installation needs a free slot. Deactivate one from its admin (System → License) or add capacity.
            </Callout>
          )}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)]">
            <div className="space-y-5">
              <Card>
                <CardHeader icon={<Cpu />} title="Requirements" />
                <CardBody>
                  {latest ? (
                    <ul className="space-y-2.5 text-[12.5px]">
                      {[
                        ['Docker', latest.compatibility.docker, 'with Compose v2'],
                        ['PostgreSQL', latest.compatibility.postgres, 'self-hosted or managed'],
                        ['Server', '4 vCPU · 8 GB RAM', '80 GB SSD to start'],
                        ['Network', 'Outbound HTTPS', 'license, registry, release servers and your supplier APIs'],
                      ].map(([k, v, d]) => (
                        <li key={k} className="flex items-baseline justify-between gap-3 border-b border-line pb-2.5 last:border-0 last:pb-0">
                          <span className="text-fg-3">{k}</span>
                          <span className="text-right">
                            <span className="font-medium text-fg">{v}</span>
                            <span className="block text-[11.5px] text-fg-3">{d}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }, (_, i) => (
                        <Skeleton key={i} className="h-4" />
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
              <Card>
                <CardHeader icon={<ListChecks />} title="Install in five steps" description="From an empty server to go-live." />
                <CardBody>
                  <ol className="relative space-y-4">
                    <span aria-hidden className="absolute top-3 bottom-3 left-[11px] w-px bg-line" />
                    {STEPS.map((s, i) => (
                      <li key={s.title} className="relative flex gap-3">
                        <span className="z-[1] grid size-6 shrink-0 place-items-center rounded-full border border-line bg-surface font-mono text-[11px] text-fg-2">{i + 1}</span>
                        <div className="pt-0.5">
                          <p className="text-[13px] font-medium text-fg">{s.title}</p>
                          <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-3">{s.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </CardBody>
              </Card>
            </div>

            <div className="min-w-0 space-y-3">
              <CodeBlock
                lineNumbers
                maxHeight={560}
                tabs={[
                  { label: 'docker-compose.yml', lang: 'yaml', code: compose(version) },
                  { label: '.env', lang: 'bash', code: envFile(keyPrefix) },
                  { label: 'install.sh', lang: 'bash', code: installSh },
                  { label: 'Caddyfile', lang: 'text', code: caddyfile },
                ]}
              />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-fg-3">
                <span className="inline-flex items-center gap-1.5">
                  <Wrench className="size-3.5" /> Replace every placeholder before starting.
                </span>
                <Tooltip content="Images are signed; Core verifies the Ed25519 release signature before it starts.">
                  <span className="inline-flex cursor-help items-center gap-1.5">
                    <ShieldCheck className="size-3.5" /> registry.orvex.io/core:{version}
                  </span>
                </Tooltip>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <AssistedModal open={assistOpen} onClose={() => setAssistOpen(false)} />
    </div>
  )
}
