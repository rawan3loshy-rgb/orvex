import type { LucideIcon } from 'lucide-react'
import { BadgeCheck, CloudDownload, CodeXml, Database, HardDrive, Layers, Server, Webhook } from 'lucide-react'
import type { HealthComponent, HealthState, OrderRow } from '@/types/installation'
import type { Tone } from '@/types/common'

export const COMPONENT_META: Record<HealthComponent['id'], { icon: LucideIcon; to: string; hint: string; probe: string }> = {
  application: { icon: Server, to: '/admin/settings?tab=system', hint: 'Core containers and runtime', probe: 'docker ps' },
  database: { icon: Database, to: '/admin/settings?tab=system', hint: 'Your PostgreSQL via DATABASE_URL', probe: 'SELECT 1' },
  queue: { icon: Layers, to: '/admin/orders', hint: 'Unlock & server jobs awaiting supplier callbacks', probe: 'jobs.depth' },
  api: { icon: CodeXml, to: '/admin/developer/logs', hint: 'Reseller API v1 and admin API', probe: 'GET /api/v1/ping' },
  webhooks: { icon: Webhook, to: '/admin/developer/webhooks', hint: 'order.* events to reseller endpoints', probe: 'dispatcher.tick' },
  storage: { icon: HardDrive, to: '/admin/settings?tab=system', hint: 'Result files, exports and backups', probe: 'HEAD bucket' },
  license: { icon: BadgeCheck, to: '/admin/system/license', hint: 'Signed license and validation cache', probe: 'ed25519.verify' },
  updates: { icon: CloudDownload, to: '/admin/system/updates', hint: 'Signed ORVEX Core releases', probe: 'releases.orvex.io' },
}

/**
 * Health is expressed in status colours only. "attention" (an update is
 * available, a license action is due) is informational — steel grey, never
 * alarming and never the brand accent.
 */
export const STATE_TONE: Record<HealthState, Tone> = {
  healthy: 'success',
  degraded: 'warning',
  down: 'danger',
  attention: 'info',
}

export const STATE_COLOR: Record<HealthState, string> = {
  healthy: 'var(--success)',
  degraded: 'var(--warning)',
  down: 'var(--danger)',
  attention: 'var(--info)',
}

/** Overall copy for the hero. "attention" (e.g. an update is available) is informational, never alarming. */
export const OVERALL_COPY: Record<HealthState, { title: string; lead: string }> = {
  healthy: { title: 'All systems operational', lead: 'Every Core component is responding — orders are accepted, routed to suppliers and fulfilled normally.' },
  attention: { title: 'Operational', lead: 'Core is running and orders are flowing — a few items are waiting for your attention.' },
  degraded: { title: 'Degraded performance', lead: 'Core is running, but one or more components are slower than usual. Orders keep queueing safely.' },
  down: { title: 'Service disruption', lead: 'One or more components are not responding. Order intake is protected by the queue — IMEI and unlock jobs resume automatically.' },
}

/** Normal utilisation is graphite; only pressure turns a resource amber or red. */
export const resourceTone = (ratio: number): Tone => (ratio > 0.9 ? 'danger' : ratio > 0.75 ? 'warning' : 'neutral')

/** What each demo supplier is used for — shown next to its connectivity. */
export const SUPPLIER_ROLE: Record<string, string> = {
  prv_globalunlock: 'Network unlocks',
  prv_imeihub: 'Instant IMEI checks',
  prv_gsmsolutions: 'Unlock codes · DHRU-compatible XML',
  prv_mobileapi: 'Server services · FRP, Mi, GSX, MDM',
  prv_devicenet: 'Device data · custom adapter',
}

/** Short service-category labels for queue breakdowns. */
export const CATEGORY_SHORT: Record<OrderRow['serviceCategory'], string> = {
  'IMEI Services': 'IMEI',
  Unlocking: 'Unlock',
  'Server Services': 'Server',
  Codes: 'Codes',
  'Other Services': 'Other',
}
