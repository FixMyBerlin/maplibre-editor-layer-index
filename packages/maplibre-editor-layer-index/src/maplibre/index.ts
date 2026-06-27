import type { EliApiKeys } from '../core/apiKeys'
import {
  eliSourceId,
  getRasterLayerSpec,
  getRasterSourceSpec,
  type RasterLayerOptions,
  type RasterLayerSpec,
  type RasterSourceSpec,
} from '../core/specs'
import type { EliLayer } from '../core/types'

/**
 * Minimal structural subset of the maplibre-gl `Map` we use. Defined locally so
 * this entry doesn't hard-depend on `maplibre-gl` types — any compatible map
 * (including the instance behind react-map-gl) works.
 */
export type MapLike = {
  addSource(id: string, source: RasterSourceSpec): void
  removeSource(id: string): void
  getSource(id: string): unknown
  addLayer(layer: RasterLayerSpec, beforeId?: string): void
  removeLayer(id: string): void
  getLayer(id: string): unknown
}

export type AddEditorLayerOptions = RasterLayerOptions & {
  /** Insert the raster layer below this existing layer id. */
  beforeId?: string
  /** API keys to substitute into the tile URLs (e.g. `{ apikey: '…' }`). */
  apiKeys?: EliApiKeys
}

/**
 * Add an ELI layer to a maplibre-gl map as a raster source + layer. Idempotent:
 * re-adding the same layer replaces it. Returns the source/layer id used.
 *
 * Styling is yours — pass `paint` (e.g. `{ 'raster-opacity': 0.7 }`) or restyle
 * the layer afterwards.
 */
export function addEditorLayer(
  map: MapLike,
  layer: EliLayer,
  options: AddEditorLayerOptions = {},
): string {
  const sourceId = options.source ?? eliSourceId(layer)
  const layerId = options.id ?? eliSourceId(layer)

  removeEditorLayer(map, layerId, sourceId)
  map.addSource(sourceId, getRasterSourceSpec(layer, { apiKeys: options.apiKeys }))
  map.addLayer(
    getRasterLayerSpec(layer, { ...options, id: layerId, source: sourceId }),
    options.beforeId,
  )
  return layerId
}

/** Remove an ELI layer (and its source) previously added with {@link addEditorLayer}. */
export function removeEditorLayer(map: MapLike, layerId: string, sourceId: string = layerId): void {
  if (map.getLayer(layerId)) map.removeLayer(layerId)
  if (map.getSource(sourceId)) map.removeSource(sourceId)
}

export {
  eliSourceId,
  getRasterLayerSpec,
  getRasterSourceSpec,
  type RasterLayerSpec,
  type RasterSourceSpec,
}
