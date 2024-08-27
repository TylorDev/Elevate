import { app, dialog, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import { getFileInfo, getFileInfos, processM3UFile } from './utils/utils.mjs'

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

async function agregarHistorial(nombre, path) {
  try {
    // Buscar la playlist en la base de datos por nombre y path
    const playlist = await prisma.playlist.findFirst({
      where: {
        nombre: nombre,
        path: path
      }
    })

    if (!playlist) {
      throw new Error('Playlist no encontrada.')
    }

    // Agregar la reproducción al historial
    await prisma.historial.create({
      data: {
        playlistId: playlist.id,
        playedAt: new Date() // Puedes omitir este campo si quieres usar el valor predeterminado
      }
    })

    console.log('Historial agregado con éxito.')
  } catch (error) {
    console.error('Error al agregar al historial:', error.message)
  } finally {
    await prisma.$disconnect()
  }
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
  const contador = countPlaylistOccurrences(playlistPath)
  return { totalDuration, totalTracks, contador }
}
async function getSaveFilePath() {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Guardar lista de reproducción',
    defaultPath: path.join(app.getPath('documents'), 'playlist.m3u'),
    filters: [{ name: 'Listas de reproducción', extensions: ['m3u'] }]
  })
  return filePath
}

function extractPlaylistName(filePath) {
  return path.basename(filePath, path.extname(filePath))
}

async function createPlaylistInDatabase(
  filePath,
  playlistName,
  totalDuration,
  totalTracks,
  contador
) {
  try {
    const playlist = await prisma.playlist.create({
      data: {
        path: filePath,
        nombre: playlistName,
        duracion: totalDuration,
        numElementos: totalTracks,
        totalplays: contador
      }
    })
    console.debug('Creada existosamente en', filePath)
    return { success: true, playlist }
  } catch (error) {
    console.error('Error creando la playlist:', error)
    return { success: false, error: 'Error al crear la playlist en la base de datos.' }
  }
}

async function countPlaylistOccurrences(filePath) {
  try {
    // Encuentra la playlist correspondiente al `filePath`
    const playlist = await prisma.playlist.findUnique({
      where: { path: filePath }
    })

    if (!playlist) {
      // Si no se encuentra la playlist, retorna 0
      return 0
    }

    // Cuenta cuántas veces la playlist aparece en el historial
    const count = await prisma.historial.count({
      where: { playlistId: playlist.id }
    })

    // Retorna el contador
    return count
  } catch (error) {
    console.error('Error counting playlist occurrences:', error)
    // En caso de error, retorna 0
    return 0
  }
}

// Función para recuperar la última canción de la base de datos

// Función para obtener la última canción
const getLastSong = async () => {
  try {
    const lastSong = await prisma.lastSong.findFirst({
      orderBy: {
        id: 'desc'
      }
    })

    if (lastSong) {
      const { file, index, queueId } = lastSong
      const song = await getFileInfo(file)
      return { song, index, queueId }
    }

    return null
  } catch (error) {
    console.error('Error retrieving last song:', error)
    throw error // Lanza el error para que el renderer pueda manejarlo
  }
}

// Función para guardar la última canción
const saveLastSong = async (file, index, queueId) => {
  try {
    await prisma.lastSong.create({
      data: {
        file,
        index,
        queueId // Usar queueId en lugar de queue
      }
    })
  } catch (error) {
    console.error('Error saving last song:', error)
    throw error // Lanza el error para que el renderer pueda manejarlo
  }
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

      // Procesar el archivo M3U
      const processedData = await processM3UFile(m3uFilePath, m3uDirectory)

      // Obtener los datos de la playlist desde Prisma
      const playlistData = await prisma.playlist.findUnique({
        where: { path: m3uFilePath }
      })

      // Devolver los datos procesados y los datos de la playlist
      return {
        processedData,
        playlistData
      }
    } catch (error) {
      console.error('Error processing M3U file or fetching playlist data:', error)
      return {
        processedData: [],
        playlistData: null
      }
    }
  })

  ipcMain.handle('get-playlists', async () => {
    try {
      // Obtener todas las listas de reproducción desde la base de datos con detalles ya almacenados
      const playlists = await prisma.playlist.findMany()

      return playlists // Las playlists ya incluyen totalDuration y totalTracks
    } catch (error) {
      console.error('Error fetching playlists:', error)
      return []
    }
  })

  ipcMain.handle('get-random-playlist', async () => {
    try {
      // Obtener el número total de playlists
      const totalPlaylists = await prisma.playlist.count()

      if (totalPlaylists === 0) return null

      // Generar un índice aleatorio para seleccionar una playlist
      const randomIndex = Math.floor(Math.random() * totalPlaylists)

      // Obtener una playlist aleatoria
      const [randomPlaylist] = await prisma.playlist.findMany({
        take: 1,
        skip: randomIndex
      })

      return randomPlaylist
    } catch (error) {
      console.error('Error fetching random playlist:', error)
      return null
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

  ipcMain.handle('add-list-to-history', async (event, filePath) => {
    try {
      const playlist = await prisma.playlist.findUnique({
        where: { path: filePath }
      })

      if (!playlist) {
        throw new Error('Playlist not found')
      }

      // Crea una nueva entrada en el historial
      await prisma.historial.create({
        data: {
          playlistId: playlist.id
        }
      })

      // Incrementa el contador de reproducciones
      await prisma.playlist.update({
        where: { id: playlist.id },
        data: { totalplays: { increment: 1 } }
      })

      console.log('Playlist added to history and play count updated successfully')
    } catch (error) {
      console.error('Error adding playlist to history:', error)
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
    const validation = validateFilePaths(filePaths)
    if (!validation.valid) {
      console.log(validation.error)
      return { success: false, error: validation.error }
    }

    const filePath = await getSaveFilePath()
    if (!filePath) {
      return {
        success: false,
        error: 'No se seleccionó ninguna ubicación para guardar el archivo.'
      }
    }

    const playlistName = extractPlaylistName(filePath)
    const m3uContent = createM3uContent(filePaths, '')
    const saveResult = await saveM3uFile(filePath, m3uContent)

    if (!saveResult.success) {
      return { success: false, error: saveResult.error }
    }

    // Obtener los detalles de la playlist
    const { totalDuration, totalTracks } = await getPlaylistDetails(filePath)

    // Guardar la playlist en la base de datos con los detalles adicionales
    return await createPlaylistInDatabase(filePath, playlistName, totalDuration, totalTracks, 0)
  })

  ipcMain.handle('save-last-data', async (event, filepath, index, queueId) => {
    return await saveLastSong(filepath, index, queueId)
  })
  ipcMain.handle('get-last-data', async () => {
    return await getLastSong()
  })
}
