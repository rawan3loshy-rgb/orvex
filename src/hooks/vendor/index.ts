/**
 * React Query hooks for the vendor platform API.
 */
import { useMutation, useQuery, useQueryClient, type UseMutationOptions } from '@tanstack/react-query'
import { accountService, billingService, licenseService, publicService, supportService } from '@/services/vendor'
import { toast } from '@/stores/toast'
import type { ApiError } from '@/api'

export const VENDOR = 'vendor' as const

export const usePublicMetrics = () => useQuery({ queryKey: [VENDOR, 'public', 'metrics'], queryFn: publicService.metrics, staleTime: Infinity })
export const usePublicPlans = () => useQuery({ queryKey: [VENDOR, 'public', 'plans'], queryFn: publicService.plans, staleTime: Infinity })

export const useVendorOverview = () => useQuery({ queryKey: [VENDOR, 'overview'], queryFn: accountService.overview })
export const useVendorAccount = () => useQuery({ queryKey: [VENDOR, 'account'], queryFn: accountService.account })
export const useSubscription = () => useQuery({ queryKey: [VENDOR, 'subscription'], queryFn: billingService.subscription })
export const usePlans = () => useQuery({ queryKey: [VENDOR, 'plans'], queryFn: billingService.plans })
export const useInvoices = () => useQuery({ queryKey: [VENDOR, 'invoices'], queryFn: billingService.invoices })
export const useInvoice = (id: string | undefined) => useQuery({ queryKey: [VENDOR, 'invoices', id], queryFn: () => billingService.invoice(id!), enabled: !!id })
export const usePayments = () => useQuery({ queryKey: [VENDOR, 'payments'], queryFn: billingService.payments })
export const useVendorLicense = () => useQuery({ queryKey: [VENDOR, 'license'], queryFn: licenseService.license })
export const useVendorInstallations = () => useQuery({ queryKey: [VENDOR, 'installations'], queryFn: licenseService.installations })
export const useReleases = () => useQuery({ queryKey: [VENDOR, 'releases'], queryFn: licenseService.releases })
export const useTickets = () => useQuery({ queryKey: [VENDOR, 'tickets'], queryFn: supportService.tickets })
export const useTicket = (id: string | undefined) => useQuery({ queryKey: [VENDOR, 'tickets', id], queryFn: () => supportService.ticket(id!), enabled: !!id })

export function useVendorMutation<TData, TVars = void>(
  fn: (vars: TVars) => Promise<TData>,
  opts?: { success?: string; error?: string } & Omit<UseMutationOptions<TData, ApiError, TVars>, 'mutationFn'>,
) {
  const qc = useQueryClient()
  const { success, error, onSuccess, onError, ...rest } = opts ?? {}
  return useMutation<TData, ApiError, TVars>({
    mutationFn: fn,
    ...rest,
    onSuccess: (data, vars, ctx, mctx) => {
      qc.invalidateQueries({ queryKey: [VENDOR] })
      if (success) toast.success(success)
      onSuccess?.(data, vars, ctx, mctx)
    },
    onError: (err, vars, ctx, mctx) => {
      toast.error(error ?? 'Request failed', err.message)
      onError?.(err, vars, ctx, mctx)
    },
  })
}
