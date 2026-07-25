import type { Geometry } from 'geojson'
import type {
  EliByCountry,
  EliContinent,
  EliDetailsShard,
  EliGeometries,
  EliLayer,
  EliLayerDetails,
  EliLayerType,
  EliLocatorLayer,
  EliShardsMeta,
} from '../src/core/types'
import { CONTINENTS, continentsForCountryCodes, countryToContinent } from './continents'
import { countryCodesForGeometry } from './countries'
import { geometryBBox, geometryId, WORLD_BBOX, WORLD_GEOMETRY_ID } from './geometry'
import { eliFeatureCollectionSchema, type EliFeature } from './schema'
import { convertTileUrl } from './url'

/** ELI types we can render as MapLibre raster sources. Others are dropped. */
const SUPPORTED_TYPES = new Set<EliLayerType>(['tms', 'wms', 'wmts'])

/** Placeholders MapLibre fills itself — anything else left in a URL is a key/param. */
const STANDARD_TOKENS = new Set(['z', 'x', 'y', 'bbox-epsg-3857'])

/** Distinct `{placeholder}` names still present in the URLs (e.g. `apikey`). */
function extractRequiredKeys(tiles: string[]): string[] {
  const keys = new Set<string>()
  for (const url of tiles) {
    for (const match of url.match(/\{([^}]+)\}/g) ?? []) {
      const name = match.slice(1, -1)
      if (!STANDARD_TOKENS.has(name)) keys.add(name)
    }
  }
  return [...keys].sort()
}

function buildAttributionHtml(feature: EliFeature): string | undefined {
  const a = feature.properties.attribution
  if (!a) return undefined
  if (a.html) return a.html
  if (a.text && a.url) return `<a href="${a.url}" target="_blank" rel="noopener">${a.text}</a>`
  return a.text ?? undefined
}

function emptyContinentRecord<T>(): Record<EliContinent, T> {
  return Object.fromEntries(CONTINENTS.map((c) => [c, {}])) as Record<EliContinent, T>
}

function toLayerDetails(layer: EliLayer): EliLayerDetails {
  return {
    tiles: layer.tiles,
    urlTemplate: layer.urlTemplate,
    availableProjections: layer.availableProjections,
    attributionHtml: layer.attributionHtml,
    attributionText: layer.attributionText,
    attributionUrl: layer.attributionUrl,
    licenseUrl: layer.licenseUrl,
    icon: layer.icon,
    startDate: layer.startDate,
    endDate: layer.endDate,
  }
}

function toLocatorLayer(layer: EliLayer, continents: EliContinent[]): EliLocatorLayer {
  return {
    id: layer.id,
    name: layer.name,
    type: layer.type,
    category: layer.category,
    best: layer.best,
    overlay: layer.overlay,
    minzoom: layer.minzoom,
    maxzoom: layer.maxzoom,
    tileSize: layer.tileSize,
    scheme: layer.scheme,
    geometryId: layer.geometryId,
    bbox: layer.bbox,
    countryCodes: layer.countryCodes,
    requiresKeys: layer.requiresKeys,
    continents,
  }
}

function shardLayers(
  layers: EliLayer[],
  geometries: EliGeometries,
): {
  locatorLayers: EliLocatorLayer[]
  detailsByContinent: Record<EliContinent, EliDetailsShard>
  geometriesByContinent: Record<EliContinent, EliGeometries>
  shardsMeta: EliShardsMeta
} {
  const locatorLayers: EliLocatorLayer[] = []
  const detailsByContinent = emptyContinentRecord<EliDetailsShard>()
  const geometriesByContinent = emptyContinentRecord<EliGeometries>()
  const geometryContinents = new Map<string, Set<EliContinent>>()

  for (const layer of layers) {
    const continents = continentsForCountryCodes(layer.countryCodes)
    locatorLayers.push(toLocatorLayer(layer, continents))

    const details = toLayerDetails(layer)
    for (const continent of continents) {
      detailsByContinent[continent][layer.id] = details
    }

    if (layer.geometryId === WORLD_GEOMETRY_ID) continue
    let set = geometryContinents.get(layer.geometryId)
    if (!set) {
      set = new Set()
      geometryContinents.set(layer.geometryId, set)
    }
    for (const continent of continents) {
      if (continent !== 'world') set.add(continent)
    }
  }

  for (const [gid, continents] of geometryContinents) {
    const geometry = geometries[gid]
    if (!geometry) continue
    for (const continent of continents) {
      geometriesByContinent[continent][gid] = geometry
    }
  }

  return {
    locatorLayers,
    detailsByContinent,
    geometriesByContinent,
    shardsMeta: {
      continents: [...CONTINENTS],
      countryToContinent: { ...countryToContinent },
    },
  }
}

export type TransformResult = {
  layers: EliLayer[]
  geometries: EliGeometries
  locatorLayers: EliLocatorLayer[]
  detailsByContinent: Record<EliContinent, EliDetailsShard>
  geometriesByContinent: Record<EliContinent, EliGeometries>
  shardsMeta: EliShardsMeta
  /** ISO region code → layer ids (plus a `"worldwide"` bucket). */
  byCountry: EliByCountry
  /** Distinct API-key placeholder names across all layers (e.g. `["apikey"]`). */
  apiKeys: string[]
  counts: {
    upstream: number
    published: number
    geometries: number
    dropped: Record<string, number>
  }
}

/**
 * Validate a raw ELI FeatureCollection and transform it into the published shape:
 * MapLibre-ready layer records + a deduplicated geometry table + continent shards.
 *
 * Throws (failing the build) if the FeatureCollection doesn't match the schema —
 * we never publish data we can't trust.
 */
export function transform(raw: unknown): TransformResult {
  const collection = eliFeatureCollectionSchema.parse(raw)

  const layers: EliLayer[] = []
  const geometries: EliGeometries = {}
  // Country codes are a property of the geometry, so compute once per unique
  // geometry and reuse across the (often many) layers that share it.
  const countryCache = new Map<string, string[]>()
  const dropped: Record<string, number> = {}

  for (const feature of collection.features) {
    const { type } = feature.properties
    if (!SUPPORTED_TYPES.has(type as EliLayerType)) {
      dropped[type] = (dropped[type] ?? 0) + 1
      continue
    }

    const layerType = type as EliLayerType
    const tileSize = feature.properties.tile_size ?? 256
    const { tiles, scheme } = convertTileUrl(feature.properties.url, layerType, tileSize)
    const requiresKeys = extractRequiredKeys(tiles)

    let gid = WORLD_GEOMETRY_ID
    let bbox = WORLD_BBOX
    let countryCodes: string[] = []
    if (feature.geometry) {
      const geometry = feature.geometry as unknown as Geometry
      gid = geometryId(geometry)
      bbox = geometryBBox(geometry)
      if (!geometries[gid]) geometries[gid] = geometry
      let cached = countryCache.get(gid)
      if (!cached) {
        cached = countryCodesForGeometry(geometry)
        countryCache.set(gid, cached)
      }
      countryCodes = cached
    }

    layers.push({
      id: feature.properties.id,
      name: feature.properties.name,
      type: layerType,
      category: feature.properties.category,
      best: feature.properties.best ?? false,
      overlay: feature.properties.overlay ?? false,
      minzoom: feature.properties.min_zoom,
      maxzoom: feature.properties.max_zoom,
      tiles,
      tileSize,
      scheme: scheme === 'tms' ? 'tms' : undefined,
      urlTemplate: feature.properties.url,
      availableProjections: feature.properties.available_projections,
      attributionHtml: buildAttributionHtml(feature),
      attributionText: feature.properties.attribution?.text,
      attributionUrl: feature.properties.attribution?.url,
      licenseUrl: feature.properties.license_url,
      icon: feature.properties.icon,
      startDate: feature.properties.start_date,
      endDate: feature.properties.end_date,
      geometryId: gid,
      bbox,
      countryCodes,
      requiresKeys,
      continents: [],
    })
  }

  // Deterministic ordering so regenerated output diffs only on real changes.
  layers.sort((a, b) => a.id.localeCompare(b.id))

  const { locatorLayers, detailsByContinent, geometriesByContinent, shardsMeta } = shardLayers(
    layers,
    geometries,
  )

  // Sync continents onto full layers (locator is authoritative after sharding).
  for (let i = 0; i < layers.length; i++) {
    layers[i]!.continents = locatorLayers[i]!.continents
  }

  // Inverted area↔layer map (sorted keys/values for stable output).
  const byCountry: EliByCountry = {}
  for (const layer of layers) {
    const buckets = layer.countryCodes.length > 0 ? layer.countryCodes : ['worldwide']
    for (const code of buckets) (byCountry[code] ??= []).push(layer.id)
  }
  const sortedByCountry: EliByCountry = {}
  for (const code of Object.keys(byCountry).sort()) sortedByCountry[code] = byCountry[code]!

  const apiKeys = [...new Set(layers.flatMap((l) => l.requiresKeys))].sort()

  return {
    layers,
    geometries,
    locatorLayers,
    detailsByContinent,
    geometriesByContinent,
    shardsMeta,
    byCountry: sortedByCountry,
    apiKeys,
    counts: {
      upstream: collection.features.length,
      published: layers.length,
      geometries: Object.keys(geometries).length,
      dropped,
    },
  }
}
