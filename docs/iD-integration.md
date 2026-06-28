# Using this package in iD (and Rapid)

> Status: proposal / integration guide. Nothing here is required to use the package; it documents
> how the OSM editor [iD](https://github.com/openstreetmap/iD) (and the related Rapid editor) could
> adopt `maplibre-editor-layer-index` to solve a governance problem and trim its imagery data.

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

`maplibre-editor-layer-index` is a **real, versioned npm package** built from ELI on a **weekly
schedule** with validation (zod), npm **provenance**, and changesets. Pointing iD at it replaces the
pinned-commit + bespoke-fetch step with a normal, governed dependency — and, as a bonus, gives iD
**deduplicated coverage geometries** and a **precomputed area↔layer map**.

## What iD keeps (so the change stays small)

iD does **not** need this package's renderer logic. It keeps:

- **Its own tile-template substitution** (`{zoom}`, `{-y}`, `{switch:…}`, `{u}` quadkey, WMS
  `{proj}`/`{wkid}`/`{bbox}`). Use the raw [`urlTemplate`](#field-mapping) field — _not_ `tiles`,
  which is pre-converted to MapLibre form (`{z}`, `{bbox-epsg-3857}`).
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

`update_imagery.js` builds an iD imagery source from each ELI feature. Here's the equivalent from an
`EliLayer` (this package):

| iD source field | From `EliLayer`                     | Notes                                                                                 |
| --------------- | ----------------------------------- | ------------------------------------------------------------------------------------- |
| `id`            | `id`                                | identical                                                                             |
| `name`          | `name`                              | identical                                                                             |
| `type`          | `type`                              | `tms` \| `wms` \| `wmts`. iD also has `bing` — not in this package (see gaps).        |
| `template`      | **`urlTemplate`**                   | the **raw** ELI template — do not use `tiles`.                                        |
| `category`      | `category`                          | identical enum                                                                        |
| `projection`    | `availableProjections`              | iD picks one (prefers `EPSG:3857`); same input.                                       |
| `zoomExtent`    | `[minzoom ?? 0, maxzoom ?? 22]`     | iD's default range                                                                    |
| `polygon`       | outer rings of `getGeometry(layer)` | resolve via `geometryId` → `geometries.json` (deduped); take outer rings to match iD. |
| `terms_html`    | `attributionHtml`                   | this package collapses ELI `attribution.{text,url,html}` into one HTML string.        |
| `terms_url`     | `licenseUrl`                        | closest equivalent; see gaps.                                                         |
| `best`          | `best`                              | identical                                                                             |
| `overlay`       | `overlay`                           | identical                                                                             |
| `icon`          | `icon`                              | identical                                                                             |
| `tileSize`      | `tileSize`                          | identical                                                                             |

## Build-time adapter sketch

iD's build is Node ESM (esbuild), so it can `import` this ESM-only package directly. Replace the ELI
read in `scripts/update_imagery.js` with:

```js
import { getLayers, loadGeometries } from 'maplibre-editor-layer-index'

const layers = getLayers()
const geometries = await loadGeometries() // deduped table, keyed by geometryId

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
  terms_html: layer.attributionHtml,
  terms_url: layer.licenseUrl,
  best: layer.best || undefined,
  overlay: layer.overlay || undefined,
  icon: layer.icon,
}))

// then merge data/manual_imagery.json exactly as today (Bing, Mapbox, …)
```

The pinned-commit ELI devDependency and the bespoke GeoJSON transform go away; the rest of iD's
pipeline (minify, i18n, runtime `which-polygon`) is untouched.

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
import { layersForCountry } from 'maplibre-editor-layer-index'

// region layers covering Germany + always-on worldwide layers
const layers = await layersForCountry('DE')
```

iD already resolves the map view to a country elsewhere (it bundles `country-coder`), so this is a
ready-made fast path. `which-polygon` is still the right tool for precise viewport/extent queries;
`byCountry` is the cheap coarse filter.

## Gaps & mitigations

| Gap                                                              | Why                                                                                                | Mitigation                                                                                                            |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **`bing`** sources are dropped                                   | This package only ships MapLibre-renderable raster types (`tms`/`wms`/`wmts`); Bing uses quadkeys. | Keep Bing in iD's `manual_imagery.json` (it already lives there).                                                     |
| **`start_date` / `end_date`** not exposed                        | Not needed for MapLibre rendering.                                                                 | Add as fields if iD wants them — cheap; open an issue.                                                                |
| **`terms_text` / `terms_url`** are merged into `attributionHtml` | This package targets MapLibre's single `attribution` string.                                       | Use `attributionHtml` as `terms_html`; `licenseUrl` as `terms_url`. Structured attribution can be re-added if needed. |
| **Polygon holes**                                                | iD keeps only outer rings; this package keeps full geometry.                                       | `outerRings()` above discards holes to match iD exactly.                                                              |
| **`encrypted` / `overzoom`**                                     | iD-specific, not ELI.                                                                              | Continue handling in iD (`manual_imagery.json` / special cases).                                                      |

Most of these are a few extra build-time fields away — if iD wants to adopt this, the maintainers
here are happy to add `startDate`/`endDate` and structured `attribution` so the mapping is lossless.

## Summary

- **Minimal change:** swap the data source in one build script; iD keeps its templating, spatial
  index, and manual overrides.
- **Governance:** a versioned, provenance-signed, weekly-updated npm package instead of a pinned ELI
  commit.
- **Less data:** dedup collapses 1562 polygons to 947 unique; optionally reference them by
  `geometryId` to shrink `imagery.json` and the runtime index.
- **Precompute:** `bbox`, polygon-accurate `countryCodes`, `geometryId`, and a `byCountry` map come
  ready-made.
