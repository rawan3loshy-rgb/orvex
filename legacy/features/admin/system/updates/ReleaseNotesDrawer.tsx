import { ArrowRight, BadgeCheck, CircleCheck, DatabaseZap, FileKey, Package, TriangleAlert } from 'lucide-react'
import { Badge, Button, CopyButton, DescriptionList, Drawer, SectionTitle } from '@/components/ui'
import { cn } from '@/lib/cn'
import { date } from '@/lib/format'
import type { Release } from '@/types/release'
import { mb, migrationName, NOTE_META, NOTE_ORDER, packageFile, splitNote, TONE_TILE } from './lib'

export function ReleaseNotesDrawer({ release, currentVersion, onClose, onInstall }: { release: Release | null; currentVersion?: string; onClose: () => void; onInstall?: () => void }) {
  const isCurrent = release && currentVersion === release.version
  return (
    <Drawer
      open={!!release}
      onClose={onClose}
      width="lg"
      icon={<Package />}
      title={release ? `ORVEX Core ${release.version}` : ''}
      description={release ? `${release.title} · released ${date(release.releasedAt)}` : undefined}
      footer={
        release && (
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            {onInstall && !isCurrent && (
              <Button variant="accent" onClick={onInstall}>
                Backup & Update
              </Button>
            )}
          </>
        )
      }
    >
      {release && (
        <div className="space-y-7">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={release.channel === 'stable' ? 'success' : 'warning'} dot>
                {release.channel === 'stable' ? 'Stable' : 'Beta'}
              </Badge>
              {isCurrent && <Badge tone="success">Installed</Badge>}
              {release.breaking ? <Badge tone="danger">Breaking changes</Badge> : <Badge tone="neutral">No breaking changes</Badge>}
              {release.requiresBackup && <Badge tone="neutral">Backup required</Badge>}
            </div>
            <p className="mt-3 text-[13.5px] leading-relaxed text-fg-2">{release.summary}</p>
          </div>

          <div className="space-y-5">
            {NOTE_ORDER.map((type) => {
              const notes = release.notes.filter((n) => n.type === type)
              if (!notes.length) return null
              const meta = NOTE_META[type]
              return (
                <div key={type}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className={cn('grid size-6 place-items-center rounded-md [&_svg]:size-3.5', TONE_TILE[meta.tone])}>
                      <meta.icon />
                    </span>
                    <h3 className="text-[13px] font-semibold text-fg">{meta.plural}</h3>
                    <span className="font-mono text-[11px] text-fg-3">{notes.length}</span>
                  </div>
                  <ul className="space-y-1.5 pl-8">
                    {notes.map((n) => {
                      const { headline, detail } = splitNote(n.text)
                      return (
                        <li key={n.text} className="relative text-[13px] leading-relaxed text-fg-2 before:absolute before:top-[9px] before:-left-3.5 before:size-1 before:rounded-full before:bg-fg-3">
                          <span className="font-medium text-fg">{headline}</span>
                          {detail && <span className="text-fg-2"> — {detail}</span>}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>

          {release.migration && (
            <div>
              <SectionTitle title={`Database migration ${release.migration.from} → ${release.migration.to}`} description="Runs inside a transaction after the pre-update backup. Rolled back automatically if any step fails." />
              <div className="overflow-hidden rounded-xl border border-line">
                <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-3.5 py-2.5">
                  <DatabaseZap className="size-3.5 text-accent-ink" />
                  <span className="font-mono text-[12px] text-fg">{migrationName(release.migration.to, release.migration.steps[0] ?? 'schema', 0)}</span>
                </div>
                <ol>
                  {release.migration.steps.map((s, i) => (
                    <li key={s} className="flex items-center gap-3 border-b border-line px-3.5 py-2.5 text-[12.5px] last:border-b-0">
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface-3 font-mono text-[10px] text-fg-2">{i + 1}</span>
                      <span className="font-mono text-[12px] text-fg-2">{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          <div>
            <SectionTitle title="Compatibility" />
            <DescriptionList
              columns={2}
              items={[
                { label: 'Upgrade from', value: `≥ ${release.minUpgradeFrom}`, mono: true },
                { label: 'Node.js', value: release.compatibility.node, mono: true },
                { label: 'PostgreSQL', value: release.compatibility.postgres, mono: true },
                { label: 'Docker', value: release.compatibility.docker, mono: true },
              ]}
            />
          </div>

          <div>
            <SectionTitle title="Package & signature" description="Verified on your server before anything is installed." />
            <div className="rounded-xl border border-line bg-bg-subtle/60 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[12.5px] text-fg">{packageFile(release)}</span>
                <span className="text-[12px] text-fg-3">· {mb(release.package.sizeBytes)}</span>
              </div>
              <dl className="mt-3 space-y-2 text-[12.5px]">
                <SigRow label="SHA-256" value={release.package.sha256} />
                <SigRow label="Signature" value={release.package.signature} />
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-fg-3">Signed by</dt>
                  <dd className="flex items-center gap-1.5 text-fg">
                    <BadgeCheck className="size-3.5 text-success" />
                    {release.package.signedBy}
                  </dd>
                </div>
              </dl>
              <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-[12px] text-fg-3">
                <FileKey className="size-3.5" />
                The ORVEX Systems Ed25519 public key is bundled with Core — verification never depends on the license server.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-line p-3.5 text-[12.5px] text-fg-2">
            {release.requiresBackup ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" /> : <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />}
            <p>
              Update order: Backup <ArrowRight className="inline size-3" /> Download <ArrowRight className="inline size-3" /> Verify <ArrowRight className="inline size-3" /> Install <ArrowRight className="inline size-3" /> Migrate <ArrowRight className="inline size-3" /> Restart <ArrowRight className="inline size-3" /> Health check. A failed health check restores the backup automatically.
            </p>
          </div>
        </div>
      )}
    </Drawer>
  )
}

function SigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-fg-3">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1 font-mono text-[12px] text-fg">
        <span className="truncate">{value}</span>
        <CopyButton value={value} />
      </dd>
    </div>
  )
}
