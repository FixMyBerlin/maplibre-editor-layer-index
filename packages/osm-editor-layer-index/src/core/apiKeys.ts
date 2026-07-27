import { ELI_API_KEYS } from '../data/apiKeys'

/**
 * Names of API keys some ELI layers require (a typed union generated from the
 * data). Provide values for these to unlock and render the layers that need them.
 */
export type EliApiKey = (typeof ELI_API_KEYS)[number]

/** Map of API-key name → value, e.g. `{ apikey: 'pk.…' }`. */
export type EliApiKeys = Partial<Record<EliApiKey, string>>

/** The full set of known API-key names (for building config UIs, docs, etc.). */
export const eliApiKeyNames: readonly EliApiKey[] = ELI_API_KEYS

/** True when every key a layer needs has a (non-empty) value in `apiKeys`. */
export function hasRequiredKeys(requiresKeys: string[], apiKeys?: EliApiKeys): boolean {
  if (requiresKeys.length === 0) return true
  if (!apiKeys) return false
  const provided = apiKeys as Record<string, string | undefined>
  return requiresKeys.every((key) => Boolean(provided[key]))
}

/** Substitute provided API keys into tile URL templates (other tokens untouched). */
export function applyApiKeys(tiles: string[], apiKeys?: EliApiKeys): string[] {
  if (!apiKeys) return tiles
  const provided = apiKeys as Record<string, string | undefined>
  return tiles.map((url) =>
    url.replace(/\{([^}]+)\}/g, (whole, name: string) => provided[name] ?? whole),
  )
}
