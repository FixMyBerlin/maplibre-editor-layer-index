import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { LocationBanner } from '../LocationBanner'
import { DEFAULT_VIEW } from '../mapSearch'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="app">
      <LocationBanner />
      <header className="header">
        <h1>@osm-editor-kit/osm-editor-layer-index</h1>
        <nav>
          <Link
            to="/react-map-gl"
            search={DEFAULT_VIEW}
            activeProps={{ className: 'active' }}
            activeOptions={{ includeSearch: false }}
          >
            react-map-gl
          </Link>
          <Link
            to="/maplibre"
            search={DEFAULT_VIEW}
            activeProps={{ className: 'active' }}
            activeOptions={{ includeSearch: false }}
          >
            raw maplibre-gl
          </Link>
        </nav>
      </header>
      <Outlet />
    </div>
  )
}
