import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchEli } from './fetch'
import { transform } from './transform'

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data')

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

/**
 * Compare freshly-transformed ELI data against the committed `index.json` +
 * `geometries.json`. Exit code 0 = changed (release), 1 = unchanged (skip).
 * The CI workflow reads the exit code to decide whether to cut a release.
 *
 * Manifest is ignored on purpose — its `generatedAt` timestamp always differs.
 */
async function main(): Promise<void> {
  const { raw } = await fetchEli()
  const { layers, geometries } = transform(raw)
  const fresh = hash({ layers, geometries })

  let committed = ''
  try {
    const [index, geoms] = await Promise.all([
      readFile(join(DATA_DIR, 'index.json'), 'utf8'),
      readFile(join(DATA_DIR, 'geometries.json'), 'utf8'),
    ])
    committed = hash({ layers: JSON.parse(index).layers, geometries: JSON.parse(geoms) })
  } catch {
    console.log('No committed data found — treating as changed.')
    process.exit(0)
  }

  if (fresh === committed) {
    console.log('ELI data unchanged.')
    process.exit(1)
  }
  console.log('ELI data changed.')
  process.exit(0)
}

await main()
