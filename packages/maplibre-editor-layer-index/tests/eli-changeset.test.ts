import { describe, expect, it } from 'vitest'
import { buildLayerSnapshots, diffLayerSnapshots, type LayerSnapshot } from '../scripts/eli-diff'
import {
  extractPrNumbers,
  formatCommitLine,
  resolveEliSourceCommit,
  shortSha,
} from '../scripts/eli-github'
import { formatEliChangesetBody, formatEliChangesetFile } from '../scripts/write-eli-changeset'
import type { EliLocatorLayer } from '../src/core/types'

function locator(
  partial: Partial<EliLocatorLayer> & Pick<EliLocatorLayer, 'id' | 'name'>,
): EliLocatorLayer {
  return {
    type: 'tms',
    best: false,
    overlay: false,
    tileSize: 256,
    geometryId: 'world',
    bbox: [-180, -90, 180, 90],
    countryCodes: [],
    requiresKeys: [],
    continents: ['world'],
    ...partial,
  }
}

describe('eli-github helpers', () => {
  it('resolves content SHA from Pages deploy commit messages', () => {
    const tip = 'ff5dd4ec118c4543fb2cebf9c84ccba5dcb0abe3'
    const content = '656b36dddc66441df97c17f1edab39b27830c8a2'
    expect(
      resolveEliSourceCommit(
        tip,
        `Deploying to gh-pages from @ osmlab/editor-layer-index@${content} 🚀`,
      ),
    ).toBe(content)
    expect(resolveEliSourceCommit(tip, 'Add layer (#1)')).toBe(tip)
  })

  it('extracts PR numbers and formats commit lines', () => {
    expect(extractPrNumbers('Add actmapi 2025 2026 (#3017)\n\nCo-authored-by: x')).toEqual([3017])
    expect(
      formatCommitLine({
        sha: '656b36dddc66441df97c17f1edab39b27830c8a2',
        message: 'Add actmapi 2025 2026 (#3017)',
        htmlUrl: 'https://github.com/osmlab/editor-layer-index/commit/656b36d',
        prNumbers: [3017],
      }),
    ).toBe(
      '- [`656b36d`](https://github.com/osmlab/editor-layer-index/commit/656b36d) Add actmapi 2025 2026 ([#3017](https://github.com/osmlab/editor-layer-index/pull/3017))',
    )
  })
})

describe('eli layer diff', () => {
  it('classifies added, updated, and removed layers', () => {
    const before = buildLayerSnapshots(
      {
        layers: [
          locator({ id: 'keep', name: 'Keep' }),
          locator({ id: 'gone', name: 'Gone' }),
          locator({ id: 'edit', name: 'Edit', maxzoom: 18 }),
        ],
      },
      {
        keep: { tiles: ['a'] },
        gone: { tiles: ['b'] },
        edit: { tiles: ['c'] },
      },
    )
    const after = buildLayerSnapshots(
      {
        layers: [
          locator({ id: 'keep', name: 'Keep' }),
          locator({ id: 'edit', name: 'Edit', maxzoom: 19 }),
          locator({ id: 'new', name: 'New' }),
        ],
      },
      {
        keep: { tiles: ['a'] },
        edit: { tiles: ['c'] },
        new: { tiles: ['d'] },
      },
    )

    const diff = diffLayerSnapshots(before, after)
    expect(diff.added.map((l) => l.id)).toEqual(['new'])
    expect(diff.removed.map((l) => l.id)).toEqual(['gone'])
    expect(diff.updated.map((l) => l.id)).toEqual(['edit'])
  })
})

describe('eli changeset formatting', () => {
  it('writes Dependabot-friendly notes with commits, PRs, and layer links', () => {
    const layer = (id: string, name: string): LayerSnapshot => ({
      id,
      name,
      fingerprint: id,
    })
    const body = formatEliChangesetBody({
      beforeCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      afterCommit: '656b36dddc66441df97c17f1edab39b27830c8a2',
      diff: {
        added: [layer('actmapi-2025', 'ActMapi 2025')],
        updated: [layer('edit', 'Edited Layer')],
        removed: [layer('gone', 'Gone Layer')],
      },
      compare: {
        htmlUrl:
          'https://github.com/osmlab/editor-layer-index/compare/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa...656b36dddc66441df97c17f1edab39b27830c8a2',
        commits: [
          {
            sha: '656b36dddc66441df97c17f1edab39b27830c8a2',
            message: 'Add actmapi 2025 2026 (#3017)',
            htmlUrl:
              'https://github.com/osmlab/editor-layer-index/commit/656b36dddc66441df97c17f1edab39b27830c8a2',
            prNumbers: [3017],
          },
        ],
        sourceFiles: [],
      },
      sourceFileByLayerId: new Map([
        ['actmapi-2025', { path: 'sources/australia/actmapi-2025.geojson', status: 'added' }],
      ]),
    })

    expect(body).toContain(shortSha('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'))
    expect(body).toContain('compare')
    expect(body).toContain('#3017')
    expect(body).toContain('### Added (1)')
    expect(body).toContain('**ActMapi 2025** (`actmapi-2025`)')
    expect(body).toContain('sources/australia/actmapi-2025.geojson')
    expect(body).toContain('### Updated (1)')
    expect(body).toContain('### Removed (1)')

    const file = formatEliChangesetFile(body)
    expect(file).toMatch(/^---\n"@osm-editor-kit\/maplibre-editor-layer-index": patch\n---\n/)
  })
})
