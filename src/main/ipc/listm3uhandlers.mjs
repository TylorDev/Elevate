import { dialog, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import { processM3UFile } from './utils/utils.mjs'

export function setupM3UHandlers() {
  ipcMain.handle('open-m3u', async () => {
    try {
      // Selecciona el archivo M3U
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'M3U Files', extensions: ['m3u'] }]
      })

      if (result.canceled || result.filePaths.length === 0) {
        return []
      }

      const m3uFilePath = result.filePaths[0]
      const m3uDirectory = path.dirname(m3uFilePath) // Obtener la ruta del directorio del archivo M3U

      return processM3UFile(m3uFilePath, m3uDirectory)
    } catch (error) {
      console.error('Error processing M3U file:', error)
      return []
    }
  })

  ipcMain.handle('detect-m3u', async () => {
    try {
      // Selecciona un directorio
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
      })

      if (result.canceled || result.filePaths.length === 0) {
        return []
      }

      const directoryPath = result.filePaths[0]

      // Busca un archivo M3U en el directorio seleccionado
      const files = await fs.promises.readdir(directoryPath)
      const m3uFile = files.find((file) => path.extname(file).toLowerCase() === '.m3u')

      if (!m3uFile) {
        console.error('No M3U file found in the selected directory.')
        return []
      }

      const m3uFilePath = path.join(directoryPath, m3uFile)

      return processM3UFile(m3uFilePath, directoryPath)
    } catch (error) {
      console.error('Error detecting M3U file:', error)
      return []
    }
  })

  ipcMain.handle('save-m3u', async (event, filePaths) => {
    if (filePaths.length === 0) {
      console.log('No file paths provided.')
      return
    }

    // Encontrar la ruta base común
    const commonBasePath = filePaths.reduce((commonBase, filePath) => {
      if (!commonBase) return path.dirname(filePath)
      let base = path.dirname(filePath)
      while (filePath.indexOf(base) !== 0) {
        base = path.dirname(base)
        if (base === '') return commonBase
      }
      return base
    }, '')

    // Crear el contenido del archivo M3U
    const m3uContent = filePaths
      .map((filePath) => path.relative(commonBasePath, filePath))
      .join('\n')

    // Ruta del archivo M3U que se va a guardar
    const m3uFilePath = path.join(commonBasePath, 'playlist.m3u')

    // Guardar el archivo M3U
    try {
      await fs.promises.writeFile(m3uFilePath, m3uContent)
      console.log('M3U file saved successfully:', m3uFilePath)
      return { success: true, path: m3uFilePath }
    } catch (err) {
      console.error('Error writing M3U file:', err)
      return { success: false, error: err.message }
    }
  })
}
