import { useEffect, useMemo, useRef, useState } from 'react'
import { useMap } from 'react-map-gl/maplibre'
import {
  ensureDetailsForContinents,
  ensureDetailsForViewport,
  getShardsMeta,
  hydrateLayers,
} from '../core/data'
import { filterLayers, layersInViewport, type FilterOptions } from '../core/filter'
import type { EliLayer } from '../core/types'

/** The map capabilities the hook needs — satisfied by maplibre-gl and react-map-gl maps. */
type MapWithBounds = {
  getBounds(): { getWest(): number; getSouth(): number; getEast(): number; getNorth(): number }
  on(type: 'moveend', listener: () => void): unknown
  off(type: 'moveend', listener: () => void): unknown
}

export type UseEditorLayerIndexOptions = {
  /**
   * Map to read the viewport from. Defaults to the current map from react-map-gl's
   * `useMap()` (the single `<Map>` in scope, or pass `id` via the provider).
   */
  map?: MapWithBounds | null
  /** `id` of a specific react-map-gl `<Map id="…">` when several are mounted. */
  mapId?: string
  /** Predicate filters (category, type, best, overlays, countryCodes). */
  filter?: FilterOptions
  /** Debounce viewport recomputation after `moveend` (ms). Default 150. */
  debounceMs?: number
  /** When false, returns the filtered list without any viewport filtering. Default true. */
  viewportFilter?: boolean
}

export type UseEditorLayerIndexResult = {
  /** ELI layers covering the current viewport (or all, when `viewportFilter` is false). */
  layers: EliLayer[]
  /** `loading` while detail shards are being fetched; `ready` once hydrated. */
  status: 'loading' | 'ready'
}

/**
 * React hook returning the ELI layers covering the current map viewport. Recomputes
 * (debounced) on every `moveend`. This package owns the **list + location filtering**;
 * rendering and styling stay with you — map over `layers` and render react-map-gl
 * `<Source>` / `<Layer>` (see `getRasterSourceSpec` / `getRasterLayerSpec`).
 */
export function useEditorLayerIndex(
  options: UseEditorLayerIndexOptions = {},
): UseEditorLayerIndexResult {
  const { map: explicitMap, mapId, filter, debounceMs = 150, viewportFilter = true } = options

  const maps = useMap()
  const map = useMemo<MapWithBounds | null>(() => {
    if (explicitMap) return explicitMap
    const ref = mapId ? maps[mapId] : maps.current
    return (ref?.getMap() as unknown as MapWithBounds) ?? null
  }, [explicitMap, mapId, maps])

  // Re-run filtering when the filter object content changes, not its identity.
  const filterKey = JSON.stringify(filter ?? {})

  const [layers, setLayers] = useState<EliLayer[]>([])
  const [status, setStatus] = useState<'loading' | 'ready'>('loading')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const generation = useRef(0)

  useEffect(() => {
    setStatus('loading')

    if (!viewportFilter) {
      const gen = ++generation.current
      const locators = filterLayers(filter)
      void ensureDetailsForContinents(getShardsMeta().continents).then(() => {
        if (gen !== generation.current) return
        setLayers(hydrateLayers(locators))
        setStatus('ready')
      })
      return
    }

    if (!map) return

    const recompute = () => {
      const gen = ++generation.current
      setStatus('loading')
      const bounds = map.getBounds()
      const locators = layersInViewport(bounds, filter)
      void ensureDetailsForViewport(bounds).then(() => {
        if (gen !== generation.current) return
        setLayers(hydrateLayers(locators))
        setStatus('ready')
      })
    }

    const onMoveEnd = () => {
      clearTimeout(timer.current)
      timer.current = setTimeout(recompute, debounceMs)
    }

    recompute()
    map.on('moveend', onMoveEnd)
    return () => {
      clearTimeout(timer.current)
      map.off('moveend', onMoveEnd)
    }
    // filterKey stands in for `filter`'s content; map identity covers readiness.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, viewportFilter, debounceMs, filterKey])

  return { layers, status }
}

export {
  eliSourceId,
  getRasterLayerSpec,
  getRasterSourceSpec,
  type RasterLayerOptions,
  type RasterLayerSpec,
  type RasterSourceOptions,
  type RasterSourceSpec,
} from '../core/specs'
export { continentForLngLat } from '../core/continents'
export {
  filterLayers,
  layersForCountry,
  layersInViewport,
  loadLayersInViewport,
  type FilterOptions,
  type ViewportBounds,
} from '../core/filter'
export {
  continentsForCenter,
  continentsForViewport,
  ensureDetailsForContinents,
  ensureDetailsForViewport,
  getGeometry,
  getLayer,
  getLayerHydrated,
  getLayers,
  getManifest,
  getShardsMeta,
  hydrateLayer,
  hydrateLayers,
  loadByCountry,
  loadCoverageFeatures,
  loadGeometries,
  type CoverageFeature,
} from '../core/data'
export {
  applyApiKeys,
  eliApiKeyNames,
  hasRequiredKeys,
  type EliApiKey,
  type EliApiKeys,
} from '../core/apiKeys'
export type {
  EliCategory,
  EliContinent,
  EliLayer,
  EliLayerDetails,
  EliLayerType,
  EliLocatorLayer,
  EliShardsMeta,
} from '../core/types'
