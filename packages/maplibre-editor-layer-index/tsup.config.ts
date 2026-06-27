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
  // No source maps in the published tarball — this is a data package, and the maps
  // for the bundled ~11 MB geometries chunk would dwarf the code.
  sourcemap: false,
  // Keep consumer-provided libs out of the bundle. The JSON data is intentionally
  // bundled: the small index into the entry chunks, and geometries.json into its own
  // chunk reached via dynamic import() (so it code-splits and loads lazily).
  external: ['react', 'react-map-gl', 'maplibre-gl'],
})
