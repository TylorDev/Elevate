import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const sandboxRoot = fileURLToPath(new URL('.', import.meta.url))
export default defineConfig({
  root: sandboxRoot,
  plugins: [react()],
  resolve: {
    alias: {
      '@elevate-viz': fileURLToPath(new URL('../index.ts', import.meta.url)),
      '@elevate-viz-theme': fileURLToPath(new URL('../styles/_theme.scss', import.meta.url)),
      '@sandbox': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: (source, filename) => {
          const normalizedFilename = filename.replaceAll('\\', '/')
          const theme =
            normalizedFilename.includes('/src/renderer/src/ElevateViz/sandbox/')
              ? '@sandbox/styles/theme'
              : '@elevate-viz-theme'
          return `@use "${theme}" as *;\n${source}`
        }
      }
    }
  },
  server: {
    port: 4175,
    strictPort: true,
    open: true
  },
  build: {
    outDir: fileURLToPath(new URL('../../../../../dist/elevate-viz-sandbox', import.meta.url)),
    emptyOutDir: true
  }
})
