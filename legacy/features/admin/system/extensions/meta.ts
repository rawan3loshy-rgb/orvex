import type { LucideIcon } from 'lucide-react'
import { Boxes, Brush, LayoutTemplate, PlugZap, Puzzle, Workflow } from 'lucide-react'
import type { ExtensionKind, InstalledExtension } from '@/types/extensions'
import type { Tone } from '@/types/common'

/**
 * Kind colours are categorical (chart palette minus coral) — coral stays
 * reserved for actions and selection.
 */
export const KIND_META: Record<ExtensionKind, { label: string; plural: string; icon: LucideIcon; color: string; blurb: string }> = {
  'provider-adapter': { label: 'Provider adapter', plural: 'Provider adapters', icon: PlugZap, color: 'var(--c2)', blurb: 'Translate a supplier API — REST/JSON, DHRU-compatible XML, GraphQL — into the Core adapter contract.' },
  'service-type': { label: 'Service type', plural: 'Service types', icon: Boxes, color: 'var(--c3)', blurb: 'Input fields (IMEI, serial, carrier) and result formats for services.' },
  theme: { label: 'Theme', plural: 'Themes', icon: Brush, color: 'var(--c4)', blurb: 'Look and feel of your public website.' },
  'website-component': { label: 'Website component', plural: 'Website components', icon: LayoutTemplate, color: 'var(--info)', blurb: 'Dynamic blocks for the website builder, such as live price lists.' },
  'business-rule': { label: 'Business rule', plural: 'Business rules', icon: Workflow, color: 'var(--c5)', blurb: 'Custom routing, pricing or approval logic — e.g. a VIP supplier pool for one reseller.' },
  module: { label: 'Module', plural: 'Modules', icon: Puzzle, color: 'var(--c6)', blurb: 'Optional feature areas that extend the admin.' },
}

export const KIND_ORDER: ExtensionKind[] = ['provider-adapter', 'service-type', 'business-rule', 'module', 'theme', 'website-component']

export const SOURCE_META: Record<InstalledExtension['source'], { label: string; tone: Tone; hint: string }> = {
  core: { label: 'Core', tone: 'neutral', hint: 'Bundled with ORVEX Core and updated with it.' },
  official: { label: 'Official', tone: 'neutral', hint: 'Published and signed by ORVEX Systems.' },
  custom: { label: 'Custom', tone: 'accent', hint: 'Built for this installation and signed with your publisher key. Never overwritten by Core updates.' },
}

/** Display name of an extension's publisher ("ORVEX" in a manifest is the vendor, ORVEX Systems). */
export function authorLabel(author: string) {
  return author.replace(/^ORVEX(?! Systems)\b/, 'ORVEX Systems')
}

/** Publisher to contact for a compatible release (drops the "(custom)" marker). */
export function maintainerOf(author: string) {
  return authorLabel(author).replace(/ \(custom\)$/, '')
}

export const PERMISSION_META: Record<string, string> = {
  'network:outbound': 'Make outbound HTTPS requests to configured supplier hosts',
  'secrets:read': 'Read encrypted supplier credentials assigned to it (never displayed)',
  'queue:write': 'Enqueue background jobs, e.g. batched IMEI lookups',
  'storage:write': 'Write files to installation storage',
  'catalog:read': 'Read services, fields and prices from the catalog',
  'routing:extend': 'Add steps to the routing pipeline',
  'transactions:read': 'Read the reseller transaction ledger',
  'email:send': 'Send email through the configured provider',
}

/** What each provider adapter speaks on the wire — shown in the extension drawer. */
export const ADAPTER_WIRE: Record<string, string> = {
  'adapter.rest-json': 'JSON over HTTPS with API-key, OAuth2 or HMAC auth — the format most IMEI-check and unlock suppliers expose.',
  'adapter.soap-xml': 'WSDL / XML gateways, including DHRU-compatible supplier APIs (placeimeiorder, getimeiorder, imeiservicelist).',
  'adapter.graphql': 'GraphQL supplier APIs with persisted queries — used for queue-based server services with signed callbacks.',
  'ext.unlockdesk.dsn-adapter': 'Device Services Network’s batch API — groups up to 50 IMEIs per request for device-data and warranty lookups.',
}

/** The ProviderAdapter contract (src/types/extensions.ts), summarised for admins. */
export const ADAPTER_CONTRACT: { name: string; signature: string; description: string; optional?: boolean }[] = [
  { name: 'testConnection', signature: '(config) → { ok, latencyMs, message? }', description: 'Validate credentials and reachability. Used by “Test connection”.' },
  { name: 'listRemoteServices', signature: '(config) → RemoteService[]', description: 'Fetch the supplier catalog — IMEI checks, unlock tools, codes — so it can be mapped to internal services.' },
  { name: 'submitOrder', signature: '(config, order) → { accepted, externalRef?, error? }', description: 'Submit an order with its IMEI / serial fields and return the supplier reference for tracking.' },
  { name: 'getOrderStatus', signature: '(config, externalRef) → { state, result?, error? }', description: 'Poll the supplier for the result of an asynchronous order — an NCK code, an unlock confirmation, a report.' },
  { name: 'parseWebhook', signature: '(headers, body) → status | null', description: 'Normalise inbound supplier callbacks into Core order events.', optional: true },
]
