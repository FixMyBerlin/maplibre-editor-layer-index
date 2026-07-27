# [@osm-editor-kit/maplibre-editor-layer-index](https://npmx.dev/package/@osm-editor-kit/maplibre-editor-layer-index)

Use the OSM [Editor Layer Index](https://github.com/osmlab/editor-layer-index) (ELI) as
background / imagery layers in **react-map-gl** and **maplibre-gl-js**. This package gives you the
**layer list** and **viewport filtering**; you keep full control of styling.

- **Package page:** [npmx.dev/package/@osm-editor-kit/maplibre-editor-layer-index](https://npmx.dev/package/@osm-editor-kit/maplibre-editor-layer-index)
- **Live preview:** [osm-editor-kit.github.io/maplibre-editor-layer-index](https://osm-editor-kit.github.io/maplibre-editor-layer-index/)
- **ESM-only**, tree-shakeable, three entrypoints: `.`, `/react`, `/maplibre`.
- Data is split into an always-loaded **locator** (~820 KB: bbox + country codes + continents, no
  tile URLs), **continent-sharded details** (lazy from map center), and **continent-sharded
  geometries** (lazy, only for coverage outlines).
- Viewport filtering is pure bbox math — **zero runtime geo dependencies**.

```bash
npm i @osm-editor-kit/maplibre-editor-layer-index
```

## react-map-gl

`useEditorLayerIndex` returns the layers covering the current viewport (recomputed on `moveend`).
You render and style them:

Keep `<Source>` and `<Layer>` **flat** (separate siblings, the layer referencing the source by
id) — react-map-gl's recommended pattern, not nested:

```tsx
import { Fragment } from 'react'
import { Layer, Map, MapProvider, Source } from 'react-map-gl/maplibre'
import {
  getRasterLayerSpec,
  getRasterSourceSpec,
  useEditorLayerIndex,
} from '@osm-editor-kit/maplibre-editor-layer-index/react'

function Layers() {
  const { layers, status } = useEditorLayerIndex({
    mapId: 'main',
    filter: { categories: ['photo'] },
  })
  if (status === 'loading') return null
  return layers.map((l) => (
    <Fragment key={l.id}>
      <Source id={`eli-${l.id}`} {...getRasterSourceSpec(l)} />
      <Layer
        {...getRasterLayerSpec(l, { source: `eli-${l.id}`, paint: { 'raster-opacity': 0.8 } })}
      />
    </Fragment>
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
import { loadLayersInViewport } from '@osm-editor-kit/maplibre-editor-layer-index'
import {
  addEditorLayer,
  removeEditorLayer,
} from '@osm-editor-kit/maplibre-editor-layer-index/maplibre'

const layers = await loadLayersInViewport(map.getBounds())
addEditorLayer(map, layers[0], { paint: { 'raster-opacity': 0.8 } })
// later: removeEditorLayer(map, `eli-${layers[0].id}`)
```

Sync bbox filtering still works without loading tile URLs:

```ts
import { layersInViewport } from '@osm-editor-kit/maplibre-editor-layer-index'

const locatorRows = layersInViewport(map.getBounds()) // EliLocatorLayer[] — no tiles yet
```

## Core API (framework-agnostic)

| Export                                                           | Purpose                                                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `getLayers()` / `getLayer(id)`                                   | Slim locator rows (metadata + bbox + countryCodes + continents). No tile URLs until hydrated.    |
| `layersInViewport(bounds, options?)`                             | Sync locator rows overlapping a viewport (bbox math).                                            |
| `loadLayersInViewport(bounds, options?)`                         | Async: ensure continent detail shards for the viewport, return hydrated `EliLayer[]` with tiles. |
| `filterLayers(options)`                                          | Predicate-only filter on locator rows.                                                           |
| `getRasterSourceSpec(layer)` / `getRasterLayerSpec(layer, opts)` | MapLibre style specs (needs a hydrated layer).                                                   |
| `getGeometry(layer)` / `loadGeometries()`                        | Lazily load continent geometry shards — only when you draw coverage.                             |
| `getManifest()`                                                  | Build provenance (source, version, counts).                                                      |

## Other renderers (iD, Rapid, Leaflet)

Same package, **root entry only** — do not import `/maplibre` or `/react`. Hydrate details, then use
the raw ELI `urlTemplate` for your own tile substitution.

```ts
import {
  getLayers,
  getLayerHydrated,
  loadGeometries,
} from '@osm-editor-kit/maplibre-editor-layer-index'

const locators = getLayers()
const layer = await getLayerHydrated(locators[0]!.id)
// template: layer.urlTemplate  — not layer.tiles
const geometries = await loadGeometries() // optional; keyed by layer.geometryId
```

Full iD/Rapid adapter sketch (field mapping, polygons, gaps):  
[docs/iD-integration.md](../../docs/iD-integration.md).

## Filtering by country (and the bbox caveat)

Viewport filtering is **bbox overlap** — pure arithmetic, no geometry loaded. The tradeoff: a
source whose bounding box is huge but whose real coverage is small will over-match. The classic
case is US TIGER, whose territories straddle the antimeridian, so its bbox spans the whole globe
and overlaps e.g. Germany.

The fix is a precomputed, polygon-accurate `countryCodes` per layer (sampled from the actual
polygon at build time, not the bbox). Pass the viewport's country to drop the false matches:

```ts
import { iso1A2Code } from '@rapideditor/country-coder' // your call, not a dependency of this pkg

const country = iso1A2Code(map.getCenter().toArray()) // e.g. 'DE'
const layers = layersInViewport(map.getBounds(), { countryCodes: country ? [country] : undefined })
// TIGER (codes: US/CA) is dropped in DE; worldwide layers always pass.
```

Worldwide layers (`bbox: [-180,-90,180,90]`, empty `countryCodes`) match every viewport by design
and always pass the country filter. Use `includeWorldwide: false` to drop them.

> Antimeridian: bbox overlap does not wrap ±180°, so a layer crossing the antimeridian may be
> missed at the seam. Acceptable for v1.

## How the data is built

Generated at release time and committed: a weekly job fetches `imagery.geojson`, validates it with
zod (refusing to publish on schema drift), rewrites tile URLs to MapLibre raster form
(TMS `{zoom}`→`{z}`, `{-y}`→`scheme:"tms"`, WMS `{bbox}`→`{bbox-epsg-3857}`), deduplicates identical
coverage polygons, precomputes bbox / country codes / continents, and writes:

- `locator.json` — always-loaded slim index
- `details/<continent>.json` — lazy tile/attribution shards
- `geometries/<continent>.json` — lazy polygon shards
- `shards.json` — ISO→continent router metadata
- `byCountry.json` — ISO→layer id lookup

Unsupported source types (`bing`, `scanex`, `wms_endpoint`, `pmtiles`) are dropped.

**Publish note:** the npm tarball includes every shard (region-specific install packages are not
used). Runtime code-splitting means a Berlin map session typically downloads locator + `world` +
`europe` details — not the full ~11 MB of worldwide geometries.

## API keys

A handful of layers need an API key (e.g. Mapbox, Thunderforest). Each such layer lists what it
needs in `layer.requiresKeys` (typed via `EliApiKey`), and the full set is `eliApiKeyNames`.

By default these layers are **excluded** — the list stays clean and actionable, with no broken
tiles and no need to sniff URLs for `{apikey}`. Provide the keys to opt them in; the same keys are
substituted into the tile URLs by the spec helpers:

```ts
// Without apiKeys: key-requiring layers are filtered out entirely.
const layers = layersInViewport(bounds, { apiKeys: { apikey: 'pk.your-token' } })
const source = getRasterSourceSpec(layer, { apiKeys: { apikey: 'pk.your-token' } })

// react-map-gl: pass via the hook's filter
useEditorLayerIndex({ filter: { apiKeys: { apikey: 'pk.your-token' } } })
```

## High-DPI / retina (WMS)

MapLibre's `{bbox-epsg-3857}` always covers a **logical** 256 CSS-pixel mercator tile. ELI WMS
URLs bake `WIDTH=256&HEIGHT=256` for that bbox, which looks soft on retina screens.

`getRasterSourceSpec` (and `addEditorLayer`) scales WMS `WIDTH`/`HEIGHT` by device pixel ratio
(capped at 2×) while keeping `tileSize: 256`, so cadastral layers like ALKIS stay sharp.
Override with `{ pixelRatio: 1 }` if you need the 1× request size.

TMS/WMTS endpoints are unchanged — they only get sharper when the server offers `{ratio}` / `@2x`
tiles (MapLibre substitutes `{ratio}` itself).

## Overzoom

ELI `maxzoom` goes on the **source** (`getRasterSourceSpec`) so MapLibre reuses the last tile
level when you zoom further in. It is **not** copied onto the style layer by default — layer
`maxzoom` would hide the imagery instead of overzooming. Pass `{ clampMaxzoom: true }` to
`getRasterLayerSpec` / `addEditorLayer` if you want the old hide-past-max behaviour.

## Notes

- **Attribution is upstream HTML.** `attributionHtml` is passed through from ELI and is intended for
  MapLibre's `attribution` control (safe). If you render it yourself, sanitize it first — don't feed
  it to `dangerouslySetInnerHTML` unchecked.
- **`check-exports` ignores three `attw` rules** (`cjs-resolves-to-esm`, `internal-resolution-error`,
  `no-resolution`) intentionally: this is an ESM-only package, so the CJS/resolution warnings don't
  apply.

## License

MIT. ELI imagery metadata is © its respective providers; see each layer's `attributionHtml` /
`licenseUrl`.
