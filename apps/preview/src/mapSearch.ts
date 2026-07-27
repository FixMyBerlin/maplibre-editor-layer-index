import type { EliCategory } from '@osm-editor-kit/osm-editor-layer-index'
import { parseList } from './searchParams'

/** Category groups shown in the sidebar, in display order, with friendly labels. */
export const CATEGORY_GROUPS: { key: EliCategory; label: string }[] = [
  { key: 'photo', label: 'Aerial / Satellite' },
  { key: 'map', label: 'Maps' },
  { key: 'osmbasedmap', label: 'OSM-based maps' },
  { key: 'historicmap', label: 'Historic maps' },
  { key: 'historicphoto', label: 'Historic aerial' },
  { key: 'elevation', label: 'Elevation' },
  { key: 'qa', label: 'QA' },
  { key: 'other', label: 'Other' },
]

const CATEGORY_KEYS = CATEGORY_GROUPS.map((g) => g.key)

export type MapSearch = {
  lat: number
  lng: number
  zoom: number
  /** Category groups currently expanded (also: which coverage borders to draw). */
  open: EliCategory[]
  /** Layers toggled on as raster overlays. */
  selected: string[]
}

/**
 * Nice, shareable URLs:
 * `?lat=52.52&lng=13.405&zoom=10&open=photo,historicphoto&selected=Berlin-2024`.
 */
export function mapSearchSchema(raw: Record<string, unknown>): MapSearch {
  const num = (v: unknown, fallback: number) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
  }
  const open = parseList(raw.open).filter((c): c is EliCategory =>
    CATEGORY_KEYS.includes(c as EliCategory),
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
