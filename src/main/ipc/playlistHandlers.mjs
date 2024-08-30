import { app, dialog, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import { getFileInfo, processM3UFile } from './utils/utils.mjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

//--load-list
//1 ref
async function selectM3UFile() {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'M3U Files', extensions: ['m3u'] }]
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return result.filePaths[0]
} //1 ref
function getCreateList(m3uFilePath) {
  const baseName = path.basename(m3uFilePath, path.extname(m3uFilePath))
  return {
    path: m3uFilePath,
    nombre: baseName
  }
}
//1 ref
async function savePlaylistToDatabase(playlist) {
  try {
    await prisma.playlist.create({ data: playlist })
  } catch (dbError) {
    console.error('Error creating playlist in database:', dbError)
  }
}

//--open-list
//1 ref
function validateFilePath(m3uFilePath) {
  if (!m3uFilePath) {
    throw new Error('No file path provided')
  }
}
//1 ref
function getM3UDirectory(m3uFilePath) {
  return path.dirname(m3uFilePath)
}
//1 ref
async function fetchPlaylistData(m3uFilePath) {
  return await prisma.playlist.findUnique({
    where: { path: m3uFilePath }
  })
}

//--get-playlists

console.log('NO TIENE FUNCIONES')

//--get-random-playlis
//1 ref
function getRandomIndex(total) {
  return Math.floor(Math.random() * total)
}
//1 ref
async function fetchRandomPlaylist() {
  const totalPlaylists = await prisma.playlist.count()
  if (totalPlaylists === 0) return null

  const randomIndex = getRandomIndex(totalPlaylists)
  const [randomPlaylist] = await prisma.playlist.findMany({
    take: 1,
    skip: randomIndex
  })

  return randomPlaylist
}

//--delete-playlist

console.log('NO TIENE FUNCIONES')

//--load-list-to-history
//1 ref
async function getPlaylistByFilePath(filePath) {
  return await prisma.playlist.findUnique({
    where: { path: filePath }
  })
}
//1 ref
async function addToHistory(playlistId) {
  await prisma.historial.create({
    data: { playlistId }
  })
}
//1 ref
async function incrementPlayCount(playlistId) {
  await prisma.playlist.update({
    where: { id: playlistId },
    data: { totalplays: { increment: 1 } }
  })
}

//--detect-m3u
//1 ref
async function selectDirectory() {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return result.filePaths[0]
}
//1 ref
async function findM3UFile(directoryPath) {
  const files = await fs.promises.readdir(directoryPath)
  const m3uFile = files.find((file) => path.extname(file).toLowerCase() === '.m3u')

  return m3uFile ? path.join(directoryPath, m3uFile) : null
}

//--save-m3u
//1 ref
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
//1 ref
async function getSaveFilePath() {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Guardar lista de reproducción',
    defaultPath: path.join(app.getPath('documents'), 'playlist.m3u'),
    filters: [{ name: 'Listas de reproducción', extensions: ['m3u'] }]
  })
  return filePath
}
//1 ref
async function validatePathsAndGetFile(filePaths) {
  const { valid, error } = validateFilePaths(filePaths)
  if (!valid) {
    return { success: false, error }
  }

  const filePath = await getSaveFilePath()
  if (!filePath) {
    return {
      success: false,
      error: 'No se seleccionó ninguna ubicación para guardar el archivo.'
    }
  }

  return { success: true, filePath }
}
//1 ref
const createM3uContent = (filePaths, commonBasePath) => {
  return filePaths.map((filePath) => path.relative(commonBasePath, filePath)).join('\n')
}
//1 ref
const saveM3uFile = async (m3uFilePath, m3uContent) => {
  try {
    await fs.promises.writeFile(m3uFilePath, m3uContent)
    return { success: true, path: m3uFilePath }
  } catch (err) {
    return { success: false, error: err.message }
  }
}
//1 ref
function extractPlaylistName(filePath) {
  return path.basename(filePath, path.extname(filePath))
}
//1 ref
async function savePlaylist(filePath, filePaths) {
  const playlistName = extractPlaylistName(filePath)
  const m3uContent = createM3uContent(filePaths, '')
  const saveResult = await saveM3uFile(filePath, m3uContent)

  if (!saveResult.success) {
    return { success: false, error: saveResult.error }
  }

  return { success: true, playlistName }
}

//1 ref

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

//1 ref
async function getPlaylistDetails(playlistPath) {
  const m3uDirectory = path.dirname(playlistPath)
  const tracks = await processM3UFile(playlistPath, m3uDirectory) // Suponiendo que esta función obtiene las pistas de la lista
  const totalDuration = tracks.reduce((acc, track) => acc + track.duration, 0)
  const totalTracks = tracks.length
  const contador = countPlaylistOccurrences(playlistPath)
  return { totalDuration, totalTracks, contador }
}
//1 ref
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

//--save-last-data
//1 ref
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

//--get-last-data
//1 ref
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

//---otras funciones
//------------------------------------
export function setupPlaylistHandlers() {
  ipcMain.handle('load-list', async () => {
    try {
      const m3uFilePath = await selectM3UFile()
      if (!m3uFilePath) return []

      const playlist = getCreateList(m3uFilePath)

      await savePlaylistToDatabase(playlist)

      const m3uDirectory = path.dirname(m3uFilePath)
      return processM3UFile(m3uFilePath, m3uDirectory) //externa
    } catch (error) {
      console.error('Error processing M3U file:', error)
      return { path: null, nombre: null }
    }
  })

  ipcMain.handle('open-list', async (event, m3uFilePath) => {
    try {
      validateFilePath(m3uFilePath)

      const m3uDirectory = getM3UDirectory(m3uFilePath)
      const processedData = await processM3UFile(m3uFilePath, m3uDirectory) //externa
      const playlistData = await fetchPlaylistData(m3uFilePath)

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

  //Simple
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
      const randomPlaylist = await fetchRandomPlaylist()
      return randomPlaylist
    } catch (error) {
      console.error('Error fetching random playlist:', error)
      return null
    }
  })

  //simple
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

  ipcMain.handle('load-list-to-history', async (event, filePath) => {
    try {
      const playlist = await getPlaylistByFilePath(filePath)
      if (!playlist) throw new Error('Playlist not found')

      await addToHistory(playlist.id)
      await incrementPlayCount(playlist.id)

      console.log('Playlist added to history and play count updated successfully')
    } catch (error) {
      console.error('Error adding playlist to history:', error)
    }
  })

  ipcMain.handle('detect-m3u', async () => {
    try {
      const directoryPath = await selectDirectory()
      if (!directoryPath) return []

      const m3uFilePath = await findM3UFile(directoryPath)
      if (!m3uFilePath) {
        console.error('No M3U file found in the selected directory.')
        return []
      }

      return processM3UFile(m3uFilePath, directoryPath) //externa
    } catch (error) {
      console.error('Error detecting M3U file:', error)
      return []
    }
  })

  ipcMain.handle('save-m3u', async (event, { filePaths }) => {
    const validation = await validatePathsAndGetFile(filePaths)
    if (!validation.success) {
      return { success: false, error: validation.error }
    }

    const saveResult = await savePlaylist(validation.filePath, filePaths)
    if (!saveResult.success) {
      return { success: false, error: saveResult.error }
    }

    const playlistDetails = await getPlaylistDetails(validation.filePath)

    return createPlaylistInDatabase(
      validation.filePath,
      saveResult.playlistName,
      playlistDetails.totalDuration,
      playlistDetails.totalTracks,
      0
    )
  })

  ipcMain.handle('save-last-data', async (event, filepath, index, queueId) => {
    return await saveLastSong(filepath, index, queueId)
  })
  ipcMain.handle('get-last-data', async () => {
    return await getLastSong()
  })
}
