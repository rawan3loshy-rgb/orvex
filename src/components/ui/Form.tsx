import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/cn'

const control =
  'w-full rounded-lg border border-line bg-surface text-[13.5px] text-fg shadow-[0_1px_0_rgb(0_0_0/0.02)] transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-fg-3 hover:border-line-strong focus:border-accent/60 focus:outline-none focus:ring-3 focus:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger/60 aria-[invalid=true]:focus:ring-danger/15'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  leading?: ReactNode
  trailing?: ReactNode
  invalid?: boolean
  inputSize?: 'sm' | 'md' | 'lg'
  mono?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ leading, trailing, invalid, inputSize = 'md', mono, className, ...rest }, ref) {
  const h = inputSize === 'sm' ? 'h-8' : inputSize === 'lg' ? 'h-11 text-[15px]' : 'h-9'
  return (
    <div className={cn('relative flex items-center', className)}>
      {leading && <span className="pointer-events-none absolute left-3 flex items-center text-fg-3 [&_svg]:size-4">{leading}</span>}
      <input ref={ref} aria-invalid={invalid || undefined} className={cn(control, h, 'px-3', leading && 'pl-9', trailing && 'pr-9', mono && 'font-mono text-[12.5px]')} {...rest} />
      {trailing && <span className="absolute right-2.5 flex items-center text-fg-3 [&_svg]:size-4">{trailing}</span>}
    </div>
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean; mono?: boolean }>(function Textarea({ className, invalid, mono, ...rest }, ref) {
  return <textarea ref={ref} aria-invalid={invalid || undefined} className={cn(control, 'min-h-20 px-3 py-2 leading-relaxed', mono && 'font-mono text-[12.5px]', className)} {...rest} />
})

export interface SelectOption {
  value: string
  label: string
}

export const Select = forwardRef<HTMLSelectElement, Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & { options: SelectOption[]; inputSize?: 'sm' | 'md'; invalid?: boolean }>(function Select(
  { options, className, inputSize = 'md', invalid, ...rest },
  ref,
) {
  return (
    <div className={cn('relative', className)}>
      <select ref={ref} aria-invalid={invalid || undefined} className={cn(control, inputSize === 'sm' ? 'h-8 text-[13px]' : 'h-9', 'appearance-none pr-8 pl-3')} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-fg-3" />
    </div>
  )
})

export function Field({ label, hint, error, children, className, htmlFor, optional, action }: { label?: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; className?: string; htmlFor?: string; optional?: boolean; action?: ReactNode }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {(label || action) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <label htmlFor={htmlFor} className="text-[12.5px] font-medium text-fg">
              {label}
              {optional && <span className="ml-1.5 font-normal text-fg-3">Optional</span>}
            </label>
          )}
          {action}
        </div>
      )}
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-fg-3">{hint}</p> : null}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className, autoFocus, kbd }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; autoFocus?: boolean; kbd?: string }) {
  return (
    <Input
      className={className}
      value={value}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      leading={<Search />}
      trailing={
        value ? (
          <button type="button" onClick={() => onChange('')} className="pointer-events-auto rounded p-0.5 text-fg-3 hover:bg-surface-3 hover:text-fg" aria-label="Clear search">
            <X className="size-3.5!" />
          </button>
        ) : kbd ? (
          <kbd className="rounded border border-line bg-surface-2 px-1.5 font-mono text-[10.5px] text-fg-3">{kbd}</kbd>
        ) : undefined
      }
    />
  )
}

export function Switch({ checked, onChange, disabled, size = 'md', label, id }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; size?: 'sm' | 'md'; label?: string; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full border transition-colors duration-200 disabled:opacity-50',
        size === 'sm' ? 'h-4.5 w-8' : 'h-5.5 w-9.5',
        checked ? 'border-accent bg-accent' : 'border-line-strong bg-surface-3',
      )}
    >
      <span
        className={cn(
          'inline-block rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.3)] transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
          size === 'sm' ? 'size-3.5' : 'size-4.5',
          checked ? (size === 'sm' ? 'translate-x-[15px]' : 'translate-x-[17px]') : 'translate-x-[1.5px]',
        )}
      />
    </button>
  )
}

export function Checkbox({ checked, onChange, label, description, disabled, className }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; description?: ReactNode; disabled?: boolean; className?: string }) {
  const id = useId()
  return (
    <label htmlFor={id} className={cn('group flex cursor-pointer items-start gap-2.5', disabled && 'cursor-not-allowed opacity-60', className)}>
      <span className="relative mt-0.5 inline-flex">
        <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="grid size-4 place-items-center rounded-[5px] border border-line-strong bg-surface transition-colors peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:ring-3 peer-focus-visible:ring-accent/25">
          <svg viewBox="0 0 12 12" className={cn('size-2.5 text-white transition-opacity', checked ? 'opacity-100' : 'opacity-0')} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 6.5 5 9l4.5-6" />
          </svg>
        </span>
      </span>
      {(label || description) && (
        <span className="flex flex-col">
          {label && <span className="text-[13px] text-fg">{label}</span>}
          {description && <span className="text-xs text-fg-3">{description}</span>}
        </span>
      )}
    </label>
  )
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('mono-label', className)}>{children}</span>
}
