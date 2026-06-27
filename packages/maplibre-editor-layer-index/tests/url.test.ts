import { describe, expect, it } from 'vitest'

import { convertTileUrl } from '../scripts/url'

describe('convertTileUrl', () => {
  it('rewrites TMS {zoom} to {z}', () => {
    const { tiles, scheme } = convertTileUrl('https://example.com/{zoom}/{x}/{y}.png', 'tms', 256)
    expect(tiles).toEqual(['https://example.com/{z}/{x}/{y}.png'])
    expect(scheme).toBe('xyz')
  })

  it('flips {-y} to TMS scheme', () => {
    const { tiles, scheme } = convertTileUrl('https://example.com/{zoom}/{x}/{-y}.png', 'tms', 256)
    expect(tiles).toEqual(['https://example.com/{z}/{x}/{y}.png'])
    expect(scheme).toBe('tms')
  })

  it('expands {switch:a,b,c} into one URL per subdomain', () => {
    const { tiles } = convertTileUrl(
      'https://{switch:a,b,c}.example.com/{zoom}/{x}/{y}.png',
      'tms',
      256,
    )
    expect(tiles).toEqual([
      'https://a.example.com/{z}/{x}/{y}.png',
      'https://b.example.com/{z}/{x}/{y}.png',
      'https://c.example.com/{z}/{x}/{y}.png',
    ])
  })

  it('rewrites WMS placeholders for maplibre', () => {
    const { tiles, scheme } = convertTileUrl(
      'https://example.com/wms?SRS={proj}&WIDTH={width}&HEIGHT={height}&BBOX={bbox}',
      'wms',
      512,
    )
    expect(tiles).toEqual([
      'https://example.com/wms?SRS=EPSG:3857&WIDTH=512&HEIGHT=512&BBOX={bbox-epsg-3857}',
    ])
    expect(scheme).toBe('xyz')
  })

  it('leaves unknown placeholders (e.g. {apikey}) intact', () => {
    const { tiles } = convertTileUrl('https://example.com/{zoom}/{x}/{y}?key={apikey}', 'tms', 256)
    expect(tiles).toEqual(['https://example.com/{z}/{x}/{y}?key={apikey}'])
  })

  it('replaces the ArcGIS {wkid} spatial-reference id with 3857', () => {
    const { tiles } = convertTileUrl(
      'https://gis/exportImage?bbox={bbox}&imageSR={wkid}&bboxSR={wkid}',
      'wms',
      256,
    )
    expect(tiles).toEqual([
      'https://gis/exportImage?bbox={bbox-epsg-3857}&imageSR=3857&bboxSR=3857',
    ])
  })
})
