import { Outlet } from 'react-router'
import { JourneyNavigator } from '@/components/layout/JourneyNavigator'

export function RootLayout() {
  return (
    <>
      <Outlet />
      <JourneyNavigator />
    </>
  )
}
