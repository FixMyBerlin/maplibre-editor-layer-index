import type { BBox } from './types'

/** A viewport, accepted in the shapes MapLibre / react-map-gl hand you. */
export type ViewportBounds =
  | BBox
  | { west: number; south: number; east: number; north: number }
  // maplibre-gl LngLatBounds-like
  | { getWest(): number; getSouth(): number; getEast(): number; getNorth(): number }

export function toBBox(bounds: ViewportBounds): BBox {
  if (Array.isArray(bounds)) return bounds
  if ('getWest' in bounds) {
    return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]
  }
  return [bounds.west, bounds.south, bounds.east, bounds.north]
}

/** Map-center point from a viewport bbox (midpoint of west/east and south/north). */
export function viewportCenter(bounds: ViewportBounds): { lng: number; lat: number } {
  const [west, south, east, north] = toBBox(bounds)
  return { lng: (west + east) / 2, lat: (south + north) / 2 }
}
