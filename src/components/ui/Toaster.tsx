import { AnimatePresence, motion } from 'motion/react'
import { CircleCheck, CircleX, Info, TriangleAlert, X } from 'lucide-react'
import { useToastStore } from '@/stores/toast'
import { cn } from '@/lib/cn'

const icons = {
  success: <CircleCheck className="size-4 text-success" />,
  error: <CircleX className="size-4 text-danger" />,
  info: <Info className="size-4 text-accent-ink" />,
  warning: <TriangleAlert className="size-4 text-warning" />,
}

export function Toaster() {
  const { toasts, dismiss } = useToastStore()
  return (
    <div className="pointer-events-none fixed right-4 bottom-16 z-[60] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 500, damping: 36 }}
            className={cn('pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-surface/95 p-3.5 shadow-pop backdrop-blur')}
          >
            <span className="mt-px">{icons[t.tone]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-fg">{t.title}</p>
              {t.description && <p className="mt-0.5 text-[12.5px] text-fg-3">{t.description}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className="rounded p-0.5 text-fg-3 hover:bg-surface-2 hover:text-fg" aria-label="Dismiss">
              <X className="size-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
