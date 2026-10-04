import { useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { CircleCheck, CircleX, ClipboardCheck, LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react'
import { Button, Card, CardHeader, EmptyState, Skeleton, StatusBadge, Tooltip } from '@/components/ui'
import { cn } from '@/lib/cn'
import { relative } from '@/lib/format'
import type { UpdateCenterState } from '@/types/installation'

type Check = UpdateCenterState['preflight'][number]

const ICON = { pass: CircleCheck, warn: TriangleAlert, fail: CircleX }
const COLOR = { pass: 'text-success', warn: 'text-warning', fail: 'text-danger' }

export interface IncompatibleExt {
  id: string
  name: string
  coreRange: string
  author: string
}

export function PreflightCard({ data, incompatible, onRerun }: { data: UpdateCenterState | undefined; incompatible: IncompatibleExt[]; onRerun: () => Promise<unknown> }) {
  const [running, setRunning] = useState(false)
  const [round, setRound] = useState(0)
  const checks = data?.preflight ?? []
  const pass = checks.filter((c) => c.status === 'pass').length
  const warn = checks.filter((c) => c.status === 'warn').length
  const fail = checks.filter((c) => c.status === 'fail').length

  const rerun = async () => {
    setRunning(true)
    await Promise.all([onRerun(), new Promise((r) => setTimeout(r, 300 + checks.length * 160))])
    setRunning(false)
    setRound((x) => x + 1)
  }

  return (
    <Card className="h-full">
      <CardHeader
        icon={<ClipboardCheck />}
        title="Pre-flight checks"
        description={data?.available ? `For ${data.currentVersion} → ${data.available.version} · last run ${relative(data.lastCheckedAt)}` : 'Run automatically before every update'}
        actions={
          data?.available && (
            <Button variant="ghost" size="sm" onClick={rerun} disabled={running} leading={<RefreshCw className={cn(running && 'animate-spin')} />}>
              Re-run
            </Button>
          )
        }
      />
      {!data ? (
        <div className="space-y-3 px-5 pb-5">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-4 rounded-full" />
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="ml-auto h-3.5 w-24" />
            </div>
          ))}
        </div>
      ) : !data.available ? (
        <EmptyState compact icon={<ClipboardCheck />} title="No pending update" description="When a new release is available, Core checks the upgrade path, entitlement, disk space, PostgreSQL & runtime versions, extension compatibility and backups before you can start." />
      ) : (
        <>
          <div className="px-5 pb-3">
            <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
              {checks.map((c) => (
                <span key={c.id} className={cn('flex-1', c.status === 'pass' ? 'bg-success/80' : c.status === 'warn' ? 'bg-warning' : 'bg-danger')} />
              ))}
            </div>
            <p className="mt-2 text-[12px] text-fg-3">
              <span className="text-success">{pass} passed</span>
              {warn > 0 && <span className="text-warning"> · {warn} warning</span>}
              {fail > 0 && <span className="text-danger"> · {fail} blocking</span>}
              {fail === 0 && <span> · ready to update</span>}
            </p>
          </div>
          <ul className="border-t border-line">
            {checks.map((c, i) => (
              <CheckRow key={c.id} c={c} i={i} running={running} round={round} incompatible={incompatible} next={data.available?.version ?? ''} />
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}

function CheckRow({ c, i, running, round, incompatible, next }: { c: Check; i: number; running: boolean; round: number; incompatible: IncompatibleExt[]; next: string }) {
  const Icon = ICON[c.status]
  const isExt = c.id === 'extensions'
  return (
    <li className={cn('border-b border-line px-5 py-3 last:border-b-0', c.status === 'warn' && !running && 'bg-warning/[0.04]')}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-4 shrink-0 place-items-center">
          <AnimatePresence mode="wait" initial={false}>
            {running ? (
              <motion.span key="r" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <LoaderCircle className="size-4 animate-spin text-fg-3" />
              </motion.span>
            ) : (
              <motion.span key={`d${round}`} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: round ? i * 0.08 : 0, type: 'spring', stiffness: 480, damping: 24 }}>
                <Icon className={cn('size-4', COLOR[c.status])} />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="text-[13px] font-medium text-fg">{c.label}</p>
            {c.status !== 'pass' && <StatusBadge status={c.status} />}
          </div>
          <p className="mt-0.5 text-[12.5px] text-fg-3">{c.detail}</p>
          {isExt && c.status === 'warn' && !running && (
            <div className="mt-2.5 rounded-lg border border-warning/25 bg-surface p-3 text-[12.5px] text-fg-2">
              <p>
                <span className="font-medium text-fg">Why this is a warning, not a blocker:</span> every extension declares the Core versions it supports.{' '}
                {incompatible.length ? (
                  <>
                    {incompatible.map((e, k) => (
                      <span key={e.id}>
                        {k > 0 && ', '}
                        <span className="font-medium text-fg">{e.name}</span> pins <span className="font-mono text-[12px]">{e.coreRange}</span>
                      </span>
                    ))}
                    , which excludes {next}.{' '}
                  </>
                ) : null}
                Core disables it during the update instead of loading untested code — your other extensions, data and configuration are untouched, and behaviour falls back to standard Core rules until a compatible version is installed.
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                <Link to="/admin/system/extensions" className="font-medium text-accent-ink hover:underline">
                  Review extension →
                </Link>
                <Tooltip content={`Custom extensions are maintained by their author${incompatible[0] ? ` (${incompatible[0].author})` : ''}. Publishing a version that declares ${next} re-enables it.`}>
                  <span className="cursor-help text-fg-3 underline decoration-dotted underline-offset-2">Who fixes it?</span>
                </Tooltip>
              </div>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}
