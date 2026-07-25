import type { EliContinent } from '../src/core/types'

/** All continent shard ids, including the worldwide bucket. */
export const CONTINENTS = [
  'africa',
  'antarctica',
  'asia',
  'europe',
  'north-america',
  'oceania',
  'south-america',
  'world',
] as const satisfies readonly EliContinent[]

type CountryContinent = Exclude<EliContinent, 'world'>

/**
 * ISO 3166-1 alpha-2 → continent (UN M49-ish). Covers every code we expect from
 * country-coder plus common ELI edge cases. Unknown runtime codes fall back to
 * `world` in {@link continentsForCountryCodes}.
 */
export const countryToContinent: Record<string, CountryContinent> = {
  // Africa
  AO: 'africa',
  BF: 'africa',
  BI: 'africa',
  BJ: 'africa',
  BW: 'africa',
  CD: 'africa',
  CF: 'africa',
  CG: 'africa',
  CI: 'africa',
  CM: 'africa',
  CV: 'africa',
  DJ: 'africa',
  DZ: 'africa',
  EG: 'africa',
  EH: 'africa',
  ER: 'africa',
  ET: 'africa',
  GA: 'africa',
  GH: 'africa',
  GM: 'africa',
  GN: 'africa',
  GQ: 'africa',
  GW: 'africa',
  KE: 'africa',
  KM: 'africa',
  LR: 'africa',
  LS: 'africa',
  LY: 'africa',
  MA: 'africa',
  MG: 'africa',
  ML: 'africa',
  MR: 'africa',
  MU: 'africa',
  MW: 'africa',
  MZ: 'africa',
  NA: 'africa',
  NE: 'africa',
  NG: 'africa',
  RE: 'africa',
  RW: 'africa',
  SC: 'africa',
  SD: 'africa',
  SH: 'africa',
  SL: 'africa',
  SN: 'africa',
  SO: 'africa',
  SS: 'africa',
  ST: 'africa',
  SZ: 'africa',
  TD: 'africa',
  TG: 'africa',
  TN: 'africa',
  TZ: 'africa',
  UG: 'africa',
  YT: 'africa',
  ZA: 'africa',
  ZM: 'africa',
  ZW: 'africa',
  // Antarctica
  AQ: 'antarctica',
  BV: 'antarctica',
  GS: 'antarctica',
  HM: 'antarctica',
  TF: 'antarctica',
  // Asia
  AE: 'asia',
  AF: 'asia',
  AM: 'asia',
  AZ: 'asia',
  BD: 'asia',
  BH: 'asia',
  BN: 'asia',
  BT: 'asia',
  CC: 'asia',
  CN: 'asia',
  CX: 'asia',
  CY: 'asia',
  GE: 'asia',
  HK: 'asia',
  ID: 'asia',
  IL: 'asia',
  IN: 'asia',
  IO: 'asia',
  IQ: 'asia',
  IR: 'asia',
  JO: 'asia',
  JP: 'asia',
  KG: 'asia',
  KH: 'asia',
  KP: 'asia',
  KR: 'asia',
  KW: 'asia',
  KZ: 'asia',
  LA: 'asia',
  LB: 'asia',
  LK: 'asia',
  MM: 'asia',
  MN: 'asia',
  MO: 'asia',
  MV: 'asia',
  MY: 'asia',
  NP: 'asia',
  OM: 'asia',
  PH: 'asia',
  PK: 'asia',
  PS: 'asia',
  QA: 'asia',
  SA: 'asia',
  SG: 'asia',
  SY: 'asia',
  TH: 'asia',
  TJ: 'asia',
  TL: 'asia',
  TM: 'asia',
  TR: 'asia',
  TW: 'asia',
  UZ: 'asia',
  VN: 'asia',
  YE: 'asia',
  // Europe
  AD: 'europe',
  AL: 'europe',
  AT: 'europe',
  AX: 'europe',
  BA: 'europe',
  BE: 'europe',
  BG: 'europe',
  BY: 'europe',
  CH: 'europe',
  CZ: 'europe',
  DE: 'europe',
  DK: 'europe',
  EE: 'europe',
  ES: 'europe',
  FI: 'europe',
  FO: 'europe',
  FR: 'europe',
  GB: 'europe',
  GG: 'europe',
  GI: 'europe',
  GR: 'europe',
  HR: 'europe',
  HU: 'europe',
  IE: 'europe',
  IM: 'europe',
  IS: 'europe',
  IT: 'europe',
  JE: 'europe',
  LI: 'europe',
  LT: 'europe',
  LU: 'europe',
  LV: 'europe',
  MC: 'europe',
  MD: 'europe',
  ME: 'europe',
  MK: 'europe',
  MT: 'europe',
  NL: 'europe',
  NO: 'europe',
  PL: 'europe',
  PT: 'europe',
  RO: 'europe',
  RS: 'europe',
  RU: 'europe',
  SE: 'europe',
  SI: 'europe',
  SJ: 'europe',
  SK: 'europe',
  SM: 'europe',
  UA: 'europe',
  VA: 'europe',
  XK: 'europe',
  // North America
  AG: 'north-america',
  AI: 'north-america',
  AW: 'north-america',
  BB: 'north-america',
  BL: 'north-america',
  BM: 'north-america',
  BQ: 'north-america',
  BS: 'north-america',
  BZ: 'north-america',
  CA: 'north-america',
  CR: 'north-america',
  CU: 'north-america',
  CW: 'north-america',
  DM: 'north-america',
  DO: 'north-america',
  GD: 'north-america',
  GL: 'north-america',
  GP: 'north-america',
  GT: 'north-america',
  HN: 'north-america',
  HT: 'north-america',
  JM: 'north-america',
  KN: 'north-america',
  KY: 'north-america',
  LC: 'north-america',
  MF: 'north-america',
  MQ: 'north-america',
  MS: 'north-america',
  MX: 'north-america',
  NI: 'north-america',
  PA: 'north-america',
  PM: 'north-america',
  PR: 'north-america',
  SV: 'north-america',
  SX: 'north-america',
  TC: 'north-america',
  TT: 'north-america',
  US: 'north-america',
  VC: 'north-america',
  VG: 'north-america',
  VI: 'north-america',
  // Oceania
  AS: 'oceania',
  AU: 'oceania',
  CK: 'oceania',
  FJ: 'oceania',
  FM: 'oceania',
  GU: 'oceania',
  KI: 'oceania',
  MH: 'oceania',
  MP: 'oceania',
  NC: 'oceania',
  NF: 'oceania',
  NR: 'oceania',
  NU: 'oceania',
  NZ: 'oceania',
  PF: 'oceania',
  PG: 'oceania',
  PN: 'oceania',
  PW: 'oceania',
  SB: 'oceania',
  TK: 'oceania',
  TO: 'oceania',
  TV: 'oceania',
  UM: 'oceania',
  VU: 'oceania',
  WF: 'oceania',
  WS: 'oceania',
  // South America
  AR: 'south-america',
  BO: 'south-america',
  BR: 'south-america',
  CL: 'south-america',
  CO: 'south-america',
  EC: 'south-america',
  FK: 'south-america',
  GF: 'south-america',
  GY: 'south-america',
  PE: 'south-america',
  PY: 'south-america',
  SR: 'south-america',
  UY: 'south-america',
  VE: 'south-america',
}

let unknownCountryLogged = false

/**
 * Continent shards a layer belongs in, derived from its ISO country codes.
 * Empty codes → `['world']`. Unknown codes → `world` (logged once). Multi-country
 * layers appear in every matching continent shard, never in `world` unless
 * worldwide.
 */
export function continentsForCountryCodes(codes: string[]): EliContinent[] {
  if (codes.length === 0) return ['world']

  const continents = new Set<EliContinent>()
  for (const code of codes) {
    const continent = countryToContinent[code]
    if (continent) {
      continents.add(continent)
      continue
    }
    if (!unknownCountryLogged) {
      console.warn(`Unknown ISO country code "${code}" — filing layer under world shard`)
      unknownCountryLogged = true
    }
    continents.add('world')
  }
  return [...continents].sort()
}

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

/** Reset the unknown-country warning (for tests). */
export function resetContinentWarnings(): void {
  unknownCountryLogged = false
}
