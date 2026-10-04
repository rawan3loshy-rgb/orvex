import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query'
import { toast } from '@/stores/toast'
import type { ApiError } from '@/api'

/** Root query key for everything served by the installation API. */
export const INST = 'inst' as const

/**
 * Mutation against the installation API. On success, every installation query
 * is invalidated (cheap with the mock backend; with a real backend this can be
 * narrowed per domain).
 */
export function useInstMutation<TData, TVars = void>(
  fn: (vars: TVars) => Promise<TData>,
  opts?: { success?: string | ((data: TData, vars: TVars) => string); error?: string } & Omit<UseMutationOptions<TData, ApiError, TVars>, 'mutationFn'>,
) {
  const qc = useQueryClient()
  const { success, error, onSuccess, onError, ...rest } = opts ?? {}
  return useMutation<TData, ApiError, TVars>({
    mutationFn: fn,
    ...rest,
    onSuccess: (data, vars, ctx, mctx) => {
      qc.invalidateQueries({ queryKey: [INST] })
      if (success) toast.success(typeof success === 'function' ? success(data, vars) : success)
      onSuccess?.(data, vars, ctx, mctx)
    },
    onError: (err, vars, ctx, mctx) => {
      toast.error(error ?? 'Request failed', err.message)
      onError?.(err, vars, ctx, mctx)
    },
  })
}
