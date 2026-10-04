import type { Order, ResultFieldDef } from '@/types/installation'
import { Badge, CopyButton } from '@/components/ui'
import { date } from '@/lib/format'
import { cn } from '@/lib/cn'

/** Renders an order result using the service revision's result schema (status tones, codes, dates). */
export function ResultView({ result, schema, className }: { result: NonNullable<Order['result']>; schema: ResultFieldDef[]; className?: string }) {
  const known: ResultFieldDef[] = schema.length ? schema : Object.keys(result.fields).map((k) => ({ key: k, label: k, kind: 'text' as const }))
  const primary = known.find((f) => f.primary) ?? known[0]
  const rest = known.filter((f) => f !== primary)
  const show = (f: ResultFieldDef) => {
    const v = result.fields[f.key]
    if (v === undefined) return <span className="text-fg-3">—</span>
    if (f.kind === 'boolean') return <Badge tone={v ? 'success' : 'neutral'}>{v ? 'Yes' : 'No'}</Badge>
    if (f.kind === 'status') {
      const tone = f.tones?.[String(v)] ?? 'neutral'
      return (
        <Badge tone={tone === 'neutral' ? 'neutral' : tone} dot>
          {String(v).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}
        </Badge>
      )
    }
    if (f.kind === 'code')
      return (
        <span className="inline-flex items-center gap-1.5 font-mono text-[13px] font-semibold tracking-wide">
          {String(v)}
          <CopyButton value={String(v)} />
        </span>
      )
    if (f.kind === 'date') return <span className="tabular">{date(String(v))}</span>
    return <span>{String(v)}</span>
  }
  return (
    <div className={cn('rounded-xl border border-line bg-surface', className)}>
      {primary && (
        <div className="border-b border-line px-4 py-3.5">
          <div className="mono-label text-fg-3">{primary.label}</div>
          <div className="mt-1 font-display text-[22px] font-semibold tracking-[-0.02em]">{show(primary)}</div>
        </div>
      )}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 px-4 py-3.5 sm:grid-cols-2">
        {rest.map((f) => (
          <div key={f.key} className="flex items-center justify-between gap-3 sm:block">
            <dt className="text-[11.5px] text-fg-3">{f.label}</dt>
            <dd className="text-[13px] font-medium sm:mt-0.5">{show(f)}</dd>
          </div>
        ))}
      </dl>
      <div className="border-t border-line px-4 py-2 text-[11.5px] text-fg-3">{result.source === 'manual' ? 'Entered manually by an operator' : 'Returned by the supplier'} · {date(result.receivedAt)}</div>
    </div>
  )
}
