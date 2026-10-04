import { useMemo, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { CopyButton } from './Display'
import { highlight, type CodeLang } from './highlight'

export interface CodeTab {
  label: string
  lang: CodeLang
  code: string
}

/** Syntax-highlighted code with copy and optional language tabs. */
export function CodeBlock({
  code,
  lang = 'text',
  tabs,
  title,
  className,
  maxHeight,
  lineNumbers,
  actions,
  wrap,
}: {
  code?: string
  lang?: CodeLang
  tabs?: CodeTab[]
  title?: ReactNode
  className?: string
  maxHeight?: number
  lineNumbers?: boolean
  actions?: ReactNode
  wrap?: boolean
}) {
  const [active, setActive] = useState(0)
  const current = tabs ? tabs[active]! : { code: code ?? '', lang, label: '' }
  const nodes = useMemo(() => highlight(current.code, current.lang), [current.code, current.lang])
  const lines = current.code.split('\n').length
  return (
    <div className={cn('overflow-hidden rounded-xl border border-line bg-bg-subtle', className)}>
      {(tabs || title || actions) && (
        <div className="flex items-center justify-between gap-2 border-b border-line bg-surface/60 px-2 py-1.5">
          <div className="no-scrollbar flex items-center gap-0.5 overflow-x-auto">
            {title && <span className="px-2 font-mono text-[11.5px] text-fg-3">{title}</span>}
            {tabs?.map((t, i) => (
              <button key={t.label} onClick={() => setActive(i)} className={cn('rounded-md px-2 py-1 text-[12px] font-medium whitespace-nowrap transition-colors', i === active ? 'bg-surface-3 text-fg' : 'text-fg-3 hover:text-fg-2')}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {actions}
            <CopyButton value={current.code} />
          </div>
        </div>
      )}
      <div className="relative">
        {!tabs && !title && !actions && <CopyButton value={current.code} className="absolute top-2 right-2 z-[1] bg-surface/80 backdrop-blur" />}
        <pre className={cn('overflow-auto p-4 font-mono text-[12.5px] leading-[1.65] text-fg', wrap && 'break-all whitespace-pre-wrap')} style={{ maxHeight }}>
          {lineNumbers ? (
            <div className="flex">
              <div aria-hidden className="mr-4 shrink-0 text-right text-fg-3/60 select-none">
                {Array.from({ length: lines }, (_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <code className="min-w-0 flex-1">{nodes}</code>
            </div>
          ) : (
            <code>{nodes}</code>
          )}
        </pre>
      </div>
    </div>
  )
}
