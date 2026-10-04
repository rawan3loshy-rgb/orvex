import { useCallback, useRef, useState, type ComponentType } from 'react'
import { useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { Settings } from 'lucide-react'
import { ConfirmDialog, PageHeader } from '@/components/ui'
import { DirtyContext } from './settings/form'
import { SettingsNav } from './settings/SettingsNav'
import { isTab, SETTINGS_TABS, type SettingsTabId } from './settings/tabs'
import { GeneralTab } from './settings/GeneralTab'
import { SecurityTab } from './settings/SecurityTab'
import { UsersTab } from './settings/UsersTab'
import { RolesTab } from './settings/RolesTab'
import { ApiTab } from './settings/ApiTab'
import { EmailTab } from './settings/EmailTab'
import { WebhooksTab } from './settings/WebhooksTab'
import { LocalizationTab } from './settings/LocalizationTab'
import { BrandingTab } from './settings/BrandingTab'
import { WebsiteTab } from './settings/WebsiteTab'
import { SystemTab } from './settings/SystemTab'
import { UpdatesTab } from './settings/UpdatesTab'
import { LicenseTab } from './settings/LicenseTab'

const CONTENT: Record<SettingsTabId, ComponentType> = {
  general: GeneralTab,
  security: SecurityTab,
  users: UsersTab,
  roles: RolesTab,
  api: ApiTab,
  email: EmailTab,
  webhooks: WebhooksTab,
  localization: LocalizationTab,
  branding: BrandingTab,
  website: WebsiteTab,
  system: SystemTab,
  updates: UpdatesTab,
  license: LicenseTab,
}

export default function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab: SettingsTabId = isTab(raw) ? raw : 'general'
  const meta = SETTINGS_TABS.find((t) => t.id === tab)!
  const Content = CONTENT[tab]

  const dirtyRef = useRef(false)
  const reportDirty = useCallback((d: boolean) => {
    dirtyRef.current = d
  }, [])
  const [pending, setPending] = useState<SettingsTabId | null>(null)

  const go = (t: SettingsTabId) => {
    if (t === tab) return
    if (dirtyRef.current) {
      setPending(t)
      return
    }
    navigateTo(t)
  }
  const navigateTo = (t: SettingsTabId) => {
    dirtyRef.current = false
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        n.set('tab', t)
        return n
      },
      { replace: false },
    )
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div>
      <PageHeader icon={<Settings />} title="Settings" description="Configuration of this ORVEX Core installation — stored in your own PostgreSQL database, never on ORVEX Systems servers." />

      <div className="lg:grid lg:grid-cols-[208px_minmax(0,1fr)] lg:gap-10">
        <SettingsNav value={tab} onChange={go} />

        <div className="min-w-0">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-surface text-fg-2 shadow-card">
              <meta.icon className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-fg">{meta.label}</h2>
              <p className="text-[13px] text-fg-3">{meta.description}</p>
            </div>
          </div>

          <DirtyContext.Provider value={reportDirty}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}>
                <Content />
              </motion.div>
            </AnimatePresence>
          </DirtyContext.Provider>
        </div>
      </div>

      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        onConfirm={() => {
          const t = pending
          setPending(null)
          if (t) navigateTo(t)
        }}
        title="Discard unsaved changes?"
        description={`You have unsaved changes in ${meta.label}. Leaving this section discards them.`}
        confirmLabel="Discard & continue"
        tone="danger"
      />
    </div>
  )
}
