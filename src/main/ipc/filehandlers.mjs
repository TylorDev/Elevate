import { dialog, ipcMain } from 'electron'

import fs from 'fs'
import { parseFile } from 'music-metadata'
import { getFileInfos, getAllAudioFiles } from './utils/utils.mjs'

export function setupFilehandlers() {
  // Añadir la función de selección de archivos
  ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'flac'] }] // Opcional: filtrar por tipos de archivos
    })

    if (result.canceled) {
      return null // O manejar la cancelación según sea necesario
    }

    const filePath = result.filePaths[0]

    return filePath // Devuelve la URL de datos
  })

  ipcMain.handle('get-file-info', async (event, filePath) => {
    try {
      const stats = fs.statSync(filePath)
      const { common } = await parseFile(filePath)

      return {
        size: stats.size,
        ...common
      }
    } catch (error) {
      console.error('Error getting file info:', error)
      throw error
    }
  })

  ipcMain.handle('select-files', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
      })

      if (result.canceled) {
        return null // O manejar la cancelación según sea necesario
      }

      const directoryPath = result.filePaths[0]

      const audioFiles = getAllAudioFiles(directoryPath)
      return getFileInfos(audioFiles)
    } catch (error) {
      console.error('Error selecting files:', error)
      throw error
    }
  })
}
