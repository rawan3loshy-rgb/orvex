import type { ISODate } from './common'

/**
 * A Core release, published by the vendor and installed independently on every
 * customer installation. Shared between the vendor platform and installations.
 */
export interface Release {
  version: string
  channel: 'stable' | 'beta'
  releasedAt: ISODate
  title: string
  summary: string
  notes: ReleaseNote[]
  /** Database migration range this release applies, e.g. 017 → 018. Null if no schema change. */
  migration: { from: string; to: string; steps: string[] } | null
  /** Minimum version that can upgrade directly to this release. */
  minUpgradeFrom: string
  compatibility: { node: string; postgres: string; docker: string }
  package: {
    sizeBytes: number
    sha256: string
    /** Detached Ed25519 signature over the package manifest. */
    signature: string
    signedBy: string
  }
  requiresBackup: boolean
  breaking: boolean
}

export interface ReleaseNote {
  type: 'feature' | 'improvement' | 'fix' | 'security'
  text: string
}
