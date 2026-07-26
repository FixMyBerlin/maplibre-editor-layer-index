import { applyApiKeys, type EliApiKeys } from './apiKeys'
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

export type RasterSourceOptions = {
  /** API keys to substitute into the tile URL templates (e.g. `{ apikey: '…' }`). */
  apiKeys?: EliApiKeys
  /**
   * Device pixel ratio for WMS GetMap WIDTH/HEIGHT. MapLibre's `{bbox-epsg-3857}`
   * always covers a logical `tileSize` CSS-pixel mercator tile; requesting a
   * larger image (e.g. 512 on a 2× display) keeps cadastral/WMS layers sharp.
   * Defaults to `min(devicePixelRatio, 2)` in the browser, else `1`.
   */
  pixelRatio?: number
}

/** Cap used when reading `window.devicePixelRatio` — matches MapLibre's `{ratio}` @2x. */
const MAX_AUTO_PIXEL_RATIO = 2

function defaultPixelRatio(): number {
  if (typeof window === 'undefined') return 1
  const dpr = window.devicePixelRatio || 1
  return Math.min(Math.max(1, dpr), MAX_AUTO_PIXEL_RATIO)
}

/**
 * Scale hardcoded WMS `WIDTH`/`HEIGHT` from the logical tile size to a denser
 * image size. TMS/WMTS URLs are returned unchanged (no server-side size knobs).
 */
export function applyWmsPixelRatio(
  tiles: string[],
  tileSize: number,
  pixelRatio: number,
): string[] {
  const imageSize = Math.max(1, Math.round(tileSize * pixelRatio))
  if (imageSize === tileSize) return tiles
  const re = new RegExp(`\\b(WIDTH|HEIGHT)=${tileSize}\\b`, 'gi')
  return tiles.map((url) => url.replace(re, `$1=${imageSize}`))
}

/** Build a MapLibre `RasterSourceSpecification` for an ELI layer. */
export function getRasterSourceSpec(
  layer: EliLayer,
  options: RasterSourceOptions = {},
): RasterSourceSpec {
  const pixelRatio = options.pixelRatio ?? defaultPixelRatio()
  let tiles = applyApiKeys(layer.tiles, options.apiKeys)
  if (layer.type === 'wms') {
    tiles = applyWmsPixelRatio(tiles, layer.tileSize, pixelRatio)
  }

  return {
    type: 'raster',
    tiles,
    // Logical CSS tile size must stay at ELI's value: MapLibre's WMS bbox token
    // is always a 256-style mercator tile; bumping tileSize would mis-align.
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
  /**
   * When true, copy ELI `maxzoom` onto the style layer (hides the layer past that
   * zoom). Default false — source `maxzoom` alone makes MapLibre **overzoom**
   * the last available tiles instead of disappearing.
   */
  clampMaxzoom?: boolean
}

/** Build a MapLibre `RasterLayerSpecification` referencing an ELI raster source. */
export function getRasterLayerSpec(
  layer: EliLayer,
  options: RasterLayerOptions = {},
): RasterLayerSpec {
  return {
    id: options.id ?? eliSourceId(layer),
    type: 'raster',
    source: options.source ?? eliSourceId(layer),
    ...(layer.minzoom !== undefined ? { minzoom: layer.minzoom } : {}),
    // Do not set layer maxzoom by default: that hides the layer. Source maxzoom
    // (from getRasterSourceSpec) is what enables overzoom past native tile zooms.
    ...(options.clampMaxzoom && layer.maxzoom !== undefined ? { maxzoom: layer.maxzoom } : {}),
    ...(options.paint ? { paint: options.paint } : {}),
  }
}
