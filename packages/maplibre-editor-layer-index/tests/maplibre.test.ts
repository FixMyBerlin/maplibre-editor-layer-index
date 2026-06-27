import { describe, expect, it } from 'vitest'
import type { EliLayer } from '../src/core/types'
import { addEditorLayer, removeEditorLayer, type MapLike } from '../src/maplibre/index'

function fakeMap() {
  const sources = new Map<string, unknown>()
  const mapLayers = new Map<string, unknown>()
  const map: MapLike = {
    addSource: (id, source) => void sources.set(id, source),
    removeSource: (id) => void sources.delete(id),
    getSource: (id) => sources.get(id),
    addLayer: (layer) => void mapLayers.set(layer.id, layer),
    removeLayer: (id) => void mapLayers.delete(id),
    getLayer: (id) => mapLayers.get(id),
  }
  return { map, sources, mapLayers }
}

const layer = {
  id: 'Example',
  name: 'Example',
  type: 'tms',
  best: false,
  overlay: false,
  tiles: ['https://t/{z}/{x}/{y}?key={apikey}'],
  tileSize: 256,
  geometryId: 'g',
  bbox: [0, 0, 1, 1],
  countryCodes: [],
  requiresKeys: ['apikey'],
} as EliLayer

describe('addEditorLayer / removeEditorLayer', () => {
  it('adds a source + layer and is idempotent (re-add replaces)', () => {
    const { map, sources, mapLayers } = fakeMap()
    const id = addEditorLayer(map, layer)
    expect(id).toBe('eli-Example')
    expect(sources.size).toBe(1)
    expect(mapLayers.size).toBe(1)

    addEditorLayer(map, layer)
    expect(sources.size).toBe(1)
    expect(mapLayers.size).toBe(1)
  })

  it('substitutes apiKeys into the added source tiles', () => {
    const { map, sources } = fakeMap()
    addEditorLayer(map, layer, { apiKeys: { apikey: 'pk.test' } })
    expect((sources.get('eli-Example') as { tiles: string[] }).tiles).toEqual([
      'https://t/{z}/{x}/{y}?key=pk.test',
    ])
  })

  it('removeEditorLayer removes both layer and source', () => {
    const { map, sources, mapLayers } = fakeMap()
    addEditorLayer(map, layer)
    removeEditorLayer(map, 'eli-Example')
    expect(sources.size).toBe(0)
    expect(mapLayers.size).toBe(0)
  })
})
