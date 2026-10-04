import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from './Button'

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', h)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
}

const widths = { sm: 'sm:w-[420px]', md: 'sm:w-[560px]', lg: 'sm:w-[720px]', xl: 'sm:w-[920px]' }

export interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  footer?: ReactNode
  width?: keyof typeof widths
  children: ReactNode
  bodyClassName?: string
}

/** Right-side panel for details and forms. */
export function Drawer({ open, onClose, title, description, icon, actions, footer, width = 'md', children, bodyClassName }: DrawerProps) {
  useEscape(open, onClose)
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div className="absolute inset-0 bg-overlay backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            className={cn('absolute inset-y-0 right-0 flex w-full flex-col overflow-hidden border-l border-line bg-surface shadow-pop sm:inset-y-2 sm:right-2 sm:max-w-[calc(100vw-16px)] sm:rounded-2xl sm:border', widths[width])}
            initial={{ x: '100%', opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.6 }}
            transition={{ type: 'spring', stiffness: 380, damping: 40 }}
          >
            <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div className="flex min-w-0 items-start gap-3">
                {icon && <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-fg-2 [&_svg]:size-4.5">{icon}</div>}
                <div className="min-w-0">
                  {title && <h2 className="truncate text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>}
                  {description && <div className="mt-0.5 text-[12.5px] text-fg-3">{description}</div>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {actions}
                <Button variant="ghost" size="sm" icon onClick={onClose} aria-label="Close">
                  <X />
                </Button>
              </div>
            </header>
            <div className={cn('flex-1 overflow-y-auto px-5 py-5', bodyClassName)}>{children}</div>
            {footer && <footer className="flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</footer>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

const modalWidths = { sm: 'max-w-[400px]', md: 'max-w-[520px]', lg: 'max-w-[680px]', xl: 'max-w-[880px]' }

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  icon?: ReactNode
  footer?: ReactNode
  size?: keyof typeof modalWidths
  children?: ReactNode
  className?: string
  hideClose?: boolean
}

export function Modal({ open, onClose, title, description, icon, footer, size = 'md', children, className, hideClose }: ModalProps) {
  useEscape(open, onClose)
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
          <motion.div className="absolute inset-0 bg-overlay backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={cn('relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-pop sm:rounded-2xl', modalWidths[size], className)}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            {(title || !hideClose) && (
              <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-1">
                <div className="flex min-w-0 items-start gap-3">
                  {icon && <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-fg-2 [&_svg]:size-4.5">{icon}</div>}
                  <div className="min-w-0">
                    {title && <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>}
                    {description && <div className="mt-1 text-[13px] text-fg-3">{description}</div>}
                  </div>
                </div>
                {!hideClose && (
                  <Button variant="ghost" size="sm" icon onClick={onClose} aria-label="Close" className="-mt-1 -mr-1">
                    <X />
                  </Button>
                )}
              </header>
            )}
            <div className="overflow-y-auto px-5 py-4">{children}</div>
            {footer && <footer className="flex items-center justify-end gap-2 border-t border-line bg-surface-2/50 px-5 py-3.5">{footer}</footer>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'default',
  loading,
  children,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: ReactNode
  description?: ReactNode
  confirmLabel?: string
  tone?: 'default' | 'danger'
  loading?: boolean
  children?: ReactNode
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  )
}
