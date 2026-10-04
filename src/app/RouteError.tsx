import { isRouteErrorResponse, useRouteError } from 'react-router'
import { TriangleAlert } from 'lucide-react'
import { Button, EmptyState } from '@/components/ui'

export function RouteError() {
  const err = useRouteError()
  const message = isRouteErrorResponse(err) ? `${err.status} ${err.statusText}` : err instanceof Error ? err.message : 'Unknown error'
  return (
    <div className="grid min-h-dvh place-items-center bg-bg p-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface shadow-pop">
        <EmptyState
          icon={<TriangleAlert />}
          title="Something went wrong"
          description={<span className="font-mono text-[12px]">{message}</span>}
          action={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => window.location.reload()}>
                Reload
              </Button>
              <Button variant="primary" to="/">
                Go home
              </Button>
            </div>
          }
        />
      </div>
    </div>
  )
}
