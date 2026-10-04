import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { num } from '@/lib/format'
import { Skeleton } from './Display'
import { Button } from './Button'

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T, index: number) => ReactNode
  align?: 'left' | 'right' | 'center'
  /** Tailwind width class, e.g. "w-[140px]". */
  width?: string
  /** Enables client-side sorting on this column. */
  sortValue?: (row: T) => number | string
  className?: string
  headerClassName?: string
  /** Hide this column below a breakpoint. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl'
}

const hide = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell', xl: 'hidden xl:table-cell' }

export interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[] | undefined
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  loading?: boolean
  empty?: ReactNode
  dense?: boolean
  selectedKey?: string | null
  className?: string
  minWidth?: number
  skeletonRows?: number
  defaultSort?: { key: string; dir: 'asc' | 'desc' }
  rowClassName?: (row: T) => string | undefined
}

/**
 * Reusable data table: client-side sorting, row selection highlight,
 * skeleton loading rows, empty state and responsive column hiding.
 */
export function DataTable<T>({ columns, rows, rowKey, onRowClick, loading, empty, dense, selectedKey, className, minWidth = 640, skeletonRows = 8, defaultSort, rowClassName }: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(defaultSort ?? null)
  const sorted = useMemo(() => {
    if (!rows || !sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows
    const m = sort.dir === 'asc' ? 1 : -1
    return rows.slice().sort((a, b) => {
      const av = col.sortValue!(a)
      const bv = col.sortValue!(b)
      return (typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))) * m
    })
  }, [rows, sort, columns])

  const py = dense ? 'py-2' : 'py-3'
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full border-separate border-spacing-0 text-[13px]" style={{ minWidth }}>
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key
              return (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    'sticky top-0 z-[1] border-b border-line bg-surface px-4 py-2.5 text-left text-[11.5px] font-medium tracking-wide whitespace-nowrap text-fg-3 first:pl-5 last:pr-5',
                    c.align === 'right' && 'text-right',
                    c.align === 'center' && 'text-center',
                    c.width,
                    c.hideBelow && hide[c.hideBelow],
                    c.headerClassName,
                  )}
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() => setSort(active ? (sort!.dir === 'desc' ? { key: c.key, dir: 'asc' } : null) : { key: c.key, dir: 'desc' })}
                      className={cn('inline-flex items-center gap-1 hover:text-fg', active && 'text-fg', c.align === 'right' && 'flex-row-reverse')}
                    >
                      {c.header}
                      {active ? sort!.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ChevronsUpDown className="size-3 opacity-40" />}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {loading && !rows
            ? Array.from({ length: skeletonRows }, (_, i) => (
                <tr key={i}>
                  {columns.map((c, j) => (
                    <td key={c.key} className={cn('border-b border-line px-4 first:pl-5 last:pr-5', py, c.hideBelow && hide[c.hideBelow])}>
                      <Skeleton className={cn('h-3.5', j === 0 ? 'w-24' : j % 3 === 0 ? 'w-12' : 'w-20', c.align === 'right' && 'ml-auto')} />
                    </td>
                  ))}
                </tr>
              ))
            : sorted?.map((row, i) => {
                const key = rowKey(row)
                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn('group transition-colors', onRowClick && 'cursor-pointer hover:bg-surface-2/70', selectedKey === key && 'bg-accent/[0.06] hover:bg-accent/[0.08]', rowClassName?.(row))}
                  >
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          'border-b border-line px-4 align-middle first:pl-5 last:pr-5 group-last:border-b-0',
                          py,
                          c.align === 'right' && 'text-right tabular',
                          c.align === 'center' && 'text-center',
                          c.hideBelow && hide[c.hideBelow],
                          c.className,
                        )}
                      >
                        {c.cell(row, i)}
                      </td>
                    ))}
                  </tr>
                )
              })}
        </tbody>
      </table>
      {!loading && sorted && sorted.length === 0 && (empty ?? <div className="py-12 text-center text-[13px] text-fg-3">No results</div>)}
    </div>
  )
}

export function Pagination({ page, pageSize, total, onPage, className }: { page: number; pageSize: number; total: number; onPage: (p: number) => void; className?: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <div className={cn('flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-[12.5px] text-fg-3', className)}>
      <span className="tabular">
        {num(from)}–{num(to)} of {num(total)}
      </span>
      <div className="flex items-center gap-1">
        <span className="mr-2 hidden tabular sm:inline">
          Page {page} of {num(pages)}
        </span>
        <Button size="sm" variant="secondary" icon disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft />
        </Button>
        <Button size="sm" variant="secondary" icon disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
