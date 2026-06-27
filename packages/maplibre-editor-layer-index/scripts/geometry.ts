import { createHash } from 'node:crypto'
import type { Geometry, Position } from 'geojson'
import type { BBox } from '../src/core/types'

export const WORLD_GEOMETRY_ID = 'world'
export const WORLD_BBOX: BBox = [-180, -90, 180, 90]

/**
 * Stable content hash of a geometry, used as the dedup key. ELI repeats identical
 * coverage polygons across many layers (e.g. the Berlin polygon); hashing the
 * `{type, coordinates}` shape collapses them to a single stored geometry.
 */
export function geometryId(geometry: Geometry): string {
  const canonical = JSON.stringify({
    type: geometry.type,
    coordinates: 'coordinates' in geometry ? geometry.coordinates : null,
  })
  return createHash('sha1').update(canonical).digest('hex').slice(0, 16)
}

function eachPosition(coords: unknown, fn: (pos: Position) => void): void {
  if (!Array.isArray(coords)) return
  if (typeof coords[0] === 'number') {
    fn(coords as Position)
    return
  }
  for (const child of coords) eachPosition(child, fn)
}

/** Axis-aligned bounding box `[west, south, east, north]` of any Polygon/MultiPolygon. */
export function geometryBBox(geometry: Geometry): BBox {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  if ('coordinates' in geometry) {
    eachPosition(geometry.coordinates, (pos) => {
      const lon = pos[0]
      const lat = pos[1]
      if (lon === undefined || lat === undefined) return
      if (lon < west) west = lon
      if (lon > east) east = lon
      if (lat < south) south = lat
      if (lat > north) north = lat
    })
  }
  if (!Number.isFinite(west)) return WORLD_BBOX
  return [west, south, east, north]
}
