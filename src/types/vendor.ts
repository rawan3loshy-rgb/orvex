/**
 * Domain model of the VENDOR platform (account.orvex.io).
 * The vendor platform only knows about accounts, subscriptions, licenses,
 * billing, releases and support. It never stores a customer's operational data.
 */
import type { ISODate, Money } from './common'

export interface VendorAccount {
  id: string
  firstName: string
  lastName: string
  name: string
  email: string
  company: string
  country: string
  vatId: string
  createdAt: ISODate
  team: { id: string; name: string; email: string; role: 'Owner' | 'Billing' | 'Technical'; lastActiveAt: ISODate }[]
  security: { mfa: boolean; lastLoginAt: ISODate; sessions: { id: string; device: string; location: string; lastActiveAt: ISODate; current: boolean }[] }
}

export interface Plan {
  id: 'starter' | 'professional' | 'enterprise'
  name: string
  tagline: string
  priceMonthly: Money | null
  billingNote: string
  highlighted: boolean
  installations: string
  features: string[]
  modules: string[]
}

export interface Subscription {
  id: string
  planId: Plan['id']
  planName: string
  status: 'active' | 'past_due' | 'cancelled' | 'trialing'
  billingCycle: 'monthly' | 'quarterly' | 'annual'
  amount: Money
  currency: 'USD'
  startedAt: ISODate
  currentPeriodStart: ISODate
  currentPeriodEnd: ISODate
  nextRenewalAt: ISODate
  autoRenew: boolean
  addOns: { id: string; name: string; price: Money; description: string }[]
  paymentMethod: { brand: string; last4: string; expMonth: number; expYear: number }
  usage: { label: string; used: number; limit: number | null; unit: string }[]
}

export interface InvoiceLine {
  description: string
  quantity: number
  unitPrice: Money
  amount: Money
}

export interface Invoice {
  id: string
  number: string
  issuedAt: ISODate
  dueAt: ISODate
  paidAt: ISODate | null
  periodStart: ISODate
  periodEnd: ISODate
  subtotal: Money
  tax: Money
  total: Money
  status: 'paid' | 'open' | 'void' | 'uncollectible'
  lines: InvoiceLine[]
}

export interface Payment {
  id: string
  at: ISODate
  amount: Money
  method: string
  status: 'succeeded' | 'failed' | 'refunded'
  invoiceId: string
  description: string
}

export interface InstallationRef {
  id: string
  name: string
  domain: string
  environment: 'production' | 'staging'
  version: string
  schemaVersion: string
  status: 'online' | 'offline' | 'degraded'
  lastHeartbeatAt: ISODate
  activatedAt: ISODate
  hosting: string
  region: string
  database: string
  deployment: 'self-managed' | 'vendor-assisted'
  updateChannel: 'stable' | 'beta'
}

export interface VendorLicense {
  id: string
  key: string
  keyMasked: string
  plan: string
  status: 'active' | 'grace' | 'expired' | 'suspended'
  issuedAt: ISODate
  activatedAt: ISODate
  expiresAt: ISODate
  updatesUntil: ISODate
  maxInstallations: number
  licensedDomains: string[]
  licensedVersion: string
  modules: { id: string; name: string; included: boolean }[]
  installations: InstallationRef[]
  signature: { algorithm: string; publicKeyId: string; issuedBy: string }
}

export interface SupportMessage {
  id: string
  author: string
  role: 'customer' | 'support'
  body: string
  at: ISODate
}

export interface SupportTicket {
  id: string
  subject: string
  status: 'open' | 'awaiting_customer' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  category: 'Installation' | 'Billing' | 'Update' | 'Provider adapter' | 'Licensing' | 'Custom development' | 'General'
  installationId: string | null
  createdAt: ISODate
  updatedAt: ISODate
  messages: SupportMessage[]
}

export interface VendorOverview {
  account: VendorAccount
  subscription: Subscription
  license: VendorLicense
  latestRelease: { version: string; releasedAt: ISODate; title: string }
  openTickets: number
  nextInvoice: { amount: Money; dueAt: ISODate }
}

export interface PublicMetrics {
  activeIntegrations: number
  ordersProcessed: number
  apiAvailability: number
  activePlatforms: number
  /** Flag so the UI can label demo figures explicitly. */
  demo: boolean
}
