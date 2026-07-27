# @osm-editor-kit/maplibre-editor-layer-index

Use the OSM [Editor Layer Index](https://github.com/osmlab/editor-layer-index) (ELI) as background /
imagery layers in **[react-map-gl](https://visgl.github.io/react-map-gl/)** (primary) and
**[maplibre-gl-js](https://maplibre.org/)** (raw JS). The package gives you the **layer list** and
**viewport filtering**; you keep full control of styling.

Part of the [`osm-editor-kit`](https://github.com/osm-editor-kit) GitHub org /
[`@osm-editor-kit`](https://www.npmjs.com/org/osm-editor-kit) npm org (same family as
[Street Space Editor](https://github.com/osmberlin/street-space-editor)).

This is a Bun-workspaces monorepo:

| Path                                                                           | What                                                                                   |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| [`packages/maplibre-editor-layer-index`](packages/maplibre-editor-layer-index) | The published npm package (ESM-only).                                                  |
| [`apps/preview`](apps/preview)                                                 | A TanStack Router + Vite SPA demo showcasing both react-map-gl and raw maplibre usage. |

**Live preview:** [osm-editor-kit.github.io/maplibre-editor-layer-index](https://osm-editor-kit.github.io/maplibre-editor-layer-index/)
(redeployed on every npm release; header shows package version + build time).

## Why it's small (at runtime)

Data is generated at release time into three tiers:

- **`locator.json` (~820 KB)** — always loaded. Filter fields only (`bbox`, `countryCodes`,
  `continents`, zooms, …). No tile URLs, attribution, or polygon coordinates. Enough for
  sync `layersInViewport()`.
- **`details/<continent>.json`** — lazy. Tile URLs, `urlTemplate`, attribution, icons. Loaded for
  `world` plus the continent under the map center (via a tiny shard router).
- **`geometries/<continent>.json`** — lazy. Deduplicated coverage polygons. Only loaded when you
  draw coverage outlines.

The npm package still ships **all** shards (install size is not per-region). Source maps are not
published. JSON is inlined into ESM chunks by the build — not duplicated under `dist/data/`.

Filtering is pure-arithmetic **bbox overlap** — zero runtime geo dependencies.
`@rapideditor/country-coder` and `zod` are **build time only**.

## Other consumers (iD / Rapid / Leaflet)

ELI has no npm release, so editors like [iD](https://github.com/openstreetmap/iD) vendor it as a
pinned `gh-pages` commit. This package is still the MapLibre-branded npm release, but non-MapLibre
renderers use the **root entry** (`@osm-editor-kit/maplibre-editor-layer-index`, not `/maplibre` or
`/react`) and
each layer's raw **`urlTemplate`** (not MapLibre `tiles`) after hydrating details. See
[docs/iD-integration.md](docs/iD-integration.md) for the iD adapter sketch.

## Develop

```bash
bun install
bun run eli:build      # fetch + validate + transform ELI → packages/maplibre-editor-layer-index/src/data
bun run build          # build the package (tsup, ESM + d.ts)
bun run test           # vitest
bun run check-exports  # attw (ESM resolution validation)
bun run dev            # preview app
```

## Release

Versioning via [changesets](https://github.com/changesets/changesets). One GitHub Actions workflow
(`.github/workflows/release.yml`) handles everything — no release PR:

- **Weekly cron** — refreshes ELI data; patch-bumps and publishes when upstream data changed
- **Push to `main`** — if your merge includes a `.changeset/*.md`, versions and publishes directly
- **Manual** — Actions → Release → Run workflow (optional ELI refresh + forced patch/minor/major bump)

Publishes via npm **trusted publishing** (OIDC) from `release.yml` — no long-lived `NPM_TOKEN`.
After a successful publish, the same workflow builds `apps/preview` and deploys it to
**GitHub Pages** as a secondary job (`deploy-preview`).

See [`.github/workflows`](.github/workflows).

**One-time Pages setup** (repo Settings → Pages): set Source to **GitHub Actions**. The first
successful release after that publishes the preview site.
