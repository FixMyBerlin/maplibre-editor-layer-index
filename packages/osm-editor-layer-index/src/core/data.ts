import type { Feature, FeatureCollection, Geometry } from 'geojson'
import locatorJson from '../data/locator.json' with { type: 'json' }
import manifestJson from '../data/manifest.json' with { type: 'json' }
import shardsJson from '../data/shards.json' with { type: 'json' }
import { viewportCenter, type ViewportBounds } from './bounds'
import { continentForLngLat } from './continents'
import type {
  EliByCountry,
  EliContinent,
  EliDetailsShard,
  EliGeometries,
  EliLayer,
  EliLayerDetails,
  EliLayerType,
  EliLocatorLayer,
  EliManifest,
  EliShardsMeta,
} from './types'

type GeometryContinent = Exclude<EliContinent, 'world'>

const locator = locatorJson as unknown as { layers: EliLocatorLayer[] }
const shardsMeta = shardsJson as EliShardsMeta

const detailLoaders = {
  africa: () => import('../data/details/africa.json', { with: { type: 'json' } }),
  antarctica: () => import('../data/details/antarctica.json', { with: { type: 'json' } }),
  asia: () => import('../data/details/asia.json', { with: { type: 'json' } }),
  europe: () => import('../data/details/europe.json', { with: { type: 'json' } }),
  'north-america': () => import('../data/details/north-america.json', { with: { type: 'json' } }),
  oceania: () => import('../data/details/oceania.json', { with: { type: 'json' } }),
  'south-america': () => import('../data/details/south-america.json', { with: { type: 'json' } }),
  world: () => import('../data/details/world.json', { with: { type: 'json' } }),
} as const

const geometryLoaders = {
  africa: () => import('../data/geometries/africa.json', { with: { type: 'json' } }),
  antarctica: () => import('../data/geometries/antarctica.json', { with: { type: 'json' } }),
  asia: () => import('../data/geometries/asia.json', { with: { type: 'json' } }),
  europe: () => import('../data/geometries/europe.json', { with: { type: 'json' } }),
  'north-america': () =>
    import('../data/geometries/north-america.json', { with: { type: 'json' } }),
  oceania: () => import('../data/geometries/oceania.json', { with: { type: 'json' } }),
  'south-america': () =>
    import('../data/geometries/south-america.json', { with: { type: 'json' } }),
} as const

const detailsById = new Map<string, EliLayerDetails>()
const detailPromises = new Map<EliContinent, Promise<void>>()

let geometriesCache: EliGeometries = {}
const geometryPromises = new Map<GeometryContinent, Promise<void>>()

/** All published ELI locator rows (filter fields only, no tile URLs). */
export function getLayers(): EliLocatorLayer[] {
  return locator.layers
}

/** Look up a single locator row by its ELI id. */
export function getLayer(id: string): EliLocatorLayer | undefined {
  return locator.layers.find((layer) => layer.id === id)
}

/** Build provenance for the bundled data. */
export function getManifest(): EliManifest {
  return manifestJson as EliManifest
}

/** Continent-shard routing metadata bundled with the locator index. */
export function getShardsMeta(): EliShardsMeta {
  return shardsMeta
}

/** Continents to lazy-load for a map center: always `world` plus the regional shard. */
export function continentsForCenter(lng: number, lat: number): EliContinent[] {
  return ['world', continentForLngLat(lng, lat)]
}

/** Continents to lazy-load for a viewport (uses bbox midpoint as the map center). */
export function continentsForViewport(bounds: ViewportBounds): EliContinent[] {
  const { lng, lat } = viewportCenter(bounds)
  return continentsForCenter(lng, lat)
}

async function loadDetailShard(continent: EliContinent): Promise<void> {
  const existing = detailPromises.get(continent)
  if (existing) return existing

  const promise = detailLoaders[continent]().then((mod) => {
    const shard = (mod.default ?? mod) as EliDetailsShard
    for (const [id, details] of Object.entries(shard)) {
      detailsById.set(id, details)
    }
  })
  detailPromises.set(continent, promise)
  return promise
}

/** Load detail shards for the given continents (no-op when already cached). */
export async function ensureDetailsForContinents(continents: EliContinent[]): Promise<void> {
  await Promise.all(continents.map((continent) => loadDetailShard(continent)))
}

/** Load `world` plus the regional detail shard for the viewport center. */
export async function ensureDetailsForViewport(bounds: ViewportBounds): Promise<void> {
  await ensureDetailsForContinents(continentsForViewport(bounds))
}

/** Merge a locator row with loaded details, or `undefined` when details are not loaded yet. */
export function hydrateLayer(locatorRow: EliLocatorLayer): EliLayer | undefined {
  const details = detailsById.get(locatorRow.id)
  if (!details) return undefined
  return { ...locatorRow, ...details }
}

/** Hydrate locator rows, skipping any whose detail shard has not been loaded. */
export function hydrateLayers(locatorRows: EliLocatorLayer[]): EliLayer[] {
  const hydrated: EliLayer[] = []
  for (const row of locatorRows) {
    const layer = hydrateLayer(row)
    if (layer) hydrated.push(layer)
  }
  return hydrated
}

/** Ensure detail shards for a layer, then return the hydrated layer. */
export async function getLayerHydrated(id: string): Promise<EliLayer | undefined> {
  const locatorRow = getLayer(id)
  if (!locatorRow) return undefined
  await ensureDetailsForContinents(locatorRow.continents)
  return hydrateLayer(locatorRow)
}

async function loadGeometryShard(continent: GeometryContinent): Promise<void> {
  const existing = geometryPromises.get(continent)
  if (existing) return existing

  const promise = geometryLoaders[continent]().then((mod) => {
    const shard = (mod.default ?? mod) as EliGeometries
    geometriesCache = { ...geometriesCache, ...shard }
  })
  geometryPromises.set(continent, promise)
  return promise
}

function geometryContinents(continents: EliContinent[]): GeometryContinent[] {
  return continents.filter((c): c is GeometryContinent => c !== 'world')
}

/** Load geometry shards for the given continents (skips `world`). */
export async function ensureGeometriesForContinents(continents: EliContinent[]): Promise<void> {
  const targets = geometryContinents(continents)
  if (targets.length === 0) return
  await Promise.all(targets.map((continent) => loadGeometryShard(continent)))
}

let allGeometriesPromise: Promise<EliGeometries> | undefined

/**
 * Lazily load all continent geometry shards and merge them. Compatibility helper
 * for callers that want the full deduplicated geometry map at once.
 */
export async function loadGeometries(): Promise<EliGeometries> {
  if (!allGeometriesPromise) {
    allGeometriesPromise = ensureGeometriesForContinents(shardsMeta.continents).then(
      () => geometriesCache,
    )
  }
  return allGeometriesPromise
}

let byCountryPromise: Promise<EliByCountry> | undefined

/**
 * Lazily load the precomputed area↔layer map (ISO code → layer ids, plus a
 * `"worldwide"` bucket). Code-split like the geometries, so it's only fetched when
 * a consumer actually does country lookups.
 */
export async function loadByCountry(): Promise<EliByCountry> {
  if (!byCountryPromise) {
    byCountryPromise = import('../data/byCountry.json', { with: { type: 'json' } }).then(
      (mod) => (mod.default ?? mod) as EliByCountry,
    )
  }
  return byCountryPromise
}

/** Resolve the coverage geometry for a layer (or `undefined` for worldwide). */
export async function getGeometry(
  layerOrId: EliLocatorLayer | EliLayer | string,
): Promise<Geometry | undefined> {
  const locatorRow = typeof layerOrId === 'string' ? getLayer(layerOrId) : layerOrId
  if (!locatorRow || locatorRow.geometryId === 'world') return undefined
  await ensureGeometriesForContinents(locatorRow.continents)
  return geometriesCache[locatorRow.geometryId]
}

export type CoverageFeature = Feature<
  Geometry,
  { id: string; name: string; type: EliLayerType; category?: EliLayer['category'] }
>

/**
 * Build a GeoJSON FeatureCollection of the coverage polygons for the given layers,
 * ready to drop into a map source for rendering coverage outlines. Lazily loads
 * geometry shards. Worldwide layers (no polygon) are skipped. Each feature's
 * `id` is the layer id, so it works directly with maplibre feature-state.
 */
export async function loadCoverageFeatures(
  layers: (EliLocatorLayer | EliLayer)[],
): Promise<FeatureCollection> {
  const continents = new Set<EliContinent>()
  for (const layer of layers) {
    for (const continent of layer.continents) continents.add(continent)
  }
  await ensureGeometriesForContinents([...continents])

  const features: CoverageFeature[] = []
  for (const layer of layers) {
    if (layer.geometryId === 'world') continue
    const geometry = geometriesCache[layer.geometryId]
    if (!geometry) continue
    features.push({
      type: 'Feature',
      id: layer.id,
      properties: {
        id: layer.id,
        name: layer.name,
        type: layer.type,
        ...(layer.category ? { category: layer.category } : {}),
      },
      geometry,
    })
  }
  return { type: 'FeatureCollection', features }
}
