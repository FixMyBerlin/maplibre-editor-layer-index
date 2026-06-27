export const ELI_SOURCE_URL = 'https://osmlab.github.io/editor-layer-index/imagery.geojson'

export type FetchedEli = {
  raw: unknown
  source: string
  /** ETag / Last-Modified, used as a provenance version in the manifest. */
  sourceVersion: string | null
}

/** Download the published ELI imagery FeatureCollection. */
export async function fetchEli(url: string = ELI_SOURCE_URL): Promise<FetchedEli> {
  const response = await fetch(url, {
    headers: { Accept: 'application/geo+json, application/json' },
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch ELI from ${url}: ${response.status} ${response.statusText}`)
  }
  const sourceVersion =
    response.headers.get('etag') ?? response.headers.get('last-modified') ?? null
  const raw = await response.json()
  return { raw, source: url, sourceVersion }
}

// Allow `bun run scripts/fetch.ts` for a quick manual check.
if (import.meta.main) {
  const result = await fetchEli()
  const features = (result.raw as { features?: unknown[] }).features ?? []
  console.log(`Fetched ${features.length} ELI features from ${result.source}`)
  console.log(`Source version: ${result.sourceVersion ?? '(none)'}`)
}
