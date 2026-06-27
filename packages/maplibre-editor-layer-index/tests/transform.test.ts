import type { Feature, Geometry } from 'geojson'
import { describe, expect, it } from 'vitest'
import { geometryBBox, geometryId } from '../scripts/geometry'
import { transform } from '../scripts/transform'

const berlinPolygon = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [13.0, 52.3],
      [13.8, 52.3],
      [13.8, 52.7],
      [13.0, 52.7],
      [13.0, 52.3],
    ],
  ],
}

type AnyFeature = Feature<Geometry | null>

function feature(id: string, extra: Record<string, unknown> = {}): AnyFeature {
  return {
    type: 'Feature',
    properties: {
      id,
      name: id,
      type: 'tms',
      url: 'https://example.com/{zoom}/{x}/{y}.png',
      ...extra,
    },
    geometry: berlinPolygon,
  }
}

function collection(features: AnyFeature[]) {
  return { type: 'FeatureCollection', features }
}

describe('transform', () => {
  it('deduplicates identical geometries to one entry shared by geometryId', () => {
    const result = transform(collection([feature('a'), feature('b'), feature('c')]))
    expect(result.layers).toHaveLength(3)
    expect(result.counts.geometries).toBe(1)
    const ids = new Set(result.layers.map((l) => l.geometryId))
    expect(ids.size).toBe(1)
    expect(Object.keys(result.geometries)).toEqual([...ids])
  })

  it('drops unsupported source types and records the counts', () => {
    const result = transform(
      collection([feature('tms-ok'), feature('bing', { type: 'bing' })]),
    )
    expect(result.layers.map((l) => l.id)).toEqual(['tms-ok'])
    expect(result.counts.dropped).toEqual({ bing: 1 })
    expect(result.counts.upstream).toBe(2)
    expect(result.counts.published).toBe(1)
  })

  it('uses the world sentinel for null geometry and keeps it out of the geometry table', () => {
    const worldFeature = { ...feature('world-layer'), geometry: null }
    const result = transform(collection([worldFeature]))
    expect(result.layers[0]!.geometryId).toBe('world')
    expect(result.layers[0]!.bbox).toEqual([-180, -90, 180, 90])
    expect('world' in result.geometries).toBe(false)
  })

  it('precomputes bbox and country codes for a Berlin polygon', () => {
    const result = transform(collection([feature('berlin')]))
    const layer = result.layers[0]!
    expect(layer.bbox).toEqual([13.0, 52.3, 13.8, 52.7])
    expect(layer.countryCodes).toContain('DE')
  })

  it('throws on structurally invalid input (refuse to publish garbage)', () => {
    expect(() => transform({ type: 'FeatureCollection' })).toThrow()
    expect(() =>
      transform(collection([{ type: 'Feature', properties: {}, geometry: null } as AnyFeature])),
    ).toThrow()
  })
})

describe('geometry helpers', () => {
  it('hashes identical geometries to the same id and differs on change', () => {
    const other = {
      type: 'Polygon' as const,
      coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]],
    }
    expect(geometryId(berlinPolygon)).toBe(geometryId(berlinPolygon))
    expect(geometryId(berlinPolygon)).not.toBe(geometryId(other))
  })

  it('computes a [w,s,e,n] bbox', () => {
    expect(geometryBBox(berlinPolygon)).toEqual([13.0, 52.3, 13.8, 52.7])
  })
})
