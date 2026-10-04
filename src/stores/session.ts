import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Two independent sessions, mirroring the architecture:
 *  - vendor: the customer's login to the vendor account portal
 *  - installation: an admin login to the customer's own installation
 *    (separate user database — the vendor account is NOT used there)
 */
interface SessionState {
  vendor: { email: string; name: string } | null
  installation: { email: string; name: string } | null
  signInVendor: (email: string, name: string) => void
  signOutVendor: () => void
  signInInstallation: (email: string, name: string) => void
  signOutInstallation: () => void
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      vendor: null,
      installation: null,
      signInVendor: (email, name) => set({ vendor: { email, name } }),
      signOutVendor: () => set({ vendor: null }),
      signInInstallation: (email, name) => set({ installation: { email, name } }),
      signOutInstallation: () => set({ installation: null }),
    }),
    { name: 'orvex.session' },
  ),
)
