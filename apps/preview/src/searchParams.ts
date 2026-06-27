/**
 * Nice, shareable URL search params for TanStack Router.
 *
 * The default router serialization JSON-encodes values, which produces ugly URLs
 * like `?open=%5B%22tms%22%5D`. These flat codecs keep scalars literal and join
 * arrays with commas, so URLs read `?open=tms,wms&zoom=10` — easy to read, edit
 * and share. Per-route `validateSearch` is responsible for coercing the raw
 * string values back into typed state (numbers, arrays, enums).
 */

/** Parse a `?a=1&b=x,y` query string into a flat record of raw strings. */
export function parseSearch(searchStr: string): Record<string, string> {
  const params = new URLSearchParams(searchStr)
  const out: Record<string, string> = {}
  for (const [key, value] of params) out[key] = value
  return out
}

/** Serialize a search object into a flat query string (arrays → comma lists). */
export function stringifySearch(search: Record<string, unknown>): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      if (value.length === 0) continue
      parts.push(`${enc(key)}=${value.map((v) => enc(String(v))).join(',')}`)
    } else {
      parts.push(`${enc(key)}=${enc(String(value))}`)
    }
  }
  return parts.length ? `?${parts.join('&')}` : ''
}

// Encode, but keep commas literal so list params stay readable.
function enc(value: string): string {
  return encodeURIComponent(value).replace(/%2C/g, ',')
}

/** Helper for `validateSearch`: split a comma list param into a string array. */
export function parseList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string' && value.length > 0) return value.split(',')
  return []
}
