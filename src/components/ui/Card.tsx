import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Card({ className, interactive, ...rest }: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'relative rounded-xl border border-line bg-surface shadow-card',
        interactive && 'transition-[border-color,background-color,box-shadow] duration-200 hover:border-line-strong hover:shadow-pop cursor-pointer',
        className,
      )}
      {...rest}
    />
  )
}

export function CardHeader({
  title,
  description,
  actions,
  icon,
  className,
  children,
}: {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  icon?: ReactNode
  className?: string
  children?: ReactNode
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-4.5 pb-3', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-fg-2 [&_svg]:size-4">{icon}</div>}
        <div className="min-w-0">
          {title && <h3 className="truncate text-[14px] font-semibold tracking-[-0.01em] text-fg">{title}</h3>}
          {description && <p className="mt-0.5 text-[12.5px] text-fg-3">{description}</p>}
          {children}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  )
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pb-5', className)} {...rest} />
}

export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-[12.5px] text-fg-3', className)} {...rest} />
}

export function Divider({ className, vertical }: { className?: string; vertical?: boolean }) {
  return <div className={cn(vertical ? 'w-px self-stretch bg-line' : 'h-px w-full bg-line', className)} />
}
