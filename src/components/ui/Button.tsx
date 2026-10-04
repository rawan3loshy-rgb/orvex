import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

const base =
  'relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium select-none transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-150 ease-out disabled:opacity-50 disabled:pointer-events-none active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent/70'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-fg text-bg hover:bg-fg/86 shadow-[0_1px_0_rgb(255_255_255/0.1)_inset,0_1px_2px_rgb(0_0_0/0.18)]',
  accent: 'bg-accent text-accent-fg hover:bg-[color-mix(in_oklab,var(--accent)_90%,#000)] shadow-[0_1px_0_rgb(255_255_255/0.22)_inset,0_1px_2px_rgb(120_30_10/0.25),0_0_0_1px_rgb(200_60_30/0.25)]',
  secondary: 'bg-surface text-fg border border-line hover:bg-surface-2 hover:border-line-strong shadow-card',
  outline: 'border border-line-strong text-fg hover:bg-surface-2',
  ghost: 'text-fg-2 hover:text-fg hover:bg-surface-2',
  danger: 'bg-danger text-white hover:bg-danger/90 shadow-[0_1px_0_rgb(255_255_255/0.15)_inset]',
  link: 'text-accent-ink hover:underline underline-offset-4 px-0! h-auto!',
}

const sizes: Record<ButtonSize, string> = {
  xs: 'h-6 px-2 text-xs rounded-md [&_svg]:size-3.5',
  sm: 'h-7.5 px-2.5 text-[13px] rounded-md [&_svg]:size-3.5',
  md: 'h-9 px-3.5 text-[13.5px] rounded-lg [&_svg]:size-4',
  lg: 'h-11 px-5 text-[15px] rounded-[10px] [&_svg]:size-4.5',
}

const iconSizes: Record<ButtonSize, string> = {
  xs: 'w-6 px-0',
  sm: 'w-7.5 px-0',
  md: 'w-9 px-0',
  lg: 'w-11 px-0',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: boolean
  leading?: ReactNode
  trailing?: ReactNode
  /** Render as a router link. */
  to?: string
  /** Render as an external anchor. */
  href?: string
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, leading, trailing, className, children, to, href, disabled, ...rest },
  ref,
) {
  const cls = cn(base, variants[variant], sizes[size], icon && iconSizes[size], className)
  const content = (
    <>
      {loading ? <Loader2 className="animate-spin" /> : leading}
      {children}
      {trailing}
    </>
  )
  if (to) {
    return (
      <Link to={to} className={cls} aria-disabled={disabled}>
        {content}
      </Link>
    )
  }
  if (href) {
    return (
      <a href={href} className={cls} target="_blank" rel="noreferrer">
        {content}
      </a>
    )
  }
  return (
    <button ref={ref} className={cls} disabled={disabled || loading} {...rest}>
      {content}
    </button>
  )
})
