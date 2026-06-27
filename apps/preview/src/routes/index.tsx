import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  getLayer,
  getRasterLayerSpec,
  getRasterSourceSpec,
  useEditorLayerIndex,
  type EliLayer,
  type FilterOptions,
} from 'maplibre-editor-layer-index/react'
import { useState } from 'react'
import { Layer, Map, MapProvider, Source } from 'react-map-gl/maplibre'
import { CATEGORIES, mapSearchSchema, type MapSearch } from '../mapSearch'

export const Route = createFileRoute('/')({
  validateSearch: mapSearchSchema,
  component: ReactMapGlDemo,
})

const MAP_ID = 'eli'
const BASE_STYLE = 'https://demotiles.maplibre.org/style.json'

function ReactMapGlDemo() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [selected, setSelected] = useState<string[]>([])
  const [opacity, setOpacity] = useState(0.85)

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const setSearch = (patch: Partial<MapSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })

  const selectedLayers = selected
    .map((id) => getLayer(id))
    .filter((l): l is EliLayer => Boolean(l))

  return (
    <MapProvider>
      <Sidebar
        search={search}
        selected={selected}
        onToggle={toggle}
        onCategory={(category) => setSearch({ category })}
      />
      <div className="map">
        <Map
          id={MAP_ID}
          initialViewState={{ longitude: search.lng, latitude: search.lat, zoom: search.zoom }}
          mapStyle={BASE_STYLE}
          style={{ width: '100%', height: '100%' }}
          onMoveEnd={(e) =>
            setSearch({
              lat: round(e.viewState.latitude),
              lng: round(e.viewState.longitude),
              zoom: round(e.viewState.zoom),
            })
          }
        >
          {selectedLayers.map((layer) => (
            <Source key={layer.id} id={`eli-${layer.id}`} {...getRasterSourceSpec(layer)}>
              <Layer
                {...getRasterLayerSpec(layer, { paint: { 'raster-opacity': opacity } })}
              />
            </Source>
          ))}
        </Map>
        {selectedLayers.length > 0 && (
          <label className="opacity">
            Opacity
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
            />
          </label>
        )}
      </div>
    </MapProvider>
  )
}

function Sidebar({
  search,
  selected,
  onToggle,
  onCategory,
}: {
  search: MapSearch
  selected: string[]
  onToggle: (id: string) => void
  onCategory: (category: MapSearch['category']) => void
}) {
  const filter: FilterOptions = search.category ? { categories: [search.category] } : {}
  // This hook reads the live `<Map id="eli">` viewport and recomputes on moveend.
  const { layers } = useEditorLayerIndex({ mapId: MAP_ID, filter })

  return (
    <aside className="sidebar">
      <p className="meta">
        {layers.length} layers cover this viewport. Click to toggle as a raster overlay.
      </p>
      <div className="controls">
        <button
          className={!search.category ? 'active' : ''}
          onClick={() => onCategory(undefined)}
        >
          all
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className={search.category === c ? 'active' : ''}
            onClick={() => onCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      {layers.map((layer) => (
        <div
          key={layer.id}
          className={`layer${selected.includes(layer.id) ? ' selected' : ''}`}
          onClick={() => onToggle(layer.id)}
        >
          <span className="name" title={layer.name}>
            {layer.name}
          </span>
          {layer.best && <span className="badge">best</span>}
          <span className="badge">{layer.type}</span>
        </div>
      ))}
    </aside>
  )
}

function round(n: number): number {
  return Math.round(n * 1e5) / 1e5
}
