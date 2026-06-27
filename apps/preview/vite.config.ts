import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react()],
  server: {
    // Honor the PORT assigned by the preview tooling / CI; fall back for local dev.
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
})
