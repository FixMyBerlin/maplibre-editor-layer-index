import { createRootRoute, Link, Outlet } from '@tanstack/react-router'

/** Default map view used when navigating between demos without existing params. */
const DEFAULT_VIEW = { lat: 52.52, lng: 13.405, zoom: 10 } as const

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="app">
      <header className="header">
        <h1>maplibre-editor-layer-index</h1>
        <nav>
          <Link
            to="/"
            search={DEFAULT_VIEW}
            activeProps={{ className: 'active' }}
            activeOptions={{ exact: true }}
          >
            react-map-gl
          </Link>
          <Link to="/maplibre" search={DEFAULT_VIEW} activeProps={{ className: 'active' }}>
            raw maplibre-gl
          </Link>
        </nav>
      </header>
      <Outlet />
    </div>
  )
}
