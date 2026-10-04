/**
 * System module: installation identity, licensing, updates, health, settings.
 *
 * Licensing principle: an expired update entitlement never stops operations.
 * The installation keeps running on the version it has; only new releases
 * become unavailable until the entitlement is renewed.
 */
import type { ISODate } from './common'
import type { InstalledExtension } from '@/types/extensions'
import type { Release } from '@/types/release'

export interface InstallationInfo {
  installationId: string
  name: string
  orgName: string
  domain: string
  environment: 'production' | 'staging'
  deployment: 'self_hosted' | 'managed_dedicated'
  version: string
  schemaVersion: string
  installedAt: ISODate
  database: {
    engine: 'PostgreSQL'
    version: string
    provider: string
    hostMasked: string
    name: string
    sslMode: 'require' | 'verify-full' | 'disable'
    status: 'connected' | 'error'
    latencyMs: number
    pool: { active: number; idle: number; max: number }
    sizeMb: number
    tables: number
    lastBackupAt: ISODate
  }
  runtime: {
    platform: string
    node: string
    os: string
    proxy: string
    cpuCores: number
    memoryMb: number
    containers: { name: string; image: string; status: 'running' | 'restarting' | 'stopped'; uptime: string }[]
  }
  queue: { driver: string; workers: number }
  storage: { driver: string; usedGb: number; totalGb: number }
  env: { key: string; value: string; secret: boolean }[]
  extensions: InstalledExtension[]
}

export type LicenseStatus = 'active' | 'updates_expired' | 'grace' | 'invalid'

export interface InstallationLicense {
  licenseId: string
  licenseKeyMasked: string
  installationId: string
  plan: string
  customer: string
  status: LicenseStatus
  domain: string
  issuedAt: ISODate
  activatedAt: ISODate
  /** The license to run the installed version does not expire. */
  perpetualUse: boolean
  licensedMajor: string
  updatesUntil: ISODate
  supportUntil: ISODate
  entitlements: { id: string; name: string; included: boolean }[]
  limits: { label: string; value: string }[]
  validation: {
    mode: 'online' | 'cached'
    lastValidatedAt: ISODate
    nextValidationAt: ISODate
    gracePeriodDays: number
    cacheValidUntil: ISODate
    signature: string
    licenseServer: string
  }
}

export type UpdateStepId = 'preflight' | 'backup' | 'migration' | 'worker_drain' | 'container_swap' | 'health_check' | 'complete'

export interface UpdateCenterState {
  currentVersion: string
  schemaVersion: string
  channel: 'stable' | 'beta'
  lastCheckedAt: ISODate
  available: Release | null
  releases: Release[]
  history: { version: string; installedAt: ISODate; durationSec: number; by: string; status: 'success' | 'rolled_back'; backupId: string }[]
  backups: { id: string; createdAt: ISODate; sizeMb: number; version: string; kind: 'pre-update' | 'scheduled' | 'manual' }[]
  preflight: { id: string; label: string; status: 'pass' | 'warn' | 'fail'; detail: string }[]
  migrationStatus: { applied: string; pending: string[]; strategy: string }
}

export interface InstallationSettings {
  general: { orgName: string; supportEmail: string; timezone: string; currency: string }
  security: { enforceMfa: boolean; sessionTimeoutMin: number; ipAllowlistAdmin: string[]; passwordMinLength: number; auditRetentionDays: number }
  api: { baseUrl: string; dhruEndpoint: string; defaultRateLimit: number; idempotencyWindowHours: number; sandboxEnabled: boolean; dhruCompatEnabled: boolean }
  email: { provider: string; fromName: string; fromAddress: string; smtpHostMasked: string; verified: boolean }
  webhooks: { signing: 'standard-webhooks'; algorithm: 'HMAC-SHA256'; maxAttempts: number; schedule: string; timeoutMs: number }
  localization: { language: string; dateFormat: string; numberFormat: string }
  branding: { logoText: string; primaryColor: string; adminTitle: string }
}

export type HealthState = 'healthy' | 'degraded' | 'down' | 'attention'

export interface HealthComponent {
  id: string
  name: string
  status: HealthState
  summary: string
  metric: string
  href?: string
}

export interface GoLiveItem {
  id: string
  label: string
  detail: string
  done: boolean
  href: string
}
