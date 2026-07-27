# Using this package in iD (and Rapid)

> Status: proposal / integration guide. Nothing here is required to use the package; it documents
> how the OSM editor [iD](https://github.com/openstreetmap/iD) (and the related Rapid editor) could
> adopt `@osm-editor-kit/maplibre-editor-layer-index` to solve a governance problem and trim its imagery data.

## The problem this solves for iD

The [Editor Layer Index](https://github.com/osmlab/editor-layer-index) (ELI) has **no npm release**
and its project governance doesn't publish one. So iD vendors it as a git dependency pinned to a
`gh-pages` commit:

```jsonc
// iD package.json
"@openstreetmap/editor-layer-index": "github:osmlab/editor-layer-index#gh-pages"
```

and `scripts/update_imagery.js` reads `node_modules/@openstreetmap/editor-layer-index/imagery.geojson`
at build time, transforms it, and commits a **7.6 MB `data/imagery.json`** (5.2 MB minified) that is
fetched at runtime. Every refresh is a manual bump of the pinned commit.

`@osm-editor-kit/maplibre-editor-layer-index` is a **real, versioned npm package** built from ELI on a **weekly
schedule** with validation (zod), npm **provenance**, and changesets. Pointing iD at it replaces the
pinned-commit + bespoke-fetch step with a normal, governed dependency — and, as a bonus, gives iD
**deduplicated coverage geometries** and a **precomputed area↔layer map**.

## Data layout (continent-sharded)

Unlike a monolithic `index.json`, the bundled data is split so consumers pay only for what they load:

| File                          | Loaded when      | Contents                                                                                     |
| ----------------------------- | ---------------- | -------------------------------------------------------------------------------------------- |
| `locator.json`                | always (bundled) | Slim filter fields: `bbox`, `countryCodes`, `geometryId`, `continents`, … — **no tile URLs** |
| `details/<continent>.json`    | lazy             | Per-layer `urlTemplate`, `tiles`, attribution, projections, dates                            |
| `geometries/<continent>.json` | lazy             | Deduplicated coverage polygons keyed by `geometryId`                                         |
| `byCountry.json`              | lazy             | ISO code → layer ids (plus a `"worldwide"` bucket)                                           |
| `shards.json`                 | always (bundled) | Continent list and ISO→continent router metadata                                             |

At runtime, `getLayers()` returns `EliLocatorLayer[]` — enough to filter by viewport or country, but
**not** enough to build an iD imagery source (no `urlTemplate` yet). Merge in detail shards to get a
full `EliLayer`:

- **`getLayerHydrated(id)`** — load the layer's continent shards and return one hydrated layer.
- **`ensureDetailsForViewport(bounds)` + `hydrateLayer(row)`** — load `world` plus the regional
  detail shard for a map view, then merge each locator row.
- **`loadLayersInViewport(bounds)`** — filter synchronously, load the needed detail shards, return
  `EliLayer[]` ready for templating.

Geometries follow the same pattern: **`loadGeometries()`** loads and merges all continent geometry
shards (fine for iD's one-shot build script), or **`getGeometry(layer)`** resolves a single polygon
after loading only that layer's geometry shards.

## What iD keeps (so the change stays small)

iD does **not** need this package's renderer logic. It keeps:

- **Its own tile-template substitution** (`{zoom}`, `{-y}`, `{switch:…}`, `{u}` quadkey, WMS
  `{proj}`/`{wkid}`/`{bbox}`). Use the raw [`urlTemplate`](#field-mapping) field on a hydrated
  `EliLayer` — _not_ `tiles`, which is pre-converted to MapLibre form (`{z}`, `{bbox-epsg-3857}`).
- **Its own spatial index** (`which-polygon` in `modules/renderer/background.js`), or it can switch to
  the precomputed [`byCountry`](#option-b-precomputed-arealayer-map) map.
- **Its `data/manual_imagery.json`** for sources this package drops (Bing, Mapbox — see
  [gaps](#gaps--mitigations)).

So adoption is essentially: **swap the data source in `update_imagery.js`**, keep the rest.

## What iD gains

| Gain                  | How                                                                                                                                                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Governed releases     | A normal npm dependency with semver, provenance, weekly auto-update — no pinned `gh-pages` commit.                                                                                                                                      |
| Deduplicated polygons | ELI repeats identical coverage polygons across many sources. This package stores **947 unique geometries** for **1562 geometried layers** (~**1.65× fewer** polygon copies). iD currently inlines a `polygon` per source with no dedup. |
| Precomputed metadata  | Each layer ships a precomputed `bbox`, polygon-accurate `countryCodes`, and a `geometryId` (the dedup key). Plus a `byCountry` index. iD can skip rebuilding a spatial index for the common "what's available in this country" case.    |
| Validated, typed data | zod-validated at build (the release fails on upstream schema drift); full TypeScript types.                                                                                                                                             |

## Field mapping

`update_imagery.js` builds an iD imagery source from each ELI feature. Here's the equivalent from a
hydrated **`EliLayer`** (locator row + loaded details):

| iD source field | From `EliLayer`                     | Notes                                                                                             |
| --------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| `id`            | `id`                                | identical                                                                                         |
| `name`          | `name`                              | identical                                                                                         |
| `type`          | `type`                              | `tms` \| `wms` \| `wmts`. iD also has `bing` — not in this package (see gaps).                    |
| `template`      | **`urlTemplate`**                   | the **raw** ELI template — do not use `tiles`. Requires hydration (see below).                    |
| `category`      | `category`                          | identical                                                                                         |
| `projection`    | `availableProjections`              | iD picks one (prefers `EPSG:3857`); same input. Requires hydration.                               |
| `zoomExtent`    | `[minzoom ?? 0, maxzoom ?? 22]`     | iD's default range (on locator row — no hydration needed)                                         |
| `polygon`       | outer rings of `getGeometry(layer)` | resolve via `geometryId` → `geometries/<continent>.json` (deduped); take outer rings to match iD. |
| `terms_text`    | `attributionText`                   | raw ELI `attribution.text` — requires hydration                                                   |
| `terms_url`     | `attributionUrl`                    | raw ELI `attribution.url` — requires hydration                                                    |
| `terms_html`    | `attributionHtml`                   | ELI `attribution.html`, or a `text`+`url` link this package builds when only those exist          |
| `startDate`     | `startDate`                         | ELI `start_date` — requires hydration                                                             |
| `endDate`       | `endDate`                           | ELI `end_date` — requires hydration                                                               |
| `best`          | `best`                              | identical                                                                                         |
| `overlay`       | `overlay`                           | identical                                                                                         |
| `icon`          | `icon`                              | identical — requires hydration                                                                    |
| `tileSize`      | `tileSize`                          | identical                                                                                         |

The mapping is now **lossless** for the fields iD uses (the only ELI types this package omits are
non-MapLibre ones — see [gaps](#gaps--mitigations)).

## Build-time adapter sketch

iD's build is Node ESM (esbuild), so it can `import` this ESM-only package directly. Replace the ELI
read in `scripts/update_imagery.js` with:

```js
import {
  getLayers,
  getShardsMeta,
  ensureDetailsForContinents,
  hydrateLayers,
  loadGeometries,
} from '@osm-editor-kit/maplibre-editor-layer-index'

// Build script needs every layer fully hydrated — load all detail shards once.
const locatorRows = getLayers()
await ensureDetailsForContinents(getShardsMeta().continents)
const layers = hydrateLayers(locatorRows)

const geometries = await loadGeometries() // merges all geometry shards

function outerRings(geometry) {
  if (!geometry) return undefined
  if (geometry.type === 'Polygon') return [geometry.coordinates[0]]
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.map((rings) => rings[0])
  return undefined
}

const idImagery = layers.map((layer) => ({
  id: layer.id,
  name: layer.name,
  type: layer.type,
  template: layer.urlTemplate, // raw template — iD does its own substitution
  category: layer.category,
  projection: layer.availableProjections?.includes('EPSG:3857')
    ? 'EPSG:3857'
    : layer.availableProjections?.[0],
  zoomExtent: [layer.minzoom ?? 0, layer.maxzoom ?? 22],
  polygon: layer.geometryId === 'world' ? undefined : outerRings(geometries[layer.geometryId]),
  terms_text: layer.attributionText,
  terms_url: layer.attributionUrl,
  terms_html: layer.attributionHtml,
  startDate: layer.startDate,
  endDate: layer.endDate,
  best: layer.best || undefined,
  overlay: layer.overlay || undefined,
  icon: layer.icon,
}))

// then merge data/manual_imagery.json exactly as today (Bing, Mapbox, …)
```

The pinned-commit ELI devDependency and the bespoke GeoJSON transform go away; the rest of iD's
pipeline (minify, i18n, runtime `which-polygon`) is untouched.

For a **runtime** viewport query instead of a full build export, skip loading every shard and use
`loadLayersInViewport(bounds)` — it filters on the always-loaded locator, fetches only the
`world` + regional detail shards for that view, and returns hydrated `EliLayer[]`.

### Keeping polygons deduplicated end-to-end (optional, bigger win)

The mapping above re-inlines a `polygon` per source, so iD's `imagery.json` stays the same size. To
actually shrink it, emit iD's data in two parts mirroring this package:

- a `geometries` table keyed by `geometryId` (write `geometries` straight through), and
- imagery records that carry `geometryId` instead of an inline `polygon`.

Then build the runtime `which-polygon` index once over the **unique** geometries (947 instead of
1562 polygons) and map matches back to layer ids via `geometryId`. This is the "less data due to
de-duplicated polygons" win, and it shrinks the runtime spatial index too.

## Option B: precomputed area↔layer map

If iD wants to avoid building a `which-polygon` index for the common case, this package ships a
precomputed `byCountry` map (ISO code → layer ids, plus a `"worldwide"` bucket):

```js
import {
  layersForCountry,
  ensureDetailsForContinents,
  hydrateLayers,
} from '@osm-editor-kit/maplibre-editor-layer-index'

// Locator rows covering Germany + always-on worldwide layers (no tile URLs yet).
const locatorRows = await layersForCountry('DE')

// Hydrate only the detail shards those layers need.
const continents = [...new Set(locatorRows.flatMap((row) => row.continents))]
await ensureDetailsForContinents(continents)
const layers = hydrateLayers(locatorRows)

// Or hydrate a single layer by id:
// const layer = await getLayerHydrated('some-layer-id')
```

iD already resolves the map view to a country elsewhere (it bundles `country-coder`), so this is a
ready-made fast path. `which-polygon` is still the right tool for precise viewport/extent queries;
`byCountry` is the cheap coarse filter. For viewport-based lists with hydration built in, prefer
`loadLayersInViewport(bounds)`.

## Gaps & mitigations

| Gap                            | Why                                                                                                | Mitigation                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **`bing`** sources are dropped | This package only ships MapLibre-renderable raster types (`tms`/`wms`/`wmts`); Bing uses quadkeys. | Keep Bing in iD's `manual_imagery.json` (it already lives there). |
| **`encrypted` / `overzoom`**   | iD-specific, not ELI.                                                                              | Continue handling in iD (`manual_imagery.json` / special cases).  |

(`start_date`/`end_date` and structured `attribution.text`/`url` used to be gaps; they're now
shipped, so the mapping above is lossless for iD's fields.)

### A note on polygon holes

iD's `update_imagery.js` keeps only **outer rings** today (`coordinates[0]` for `Polygon`, the first
ring of each part for `MultiPolygon`), so the `outerRings()` helper above reproduces iD's **current**
behavior exactly — adopting this package changes nothing there.

It's worth knowing the holes are real, though: in the current data **20 of 947 unique geometries
(~2%, ≈32 layers)** have interior rings — e.g. _Digitaal Vlaanderen GRB_, whose Flanders coverage
excludes the Brussels-Capital enclave, or several Danish SDFI layers. Dropping a hole makes the layer
appear to cover the excluded area.

This package **keeps full geometry** in continent-sharded `geometries/<continent>.json`, and its
build-time `countryCodes` precompute **respects holes** (a point inside a hole isn't attributed to
the layer) — so the bundled metadata is hole-accurate. If iD ever wants hole-accurate coverage too,
pass the full rings (not just the outer ring) into `which-polygon`; it indexes inner rings as holes
correctly.

## Summary

- **Minimal change:** swap the data source in one build script; iD keeps its templating, spatial
  index, and manual overrides. Hydrate detail shards before reading `urlTemplate` or attribution.
- **Governance:** a versioned, provenance-signed, weekly-updated npm package instead of a pinned ELI
  commit.
- **Less data:** dedup collapses 1562 polygons to 947 unique; optionally reference them by
  `geometryId` to shrink `imagery.json` and the runtime index. Continent sharding keeps lazy
  consumers from downloading the full geometry/detail payload up front.
- **Precompute:** `bbox`, polygon-accurate `countryCodes`, `geometryId`, and a `byCountry` map come
  ready-made on the always-loaded locator; tile URLs and polygons load on demand.
