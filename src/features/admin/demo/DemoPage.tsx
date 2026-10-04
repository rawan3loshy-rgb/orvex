import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  CreditCard,
  FastForward,
  FileSearch,
  FlaskConical,
  Gauge,
  Globe,
  LayoutDashboard,
  ListChecks,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  UserCog,
} from 'lucide-react'
import { Badge, Button, Card, CardHeader, ConfirmDialog, CopyButton, Dot, EmptyState, Segmented, Select, Skeleton, Switch } from '@/components/ui'
import { useInstMutation, useDemoState, useMe } from '@/hooks/installation'
import { demoService } from '@/services/installation'
import { toast } from '@/stores/toast'
import { cn } from '@/lib/cn'
import { dateTime, num } from '@/lib/format'
import type { DemoState } from '@/types/installation'
import { BehaviourSimulator, SupplierStateCard } from './SupplierSimulator'

const ROLE_NOTE: Record<string, string> = {
  Owner: 'Everything, including roles, license, updates and settings.',
  Admin: 'Everything except roles and system administration (updates, settings).',
  Operations: 'Orders, reviews, suppliers and catalog — no refunds, ledger or pricing.',
  Finance: 'Refunds, payments, ledger adjustments and pricing.',
  Support: 'Reads orders — cannot refund, adjust ledger or change pricing.',
  Viewer: 'Read-only everywhere.',
}

const JOB_LABEL: Record<string, string> = {
  'order.dispatch': 'Order dispatch',
  'attempt.response': 'Supplier response',
  'attempt.poll': 'Status poll (async result)',
  'payment.settle': 'Payment settle',
  'webhook.deliver': 'Webhook delivery',
  'verification.supplier_reply': 'Verification reply',
  'supplier.probe': 'Supplier probe',
  'order.expire_payment': 'Payment expiry',
}

export default function DemoPage() {
  const demo = useDemoState()
  const state = demo.data
  const { hash } = useLocation()

  const loaded = !!state
  useEffect(() => {
    if (!hash || !loaded) return
    const el = document.getElementById(hash.slice(1))
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }, [hash, loaded])

  return (
    <div className="relative rounded-2xl border-2 border-dashed border-warning/60 bg-hatch p-3 sm:p-5">
      <div className="space-y-5">
        <DemoHeader state={state} />

        {demo.isError && !state ? (
          <Card>
            <EmptyState icon={<TriangleAlert />} title="Demo controls unavailable" description="The simulation API did not answer." action={<Button size="sm" variant="secondary" onClick={() => demo.refetch()}>Try again</Button>} />
          </Card>
        ) : !state ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Card key={i} className="space-y-3 p-5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-20 w-full" />
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
              <ActAsCard state={state} />
              <LiveCard state={state} />
            </div>
            <BehaviourSimulator state={state} />
            <SupplierStateCard state={state} />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <PaymentsCard state={state} />
              <VerificationCard state={state} />
              <TrafficCard state={state} />
              <LicenseCard state={state} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <FastForwardCard />
              <SessionsCard state={state} />
            </div>
            <ScenariosCard state={state} />
            <ImeisCard state={state} />
            <ResetCard state={state} />
          </>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
function DemoHeader({ state }: { state?: DemoState }) {
  return (
    <div className="rounded-xl border border-warning/50 bg-surface p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-warning/15 text-warning">
            <FlaskConical className="size-5" />
          </span>
          <div>
            <p className="font-mono text-[11.5px] font-semibold tracking-[0.14em] text-warning uppercase">Demo only — not part of the product</p>
            <h1 className="mt-0.5 font-display text-[24px] leading-tight font-semibold tracking-[-0.02em]">Demo / simulation control center</h1>
            <p className="mt-1 max-w-3xl text-[13px] text-fg-2">
              Controls the simulated world around this installation: supplier behaviour, payment outcomes, traffic, sessions and the job clock. A real installation has none of this — suppliers, gateways and customers are real there.
            </p>
          </div>
        </div>
        {state && (
          <div className="flex shrink-0 flex-col items-start gap-1 text-[12px] text-fg-3 sm:items-end">
            <span>Seeded {dateTime(state.seededAt)}</span>
            <span className="flex items-center gap-1.5">
              <Dot tone="accent" pulse /> {num(state.jobs.pending)} jobs pending
            </span>
          </div>
        )}
      </div>
      <nav className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-3 text-[12px]">
        {[
          ['#live', 'Live activity'],
          ['#suppliers', 'Supplier simulator'],
          ['#scenarios', 'Scenarios A–L'],
          ['#imeis', 'Demo IMEIs'],
          ['#reset', 'Reset'],
        ].map(([href, label]) => (
          <a key={href} href={href} className="rounded-md border border-line bg-surface-2 px-2.5 py-1 text-fg-2 hover:border-line-strong hover:text-fg">
            {label}
          </a>
        ))}
      </nav>
    </div>
  )
}

function ActAsCard({ state }: { state: DemoState }) {
  const me = useMe()
  const actAs = useInstMutation((userId: string) => demoService.actAs(userId), { success: (s) => `Acting as ${s.users.find((u) => u.id === s.sessions.adminUserId)?.name}` })
  return (
    <Card>
      <CardHeader icon={<UserCog />} title="Act as role" description="Switches the operator session. Permissions change across the whole console and are enforced by the server (403 permission_denied)." />
      <ul className="space-y-1 px-3 pb-3">
        {state.users.map((u) => {
          const active = state.sessions.adminUserId === u.id
          return (
            <li key={u.id}>
              <button
                type="button"
                disabled={actAs.isPending}
                onClick={() => !active && actAs.mutate(u.id)}
                className={cn('flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors', active ? 'bg-accent/[0.08] ring-1 ring-accent/35' : 'hover:bg-surface-2')}
              >
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-fg">
                    {u.name} <span className="font-normal text-fg-3">· {u.role}</span>
                  </span>
                  <span className="block truncate text-[11.5px] text-fg-3">{ROLE_NOTE[u.role] ?? ''}</span>
                </span>
                {active && <Badge tone="accent">acting</Badge>}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="border-t border-line px-5 py-3 text-[12px] text-fg-3">
        Now: <span className="font-medium text-fg-2">{me.data ? `${me.data.name} (${me.data.role})` : '…'}</span> · {me.data?.permissions.length ?? 0} permissions. Try Support, then open an order — the refund button is disabled and the API refuses it.
      </p>
    </Card>
  )
}

function LiveCard({ state }: { state: DemoState }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const next = state.jobs.next
  const inSec = next ? Math.round((next.dueAt - now) / 1000) : null
  return (
    <Card id="live" className="scroll-mt-20">
      <CardHeader icon={<Activity />} title="Live activity" description="The PostgreSQL job queue of this installation (simulated scheduler). Refreshes every 4 s." actions={<Badge tone="accent" dot pulse>live</Badge>} />
      <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
        <div className="rounded-xl border border-line p-4">
          <div className="mono-label">Jobs pending</div>
          <div className="mt-2 font-display text-[34px] leading-none font-semibold tabular">{num(state.jobs.pending)}</div>
          <p className="mt-2 text-[12px] text-fg-3">Dispatches, supplier responses, async polls, webhook retries.</p>
        </div>
        <div className="rounded-xl border border-line p-4">
          <div className="mono-label">Next job</div>
          {next ? (
            <>
              <p className="mt-2 font-mono text-[14px] text-fg">{next.kind}</p>
              <p className="text-[12px] text-fg-3">{JOB_LABEL[next.kind] ?? 'Background job'}</p>
              <p className="mt-2 font-mono text-[12.5px] text-accent-ink tabular">{inSec != null && inSec > 0 ? `due in ${inSec >= 3600 ? `${Math.floor(inSec / 3600)}h ${Math.floor((inSec % 3600) / 60)}m` : inSec >= 60 ? `${Math.floor(inSec / 60)}m ${inSec % 60}s` : `${inSec}s`}` : 'due now'}</p>
            </>
          ) : (
            <p className="mt-2 text-[13px] text-fg-3">Queue empty.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button size="sm" variant="secondary" to="/admin/orders?status=open" trailing={<ArrowUpRight />}>
            Open orders
          </Button>
          <Button size="sm" variant="secondary" to="/admin/orders?status=needs_review" trailing={<ArrowUpRight />}>
            Needs Review
          </Button>
          <Button size="sm" variant="secondary" to="/admin/system/health" trailing={<ArrowUpRight />}>
            Job queue by kind
          </Button>
        </div>
      </div>
    </Card>
  )
}

function SmallCard({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col">
      <CardHeader icon={icon} title={title} description={description} />
      <div className="mt-auto px-5 pb-5">{children}</div>
    </Card>
  )
}

function PaymentsCard({ state }: { state: DemoState }) {
  const m = useInstMutation((o: 'auto' | 'succeed' | 'fail' | 'pending') => demoService.paymentOutcome(o), { success: (_, o) => `Next payment: ${o}` })
  return (
    <SmallCard icon={<CreditCard />} title="Next payment" description="Outcome of the next storefront / portal payment at the simulated gateway.">
      <Segmented
        value={state.nextPayment as 'auto' | 'succeed' | 'fail' | 'pending'}
        onChange={(v) => m.mutate(v)}
        items={[
          { value: 'auto', label: 'Auto' },
          { value: 'succeed', label: 'Succeed' },
          { value: 'fail', label: 'Fail' },
          { value: 'pending', label: 'Pending' },
        ]}
      />
    </SmallCard>
  )
}

function VerificationCard({ state }: { state: DemoState }) {
  const m = useInstMutation((faulty: boolean) => demoService.verificationOutcome(faulty), { success: (_, f) => `Next supplier verification reply: ${f ? 'result was faulty' : 'result was valid'}` })
  return (
    <SmallCard icon={<FileSearch />} title="Verification reply" description="What the supplier answers to the next verification request (“code does not work”).">
      <Segmented
        value={state.verificationFaulty ? 'faulty' : 'valid'}
        onChange={(v) => m.mutate(v === 'faulty')}
        items={[
          { value: 'faulty', label: 'Faulty → refund' },
          { value: 'valid', label: 'Valid → reject' },
        ]}
      />
    </SmallCard>
  )
}

function TrafficCard({ state }: { state: DemoState }) {
  const m = useInstMutation((v: { enabled?: boolean; perMinute?: number }) => demoService.traffic(v), { success: 'Traffic generator updated' })
  return (
    <SmallCard icon={<Gauge />} title="Traffic generator" description="Background orders from demo accounts across channels, so the cockpit stays alive.">
      <div className="flex items-center justify-between gap-3">
        <Switch checked={state.traffic.enabled} onChange={(enabled) => m.mutate({ enabled })} label="Traffic generator" />
        <Select inputSize="sm" value={String(state.traffic.perMinute)} disabled={!state.traffic.enabled} onChange={(e) => m.mutate({ perMinute: Number(e.target.value) })} options={[1, 2, 4, 6, 10].map((n) => ({ value: String(n), label: `${n} / min` }))} className="w-[110px]" />
      </div>
    </SmallCard>
  )
}

function LicenseCard({ state }: { state: DemoState }) {
  const m = useInstMutation((s: 'active' | 'updates_expired') => demoService.license(s), { success: (_, s) => (s === 'active' ? 'License: updates included' : 'License: update entitlement expired — operations continue') })
  const value = state.licenseStatus === 'updates_expired' ? 'updates_expired' : 'active'
  return (
    <SmallCard icon={<BadgeCheck />} title="License state" description="Show that an expired update entitlement never stops operations — only new releases.">
      <Segmented
        value={value}
        onChange={(v) => m.mutate(v)}
        items={[
          { value: 'active', label: 'Active' },
          { value: 'updates_expired', label: 'Updates expired' },
        ]}
      />
      <div className="mt-2 flex gap-3 text-[12px]">
        <Link to="/admin/system/license" className="text-accent-ink hover:underline">
          License
        </Link>
        <Link to="/admin/system/updates" className="text-accent-ink hover:underline">
          Updates
        </Link>
      </div>
    </SmallCard>
  )
}

function FastForwardCard() {
  const [last, setLast] = useState<{ ran: number; minutes: number } | null>(null)
  const m = useInstMutation((minutes: number) => demoService.fastForward(minutes), {
    onSuccess: (r) => {
      setLast({ ran: r.ran, minutes: r.minutes })
      toast.success(`Ran ${r.ran} job${r.ran === 1 ? '' : 's'}`, `Jobs due in the next ${label(r.minutes)} were executed now.`)
    },
  })
  const label = (min: number) => (min >= 60 ? `${min / 60} h` : `${min} min`)
  return (
    <Card>
      <CardHeader icon={<FastForward />} title="Fast-forward the job queue" description="Runs every job due within the window right now — e.g. async unlock codes arrive, polls complete, webhook retries fire." />
      <div className="px-5 pb-5">
        <div className="flex flex-wrap gap-2">
          {[15, 60, 360, 1440].map((min) => (
            <Button key={min} size="sm" variant="secondary" leading={<FastForward />} loading={m.isPending && m.variables === min} disabled={m.isPending} onClick={() => m.mutate(min)}>
              {label(min)}
            </Button>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-fg-3">
          Honest note: the clock is not changed. Jobs simply run early, so timestamps stay truthful (an unlock that would arrive in 3 h is recorded as arriving now). Orders whose outcome is UNKNOWN still wait for a human in Needs Review.
        </p>
        {last && (
          <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 font-mono text-[12px] text-fg-2">
            last run: +{label(last.minutes)} → {last.ran} job{last.ran === 1 ? '' : 's'} executed
          </p>
        )}
      </div>
    </Card>
  )
}

function SessionsCard({ state }: { state: DemoState }) {
  const customer = useInstMutation((id: string | null) => demoService.storefrontCustomer(id), { success: (_, id) => (id ? 'Storefront: signed in as demo customer' : 'Storefront: guest') })
  const member = useInstMutation((id: string) => demoService.portalMember(id), { success: 'Portal member switched' })
  return (
    <Card>
      <CardHeader icon={<ShieldCheck />} title="Sessions" description="Who the storefront and the reseller portal think is signed in." />
      <div className="space-y-4 px-5 pb-5">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="mono-label flex items-center gap-1.5">
              <Globe className="size-3" /> Storefront customer
            </span>
            <Link to="/site" className="inline-flex items-center gap-1 text-[12px] text-accent-ink hover:underline">
              Open storefront <ArrowUpRight className="size-3" />
            </Link>
          </div>
          <Select value={state.sessions.storefrontAccountId ?? ''} onChange={(e) => customer.mutate(e.target.value || null)} options={[{ value: '', label: 'Guest (not signed in)' }, ...state.customers.map((c) => ({ value: c.id, label: `${c.name} · ${c.email}` }))]} />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="mono-label flex items-center gap-1.5">
              <LayoutDashboard className="size-3" /> Portal member
            </span>
            <Link to="/portal" className="inline-flex items-center gap-1 text-[12px] text-accent-ink hover:underline">
              Open portal <ArrowUpRight className="size-3" />
            </Link>
          </div>
          <Select value={state.sessions.portalMemberId} onChange={(e) => member.mutate(e.target.value)} options={state.members.map((m) => ({ value: m.id, label: `${m.name} · ${m.role} · ${m.accountName}` }))} />
          <p className="mt-1.5 text-[11.5px] text-fg-3">Member roles limit what the portal allows (e.g. an orderer cannot manage API keys).</p>
        </div>
      </div>
    </Card>
  )
}

function ScenariosCard({ state }: { state: DemoState }) {
  return (
    <Card id="scenarios" className="scroll-mt-20">
      <CardHeader icon={<ListChecks />} title="Scenarios A–L" description="Scripted stories generated through the real commands during seeding. Each has orders, ledger entries, notifications and audit events you can open." />
      <div className="grid gap-3 px-5 pb-5 md:grid-cols-2 xl:grid-cols-3">
        {state.scenarios.map((s) => (
          <div key={s.id} className="flex flex-col rounded-xl border border-line bg-surface p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent/10 font-display text-[15px] font-semibold text-accent-ink">{s.id}</span>
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-fg">{s.title}</p>
                <p className="mt-0.5 text-[12.5px] text-fg-3">{s.description}</p>
              </div>
            </div>
            <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
              {s.links.map((l) => (
                <Link key={l.href + l.label} to={l.href} className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 px-2 py-1 text-[12px] text-fg-2 hover:border-line-strong hover:text-fg">
                  {l.label} <ArrowUpRight className="size-3" />
                </Link>
              ))}
            </div>
          </div>
        ))}
        {state.scenarios.length === 0 && <p className="text-[12.5px] text-fg-3">No scenarios seeded.</p>}
      </div>
    </Card>
  )
}

function ImeisCard({ state }: { state: DemoState }) {
  return (
    <Card id="imeis" className="scroll-mt-20">
      <CardHeader icon={<Smartphone />} title="Demo IMEIs" description="Fixed answers from the simulated suppliers — use them on the storefront, portal or API. All pass the 15-digit + Luhn check." />
      <ul className="grid gap-2 px-5 pb-5 md:grid-cols-3">
        {state.demoImeis.map((d) => (
          <li key={d.imei} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-3">
            <div className="min-w-0">
              <p className="font-mono text-[13.5px] tracking-wide text-fg">{d.imei}</p>
              <p className="truncate text-[12px] text-fg-3">{d.story}</p>
            </div>
            <CopyButton value={d.imei} label="Copy IMEI" />
          </li>
        ))}
      </ul>
    </Card>
  )
}

function ResetCard({ state }: { state: DemoState }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const reset = useInstMutation(() => demoService.reset(), {
    success: 'Demo reset — fresh seed replayed',
    onSuccess: () => {
      setOpen(false)
      qc.invalidateQueries()
    },
  })
  return (
    <Card id="reset" className="scroll-mt-20 border-danger/30">
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[14px] font-semibold text-fg">
            <RotateCcw className="size-4 text-danger" /> Reset demo
          </p>
          <p className="mt-0.5 text-[12.5px] text-fg-3">Discards every change and replays the 30-day seed (scenarios A–L) through the real commands. Takes a few seconds.</p>
          <p className="mt-0.5 font-mono text-[11.5px] text-fg-3">current seed: {dateTime(state.seededAt)}</p>
        </div>
        <Button variant="danger" size="sm" leading={<RotateCcw />} onClick={() => setOpen(true)}>
          Reset demo
        </Button>
      </div>
      <ConfirmDialog open={open} onClose={() => setOpen(false)} onConfirm={() => reset.mutate()} loading={reset.isPending} tone="danger" title="Reset the demo installation?" confirmLabel="Reset" description="All orders, payments, settings and simulation rules created during this session are discarded and the original seed is rebuilt." />
    </Card>
  )
}
