import * as countryCoder from '@rapideditor/country-coder'
import type { Geometry, Position } from 'geojson'
import { geometryBBox } from './geometry'

/**
 * Region codes a coverage geometry actually covers, precomputed at build time so
 * the runtime never needs country-coder. Unlike a bbox query, this samples points
 * **inside the polygon** — so e.g. TIGER (US + Pacific/Caribbean territories, whose
 * bbox spans the globe) resolves to its real countries, not every country its
 * bounding box happens to cross.
 */
export function countryCodesForGeometry(geometry: Geometry): string[] {
  if (!('coordinates' in geometry)) return []
  const [west, south, east, north] = geometryBBox(geometry)
  const width = east - west
  const height = north - south

  // Whole-world (or near) coverage → treat as worldwide (no country list).
  if (width >= 350 && height >= 170) return []

  // Sample a grid across the bbox; keep a point's country only if it lies inside
  // the polygon. Bounded step count keeps tiny and huge polygons both reasonable.
  const steps = 24
  const codes = new Set<string>()
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      const lon = west + (width * i) / steps
      const lat = south + (height * j) / steps
      if (!pointInGeometry([lon, lat], geometry)) continue
      const code = countryCoder.iso1A2Code([lon, lat])
      if (code) codes.add(code)
    }
  }

  // Fallback for polygons too small/thin for the grid to land inside: use the
  // bbox centre so we still attribute at least one country.
  if (codes.size === 0) {
    const code = countryCoder.iso1A2Code([west + width / 2, south + height / 2])
    if (code) codes.add(code)
  }
  return [...codes].sort()
}

/** Ray-casting point-in-ring test. */
function pointInRing(point: Position, ring: Position[]): boolean {
  const x = point[0]!
  const y = point[1]!
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!
    const yi = ring[i]![1]!
    const xj = ring[j]![0]!
    const yj = ring[j]![1]!
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

/** Inside a single Polygon (outer ring minus holes). */
function pointInPolygonRings(point: Position, rings: Position[][]): boolean {
  if (rings.length === 0 || !pointInRing(point, rings[0]!)) return false
  for (let h = 1; h < rings.length; h++) {
    if (pointInRing(point, rings[h]!)) return false
  }
  return true
}

function pointInGeometry(point: Position, geometry: Geometry): boolean {
  if (geometry.type === 'Polygon') {
    return pointInPolygonRings(point, geometry.coordinates as Position[][])
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates as Position[][][]).some((rings) =>
      pointInPolygonRings(point, rings),
    )
  }
  return false
}
