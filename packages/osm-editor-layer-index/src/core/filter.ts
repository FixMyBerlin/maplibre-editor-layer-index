import { hasRequiredKeys, type EliApiKeys } from './apiKeys'
import type { ViewportBounds } from './bounds'
import { toBBox } from './bounds'
import { ensureDetailsForViewport, getLayers, hydrateLayers, loadByCountry } from './data'
import type { BBox, EliCategory, EliLayer, EliLayerType, EliLocatorLayer } from './types'

export type { ViewportBounds } from './bounds'

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

/** Do two axis-aligned boxes overlap? (Longitude antimeridian wrap is not handled.) */
function bboxOverlaps(a: BBox, b: BBox): boolean {
  const [aw, as, ae, an] = a
  const [bw, bs, be, bn] = b
  return aw <= be && bw <= ae && as <= bn && bs <= an
}

function matchesOptions(layer: EliLocatorLayer, options: FilterOptions): boolean {
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
 * against the precomputed `bbox` in the locator — no geometry is loaded. Worldwide
 * layers always match. Results keep the index order (id-sorted).
 */
export function layersInViewport(
  bounds: ViewportBounds,
  options: FilterOptions = {},
  layers: EliLocatorLayer[] = getLayers(),
): EliLocatorLayer[] {
  const viewport = toBBox(bounds)
  return layers.filter(
    (layer) => bboxOverlaps(layer.bbox, viewport) && matchesOptions(layer, options),
  )
}

/** Apply only the predicate filters (category/type/best/…), ignoring location. */
export function filterLayers(
  options: FilterOptions = {},
  layers: EliLocatorLayer[] = getLayers(),
): EliLocatorLayer[] {
  return layers.filter((layer) => matchesOptions(layer, options))
}

/**
 * Layers available in a region, via the precomputed `byCountry` map — an O(1)
 * lookup with no geometry or bbox math. Returns locator rows for region layers
 * covering `code` plus worldwide layers (unless `includeWorldwide: false`). `code`
 * is an ISO 3166-1 alpha-2 code, e.g. `'DE'`. Callers needing tile URLs should
 * hydrate via {@link hydrateLayer} or {@link getLayerHydrated}.
 */
export async function layersForCountry(
  code: string,
  options: { includeWorldwide?: boolean } = {},
): Promise<EliLocatorLayer[]> {
  const byCountry = await loadByCountry()
  const ids = new Set(byCountry[code] ?? [])
  if (options.includeWorldwide !== false) {
    for (const id of byCountry.worldwide ?? []) ids.add(id)
  }
  return getLayers().filter((layer) => ids.has(layer.id))
}

/** Viewport-filter synchronously, load regional detail shards, then hydrate matches. */
export async function loadLayersInViewport(
  bounds: ViewportBounds,
  options: FilterOptions = {},
): Promise<EliLayer[]> {
  const matched = layersInViewport(bounds, options)
  await ensureDetailsForViewport(bounds)
  return hydrateLayers(matched)
}
