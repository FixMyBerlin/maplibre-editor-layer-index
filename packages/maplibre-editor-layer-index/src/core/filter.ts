import { hasRequiredKeys, type EliApiKeys } from './apiKeys'
import { getLayers, loadByCountry } from './data'
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
  /**
   * Keep only layers whose precomputed coverage touches one of these region codes
   * (e.g. `['DE']`). Worldwide layers (no country list) always pass. This is the
   * cheap fix for the bbox-vs-polygon overshoot: a US-only source whose bounding
   * box spans the globe (e.g. TIGER) is dropped because its codes don't include the
   * viewport's country. Country codes are precomputed from the actual polygon.
   */
  countryCodes?: string[]
  /** Include worldwide layers (no coverage polygon). Default `true`. */
  includeWorldwide?: boolean
  /**
   * API keys you have available. Layers that require a key are **excluded by
   * default** (so the list stays clean and actionable); provide the keys here to
   * include them. The same keys are substituted into tile URLs by the spec helpers.
   */
  apiKeys?: EliApiKeys
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
  // Hide layers whose required API keys aren't available — keeps the default clean.
  if (!hasRequiredKeys(layer.requiresKeys, options.apiKeys)) return false
  if (options.categories && !(layer.category && options.categories.includes(layer.category))) {
    return false
  }
  if (options.types && !options.types.includes(layer.type)) return false
  if (options.bestOnly && !layer.best) return false
  if (options.excludeOverlays && layer.overlay) return false
  if (options.includeWorldwide === false && layer.geometryId === 'world') return false
  // Worldwide layers (empty countryCodes) are global, so they always pass the
  // country filter; only region-scoped layers are checked against it.
  if (
    options.countryCodes &&
    layer.countryCodes.length > 0 &&
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

/**
 * Layers available in a region, via the precomputed `byCountry` map — an O(1)
 * lookup with no geometry or bbox math. Returns region layers covering `code`
 * plus worldwide layers (unless `includeWorldwide: false`). `code` is an ISO
 * 3166-1 alpha-2 code, e.g. `'DE'`.
 */
export async function layersForCountry(
  code: string,
  options: { includeWorldwide?: boolean } = {},
): Promise<EliLayer[]> {
  const byCountry = await loadByCountry()
  const ids = new Set(byCountry[code] ?? [])
  if (options.includeWorldwide !== false) {
    for (const id of byCountry.worldwide ?? []) ids.add(id)
  }
  return getLayers().filter((layer) => ids.has(layer.id))
}
