import { dialog, ipcMain } from 'electron'

import { getFileInfos, getAllAudioFiles, getOrCreateSong } from './utils/utils.mjs'

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
const prisma = new PrismaClient()
const watchedDirectories = new Set()

function watchDirectory(dirPath) {
  if (watchedDirectories.has(dirPath)) {
    console.log(`El directorio ${dirPath} ya está siendo vigilado.`)
    return
  }

  fs.watch(dirPath, (eventType, filename) => {
    if (eventType === 'rename' && filename) {
      const fullPath = path.join(dirPath, filename)
      if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isFile()) {
        const basenameWithoutExt = path.parse(filename).name
        getOrCreateSong(fullPath, basenameWithoutExt)
        // handleNewFile(fullPath, basenameWithoutExt)
        console.log(`Archivo detectado:`)
        console.log(`Ruta completa: ${fullPath}`)
        console.log(`Basename sin extensión: ${basenameWithoutExt}`)
      }
    }
  })

  watchedDirectories.add(dirPath)
  console.log(`Vigilando el directorio: ${dirPath}`)
}

// function handleNewFile(filepath, basenameWithoutExt) {
//   // Envía los datos al proceso de renderizado
//   mainWindow.webContents.send('new-file', {
//     filepath,
//     basenameWithoutExt
//   })
// }

export function setupFilehandlers() {
  // // Añadir la función de selección de archivos
  // ipcMain.handle('select-file', async () => {
  //   const result = await dialog.showOpenDialog({
  //     properties: ['openFile'],
  //     filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'flac'] }] // Opcional: filtrar por tipos de archivos
  //   })

  //   if (result.canceled) {
  //     return null // O manejar la cancelación según sea necesario
  //   }

  //   const filePath = result.filePaths[0]

  //   return filePath // Devuelve la URL de datos
  // })

  // ipcMain.handle('get-file-info', async (event, filePath) => {
  //   try {
  //     const stats = fs.statSync(filePath)
  //     const { common } = await parseFile(filePath)

  //     return {
  //       size: stats.size,
  //       ...common
  //     }
  //   } catch (error) {
  //     console.error('Error getting file info:', error)
  //     throw error
  //   }
  // })

  ipcMain.handle('select-files', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
      })

      if (result.canceled) {
        return null // O manejar la cancelación según sea necesario
      }
      const directoryPath = result.filePaths[0]

      // Upsert en Prisma para agregar o actualizar el directorio
      await prisma.directory.upsert({
        where: { path: directoryPath },
        update: {},
        create: { path: directoryPath }
      })
    } catch (error) {
      console.error('Error selecting files:', error)
      throw error
    }
  })

  ipcMain.handle('get-all-audio-files', async () => {
    try {
      // Obtener todos los directorios de la base de datos
      const directories = await prisma.directory.findMany()

      if (directories.length === 0) {
        return [] // No hay directorios, devolver un array vacío
      }

      // Obtener todos los archivos de audio de todos los directorios
      let allAudioFiles = []
      for (const directory of directories) {
        const audioFiles = getAllAudioFiles(directory.path)
        watchDirectory(directory.path)
        allAudioFiles = allAudioFiles.concat(audioFiles)
      }

      // Filtrar archivos duplicados

      const uniqueAudioFiles = Array.from(new Set(allAudioFiles))

      return getFileInfos(uniqueAudioFiles)
    } catch (error) {
      console.error('Error retrieving audio files:', error)
      throw error
    }
  })

  ipcMain.handle('delete-directory', async (event, path) => {
    try {
      // Eliminar el directorio por su ruta
      await prisma.directory.delete({
        where: { path: path }
      })
      return { success: true, message: 'Directory deleted successfully.' }
    } catch (error) {
      console.error('Error deleting directory:', error)
      return { success: false, message: 'Error deleting directory.' }
    }
  })

  ipcMain.handle('get-all-directories', async () => {
    try {
      // Obtener todos los directorios de la base de datos
      const directories = await prisma.directory.findMany()
      return directories
    } catch (error) {
      console.error('Error retrieving directories:', error)
      throw error
    }
  })
}
