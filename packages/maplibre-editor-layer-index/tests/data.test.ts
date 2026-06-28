import { describe, expect, it } from 'vitest'
import {
  getGeometry,
  getLayer,
  getLayers,
  getManifest,
  loadCoverageFeatures,
  loadGeometries,
} from '../src/core/data'
import { layersForCountry } from '../src/core/filter'

// Smoke tests against the real, committed src/data/*.json.
describe('bundled data', () => {
  const layers = getLayers()

  it('exposes a non-empty index with the expected shape (no coordinates)', () => {
    expect(layers.length).toBeGreaterThan(1000)
    for (const layer of layers.slice(0, 50)) {
      expect(typeof layer.id).toBe('string')
      expect(layer.tiles.length).toBeGreaterThan(0)
      expect(layer.bbox).toHaveLength(4)
      expect(Array.isArray(layer.countryCodes)).toBe(true)
      expect(Array.isArray(layer.requiresKeys)).toBe(true)
      expect(layer).not.toHaveProperty('coordinates')
    }
  })

  it('getLayer resolves by id', () => {
    const first = layers[0]!
    expect(getLayer(first.id)?.id).toBe(first.id)
    expect(getLayer('definitely-not-a-real-id')).toBeUndefined()
  })

  it('manifest reports sane counts', () => {
    const manifest = getManifest()
    expect(manifest.counts.published).toBe(layers.length)
    expect(manifest.counts.geometries).toBeLessThan(manifest.counts.published)
    expect(manifest.source).toContain('imagery.geojson')
  })

  it('lazily resolves geometries for region layers and skips worldwide', async () => {
    const geometries = await loadGeometries()
    expect(Object.keys(geometries).length).toBeGreaterThan(100)

    const region = layers.find((l) => l.geometryId !== 'world')!
    expect(await getGeometry(region)).toMatchObject({ type: expect.any(String) })

    const worldwide = layers.find((l) => l.geometryId === 'world')
    if (worldwide) expect(await getGeometry(worldwide)).toBeUndefined()
  })

  it('builds coverage features with the layer id as feature id', async () => {
    const region = layers.find((l) => l.geometryId !== 'world')!
    const fc = await loadCoverageFeatures([region])
    expect(fc.type).toBe('FeatureCollection')
    expect(fc.features[0]?.id).toBe(region.id)
    expect(fc.features[0]?.properties?.id).toBe(region.id)
  })

  it('every layer keeps the raw ELI url template', () => {
    for (const layer of layers.slice(0, 50)) {
      expect(typeof layer.urlTemplate).toBe('string')
      expect(layer.urlTemplate.length).toBeGreaterThan(0)
    }
  })

  it('preserves lossless interop fields (dates + structured attribution) where ELI has them', () => {
    expect(layers.some((l) => l.startDate)).toBe(true)
    expect(layers.some((l) => l.attributionText)).toBe(true)
    expect(layers.some((l) => l.attributionUrl)).toBe(true)
  })

  it('layersForCountry returns region layers for DE plus worldwide', async () => {
    const de = await layersForCountry('DE')
    expect(de.length).toBeGreaterThan(0)
    expect(de.some((l) => l.countryCodes.includes('DE'))).toBe(true)
    expect(de.some((l) => l.geometryId === 'world')).toBe(true)

    const deOnly = await layersForCountry('DE', { includeWorldwide: false })
    expect(deOnly.every((l) => l.geometryId !== 'world')).toBe(true)
    expect(deOnly.length).toBeLessThan(de.length)
  })
})
