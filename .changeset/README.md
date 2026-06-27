# Changesets

This folder holds [changesets](https://github.com/changesets/changesets). Each changeset is a
markdown file describing a version bump for `maplibre-editor-layer-index`.

The weekly `update-eli` workflow adds a `patch` changeset automatically whenever the upstream
Editor Layer Index data changes. For code changes, run `bunx changeset` and commit the result.
