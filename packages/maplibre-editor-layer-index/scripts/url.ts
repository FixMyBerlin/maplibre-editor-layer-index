import type { EliLayerType } from '../src/core/types'

export type ConvertedUrl = {
  /** One or more MapLibre raster tile URL templates (multiple when `{switch:…}` is expanded). */
  tiles: string[]
  scheme: 'xyz' | 'tms'
}

/**
 * Expand an ELI `{switch:a,b,c}` placeholder into one URL per option, mirroring
 * MapLibre's multi-tile-URL load balancing. Returns the input unchanged when no
 * switch placeholder is present.
 */
function expandSwitch(url: string): string[] {
  const match = url.match(/\{switch:([^}]+)\}/)
  if (!match) return [url]
  const options = match[1]!.split(',').map((s) => s.trim())
  return options.map((option) => url.replace(/\{switch:[^}]+\}/, option))
}

/**
 * Convert an ELI tile-URL template into MapLibre-compatible raster tile URL(s).
 *
 * - TMS/WMTS: `{zoom}`→`{z}`; `{-y}` flips to TMS addressing (`scheme: "tms"`).
 * - WMS: `{proj}`→`EPSG:3857`, `{width}`/`{height}`→tile size, `{bbox}`→`{bbox-epsg-3857}`.
 * - `{switch:a,b,c}` expands to one URL per option.
 *
 * Unknown placeholders (e.g. `{apikey}`) are left intact for the consuming app to fill.
 */
export function convertTileUrl(
  rawUrl: string,
  type: EliLayerType,
  tileSize: number,
): ConvertedUrl {
  let url = rawUrl
  let scheme: 'xyz' | 'tms' = 'xyz'

  if (type === 'wms') {
    url = url
      .replace(/\{proj\}/g, 'EPSG:3857')
      .replace(/\{width\}/g, String(tileSize))
      .replace(/\{height\}/g, String(tileSize))
      .replace(/\{bbox\}/g, '{bbox-epsg-3857}')
  } else {
    // tms / wmts → xyz, with optional flipped-y.
    url = url.replace(/\{zoom\}/g, '{z}')
    if (url.includes('{-y}')) {
      scheme = 'tms'
      url = url.replace(/\{-y\}/g, '{y}')
    }
  }

  return { tiles: expandSwitch(url), scheme }
}
