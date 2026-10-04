import { useContext, type ReactNode } from 'react'
import { Info, Lightbulb, TriangleAlert } from 'lucide-react'
import { CodeBlock, type CodeLang } from '@/components/ui'
import { cn } from '@/lib/cn'
import { MethodBadge } from '../shared'
import { statusPhrase } from '../helpers'
import { LangContext, type Lang } from './langContext'

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

export function ResponseCode({ status, code, maxHeight = 380, title, actions }: { status: number; code: string; maxHeight?: number; title?: string; actions?: ReactNode }) {
  const tone = status >= 500 ? 'text-danger' : status >= 400 ? 'text-warning' : 'text-success'
  const dot = status >= 500 ? 'bg-danger' : status >= 400 ? 'bg-warning' : 'bg-success'
  return (
    <CodeBlock
      lang="json"
      code={code}
      maxHeight={maxHeight}
      actions={actions}
      title={
        <span className="flex items-center gap-2">
          <span className="text-fg-3">{title ?? 'Response'}</span>
          <span className={cn('inline-flex items-center gap-1.5 font-medium', tone)}>
            <span className={cn('size-1.5 rounded-[2px]', dot)} />
            {status} {statusPhrase(status)}
          </span>
        </span>
      }
    />
  )
}

export function DocSection({ id, children, aside, className }: { id: string; children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <section id={id} data-doc-section className={cn('scroll-mt-24 border-b border-line py-10 first:pt-2 last:border-b-0', className)}>
      <div className={cn('grid gap-8', aside && 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)]')}>
        <div className="min-w-0">{children}</div>
        {aside && <div className="min-w-0 space-y-4 xl:sticky xl:top-20 xl:self-start">{aside}</div>}
      </div>
    </section>
  )
}

export function H2({ children, eyebrow, actions }: { children: ReactNode; eyebrow?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        {eyebrow && <div className="mono-label mb-2">{eyebrow}</div>}
        <h2 className="font-display text-[22px] leading-tight font-semibold tracking-[-0.02em] text-fg">{children}</h2>
      </div>
      {actions}
    </div>
  )
}

export function H3({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn('mt-7 mb-3 text-[14px] font-semibold tracking-[-0.01em] text-fg', className)}>{children}</h3>
}

export function P({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('mb-4 max-w-[70ch] text-[13.5px] leading-[1.72] text-fg-2', className)}>{children}</p>
}

export function C({ children }: { children: ReactNode }) {
  return <code className="rounded-[5px] border border-line bg-surface-2 px-1 py-px font-mono text-[12px] text-fg">{children}</code>
}

export function EndpointHeader({ method, path, title, scope, actions }: { method: string; path: string; title: ReactNode; scope?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-[22px] leading-tight font-semibold tracking-[-0.02em] text-fg">{title}</h2>
        {actions}
      </div>
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
      <div className="mb-1 border-b border-line pb-2">
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

export function SimpleTable({ head, rows, mono = [0], minWidth = 420 }: { head: string[]; rows: ReactNode[][]; mono?: number[]; minWidth?: number }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-[12.5px]" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-line bg-surface-2/50">
            {head.map((h) => (
              <th key={h} className="px-3.5 py-2 text-left text-[11.5px] font-medium whitespace-nowrap text-fg-3">
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
      <div className="min-w-0 text-fg-2">
        {title && <p className="mb-0.5 font-medium text-fg">{title}</p>}
        {children}
      </div>
    </div>
  )
}
