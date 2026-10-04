/** Order result rendered from the service revision's result schema — storefront styling. */
import { Check, Minus } from 'lucide-react'
import type { Order, ResultFieldDef } from '@/types/installation'
import { date } from '@/lib/format'
import { cn } from '@/lib/cn'
import { prettyValue } from '../lib/format'
import { cardCls, Pill, SfCopyButton } from '../ui'

type Val = string | number | boolean

function toneOf(f: ResultFieldDef, v: Val): 'success' | 'warning' | 'danger' | 'neutral' {
  return f.tones?.[String(v)] ?? 'neutral'
}

export function ResultValue({ f, v, large }: { f: ResultFieldDef; v: Val | undefined; large?: boolean }) {
  if (v === undefined || v === '') return <span className="text-fg-3">—</span>
  if (f.kind === 'boolean')
    return (
      <span className={cn('inline-flex items-center gap-1.5 font-semibold', v ? 'text-success' : 'text-fg-2')}>
        {v ? <Check className="size-4" strokeWidth={2.6} /> : <Minus className="size-4" />}
        {v ? 'Yes' : 'No'}
      </span>
    )
  if (f.kind === 'status') {
    const t = toneOf(f, v)
    if (large) return <span className={cn(t === 'success' && 'text-success', t === 'danger' && 'text-danger', t === 'warning' && 'text-warning')}>{prettyValue(v)}</span>
    return (
      <Pill tone={t === 'neutral' ? 'neutral' : t} dot>
        {prettyValue(v)}
      </Pill>
    )
  }
  if (f.kind === 'code')
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className={cn('rounded-[var(--sf-r-sm)] border border-line bg-surface-2 px-2.5 py-1 font-mono font-semibold tracking-wider text-fg', large ? 'text-[22px]' : 'text-[14.5px]')}>{String(v)}</span>
        <SfCopyButton value={String(v)} />
      </span>
    )
  if (f.kind === 'date') return <span className="tabular-nums">{date(String(v))}</span>
  return <span>{String(v)}</span>
}

export function StoreResult({ result, schema, className }: { result: NonNullable<Order['result']>; schema: ResultFieldDef[]; className?: string }) {
  const fields: ResultFieldDef[] = schema.length ? schema : Object.keys(result.fields).map((k) => ({ key: k, label: prettyValue(k), kind: 'text' as const }))
  const primary = fields.find((f) => f.primary) ?? fields[0]
  const rest = fields.filter((f) => f !== primary)
  return (
    <div className={cn(cardCls, 'overflow-hidden', className)}>
      {primary && (
        <div className="border-b border-line bg-[linear-gradient(180deg,color-mix(in_oklab,var(--accent)_6%,transparent),transparent)] px-5 py-5 sm:px-6">
          <div className="text-[12.5px] font-semibold tracking-wide text-fg-3 uppercase">{primary.label}</div>
          <div className="sf-h mt-1.5 text-[28px] leading-tight font-semibold sm:text-[32px]">
            <ResultValue f={primary} v={result.fields[primary.key]} large />
          </div>
          {result.summary && <p className="mt-2 text-[14px] text-fg-3">{result.summary}</p>}
        </div>
      )}
      {rest.length > 0 && (
        <dl className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
          {rest.map((f, i) => (
            <div key={f.key} className={cn('flex items-center justify-between gap-4 px-5 py-3.5 sm:block sm:px-6', i >= 2 && 'sm:border-t sm:border-line')}>
              <dt className="text-[13px] text-fg-3">{f.label}</dt>
              <dd className="text-right text-[15px] font-semibold text-fg sm:mt-1 sm:text-left">
                <ResultValue f={f} v={result.fields[f.key]} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div className="border-t border-line px-5 py-3 text-[12.5px] text-fg-3 sm:px-6">Result received {date(result.receivedAt)}</div>
    </div>
  )
}
