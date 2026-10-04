import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/cn'

type Placement = 'top' | 'bottom' | 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' | 'right' | 'left'

function position(anchor: DOMRect, el: { width: number; height: number }, placement: Placement, gap = 6) {
  let top = 0
  let left = 0
  switch (placement) {
    case 'top':
      top = anchor.top - el.height - gap
      left = anchor.left + anchor.width / 2 - el.width / 2
      break
    case 'top-start':
      top = anchor.top - el.height - gap
      left = anchor.left
      break
    case 'top-end':
      top = anchor.top - el.height - gap
      left = anchor.right - el.width
      break
    case 'bottom':
      top = anchor.bottom + gap
      left = anchor.left + anchor.width / 2 - el.width / 2
      break
    case 'bottom-start':
      top = anchor.bottom + gap
      left = anchor.left
      break
    case 'bottom-end':
      top = anchor.bottom + gap
      left = anchor.right - el.width
      break
    case 'right':
      top = anchor.top + anchor.height / 2 - el.height / 2
      left = anchor.right + gap
      break
    case 'left':
      top = anchor.top + anchor.height / 2 - el.height / 2
      left = anchor.left - el.width - gap
      break
  }
  const vw = window.innerWidth
  const vh = window.innerHeight
  left = Math.max(8, Math.min(left, vw - el.width - 8))
  if (top + el.height > vh - 8) top = Math.max(8, anchor.top - el.height - gap)
  top = Math.max(8, top)
  return { top, left }
}

/** Hover tooltip rendered in a portal. */
export function Tooltip({ content, children, placement = 'top', className, delay = 120 }: { content: ReactNode; children: ReactNode; placement?: Placement; className?: string; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: -9999, left: -9999 })
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useLayoutEffect(() => {
    if (!open || !ref.current || !tipRef.current) return
    setPos(position(ref.current.getBoundingClientRect(), tipRef.current.getBoundingClientRect(), placement))
  }, [open, placement, content])

  if (!content) return <>{children}</>
  return (
    <span
      ref={ref}
      className={cn('inline-flex', className)}
      onMouseEnter={() => {
        timer.current = setTimeout(() => setOpen(true), delay)
      }}
      onMouseLeave={() => {
        clearTimeout(timer.current)
        setOpen(false)
      }}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open &&
        createPortal(
          <div ref={tipRef} role="tooltip" style={{ top: pos.top, left: pos.left }} className="pointer-events-none fixed z-[70] max-w-[280px] animate-fade-up rounded-md border border-line bg-surface-3 px-2 py-1 text-[12px] leading-snug text-fg shadow-pop [animation-duration:150ms]">
            {content}
          </div>,
          document.body,
        )}
    </span>
  )
}

/** Click-to-open floating panel anchored to its trigger. */
export function Popover({
  trigger,
  children,
  placement = 'bottom-start',
  className,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode
  children: ReactNode | ((close: () => void) => ReactNode)
  placement?: Placement
  className?: string
  open?: boolean
  onOpenChange?: (o: boolean) => void
}) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [uncontrolled, setUncontrolled] = useState(false)
  const open = controlledOpen ?? uncontrolled
  const setOpen = useCallback((o: boolean) => (onOpenChange ? onOpenChange(o) : setUncontrolled(o)), [onOpenChange])
  const [pos, setPos] = useState({ top: -9999, left: -9999 })

  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !panelRef.current) return
    const update = () => setPos(position(anchorRef.current!.getBoundingClientRect(), panelRef.current!.getBoundingClientRect(), placement))
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, placement])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node) || anchorRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, setOpen])

  const close = () => setOpen(false)
  return (
    <>
      <span ref={anchorRef} className="inline-flex">
        {trigger({ open, toggle: () => setOpen(!open) })}
      </span>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              style={{ top: pos.top, left: pos.left }}
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.1 } }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className={cn('fixed z-[65] min-w-[200px] rounded-xl border border-line bg-surface p-1 shadow-pop', className)}
            >
              {typeof children === 'function' ? children(close) : children}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

export function MenuItem({ icon, children, onClick, danger, shortcut, disabled, active }: { icon?: ReactNode; children: ReactNode; onClick?: () => void; danger?: boolean; shortcut?: string; disabled?: boolean; active?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors disabled:opacity-40 [&_svg]:size-4',
        danger ? 'text-danger hover:bg-danger/10' : 'text-fg hover:bg-surface-2',
        active && 'bg-surface-2',
      )}
    >
      {icon && <span className={cn('shrink-0', danger ? 'text-danger' : 'text-fg-3')}>{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
      {shortcut && <kbd className="font-mono text-[10.5px] text-fg-3">{shortcut}</kbd>}
    </button>
  )
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pt-2 pb-1 mono-label">{children}</div>
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-line" />
}
