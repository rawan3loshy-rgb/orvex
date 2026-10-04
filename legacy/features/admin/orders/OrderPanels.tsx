import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowUpRight, BadgeCheck, CircleX, Hourglass, KeyRound, Lock, ScrollText, ShieldAlert, Smartphone, UserRound, Webhook } from 'lucide-react'
import { Badge, Button, Card, CardBody, CardHeader, CodeBlock, CopyButton, EmptyState, MonoValue, Segmented, StatusBadge, Tooltip } from '@/components/ui'
import { useWebhooks } from '@/hooks/installation'
import { cn } from '@/lib/cn'
import { date, duration, money, ms, relative, time, titleCase, truncateMiddle } from '@/lib/format'
import type { Tone } from '@/types/common'
import type { OrderDetail, Service, ServiceField } from '@/types/installation'
import { ResellerAvatar } from '../commerce/resellers/shared'
import { CHANNEL_LABEL, countryName, isImei, isInFlight, optionLabel, readResult, type ResultCode, type ResultVerdict } from './lib'
import { ImeiValue, KV } from './parts'

const fullTime = (iso: string | null) => (iso ? `${date(iso)} · ${time(iso, true)}` : '—')

/* ------------------------------------------------------------------ */
/*  Device & input                                                     */
/* ------------------------------------------------------------------ */
function InputValue({ field, k, v }: { field?: ServiceField; k: string; v: string }) {
  if (k === 'imei') return <ImeiValue value={v} />
  if (field && (field.type === 'enum' || field.type === 'country') && field.validation?.options?.includes(v)) {
    return (
      <span className="inline-flex items-baseline gap-2">
        <span className="font-sans text-[13px] text-fg">{field.type === 'country' ? countryName(v) : optionLabel(field, v)}</span>
        <span className="font-mono text-[11px] text-fg-3">{v}</span>
      </span>
    )
  }
  if (field?.type === 'country') return <span>{`${v} · ${countryName(v)}`}</span>
  return <span title={v}>{v}</span>
}

export function InputCard({ order, service }: { order: OrderDetail; service?: Service }) {
  const known = service?.fields ?? []
  const entries = Object.entries(order.input)
  const ordered = [...known.filter((f) => f.key in order.input).map((f) => [f.key, order.input[f.key]!] as const), ...entries.filter(([k]) => !known.some((f) => f.key === k))]
  const missing = known.filter((f) => !(f.key in order.input))
  const imei = order.input.imei
  const hero = imei && isImei(imei) ? imei : null
  return (
    <Card>
      <CardHeader icon={<Smartphone />} title="Device & input" description={`${entries.length} field${entries.length === 1 ? '' : 's'} · validated before routing · sensitive values masked`} />
      <CardBody>
        {hero && (
          <div className="mb-3 rounded-lg border border-line bg-surface-2/60 px-3.5 py-3">
            <div className="mono-label mb-1.5">IMEI</div>
            <ImeiValue value={hero} size="lg" />
            <p className="mt-1.5 font-mono text-[10.5px] text-fg-3">
              TAC {hero.slice(0, 8)} · serial {hero.slice(8, 14)} · check digit {hero.slice(14)}
            </p>
          </div>
        )}
        {ordered.length === 0 ? (
          <p className="text-[12.5px] text-fg-3">No input recorded.</p>
        ) : (
          <dl>
            {ordered
              .filter(([k]) => !(hero && k === 'imei'))
              .map(([k, v]) => {
                const f = known.find((x) => x.key === k)
                return (
                  <KV
                    key={k}
                    mono
                    label={
                      <span className="flex items-center gap-1.5">
                        {f?.label ?? titleCase(k)}
                        {f?.sensitive && (
                          <Tooltip content="Sensitive field — masked at rest">
                            <Lock className="size-3 text-fg-3" />
                          </Tooltip>
                        )}
                      </span>
                    }
                  >
                    <InputValue field={f} k={k} v={v} />
                  </KV>
                )
              })}
          </dl>
        )}
        {missing.length > 0 && <p className="mt-2 text-[11.5px] text-fg-3">Not provided: {missing.map((f) => f.label).join(', ')}</p>}
      </CardBody>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  Result                                                             */
/* ------------------------------------------------------------------ */
const BAND: Record<Tone, string> = {
  success: 'border-success/25 bg-success/[0.06]',
  danger: 'border-danger/25 bg-danger/[0.06]',
  warning: 'border-warning/30 bg-warning/[0.07]',
  neutral: 'border-line bg-surface-2/60',
  accent: 'border-accent/25 bg-accent/[0.05]',
  info: 'border-info/25 bg-info/[0.06]',
}
const STAMP: Record<Tone, string> = {
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
  neutral: 'text-fg-2',
  accent: 'text-accent-ink',
  info: 'text-info',
}

/** Unlock code in a code-style box — the deliverable of a Codes order. */
function CodeBox({ code }: { code: ResultCode }) {
  const grouped = code.value.length >= 8 ? code.value.replace(/(.{4})(?=.)/g, '$1 ') : code.value
  return (
    <div className="relative overflow-hidden rounded-lg border border-line bg-surface-2/70 shadow-[inset_2px_0_0_var(--accent)]">
      <div className="flex items-center justify-between gap-2 px-3.5 pt-2.5">
        <span className="font-mono text-[10.5px] tracking-[0.09em] text-fg-3 uppercase">
          <span className="font-semibold text-accent-ink">{code.label}</span> · {code.name}
        </span>
        <CopyButton value={code.value} label={`Copy ${code.label}`} />
      </div>
      <div className="px-3.5 pt-1 pb-3 font-mono text-[22px] leading-none font-medium tracking-[0.14em] text-fg tabular select-all">{grouped}</div>
    </div>
  )
}

function VerdictTile({ v }: { v: ResultVerdict }) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-surface px-3 py-2">
      <div className="truncate text-[11.5px] text-fg-3">{v.label}</div>
      <div className={cn('mt-0.5 truncate font-mono text-[12.5px] font-semibold tracking-[0.04em]', STAMP[v.tone])}>{v.value}</div>
    </div>
  )
}

export function ResultCard({ order, service }: { order: OrderDetail; service?: Service }) {
  const [view, setView] = useState<'result' | 'json'>('result')
  if (isInFlight(order.status) && !order.result) {
    const eta = service ? (service.turnaround.min === service.turnaround.max ? duration(service.turnaround.max) : `${duration(service.turnaround.min)}–${duration(service.turnaround.max)}`) : null
    const what = service?.category === 'Codes' ? 'unlock code' : service?.category === 'Unlocking' ? 'unlock confirmation' : service?.category === 'Server Services' ? 'server job result' : 'check result'
    return (
      <Card>
        <CardHeader icon={<Hourglass />} title="Result" description={`Waiting for the supplier’s ${what}${eta ? ` · usually ${eta}` : ''}`} />
        <CardBody>
          <div className="space-y-2.5 rounded-lg border border-dashed border-line-strong bg-hatch p-4">
            <div className="skeleton h-3 w-3/4" />
            <div className="skeleton h-3 w-1/2" />
            <div className="skeleton h-3 w-2/3" />
          </div>
        </CardBody>
      </Card>
    )
  }
  if (!order.result) return null
  const r = order.result
  const read = readResult(r)
  const json = JSON.stringify({ summary: r.summary, data: r.data }, null, 2)
  return (
    <Card>
      <CardHeader
        icon={<BadgeCheck />}
        title="Result"
        description={order.status === 'refunded' ? 'Delivered before the refund' : `Returned by ${order.providerName ?? 'the supplier'}`}
        actions={
          <Segmented
            size="xs"
            value={view}
            onChange={setView}
            items={[
              { value: 'result', label: 'Result' },
              { value: 'json', label: 'JSON' },
            ]}
          />
        }
      />
      <CardBody className="space-y-3">
        {view === 'result' ? (
          <>
            <div className={cn('rounded-lg border px-3.5 py-3', BAND[read.tone])}>
              <div className={cn('font-display text-[16px] leading-snug font-semibold tracking-[-0.01em]', read.tone === 'success' || read.tone === 'neutral' ? 'text-fg' : STAMP[read.tone])}>{read.headline}</div>
              {read.note && <p className="mt-0.5 text-[12.5px] text-fg-2">{read.note}</p>}
            </div>
            {read.codes.length > 0 && (
              <div className="space-y-2">
                {read.codes.map((c) => (
                  <CodeBox key={c.key} code={c} />
                ))}
                {read.attemptsRemaining != null && (
                  <p className={cn('flex items-center gap-1.5 text-[12px]', read.attemptsRemaining <= 3 ? 'text-warning' : 'text-fg-3')}>
                    <KeyRound className="size-3.5" />
                    {read.attemptsRemaining} code entry attempt{read.attemptsRemaining === 1 ? '' : 's'} left on the device — use MCK only if the NCK is rejected.
                  </p>
                )}
              </div>
            )}
            {read.verdicts.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {read.verdicts.map((v) => (
                  <VerdictTile key={v.key} v={v} />
                ))}
              </div>
            )}
            {read.facts.length > 0 && (
              <dl>
                {read.facts.map((f) => (
                  <KV key={f.key} label={f.label} mono={f.mono}>
                    {f.copy ? <MonoValue value={f.value} className="text-fg" /> : f.value}
                  </KV>
                ))}
              </dl>
            )}
          </>
        ) : (
          <CodeBlock code={json} lang="json" maxHeight={280} />
        )}
      </CardBody>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
const ERROR_HINT: Record<string, string> = {
  provider_rejected: 'Rejected by the supplier — no further fallbacks are tried for a definitive answer. Check the IMEI, model and selected network before re-ordering.',
  provider_timeout: 'Every supplier in the chain timed out. Retrying sends the same IMEI through routing again.',
  provider_error: 'Suppliers returned upstream errors. Usually transient — retry, or check supplier health.',
  no_route: 'No enabled, healthy supplier is mapped to this service. Add a mapping or re-enable a supplier.',
  held_for_review: 'The order will not reach a supplier until the rule releases it. Cancel it, or adjust the routing rule.',
}

export function ErrorCard({ order }: { order: OrderDetail }) {
  if (!order.error) return null
  const held = order.error.code === 'held_for_review'
  const hint = ERROR_HINT[order.error.code]
  return (
    <Card className={cn(held ? 'border-warning/30' : 'border-danger/30')}>
      <div className={cn('absolute inset-x-0 top-0 h-px', held ? 'bg-warning/60' : 'bg-danger/60')} />
      <CardHeader icon={held ? <ShieldAlert /> : <CircleX />} title={held ? 'Held for review' : 'Order failed'} description={held ? 'A routing rule paused this order' : 'Reported by the order engine'} />
      <CardBody className="space-y-3">
        <Badge tone={held ? 'warning' : 'danger'} variant="soft" className="font-mono">
          {order.error.code}
        </Badge>
        <p className="text-[13px] leading-relaxed text-fg">{order.error.message}</p>
        {hint && <p className="text-[12.5px] leading-relaxed text-fg-3">{hint}</p>}
        {order.status === 'failed' && order.resellerId && (
          <p className="rounded-lg border border-line bg-surface-2/60 px-3 py-2 text-[12px] text-fg-2">
            {money(order.price)} reserved from {order.resellerName ?? 'the reseller'}’s balance was released automatically — failed orders are never charged.
          </p>
        )}
      </CardBody>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
export function ClientCard({ order }: { order: OrderDetail }) {
  return (
    <Card>
      <CardHeader icon={<UserRound />} title="Client" />
      <CardBody>
        {order.resellerId && order.resellerName ? (
          <Link to={`/admin/resellers/${order.resellerId}`} className="group mb-2 flex items-center gap-3 rounded-lg border border-line bg-surface-2/50 p-2.5 transition-colors hover:border-line-strong hover:bg-surface-2">
            <ResellerAvatar reseller={{ id: order.resellerId, name: order.resellerName }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-fg">{order.resellerName}</p>
              <p className="font-mono text-[11px] text-fg-3">{order.resellerId}</p>
            </div>
            <ArrowUpRight className="size-4 text-fg-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-fg" />
          </Link>
        ) : (
          <div className="mb-2 rounded-lg border border-line bg-surface-2/50 p-2.5 text-[12.5px] text-fg-2">{order.channel === 'website' ? 'Public website checkout (UnlockDesk)' : 'Placed internally by an administrator'}</div>
        )}
        <dl>
          <KV label="Channel">
            <Badge tone="neutral" icon={order.channel === 'api' ? <KeyRound /> : undefined}>
              {CHANNEL_LABEL[order.channel]}
            </Badge>
          </KV>
          <KV label="Client reference" mono>
            {order.clientReference ? <MonoValue value={order.clientReference} className="text-fg" /> : <span className="text-fg-3">—</span>}
          </KV>
        </dl>
      </CardBody>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
export function RequestCard({ order }: { order: OrderDetail }) {
  return (
    <Card>
      <CardHeader
        icon={<ScrollText />}
        title="Request"
        actions={
          <Button variant="ghost" size="sm" to={`/admin/developer/logs?search=${encodeURIComponent(order.requestId)}`} trailing={<ArrowUpRight />}>
            API logs
          </Button>
        }
      />
      <CardBody>
        <dl>
          <KV label="Request ID" mono>
            <MonoValue value={order.requestId} display={truncateMiddle(order.requestId, 12, 6)} className="text-fg" />
          </KV>
          <KV label="Order ID" mono>
            <MonoValue value={order.id} className="text-fg" />
          </KV>
          <KV label="Created" mono>
            {fullTime(order.createdAt)}
          </KV>
          <KV label="Last update" mono>
            <Tooltip content={relative(order.updatedAt)}>
              <span>{fullTime(order.updatedAt)}</span>
            </Tooltip>
          </KV>
          <KV label="Completed" mono>
            {order.completedAt ? fullTime(order.completedAt) : <span className="text-fg-3">{isInFlight(order.status) ? 'In flight' : '—'}</span>}
          </KV>
        </dl>
        {order.channel !== 'api' && <p className="mt-2 text-[11.5px] text-fg-3">Placed outside the Reseller API — only internal request logs exist for this order.</p>}
      </CardBody>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
export function WebhooksCard({ order }: { order: OrderDetail }) {
  const endpoints = useWebhooks()
  const host = (id: string) => {
    const url = endpoints.data?.find((w) => w.id === id)?.url
    if (!url) return id
    try {
      const u = new URL(url)
      return `${u.host}${u.pathname}`
    } catch {
      return url
    }
  }
  const items = order.webhookDeliveries.slice().sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  return (
    <Card>
      <CardHeader
        icon={<Webhook />}
        title="Webhook deliveries"
        description={items.length ? `${items.length} deliver${items.length === 1 ? 'y' : 'ies'} for this order` : undefined}
        actions={
          <Button variant="ghost" size="sm" to="/admin/developer/webhooks" trailing={<ArrowUpRight />}>
            All
          </Button>
        }
      />
      {items.length === 0 ? (
        <EmptyState compact icon={<Webhook />} title="No deliveries yet" description={isInFlight(order.status) ? 'Events are dispatched as the order progresses.' : 'No subscribed endpoints for this order’s events.'} className="pt-2" />
      ) : (
        <ul className="px-5 pb-3">
          {items.map((d) => (
            <li key={d.id} className="flex items-start gap-3 border-b border-line py-2.5 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[12px] text-fg">{d.event}</span>
                  <StatusBadge status={d.status} />
                </div>
                <p className="mt-0.5 truncate font-mono text-[11px] text-fg-3" title={host(d.endpointId)}>
                  {host(d.endpointId)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className={cn('font-mono text-[12px] tabular', d.responseCode && d.responseCode < 300 ? 'text-fg-2' : 'text-danger')}>
                  {d.responseCode ?? 'timeout'} · {ms(d.latencyMs)}
                </p>
                <p className="font-mono text-[11px] text-fg-3 tabular">
                  {time(d.at, true)}
                  {d.attempt > 1 && ` · try ${d.attempt}/${d.maxAttempts}`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
