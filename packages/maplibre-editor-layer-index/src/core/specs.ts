import type { EliLayer } from './types'

/**
 * Minimal structural types for the MapLibre style specs we emit. They're
 * intentionally self-contained (no `maplibre-gl` import) so the core stays
 * dependency-free, while remaining assignable to MapLibre's own
 * `RasterSourceSpecification` / `RasterLayerSpecification`.
 */
export type RasterSourceSpec = {
  type: 'raster'
  tiles: string[]
  tileSize: number
  scheme?: 'xyz' | 'tms'
  minzoom?: number
  maxzoom?: number
  attribution?: string
}

export type RasterLayerSpec = {
  id: string
  type: 'raster'
  source: string
  minzoom?: number
  maxzoom?: number
  paint?: Record<string, unknown>
}

/** Stable source/layer id derived from the ELI id (e.g. `eli-Mapbox`). */
export function eliSourceId(layer: EliLayer | string): string {
  return `eli-${typeof layer === 'string' ? layer : layer.id}`
}

/** Build a MapLibre `RasterSourceSpecification` for an ELI layer. */
export function getRasterSourceSpec(layer: EliLayer): RasterSourceSpec {
  return {
    type: 'raster',
    tiles: layer.tiles,
    tileSize: layer.tileSize,
    ...(layer.scheme ? { scheme: layer.scheme } : {}),
    ...(layer.minzoom !== undefined ? { minzoom: layer.minzoom } : {}),
    ...(layer.maxzoom !== undefined ? { maxzoom: layer.maxzoom } : {}),
    ...(layer.attributionHtml ? { attribution: layer.attributionHtml } : {}),
  }
}

export type RasterLayerOptions = {
  /** Override the layer id (defaults to {@link eliSourceId}). */
  id?: string
  /** Source id this layer reads from (defaults to {@link eliSourceId}). */
  source?: string
  /** Raster paint overrides — styling is the app's job; this is just a default. */
  paint?: Record<string, unknown>
}

/** Build a MapLibre `RasterLayerSpecification` referencing an ELI raster source. */
export function getRasterLayerSpec(layer: EliLayer, options: RasterLayerOptions = {}): RasterLayerSpec {
  return {
    id: options.id ?? eliSourceId(layer),
    type: 'raster',
    source: options.source ?? eliSourceId(layer),
    ...(layer.minzoom !== undefined ? { minzoom: layer.minzoom } : {}),
    ...(layer.maxzoom !== undefined ? { maxzoom: layer.maxzoom } : {}),
    ...(options.paint ? { paint: options.paint } : {}),
  }
}
