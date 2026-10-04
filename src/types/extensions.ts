import type { ISODate } from './common'

/**
 * Extension architecture: CORE + CONFIGURATION + EXTENSIONS = CUSTOMER INSTALLATION.
 *
 * Customer-specific behaviour lives in extensions so Core can be updated
 * without overwriting customisations. Extensions are versioned packages
 * declaring the Core range they are compatible with.
 */
export type ExtensionKind =
  | 'supplier-driver'
  | 'vertical-pack'
  | 'payment-gateway'
  | 'service-type'
  | 'theme'
  | 'website-component'
  | 'business-rule'
  | 'module'

export interface ExtensionManifest {
  id: string
  name: string
  kind: ExtensionKind
  version: string
  /** semver range of ORVEX Core this extension supports, e.g. "^2.4.0" */
  coreRange: string
  author: string
  source: 'core' | 'official' | 'custom'
  description: string
  /** Capabilities requested by the extension; reviewed on install. */
  permissions: string[]
}

export interface InstalledExtension extends ExtensionManifest {
  status: 'enabled' | 'disabled' | 'incompatible'
  installedAt: ISODate
  updatedAt: ISODate
  /** Whether the next Core release is compatible (pre-flight check for updates). */
  compatibleWithNext: boolean
  config?: Record<string, string | number | boolean>
}

/**
 * Supplier drivers implement the SupplierDriver port in src/core/ports.ts
 * (testConnection, getBalance, syncCatalog, submit, getStatus, parseCallback,
 * normalizeResult, cancel). Core never talks to a supplier directly.
 */
