import type { Geometry } from 'geojson'
import type { EliGeometries, EliLayer, EliManifest } from './types'
// The small index is bundled directly — it's what every consumer needs.
import indexJson from '../data/index.json' with { type: 'json' }
import manifestJson from '../data/manifest.json' with { type: 'json' }

const index = indexJson as { layers: EliLayer[] }

/** All published ELI layers (metadata + bbox + countryCodes, no coordinates). */
export function getLayers(): EliLayer[] {
  return index.layers
}

/** Look up a single layer by its ELI id. */
export function getLayer(id: string): EliLayer | undefined {
  return index.layers.find((layer) => layer.id === id)
}

/** Build provenance for the bundled data. */
export function getManifest(): EliManifest {
  return manifestJson as EliManifest
}

let geometriesPromise: Promise<EliGeometries> | undefined

/**
 * Lazily load the deduplicated coverage geometries. This triggers a dynamic
 * `import()` of the large `geometries.json`, which bundlers code-split out of the
 * initial chunk — so apps only pay for it when they actually draw coverage shapes.
 * Filtering and rendering imagery never need this.
 */
export async function loadGeometries(): Promise<EliGeometries> {
  if (!geometriesPromise) {
    geometriesPromise = import('../data/geometries.json', { with: { type: 'json' } }).then(
      (mod) => (mod.default ?? mod) as EliGeometries,
    )
  }
  return geometriesPromise
}

/** Resolve the coverage geometry for a layer (or `undefined` for worldwide). */
export async function getGeometry(layerOrId: EliLayer | string): Promise<Geometry | undefined> {
  const layer = typeof layerOrId === 'string' ? getLayer(layerOrId) : layerOrId
  if (!layer || layer.geometryId === 'world') return undefined
  const geometries = await loadGeometries()
  return geometries[layer.geometryId]
}
