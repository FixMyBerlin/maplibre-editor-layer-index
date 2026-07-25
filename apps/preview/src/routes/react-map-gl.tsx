import * as countryCoder from '@rapideditor/country-coder'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  getLayer,
  getRasterLayerSpec,
  getRasterSourceSpec,
  loadCoverageFeatures,
  useEditorLayerIndex,
  type EliCategory,
  type EliLayer,
} from 'maplibre-editor-layer-index/react'
import type { ExpressionSpecification, FilterSpecification } from 'maplibre-gl'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  Layer,
  Map,
  MapProvider,
  Source,
  useMap,
  type MapLayerMouseEvent,
  type ViewStateChangeEvent,
} from 'react-map-gl/maplibre'
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

  // Filter the list to the country under the map centre (precomputed per-layer
  // country codes, resolved live by country-coder). This drops bbox false matches
  // like TIGER showing up in Germany; worldwide layers still always pass.
  const centerCountry = countryCoder.iso1A2Code([search.lng, search.lat])
  const { layers } = useEditorLayerIndex({
    mapId: MAP_ID,
    filter: centerCountry ? { countryCodes: [centerCountry] } : undefined,
  })
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [coverage, setCoverage] = useState<Awaited<ReturnType<typeof loadCoverageFeatures>> | null>(
    null,
  )
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

  const selectedLayers = selected.map((id) => getLayer(id)).filter((l): l is EliLayer => Boolean(l))

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

  // Bounding box of the hovered layer, drawn as a temporary glowing rectangle. This
  // is what viewport filtering uses, and for worldwide layers (no coverage polygon)
  // it's the only thing to show — making it obvious why they have no hover outline.
  const bboxData = useMemo(() => {
    const layer = hoveredId ? getLayer(hoveredId) : undefined
    if (!layer) return EMPTY_FC
    const [w, rawS, e, rawN] = layer.bbox
    // Clamp latitude to the Web Mercator limit so a whole-world bbox still renders
    // (a polygon reaching ±90° is invalid in Mercator and would be dropped).
    const s = Math.max(rawS, -85.05)
    const n = Math.min(rawN, 85.05)
    return {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: { worldwide: layer.geometryId === 'world' },
          geometry: {
            type: 'Polygon' as const,
            coordinates: [
              [
                [w, s],
                [e, s],
                [e, n],
                [w, n],
                [w, s],
              ],
            ],
          },
        },
      ],
    }
  }, [hoveredId])

  // Guard against a missed resize: if the map mounts before its grid cell has its
  // final height, the canvas can stay tiny. Observe the container and keep the
  // canvas in sync (belt-and-suspenders over maplibre's own resize handling).
  useEffect(() => {
    if (!map) return
    const container = map.getContainer()
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(container)
    map.resize()
    return () => ro.disconnect()
  }, [map])

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
    setSearch({
      open: cur.includes(category) ? cur.filter((c) => c !== category) : [...cur, category],
    })
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
          {layers.length} layers in this viewport. Open a category to see coverage; click a layer to
          load its imagery.
        </p>
        {groups.map((group) => {
          const isOpen = open.includes(group.key)
          const activeCount = group.items.filter((l) => selected.includes(l.id)).length
          return (
            <div className="group" key={group.key}>
              <button
                className={`group-header${isOpen ? ' open' : ''}`}
                onClick={() => toggleOpen(group.key)}
              >
                <span className="caret">{isOpen ? '▾' : '▸'}</span>
                <span className="group-title">{group.label}</span>
                {activeCount > 0 && (
                  <span className="group-count active" title={`${activeCount} active`}>
                    {activeCount}
                  </span>
                )}
                <span className="group-count" title={`${group.items.length} in viewport`}>
                  {group.items.length}
                </span>
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
                      {(() => {
                        const scope = layerScope(layer)
                        return scope ? (
                          <span className={`badge scope ${scope}`}>{scope}</span>
                        ) : null
                      })()}
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
          onMouseMove={(e: MapLayerMouseEvent) => {
            // Read properties.id, not feature.id: maplibre GeoJSON sources don't keep
            // non-numeric string feature ids, so feature.id would be undefined here.
            const id = e.features?.[0]?.properties?.id
            setHoveredId((cur) => (id != null ? String(id) : cur === null ? cur : null))
          }}
          onMouseLeave={() => setHoveredId(null)}
          onMoveEnd={(e: ViewStateChangeEvent) =>
            persistView(
              round(e.viewState.latitude),
              round(e.viewState.longitude),
              round(e.viewState.zoom),
            )
          }
        >
          {/* react-map-gl convention: keep <Source> and <Layer> FLAT (separate
              siblings, Layer referencing the source by id) — never nested. */}

          {/* Imagery for selected layers — rendered first so it sits below the borders. */}
          {selectedLayers.map((layer) => (
            <Fragment key={layer.id}>
              <Source id={`eli-raster-${layer.id}`} {...getRasterSourceSpec(layer)} />
              <Layer
                {...getRasterLayerSpec(layer, {
                  id: `eli-raster-${layer.id}`,
                  source: `eli-raster-${layer.id}`,
                  paint: { 'raster-opacity': 0.9 },
                })}
              />
            </Fragment>
          ))}

          {/* Coverage borders for open categories: an inner inset band + a crisp outline,
              plus a distinct red treatment for selected layers and the name along the line. */}
          {coverage && (
            <>
              <Source id={COVERAGE_SOURCE} type="geojson" data={coverage} />
              <Layer
                id="eli-coverage-fill"
                source={COVERAGE_SOURCE}
                type="fill"
                filter={openFilter}
                paint={{ 'fill-color': '#1a73e8', 'fill-opacity': 0 }}
              />
              <Layer
                id="eli-coverage-inner"
                source={COVERAGE_SOURCE}
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
                source={COVERAGE_SOURCE}
                type="line"
                filter={openFilter}
                paint={{ 'line-color': '#1a73e8', 'line-width': 1.5 }}
              />
              <Layer
                id="eli-coverage-selected-inner"
                source={COVERAGE_SOURCE}
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
                source={COVERAGE_SOURCE}
                type="line"
                filter={selectedFilter}
                paint={{ 'line-color': '#d50000', 'line-width': 2.5 }}
              />
              <Layer
                id="eli-coverage-label"
                source={COVERAGE_SOURCE}
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

              {/* Hovered shape — declared after coverage (same commit) so its layers
                  are inserted on top and the highlight is always visible. */}
              <Source id={HIGHLIGHT_SOURCE} type="geojson" data={highlightData} />
              <Layer
                id="eli-highlight-inner"
                source={HIGHLIGHT_SOURCE}
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
                source={HIGHLIGHT_SOURCE}
                type="line"
                paint={{ 'line-color': '#ff6d00', 'line-width': 3 }}
              />

              {/* Temporary glow on the hovered layer's bounding box (the box used for
                  viewport filtering). For worldwide layers this whole-world box is the
                  only feedback there is — a visible cue for "no precise coverage". */}
              <Source id="eli-bbox" type="geojson" data={bboxData} />
              <Layer
                id="eli-bbox-fill"
                source="eli-bbox"
                type="fill"
                paint={{ 'fill-color': '#9c27b0', 'fill-opacity': 0.12 }}
              />
              <Layer
                id="eli-bbox-glow"
                source="eli-bbox"
                type="line"
                paint={{
                  'line-color': '#9c27b0',
                  'line-width': 14,
                  'line-blur': 6,
                  'line-opacity': 0.5,
                }}
              />
              <Layer
                id="eli-bbox-line"
                source="eli-bbox"
                type="line"
                paint={{ 'line-color': '#9c27b0', 'line-width': 2, 'line-dasharray': [3, 2] }}
              />
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

/**
 * Coarse coverage scope, derived live from the index (no reprocessing needed).
 * `worldwide` layers have no coverage polygon — which is why they show no hover
 * outline on the map. `continental` layers span a very large bbox.
 */
function layerScope(layer: EliLayer): 'worldwide' | 'continental' | null {
  if (layer.geometryId === 'world') return 'worldwide'
  const [w, s, e, n] = layer.bbox
  if (Math.max(e - w, n - s) >= 30) return 'continental'
  return null
}
