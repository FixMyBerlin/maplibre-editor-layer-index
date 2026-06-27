# maplibre-editor-layer-index

Use the OSM [Editor Layer Index](https://github.com/osmlab/editor-layer-index) (ELI) as
background / imagery layers in **react-map-gl** and **maplibre-gl-js**. This package gives you the
**layer list** and **viewport filtering**; you keep full control of styling.

- **ESM-only**, tree-shakeable, three entrypoints: `.`, `/react`, `/maplibre`.
- Data is split into a small always-loaded **index** (metadata + bbox + country codes, no
  coordinates) and a **lazy** geometry file you only load if you draw coverage outlines.
- Viewport filtering is pure bbox math — **zero runtime geo dependencies**.

```bash
npm i maplibre-editor-layer-index
```

## react-map-gl

`useEditorLayerIndex` returns the layers covering the current viewport (recomputed on `moveend`).
You render and style them:

```tsx
import { Map, Source, Layer, MapProvider } from 'react-map-gl/maplibre'
import {
  useEditorLayerIndex,
  getRasterSourceSpec,
  getRasterLayerSpec,
} from 'maplibre-editor-layer-index/react'

function Layers() {
  const { layers } = useEditorLayerIndex({ mapId: 'main', filter: { categories: ['photo'] } })
  return layers.map((l) => (
    <Source key={l.id} id={`eli-${l.id}`} {...getRasterSourceSpec(l)}>
      <Layer {...getRasterLayerSpec(l, { paint: { 'raster-opacity': 0.8 } })} />
    </Source>
  ))
}

function App() {
  return (
    <MapProvider>
      <Map id="main" initialViewState={{ longitude: 13.4, latitude: 52.5, zoom: 10 }}>
        <Layers />
      </Map>
    </MapProvider>
  )
}
```

## Raw maplibre-gl

```ts
import { layersInViewport } from 'maplibre-editor-layer-index'
import { addEditorLayer, removeEditorLayer } from 'maplibre-editor-layer-index/maplibre'

const layers = layersInViewport(map.getBounds())
addEditorLayer(map, layers[0], { paint: { 'raster-opacity': 0.8 } })
// later: removeEditorLayer(map, `eli-${layers[0].id}`)
```

## Core API (framework-agnostic)

| Export | Purpose |
| --- | --- |
| `getLayers()` / `getLayer(id)` | All layers / one layer (metadata + bbox + countryCodes). |
| `layersInViewport(bounds, options?)` | Layers overlapping a viewport (bbox math). Accepts `[w,s,e,n]`, `{west,…}`, or a maplibre `LngLatBounds`. |
| `filterLayers(options)` | Predicate-only filter (category, type, best, overlays, countryCodes). |
| `getRasterSourceSpec(layer)` / `getRasterLayerSpec(layer, opts)` | MapLibre style specs. |
| `getGeometry(layer)` / `loadGeometries()` | Lazily load the coverage polygon(s) — only when you actually need them. |
| `getManifest()` | Build provenance (source, version, counts). |

## How the data is built

Generated at release time and committed: a weekly job fetches `imagery.geojson`, validates it with
zod (refusing to publish on schema drift), rewrites tile URLs to MapLibre raster form
(TMS `{zoom}`→`{z}`, `{-y}`→`scheme:"tms"`, WMS `{bbox}`→`{bbox-epsg-3857}`), deduplicates identical
coverage polygons, and precomputes each layer's bbox and country codes. Unsupported source types
(`bing`, `scanex`, `wms_endpoint`, `pmtiles`) are dropped.

Some layers require an API key — their tile URL keeps the `{apikey}` placeholder for you to fill.

## License

MIT. ELI imagery metadata is © its respective providers; see each layer's `attributionHtml` /
`licenseUrl`.
