import { CloudDownload, DatabaseBackup, DatabaseZap, FileKey, HeartPulse, Package, RotateCcw, RotateCw } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui'
import { motion } from 'motion/react'

const STAGES = [
  { icon: DatabaseBackup, title: 'Backup', text: 'pg_dump of orders, results and ledgers + config snapshot — always.' },
  { icon: CloudDownload, title: 'Download', text: 'Signed release package from releases.orvex.io.' },
  { icon: FileKey, title: 'Verify signature', text: 'SHA-256 + Ed25519 against the ORVEX Systems key bundled with Core.' },
  { icon: Package, title: 'Install', text: 'Unpacked side by side; the previous release is kept.' },
  { icon: DatabaseZap, title: 'Run migrations', text: 'Transactional schema migrations on your PostgreSQL.' },
  { icon: RotateCw, title: 'Restart', text: 'core-api, core-worker, core-scheduler — supplier callbacks are buffered meanwhile.' },
  { icon: HeartPulse, title: 'Health check', text: 'Reseller API, database, order queue, webhooks and adapters must pass.' },
]

export function HowItWorks() {
  return (
    <Card className="h-full">
      <CardHeader title="How updates work" description="The same signed, standardised pipeline runs on every ORVEX Core installation." />
      <div className="px-5 pb-4">
        <ol className="relative">
          <span aria-hidden className="absolute top-3 bottom-3 left-[13px] w-px bg-line" />
          {STAGES.map((s, i) => (
            <motion.li key={s.title} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="relative flex items-start gap-3 py-1.5">
              <span className="relative z-[1] grid size-[27px] shrink-0 place-items-center rounded-full border border-line bg-surface text-fg-2 [&_svg]:size-3.5">
                <s.icon />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-[13px] font-medium text-fg">
                  <span className="mr-1.5 font-mono text-[10.5px] text-fg-3">{i + 1}</span>
                  {s.title}
                </p>
                <p className="text-[12px] text-fg-3">{s.text}</p>
              </div>
            </motion.li>
          ))}
        </ol>
        <div className="mt-3 flex items-start gap-3 rounded-xl border border-line bg-surface-2/50 p-3">
          <RotateCcw className="mt-0.5 size-4 shrink-0 text-fg-2" />
          <p className="text-[12.5px] text-fg-2">
            <span className="font-medium text-fg">Automatic rollback.</span> If the post-update health check fails, Core restores the pre-update backup and the previous images — your installation returns to the last working version without manual steps.
          </p>
        </div>
      </div>
    </Card>
  )
}
