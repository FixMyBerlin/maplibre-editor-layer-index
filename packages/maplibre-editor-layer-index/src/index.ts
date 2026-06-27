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
  type RasterSourceSpec,
} from './core/specs'
