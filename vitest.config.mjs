import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@elevate-viz': fileURLToPath(new URL('./src/ElevateViz/index.ts', import.meta.url))
    }
  },
  test: {
    environment: 'node',
    fileParallelism: false,
    include: ['tests/main/**/*.test.mjs', 'tests/renderer/**/*.test.mjs'],
    setupFiles: ['tests/main/setup.mjs'],
    testTimeout: 60_000,
    hookTimeout: 60_000
  }
})
