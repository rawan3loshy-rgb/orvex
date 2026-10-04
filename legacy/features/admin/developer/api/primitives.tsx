import { createContext, useContext, useState, type ReactNode } from 'react'
import { Info, Lightbulb, TriangleAlert } from 'lucide-react'
import { Badge, CodeBlock, type CodeLang } from '@/components/ui'
import { cn } from '@/lib/cn'
import { MethodBadge, statusPhrase } from '../shared'
import type { Lang } from './samples'

/* ------------------------------------------------------------------------- */
/*  Language preference (shared by every sample on the page)                 */
/* ------------------------------------------------------------------------- */
export const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'curl', setLang: () => undefined })

const LANGS: { id: Lang; label: string; code: CodeLang }[] = [
  { id: 'curl', label: 'cURL', code: 'bash' },
  { id: 'node', label: 'Node.js', code: 'js' },
  { id: 'python', label: 'Python', code: 'python' },
]

export function SampleCode({ samples, label }: { samples: Record<Lang, string>; label?: ReactNode }) {
  const { lang, setLang } = useContext(LangContext)
  const current = LANGS.find((l) => l.id === lang)!
  return (
    <CodeBlock
      lang={current.code}
      code={samples[lang]}
      title={
        <span className="-ml-2 flex items-center gap-0.5 font-sans">
          {label && <span className="mr-1.5 px-2 font-mono text-[11.5px] text-fg-3">{label}</span>}
          {LANGS.map((l) => (
            <button key={l.id} type="button" onClick={() => setLang(l.id)} className={cn('rounded-md px-2 py-1 text-[12px] font-medium whitespace-nowrap transition-colors', l.id === lang ? 'bg-surface-3 text-fg' : 'text-fg-3 hover:text-fg-2')}>
              {l.label}
            </button>
          ))}
        </span>
      }
    />
  )
}

export function ResponseCode({ status, code, live, maxHeight = 380, title }: { status: number; code: string; live?: boolean; maxHeight?: number; title?: string }) {
  const tone = status >= 500 ? 'text-danger' : status >= 400 ? 'text-warning' : 'text-success'
  const dot = status >= 500 ? 'bg-danger' : status >= 400 ? 'bg-warning' : 'bg-success'
  return (
    <CodeBlock
      lang="json"
      code={code}
      maxHeight={maxHeight}
      title={
        <span className="flex items-center gap-2">
          <span className="text-fg-3">{title ?? 'Response'}</span>
          <span className={cn('inline-flex items-center gap-1.5 font-medium', tone)}>
            <span className={cn('size-1.5 rounded-[2px]', dot)} />
            {status} {statusPhrase(status)}
          </span>
        </span>
      }
      actions={
        live ? (
          <Badge tone="accent" dot pulse className="mr-1">
            Live catalog
          </Badge>
        ) : undefined
      }
    />
  )
}

/** Switches between several request/response examples in a section aside. */
export function ExampleSwitcher({ items, label }: { items: { id: string; label: ReactNode; content: ReactNode }[]; label?: ReactNode }) {
  const [active, setActive] = useState(items[0]?.id)
  const current = items.find((i) => i.id === active) ?? items[0]
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {label && <span className="mono-label mr-1">{label}</span>}
        <div role="tablist" className="no-scrollbar inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-line bg-surface-2 p-0.5">
          {items.map((it) => {
            const on = it.id === current?.id
            return (
              <button
                key={it.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setActive(it.id)}
                className={cn('relative flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[12px] whitespace-nowrap transition-colors', on ? 'bg-surface text-fg shadow-card' : 'text-fg-3 hover:text-fg-2')}
              >
                {on && <span className="absolute inset-x-2 -bottom-px h-px bg-accent" />}
                {it.label}
              </button>
            )
          })}
        </div>
      </div>
      <div key={current?.id} className="animate-fade-up space-y-4 [animation-duration:250ms]">
        {current?.content}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/*  Layout                                                                   */
/* ------------------------------------------------------------------------- */
export function DocSection({ id, children, aside, className }: { id: string; children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <section id={id} data-doc-section className={cn('scroll-mt-28 border-b border-line py-12 first:pt-4 last:border-b-0', className)}>
      <div className={cn('grid gap-8', aside && 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,500px)]')}>
        <div className="min-w-0">{children}</div>
        {aside && <div className="min-w-0 space-y-4 lg:sticky lg:top-[112px] lg:self-start min-[1360px]:top-[76px]">{aside}</div>}
      </div>
    </section>
  )
}

export function H2({ children, eyebrow }: { children: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-4">
      {eyebrow && <div className="mono-label mb-2">{eyebrow}</div>}
      <h2 className="font-display text-[22px] leading-tight font-semibold tracking-[-0.02em] text-fg">{children}</h2>
    </div>
  )
}

export function H3({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn('mt-8 mb-3 text-[14px] font-semibold tracking-[-0.01em] text-fg', className)}>{children}</h3>
}

export function P({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('mb-4 max-w-[68ch] text-[13.5px] leading-[1.72] text-fg-2', className)}>{children}</p>
}

export function C({ children }: { children: ReactNode }) {
  return <code className="rounded-[5px] border border-line bg-surface-2 px-1 py-px font-mono text-[12px] text-fg">{children}</code>
}

export function EndpointHeader({ method, path, title, scope }: { method: string; path: string; title: ReactNode; scope?: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-display text-[22px] leading-tight font-semibold tracking-[-0.02em] text-fg">{title}</h2>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex h-8 items-center gap-2 rounded-lg border border-line bg-surface-2/60 pr-3 pl-1.5">
          <MethodBadge method={method} />
          <code className="font-mono text-[12.5px] text-fg">
            {path.split(/(:[a-z_]+)/).map((part, i) => (part.startsWith(':') ? <span key={i} className="text-accent-ink">{part}</span> : part))}
          </code>
        </span>
        {scope && (
          <span className="inline-flex h-6 items-center gap-1.5 rounded-md bg-fg/[0.04] px-2 text-[11.5px] text-fg-3 ring-1 ring-line ring-inset">
            scope <code className="font-mono text-fg-2">{scope}</code>
          </span>
        )}
      </div>
    </div>
  )
}

export interface Param {
  name: string
  type: string
  required?: boolean
  description: ReactNode
  values?: string[]
}

export function ParamTable({ title, params }: { title: string; params: Param[] }) {
  return (
    <div className="mt-6">
      <div className="mb-1 flex items-center justify-between border-b border-line pb-2">
        <h4 className="text-[13px] font-semibold text-fg">{title}</h4>
      </div>
      <ul className="divide-y divide-line">
        {params.map((p) => (
          <li key={p.name} className="py-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <code className="font-mono text-[12.5px] font-semibold text-fg">{p.name}</code>
              <span className="font-mono text-[11.5px] text-fg-3">{p.type}</span>
              {p.required ? <span className="font-mono text-[10px] font-semibold tracking-[0.08em] text-accent-ink uppercase">Required</span> : <span className="font-mono text-[10px] tracking-[0.08em] text-fg-3 uppercase">Optional</span>}
            </div>
            <div className="mt-1 text-[13px] leading-relaxed text-fg-2">{p.description}</div>
            {p.values && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {p.values.map((v) => (
                  <code key={v} className="rounded-[5px] bg-fg/[0.05] px-1.5 py-px font-mono text-[11px] text-fg-2">
                    {v}
                  </code>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SimpleTable({ head, rows, mono = [0] }: { head: string[]; rows: ReactNode[][]; mono?: number[] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[420px] text-[12.5px]">
        <thead>
          <tr className="border-b border-line bg-surface-2/50">
            {head.map((h) => (
              <th key={h} className="px-3.5 py-2 text-left text-[11.5px] font-medium text-fg-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr key={i} className="align-top transition-colors hover:bg-surface-2/40">
              {r.map((c, j) => (
                <td key={j} className={cn('px-3.5 py-2.5 text-fg-2', mono.includes(j) && 'font-mono text-[12px] whitespace-nowrap text-fg')}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Callout({ tone = 'info', title, children }: { tone?: 'info' | 'warning' | 'tip'; title?: ReactNode; children: ReactNode }) {
  const map = {
    info: { cls: 'border-line-strong bg-surface-2/50', icon: <Info className="text-fg-2" /> },
    warning: { cls: 'border-warning/25 bg-warning/[0.05]', icon: <TriangleAlert className="text-warning" /> },
    tip: { cls: 'border-success/20 bg-success/[0.04]', icon: <Lightbulb className="text-success" /> },
  }[tone]
  return (
    <div className={cn('my-5 flex gap-3 rounded-xl border p-3.5 text-[13px] leading-relaxed [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0', map.cls)}>
      {map.icon}
      <div className="text-fg-2">
        {title && <p className="mb-0.5 font-medium text-fg">{title}</p>}
        {children}
      </div>
    </div>
  )
}
