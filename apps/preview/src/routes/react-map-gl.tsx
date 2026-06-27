import { createFileRoute, useNavigate } from '@tanstack/react-router'
import type { ExpressionSpecification, FilterSpecification } from 'maplibre-gl'
import {
  getLayer,
  getRasterLayerSpec,
  getRasterSourceSpec,
  loadCoverageFeatures,
  useEditorLayerIndex,
  type EliCategory,
  type EliLayer,
} from 'maplibre-editor-layer-index/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Layer, Map, MapProvider, Source, useMap } from 'react-map-gl/maplibre'
import { CATEGORY_GROUPS, mapSearchSchema, type MapSearch } from '../mapSearch'

export const Route = createFileRoute('/react-map-gl')({
  validateSearch: mapSearchSchema,
  component: () => (
    <MapProvider>
      <ReactMapGlDemo />
    </MapProvider>
  ),
})

const MAP_ID = 'eli'
const BASE_STYLE = 'https://tiles.openfreemap.org/styles/positron'
const COVERAGE_SOURCE = 'eli-coverage'
const HIGHLIGHT_SOURCE = 'eli-highlight'
const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] }

// Coverage geometry of a layer falls into its category (missing → "other").
const categoryExpr: ExpressionSpecification = ['coalesce', ['get', 'category'], 'other']
// Inner inset band: a thick translucent line offset toward the polygon interior,
// sitting just inside the crisp outline (no blurry glow).
const INNER_WIDTH = 9
const INNER_OFFSET = -INNER_WIDTH / 2

function ReactMapGlDemo() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const maps = useMap()
  const map = maps[MAP_ID]?.getMap() ?? null

  const { layers } = useEditorLayerIndex({ mapId: MAP_ID })
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [coverage, setCoverage] = useState<Awaited<
    ReturnType<typeof loadCoverageFeatures>
  > | null>(null)
  const [loading, setLoading] = useState(false)

  const { open, selected } = search

  const searchRef = useRef(search)
  searchRef.current = search
  const setSearch = (patch: Partial<MapSearch>) => {
    // Update the ref optimistically so rapid back-to-back changes (e.g. toggle a
    // group then a layer in the same tick) compose instead of clobbering.
    const next = { ...searchRef.current, ...patch }
    searchRef.current = next
    navigate({ search: next, replace: true })
  }

  const moveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const persistView = (lat: number, lng: number, zoom: number) => {
    clearTimeout(moveTimer.current)
    moveTimer.current = setTimeout(() => setSearch({ lat, lng, zoom }), 250)
  }

  const selectedLayers = selected
    .map((id) => getLayer(id))
    .filter((l): l is EliLayer => Boolean(l))

  // Load coverage polygons for the viewport layers (borders + hover/selected highlight).
  const viewportKey = layers.map((l) => l.id).join(',')
  useEffect(() => {
    let cancelled = false
    loadCoverageFeatures(layers).then((fc) => {
      if (!cancelled) setCoverage(fc)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportKey])

  // The single hovered feature, rendered in its own top source so the highlight is
  // always visible — even where many layers share (and stack) the same polygon.
  const highlightData = useMemo(() => {
    const feature = coverage?.features.find((f) => f.properties?.id === hoveredId)
    return feature ? { type: 'FeatureCollection' as const, features: [feature] } : EMPTY_FC
  }, [coverage, hoveredId])

  // Spinner: hook into maplibre tile-loading events; defer to next frame to avoid
  // setState during react-map-gl's synchronous source commits.
  useEffect(() => {
    if (!map) return
    let raf = 0
    const update = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const next = selected.length > 0 && !map.areTilesLoaded()
        setLoading((cur) => (cur === next ? cur : next))
      })
    }
    map.on('dataloading', update)
    map.on('data', update)
    map.on('idle', update)
    update()
    return () => {
      cancelAnimationFrame(raf)
      map.off('dataloading', update)
      map.off('data', update)
      map.off('idle', update)
    }
  }, [map, selected.length])

  // Read current arrays from the ref (not the render snapshot) so same-tick toggles compose.
  const toggleOpen = (category: EliCategory) => {
    const cur = searchRef.current.open
    setSearch({ open: cur.includes(category) ? cur.filter((c) => c !== category) : [...cur, category] })
  }
  const toggleSelect = (id: string) => {
    const cur = searchRef.current.selected
    setSearch({ selected: cur.includes(id) ? cur.filter((s) => s !== id) : [...cur, id] })
  }

  const openFilter = ['in', categoryExpr, ['literal', open]] as FilterSpecification
  const selectedFilter = ['in', ['get', 'id'], ['literal', selected]] as FilterSpecification
  const labelFilter = [
    'any',
    ['in', ['get', 'id'], ['literal', selected]],
    ['==', ['get', 'id'], hoveredId ?? '__none__'],
  ] as FilterSpecification

  const groups = CATEGORY_GROUPS.map((g) => ({
    ...g,
    items: layers.filter((l) => (l.category ?? 'other') === g.key),
  })).filter((g) => g.items.length > 0)

  return (
    <>
      <aside className="sidebar">
        <p className="meta">
          {layers.length} layers in this viewport. Open a category to see coverage; click a layer
          to load its imagery.
        </p>
        {groups.map((group) => {
          const isOpen = open.includes(group.key)
          return (
            <div className="group" key={group.key}>
              <button
                className={`group-header${isOpen ? ' open' : ''}`}
                onClick={() => toggleOpen(group.key)}
              >
                <span className="caret">{isOpen ? '▾' : '▸'}</span>
                <span className="group-title">{group.label}</span>
                <span className="group-count">{group.items.length}</span>
              </button>
              {isOpen && (
                <div className="group-items">
                  {group.items.map((layer) => (
                    <div
                      key={layer.id}
                      className={`layer${selected.includes(layer.id) ? ' selected' : ''}${
                        hoveredId === layer.id ? ' hovered' : ''
                      }`}
                      onMouseEnter={() => setHoveredId(layer.id)}
                      onMouseLeave={() => setHoveredId((cur) => (cur === layer.id ? null : cur))}
                      onClick={() => toggleSelect(layer.id)}
                    >
                      <span className="name" title={layer.name}>
                        {layer.name}
                      </span>
                      {layer.best && <span className="badge">best</span>}
                      <span className="badge type">{layer.type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </aside>

      <div className="map">
        <Map
          id={MAP_ID}
          initialViewState={{ longitude: search.lng, latitude: search.lat, zoom: search.zoom }}
          mapStyle={BASE_STYLE}
          style={{ width: '100%', height: '100%' }}
          interactiveLayerIds={['eli-coverage-fill']}
          onMouseMove={(e) => {
            // Read properties.id, not feature.id: maplibre GeoJSON sources don't keep
            // non-numeric string feature ids, so feature.id would be undefined here.
            const id = e.features?.[0]?.properties?.id
            setHoveredId((cur) => (id != null ? String(id) : cur === null ? cur : null))
          }}
          onMouseLeave={() => setHoveredId(null)}
          onMoveEnd={(e) =>
            persistView(
              round(e.viewState.latitude),
              round(e.viewState.longitude),
              round(e.viewState.zoom),
            )
          }
        >
          {/* Imagery for selected layers — rendered first so it sits below the borders. */}
          {selectedLayers.map((layer) => (
            <Source key={layer.id} id={`eli-raster-${layer.id}`} {...getRasterSourceSpec(layer)}>
              <Layer
                {...getRasterLayerSpec(layer, {
                  id: `eli-raster-${layer.id}`,
                  source: `eli-raster-${layer.id}`,
                  paint: { 'raster-opacity': 0.9 },
                })}
              />
            </Source>
          ))}

          {/* Coverage borders for open categories: an inner inset band + a crisp outline,
              plus a distinct red treatment for selected layers and the name along the line. */}
          {coverage && (
            <>
            <Source id={COVERAGE_SOURCE} type="geojson" data={coverage}>
              <Layer
                id="eli-coverage-fill"
                type="fill"
                filter={openFilter}
                paint={{ 'fill-color': '#1a73e8', 'fill-opacity': 0 }}
              />
              <Layer
                id="eli-coverage-inner"
                type="line"
                filter={openFilter}
                paint={{
                  'line-color': '#1a73e8',
                  'line-width': INNER_WIDTH,
                  'line-offset': INNER_OFFSET,
                  'line-opacity': 0.16,
                }}
              />
              <Layer
                id="eli-coverage-outline"
                type="line"
                filter={openFilter}
                paint={{ 'line-color': '#1a73e8', 'line-width': 1.5 }}
              />
              <Layer
                id="eli-coverage-selected-inner"
                type="line"
                filter={selectedFilter}
                paint={{
                  'line-color': '#d50000',
                  'line-width': INNER_WIDTH,
                  'line-offset': INNER_OFFSET,
                  'line-opacity': 0.18,
                }}
              />
              <Layer
                id="eli-coverage-selected"
                type="line"
                filter={selectedFilter}
                paint={{ 'line-color': '#d50000', 'line-width': 2.5 }}
              />
              <Layer
                id="eli-coverage-label"
                type="symbol"
                filter={labelFilter}
                layout={{
                  'symbol-placement': 'line',
                  'text-field': ['get', 'name'],
                  'text-size': 11,
                  'text-font': ['Noto Sans Regular'],
                }}
                paint={{
                  'text-color': '#0b3d91',
                  'text-halo-color': '#ffffff',
                  'text-halo-width': 1.5,
                }}
              />
            </Source>

            {/* Hovered shape — declared after coverage (same commit) so its layers
                are inserted on top and the highlight is always visible. */}
            <Source id={HIGHLIGHT_SOURCE} type="geojson" data={highlightData}>
              <Layer
                id="eli-highlight-inner"
                type="line"
                paint={{
                  'line-color': '#ff6d00',
                  'line-width': INNER_WIDTH + 3,
                  'line-offset': -(INNER_WIDTH + 3) / 2,
                  'line-opacity': 0.28,
                }}
              />
              <Layer
                id="eli-highlight-outline"
                type="line"
                paint={{ 'line-color': '#ff6d00', 'line-width': 3 }}
              />
            </Source>
            </>
          )}
        </Map>

        {loading && (
          <div className="map-spinner" role="status">
            <span className="spinner" />
            Loading imagery…
          </div>
        )}
      </div>
    </>
  )
}

function round(n: number): number {
  return Math.round(n * 1e5) / 1e5
}
