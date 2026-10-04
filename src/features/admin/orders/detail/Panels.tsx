import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowDown, Bell, Check, ChevronRight, CircleX, CreditCard, FileSearch, Landmark, Mail, MessageCircle, Network, Route, Send, ShieldCheck, Terminal, Undo2, Webhook } from 'lucide-react'
import { Badge, Card, CardHeader, CodeBlock, CopyButton, StatusBadge, Tooltip } from '@/components/ui'
import { FieldChecks, LedgerEntries, Money, PriceSteps, ResultView } from '@/components/domain'
import { validateField } from '@/core/fields'
import type { Attempt, AttemptClass, DriverCall, OrderDetail } from '@/types/installation'
import { cn } from '@/lib/cn'
import { dateTime, ms, time } from '@/lib/format'
import { isDeviceField, useFlash } from '../helpers'

/* ------------------------------------------------------------------------- */
/*  Section shell                                                            */
/* ------------------------------------------------------------------------- */
export function Section({ id, title, description, icon, actions, children, className, bodyClassName }: { id: string; title: ReactNode; description?: ReactNode; icon?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <Card id={id} className={cn('scroll-mt-24', className)}>
      <CardHeader title={title} description={description} icon={icon} actions={actions} />
      <div className={cn('px-5 pb-5', bodyClassName)}>{children}</div>
    </Card>
  )
}

const Empty = ({ children }: { children: ReactNode }) => <div className="rounded-lg border border-dashed border-line px-4 py-5 text-center text-[12.5px] text-fg-3">{children}</div>

/* ------------------------------------------------------------------------- */
/*  Routing & attempts                                                       */
/* ------------------------------------------------------------------------- */
const CLASS_LABEL: Record<AttemptClass, { label: string; tone: 'success' | 'danger' | 'warning' | 'neutral' }> = {
  success: { label: 'Success', tone: 'success' },
  rejected_terminal: { label: 'Rejected · terminal', tone: 'danger' },
  rejected_failover_safe: { label: 'Rejected · failover-safe', tone: 'warning' },
  not_accepted: { label: 'Not accepted', tone: 'warning' },
  unknown: { label: 'Unknown outcome', tone: 'danger' },
}

export function RoutingSection({ d }: { d: OrderDetail }) {
  const o = d.order
  const chain = d.candidates.slice().sort((a, b) => a.priority - b.priority)
  return (
    <Section id="sec-routing" icon={<Route />} title="Routing & supplier attempts" description="Priority routing with guarded failover — the chain is evaluated top-down for this order">
      <div className="mb-4 grid gap-2 rounded-lg border border-line bg-surface-2/40 px-3.5 py-2.5 text-[12px] text-fg-2 sm:grid-cols-3">
        <Rule icon={<Check />} text="Failover only after a definitive, failover-safe rejection (or a provable not-accepted)." />
        <Rule icon={<CircleX />} text="An UNKNOWN outcome (timeout / bad response after send) never fails over → needs review." />
        <Rule icon={<ShieldCheck />} text="Margin guard skips offers costing more than the snapshotted price." />
      </div>

      <div className="mono-label mb-2">Priority chain · {chain.length} offer{chain.length === 1 ? '' : 's'}</div>
      {chain.length === 0 ? (
        <Empty>No offers are mapped to this service.</Empty>
      ) : (
        <ol className="overflow-hidden rounded-lg border border-line">
          {chain.map((c) => {
            const attempt = o.attempts.find((a) => a.offerId === c.offerId)
            return (
              <li key={c.offerId} className={cn('grid grid-cols-[34px_minmax(0,1fr)_auto] items-start gap-3 border-b border-line/70 px-3.5 py-2.5 last:border-0', c.attempted && 'bg-accent/[0.03]')}>
                <span className={cn('mt-0.5 grid size-6 place-items-center rounded-md font-mono text-[11px] font-semibold', c.attempted ? 'bg-accent/12 text-accent-ink' : 'bg-surface-2 text-fg-3')}>P{c.priority}</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link to={`/admin/suppliers/${c.supplierId}`} className="text-[13px] font-medium hover:underline">
                      {c.supplierName}
                    </Link>
                    <span className="truncate text-[12px] text-fg-3">{c.productName}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {c.attempted && (
                      <Badge tone="accent" dot>
                        Attempted{attempt ? ` · #${attempt.n}` : ''}
                      </Badge>
                    )}
                    {!c.routable && <Badge tone="neutral">Not routable</Badge>}
                    {c.marginBlocked && <Badge tone="danger">Margin guard</Badge>}
                    {c.eligible && !c.attempted && <Badge tone="success">Eligible next</Badge>}
                    {!c.eligible && c.routable && !c.attempted && !c.marginBlocked && <Badge tone="neutral" variant="outline">Not used</Badge>}
                  </div>
                  {c.reasons.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 text-[11.5px] text-fg-3">
                      {c.reasons.map((r, i) => (
                        <li key={i}>· {r}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="text-right">
                  <Money value={c.cost} className={cn('font-mono text-[12.5px]', c.cost > o.price.amount ? 'text-danger' : 'text-fg')} />
                  <div className="text-[10.5px] text-fg-3">cost</div>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      <div className="mono-label mt-5 mb-2">Attempts · {o.attempts.length}</div>
      {o.attempts.length === 0 ? (
        <Empty>{o.status === 'awaiting_payment' ? 'Routing starts after payment succeeds.' : o.status === 'cancelled' ? 'Cancelled before reaching a supplier.' : 'No supplier attempt yet.'}</Empty>
      ) : (
        <div className="grid gap-0">
          {o.attempts.map((a, i) => (
            <div key={a.id}>
              {i > 0 && (
                <div className="flex items-center gap-2 py-1.5 pl-5 text-[11.5px] text-fg-3">
                  <ArrowDown className="size-3.5" />
                  {o.attempts[i - 1]!.classification?.failoverSafe ? 'failover — previous outcome was failover-safe' : 'retry after operator confirmation'}
                </div>
              )}
              <AttemptCard a={a} d={d} />
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

function Rule({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex gap-2">
      <span className="mt-0.5 shrink-0 text-fg-3 [&_svg]:size-3.5">{icon}</span>
      <span>{text}</span>
    </div>
  )
}

function AttemptCard({ a, d }: { a: Attempt; d: OrderDetail }) {
  const flash = useFlash(`attempt-${a.id}`)
  const cls = a.classification
  const k = cls ? CLASS_LABEL[cls.kind] : null
  return (
    <div id={`attempt-${a.id}`} className={cn('rounded-lg border border-line', a.state === 'unknown' && 'border-danger/40', flash)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 px-3.5 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] font-semibold text-fg-3">#{a.n}</span>
          <Link to={`/admin/suppliers/${a.supplierId}`} className="truncate text-[13px] font-medium hover:underline">
            {d.supplierNames[a.supplierId] ?? a.supplierId}
          </Link>
          <StatusBadge status={a.state} />
        </div>
        <div className="flex items-center gap-3 text-[11.5px] text-fg-3">
          <span>
            cost <Money value={a.cost} className="font-mono text-fg-2" />
          </span>
          <span className="font-mono">{a.latencyMs != null ? ms(a.latencyMs) : '—'}</span>
          <span className="font-mono" title={dateTime(a.sentAt)}>
            {time(a.sentAt, true)}
          </span>
        </div>
      </div>
      <div className="grid gap-x-6 gap-y-1.5 px-3.5 py-2.5 text-[12.5px] sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          {cls ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {k && <Badge tone={k.tone}>{k.label}</Badge>}
                <span className="font-mono text-[12px] text-fg-2">{cls.code}</span>
              </div>
              <div className="mt-1 text-fg-2">{cls.message}</div>
              {cls.mappingId && <div className="mt-0.5 text-[11px] text-fg-3">via error mapping {cls.mappingId}</div>}
            </>
          ) : (
            <span className="text-fg-3">{a.state === 'sending' || a.state === 'accepted' ? 'Waiting for the supplier…' : 'No classification'}</span>
          )}
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-x-5 gap-y-1 text-[11.5px] sm:text-right">
          <span className="text-fg-3">Failover-safe</span>
          <span className={cn('font-medium', cls?.failoverSafe ? 'text-success' : 'text-danger')}>{cls ? (cls.failoverSafe ? 'Yes' : 'No') : '—'}</span>
          <span className="text-fg-3">Supplier ref</span>
          <span className="font-mono text-fg-2">{a.externalRef ?? '—'}</span>
          <span className="text-fg-3">Simulator</span>
          <span className="font-mono text-fg-3">{a.simulated}</span>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/*  Input / price / result                                                   */
/* ------------------------------------------------------------------------- */
export function InputSection({ d }: { d: OrderDetail }) {
  const o = d.order
  const fields = d.revision.fields
  const known = new Set(fields.map((f) => f.key))
  const extra = Object.keys(o.input).filter((k) => !known.has(k))
  return (
    <Section id="sec-input" icon={<FileSearch />} title="Input snapshot" description={`Validated against service revision ${o.serviceRevision} before routing`}>
      <dl className="divide-y divide-line/70 rounded-lg border border-line">
        {fields.map((f) => {
          const v = o.input[f.key]
          const checks = v ? validateField(f, v).checks : []
          return (
            <div key={f.key} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-3.5 py-2.5">
              <dt className="text-[12.5px] text-fg-3">
                {f.label}
                <span className="ml-1.5 font-mono text-[10.5px] text-fg-3/70">{f.key}</span>
              </dt>
              <dd className="min-w-0 text-right">
                {v ? (
                  <span className={cn('inline-flex items-center gap-1 text-[13px] text-fg', isDeviceField(f.type) && 'font-mono text-[12.5px] tracking-wide')}>
                    {f.sensitive ? '••••••' : v}
                    {isDeviceField(f.type) && <CopyButton value={v} />}
                  </span>
                ) : (
                  <span className="text-[12.5px] text-fg-3">—</span>
                )}
                {isDeviceField(f.type) && checks.length > 0 && <FieldChecks checks={checks} className="mt-0.5 justify-end" />}
              </dd>
            </div>
          )
        })}
        {extra.map((k) => (
          <div key={k} className="flex items-baseline justify-between gap-4 px-3.5 py-2.5">
            <dt className="font-mono text-[12px] text-fg-3">{k}</dt>
            <dd className="font-mono text-[12.5px]">{o.input[k]}</dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}

export function PriceSection({ d }: { d: OrderDetail }) {
  return (
    <Section id="sec-price" icon={<Landmark />} title="Price snapshot" description="Calculated when the order was placed and frozen on the order — later price, rule or supplier-cost changes never alter it">
      <PriceSteps quote={d.order.price} />
    </Section>
  )
}

export function ResultSection({ d }: { d: OrderDetail }) {
  const o = d.order
  return (
    <Section id="sec-result" icon={<Check />} title="Result" description={o.result ? o.result.summary : o.rejection ? 'The order was rejected' : 'Shown here when the supplier answers'}>
      {o.result ? (
        <ResultView result={o.result} schema={d.revision.resultSchema} />
      ) : o.rejection ? (
        <div className="rounded-lg border border-danger/30 bg-danger/[0.05] px-4 py-3">
          <div className="font-mono text-[12px] text-danger">{o.rejection.code}</div>
          <div className="mt-1 text-[13px] text-fg">{o.rejection.message}</div>
          <div className="mt-1 text-[11.5px] text-fg-3">The hold was released to the customer’s wallet — a rejected order never captures money.</div>
        </div>
      ) : (
        <Empty>{o.status === 'cancelled' ? 'Cancelled — no result.' : o.status === 'needs_review' ? 'Outcome unknown — resolve the review to record a result.' : 'Waiting for the supplier…'}</Empty>
      )}
    </Section>
  )
}

/* ------------------------------------------------------------------------- */
/*  Ledger                                                                   */
/* ------------------------------------------------------------------------- */
export function LedgerSection({ d }: { d: OrderDetail }) {
  const names = { ...d.supplierNames, [d.account.id]: d.account.name }
  return (
    <Section
      id="sec-ledger"
      icon={<Landmark />}
      title="Ledger postings"
      description="Double-entry: hold → capture (settlement) or release; every transaction balances"
      actions={
        <Link to={`/admin/finance/ledger?orderId=${d.order.id}`} className="text-[12px] font-medium text-accent-ink hover:underline">
          Ledger
        </Link>
      }
    >
      {d.ledger.length === 0 ? (
        <Empty>No postings yet — nothing is held until payment succeeds.</Empty>
      ) : (
        <div className="grid gap-3">
          {d.ledger.map((tx) => (
            <LedgerTx key={tx.id} tx={tx} names={names} />
          ))}
        </div>
      )}
    </Section>
  )
}

function LedgerTx({ tx, names }: { tx: OrderDetail['ledger'][number]; names: Record<string, string> }) {
  const flash = useFlash(`ledger-${tx.id}`)
  return (
    <div id={`ledger-${tx.id}`} className={cn('rounded-lg', flash)}>
      <LedgerEntries tx={tx} names={names} />
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/*  Payment, refunds, verifications                                          */
/* ------------------------------------------------------------------------- */
export function MoneyFlowSection({ d }: { d: OrderDetail }) {
  const p = d.payment
  const payFlash = useFlash(p ? `payment-${p.id}` : '_')
  return (
    <Section id="sec-payment" icon={<CreditCard />} title="Payment & refunds" description={p ? 'Storefront checkout: payment funds the wallet, then the order holds from it' : 'Paid from the account wallet (hold → capture)'}>
      {p ? (
        <div id={`payment-${p.id}`} className={cn('rounded-lg border border-line', payFlash)}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 px-3.5 py-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[12.5px] font-medium">{p.ref}</span>
              <StatusBadge status={p.status} />
              <Badge tone="neutral" variant="outline">
                {p.method.replace('_', ' ')}
              </Badge>
            </div>
            <Money value={p.amount} className="font-mono text-[13px] font-medium" />
          </div>
          <ol className="px-3.5 py-2">
            {p.events.map((e, i) => (
              <li key={i} className="flex gap-3 py-1 text-[12px]">
                <span className="w-[62px] shrink-0 font-mono text-[11px] text-fg-3">{time(e.at, true)}</span>
                <span className="w-[120px] shrink-0 font-mono text-[11.5px] text-fg-2">{e.type}</span>
                <span className="min-w-0 text-fg-3">{e.detail}</span>
              </li>
            ))}
          </ol>
          <div className="border-t border-line/70 px-3.5 py-1.5 text-[11px] text-fg-3">
            Gateway ref <span className="font-mono">{p.gatewayRef}</span> · simulated gateway — no real processor
            {p.failureReason && <span className="text-danger"> · {p.failureReason}</span>}
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-surface-2/50 px-3.5 py-2.5 text-[12.5px] text-fg-2">No payment intent — funds were held directly from the {d.account.name} wallet.</div>
      )}

      <div className="mono-label mt-4 mb-2">Refunds · {d.refunds.length}</div>
      {d.refunds.length === 0 ? (
        <Empty>No refunds.</Empty>
      ) : (
        <div className="grid gap-2">
          {d.refunds.map((r) => (
            <RefundRow key={r.id} r={r} />
          ))}
        </div>
      )}
    </Section>
  )
}

function RefundRow({ r }: { r: OrderDetail['refunds'][number] }) {
  const flash = useFlash(`refund-${r.id}`)
  return (
    <div id={`refund-${r.id}`} className={cn('flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-3.5 py-2.5', flash)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Undo2 className="size-3.5 text-fg-3" />
          <span className="font-mono text-[12.5px] font-medium">{r.ref}</span>
          <StatusBadge status={r.status} />
          <span className="text-[12px] text-fg-3">→ {r.destination === 'wallet' ? 'wallet' : 'original method'}</span>
        </div>
        <div className="mt-0.5 truncate text-[12px] text-fg-2">{r.reason}</div>
        <div className="mt-0.5 text-[11px] text-fg-3">
          {r.actor.name} · {dateTime(r.createdAt)} · key <span className="font-mono">{r.idempotencyKey}</span>
        </div>
      </div>
      <Money value={r.amount} className="font-mono text-[13px] font-medium" />
    </div>
  )
}

export function VerificationsSection({ d }: { d: OrderDetail }) {
  if (d.verifications.length === 0) return null
  return (
    <Section
      id="sec-verification"
      icon={<FileSearch />}
      title="Verification requests"
      description="After-care is part of the order lifecycle"
      actions={
        <Link to="/admin/verifications?status=all" className="text-[12px] font-medium text-accent-ink hover:underline">
          Verifications
        </Link>
      }
    >
      <div className="grid gap-2">
        {d.verifications.map((v) => (
          <VerificationRow key={v.id} v={v} />
        ))}
      </div>
    </Section>
  )
}

function VerificationRow({ v }: { v: OrderDetail['verifications'][number] }) {
  const flash = useFlash(`verification-${v.id}`)
  return (
    <Link id={`verification-${v.id}`} to={`/admin/verifications?status=all&v=${v.id}`} className={cn('group flex items-center justify-between gap-3 rounded-lg border border-line px-3.5 py-2.5 hover:bg-surface-2/60', flash)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12.5px] font-medium">{v.ref}</span>
          <StatusBadge status={v.status} />
          <span className="text-[12px] text-fg-3">{v.reason.replace(/_/g, ' ')}</span>
        </div>
        <div className="mt-0.5 truncate text-[12px] text-fg-2">“{v.message}”</div>
      </div>
      <ChevronRight className="size-4 text-fg-3" />
    </Link>
  )
}

/* ------------------------------------------------------------------------- */
/*  Webhooks + notifications                                                 */
/* ------------------------------------------------------------------------- */
export function OutboundSection({ d }: { d: OrderDetail }) {
  return (
    <Section id="sec-outbound" icon={<Send />} title="Webhooks & notifications" description="Outbound messages caused by this order (all transports simulated)">
      <div className="mono-label mb-2">Webhook deliveries · {d.webhooks.length}</div>
      {d.webhooks.length === 0 ? (
        <Empty>No webhook endpoint subscribed to this order’s events.</Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line">
          {d.webhooks.map((w) => (
            <WebhookRow key={w.id} w={w} />
          ))}
        </div>
      )}
      <div className="mono-label mt-4 mb-2">Notifications · {d.notifications.length}</div>
      {d.notifications.length === 0 ? (
        <Empty>No notifications sent.</Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line">
          {d.notifications.map((n) => (
            <NotificationRow key={n.id} n={n} />
          ))}
        </div>
      )}
    </Section>
  )
}

function WebhookRow({ w }: { w: OrderDetail['webhooks'][number] }) {
  const flash = useFlash(`webhook-${w.id}`)
  const last = w.attempts.at(-1)
  return (
    <div id={`webhook-${w.id}`} className={cn('grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line/70 px-3.5 py-2 text-[12.5px] last:border-0', flash)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Webhook className="size-3.5 shrink-0 text-fg-3" />
          <span className="font-mono text-[12px] text-fg">{w.event}</span>
          <StatusBadge status={w.status} />
        </div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-fg-3">webhook-id {w.messageId}</div>
      </div>
      <div className="text-right text-[11.5px] text-fg-3">
        <div>
          {w.attempts.length} attempt{w.attempts.length === 1 ? '' : 's'}
          {last?.httpStatus != null && <span className={cn('ml-1.5 font-mono', last.httpStatus < 300 ? 'text-success' : 'text-danger')}>HTTP {last.httpStatus}</span>}
        </div>
        <div>{w.nextRetryAt ? `next retry ${time(w.nextRetryAt)}` : dateTime(w.createdAt)}</div>
      </div>
    </div>
  )
}

const CH_ICON = { email: Mail, telegram: Send, whatsapp: MessageCircle }

function NotificationRow({ n }: { n: OrderDetail['notifications'][number] }) {
  const flash = useFlash(`notification-${n.id}`)
  const Icon = CH_ICON[n.channel] ?? Bell
  return (
    <div id={`notification-${n.id}`} className={cn('grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line/70 px-3.5 py-2 text-[12.5px] last:border-0', flash)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Icon className="size-3.5 shrink-0 text-fg-3" />
          <span className="capitalize">{n.channel}</span>
          <span className="text-fg-3">→</span>
          <span className="truncate font-mono text-[11.5px] text-fg-2">{n.recipient}</span>
          <StatusBadge status={n.status} />
        </div>
        <div className="mt-0.5 truncate text-[11.5px] text-fg-3">
          <span className="font-mono">{n.template}</span> · {n.subject}
        </div>
      </div>
      <div className="text-right text-[11px] text-fg-3">
        <div>{n.audience}</div>
        <div>{time(n.at, true)}</div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/*  Supplier wire log                                                        */
/* ------------------------------------------------------------------------- */
export function WireLogSection({ d }: { d: OrderDetail }) {
  return (
    <Section id="sec-wire" icon={<Terminal />} title="Supplier wire log" description="Driver calls exactly as sent and received (simulated suppliers) — DHRU Fusion uses form-POST with JSON responses">
      {d.driverCalls.length === 0 ? (
        <Empty>No supplier calls yet.</Empty>
      ) : (
        <div className="grid gap-2">
          {d.driverCalls.map((c, i) => (
            <WireCall key={c.id} c={c} supplier={d.supplierNames[c.supplierId] ?? c.supplierId} defaultOpen={i === d.driverCalls.length - 1} />
          ))}
        </div>
      )}
    </Section>
  )
}

function asCode(s: string): { code: string; lang: 'json' | 'text'; label: string } {
  const t = s.trim()
  if (!t) return { code: '(empty)', lang: 'text', label: 'empty' }
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      return { code: JSON.stringify(JSON.parse(t), null, 2), lang: 'json', label: 'application/json' }
    } catch {
      return { code: t, lang: 'text', label: 'text' }
    }
  }
  if (/^[\w-]+=/.test(t)) return { code: t, lang: 'text', label: 'application/x-www-form-urlencoded' }
  return { code: t, lang: 'text', label: 'text' }
}

function WireCall({ c, supplier, defaultOpen }: { c: DriverCall; supplier: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen)
  const req = asCode(c.request)
  const res = c.response.trim() ? asCode(c.response) : { code: c.httpStatus == null ? '(no response — the request timed out after it was sent)' : '(empty body)', lang: 'text' as const, label: 'none' }
  const flash = useFlash(`call-${c.id}`)
  return (
    <div id={`call-${c.id}`} className={cn('overflow-hidden rounded-lg border border-line', !c.ok && 'border-danger/30', flash)}>
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full flex-wrap items-center justify-between gap-2 px-3.5 py-2 text-left hover:bg-surface-2/60">
        <span className="flex min-w-0 items-center gap-2">
          <ChevronRight className={cn('size-3.5 shrink-0 text-fg-3 transition-transform', open && 'rotate-90')} />
          <Network className="size-3.5 shrink-0 text-fg-3" />
          <span className="font-mono text-[12px] font-semibold">{c.operation}</span>
          <span className="font-mono text-[11.5px] text-fg-2">
            {c.method} {c.endpoint}
          </span>
        </span>
        <span className="flex items-center gap-2.5 text-[11.5px] text-fg-3">
          <span className="truncate">{supplier}</span>
          <Tooltip content={c.outcome}>
            <span className={cn('font-mono', c.httpStatus == null ? 'text-danger' : c.httpStatus < 300 ? 'text-success' : 'text-danger')}>{c.httpStatus == null ? 'no response' : `HTTP ${c.httpStatus}`}</span>
          </Tooltip>
          <span className="font-mono">{ms(c.latencyMs)}</span>
          <span className="font-mono">{time(c.at, true)}</span>
        </span>
      </button>
      {open && (
        <div className="grid gap-2 border-t border-line p-2.5 lg:grid-cols-2">
          <CodeBlock title={`Request · ${req.label}`} code={req.code} lang={req.lang} maxHeight={260} wrap />
          <CodeBlock title={`Response · ${res.label} · outcome ${c.outcome}`} code={res.code} lang={res.lang} maxHeight={260} wrap />
        </div>
      )}
    </div>
  )
}
