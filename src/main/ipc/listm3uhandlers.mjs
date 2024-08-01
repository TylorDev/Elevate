import { app, dialog, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import { processM3UFile } from './utils/utils.mjs'

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const validateFilePaths = (filePaths) => {
  if (
    !Array.isArray(filePaths) ||
    filePaths.length === 0 ||
    !filePaths.every((fp) => typeof fp === 'string')
  ) {
    return { valid: false, error: 'Invalid file paths provided.' }
  }
  return { valid: true }
}

const findCommonBasePath = (filePaths) => {
  return filePaths.reduce((commonBase, filePath) => {
    if (!commonBase) return path.dirname(filePath)
    let base = path.dirname(filePath)
    while (filePath.indexOf(base) !== 0) {
      base = path.dirname(base)
      if (base === '') return commonBase
    }
    return base
  }, '')
}

const createM3uContent = (filePaths, commonBasePath) => {
  return filePaths.map((filePath) => path.relative(commonBasePath, filePath)).join('\n')
}

const saveM3uFile = async (m3uFilePath, m3uContent) => {
  try {
    await fs.promises.writeFile(m3uFilePath, m3uContent)
    return { success: true, path: m3uFilePath }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

async function getPlaylistDetails(playlistPath) {
  const m3uDirectory = path.dirname(playlistPath)
  const tracks = await processM3UFile(playlistPath, m3uDirectory) // Suponiendo que esta función obtiene las pistas de la lista
  const totalDuration = tracks.reduce((acc, track) => acc + track.duration, 0)
  const totalTracks = tracks.length

  return { totalDuration, totalTracks }
}

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
      const baseName = path.basename(m3uFilePath, path.extname(m3uFilePath)) // Obtener el nombre base sin la extensión

      // Crear un objeto playlist para devolver en cualquier caso
      const playlist = {
        path: m3uFilePath,
        nombre: baseName
      }

      try {
        // Intentar guardar en la base de datos
        await prisma.playlist.create({
          data: playlist
        })
      } catch (dbError) {
        console.error('Error creating playlist in database:', dbError)
        // Aquí podrías manejar el error de otra forma si es necesario
      }

      return processM3UFile(m3uFilePath, m3uDirectory)
    } catch (error) {
      console.error('Error processing M3U file:', error)
      // Devolver el playlist incluso si hubo un error
      return {
        path: null,
        nombre: null
      }
    }
  })

  ipcMain.handle('open-list', async (event, m3uFilePath) => {
    try {
      if (!m3uFilePath) {
        throw new Error('No file path provided')
      }

      const m3uDirectory = path.dirname(m3uFilePath) // Obtener la ruta del directorio del archivo M3U

      return processM3UFile(m3uFilePath, m3uDirectory)
    } catch (error) {
      console.error('Error processing M3U file:', error)
      return []
    }
  })

  ipcMain.handle('get-playlists', async () => {
    try {
      // Obtener todas las listas de reproducción desde la base de datos
      const playlists = await prisma.playlist.findMany()

      // Añadir `totalduration` y `totaltracks` a cada playlist
      const playlistsWithDetails = await Promise.all(
        playlists.map(async (playlist) => {
          // Aquí asumimos que tienes una función que obtiene detalles de duración y número de pistas
          const { totalDuration, totalTracks } = await getPlaylistDetails(playlist.path)

          return {
            ...playlist,
            totalDuration, // Añade el total de duración
            totalTracks // Añade el total de pistas
          }
        })
      )

      return playlistsWithDetails
    } catch (error) {
      console.error('Error fetching playlists:', error)
      return []
    }
  })
  ipcMain.handle('delete-playlist', async (event, filePath) => {
    try {
      // Elimina el registro con el `path` especificado
      const deletedPlaylist = await prisma.playlist.delete({
        where: { path: filePath }
      })

      // Retorna un mensaje de éxito con el registro eliminado
      return { success: true, deletedPlaylist }
    } catch (error) {
      console.error('Error deleting playlist:', error)

      // Retorna un mensaje de error en caso de fallo
      return { success: false, message: 'Error deleting playlist', error: error.message }
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

  ipcMain.handle('save-m3u', async (event, { filePaths }) => {
    // Validar las rutas de los archivos
    const validation = validateFilePaths(filePaths)
    if (!validation.valid) {
      console.log(validation.error)
      return { success: false, error: validation.error }
    }

    // Mostrar el diálogo de guardado para obtener la ruta de guardado y el nombre del archivo
    const { filePath } = await dialog.showSaveDialog({
      title: 'Guardar lista de reproducción',
      defaultPath: path.join(app.getPath('documents'), 'playlist.m3u'),
      filters: [{ name: 'Listas de reproducción', extensions: ['m3u'] }]
    })

    if (!filePath) {
      return {
        success: false,
        error: 'No se seleccionó ninguna ubicación para guardar el archivo.'
      }
    }

    // Extraer el nombre de la lista de reproducción del nombre del archivo
    const playlistName = path.basename(filePath, path.extname(filePath))

    // Crear el contenido del archivo M3U
    const m3uContent = createM3uContent(filePaths, '')

    // Guardar el archivo M3U
    const saveResult = await saveM3uFile(filePath, m3uContent)

    if (saveResult.success) {
      // Intentar crear una nueva entrada en la base de datos
      try {
        const playlist = await prisma.playlist.create({
          data: {
            path: filePath,
            nombre: playlistName
          }
        })
        console.debug('Creada existosamente en', filePath)
        return { success: true, playlist }
      } catch (error) {
        console.error('Error creando la playlist:', error)
        return { success: false, error: 'Error al crear la playlist en la base de datos.' }
      }
    } else {
      return { success: false, error: saveResult.error }
    }
  })
}
