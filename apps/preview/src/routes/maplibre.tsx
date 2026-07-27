import { loadLayersInViewport, type EliLayer } from '@osm-editor-kit/maplibre-editor-layer-index'
import {
  addEditorLayer,
  removeEditorLayer,
} from '@osm-editor-kit/maplibre-editor-layer-index/maplibre'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import maplibregl from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'
import { mapSearchSchema } from '../mapSearch'

export const Route = createFileRoute('/maplibre')({
  validateSearch: mapSearchSchema,
  component: RawMaplibreDemo,
})

const BASE_STYLE = 'https://tiles.openfreemap.org/styles/positron'

function RawMaplibreDemo() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [layers, setLayers] = useState<EliLayer[]>([])
  const [selected, setSelected] = useState<string[]>([])

  // Create the raw maplibre-gl map once; drive the layer list from its viewport.
  useEffect(() => {
    if (!container.current) return
    const map = new maplibregl.Map({
      container: container.current,
      style: BASE_STYLE,
      center: [search.lng, search.lat],
      zoom: search.zoom,
    })
    mapRef.current = map

    const refresh = () => {
      void loadLayersInViewport(map.getBounds()).then(setLayers)
    }
    const persist = () => {
      const c = map.getCenter()
      navigate({
        search: (prev) => ({
          ...prev,
          lat: round(c.lat),
          lng: round(c.lng),
          zoom: round(map.getZoom()),
        }),
        replace: true,
      })
    }
    map.on('load', refresh)
    map.on('moveend', refresh)
    map.on('moveend', persist)
    return () => map.remove()
    // Run once on mount; search is only used for the initial view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = (layer: EliLayer) => {
    const map = mapRef.current
    if (!map) return
    if (selected.includes(layer.id)) {
      removeEditorLayer(map, `eli-${layer.id}`)
      setSelected((prev) => prev.filter((id) => id !== layer.id))
    } else {
      // Raw-JS helper: adds a raster source + layer; styling via `paint`.
      addEditorLayer(map, layer, { paint: { 'raster-opacity': 0.85 } })
      setSelected((prev) => [...prev, layer.id])
    }
  }

  return (
    <>
      <aside className="sidebar">
        <p className="meta">
          Raw <code>maplibre-gl</code> via <code>addEditorLayer()</code>. {layers.length} layers
          cover this viewport.
        </p>
        {layers.map((layer) => (
          <div
            key={layer.id}
            className={`layer${selected.includes(layer.id) ? ' selected' : ''}`}
            onClick={() => toggle(layer)}
          >
            <span className="name" title={layer.name}>
              {layer.name}
            </span>
            {layer.best && <span className="badge">best</span>}
            <span className="badge">{layer.type}</span>
          </div>
        ))}
      </aside>
      <div className="map">
        <div ref={container} style={{ width: '100%', height: '100%' }} />
      </div>
    </>
  )
}

function round(n: number): number {
  return Math.round(n * 1e5) / 1e5
}
