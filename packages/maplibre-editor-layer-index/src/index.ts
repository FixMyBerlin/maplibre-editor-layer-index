export type {
  BBox,
  EliCategory,
  EliGeometries,
  EliIndex,
  EliLayer,
  EliLayerType,
  EliManifest,
} from './core/types'

export {
  applyApiKeys,
  eliApiKeyNames,
  hasRequiredKeys,
  type EliApiKey,
  type EliApiKeys,
} from './core/apiKeys'

export {
  getGeometry,
  getLayer,
  getLayers,
  getManifest,
  loadCoverageFeatures,
  loadGeometries,
  type CoverageFeature,
} from './core/data'

export {
  filterLayers,
  layersInViewport,
  type FilterOptions,
  type ViewportBounds,
} from './core/filter'

export {
  eliSourceId,
  getRasterLayerSpec,
  getRasterSourceSpec,
  type RasterLayerOptions,
  type RasterLayerSpec,
  type RasterSourceOptions,
  type RasterSourceSpec,
} from './core/specs'
