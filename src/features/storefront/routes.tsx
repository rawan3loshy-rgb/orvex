import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { RouteObject } from 'react-router'
import StorefrontLayout from './StorefrontLayout'

/**
 * Storefront — the customer's public website, mounted at /site by src/app/router.tsx.
 * The layout applies the storefront theme (scoped CSS variables), header,
 * footer and demo ribbon; pages are lazy-loaded inside its Suspense boundary.
 * /site always renders the PUBLISHED revision; ?preview=<token> (issued by the
 * storefront editor) renders the draft instead.
 */
const page = (C: LazyExoticComponent<ComponentType>) => <C />

const pages = {
  home: lazy(() => import('./pages/HomePage')),
  services: lazy(() => import('./pages/ServicesPage')),
  category: lazy(() => import('./pages/CategoryPage')),
  search: lazy(() => import('./pages/SearchPage')),
  service: lazy(() => import('./pages/ServicePage')),
  pay: lazy(() => import('./pages/PayPage')),
  trackLookup: lazy(() => import('./pages/TrackLookupPage')),
  track: lazy(() => import('./pages/TrackPage')),
  account: lazy(() => import('./pages/AccountPage')),
  content: lazy(() => import('./pages/ContentPage')),
  notFound: lazy(() => import('./pages/NotFoundPage')),
}

export const storefrontRoute: RouteObject = {
  path: '/site',
  element: <StorefrontLayout />,
  children: [
    { index: true, element: page(pages.home) },
    { path: 'services', element: page(pages.services) },
    { path: 'services/:slug', element: page(pages.service) },
    { path: 'c/:slug', element: page(pages.category) },
    { path: 'search', element: page(pages.search) },
    { path: 'pay/:token', element: page(pages.pay) },
    { path: 'track', element: page(pages.trackLookup) },
    { path: 'track/:token', element: page(pages.track) },
    { path: 'account', element: page(pages.account) },
    { path: ':slug', element: page(pages.content) },
    { path: '*', element: page(pages.notFound) },
  ],
}
