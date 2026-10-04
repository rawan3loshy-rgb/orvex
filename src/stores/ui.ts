import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark'

interface UiState {
  theme: Theme
  sidebarCollapsed: boolean
  collapsedGroups: Record<string, boolean>
  mobileNavOpen: boolean
  commandOpen: boolean
  journeyOpen: boolean
  setTheme: (t: Theme) => void
  toggleTheme: () => void
  toggleSidebar: () => void
  toggleGroup: (id: string) => void
  setMobileNav: (open: boolean) => void
  setCommandOpen: (open: boolean) => void
  setJourneyOpen: (open: boolean) => void
}

function applyTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t)
  try {
    localStorage.setItem('orvex.theme', t)
  } catch {
    /* storage unavailable */
  }
}

export const useUi = create<UiState>()(
  persist(
    (set, get) => ({
      theme: (document.documentElement.getAttribute('data-theme') as Theme) ?? 'dark',
      sidebarCollapsed: false,
      collapsedGroups: {},
      mobileNavOpen: false,
      commandOpen: false,
      journeyOpen: false,
      setTheme: (t) => {
        applyTheme(t)
        set({ theme: t })
      },
      toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      toggleGroup: (id) => set({ collapsedGroups: { ...get().collapsedGroups, [id]: !get().collapsedGroups[id] } }),
      setMobileNav: (open) => set({ mobileNavOpen: open }),
      setCommandOpen: (open) => set({ commandOpen: open }),
      setJourneyOpen: (open) => set({ journeyOpen: open }),
    }),
    {
      name: 'orvex.ui',
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed, collapsedGroups: s.collapsedGroups }),
    },
  ),
)
