import { createFileRoute, useNavigate } from '@tanstack/react-router'
import type { ExpressionSpecification, FilterSpecification } from 'maplibre-gl'
import {
  getLayer,
  getRasterLayerSpec,
  getRasterSourceSpec,
  loadCoverageFeatures,
  useEditorLayerIndex,
  type EliLayer,
  type EliLayerType,
} from 'maplibre-editor-layer-index/react'
import { useEffect, useRef, useState } from 'react'
import { Layer, Map, MapProvider, Source, useMap } from 'react-map-gl/maplibre'
import { LAYER_TYPES, mapSearchSchema, type MapSearch } from '../mapSearch'

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

// Expression: is this feature currently hovered (set via feature-state)?
const HOVER: ExpressionSpecification = ['boolean', ['feature-state', 'hover'], false]

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

  // Always merge UI changes into the *latest* search. A ref avoids the race where a
  // debounced map-move write clobbers a just-made open/selected change (stale prev).
  const searchRef = useRef(search)
  searchRef.current = search
  const setSearch = (patch: Partial<MapSearch>) =>
    navigate({ search: { ...searchRef.current, ...patch }, replace: true })

  // Persist the map view, debounced — the map emits transient moves while its grid
  // cell is first being sized, which we don't want to capture or write to the URL.
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
    // viewportKey captures the layer set; `layers` identity changes each moveend.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportKey])

  // Sync hover highlight to the map via feature-state (drives both list→map and map→list).
  const prevHover = useRef<string | null>(null)
  useEffect(() => {
    if (!map) return
    const setState = (id: string, hover: boolean) => {
      try {
        map.setFeatureState({ source: COVERAGE_SOURCE, id }, { hover })
      } catch {
        // source not ready yet — ignored, re-applied when coverage updates
      }
    }
    if (prevHover.current && prevHover.current !== hoveredId) setState(prevHover.current, false)
    if (hoveredId) setState(hoveredId, true)
    prevHover.current = hoveredId
  }, [hoveredId, map, coverage])

  // Spinner: hook into maplibre tile-loading events to show progress for imagery.
  // These events fire synchronously while react-map-gl commits source changes, so
  // defer the state update to the next frame to avoid setState-during-render.
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

  const toggleOpen = (type: EliLayerType) =>
    setSearch({ open: open.includes(type) ? open.filter((t) => t !== type) : [...open, type] })
  const toggleSelect = (id: string) =>
    setSearch({
      selected: selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id],
    })

  const openFilter = ['in', ['get', 'type'], ['literal', open]] as FilterSpecification
  const selectedFilter = ['in', ['get', 'id'], ['literal', selected]] as FilterSpecification
  // Labels would collide across the (deduplicated, stacked) polygons, so only the
  // hovered or selected layer shows its name along the line.
  const labelFilter = [
    'any',
    ['in', ['get', 'id'], ['literal', selected]],
    ['==', ['get', 'id'], hoveredId ?? '__none__'],
  ] as FilterSpecification

  const groups = LAYER_TYPES.map((type) => ({
    type,
    items: layers.filter((l) => l.type === type),
  })).filter((g) => g.items.length > 0)

  return (
    <>
      <aside className="sidebar">
        <p className="meta">
          {layers.length} layers in this viewport. Open a group to see coverage; click a layer to
          load its imagery.
        </p>
        {groups.map((group) => {
          const isOpen = open.includes(group.type)
          return (
            <div className="group" key={group.type}>
              <button
                className={`group-header${isOpen ? ' open' : ''}`}
                onClick={() => toggleOpen(group.type)}
              >
                <span className="caret">{isOpen ? '▾' : '▸'}</span>
                <span className="group-title">{group.type.toUpperCase()}</span>
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
            const id = e.features?.[0]?.id
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

          {/* Coverage borders: a translucent glow, a crisp outline, the name along the line,
              and a distinct highlight for selected layers. */}
          {coverage && (
            <Source id={COVERAGE_SOURCE} type="geojson" data={coverage}>
              <Layer
                id="eli-coverage-fill"
                type="fill"
                filter={openFilter}
                paint={{
                  'fill-color': '#1a73e8',
                  // Invisible by default (still hoverable); tints only on hover.
                  'fill-opacity': ['case', HOVER, 0.15, 0],
                }}
              />
              <Layer
                id="eli-coverage-glow"
                type="line"
                filter={openFilter}
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{
                  'line-color': '#1a73e8',
                  'line-width': ['case', HOVER, 12, 8],
                  'line-opacity': 0.22,
                  'line-blur': 3,
                }}
              />
              <Layer
                id="eli-coverage-line"
                type="line"
                filter={openFilter}
                paint={{
                  'line-color': ['case', HOVER, '#0b3d91', '#1a73e8'],
                  'line-width': ['case', HOVER, 2.5, 1.2],
                }}
              />
              <Layer
                id="eli-coverage-selected"
                type="line"
                filter={selectedFilter}
                paint={{ 'line-color': '#d50000', 'line-width': 3, 'line-dasharray': [2, 1] }}
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
