import { createRequire } from 'node:module'
import path from 'path'
import fs from 'fs'
import log from 'electron-log/main.js'
import sharp from 'sharp'
import {
  getCoverFromCache,
  generateCover,
  processPlaylist,
  processPlaylistCover,
  getOrCreateSong,
  ensureCoverDir
} from './utils/utils.mjs'
import {
  buildCollectionSummary,
  generateCollectionCoverFromTracks
} from './utils/collectionDetail.mjs'
import { prisma } from '../prisma.mjs'
const require = createRequire(import.meta.url)
const electron = require('electron')
const { app, dialog, ipcMain } = electron
const playlistCoverCache = new Map()
const pendingPlaylistRequests = new Map()

function getPlaylistCacheKey(playlistPath) {
  try {
    const stats = fs.statSync(playlistPath)
    return `${playlistPath}:${stats.mtimeMs}:${stats.size}`
  } catch {
    return `${playlistPath}:missing`
  }
}

function invalidatePlaylistCache(playlistPath = null) {
  pendingPlaylistRequests.clear()

  if (!playlistPath) {
    playlistCoverCache.clear()
    return
  }

  for (const key of playlistCoverCache.keys()) {
    if (key.startsWith(`${playlistPath}:`)) {
      playlistCoverCache.delete(key)
    }
  }
}

async function getTop10SuggestedCovers(playlistPath) {
  try {
    const baseDir = path.dirname(playlistPath)
    const songs = await processPlaylist(playlistPath, baseDir)
    const sortedSongs = songs
      .filter((song) => song.coverHash || song.filePath)
      .sort((a, b) => (Number(b.short_view_count) || 0) - (Number(a.short_view_count) || 0))
      .slice(0, 10)

    return Promise.all(
      sortedSongs.map(async (song, index) => {
        const cover = song.filePath ? await getCoverFromCache(song.filePath, 'full') : null

        return {
          suggestedId: song.filePath || song.coverHash || `suggested-${index}`,
          filePath: song.filePath || null,
          title: song.title || song.fileName || null,
          artist: song.artist || null,
          coverHash: song.coverHash || null,
          short_view_count: Number(song.short_view_count) || 0,
          picture: cover?.data
            ? [{ data: cover.data, type: 'Cover (front)', format: cover.mimeType || 'image/jpeg' }]
            : []
        }
      })
    )
  } catch (error) {
    console.error('Error getting top 10 suggested covers:', error)
    return []
  }
}

function dataUrlToBuffer(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return null
  }

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) {
    return null
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64')
  }
}

function bufferToDataUrl(buffer, mimeType = 'image/png') {
  if (!buffer) {
    return null
  }

  return `data:${mimeType};base64,${Buffer.from(buffer).toString('base64')}`
}

function buildCoverConfig(playlist) {
  if (!playlist) {
    return null
  }

  return {
    customCoverMode: playlist.customCoverMode || null,
    customCoverValue: playlist.customCoverValue || null,
    customCoverSelection: playlist.customCoverSelection
      ? JSON.parse(playlist.customCoverSelection)
      : null
  }
}

function buildPlaylistSummary(playlist, effectiveCover = null) {
  if (!playlist) {
    return null
  }

  return {
    id: playlist.id,
    path: playlist.path,
    nombre: playlist.nombre,
    duracion: playlist.duracion,
    numElementos: playlist.numElementos,
    createdAt: playlist.createdAt,
    totalplays: playlist.totalplays,
    cover: effectiveCover,
    effectiveCover,
    coverConfig: buildCoverConfig(playlist)
  }
}

async function getPlaylistDetail(filepath) {
  const baseDir = path.dirname(filepath)
  const playlistSongs = await processPlaylist(filepath, baseDir)
  const tracks = playlistSongs.map((song) => ({ ...song, picture: undefined }))
  const playlistData = await getPlaylist(filepath)
  const cover = playlistData ? await getCachedPlaylistCover(playlistData) : null
  const suggestedCovers = await getTop10SuggestedCovers(filepath)
  const effectiveCover = playlistData ? await getEffectiveCover(playlistData, cover) : cover
  const resolvedCover = effectiveCover ?? (await generateCollectionCoverFromTracks(tracks))
  const summary = buildCollectionSummary(tracks, {
    sourcePath: filepath,
    cover: resolvedCover
  })

  return {
    success: true,
    type: 'playlist',
    meta: {
      title: playlistData?.nombre || extractPlaylistName(filepath),
      sourcePath: filepath,
      createdAt: playlistData?.createdAt || null,
      totalplays: playlistData?.totalplays || 0,
      editable: true
    },
    tracks,
    summary,
    playlistData,
    cover,
    suggestedCovers,
    effectiveCover: resolvedCover,
    coverConfig: buildCoverConfig(playlistData)
  }
}

async function generatePlaylistCoverFromSelectedImages(selectedItems) {
  if (!selectedItems || selectedItems.length !== 4) {
    throw new Error('Se requieren exactamente 4 imágenes para el collage')
  }

  try {
    const imageBuffers = []

    for (const item of selectedItems) {
      if (item.filePath) {
        const cachedCover = await getCoverFromCache(item.filePath, 'full')
        if (cachedCover?.data) {
          imageBuffers.push(Buffer.from(cachedCover.data))
          continue
        }
      }

      if (item.coverHash) {
        const cacheDir = ensureCoverDir()
        const fullCoverPath = path.join(cacheDir, 'full', `${item.coverHash}.jpg`)
        if (fs.existsSync(fullCoverPath)) {
          imageBuffers.push(await fs.promises.readFile(fullCoverPath))
          continue
        }
      }

      if (item.picture && item.picture[0]?.data) {
        imageBuffers.push(Buffer.from(item.picture[0].data))
      } else if (item.localPath && fs.existsSync(item.localPath)) {
        imageBuffers.push(await fs.promises.readFile(item.localPath))
      } else if (item.resolvedUrl) {
        const parsed = dataUrlToBuffer(item.resolvedUrl)
        if (parsed?.buffer) {
          imageBuffers.push(parsed.buffer)
        }
      }
    }

    if (imageBuffers.length < 4) {
      throw new Error('No se pudieron obtener las 4 imágenes para el collage')
    }

    const resizedImages = await Promise.all(
      imageBuffers.slice(0, 4).map((buffer) =>
        sharp(buffer).resize(250, 250, { fit: 'cover' }).toBuffer()
      )
    )

    const canvas = sharp({
      create: {
        width: 500,
        height: 500,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })

    const composites = resizedImages.map((img, index) => ({
      input: img,
      top: Math.floor(index / 2) * 250,
      left: (index % 2) * 250
    }))

    const tileBuffer = await canvas.composite(composites).png().toBuffer()
    return tileBuffer
  } catch (error) {
    console.error('Error generating collage from selected images:', error)
    throw error
  }
}

async function getEffectiveCover(playlist, fallbackCover = null) {
  if (playlist?.customCoverMode && (playlist?.customCoverValue || playlist?.customCoverSelection)) {
    try {
      // Fast path: customCoverValue is already a data URL (most common after save)
      if (typeof playlist.customCoverValue === 'string' && playlist.customCoverValue.startsWith('data:')) {
        return playlist.customCoverValue
      }

      let coverBuffer = null

      if (playlist.customCoverMode === 'local-image') {
        if (playlist.customCoverValue && fs.existsSync(playlist.customCoverValue)) {
          coverBuffer = await sharp(playlist.customCoverValue)
            .resize(500, 500, { fit: 'cover' })
            .png()
            .toBuffer()
        }
      } else if (playlist.customCoverMode === 'remote-image') {
        const axios = (await import('axios')).default
        const response = await axios.get(playlist.customCoverValue, { responseType: 'arraybuffer' })
        coverBuffer = await sharp(Buffer.from(response.data))
          .resize(500, 500, { fit: 'cover' })
          .png()
          .toBuffer()
      } else if (playlist.customCoverMode === 'suggested-collage') {
        const selection = playlist.customCoverSelection
          ? JSON.parse(playlist.customCoverSelection)
          : null

        if (selection && Array.isArray(selection) && selection.length === 4) {
          coverBuffer = await generatePlaylistCoverFromSelectedImages(selection)
        }
      }

      if (coverBuffer) {
        return coverBuffer
      }
    } catch (error) {
      console.error('Error getting effective cover:', error)
    }
  }

  return fallbackCover ?? getCachedPlaylistCover(playlist)
}

async function getCachedPlaylistCover(playlist) {
  const cacheKey = getPlaylistCacheKey(playlist.path)
  const cachedCover = playlistCoverCache.get(cacheKey)

  if (cachedCover !== undefined) {
    return cachedCover
  }

  const baseDir = path.dirname(playlist.path)
  const songs = await processPlaylistCover(playlist.path, baseDir)
  console.log(`Canciones procesadas: ${songs.length}`)

  let cover = null
  try {
    cover = await generateCover(songs)
  } catch (error) {
    console.error(`Error al generar el cover para la playlist ${playlist.id}:`, error)
  }

  playlistCoverCache.set(cacheKey, cover)
  return cover
}

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
      invalidatePlaylistCache(filepath)

      return { success: true, playlist: updatedPlaylist }
    } else {
      // Si la playlist no existe, créala con el nombre y datos proporcionados.
      const newPlaylist = await prisma.playlist.create({
        data: {
          ...data,
          path: filepath // Usa el filepath como identificador único.
        }
      })
      invalidatePlaylistCache(filepath)

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
  invalidatePlaylistCache(path)

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
    invalidatePlaylistCache(filePath)

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
async function processPlaylistsBatch(playlists, concurrency = 3) {
  const results = new Array(playlists.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < playlists.length) {
      const index = nextIndex++
      const playlist = playlists[index]

      try {
        const effectiveCover = await getEffectiveCover(playlist)
        results[index] = {
          ...playlist,
          cover: effectiveCover,
          effectiveCover,
          coverConfig: buildCoverConfig(playlist)
        }
      } catch (error) {
        console.error(`Error processing cover for playlist ${playlist.path}:`, error)
        results[index] = {
          ...playlist,
          cover: null,
          effectiveCover: null,
          coverConfig: buildCoverConfig(playlist)
        }
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, playlists.length) }, () => worker())
  await Promise.all(workers)
  return results
}

async function getPlaylists({ take = null, skip = null } = {}) {
  const requestKey = JSON.stringify({ take, skip })
  const pendingRequest = pendingPlaylistRequests.get(requestKey)

  if (pendingRequest) {
    return pendingRequest
  }

  const options = {
    orderBy: {
      totalplays: 'desc'
    }
  }

  if (take !== null) options.take = take
  if (skip !== null) options.skip = skip

  const request = prisma.playlist
    .findMany(options)
    .then((playlists) => processPlaylistsBatch(playlists, 3))
    .finally(() => {
      pendingPlaylistRequests.delete(requestKey)
    })

  pendingPlaylistRequests.set(requestKey, request)
  return request
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

async function saveDialog(nombre = '') {
  let isValid = false
  let filePath
  const suggestedFileName = normalizePlaylistFileName(nombre) || 'playlist'

  while (!isValid) {
    const { filePath: selectedPath } = await dialog.showSaveDialog({
      title: 'Save list',
      defaultPath: path.join(app.getPath('documents'), `${suggestedFileName}.m3u`),
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

const createM3uContent = (filePaths) => {
  return filePaths.join('\n')
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

function normalizePlaylistFileName(nombre = '') {
  return Array.from(
    String(nombre)
      .trim()
      .replace(/[<>:"/\\|?*]/g, '')
  )
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('')
}

function buildPlaylistTargetPath({ targetPath = null, targetDirectory = null, nombre = '' } = {}) {
  if (targetPath) {
    return path.resolve(targetPath)
  }

  const normalizedName = normalizePlaylistFileName(nombre)

  if (!normalizedName) {
    throw new Error('Playlist name is required')
  }

  if (!targetDirectory) {
    throw new Error('Target directory is required')
  }

  return path.join(targetDirectory, `${normalizedName}.m3u`)
}

function normalizeSearchQuery(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().replace(/\s+/g, ' ')
}

async function savePlaylist(filePath, filePaths) {
  const playlistName = extractPlaylistName(filePath)
  const m3uContent = createM3uContent(filePaths)
  const saveResult = await saveM3uFile(filePath, m3uContent)

  if (!saveResult.success) {
    return { success: false, error: saveResult.error }
  }

  return { success: true, playlistName }
}

async function persistPlaylistRecord(filePath) {
  const playlistName = extractPlaylistName(filePath)
  const conflictingPlaylist = await prisma.playlist.findUnique({
    where: { nombre: playlistName }
  })

  if (conflictingPlaylist && conflictingPlaylist.path !== filePath) {
    return {
      success: false,
      error: `Ya existe una playlist llamada "${playlistName}".`
    }
  }

  const { totalDuration, totalTracks } = await getPlaylistDetails(filePath)
  const playlist = await updatePlaylist(filePath, playlistName, totalDuration, totalTracks, 0)

  return {
    success: true,
    path: filePath,
    playlistName,
    playlist
  }
}

async function savePlaylistToTarget({
  filePaths,
  targetPath = null,
  targetDirectory = null,
  nombre = ''
} = {}) {
  const playlistPath = buildPlaylistTargetPath({
    targetPath,
    targetDirectory,
    nombre
  })
  const { success, error } = await savePlaylist(playlistPath, filePaths)

  if (!success) {
    return { success: false, error }
  }

  invalidatePlaylistCache(playlistPath)
  return persistPlaylistRecord(playlistPath)
}
async function getPlaylistDetails(playlistPath) {
  const m3uDirectory = path.dirname(playlistPath)
  const tracks = await processPlaylist(playlistPath, m3uDirectory)
  const totalDuration = tracks.reduce((acc, track) => acc + track.duration, 0)
  const totalTracks = tracks.length
  const contador = getPlays(playlistPath)
  return { totalDuration, totalTracks, contador }
}
async function updatePlaylistByPath(path, newData) {
  try {
    const playlist = await prisma.playlist.findUnique({
      where: { path }
    })

    if (!playlist) {
      console.log(`Playlist not found for path: ${path}`)
      return null
    }

    const updatedPlaylist = await prisma.playlist.update({
      where: { id: playlist.id },
      data: newData
    })
    invalidatePlaylistCache(path)

    return updatedPlaylist
  } catch (error) {
    console.error('Error updating playlist:', error)
    return null
  }
}
async function getM3ufilepaths(filepath) {
  const fileContent = await fs.promises.readFile(filepath, 'utf-8')
  const absolutePaths = fileContent.split('\n').filter((line) => line.trim() !== '')
  return absolutePaths.map((absPath) => absPath.trim())
}

export async function importPlaylistFile(filePath) {
  const resolvedFilePath = path.resolve(filePath)
  const filePaths = await getM3ufilepaths(resolvedFilePath)

  if (filePaths.length === 0) {
    return {
      success: false,
      error: 'La playlist no contiene canciones.'
    }
  }

  const result = await savePlaylistToTarget({
    filePaths,
    targetPath: resolvedFilePath
  })

  if (!result.success) {
    return result
  }

  return {
    success: true,
    path: result.path,
    playlistName: result.playlistName,
    playlist: result.playlist
  }
}

async function searchPlaylistsPage(request = {}) {
  const query = normalizeSearchQuery(request?.query)
  const page = Math.max(Number(request?.page) || 1, 1)
  const pageSize = Math.min(Math.max(Number(request?.pageSize) || 30, 1), 60)

  if (!query) {
    return {
      items: [],
      page,
      pageSize,
      total: 0,
      hasMore: false
    }
  }

  const matchingPlaylists = await prisma.playlist.findMany({
    where: {
      OR: [
        { nombre: { contains: query } },
        { path: { contains: query } }
      ]
    }
  })

  const sortedPlaylists = matchingPlaylists
    .slice()
    .sort((left, right) =>
      left.nombre.localeCompare(right.nombre, undefined, { sensitivity: 'base' })
    )

  const start = (page - 1) * pageSize
  const pageItems = sortedPlaylists.slice(start, start + pageSize)

  const items = await Promise.all(
    pageItems.map(async (playlist) => {
      const effectiveCover = await getEffectiveCover(playlist)

      return ({
      type: 'playlist',
      id: playlist.id,
      title: playlist.nombre,
      subtitle: `${playlist.numElementos} tracks`,
      meta: playlist.path,
      actionPayload: {
        path: playlist.path
      },
      cover: effectiveCover,
      effectiveCover,
      coverConfig: {
        customCoverMode: playlist.customCoverMode || null,
        customCoverValue: playlist.customCoverValue || null,
        customCoverSelection: playlist.customCoverSelection ? JSON.parse(playlist.customCoverSelection) : null
      },
      path: playlist.path,
      nombre: playlist.nombre,
      duracion: playlist.duracion,
      numElementos: playlist.numElementos,
      totalplays: playlist.totalplays
    })
    })
  )

  return {
    items,
    page,
    pageSize,
    total: sortedPlaylists.length,
    hasMore: start + items.length < sortedPlaylists.length
  }
}

///-----------------
export function setupPlaylistHandlers() {
  ipcMain.handle('load-list', async () => {
    try {
      const filePath = await selectFile()
      if (!filePath) return []
      const result = await importPlaylistFile(filePath)

      if (!result.success) {
        return { success: false, error: result.error }
      }

      return result.playlist
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('get-list', async (event, filepath) => {
    if (!filepath || filepath === '') {
      log.error('get-list: filepath is empty or undefined')
      return { success: false, error: 'filepath is required' }
    }
    try {
      log.info('get-list: loading playlist:', filepath)
      const baseDir = path.dirname(filepath)
      const playlistSongs = await processPlaylist(filepath, baseDir)
      const processedData = playlistSongs.map((song) => ({ ...song, picture: undefined }))
      const playlistData = await getPlaylist(filepath)
      const cover = playlistData ? await getCachedPlaylistCover(playlistData) : null
      const suggestedCovers = await getTop10SuggestedCovers(filepath)
      const effectiveCover = playlistData ? await getEffectiveCover(playlistData, cover) : cover

      const coverConfig = buildCoverConfig(playlistData)

      log.info('get-list: loaded successfully')
      return {
        processedData,
        playlistData,
        cover,
        suggestedCovers,
        effectiveCover,
        coverConfig
      }
    } catch (err) {
      log.error('get-list error:', err.message)
      log.error('Stack:', err.stack)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('get-playlist-detail', async (event, filepath) => {
    if (!filepath || filepath === '') {
      return { success: false, error: 'filepath is required' }
    }

    try {
      return await getPlaylistDetail(filepath)
    } catch (error) {
      log.error('get-playlist-detail error:', error.message)
      return { success: false, error: error.message }
    }
  })

  //Simple
  ipcMain.handle('get-playlists', async () => {
    return await getPlaylists()
  })

  ipcMain.handle('search-playlists-page', async (event, request) => {
    return searchPlaylistsPage(request)
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

  ipcMain.handle('update-playlist-metadata', async (event, { path: filepath, nombre, coverMode, coverValue, coverSelection }) => {
    try {
      if (!filepath) {
        return { success: false, error: 'filepath is required' }
      }

      const existingPlaylist = await prisma.playlist.findUnique({
        where: { path: filepath }
      })

      if (!existingPlaylist) {
        return { success: false, error: 'Playlist no encontrada' }
      }

      const updateData = {}
      const coverModeChanged = coverMode !== undefined

      if (nombre !== undefined && nombre !== null) {
        updateData.nombre = nombre.trim()
      }

      if (coverModeChanged) {
        updateData.customCoverMode = coverMode

        if (coverMode === 'suggested-collage') {
          if (coverSelection && Array.isArray(coverSelection) && coverSelection.length === 4) {
            const suggestedCovers = await getTop10SuggestedCovers(filepath)
            const selectedItems = coverSelection
              .map((selection) => {
                const selectedId =
                  typeof selection === 'string'
                    ? selection
                    : selection?.suggestedId || selection?.filePath || selection?.coverHash || null

                return suggestedCovers.find((cover) => cover.suggestedId === selectedId)
              })
              .filter(Boolean)
              .map((cover) => ({
                suggestedId: cover.suggestedId,
                filePath: cover.filePath,
                coverHash: cover.coverHash
              }))

            if (selectedItems.length !== 4) {
              return { success: false, error: 'No se pudieron resolver las 4 selecciones del collage' }
            }

            const collageBuffer = await generatePlaylistCoverFromSelectedImages(selectedItems)
            updateData.customCoverSelection = JSON.stringify(selectedItems)
            updateData.customCoverValue = bufferToDataUrl(collageBuffer, 'image/png')
          } else {
            return { success: false, error: 'Para collage sugerido se requieren exactamente 4 selecciones' }
          }
        } else if (coverMode === 'local-image' || coverMode === 'remote-image') {
          if (!coverValue) {
            return { success: false, error: `Se requiere un valor para el modo ${coverMode}` }
          }
          updateData.customCoverValue = coverValue
          updateData.customCoverSelection = null
        } else if (coverMode === 'auto' || coverMode === null || coverMode === '') {
          updateData.customCoverMode = null
          updateData.customCoverValue = null
          updateData.customCoverSelection = null
        }
      }

      if (Object.keys(updateData).length > 0) {
        updateData.customCoverUpdatedAt = new Date()
      }

      const updatedPlaylist = await prisma.playlist.update({
        where: { path: filepath },
        data: updateData
      })

      // Only invalidate cover cache and regenerate if the cover mode actually changed
      if (coverModeChanged) {
        invalidatePlaylistCache(filepath)
        const effectiveCover = await getEffectiveCover(updatedPlaylist)

        return {
          success: true,
          playlist: buildPlaylistSummary(updatedPlaylist, effectiveCover),
          coverConfig: buildCoverConfig(updatedPlaylist),
          effectiveCover
        }
      }

      // Name-only change: return immediately without touching covers
      return {
        success: true,
        playlist: buildPlaylistSummary(updatedPlaylist, null),
        coverConfig: buildCoverConfig(updatedPlaylist),
        effectiveCover: null
      }
    } catch (error) {
      console.error('Error updating playlist metadata:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('load-list-to-history', async (event, filePath) => {
    try {
      const playlist = await getPlaylist(filePath)
      if (!playlist) {
        console.log(`Playlist not found for path: ${filePath}`)
        return
      }

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
    invalidatePlaylistCache(filePath)
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

    const filename = path.basename(song)
    await getOrCreateSong(song, filename)

    const baseDir = path.dirname(filePath)
    const filePaths = await getM3ufilepaths(filePath, baseDir) //

    if (filePaths.includes(song)) {
      return {
        success: false,
        error: 'La cancion ya existe en esta playlist.'
      }
    }

    filePaths.push(song)
    const saveResult = await savePlaylist(filePath, filePaths)
    invalidatePlaylistCache(filePath)
    if (!saveResult.success) {
      return { success: false, error: saveResult.error }
    }

    console.log('cancion agregada en:', saveResult.playlistName)
    const playlistDetails = await getPlaylistDetails(filePath)
    console.log('cancion agregada en:', playlistDetails.totalTracks)
    const playlistData = {
      path: filePath,
      duracion: playlistDetails.totalDuration,
      numElementos: playlistDetails.totalTracks,
      totalplays: 0
    }

    return { ...removeTrack(playlistData.path, playlistData), songName: filename }
  })

  ipcMain.handle('append-tracks-to-playlist', async (event, { playlistPath, filePaths = [] }) => {
    try {
      if (!playlistPath) {
        return { success: false, error: 'playlistPath is required' }
      }

      const existingPaths = await getM3ufilepaths(playlistPath)
      const normalizedIncomingPaths = filePaths
        .filter((item) => typeof item === 'string' && item.trim() !== '')
        .map((item) => item.trim())

      if (normalizedIncomingPaths.length === 0) {
        return { success: false, error: 'No hay canciones para agregar.' }
      }

      const existingSet = new Set(existingPaths)
      const pathsToAppend = []

      for (const trackPath of normalizedIncomingPaths) {
        if (!existingSet.has(trackPath)) {
          existingSet.add(trackPath)
          pathsToAppend.push(trackPath)
          const filename = path.basename(trackPath)
          await getOrCreateSong(trackPath, filename)
        }
      }

      if (pathsToAppend.length === 0) {
        return {
          success: true,
          addedCount: 0,
          skippedCount: normalizedIncomingPaths.length,
          playlist: await getPlaylist(playlistPath)
        }
      }

      const nextFilePaths = existingPaths.concat(pathsToAppend)
      const saveResult = await savePlaylist(playlistPath, nextFilePaths)
      invalidatePlaylistCache(playlistPath)

      if (!saveResult.success) {
        return { success: false, error: saveResult.error }
      }

      const persistResult = await persistPlaylistRecord(playlistPath)
      if (!persistResult.success) {
        return persistResult
      }

      return {
        success: true,
        addedCount: pathsToAppend.length,
        skippedCount: normalizedIncomingPaths.length - pathsToAppend.length,
        playlist: persistResult.playlist
      }
    } catch (error) {
      console.error('Error appending tracks to playlist:', error)
      return { success: false, error: error.message || 'No se pudieron agregar las canciones.' }
    }
  })

  ipcMain.handle('save-m3u', async (event, request = {}) => {
    try {
      const { filePaths = [], targetPath = null, targetDirectory = null, nombre = '' } = request
      const resolvedTargetPath =
        targetPath || (await saveDialog(nombre))

      if (!resolvedTargetPath) {
        return { success: false, error: 'Save canceled' }
      }

      const result = await savePlaylistToTarget({
        filePaths,
        targetPath: resolvedTargetPath,
        targetDirectory,
        nombre
      })

      return result
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
}
