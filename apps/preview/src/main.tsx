import 'maplibre-gl/dist/maplibre-gl.css'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './styles.css'
import { routeTree } from './routeTree.gen'
import { parseSearch, stringifySearch } from './searchParams'

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  // Flat, shareable URLs (see ./searchParams).
  parseSearch,
  stringifySearch,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
