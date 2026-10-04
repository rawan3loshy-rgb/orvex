import type { LucideIcon } from 'lucide-react'
import { BadgeCheck, Building, CloudDownload, CodeXml, Globe, KeyRound, Languages, Mail, Palette, Server, ShieldCheck, Users, Webhook } from 'lucide-react'

export type SettingsTabId = 'general' | 'security' | 'users' | 'roles' | 'api' | 'email' | 'webhooks' | 'localization' | 'branding' | 'website' | 'system' | 'updates' | 'license'

export interface SettingsTab {
  id: SettingsTabId
  label: string
  icon: LucideIcon
  group: string
  description: string
}

export const SETTINGS_TABS: SettingsTab[] = [
  { id: 'general', label: 'General', icon: Building, group: 'Workspace', description: 'Business details, support contact, timezone, currency and order numbering.' },
  { id: 'security', label: 'Security', icon: ShieldCheck, group: 'Access', description: 'Authentication, sessions, admin network access and audit retention.' },
  { id: 'users', label: 'Users', icon: Users, group: 'Access', description: 'People who can sign in to this installation’s admin.' },
  { id: 'roles', label: 'Roles', icon: KeyRound, group: 'Access', description: 'What each role can read and change.' },
  { id: 'api', label: 'API', icon: CodeXml, group: 'Integrations', description: 'Reseller API defaults: base URL, rate limits, idempotency and sandbox keys.' },
  { id: 'email', label: 'Email', icon: Mail, group: 'Integrations', description: 'Sender and delivery for order receipts, unlock results and reseller statements.' },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook, group: 'Integrations', description: 'Signing, retries and timeouts for order events sent to resellers.' },
  { id: 'localization', label: 'Localization', icon: Languages, group: 'Appearance', description: 'Language, date and number formats for the admin, emails and statements.' },
  { id: 'branding', label: 'Branding', icon: Palette, group: 'Appearance', description: 'Your brand on the admin, emails and reseller statements.' },
  { id: 'website', label: 'Website', icon: Globe, group: 'Appearance', description: 'Public website, domains and TLS.' },
  { id: 'system', label: 'System', icon: Server, group: 'Installation', description: 'Database, hosting, containers and environment — this installation’s infrastructure.' },
  { id: 'updates', label: 'Updates', icon: CloudDownload, group: 'Installation', description: 'Release channel, update checks and maintenance window.' },
  { id: 'license', label: 'License', icon: BadgeCheck, group: 'Installation', description: 'Plan, validity and validation status.' },
]

export const isTab = (v: string | null): v is SettingsTabId => !!v && SETTINGS_TABS.some((t) => t.id === v)
