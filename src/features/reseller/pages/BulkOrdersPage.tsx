import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Check, CircleCheck, CircleX, ClipboardList, Layers, ListChecks, RotateCcw, Sparkles, TriangleAlert, Wallet } from 'lucide-react'
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Select, Skeleton, Textarea } from '@/components/ui'
import { FieldChecks, FieldList, Money, useFieldForm } from '@/components/domain'
import { useInstMutation, usePortalServices } from '@/hooks/installation'
import { portalService } from '@/services/installation'
import { sub } from '@/core/money'
import type { BulkLineResult, PortalService } from '@/types/installation'
import { num, plural } from '@/lib/format'
import { cn } from '@/lib/cn'
import { CategoryGlyph, DemoNote, ErrorCard, NoAccess } from '../kit'
import { bulkField, newKey, sampleImeis, turnaroundLabel, usePortalSession } from '../kitUtils'

type Validation = Awaited<ReturnType<typeof portalService.validateBulk>>
type Placement = Awaited<ReturnType<typeof portalService.placeBulk>>

const splitLines = (t: string) => t.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean)

export default function BulkOrdersPage() {
  const { me, can, role } = usePortalSession()
  const services = usePortalServices()
  const bulkable = useMemo(() => (services.data ?? []).filter((s) => !!bulkField(s)), [services.data])
  const [serviceId, setServiceId] = useState('')
  const service = bulkable.find((s) => s.id === serviceId)

  const header = (
    <PageHeader
      title="Bulk orders"
      description="Paste up to 500 IMEIs or serial numbers, validate them all at once, then place every valid line as its own order — each with its own reference, reservation and result."
      actions={can.order && <Button to="/portal/order">Single order</Button>}
    />
  )

  if (me && !can.order)
    return (
      <div>
        {header}
        <NoAccess need="order" role={role} />
      </div>
    )

  return (
    <div>
      {header}
      <Card className="mb-4">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:p-5">
          <Field label="Service" htmlFor="bulk_service" className="flex-1">
            {services.isLoading ? (
              <Skeleton className="h-9" />
            ) : (
              <Select
                id="bulk_service"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                options={[{ value: '', label: 'Choose a service that takes an IMEI or serial…' }, ...bulkable.map((s) => ({ value: s.id, label: `${s.name}${s.available ? '' : ' (unavailable)'}` }))]}
              />
            )}
          </Field>
          {service && (
            <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-2/60 px-3 py-2">
              <CategoryGlyph categoryId={service.categoryId} size="sm" />
              <div className="text-[12px]">
                <div className="text-fg-3">Unit price · {turnaroundLabel(service)}</div>
                <Money value={service.price} className="text-[14px] font-semibold" />
              </div>
            </div>
          )}
        </div>
      </Card>

      {services.error ? (
        <ErrorCard error={services.error} onRetry={() => services.refetch()} />
      ) : service && me ? (
        <BulkFlow key={service.id} service={service} />
      ) : (
        <Card className="border-dashed">
          <EmptyState icon={<Layers />} title="Choose a service to begin" description="Bulk ordering works for services with one IMEI or serial number per order. Other required details (like a carrier) apply to every line." />
        </Card>
      )}
    </div>
  )
}

function BulkFlow({ service }: { service: PortalService }) {
  const idField = bulkField(service)!
  const extraFields = service.fields.filter((f) => f.key !== idField.key)
  const extra = useFieldForm(extraFields)
  const [text, setText] = useState('')
  const [clientRef, setClientRef] = useState('')
  const [validation, setValidation] = useState<Validation | null>(null)
  const [placement, setPlacement] = useState<Placement | null>(null)
  // One batch id per batch: re-sending the same batch can never double-place an IMEI.
  const [batchId, setBatchId] = useState(() => newKey('batch'))

  const validate = useInstMutation(portalService.validateBulk, { onSuccess: (v) => setValidation(v) })
  const place = useInstMutation(portalService.placeBulk, {
    success: (r) => `${plural(r.placed, 'order')} placed`,
    onSuccess: (r) => setPlacement(r),
  })

  const count = splitLines(text).length
  const okLines = validation?.lines.filter((l) => l.ok) ?? []
  const spendable = validation?.balance.spendable
  const affordable = validation ? validation.total <= validation.balance.spendable : true

  const reset = () => {
    setText('')
    setClientRef('')
    setValidation(null)
    setPlacement(null)
    setBatchId(newKey('batch'))
    extra.reset()
  }

  if (placement) return <BulkResults placement={placement} onNew={reset} />

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        <Card>
          <CardHeader
            icon={<ClipboardList />}
            title={`1 · Paste ${idField.label.toLowerCase()}s`}
            description="One per line, or separated by commas. Spaces and dashes are removed for you."
            actions={
              <Button size="xs" variant="ghost" leading={<Sparkles />} onClick={() => (setText(sampleImeis()), setValidation(null))}>
                Sample (demo)
              </Button>
            }
          />
          <div className="space-y-3 px-5 pb-5">
            <Textarea
              mono
              rows={9}
              value={text}
              placeholder={'356938035643809\n353325104512347\n…'}
              onChange={(e) => {
                setText(e.target.value)
                setValidation(null)
              }}
              aria-label={`${idField.label} list`}
            />
            <div className="flex items-center justify-between text-[12px] text-fg-3">
              <span className="tabular">{plural(count, 'line')}</span>
              {count > 500 && <span className="text-warning">Only the first 500 lines are checked</span>}
            </div>
            {extraFields.length > 0 && (
              <div className="rounded-lg border border-line bg-surface-2/50 p-4">
                <div className="mb-3 text-[12.5px] font-medium">Applies to every line</div>
                <FieldList fields={extraFields} form={extra} />
              </div>
            )}
            <Field label="Batch reference" optional hint="Each order gets this reference with its line number, e.g. TRADEIN-0412-3." htmlFor="bulk_ref">
              <Input id="bulk_ref" value={clientRef} maxLength={48} placeholder="e.g. TRADEIN-0412" onChange={(e) => setClientRef(e.target.value)} />
            </Field>
            <div className="flex justify-end">
              <Button
                variant={validation ? 'secondary' : 'primary'}
                leading={<ListChecks />}
                loading={validate.isPending}
                disabled={!count}
                onClick={() => {
                  if (!extra.submit()) return
                  validate.mutate({ serviceId: service.id, text })
                }}
              >
                {validation ? 'Validate again' : 'Validate'}
              </Button>
            </div>
          </div>
        </Card>

        {validation && (
          <Card>
            <CardHeader
              icon={<ListChecks />}
              title="2 · Review"
              description={`${num(validation.ok)} ready · ${num(validation.invalid)} need attention`}
              actions={validation.invalid > 0 && <Badge tone="warning">{plural(validation.invalid, 'issue')}</Badge>}
            />
            <ValidationTable lines={validation.lines} />
          </Card>
        )}
      </div>

      <aside className="min-w-0">
        <div className="space-y-4 lg:sticky lg:top-20">
          <Card>
            <CardHeader icon={<Wallet />} title="Summary" />
            <div className="space-y-2 px-5 pb-5 text-[13px]">
              <Row label="Valid lines">{validation ? num(validation.ok) : '—'}</Row>
              <Row label="Unit price">
                <Money value={validation?.unitPrice ?? service.price} />
              </Row>
              <Row label="Total to reserve" strong>
                {validation ? <Money value={validation.total} /> : '—'}
              </Row>
              <div className="border-t border-line pt-2" />
              <Row label="Spendable now">{spendable != null ? <Money value={spendable} /> : '—'}</Row>
              <Row label="After placing">{validation ? <Money value={sub(validation.balance.spendable, validation.total)} tone="auto" /> : '—'}</Row>

              {validation && !affordable && (
                <div className="mt-2 flex gap-2 rounded-lg border border-danger/30 bg-danger/[0.06] px-3 py-2 text-[12px] text-danger">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    Not enough balance for every line. <Link to="/portal/wallet?topup=1" className="font-medium underline">Top up</Link> or remove some lines.
                  </span>
                </div>
              )}

              <Button
                variant="accent"
                size="lg"
                className="mt-3 w-full"
                loading={place.isPending}
                disabled={!validation || okLines.length === 0 || !affordable || !service.available}
                onClick={() => place.mutate({ serviceId: service.id, imeis: okLines.map((l) => l.imei), batchId, clientReference: clientRef.trim() || undefined, extra: extraFields.length ? extra.normalized : undefined })}
              >
                {validation ? `Place ${plural(okLines.length, 'order')}` : 'Validate first'}
              </Button>
              {validation && validation.invalid > 0 && okLines.length > 0 && <p className="text-center text-[11.5px] text-fg-3">Invalid lines are skipped — nothing is reserved for them.</p>}
              {!service.available && <p className="text-center text-[11.5px] text-warning">{service.unavailableReason ?? 'Service temporarily unavailable'}</p>}
            </div>
          </Card>
          <DemoNote>
            <span className="font-mono text-[10px] font-semibold tracking-[0.1em] text-warning">BATCH </span>
            <code className="font-mono text-[11px] break-all">{batchId}</code>
            <span className="mt-1 block text-[11.5px] text-fg-3">Each line is sent with the key <code className="font-mono">bulk:{'{batch}'}:{'{imei}'}</code> — retrying this batch returns the same orders.</span>
          </DemoNote>
        </div>
      </aside>
    </div>
  )
}

function Row({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-fg-3">{label}</span>
      <span className={cn('tabular', strong && 'text-[15px] font-semibold')}>{children}</span>
    </div>
  )
}

function ValidationTable({ lines }: { lines: BulkLineResult[] }) {
  if (!lines.length) return <EmptyState compact title="Nothing to check" description="Paste at least one line." />
  return (
    <div className="max-h-[480px] overflow-y-auto border-t border-line">
      <ul className="divide-y divide-line">
        {lines.map((l) => (
          <li key={l.line} className={cn('flex items-start gap-3 px-5 py-2.5', !l.ok && 'bg-danger/[0.03]')}>
            <span className="w-7 shrink-0 pt-0.5 text-right font-mono text-[11px] text-fg-3 tabular">{l.line}</span>
            <span className={cn('mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-full', l.ok ? 'bg-success/15 text-success' : 'bg-danger/12 text-danger')}>{l.ok ? <Check className="size-3" /> : <CircleX className="size-3" />}</span>
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[12.5px] break-all">{l.imei || <span className="text-fg-3">(empty)</span>}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                <FieldChecks checks={l.checks} />
                {l.error && <span className="text-[11.5px] font-medium text-danger">{l.error}</span>}
              </div>
            </div>
            <span className={cn('shrink-0 pt-0.5 text-[11.5px] font-medium', l.ok ? 'text-success' : 'text-fg-3')}>{l.ok ? 'Ready' : 'Skipped'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function BulkResults({ placement, onNew }: { placement: Placement; onNew: () => void }) {
  const failed = placement.results.filter((r) => !r.ok)
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <span className={cn('grid size-12 shrink-0 place-items-center rounded-xl', failed.length ? 'bg-warning/12 text-warning' : 'bg-success/12 text-success')}>{failed.length ? <TriangleAlert className="size-6" /> : <CircleCheck className="size-6" />}</span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em]">
              {plural(placement.placed, 'order')} placed{failed.length ? ` · ${num(failed.length)} failed` : ''}
            </h2>
            <p className="mt-0.5 text-[12.5px] text-fg-3">
              Funds are reserved per order and charged only when each one completes. Batch <code className="font-mono">{placement.batchId}</code>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button leading={<RotateCcw />} onClick={onNew}>
              New batch
            </Button>
            <Button to="/portal/orders?status=processing" variant="primary" trailing={<ArrowRight />}>
              Follow orders
            </Button>
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader title="Per-line results" description="Each order has its own reference, timeline and result." />
        <ul className="divide-y divide-line border-t border-line">
          {placement.results.map((r) => (
            <li key={r.line} className="flex items-center gap-3 px-5 py-2.5">
              <span className="w-7 shrink-0 text-right font-mono text-[11px] text-fg-3 tabular">{r.line}</span>
              <span className={cn('grid size-4.5 shrink-0 place-items-center rounded-full', r.ok ? 'bg-success/15 text-success' : 'bg-danger/12 text-danger')}>{r.ok ? <Check className="size-3" /> : <CircleX className="size-3" />}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{r.imei}</span>
              {r.ok && r.orderRef ? (
                <Link to={`/portal/orders/${r.orderRef}`} className="shrink-0 font-mono text-[12px] font-medium text-accent-ink hover:underline">
                  {r.orderRef} →
                </Link>
              ) : (
                <span className="max-w-[55%] shrink-0 truncate text-right text-[12px] text-danger" title={r.error}>
                  {r.error ?? 'Failed'}
                </span>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
