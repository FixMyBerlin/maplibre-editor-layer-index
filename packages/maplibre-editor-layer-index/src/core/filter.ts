import { getLayers } from './data'
import type { BBox, EliCategory, EliLayer, EliLayerType } from './types'

/** A viewport, accepted in the shapes MapLibre / react-map-gl hand you. */
export type ViewportBounds =
  | BBox
  | { west: number; south: number; east: number; north: number }
  // maplibre-gl LngLatBounds-like
  | { getWest(): number; getSouth(): number; getEast(): number; getNorth(): number }

export type FilterOptions = {
  /** Keep only these categories. */
  categories?: EliCategory[]
  /** Keep only these source types. */
  types?: EliLayerType[]
  /** Keep only layers ELI marks as "best" for their region. */
  bestOnly?: boolean
  /** Drop transparent overlay layers (keep only full base imagery). */
  excludeOverlays?: boolean
  /** Keep only layers whose coverage touches one of these region codes. */
  countryCodes?: string[]
}

function toBBox(bounds: ViewportBounds): BBox {
  if (Array.isArray(bounds)) return bounds
  if ('getWest' in bounds) {
    return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]
  }
  return [bounds.west, bounds.south, bounds.east, bounds.north]
}

/** Do two axis-aligned boxes overlap? (Longitude antimeridian wrap is not handled.) */
function bboxOverlaps(a: BBox, b: BBox): boolean {
  const [aw, as, ae, an] = a
  const [bw, bs, be, bn] = b
  return aw <= be && bw <= ae && as <= bn && bs <= an
}

function matchesOptions(layer: EliLayer, options: FilterOptions): boolean {
  if (options.categories && !(layer.category && options.categories.includes(layer.category))) {
    return false
  }
  if (options.types && !options.types.includes(layer.type)) return false
  if (options.bestOnly && !layer.best) return false
  if (options.excludeOverlays && layer.overlay) return false
  if (
    options.countryCodes &&
    !layer.countryCodes.some((code) => options.countryCodes!.includes(code))
  ) {
    return false
  }
  return true
}

/**
 * Layers whose coverage bounding box overlaps the given viewport. Pure arithmetic
 * against the precomputed `bbox` in the index — no geometry is loaded. Worldwide
 * layers always match. Results keep the index order (id-sorted).
 */
export function layersInViewport(
  bounds: ViewportBounds,
  options: FilterOptions = {},
  layers: EliLayer[] = getLayers(),
): EliLayer[] {
  const viewport = toBBox(bounds)
  return layers.filter(
    (layer) => bboxOverlaps(layer.bbox, viewport) && matchesOptions(layer, options),
  )
}

/** Apply only the predicate filters (category/type/best/…), ignoring location. */
export function filterLayers(
  options: FilterOptions = {},
  layers: EliLayer[] = getLayers(),
): EliLayer[] {
  return layers.filter((layer) => matchesOptions(layer, options))
}
