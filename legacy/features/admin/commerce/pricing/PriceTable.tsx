import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Pencil, RotateCcw, Tags, X } from 'lucide-react'
import { useInstMutation } from '@/hooks/installation'
import { pricingService } from '@/services/installation'
import type { PriceRow, PricingGroup, ServiceCategory } from '@/types/installation'
import { Badge, Button, Card, DataTable, EmptyState, SearchInput, Segmented, Tooltip, type Column } from '@/components/ui'
import { ServiceIcon, categoryColor } from '@/components/brand'
import { cn } from '@/lib/cn'
import { money, pct } from '@/lib/format'
import { CATEGORY_ORDER } from '@/features/admin/orders/lib'
import { LOW_MARGIN, rulePrice } from './shared'

type View = 'all' | 'contract' | 'low'

export function PriceTable({ group, rows, loading, previewing, iconOf }: { group?: PricingGroup; rows: PriceRow[] | undefined; loading?: boolean; previewing?: boolean; iconOf: Map<string, string> }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<'all' | ServiceCategory>('all')
  const [view, setView] = useState<View>('all')
  const [editing, setEditing] = useState<string | null>(null)

  useEffect(() => setEditing(null), [group?.id, previewing])

  const setOverride = useInstMutation(({ serviceId, price }: { serviceId: string; price: number | null }) => pricingService.setOverride(group!.id, serviceId, price), {
    success: (_g, v) => (v.price == null ? 'Contract price removed — group rule applies' : `Contract price set to ${money(v.price)}`),
    onSuccess: () => setEditing(null),
  })

  const categories = useMemo(() => {
    const present = new Set((rows ?? []).map((r) => r.category))
    return CATEGORY_ORDER.filter((c) => present.has(c))
  }, [rows])
  const categoryCount = (c: ServiceCategory) => rows?.filter((r) => r.category === c).length ?? 0
  const filtered = useMemo(() => {
    if (!rows) return undefined
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (category !== 'all' && r.category !== category) return false
      if (view === 'contract' && !r.overridden) return false
      if (view === 'low' && r.marginPercent >= LOW_MARGIN) return false
      return !q || `${r.serviceName} ${r.serviceId}`.toLowerCase().includes(q)
    })
  }, [rows, search, category, view])

  const counts = { contract: rows?.filter((r) => r.overridden).length ?? 0, low: rows?.filter((r) => r.marginPercent < LOW_MARGIN).length ?? 0 }

  const columns: Column<PriceRow>[] = [
    {
      key: 'service',
      header: 'Service',
      sortValue: (r) => r.serviceName,
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          <ServiceIcon icon={iconOf.get(r.serviceId) ?? 'box'} category={r.category} size="sm" />
          <div className="min-w-0">
            <div className="truncate font-medium text-fg">{r.serviceName}</div>
            <div className="text-[11.5px] text-fg-3">
              {r.category} · <span className="font-mono text-[10.5px]">{r.serviceId}</span>
            </div>
          </div>
        </div>
      ),
    },
    { key: 'cost', header: 'Supplier cost', align: 'right', sortValue: (r) => r.cost, cell: (r) => <span className="text-fg-2 tabular">{money(r.cost)}</span> },
    { key: 'public', header: 'Public price', align: 'right', hideBelow: 'md', sortValue: (r) => r.publicPrice, cell: (r) => <span className="text-fg-3 tabular">{money(r.publicPrice)}</span> },
    {
      key: 'price',
      header: `${group?.name ?? 'Group'} price`,
      align: 'right',
      width: 'w-[190px]',
      sortValue: (r) => r.groupPrice,
      cell: (r) => (
        <PriceCell
          row={r}
          rule={rulePrice(r.publicPrice, group?.discountPercent ?? 0)}
          editing={editing === r.serviceId}
          disabled={previewing || !group}
          saving={setOverride.isPending && setOverride.variables?.serviceId === r.serviceId}
          onEdit={() => setEditing(r.serviceId)}
          onCancel={() => setEditing(null)}
          onSave={(price) => setOverride.mutate({ serviceId: r.serviceId, price })}
        />
      ),
    },
    {
      key: 'margin',
      header: 'Margin',
      align: 'right',
      sortValue: (r) => r.margin,
      cell: (r) => <span className={cn('tabular', r.margin < 0 ? 'text-danger' : 'text-fg')}>{money(r.margin)}</span>,
    },
    {
      key: 'marginPct',
      header: 'Margin %',
      align: 'right',
      sortValue: (r) => r.marginPercent,
      cell: (r) => {
        const low = r.marginPercent < LOW_MARGIN
        return (
          <span className="inline-flex items-center justify-end gap-2">
            <span className="hidden h-1 w-12 overflow-hidden rounded-full bg-fg/[0.07] lg:block">
              <span className={cn('block h-full rounded-full', r.marginPercent < 0 ? 'bg-danger' : low ? 'bg-warning' : 'bg-accent')} style={{ width: `${Math.max(3, Math.min(100, r.marginPercent))}%` }} />
            </span>
            <span className={cn('w-[46px] tabular', r.marginPercent < 0 ? 'text-danger' : low ? 'text-warning' : 'text-fg')}>{pct(r.marginPercent)}</span>
          </span>
        )
      },
    },
    { key: 'markup', header: 'Markup', align: 'right', hideBelow: 'lg', sortValue: (r) => r.markupPercent, cell: (r) => <span className="text-fg-2 tabular">{pct(r.markupPercent, 0)}</span> },
  ]

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:px-5 xl:flex-row xl:items-center">
        <div className="mr-auto min-w-0">
          <h3 className="flex items-center gap-2 text-[14px] font-semibold tracking-[-0.01em]">
            Price table
            {previewing && (
              <Badge tone="accent" dot pulse>
                Previewing new discount
              </Badge>
            )}
          </h3>
          <p className="mt-0.5 text-[12.5px] text-fg-3">{previewing ? 'Save or reset the discount to edit contract prices.' : 'Click a price to set a contract override. Prices below supplier cost are rejected.'}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Filter services…" className="sm:w-[200px]" />
          <Segmented<View>
            value={view}
            onChange={setView}
            items={[
              { value: 'all', label: 'All' },
              { value: 'contract', label: 'Contract', count: counts.contract },
              { value: 'low', label: 'Low margin', count: counts.low },
            ]}
          />
        </div>
      </div>
      {categories.length > 1 && (
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto border-b border-line px-4 py-2 sm:px-5">
          {(['all', ...categories] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn('inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium transition-colors', category === c ? 'bg-surface-3 text-fg' : 'text-fg-3 hover:bg-surface-2 hover:text-fg-2')}
            >
              {c !== 'all' && <span className="size-1.5 rounded-full" style={{ background: categoryColor(c) }} />}
              {c === 'all' ? 'All categories' : c}
              <span className="font-mono text-[10.5px] text-fg-3 tabular">{c === 'all' ? (rows?.length ?? 0) : categoryCount(c)}</span>
            </button>
          ))}
        </div>
      )}
      <DataTable
        columns={columns}
        rows={filtered}
        loading={loading}
        rowKey={(r) => r.serviceId}
        minWidth={760}
        defaultSort={{ key: 'service', dir: 'asc' }}
        rowClassName={(r) => (editing === r.serviceId ? 'bg-accent/[0.04]' : undefined)}
        empty={<EmptyState compact icon={<Tags />} title="No services match" description={view === 'contract' ? 'This group has no contract prices yet. Click any price to add one.' : view === 'low' ? `Every service is above ${LOW_MARGIN}% margin.` : 'Try a different filter.'} />}
      />
    </Card>
  )
}

function PriceCell({ row, rule, editing, disabled, saving, onEdit, onCancel, onSave }: { row: PriceRow; rule: number; editing: boolean; disabled?: boolean; saving?: boolean; onEdit: () => void; onCancel: () => void; onSave: (price: number | null) => void }) {
  const [value, setValue] = useState(row.groupPrice.toFixed(2))
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      setValue(row.groupPrice.toFixed(2))
      setError(null)
      requestAnimationFrame(() => ref.current?.select())
    }
  }, [editing, row.groupPrice])

  const commit = () => {
    const n = Number(value)
    if (!value.trim() || Number.isNaN(n) || n <= 0) return setError('Enter a valid price')
    if (n < row.cost) return setError(`Below supplier cost (${money(row.cost)})`)
    if (Math.abs(n - row.groupPrice) < 0.001 && row.overridden) return onCancel()
    onSave(Math.round(n * 100) / 100)
  }

  if (editing)
    return (
      <div className="flex flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-[12px] text-fg-3">$</span>
            <input
              ref={ref}
              type="number"
              step="0.01"
              min={0}
              value={value}
              aria-invalid={!!error || undefined}
              onChange={(e) => {
                setValue(e.target.value)
                setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') onCancel()
              }}
              className="h-7.5 w-[88px] rounded-md border border-accent/50 bg-surface pr-1.5 pl-5 text-right font-mono text-[12.5px] text-fg tabular ring-3 ring-accent/15 outline-none aria-[invalid=true]:border-danger/60 aria-[invalid=true]:ring-danger/15"
            />
          </div>
          <Button size="sm" icon variant="primary" onClick={commit} loading={saving} aria-label="Save price">
            {!saving && <Check />}
          </Button>
          <Button size="sm" icon variant="ghost" onClick={onCancel} aria-label="Cancel">
            <X />
          </Button>
        </div>
        {error ? (
          <span className="text-[11.5px] text-danger">{error}</span>
        ) : (
          <span className="text-[11px] text-fg-3">
            Rule {money(rule)} · cost {money(row.cost)}
          </span>
        )}
      </div>
    )

  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      {row.overridden && (
        <>
          <Badge tone="info">Contract</Badge>
          <Tooltip content="Reset to group rule">
            <button type="button" disabled={disabled || saving} onClick={() => onSave(null)} className="grid size-6 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg disabled:opacity-40" aria-label="Reset to rule">
              <RotateCcw className="size-3.5" />
            </button>
          </Tooltip>
        </>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={onEdit}
        className="group/p inline-flex h-7 items-center gap-1.5 rounded-md border border-transparent px-2 font-medium text-fg tabular transition-colors hover:border-line hover:bg-surface-2 disabled:cursor-default disabled:hover:border-transparent disabled:hover:bg-transparent"
      >
        {money(row.groupPrice)}
        <Pencil className="size-3 text-fg-3 opacity-0 transition-opacity group-hover/p:opacity-100 group-disabled/p:hidden" />
      </button>
    </span>
  )
}
