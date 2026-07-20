import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.ts')
        }
      }
    }
  },

  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@elevate-viz': resolve('src/ElevateViz/index.ts'),
        '@elevate-viz-theme': resolve('src/ElevateViz/styles/_theme.scss'),
        '@': resolve('src/renderer/src') // Añadir alias para la carpeta raíz de estilos
      }
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: (source, filename) => {
            const normalizedFilename = filename.replaceAll('\\\\', '/')
            const themePath = normalizedFilename.includes('/src/ElevateViz/')
              ? '@elevate-viz-theme'
              : '@/styles/variables.scss'

            return `@use "${themePath}" as *;\n${source}`
          }
        }
      }
    },
    plugins: [react()]
  }
})
