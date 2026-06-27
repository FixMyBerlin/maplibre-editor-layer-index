import { describe, expect, it } from 'vitest'
import { applyApiKeys, hasRequiredKeys } from '../src/core/apiKeys'
import { filterLayers, layersInViewport } from '../src/core/filter'
import { getRasterLayerSpec, getRasterSourceSpec } from '../src/core/specs'
import type { EliLayer } from '../src/core/types'

function layer(partial: Partial<EliLayer> & Pick<EliLayer, 'id' | 'bbox'>): EliLayer {
  return {
    name: partial.id,
    type: 'tms',
    best: false,
    overlay: false,
    tiles: ['https://example.com/{z}/{x}/{y}.png'],
    tileSize: 256,
    geometryId: 'g',
    countryCodes: [],
    requiresKeys: [],
    ...partial,
  } as EliLayer
}

const berlin = layer({ id: 'berlin', bbox: [13.0, 52.3, 13.8, 52.7], countryCodes: ['DE'] })
const paris = layer({ id: 'paris', bbox: [2.2, 48.8, 2.5, 49.0], countryCodes: ['FR'] })
const world = layer({ id: 'world', bbox: [-180, -90, 180, 90], geometryId: 'world' })
const layers = [berlin, paris, world]

const berlinViewport = { west: 13.2, south: 52.4, east: 13.6, north: 52.6 }

describe('layersInViewport', () => {
  it('returns layers overlapping the viewport plus worldwide layers', () => {
    const result = layersInViewport(berlinViewport, {}, layers).map((l) => l.id)
    expect(result).toContain('berlin')
    expect(result).toContain('world')
    expect(result).not.toContain('paris')
  })

  it('accepts [w,s,e,n] tuples and LngLatBounds-like objects', () => {
    const tuple = layersInViewport([13.2, 52.4, 13.6, 52.6], {}, layers).map((l) => l.id)
    const boundsLike = layersInViewport(
      {
        getWest: () => 13.2,
        getSouth: () => 52.4,
        getEast: () => 13.6,
        getNorth: () => 52.6,
      },
      {},
      layers,
    ).map((l) => l.id)
    expect(tuple).toEqual(boundsLike)
  })

  it('filters region-scoped layers by countryCodes but always keeps worldwide', () => {
    const result = layersInViewport([-180, -90, 180, 90], { countryCodes: ['FR'] }, layers).map(
      (l) => l.id,
    )
    // paris matches FR; world has no country list so it always passes; berlin (DE) drops.
    expect(result).toEqual(['paris', 'world'])
  })

  it('drops a globe-spanning layer that does not cover the viewport country (TIGER case)', () => {
    // bbox spans the world (antimeridian territories) but country codes are US/CA only.
    const tiger = layer({ id: 'tiger', bbox: [-178, 12, 180, 71], countryCodes: ['US', 'CA'] })
    const result = layersInViewport(berlinViewport, { countryCodes: ['DE'] }, [berlin, tiger]).map(
      (l) => l.id,
    )
    expect(result).toEqual(['berlin'])
  })

  it('includeWorldwide:false drops worldwide layers', () => {
    const result = layersInViewport(berlinViewport, { includeWorldwide: false }, layers).map(
      (l) => l.id,
    )
    expect(result).toEqual(['berlin'])
  })
})

describe('filterLayers', () => {
  it('filters by type/best/overlay without location', () => {
    const best = layer({ id: 'best', bbox: [0, 0, 1, 1], best: true })
    expect(filterLayers({ bestOnly: true }, [berlin, best]).map((l) => l.id)).toEqual(['best'])
  })

  it('hides key-requiring layers by default, includes them once keys are provided', () => {
    const keyed = layer({ id: 'mapbox', bbox: [0, 0, 1, 1], requiresKeys: ['apikey'] })
    const layers = [berlin, keyed]
    expect(filterLayers({}, layers).map((l) => l.id)).toEqual(['berlin'])
    expect(filterLayers({ apiKeys: { apikey: 'pk.test' } }, layers).map((l) => l.id)).toEqual([
      'berlin',
      'mapbox',
    ])
  })
})

describe('api keys', () => {
  it('hasRequiredKeys reflects availability', () => {
    expect(hasRequiredKeys([])).toBe(true)
    expect(hasRequiredKeys(['apikey'])).toBe(false)
    expect(hasRequiredKeys(['apikey'], { apikey: '' })).toBe(false)
    expect(hasRequiredKeys(['apikey'], { apikey: 'pk' })).toBe(true)
  })

  it('applyApiKeys substitutes only matching placeholders', () => {
    expect(applyApiKeys(['https://t/{z}/{x}/{y}?key={apikey}'], { apikey: 'pk.test' })).toEqual([
      'https://t/{z}/{x}/{y}?key=pk.test',
    ])
    // Standard tokens are never touched.
    expect(applyApiKeys(['https://t/{z}/{x}/{y}'], { apikey: 'pk' })).toEqual([
      'https://t/{z}/{x}/{y}',
    ])
  })

  it('getRasterSourceSpec substitutes keys into tiles', () => {
    const keyed = layer({
      id: 'k',
      bbox: [0, 0, 1, 1],
      tiles: ['https://t/{z}/{x}/{y}?key={apikey}'],
    })
    expect(getRasterSourceSpec(keyed, { apiKeys: { apikey: 'pk' } }).tiles).toEqual([
      'https://t/{z}/{x}/{y}?key=pk',
    ])
  })
})

describe('specs', () => {
  it('builds a maplibre raster source spec', () => {
    const tms = layer({ id: 't', bbox: [0, 0, 1, 1], scheme: 'tms', maxzoom: 19 })
    expect(getRasterSourceSpec(tms)).toEqual({
      type: 'raster',
      tiles: ['https://example.com/{z}/{x}/{y}.png'],
      tileSize: 256,
      scheme: 'tms',
      maxzoom: 19,
    })
  })

  it('builds a raster layer spec with a derived id', () => {
    expect(getRasterLayerSpec(berlin)).toMatchObject({
      id: 'eli-berlin',
      type: 'raster',
      source: 'eli-berlin',
    })
  })
})
