import type { Geometry } from 'geojson'

/** Editor Layer Index source types we transform into MapLibre raster sources. */
export type EliLayerType = 'tms' | 'wms' | 'wmts'

/** ELI rough categorisation, passed through for app-side filtering/UI. */
export type EliCategory =
  | 'photo'
  | 'map'
  | 'historicmap'
  | 'osmbasedmap'
  | 'historicphoto'
  | 'qa'
  | 'elevation'
  | 'other'

/** `[west, south, east, north]` in WGS84 degrees. */
export type BBox = [number, number, number, number]

/**
 * One ELI layer, ready for MapLibre. Everything needed to render the imagery and
 * to filter by viewport is here — except the coverage polygon coordinates, which
 * live in `geometries.json` and are referenced by {@link EliLayer.geometryId}.
 */
export type EliLayer = {
  /** Stable ELI id (e.g. `"Mapbox"`). */
  id: string
  name: string
  type: EliLayerType
  category?: EliCategory
  /** ELI marks this as the best source for its region. */
  best: boolean
  /** Transparent overlay tiles meant to sit on top of a base map. */
  overlay: boolean
  minzoom?: number
  maxzoom?: number
  /** MapLibre raster tile URL templates (`{z}/{x}/{y}` or WMS `{bbox-epsg-3857}`). */
  tiles: string[]
  tileSize: number
  /** `"tms"` when the source uses TMS (flipped-y) tile addressing. */
  scheme?: 'xyz' | 'tms'
  /**
   * The original, unmodified ELI URL template (e.g. `…/{zoom}/{x}/{y}` or WMS
   * `…&CRS={proj}&BBOX={bbox}`). MapLibre users want {@link EliLayer.tiles}; this is
   * for renderers that do their own placeholder substitution (iD, Rapid, Leaflet).
   */
  urlTemplate: string
  /** WMS projections the source advertises (`available_projections`), if any. */
  availableProjections?: string[]
  /** Ready-to-render attribution HTML, or undefined when none is provided. */
  attributionHtml?: string
  licenseUrl?: string
  icon?: string
  /**
   * Hash of the coverage geometry, key into `geometries.json`. `"world"` means the
   * layer has worldwide coverage (no polygon). Layers that share an identical
   * polygon share a `geometryId` (deduplication).
   */
  geometryId: string
  /** Coverage bounding box. Worldwide layers use `[-180, -90, 180, 90]`. */
  bbox: BBox
  /** ISO-ish region codes the coverage touches (via country-coder). Empty for worldwide. */
  countryCodes: string[]
  /**
   * Names of API-key placeholders still present in {@link EliLayer.tiles} (e.g.
   * `["apikey"]`). The layer only works once these are supplied. Empty for the
   * vast majority of layers. See `EliApiKey` for the full set of known names.
   */
  requiresKeys: string[]
}

/** The small, always-loaded data file: every layer minus coverage coordinates. */
export type EliIndex = {
  layers: EliLayer[]
}

/** The large, lazily-loaded data file: deduplicated coverage geometries by id. */
export type EliGeometries = Record<string, Geometry>

/**
 * Precomputed area↔layer map: ISO region code → layer ids whose coverage touches
 * it, plus the special `"worldwide"` bucket for layers with no coverage polygon.
 * A ready-made spatial shortcut for consumers that don't want to build their own
 * index (e.g. iD/Rapid).
 */
export type EliByCountry = Record<string, string[]>

/** Build provenance, emitted next to the data. */
export type EliManifest = {
  /** URL the imagery index was fetched from. */
  source: string
  /** Upstream commit SHA or Last-Modified, when available. */
  sourceVersion: string | null
  /** ISO timestamp the data was generated. */
  generatedAt: string
  counts: {
    /** Layers present in the upstream index. */
    upstream: number
    /** Layers kept after dropping unsupported types. */
    published: number
    /** Unique geometries after deduplication. */
    geometries: number
    dropped: Record<string, number>
  }
}
