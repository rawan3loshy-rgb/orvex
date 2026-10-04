/**
 * Vendor platform services — account, subscription, license, billing,
 * releases and support. Talks only to the vendor API, never to an installation.
 */
import { vendorApi as api } from '@/api'
import type { Release } from '@/types/release'
import type { InstallationRef, Invoice, Payment, Plan, PublicMetrics, Subscription, SupportTicket, VendorAccount, VendorLicense, VendorOverview } from '@/types/vendor'

export const publicService = {
  metrics: () => api.get<PublicMetrics>('/public/metrics'),
  plans: () => api.get<Plan[]>('/public/plans'),
}

export const authService = {
  login: (email: string) => api.post<{ ok: true; account: VendorAccount }>('/auth/login', { email }),
}

export const accountService = {
  overview: () => api.get<VendorOverview>('/account/overview'),
  account: () => api.get<VendorAccount>('/account'),
  updateAccount: (body: Partial<VendorAccount>) => api.patch<VendorAccount>('/account', body),
}

export const billingService = {
  subscription: () => api.get<Subscription>('/subscription'),
  updateSubscription: (body: Partial<Subscription>) => api.patch<Subscription>('/subscription', body),
  plans: () => api.get<Plan[]>('/plans'),
  invoices: () => api.get<Invoice[]>('/invoices'),
  invoice: (id: string) => api.get<Invoice>(`/invoices/${id}`),
  payInvoice: (id: string) => api.post<Invoice>(`/invoices/${id}/pay`),
  payments: () => api.get<Payment[]>('/payments'),
}

export const licenseService = {
  license: () => api.get<VendorLicense>('/license'),
  installations: () => api.get<InstallationRef[]>('/installations'),
  installation: (id: string) => api.get<InstallationRef>(`/installations/${id}`),
  releases: () => api.get<Release[]>('/releases'),
}

export const supportService = {
  tickets: () => api.get<SupportTicket[]>('/tickets'),
  ticket: (id: string) => api.get<SupportTicket>(`/tickets/${id}`),
  create: (body: { subject: string; body: string; category?: SupportTicket['category']; priority?: SupportTicket['priority']; installationId?: string | null }) => api.post<SupportTicket>('/tickets', body),
  reply: (id: string, body: string) => api.post<SupportTicket>(`/tickets/${id}/messages`, { body }),
}

/** Prototype-only: restore the vendor mock to its seed. */
export const vendorDemoService = {
  reset: () => api.post<{ ok: true }>('/demo/reset'),
}
