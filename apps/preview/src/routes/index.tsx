import { createFileRoute, redirect } from '@tanstack/react-router'

import { DEFAULT_VIEW } from '../mapSearch'

// No standalone landing page — the react-map-gl demo is the home.
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/react-map-gl', search: DEFAULT_VIEW })
  },
})
