import * as countryCoder from '@rapideditor/country-coder'
import type { Geometry } from 'geojson'
import type { BBox } from '../src/core/types'
import { geometryBBox } from './geometry'

/**
 * Coarse list of region codes a coverage geometry touches, precomputed at build
 * time so the runtime never needs country-coder. Used as a cheap secondary
 * filter ("layers in country X"); the primary viewport filter is bbox overlap,
 * so approximate results here are acceptable.
 *
 * We sample a small grid across the bounding box and union the ISO codes found.
 * Sampling (rather than a single bbox query) keeps it robust to country-coder's
 * containment semantics and catches multi-country coverage.
 */
export function countryCodesForGeometry(geometry: Geometry): string[] {
  const bbox = geometryBBox(geometry)
  return countryCodesForBBox(bbox)
}

export function countryCodesForBBox(bbox: BBox): string[] {
  const [west, south, east, north] = bbox
  // Whole-world (or near) coverage → no meaningful country list.
  if (east - west >= 350 && north - south >= 170) return []

  const codes = new Set<string>()
  const steps = 4
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      const lon = west + ((east - west) * i) / steps
      const lat = south + ((north - south) * j) / steps
      const code = countryCoder.iso1A2Code([lon, lat])
      if (code) codes.add(code)
    }
  }
  return [...codes].sort()
}
