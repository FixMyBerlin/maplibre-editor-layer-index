import type { Geometry } from 'geojson'
import type { EliGeometries, EliLayer, EliLayerType } from '../src/core/types'
import { countryCodesForBBox } from './countries'
import { geometryBBox, geometryId, WORLD_BBOX, WORLD_GEOMETRY_ID } from './geometry'
import { eliFeatureCollectionSchema, type EliFeature } from './schema'
import { convertTileUrl } from './url'

/** ELI types we can render as MapLibre raster sources. Others are dropped. */
const SUPPORTED_TYPES = new Set<EliLayerType>(['tms', 'wms', 'wmts'])

function buildAttributionHtml(feature: EliFeature): string | undefined {
  const a = feature.properties.attribution
  if (!a) return undefined
  if (a.html) return a.html
  if (a.text && a.url) return `<a href="${a.url}" target="_blank" rel="noopener">${a.text}</a>`
  return a.text ?? undefined
}

export type TransformResult = {
  layers: EliLayer[]
  geometries: EliGeometries
  counts: {
    upstream: number
    published: number
    geometries: number
    dropped: Record<string, number>
  }
}

/**
 * Validate a raw ELI FeatureCollection and transform it into the published shape:
 * MapLibre-ready layer records + a deduplicated geometry table.
 *
 * Throws (failing the build) if the FeatureCollection doesn't match the schema —
 * we never publish data we can't trust.
 */
export function transform(raw: unknown): TransformResult {
  const collection = eliFeatureCollectionSchema.parse(raw)

  const layers: EliLayer[] = []
  const geometries: EliGeometries = {}
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

    let gid = WORLD_GEOMETRY_ID
    let bbox = WORLD_BBOX
    let countryCodes: string[] = []
    if (feature.geometry) {
      const geometry = feature.geometry as unknown as Geometry
      gid = geometryId(geometry)
      bbox = geometryBBox(geometry)
      countryCodes = countryCodesForBBox(bbox)
      if (!geometries[gid]) geometries[gid] = geometry
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
      attributionHtml: buildAttributionHtml(feature),
      licenseUrl: feature.properties.license_url,
      icon: feature.properties.icon,
      geometryId: gid,
      bbox,
      countryCodes,
    })
  }

  // Deterministic ordering so regenerated output diffs only on real changes.
  layers.sort((a, b) => a.id.localeCompare(b.id))

  return {
    layers,
    geometries,
    counts: {
      upstream: collection.features.length,
      published: layers.length,
      geometries: Object.keys(geometries).length,
      dropped,
    },
  }
}
