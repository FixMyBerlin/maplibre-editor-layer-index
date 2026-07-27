import { defineConfig } from 'tsup'

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
  // No source maps in the published tarball — this is a data package, and maps for
  // continent geometry shards would dwarf the code.
  sourcemap: false,
  // Keep consumer-provided libs out of the bundle. The slim locator is bundled into
  // the entry chunks; details/<continent>.json and geometries/<continent>.json are
  // reached via dynamic import() so bundlers code-split and load by map region.
  external: ['react', 'react-map-gl', 'maplibre-gl'],
})
