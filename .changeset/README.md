# Changesets

This folder holds [changesets](https://github.com/changesets/changesets). Each changeset is a
markdown file describing a version bump for `@osm-editor-kit/maplibre-editor-layer-index`.

The weekly release job refreshes ELI data, then runs `eli:changeset` to write a `patch`
changeset listing added/updated/removed layers plus upstream commit/PR links. For code changes,
run `bunx changeset` and commit the result.
