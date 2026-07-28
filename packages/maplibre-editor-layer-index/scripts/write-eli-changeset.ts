/**
 * After `eli:build`, write a patch changeset describing ELI layer + upstream
 * commit changes so `changeset version` can fold them into CHANGELOG.md.
 *
 * Prints `written=true|false` (and `path=...` when written) for GitHub Actions.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type LayerDiff,
  type LayerSnapshot,
  diffLayerSnapshots,
  layerDiffIsEmpty,
  loadLayerSnapshotsFromDir,
  loadLayerSnapshotsFromGitHead,
} from './eli-diff'
import {
  ELI_REPO_URL,
  type EliGithubCompare,
  fetchEliCompare,
  formatCommitLine,
  mapSourceFilesToLayerIds,
  shortSha,
} from './eli-github'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PACKAGE_ROOT = join(SCRIPT_DIR, '..')
const DATA_DIR = join(PACKAGE_ROOT, 'src', 'data')
const REPO_ROOT = join(PACKAGE_ROOT, '..', '..')
const DATA_GIT_PREFIX = 'packages/maplibre-editor-layer-index/src/data'
const CHANGESET_DIR = join(REPO_ROOT, '.changeset')
const PACKAGE_NAME = '@osm-editor-kit/maplibre-editor-layer-index'

/** Keep Dependabot / CHANGELOG entries readable when upstream churns. */
const MAX_LAYERS_PER_SECTION = 40
const MAX_COMMITS = 30

export type EliChangesetInput = {
  beforeCommit: string | null
  afterCommit: string | null
  diff: LayerDiff
  compare: EliGithubCompare | null
  sourceFileByLayerId: Map<string, { path: string; status: string }>
}

function layerLine(
  layer: LayerSnapshot,
  sourceFileByLayerId: Map<string, { path: string; status: string }>,
  afterCommit: string | null,
): string {
  const source = sourceFileByLayerId.get(layer.id)
  const parts = [`- **${layer.name}** (\`${layer.id}\`)`]
  if (source && afterCommit && source.status !== 'removed') {
    const blob = `${ELI_REPO_URL}/blob/${afterCommit}/${source.path}`
    const history = `${ELI_REPO_URL}/commits/${afterCommit}/${source.path}`
    parts.push(` — [source](${blob}) · [history](${history})`)
  } else if (source) {
    parts.push(` — \`${source.path}\``)
  }
  return parts.join('')
}

function formatLayerSection(
  title: string,
  layers: LayerSnapshot[],
  sourceFileByLayerId: Map<string, { path: string; status: string }>,
  afterCommit: string | null,
): string[] {
  if (layers.length === 0) return []
  const lines = [`### ${title} (${layers.length})`]
  const shown = layers.slice(0, MAX_LAYERS_PER_SECTION)
  for (const layer of shown) {
    lines.push(layerLine(layer, sourceFileByLayerId, afterCommit))
  }
  const rest = layers.length - shown.length
  if (rest > 0) lines.push(`- …and ${rest} more`)
  lines.push('')
  return lines
}

export function formatEliChangesetBody(input: EliChangesetInput): string {
  const { beforeCommit, afterCommit, diff, compare, sourceFileByLayerId } = input
  const lines: string[] = []

  if (beforeCommit && afterCommit && beforeCommit !== afterCommit) {
    const compareUrl =
      compare?.htmlUrl ?? `${ELI_REPO_URL}/compare/${beforeCommit}...${afterCommit}`
    lines.push(
      `Update Editor Layer Index data ([${'`' + shortSha(beforeCommit) + '`'}](${ELI_REPO_URL}/commit/${beforeCommit}) → [${'`' + shortSha(afterCommit) + '`'}](${ELI_REPO_URL}/commit/${afterCommit}), [compare](${compareUrl})).`,
    )
  } else if (afterCommit) {
    lines.push(
      `Update Editor Layer Index data (upstream [${'`' + shortSha(afterCommit) + '`'}](${ELI_REPO_URL}/commit/${afterCommit})).`,
    )
  } else {
    lines.push('Update Editor Layer Index data (automated refresh).')
  }
  lines.push('')

  const commits = (compare?.commits ?? []).filter(
    (c) => !/Deploying to gh-pages from @/i.test(c.message),
  )
  if (commits.length > 0) {
    lines.push('Upstream commits:')
    for (const commit of commits.slice(0, MAX_COMMITS)) {
      lines.push(formatCommitLine(commit))
    }
    if (commits.length > MAX_COMMITS) {
      lines.push(`- …and ${commits.length - MAX_COMMITS} more`)
    }
    lines.push('')
  }

  lines.push(
    ...formatLayerSection('Added', diff.added, sourceFileByLayerId, afterCommit),
    ...formatLayerSection('Updated', diff.updated, sourceFileByLayerId, afterCommit),
    ...formatLayerSection('Removed', diff.removed, sourceFileByLayerId, afterCommit),
  )

  return `${lines.join('\n').trimEnd()}\n`
}

export function formatEliChangesetFile(body: string): string {
  return `---\n"${PACKAGE_NAME}": patch\n---\n\n${body}`
}

function shouldWriteChangeset(
  diff: LayerDiff,
  beforeCommit: string | null,
  afterCommit: string | null,
  hadPriorData: boolean,
): boolean {
  if (!layerDiffIsEmpty(diff)) return true
  // Upstream content SHA moved but our published set is identical (e.g. only
  // unsupported ELI types changed) — still record provenance.
  if (hadPriorData && beforeCommit && afterCommit && beforeCommit !== afterCommit) return true
  return false
}

export async function writeEliChangeset(options: {
  runId?: string
  outPath?: string
}): Promise<{ written: boolean; path: string | null; body: string | null }> {
  const after = await loadLayerSnapshotsFromDir(DATA_DIR)
  const before = await loadLayerSnapshotsFromGitHead(REPO_ROOT, DATA_GIT_PREFIX)

  const diff: LayerDiff = before
    ? diffLayerSnapshots(before.layers, after.layers)
    : {
        added: [...after.layers.values()].sort((a, b) => a.name.localeCompare(b.name)),
        updated: [],
        removed: [],
      }

  const beforeCommit = before?.manifest.sourceCommit ?? null
  const afterCommit = after.manifest.sourceCommit ?? null

  if (!shouldWriteChangeset(diff, beforeCommit, afterCommit, before !== null)) {
    return { written: false, path: null, body: null }
  }

  let compare: EliGithubCompare | null = null
  let sourceFileByLayerId = new Map<string, { path: string; status: string }>()
  if (beforeCommit && afterCommit && beforeCommit !== afterCommit) {
    compare = await fetchEliCompare(beforeCommit, afterCommit)
    if (compare?.sourceFiles.length) {
      sourceFileByLayerId = await mapSourceFilesToLayerIds(
        compare.sourceFiles,
        beforeCommit,
        afterCommit,
      )
    }
  }

  const body = formatEliChangesetBody({
    beforeCommit,
    afterCommit,
    diff,
    compare,
    sourceFileByLayerId,
  })
  const path = options.outPath ?? join(CHANGESET_DIR, `eli-auto-${options.runId ?? Date.now()}.md`)

  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, formatEliChangesetFile(body))
  return { written: true, path, body }
}

if (import.meta.main) {
  const result = await writeEliChangeset({
    runId: process.env.GITHUB_RUN_ID,
  })
  console.log(`written=${result.written}`)
  if (result.path) console.log(`path=${result.path}`)
}
