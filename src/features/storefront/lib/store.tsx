/** Storefront context provider and the link component. Helpers and hooks live in ./storeContext. */
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { isExternal, StoreContext, type StoreCtx } from './storeContext'

export function StoreProvider({ value, children }: { value: StoreCtx; children: ReactNode }) {
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

/** Link that works for internal routes and external URLs alike. */
export function SfLink({ href, className, children, onClick, ...rest }: { href: string; className?: string; children: ReactNode; onClick?: () => void; 'aria-label'?: string; 'aria-current'?: 'page' | undefined }) {
  if (isExternal(href))
    return (
      <a href={href} className={className} onClick={onClick} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" {...rest}>
        {children}
      </a>
    )
  return (
    <Link to={href} className={className} onClick={onClick} {...rest}>
      {children}
    </Link>
  )
}
