# maplibre-editor-layer-index

Use the OSM [Editor Layer Index](https://github.com/osmlab/editor-layer-index) (ELI) as background /
imagery layers in **[react-map-gl](https://visgl.github.io/react-map-gl/)** (primary) and
**[maplibre-gl-js](https://maplibre.org/)** (raw JS). The package gives you the **layer list** and
**viewport filtering**; you keep full control of styling.

This is a Bun-workspaces monorepo:

| Path | What |
| --- | --- |
| [`packages/maplibre-editor-layer-index`](packages/maplibre-editor-layer-index) | The published npm package (ESM-only). |
| [`apps/preview`](apps/preview) | A TanStack Router + Vite SPA demo showcasing both react-map-gl and raw maplibre usage. |

## Why it's small

The data is split into two tiers, generated at release time:

- **`index.json`** — one compact record per layer (metadata + precomputed `bbox` + `countryCodes`,
  **no coordinates**). Always loaded. This alone answers "which layers cover the current viewport?".
- **`geometries.json`** — full coverage polygons, deduplicated by hash. Loaded **lazily** via
  dynamic `import()` only when an app actually needs a coverage outline. Most apps never load it.

Filtering is a pure-arithmetic **bbox overlap** against the map viewport — zero runtime geo
dependencies. `@rapideditor/country-coder` and `zod` are used at **build time only**.

## Develop

```bash
bun install
bun run eli:build      # fetch + validate + transform ELI → packages/.../src/data
bun run build          # build the package (tsup, ESM + d.ts)
bun run test           # vitest
bun run check-exports  # attw (ESM resolution validation)
bun run dev            # preview app
```

## Release

Versioning via [changesets](https://github.com/changesets/changesets). A weekly GitHub Action
regenerates the ELI data and, if it changed, commits a `patch` changeset; a release workflow then
publishes to npm. See [`.github/workflows`](.github/workflows).
