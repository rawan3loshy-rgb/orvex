/**
 * Publishing toolbar shown on every storefront editor screen.
 *
 *   edit (local) → Save draft → Preview → Publish
 *
 * Edits on a screen stay local until "Save draft", which writes the DRAFT
 * revision and never touches the live site. Preview renders the saved draft on
 * the real storefront through an admin-only token. Publish promotes the saved
 * draft to the live site in one step. Catalog data (prices, availability) is
 * never part of a publish — the storefront always reads it live.
 */
import { useState } from 'react'
import { ExternalLink, Eye, Rocket, Save, Trash2, TriangleAlert, Undo2 } from 'lucide-react'
import { useInstMutation, useStorefrontAdmin } from '@/hooks/installation'
import { storefrontAdminService } from '@/services/installation'
import { Guarded } from '@/components/domain'
import { Badge, Button, Card, ConfirmDialog } from '@/components/ui'
import { relative } from '@/lib/format'
import { SITE_URL } from './editorUtils'

export function PublishBar({
  dirty = false,
  onSaveDraft,
  onRevert,
  saving,
  saveBlockedReason,
}: {
  /** The screen has local edits that are not in the saved draft yet. */
  dirty?: boolean
  /** Screens with editable content pass their save; read-only screens omit it. */
  onSaveDraft?: () => void
  onRevert?: () => void
  saving?: boolean
  /** Validation message that prevents saving (shown instead of the hint). */
  saveBlockedReason?: string
}) {
  const q = useStorefrontAdmin()
  const [confirmPublish, setConfirmPublish] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const publish = useInstMutation(storefrontAdminService.publish, {
    success: (v) => `Published v${v.publishing.published.version} — ${SITE_URL} now shows the new version`,
    onSettled: () => setConfirmPublish(false),
  })
  const discard = useInstMutation(storefrontAdminService.discardDraft, { success: 'Draft discarded — it matches the live site again', onSettled: () => setConfirmDiscard(false) })

  if (!q.data) return null
  const { draft, published, hasUnpublishedChanges, changes, blockers, previewPath } = q.data.publishing
  const canPreview = !dirty && !!previewPath
  const canPublish = !dirty && hasUnpublishedChanges && blockers.length === 0

  return (
    <>
      <Card className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3">
          <div className="grid min-w-0 gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mono-label">Status</span>
              <Badge tone={hasUnpublishedChanges ? 'warning' : 'neutral'} dot>
                Draft v{draft.version}
              </Badge>
              {dirty && <Badge tone="accent">Unsaved changes</Badge>}
              <span className="text-[12.5px] text-fg-2">{hasUnpublishedChanges ? `${changes.length} unpublished change${changes.length === 1 ? '' : 's'}` : 'Draft matches the live site'}</span>
            </div>
            <div className="text-[12px] text-fg-3">
              Draft saved {relative(draft.updatedAt)}
              {draft.updatedBy ? ` by ${draft.updatedBy}` : ''} · Last published: <span className="font-medium text-fg-2">v{published.version}</span> · {relative(published.publishedAt)}
              {published.publishedBy ? ` by ${published.publishedBy}` : ''}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {dirty && onRevert && (
              <Button size="sm" variant="ghost" leading={<Undo2 />} onClick={onRevert}>
                Revert edits
              </Button>
            )}
            {!dirty && hasUnpublishedChanges && (
              <Guarded permission="storefront.manage">
                {(ok) => (
                  <Button size="sm" variant="ghost" leading={<Trash2 />} disabled={!ok} onClick={() => setConfirmDiscard(true)}>
                    Discard draft
                  </Button>
                )}
              </Guarded>
            )}
            <Button size="sm" variant="ghost" href={SITE_URL} leading={<ExternalLink />}>
              Live site
            </Button>
            {onSaveDraft && (
              <Guarded permission="storefront.manage">
                {(ok) => (
                  <Button size="sm" variant="secondary" leading={<Save />} disabled={!ok || !dirty || !!saveBlockedReason} loading={saving} onClick={onSaveDraft}>
                    Save draft
                  </Button>
                )}
              </Guarded>
            )}
            <Button size="sm" variant="secondary" leading={<Eye />} href={canPreview ? previewPath : undefined} disabled={!canPreview} title={dirty ? 'Save the draft first — preview shows the saved draft' : undefined}>
              Preview
            </Button>
            <Guarded permission="storefront.manage">
              {(ok) => (
                <Button size="sm" variant="accent" leading={<Rocket />} disabled={!ok || !canPublish} onClick={() => setConfirmPublish(true)}>
                  Publish
                </Button>
              )}
            </Guarded>
          </div>
        </div>
        {(dirty || saveBlockedReason || blockers.length > 0) && (
          <div className="border-t border-line px-4 py-2.5 text-[12px]">
            {saveBlockedReason ? (
              <span className="flex items-start gap-1.5 text-danger">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                {saveBlockedReason}
              </span>
            ) : dirty ? (
              <span className="text-fg-3">Save the draft to preview or publish these edits. Saving a draft never changes the live site.</span>
            ) : (
              <span className="flex items-start gap-1.5 text-danger">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                Can’t publish yet: {blockers.join(' · ')}
              </span>
            )}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirmPublish}
        onClose={() => setConfirmPublish(false)}
        onConfirm={() => publish.mutate(draft.updatedAt)}
        loading={publish.isPending}
        title={`Publish draft v${draft.version}?`}
        description={`Visitors on ${q.data.domain.primary} will see this version immediately. v${published.version} stays in the publish history.`}
        confirmLabel={`Publish v${draft.version}`}
      >
        <ul className="grid gap-1.5 text-[13px]">
          {changes.map((c) => (
            <li key={`${c.kind}:${c.target}`} className="flex items-center gap-2">
              <Badge tone={c.kind === 'page_removed' ? 'danger' : c.kind === 'page_added' ? 'success' : 'warning'}>{c.kind === 'page_removed' ? 'removed' : c.kind === 'page_added' ? 'new' : 'edited'}</Badge>
              <span className="text-fg-2">{c.label}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] text-fg-3">Prices, availability and service fields are not part of this publish — the storefront always reads them live from the catalog.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        onConfirm={() => discard.mutate()}
        loading={discard.isPending}
        tone="danger"
        title={`Discard draft v${draft.version}?`}
        description={`All ${changes.length} unpublished change${changes.length === 1 ? '' : 's'} are thrown away and the draft is reset to the live version v${published.version}. Existing preview links stop working.`}
        confirmLabel="Discard draft"
      />
    </>
  )
}
