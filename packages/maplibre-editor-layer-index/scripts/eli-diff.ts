import { spawnSync } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  EliDetailsShard,
  EliLocatorIndex,
  EliLocatorLayer,
  EliManifest,
} from '../src/core/types'
import { CONTINENTS } from './continents'

export type LayerSnapshot = {
  id: string
  name: string
  /** Stable fingerprint of locator + detail fields (geometry changes flip geometryId). */
  fingerprint: string
}

export type LayerDiff = {
  added: LayerSnapshot[]
  updated: LayerSnapshot[]
  removed: LayerSnapshot[]
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
      )
    }
    return v
  })
}

export function fingerprintLayer(
  locator: EliLocatorLayer,
  details: Record<string, unknown> | undefined,
): string {
  return stableStringify({ locator, details: details ?? null })
}

export function buildLayerSnapshots(
  locator: EliLocatorIndex,
  detailsById: Record<string, Record<string, unknown>>,
): Map<string, LayerSnapshot> {
  const map = new Map<string, LayerSnapshot>()
  for (const layer of locator.layers) {
    map.set(layer.id, {
      id: layer.id,
      name: layer.name,
      fingerprint: fingerprintLayer(layer, detailsById[layer.id]),
    })
  }
  return map
}

export function diffLayerSnapshots(
  before: Map<string, LayerSnapshot>,
  after: Map<string, LayerSnapshot>,
): LayerDiff {
  const added: LayerSnapshot[] = []
  const updated: LayerSnapshot[] = []
  const removed: LayerSnapshot[] = []

  for (const [id, next] of after) {
    const prev = before.get(id)
    if (!prev) added.push(next)
    else if (prev.fingerprint !== next.fingerprint) updated.push(next)
  }
  for (const [id, prev] of before) {
    if (!after.has(id)) removed.push(prev)
  }

  const byName = (a: LayerSnapshot, b: LayerSnapshot) => a.name.localeCompare(b.name)
  added.sort(byName)
  updated.sort(byName)
  removed.sort(byName)
  return { added, updated, removed }
}

export function layerDiffIsEmpty(diff: LayerDiff): boolean {
  return diff.added.length === 0 && diff.updated.length === 0 && diff.removed.length === 0
}

async function readJsonFile<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T
}

async function loadDetailsById(dataDir: string): Promise<Record<string, Record<string, unknown>>> {
  const detailsDir = join(dataDir, 'details')
  const byId: Record<string, Record<string, unknown>> = {}
  let names: string[]
  try {
    names = await readdir(detailsDir)
  } catch {
    return byId
  }
  await Promise.all(
    names
      .filter((n) => n.endsWith('.json'))
      .map(async (name) => {
        const shard = await readJsonFile<EliDetailsShard>(join(detailsDir, name))
        for (const [id, details] of Object.entries(shard)) {
          byId[id] = details as Record<string, unknown>
        }
      }),
  )
  return byId
}

/** Load layer snapshots from a built `src/data` directory. */
export async function loadLayerSnapshotsFromDir(
  dataDir: string,
): Promise<{ manifest: EliManifest; layers: Map<string, LayerSnapshot> }> {
  const manifest = await readJsonFile<EliManifest>(join(dataDir, 'manifest.json'))
  const locator = await readJsonFile<EliLocatorIndex>(join(dataDir, 'locator.json'))
  const detailsById = await loadDetailsById(dataDir)
  return { manifest, layers: buildLayerSnapshots(locator, detailsById) }
}

function gitShow(repoRoot: string, revPath: string): string | null {
  const result = spawnSync('git', ['show', revPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (result.status !== 0) return null
  return result.stdout
}

async function loadDetailsByIdFromGit(
  repoRoot: string,
  dataGitPrefix: string,
): Promise<Record<string, Record<string, unknown>>> {
  const byId: Record<string, Record<string, unknown>> = {}
  for (const continent of CONTINENTS) {
    const raw = gitShow(repoRoot, `HEAD:${dataGitPrefix}/details/${continent}.json`)
    if (!raw) continue
    const shard = JSON.parse(raw) as EliDetailsShard
    for (const [id, details] of Object.entries(shard)) {
      byId[id] = details as Record<string, unknown>
    }
  }
  return byId
}

/**
 * Load the last committed layer snapshots (`HEAD`). Returns null when data is
 * not yet in git (first run).
 */
export async function loadLayerSnapshotsFromGitHead(
  repoRoot: string,
  dataGitPrefix: string,
): Promise<{ manifest: EliManifest; layers: Map<string, LayerSnapshot> } | null> {
  const manifestRaw = gitShow(repoRoot, `HEAD:${dataGitPrefix}/manifest.json`)
  const locatorRaw = gitShow(repoRoot, `HEAD:${dataGitPrefix}/locator.json`)
  if (!manifestRaw || !locatorRaw) return null

  const manifest = JSON.parse(manifestRaw) as EliManifest
  const locator = JSON.parse(locatorRaw) as EliLocatorIndex
  const detailsById = await loadDetailsByIdFromGit(repoRoot, dataGitPrefix)
  return { manifest, layers: buildLayerSnapshots(locator, detailsById) }
}
