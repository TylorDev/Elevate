import { app, dialog, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import {
  generateCover,
  getFileInfo,
  processPlaylist,
  processPlaylistCover
} from './utils/utils.mjs'
import { PrismaClient } from '@prisma/client'
import sharp from 'sharp'
const prisma = new PrismaClient()

async function removeTrack(filepath, data) {
  try {
    // Busca la playlist existente para obtener el nombre actual.
    const existingPlaylist = await prisma.playlist.findUnique({
      where: {
        path: filepath
      }
    })

    if (existingPlaylist) {
      // Si la playlist existe, actualízala conservando el nombre actual.
      const updatedPlaylist = await prisma.playlist.update({
        where: {
          path: filepath
        },
        data: {
          ...data,
          nombre: existingPlaylist.nombre // Mantén el nombre actual.
        }
      })

      return { success: true, playlist: updatedPlaylist }
    } else {
      // Si la playlist no existe, créala con el nombre y datos proporcionados.
      const newPlaylist = await prisma.playlist.create({
        data: {
          ...data,
          path: filepath // Usa el filepath como identificador único.
        }
      })

      return { success: true, playlist: newPlaylist }
    }
  } catch (error) {
    console.error('Error handling playlist in database:', error)
    return { success: false, error: 'Error handling playlist in database.' }
  }
}

async function updatePlaylist(path, nombre, duracion = 0, numElementos = 0, totalplays = 0) {
  const playlist = await prisma.playlist.upsert({
    where: { path },
    update: {
      nombre,
      duracion,
      numElementos,
      totalplays
    },
    create: {
      path,
      nombre,
      duracion,
      numElementos,
      totalplays
    }
  })

  return playlist
}

async function getPlaylist(filePath) {
  try {
    const playlist = await prisma.playlist.findUnique({
      where: { path: filePath }
    })
    return playlist
  } catch (error) {
    console.error('Error getting playlist:', error)
    return null
  }
}
async function incrementCounter(playlistId) {
  try {
    // Añadir al historial
    await prisma.historial.create({
      data: { playlistId }
    })

    // Incrementar el conteo de reproducciones
    await prisma.playlist.update({
      where: { id: playlistId },
      data: { totalplays: { increment: 1 } }
    })
  } catch (error) {
    console.error('Error updating playlist:', error)
    // Manejar el error según sea necesario
  }
}
async function deletePlaylist(filePath) {
  try {
    const deletedPlaylist = await prisma.playlist.delete({
      where: { path: filePath }
    })

    return { success: true, deletedPlaylist }
  } catch (error) {
    console.error('Error deleting playlist:', error)

    return { success: false, message: 'Error deleting playlist', error: error.message }
  }
}
async function getPlays(filePath) {
  try {
    const playlist = await getPlaylist(filePath)

    if (!playlist) {
      return 0
    }

    const count = await prisma.historial.count({
      where: { playlistId: playlist.id }
    })

    return count
  } catch (error) {
    console.error('Error counting playlist occurrences:', error)
    return 0
  }
}
async function getPlaylists({ take = null, skip = null } = {}) {
  const options = {
    orderBy: {
      totalplays: 'desc' // Ordena de más reproducciones a menos reproducciones
    }
  }

  if (take !== null) options.take = take
  if (skip !== null) options.skip = skip

  const playlists = await prisma.playlist.findMany(options)

  for (const playlist of playlists) {
    const baseDir = path.dirname(playlist.path)
    const songs = await processPlaylistCover(playlist.path, baseDir)
    console.log(`Canciones procesadas: ${songs.length}`)
    playlist.cover = null
    try {
      // Intentar generar el cover
      const cover = await generateCover(songs)
      playlist.cover = cover
    } catch (error) {
      console.error(`Error al generar el cover para la playlist ${playlist.id}:`, error)
    }
  }

  return playlists
}

async function getRandomPlaylist() {
  try {
    const totalPlaylists = await prisma.playlist.count()
    if (totalPlaylists === 0) return null

    const randomIndex = getRandomIndex(totalPlaylists)
    const [randomPlaylist] = await getPlaylists({ take: 1, skip: randomIndex })

    return randomPlaylist
  } catch (error) {
    console.error('Error fetching random playlist:', error)
    return null
  }
}
async function selectFile() {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'M3U Files', extensions: ['m3u'] }]
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return result.filePaths[0]
}
function getRandomIndex(total) {
  return Math.floor(Math.random() * total)
}

async function saveDialog() {
  let isValid = false
  let filePath

  while (!isValid) {
    const { filePath: selectedPath } = await dialog.showSaveDialog({
      title: 'Guardar lista de reproducción',
      defaultPath: path.join(app.getPath('documents'), 'playlist.m3u'),
      filters: [{ name: 'Listas de reproducción', extensions: ['m3u'] }]
    })

    if (!selectedPath) {
      // Si el usuario cancela el diálogo
      console.log('El diálogo fue cancelado')
      return null // O lanza una excepción si prefieres
    }

    // Extraer el nombre del archivo usando el módulo path
    const fileName = path.basename(selectedPath, path.extname(selectedPath))

    if (fileName.length > 2 && fileName.length < 15) {
      isValid = true // El nombre es válido
      filePath = selectedPath
    } else {
      console.debug(fileName)
      console.log(
        'El nombre del archivo debe tener más de 5 y menos de 15 caracteres. Intenta de nuevo.'
      )
    }
  }

  return filePath // Retorna la ruta del archivo válido
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
function extractPlaylistName(filePath) {
  return path.basename(filePath, path.extname(filePath))
}
async function savePlaylist(filePath, filePaths) {
  const playlistName = extractPlaylistName(filePath)
  const m3uContent = createM3uContent(filePaths, '')
  const saveResult = await saveM3uFile(filePath, m3uContent)

  if (!saveResult.success) {
    return { success: false, error: saveResult.error }
  }

  return { success: true, playlistName }
}
async function getPlaylistDetails(playlistPath) {
  const m3uDirectory = path.dirname(playlistPath)
  const tracks = await processPlaylist(playlistPath, m3uDirectory)
  const totalDuration = tracks.reduce((acc, track) => acc + track.duration, 0)
  const totalTracks = tracks.length
  const contador = getPlays(playlistPath)
  return { totalDuration, totalTracks, contador }
}
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

async function updatePlaylistByPath(path, newData) {
  try {
    // Buscar la playlist por path para obtener su id
    const playlist = await prisma.playlist.findUnique({
      where: { path }
    })

    if (!playlist) {
      throw new Error('Playlist not found')
    }

    // Actualizar la playlist con los nuevos datos
    const updatedPlaylist = await prisma.playlist.update({
      where: { id: playlist.id },
      data: newData
    })

    return updatedPlaylist
  } catch (error) {
    console.log(path)
    console.error('Error updating playlist:', error)
    throw error
  }
}
async function getM3ufilepaths(filepath, baseDir) {
  const fileContent = await fs.promises.readFile(filepath, 'utf-8')
  const relativePaths = fileContent.split('\n').filter((line) => line.trim() !== '')
  return relativePaths.map((relPath) => path.resolve(baseDir, relPath.trim()))
}

///-----------------
export function setupPlaylistHandlers() {
  ipcMain.handle('load-list', async () => {
    try {
      const filePath = await selectFile()
      if (!filePath) return []
      const baseDir = path.dirname(filePath)
      const filePaths = await getM3ufilepaths(filePath, baseDir) //
      const { success, playlistName, error } = await savePlaylist(filePath, filePaths)

      if (!success) {
        return { success: false, error }
      }

      const { totalDuration, totalTracks } = await getPlaylistDetails(filePath)
      const playlistData = {
        path: filePath,
        nombre: playlistName,
        duracion: totalDuration,
        numElementos: totalTracks,
        totalplays: 0
      }

      return await updatePlaylist(
        playlistData.path,
        playlistData.nombre,
        playlistData.duracion,
        playlistData.numElementos,
        playlistData.totalplays
      )
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('get-list', async (event, filepath) => {
    const baseDir = path.dirname(filepath)
    const processedData = await processPlaylist(filepath, baseDir) //
    const playlistData = await getPlaylist(filepath)
    const cover = await generateCover(processedData)
    return {
      processedData,
      playlistData,
      cover
    }
  })

  //Simple
  ipcMain.handle('get-playlists', async () => {
    return await getPlaylists()
  })

  ipcMain.handle('get-playlists-number', async () => {
    try {
      const totalPlaylists = await prisma.playlist.count()
      return totalPlaylists // Devuelve solo el número total de playlists
    } catch (error) {
      console.error('Error retrieving playlists count:', error)
      throw error
    }
  })

  ipcMain.handle('get-random-playlist', async () => {
    return await getRandomPlaylist()
  })

  //simple
  ipcMain.handle('delete-playlist', async (event, filePath) => {
    return deletePlaylist(filePath)
  })

  ipcMain.handle('change-list-name', async (event, filepath, newData) => {
    await updatePlaylistByPath(filepath, newData)
  })

  ipcMain.handle('load-list-to-history', async (event, filePath) => {
    try {
      const playlist = await getPlaylist(filePath)
      if (!playlist) throw new Error('Playlist not found')

      await incrementCounter(playlist.id)

      console.log('Playlist added to history and play count updated successfully')
    } catch (error) {
      console.error('Error adding playlist to history:', error)
    }
  })

  ipcMain.handle('update-list', async (event, { filePath, index }) => {
    console.log(filePath)

    const baseDir = path.dirname(filePath)
    const filePaths = await getM3ufilepaths(filePath, baseDir) //
    filePaths.splice(index, 1)
    const saveResult = await savePlaylist(filePath, filePaths)
    if (!saveResult.success) {
      return { success: false, error: saveResult.error }
    }

    console.log('cancion eliminada en:', saveResult.playlistName)
    const playlistDetails = await getPlaylistDetails(filePath)
    console.log('cancion eliminada en:', playlistDetails.totalTracks)
    const playlistData = {
      path: filePath,
      duracion: playlistDetails.totalDuration,
      numElementos: playlistDetails.totalTracks,
      totalplays: 0
    }

    return removeTrack(playlistData.path, playlistData)
  })

  ipcMain.handle('add-new-song', async (event, { filePath, song }) => {
    console.log(filePath)
    const baseDir = path.dirname(filePath)
    const filePaths = await getM3ufilepaths(filePath, baseDir) //
    filePaths.push(song)
    const saveResult = await savePlaylist(filePath, filePaths)
    if (!saveResult.success) {
      return { success: false, error: saveResult.error }
    }

    console.log('cancion eliminada en:', saveResult.playlistName)
    const playlistDetails = await getPlaylistDetails(filePath)
    console.log('cancion eliminada en:', playlistDetails.totalTracks)
    const playlistData = {
      path: filePath,
      duracion: playlistDetails.totalDuration,
      numElementos: playlistDetails.totalTracks,
      totalplays: 0
    }

    return removeTrack(playlistData.path, playlistData)
  })

  ipcMain.handle('save-m3u', async (event, { filePaths }) => {
    try {
      const filePath = await saveDialog()
      const { success, playlistName, error } = await savePlaylist(filePath, filePaths)

      if (!success) {
        return { success: false, error }
      }

      const { totalDuration, totalTracks } = await getPlaylistDetails(filePath)
      const playlistData = {
        path: filePath,
        nombre: playlistName,
        duracion: totalDuration,
        numElementos: totalTracks,
        totalplays: 0
      }

      return await updatePlaylist(
        playlistData.path,
        playlistData.nombre,
        playlistData.duracion,
        playlistData.numElementos,
        playlistData.totalplays
      )
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('save-last-data', async (event, filepath, index, queueId) => {
    return await saveLastSong(filepath, index, queueId)
  })
  ipcMain.handle('get-last-data', async () => {
    return await getLastSong()
  })
}
