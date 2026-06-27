import type { EliCategory } from 'maplibre-editor-layer-index'

export const CATEGORIES: EliCategory[] = [
  'photo',
  'map',
  'osmbasedmap',
  'historicmap',
  'historicphoto',
  'elevation',
  'qa',
  'other',
]

export type MapSearch = {
  lat: number
  lng: number
  zoom: number
  category?: EliCategory
}

/** Nice, shareable URLs: `?lat=52.52&lng=13.405&zoom=10&category=photo`. */
export function mapSearchSchema(raw: Record<string, unknown>): MapSearch {
  const num = (v: unknown, fallback: number) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
  }
  const category = CATEGORIES.includes(raw.category as EliCategory)
    ? (raw.category as EliCategory)
    : undefined
  return {
    lat: num(raw.lat, 52.52),
    lng: num(raw.lng, 13.405),
    zoom: num(raw.zoom, 10),
    ...(category ? { category } : {}),
  }
}
