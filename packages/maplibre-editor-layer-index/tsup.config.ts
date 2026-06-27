import { copyFile, mkdir } from 'node:fs/promises'

import { defineConfig } from 'tsup'

const DATA_FILES = ['index.json', 'geometries.json', 'manifest.json']

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'react/index': 'src/react/index.ts',
    'maplibre/index': 'src/maplibre/index.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  treeshake: true,
  splitting: true,
  sourcemap: true,
  // Keep consumer-provided libs out of the bundle.
  external: ['react', 'react-map-gl', 'maplibre-gl'],
  async onSuccess() {
    // Ship the generated data as static JSON assets alongside the bundle so the
    // big geometries.json can be reached via a dynamic import() and code-split.
    await mkdir('dist/data', { recursive: true })
    await Promise.all(DATA_FILES.map((file) => copyFile(`src/data/${file}`, `dist/data/${file}`)))
  },
})
