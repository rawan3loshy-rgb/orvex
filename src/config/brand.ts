/**
 * Vendor brand. Rename the product in one place.
 * (Temporary name "ORVEX" until a final brand decision is made.)
 */
export const brand = {
  product: 'ORVEX',
  company: 'ORVEX Systems',
  coreProduct: 'ORVEX Core',
  descriptor: 'Service Operations Platform',
  tagline: 'Connect. Route. Fulfill.',
  domain: 'orvex.io',
  accountDomain: 'account.orvex.io',
  docsUrl: 'https://docs.orvex.io',
  supportEmail: 'support@orvex.io',
  salesEmail: 'sales@orvex.io',
} as const

/**
 * The demo customer whose installation the admin app represents — a fictional
 * GSM service business. In a real installation this comes from the
 * installation's own settings (DB), never from the vendor platform.
 */
export const demoInstallation = {
  orgName: 'UnlockDesk Demo Ltd.',
  siteName: 'UnlockDesk',
  adminTitle: 'UnlockDesk Ops',
  domain: 'portal.unlockdesk-demo.com',
  adminPath: '/admin',
} as const
