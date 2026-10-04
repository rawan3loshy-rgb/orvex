import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import '@fontsource-variable/archivo/wdth.css'
// Offered as public-website font choices (renderSite.ts); only downloaded when a site uses them.
import '@fontsource-variable/inter'
import '@fontsource-variable/instrument-sans'
import '@fontsource-variable/jetbrains-mono'
import './styles/globals.css'
import { router } from './app/router'
import { Toaster } from './components/ui/Toaster'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10_000, refetchOnWindowFocus: false, retry: 1 },
  },
})

// The demo installation runs per tab; when another tab changes it (e.g. publishes the storefront), refetch everything.
window.addEventListener('orvex:installation-changed', () => void queryClient.invalidateQueries())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
)
