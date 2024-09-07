import { dialog, ipcMain } from 'electron'

import {
  getFileInfos,
  getAllAudioFiles,
  getOrCreateSong,
  getTotalDuration
} from './utils/utils.mjs'

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { sendNotification } from '../index.mjs'
const prisma = new PrismaClient()
const watchedDirectories = new Set()

async function startWatchingDirectories() {
  try {
    const directories = await prisma.directory.findMany()

    directories.forEach(({ path }) => {
      watchDirectory(path)
    })
  } catch (error) {
    console.error('Error al obtener los directorios:', error)
  }
}

function watchDirectory(dirPath) {
  if (watchedDirectories.has(dirPath)) {
    console.debug(`El directorio ${dirPath} ya está siendo vigilado.`)
    return
  }

  try {
    fs.watch(dirPath, (eventType, filename) => handleFileChange(eventType, filename, dirPath))
    watchedDirectories.add(dirPath)
    console.debug(`Vigilando el directorio: ${dirPath}`)
  } catch (error) {
    console.error(`Error al intentar vigilar el directorio ${dirPath}:`, error)
  }
}

function handleFileChange(eventType, filename, dirPath) {
  if (eventType !== 'rename' || !filename) return

  const fullPath = buildFullPath(filename, dirPath)
  if (isFile(fullPath)) {
    const basenameWithoutExt = extractBasename(filename)
    getOrCreateSong(fullPath, basenameWithoutExt)
    debugFileDetails(fullPath, basenameWithoutExt)
  }
}

function buildFullPath(filename, dirPath) {
  return path.join(dirPath, filename)
}

function isFile(fullPath) {
  return fs.existsSync(fullPath) && fs.lstatSync(fullPath).isFile()
}

function extractBasename(filename) {
  return path.parse(filename).name
}

function debugFileDetails(fullPath, basenameWithoutExt) {
  sendNotification('NUEVo archivo!')
  console.debug(`Archivo detectado:`)
  console.debug(`Ruta completa: ${fullPath}`)
  console.debug(`Basename sin extensión: ${basenameWithoutExt}`)
}

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
  startWatchingDirectories()
  ipcMain.handle('add-directory', async () => {
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

      return { success: true, message: 'Directory added sucessfully.' }
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

  ipcMain.handle('get-audio-in-directory', async (_, directoryPath) => {
    try {
      // Verificar si el directorio existe en la base de datos
      const directory = await prisma.directory.findUnique({
        where: { path: directoryPath }
      })

      if (!directory) {
        return [] // El directorio no existe en la base de datos, devolver un array vacío
      }

      // Obtener todos los archivos de audio del directorio específico
      const audioFiles = getAllAudioFiles(directoryPath)

      // Filtrar archivos duplicados
      const uniqueAudioFiles = Array.from(new Set(audioFiles))

      return getFileInfos(uniqueAudioFiles)
    } catch (error) {
      console.error('Error retrieving audio files by directory:', error)
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

      // Iterar sobre cada directorio y agregar las propiedades totalTracks y totalDuration
      const directoriesWithDetails = await Promise.all(
        directories.map(async (directory) => {
          const { totalTracks, totalDuration } = await getTotalDuration(directory.path)

          return {
            ...directory,
            totalTracks,
            totalDuration
          }
        })
      )

      return directoriesWithDetails
    } catch (error) {
      console.error('Error retrieving directories:', error)
      throw error
    }
  })
}
