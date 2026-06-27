import type { EliLayerType } from 'maplibre-editor-layer-index'
import { parseList } from './searchParams'

/** Source-type groups shown in the sidebar, in display order. */
export const LAYER_TYPES: EliLayerType[] = ['tms', 'wms', 'wmts']

export type MapSearch = {
  lat: number
  lng: number
  zoom: number
  /** Type groups currently expanded in the sidebar (also: which borders to draw). */
  open: EliLayerType[]
  /** Layers toggled on as raster overlays. */
  selected: string[]
}

/**
 * Nice, shareable URLs:
 * `?lat=52.52&lng=13.405&zoom=10&open=tms,wms&selected=Berlin-2024`.
 */
export function mapSearchSchema(raw: Record<string, unknown>): MapSearch {
  const num = (v: unknown, fallback: number) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
  }
  const open = parseList(raw.open).filter((t): t is EliLayerType =>
    LAYER_TYPES.includes(t as EliLayerType),
  )
  return {
    lat: num(raw.lat, 52.52),
    lng: num(raw.lng, 13.405),
    zoom: num(raw.zoom, 10),
    open,
    selected: parseList(raw.selected),
  }
}

export const DEFAULT_VIEW: MapSearch = {
  lat: 52.52,
  lng: 13.405,
  zoom: 10,
  open: [],
  selected: [],
}
