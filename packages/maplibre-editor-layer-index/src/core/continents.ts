import type { EliContinent } from './types'

type CountryContinent = Exclude<EliContinent, 'world'>

/** Coarse continent bboxes `[west, south, east, north]` for map-center shard routing. */
const CONTINENT_BBOXES: { continent: CountryContinent; bbox: [number, number, number, number] }[] =
  [
    { continent: 'europe', bbox: [-25, 35, 45, 72] },
    { continent: 'africa', bbox: [-20, -35, 55, 38] },
    { continent: 'asia', bbox: [25, -10, 180, 75] },
    { continent: 'north-america', bbox: [-170, 15, -50, 72] },
    { continent: 'south-america', bbox: [-82, -56, -34, 13] },
    { continent: 'oceania', bbox: [110, -50, 180, 0] },
    { continent: 'antarctica', bbox: [-180, -90, 180, -60] },
  ]

function pointInBBox(lng: number, lat: number, bbox: [number, number, number, number]): boolean {
  const [west, south, east, north] = bbox
  return lng >= west && lng <= east && lat >= south && lat <= north
}

/**
 * Guess the continent shard for a map center. Good enough for lazy-load routing;
 * country-code lookups remain authoritative for layer membership.
 */
export function continentForLngLat(lng: number, lat: number): CountryContinent {
  if (lat < -60) return 'antarctica'
  for (const { continent, bbox } of CONTINENT_BBOXES) {
    if (continent === 'antarctica') continue
    if (pointInBBox(lng, lat, bbox)) return continent
  }
  // Pacific / ambiguous — prefer oceania for eastern hemisphere, NA for western.
  return lng >= 0 ? 'asia' : 'north-america'
}
