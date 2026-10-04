import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, CircleCheck, CloudOff, FileKey, Globe, LoaderCircle, RefreshCw } from 'lucide-react'
import { Badge, Button, Card, CardHeader, CopyButton, Skeleton } from '@/components/ui'
import { useInstMutation } from '@/hooks/installation'
import { systemService } from '@/services/installation'
import { cn } from '@/lib/cn'
import { date, dateTime, relative } from '@/lib/format'
import type { InstallationLicense } from '@/types/installation'
import { useNow } from '../health/useNow'

type Phase = 'idle' | 'local' | 'remote' | 'done'

const PHASES: { id: Exclude<Phase, 'idle'>; label: string; icon: typeof FileKey }[] = [
  { id: 'local', label: 'Verify signed license file locally', icon: FileKey },
  { id: 'remote', label: 'Check in with license server', icon: Globe },
  { id: 'done', label: 'Refresh 14-day validation cache', icon: CircleCheck },
]

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function ValidationPanel({ license }: { license: InstallationLicense | undefined }) {
  useNow(15_000)
  const [phase, setPhase] = useState<Phase>('idle')
  const validate = useInstMutation(() => systemService.validateLicense(), { success: 'License validated', error: 'License server unreachable — cached validation still valid' })

  const run = async () => {
    if (phase !== 'idle') return
    setPhase('local')
    await wait(700)
    setPhase('remote')
    try {
      await Promise.all([validate.mutateAsync(), wait(900)])
      setPhase('done')
      await wait(2200)
    } catch {
      /* error toast handled by the mutation */
    }
    setPhase('idle')
  }

  if (!license) {
    return (
      <Card className="h-full p-5">
        <Skeleton className="h-4 w-32" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </Card>
    )
  }

  const v = license.validation
  const online = v.mode === 'online'
  const busy = phase !== 'idle'
  const phaseIndex = phase === 'idle' ? -1 : PHASES.findIndex((p) => p.id === phase)

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Validation"
        description="Signed license, verified on this server"
        actions={
          <Badge tone={online ? 'success' : 'warning'} dot pulse={online} size="md" icon={online ? undefined : <CloudOff />}>
            {online ? 'Online' : 'Cached'}
          </Badge>
        }
      />
      <div className="flex-1 px-5">
        <AnimatePresence mode="wait" initial={false}>
          {busy ? (
            <motion.ol key="run" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="space-y-2.5 rounded-xl border border-line bg-surface-2/50 p-4">
              {PHASES.map((p, i) => {
                const state = phaseIndex > i || phase === 'done' ? 'done' : phaseIndex === i ? 'active' : 'pending'
                return (
                  <li key={p.id} className="flex items-center gap-3">
                    <span className={cn('grid size-6 shrink-0 place-items-center rounded-full ring-1', state === 'done' ? 'bg-success/15 text-success ring-success/30' : state === 'active' ? 'bg-accent/15 text-accent-ink ring-accent/30' : 'bg-surface text-fg-3 ring-line')}>
                      {state === 'done' ? (
                        <motion.span initial={{ scale: 0.3 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }}>
                          <Check className="size-3.5" strokeWidth={3} />
                        </motion.span>
                      ) : state === 'active' ? (
                        <LoaderCircle className="size-3.5 animate-spin" />
                      ) : (
                        <p.icon className="size-3.5" />
                      )}
                    </span>
                    <span className={cn('text-[13px]', state === 'pending' ? 'text-fg-3' : 'text-fg')}>{p.label}</span>
                  </li>
                )
              })}
              <AnimatePresence>
                {phase === 'done' && (
                  <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-1 text-[12px] text-success">
                    Valid · cache extended to {date(v.cacheValidUntil)}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.ol>
          ) : (
            <motion.dl key="facts" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="divide-y divide-line">
              <Row label="Mode" value={online ? 'Online validation' : 'Cached (offline)'} />
              <Row label="Last validated" value={relative(v.lastValidatedAt)} hint={dateTime(v.lastValidatedAt)} />
              <Row label="Next validation" value={relative(v.nextValidationAt)} />
              <Row label="Grace period" value={`${v.gracePeriodDays} days`} />
              <Row label="Cache valid until" value={date(v.cacheValidUntil)} />
              <Row label="Signature" value={<span className="font-mono text-[12px]">{v.signature}</span>} copy={v.signature} />
              <Row label="License server" value={<span className="font-mono text-[12px]">{v.licenseServer.replace('https://', '')}</span>} copy={v.licenseServer} />
            </motion.dl>
          )}
        </AnimatePresence>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line px-5 py-3.5">
        <span className="text-[12px] text-fg-3">Validation runs automatically every 24 h.</span>
        <Button variant="primary" size="sm" onClick={run} disabled={busy} leading={<RefreshCw className={cn(busy && phase !== 'done' && 'animate-spin')} />}>
          {phase === 'done' ? 'Validated' : busy ? 'Validating…' : 'Validate now'}
        </Button>
      </div>
    </Card>
  )
}

function Row({ label, value, hint, copy }: { label: string; value: ReactNode; hint?: string; copy?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-[12.5px] text-fg-3">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1 text-right text-[13px] text-fg">
        <span className="min-w-0 truncate" title={hint}>
          {value}
        </span>
        {copy && <CopyButton value={copy} />}
      </dd>
    </div>
  )
}
