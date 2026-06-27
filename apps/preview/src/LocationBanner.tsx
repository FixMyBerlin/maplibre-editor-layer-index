import * as countryCoder from '@rapideditor/country-coder'
import { useSearch } from '@tanstack/react-router'
import { useMemo } from 'react'

/**
 * Demonstrates what the map centre "resolves to" using @rapideditor/country-coder
 * — the same dataset @rapideditor/location-conflation is built on. This is wired up
 * directly in the demo app (NOT re-exported by the package): the package keeps a
 * zero-runtime-dependency footprint and only uses this data at build time.
 */
export function LocationBanner() {
  // `strict: false` — read lat/lng from whichever map route is mounted. The root
  // route has no validateSearch, so values arrive as raw strings; coerce here.
  const search = useSearch({ strict: false }) as { lat?: unknown; lng?: unknown }
  const lat = Number(search.lat)
  const lng = Number(search.lng)

  const regions = useMemo(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return []
    return countryCoder.featuresContaining([lng, lat])
  }, [lat, lng])

  const country = regions.find((r) => r.properties.level === 'country')

  return (
    <div className="loco-banner">
      <span className="loco-label">location-conflation exposes</span>
      {regions.length === 0 ? (
        <span className="loco-empty">no land at this point (open water)</span>
      ) : (
        <span className="loco-regions">
          {country?.properties.iso1A2 && (
            <span className="loco-flag">{countryCoder.emojiFlag(country.properties.iso1A2)}</span>
          )}
          {regions.map((r, i) => (
            <span key={r.properties.id ?? r.properties.nameEn}>
              {i > 0 && <span className="loco-sep"> › </span>}
              <span className={r.properties.level === 'country' ? 'loco-primary' : undefined}>
                {r.properties.nameEn}
              </span>
            </span>
          ))}
        </span>
      )}
      <span className="loco-note">via @rapideditor/country-coder (demo only)</span>
    </div>
  )
}
