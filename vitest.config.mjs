import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    include: ['tests/main/**/*.test.mjs'],
    setupFiles: ['tests/main/setup.mjs'],
    testTimeout: 60_000,
    hookTimeout: 60_000
  }
})
