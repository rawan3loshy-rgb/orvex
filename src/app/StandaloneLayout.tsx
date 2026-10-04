import { Suspense } from 'react'
import { Outlet } from 'react-router'
import { LogoMark } from '@/components/brand'

export function StandaloneLayout() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-dvh place-items-center bg-bg">
          <LogoMark className="size-9 animate-pulse opacity-80" />
        </div>
      }
    >
      <Outlet />
    </Suspense>
  )
}
