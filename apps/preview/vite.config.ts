import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const rootDir = dirname(fileURLToPath(import.meta.url))
const packageJson = JSON.parse(
  readFileSync(resolve(rootDir, '../../packages/maplibre-editor-layer-index/package.json'), 'utf8'),
) as { version: string }

// Project Pages live at /<repo>/; local `vite` / `vite preview` stay at `/`.
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react()],
  define: {
    __PACKAGE_VERSION__: JSON.stringify(packageJson.version),
    __BUILT_AT__: JSON.stringify(process.env.VITE_BUILT_AT ?? new Date().toISOString()),
  },
  server: {
    // Honor the PORT assigned by the preview tooling / CI; fall back for local dev.
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
})
