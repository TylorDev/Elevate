// @ts-nocheck
import { createRequire } from 'node:module'
import path from 'path'
import fs from 'fs'
import log from 'electron-log/main.js'
import {
  buildCollectionSummaryFromFileInfos,
  deletePlaylistCoverFromCache,
  buildRankingPageFromTracks,
  getCoverFromCache,
  getOrCreateSong,
  getPlaylistCoverFromCache,
  processPlaylist,
  savePlaylistCoverToCache,
  ensureCoverDir
} from './utils/utils.ts'
import {
  buildCollectionSummary,
  generateCollectionCoverFromTracks
} from './utils/collectionDetail.ts'
import { prisma } from '../prisma.ts'
const require = createRequire(import.meta.url)
const electron = require('electron')
const { app, dialog, ipcMain } = electron
const pendingPlaylistRequests = new Map()
let deletePlaylistJobCounter = 0
let sharpModulePromise = null

async function getSharp() {
  if (!sharpModulePromise) {
    sharpModulePromise = import('sharp').then((module) => module.default)
  }

  return sharpModulePromise
}

const INSIGHT_METRIC_KEYS = {
  duration: 'duration',
  shortViews: 'short_view_count',
  longViews: 'long_view_count',
  accumulatedDuration: 'active_listening_seconds',
  repeats: 'consecutive_repeat_count',
  skips: 'skip_count'
}

function buildInsightRankingsFromTracks(tracks = [], request = {}) {
  const page = Number(request?.page) || 1
  const pageSize = Number(request?.pageSize) || 50

  return Object.entries(INSIGHT_METRIC_KEYS).reduce((rankings, [tabId, metricKey]) => {
    rankings[tabId] = buildRankingPageFromTracks(tracks, metricKey, { page, pageSize })
    return rankings
  }, {})
}

function normalizePageRequest(request = {}) {
  return {
    page: Math.max(Number(request?.page) || 1, 1),
    pageSize: Math.min(Math.max(Number(request?.pageSize) || 50, 1), 200)
  }
}

function invalidatePlaylistCache(playlistPath = null) {
  pendingPlaylistRequests.clear()
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
    customCoverHash: playlist.customCoverHash || null,
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
    customCoverHash: playlist.customCoverHash || null,
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
  const cover = null
  const suggestedCovers = await getTop10SuggestedCovers(filepath)
  const effectiveCover = playlistData ? await getEffectiveCover(playlistData, cover) : cover
  const resolvedCover = effectiveCover
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

export async function getPlaylistOverview(filepath, request = {}) {
  const baseDir = path.dirname(filepath)
  const tracks = (await processPlaylist(filepath, baseDir)).map((song) => ({
    ...song,
    picture: undefined
  }))
  const playlistData = await getPlaylist(filepath)
  const effectiveCover = playlistData?.customCoverHash || playlistData?.customCoverMode
    ? await getEffectiveCover(playlistData, false)
    : null
  const resolvedCover = effectiveCover
  const summary = buildCollectionSummaryFromFileInfos(tracks, {
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
    summary,
    rankings: buildInsightRankingsFromTracks(tracks, request),
    playlistData,
    cover: null,
    suggestedCovers: [],
    effectiveCover: resolvedCover,
    coverConfig: buildCoverConfig(playlistData)
  }
}

export async function getPlaylistTracksPage(filepath, request = {}) {
  const { page, pageSize } = normalizePageRequest(request)
  const baseDir = path.dirname(filepath)
  const tracks = (await processPlaylist(filepath, baseDir)).map((song) => ({
    ...song,
    picture: undefined
  }))
  const offset = (page - 1) * pageSize
  const items = tracks.slice(offset, offset + pageSize)

  return {
    items,
    page,
    pageSize,
    total: tracks.length,
    hasMore: offset + items.length < tracks.length
  }
}

export async function getPlaylistEditPayload(filepath) {
  const playlistData = await getPlaylist(filepath)

  if (!playlistData) {
    return { success: false, error: 'Playlist no encontrada' }
  }

  const cover = null
  const suggestedCovers = await getTop10SuggestedCovers(filepath)
  const effectiveCover = await getEffectiveCover(playlistData, cover)

  return {
    success: true,
    playlistData,
    cover,
    suggestedCovers,
    effectiveCover,
    coverConfig: buildCoverConfig(playlistData)
  }
}

async function generatePlaylistCoverFromSelectedImages(selectedItems) {
  if (!selectedItems || selectedItems.length !== 4) {
    throw new Error('Exactly 4 images are required for the collage')
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
      throw new Error('Could not fetch the 4 images for the collage')
    }

    const sharp = await getSharp()
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

function isSourcePathValue(value = '') {
  return typeof value === 'string' && value !== '' && !value.startsWith('data:')
}

async function persistPlaylistCoverForMode(playlist, coverBuffer, mode, extras = {}) {
  if (!playlist?.path || !coverBuffer) {
    return playlist
  }

  const savedCover = await savePlaylistCoverToCache(coverBuffer)
  if (!savedCover?.coverHash) {
    return playlist
  }

  const oldCoverHash = playlist.customCoverHash || null
  const nextMode = mode || playlist.customCoverMode || null
  const updateData = {
    customCoverMode: nextMode,
    customCoverHash: savedCover.coverHash,
    customCoverSelection:
      extras.customCoverSelection !== undefined
        ? extras.customCoverSelection
        : playlist.customCoverSelection || null,
    customCoverUpdatedAt: new Date()
  }

  if (extras.customCoverValue !== undefined) {
    updateData.customCoverValue = extras.customCoverValue
  } else if (nextMode === 'auto-generated' || nextMode === 'suggested-collage') {
    updateData.customCoverValue = null
  } else {
    updateData.customCoverValue = playlist.customCoverValue || null
  }

  const updatedPlaylist = await prisma.playlist.update({
    where: { path: playlist.path },
    data: updateData
  })

  invalidatePlaylistCache(playlist.path)

  if (oldCoverHash && oldCoverHash !== savedCover.coverHash) {
    await deletePlaylistCoverFromCache(oldCoverHash)
  }

  return updatedPlaylist
}

async function materializeStoredPlaylistCover(playlist, { allowAutoGenerate = false } = {}) {
  if (!playlist) {
    return { playlist: null, cover: null }
  }

  if (playlist.customCoverHash) {
    const cachedCover = await getPlaylistCoverFromCache(playlist.customCoverHash, 'full')
    if (cachedCover) {
      return { playlist, cover: cachedCover }
    }
  }

  let coverBuffer = null
  let nextMode = playlist.customCoverMode || null
  let nextCoverValue
  let nextCoverSelection

  if (typeof playlist.customCoverValue === 'string' && playlist.customCoverValue.startsWith('data:')) {
    const parsed = dataUrlToBuffer(playlist.customCoverValue)
    if (parsed?.buffer) {
      coverBuffer = parsed.buffer
      nextCoverValue =
        nextMode === 'local-image' || nextMode === 'remote-image'
          ? null
          : nextMode === 'auto-generated' || nextMode === 'suggested-collage'
            ? null
            : playlist.customCoverValue
    }
  } else if (playlist.customCoverMode === 'local-image') {
    if (isSourcePathValue(playlist.customCoverValue) && fs.existsSync(playlist.customCoverValue)) {
      const sharp = await getSharp()
      coverBuffer = await sharp(playlist.customCoverValue)
        .resize(500, 500, { fit: 'cover' })
        .png()
        .toBuffer()
      nextCoverValue = playlist.customCoverValue
    }
  } else if (playlist.customCoverMode === 'remote-image') {
    if (isSourcePathValue(playlist.customCoverValue)) {
      const sharp = await getSharp()
      const axios = (await import('axios')).default
      const response = await axios.get(playlist.customCoverValue, { responseType: 'arraybuffer' })
      coverBuffer = await sharp(Buffer.from(response.data))
        .resize(500, 500, { fit: 'cover' })
        .png()
        .toBuffer()
      nextCoverValue = playlist.customCoverValue
    }
  } else if (playlist.customCoverMode === 'suggested-collage') {
    const selection = playlist.customCoverSelection
      ? JSON.parse(playlist.customCoverSelection)
      : null

    if (selection && Array.isArray(selection) && selection.length === 4) {
      coverBuffer = await generatePlaylistCoverFromSelectedImages(selection)
      nextCoverSelection = playlist.customCoverSelection
      nextCoverValue = null
    }
  } else if (
    allowAutoGenerate &&
    (playlist.customCoverMode === 'auto-generated' || !playlist.customCoverMode)
  ) {
    const tracks = (await processPlaylist(playlist.path, path.dirname(playlist.path))).map((song) => ({
      ...song,
      picture: undefined
    }))

    if (tracks.length > 0) {
      coverBuffer = await generateCollectionCoverFromTracks(tracks)
      nextMode = 'auto-generated'
      nextCoverValue = null
      nextCoverSelection = null
    }
  }

  if (!coverBuffer) {
    return { playlist, cover: null }
  }

  const updatedPlaylist = await persistPlaylistCoverForMode(playlist, coverBuffer, nextMode, {
    customCoverValue: nextCoverValue,
    customCoverSelection: nextCoverSelection
  })
  const persistedCover = updatedPlaylist?.customCoverHash
    ? await getPlaylistCoverFromCache(updatedPlaylist.customCoverHash, 'full')
    : null

  return {
    playlist: updatedPlaylist,
    cover: persistedCover
  }
}

async function getEffectiveCover(playlist, fallbackCover = null) {
  try {
    const { cover } = await materializeStoredPlaylistCover(playlist, { allowAutoGenerate: false })
    return cover || fallbackCover || null
  } catch (error) {
    console.error('Error getting effective cover:', error)
    return fallbackCover ?? null
  }
}

async function ensurePlaylistCover(playlistPath, { variant = 'full', allowAutoGenerate = true } = {}) {
  try {
    if (typeof playlistPath !== 'string' || playlistPath.trim() === '') {
      return { success: false, error: 'playlistPath is required' }
    }

    const playlist = await getPlaylist(playlistPath.trim())
    if (!playlist) {
      return { success: false, error: 'Playlist no encontrada' }
    }

    const { playlist: updatedPlaylist, cover } = await materializeStoredPlaylistCover(playlist, {
      allowAutoGenerate
    })

    if (!cover) {
      return { success: false, error: 'There are no covers available to generate the cover.' }
    }

    const coverHash = updatedPlaylist?.customCoverHash || playlist.customCoverHash || null
    const variantCover =
      coverHash && variant !== 'full'
        ? await getPlaylistCoverFromCache(coverHash, variant)
        : cover

    return {
      success: true,
      cover: variantCover || cover,
      coverHash,
      coverConfig: buildCoverConfig(updatedPlaylist || playlist)
    }
  } catch (error) {
    console.error('Error ensuring playlist cover:', error)
    return { success: false, error: error.message || 'No se pudo resolver la portada.' }
  }
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
function isPrismaRecordNotFound(error) {
  return error?.code === 'P2025'
}

async function deletePlaylist(filePath) {
  try {
    const existingPlaylist = await prisma.playlist.findUnique({
      where: { path: filePath },
      select: { customCoverHash: true }
    })

    await prisma.playlist.delete({
      where: { path: filePath }
    })
    invalidatePlaylistCache(filePath)
    await deletePlaylistCoverFromCache(existingPlaylist?.customCoverHash || null)

    return { success: true, path: filePath }
  } catch (error) {
    if (isPrismaRecordNotFound(error)) {
      invalidatePlaylistCache(filePath)
      return { success: true, path: filePath, notFound: true }
    }

    console.error('Error deleting playlist:', error)

    return { success: false, message: 'Error deleting playlist', error: error.message }
  }
}

function queuePlaylistDelete(filePath, sender) {
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    return { success: false, error: 'Invalid playlist path.' }
  }

  const normalizedPath = filePath.trim()
  const jobId = `delete-playlist-${Date.now()}-${++deletePlaylistJobCounter}`

  setImmediate(async () => {
    const result = await deletePlaylist(normalizedPath)
    const payload = {
      jobId,
      path: normalizedPath,
      success: Boolean(result?.success),
      error: result?.error || result?.message || null
    }

    if (!sender?.isDestroyed?.()) {
      sender.send('playlist-delete-completed', payload)
    }
  })

  return { success: true, queued: true, jobId, path: normalizedPath }
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

async function getPlaylistsLite() {
  const playlists = await prisma.playlist.findMany({
    orderBy: { totalplays: 'desc' }
  })

  return playlists.map((playlist) => {
    return {
      ...playlist,
      cover: null,
      effectiveCover: null,
      coverConfig: buildCoverConfig(playlist)
    }
  })
}

async function getPlaylistsMinimal() {
  const playlists = await prisma.playlist.findMany({
    select: {
      id: true,
      path: true,
      nombre: true,
      numElementos: true,
      duracion: true,
      customCoverMode: true,
      customCoverHash: true
    },
    orderBy: { totalplays: 'desc' }
  })
  
  return playlists.map(playlist => ({
    ...playlist,
    cover: null,
    effectiveCover: null,
    coverConfig: {
      customCoverMode: playlist.customCoverMode || null,
      customCoverHash: playlist.customCoverHash || null,
      customCoverValue: null,
      customCoverSelection: null
    }
  }))
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
  const suggestedFileName = stripPlaylistExtension(nombre)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/[. ]+$/g, '') || 'playlist'

  while (!isValid) {
    const { filePath: selectedPath } = await dialog.showSaveDialog({
      title: 'Save list',
      defaultPath: path.join(app.getPath('documents'), `${suggestedFileName}.m3u`),
      filters: [{ name: 'Playlists', extensions: ['m3u'] }]
    })

    if (!selectedPath) {
      // Si el usuario cancela el diálogo
      console.log('The dialog was canceled')
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
        'The file name must be more than 5 and fewer than 15 characters. Try again.'
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
    return {
      success: false,
      error: isProtectedPathError(err) ? getProtectedPathMessage() : err.message
    }
  }
}
function extractPlaylistName(filePath) {
  return path.basename(filePath, path.extname(filePath))
}

const WINDOWS_RESERVED_FILE_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9'
])

function stripPlaylistExtension(nombre = '') {
  return String(nombre).trim().replace(/\.m3u$/i, '')
}

function normalizePlaylistFileName(nombre = '') {
  return stripPlaylistExtension(nombre)
}

function hasInvalidPlaylistNameCharacters(nombre = '') {
  return /[<>:"/\\|?*]/.test(String(nombre))
}

function getPlaylistNameValidationError(nombre = '') {
  const rawName = stripPlaylistExtension(nombre)

  if (!rawName) {
    return 'Enter a valid playlist name.'
  }

  if (/[\x00-\x1f]/.test(rawName)) {
    return 'El nombre de la playlist contiene caracteres no permitidos.'
  }

  if (hasInvalidPlaylistNameCharacters(rawName)) {
    return 'El nombre de la playlist contiene caracteres no permitidos.'
  }

  if (/[. ]$/.test(rawName)) {
    return 'El nombre de la playlist no puede terminar en punto o espacio.'
  }

  if (WINDOWS_RESERVED_FILE_NAMES.has(rawName.toUpperCase())) {
    return 'El nombre de la playlist esta reservado por el sistema.'
  }

  const normalizedName = normalizePlaylistFileName(nombre)

  if (!normalizedName) {
    return 'Enter a valid playlist name.'
  }

  return null
}

function getTrackPathKey(filePath) {
  const normalizedPath = path.normalize(filePath)
  return process.platform === 'win32' ? normalizedPath.toLowerCase() : normalizedPath
}

function resolvePlaylistTrackPath(trackPath, baseDirectory) {
  return path.isAbsolute(trackPath)
    ? path.normalize(trackPath)
    : path.resolve(baseDirectory, trackPath)
}

function sanitizePlaylistTrackPaths(filePaths = []) {
  const uniqueTrackPaths = []
  const seenPaths = new Set()

  for (const item of filePaths) {
    if (typeof item !== 'string') {
      continue
    }

    const normalizedPath = item.trim()
    const trackPathKey = getTrackPathKey(normalizedPath)

    if (!normalizedPath || seenPaths.has(trackPathKey)) {
      continue
    }

    seenPaths.add(trackPathKey)
    uniqueTrackPaths.push(normalizedPath)
  }

  return uniqueTrackPaths
}

function hasDuplicatePlaylistTrackPaths(filePaths = []) {
  return sanitizePlaylistTrackPaths(filePaths).length !== filePaths.length
}

function getPlaylistTrackSignature(filePaths = []) {
  return sanitizePlaylistTrackPaths(filePaths).map(getTrackPathKey).join('\n')
}

function isProtectedPathError(error) {
  return ['EACCES', 'EPERM', 'EROFS'].includes(error?.code)
}

function getProtectedPathMessage() {
  return 'Ruta protegida, No se pudo crear la playlist.'
}

async function findPlaylistByNameInsensitive(playlistName) {
  const normalizedPlaylistName = normalizePlaylistFileName(playlistName).toLowerCase()
  const playlists = await prisma.playlist.findMany({
    select: {
      nombre: true,
      path: true
    }
  })

  return playlists.find(
    (playlist) => normalizePlaylistFileName(playlist.nombre).toLowerCase() === normalizedPlaylistName
  ) || null
}

async function findPlaylistsByNameInsensitive(playlistName) {
  const normalizedPlaylistName = normalizePlaylistFileName(playlistName).toLowerCase()
  const playlists = await prisma.playlist.findMany({
    select: {
      id: true,
      nombre: true,
      path: true
    }
  })

  return playlists.filter(
    (playlist) => normalizePlaylistFileName(playlist.nombre).toLowerCase() === normalizedPlaylistName
  )
}

async function playlistNameExistsInDatabase(playlistName, filePath = null) {
  const conflictingPlaylist = await findPlaylistByNameInsensitive(playlistName)

  if (!conflictingPlaylist) {
    return false
  }

  if (filePath && conflictingPlaylist.path === filePath) {
    return false
  }

  return true
}

async function playlistPathExistsInDatabase(filePath) {
  if (!filePath) {
    return false
  }

  const conflictingPlaylist = await prisma.playlist.findUnique({
    where: { path: path.resolve(filePath) }
  })

  return Boolean(conflictingPlaylist)
}

async function playlistIdentityExistsInDatabase(playlistName, filePath) {
  const [conflictingName, conflictingPath] = await Promise.all([
    playlistNameExistsInDatabase(playlistName),
    playlistPathExistsInDatabase(filePath)
  ])

  return conflictingName || conflictingPath
}

async function resolveUniquePlaylistPath({
  targetDirectory,
  requestedName,
  targetPath = null
} = {}) {
  if (!targetDirectory) {
    throw new Error('Target directory is required')
  }

  const baseName = targetPath ? extractPlaylistName(targetPath) : requestedName
  const validationError = getPlaylistNameValidationError(baseName)
  if (validationError) {
    throw new Error(validationError)
  }

  const normalizedName = normalizePlaylistFileName(baseName)
  const resolvedDirectory = path.resolve(targetDirectory)
  let candidateIndex = 1

  while (true) {
    const candidateName = candidateIndex === 1 ? normalizedName : `${normalizedName} (${candidateIndex})`
    const candidatePath = path.join(resolvedDirectory, `${candidateName}.m3u`)
    const candidateExistsOnDisk = fs.existsSync(candidatePath)
    const candidateExistsInDb = await playlistIdentityExistsInDatabase(candidateName, candidatePath)

    if (!candidateExistsOnDisk && !candidateExistsInDb) {
      return candidatePath
    }

    candidateIndex += 1
  }
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

async function createPlaylistRecord(filePath, playlistName, totalTracks, totalDuration = 0) {
  const playlist = await prisma.playlist.create({
    data: {
      path: filePath,
      nombre: playlistName,
      duracion: totalDuration,
      numElementos: totalTracks,
      totalplays: 0
    }
  })

  invalidatePlaylistCache(filePath)
  return playlist
}

async function persistPlaylistRecord(filePath, { allowExistingPath = false } = {}) {
  const playlistName = extractPlaylistName(filePath)
  const [existingPlaylistByPath, conflictingPlaylistByName] = await Promise.all([
    prisma.playlist.findUnique({ where: { path: filePath } }),
    findPlaylistByNameInsensitive(playlistName)
  ])

  if (existingPlaylistByPath && !allowExistingPath) {
    return {
      success: false,
      error: `Ya existe una playlist registrada en esta ruta.`
    }
  }

  if (conflictingPlaylistByName && conflictingPlaylistByName.path !== filePath) {
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
  const normalizedFilePaths = sanitizePlaylistTrackPaths(filePaths)

  if (normalizedFilePaths.length === 0) {
    return {
      success: false,
      error: 'A playlist must have at least one song.'
    }
  }

  const playlistPath = await resolveUniquePlaylistPath({
    targetPath,
    targetDirectory,
    requestedName: nombre
  })
  const { success, error } = await savePlaylist(playlistPath, normalizedFilePaths)

  if (!success) {
    return { success: false, error }
  }

  invalidatePlaylistCache(playlistPath)
  return persistPlaylistRecord(playlistPath)
}

async function exportPlaylistToTarget({
  filePaths,
  targetPath = null,
  targetDirectory = null,
  nombre = ''
} = {}) {
  const normalizedFilePaths = sanitizePlaylistTrackPaths(filePaths)

  if (normalizedFilePaths.length === 0) {
    return {
      success: false,
      error: 'A playlist must have at least one song.'
    }
  }

  const normalizedTargetPath =
    typeof targetPath === 'string' && targetPath.trim() !== '' ? path.resolve(targetPath) : null
  const normalizedTargetDirectory =
    typeof targetDirectory === 'string' && targetDirectory.trim() !== ''
      ? path.resolve(targetDirectory)
      : normalizedTargetPath
        ? path.dirname(normalizedTargetPath)
        : ''

  if (!normalizedTargetDirectory) {
    return {
      success: false,
      error: 'There is no valid destination folder.'
    }
  }

  const baseName = normalizedTargetPath ? extractPlaylistName(normalizedTargetPath) : nombre
  const validationError = getPlaylistNameValidationError(baseName)

  if (validationError) {
    return { success: false, error: validationError }
  }

  const exportPath = normalizedTargetPath
    ? normalizedTargetPath
    : path.join(
        normalizedTargetDirectory,
        `${normalizePlaylistFileName(baseName)}.m3u`
      )

  const { success, error } = await savePlaylist(exportPath, normalizedFilePaths)

  if (!success) {
    return { success: false, error }
  }

  return {
    success: true,
    path: exportPath,
    playlistName: extractPlaylistName(exportPath)
  }
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
  return readPlaylistTrackPaths(filepath)
}

async function readPlaylistTrackPaths(filepath) {
  const fileContent = await fs.promises.readFile(filepath, 'utf-8')
  const baseDirectory = path.dirname(filepath)
  const absolutePaths = fileContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
  return absolutePaths.map((trackPath) => resolvePlaylistTrackPath(trackPath, baseDirectory))
}

async function findDuplicateImportedPlaylist({ name, path: importedPath, trackSignature }) {
  const samePathPlaylist = await prisma.playlist.findUnique({
    where: { path: importedPath }
  })

  if (samePathPlaylist) {
    return {
      type: 'same-path',
      playlist: samePathPlaylist
    }
  }

  const sameNamePlaylists = await findPlaylistsByNameInsensitive(name)

  for (const playlist of sameNamePlaylists) {
    try {
      const existingTrackPaths = await readPlaylistTrackPaths(playlist.path)
      const existingTrackSignature = getPlaylistTrackSignature(existingTrackPaths)

      if (existingTrackSignature === trackSignature) {
        return {
          type: 'same-name-and-tracks',
          playlist
        }
      }
    } catch (error) {
      console.warn('Could not compare playlist during import:', playlist.path, error?.message)
    }
  }

  if (sameNamePlaylists.length > 0) {
    return {
      type: 'same-name',
      playlist: sameNamePlaylists[0]
    }
  }

  return null
}

async function persistImportedPlaylistRecord(filePath, filePaths) {
  const playlistName = extractPlaylistName(filePath)
  const existingPlaylistByPath = await prisma.playlist.findUnique({
    where: { path: filePath }
  })

  if (existingPlaylistByPath) {
    return {
      success: false,
      error: 'Ya existe una playlist registrada en esta ruta.'
    }
  }

  const conflictingPlaylistByName = await findPlaylistByNameInsensitive(playlistName)
  if (conflictingPlaylistByName) {
    return {
      success: false,
      error: `Ya existe una playlist llamada "${playlistName}".`
    }
  }

  const playlist = await createPlaylistRecord(filePath, playlistName, filePaths.length, 0)

  return {
    success: true,
    path: filePath,
    playlistName,
    playlist
  }
}

export async function importPlaylistFile(filePath) {
  const resolvedFilePath = path.resolve(filePath)
  const playlistName = extractPlaylistName(resolvedFilePath)
  const validationError = getPlaylistNameValidationError(playlistName)

  if (validationError) {
    return {
      success: false,
      error: validationError
    }
  }

  const filePaths = await readPlaylistTrackPaths(resolvedFilePath)
  const normalizedFilePaths = sanitizePlaylistTrackPaths(filePaths)

  if (normalizedFilePaths.length === 0) {
    return {
      success: false,
      error: 'A playlist must have at least one song.'
    }
  }

  const trackSignature = getPlaylistTrackSignature(normalizedFilePaths)
  const duplicateImport = await findDuplicateImportedPlaylist({
    name: playlistName,
    path: resolvedFilePath,
    trackSignature
  })

  if (duplicateImport?.type === 'same-path') {
    return {
      success: false,
      error: 'Ya existe una playlist registrada en esta ruta.'
    }
  }

  if (duplicateImport?.type === 'same-name-and-tracks') {
    return {
      success: false,
      error: 'A playlist with the same name and songs already exists.'
    }
  }

  const needsCleanCopy =
    duplicateImport?.type === 'same-name' || hasDuplicatePlaylistTrackPaths(filePaths)

  if (!needsCleanCopy) {
    return persistImportedPlaylistRecord(resolvedFilePath, normalizedFilePaths)
  }

  const playlistPath = await resolveUniquePlaylistPath({
    targetPath: resolvedFilePath,
    targetDirectory: path.dirname(resolvedFilePath),
    requestedName: playlistName
  })
  const { success, error } = await savePlaylist(playlistPath, normalizedFilePaths)

  if (!success) {
    return { success: false, error }
  }

  return persistImportedPlaylistRecord(playlistPath, normalizedFilePaths)
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
      coverConfig: buildCoverConfig(playlist),
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
  ipcMain.handle('load-list', async (_event, explicitFilePath = null) => {
    try {
      const filePath =
        typeof explicitFilePath === 'string' && explicitFilePath.trim() !== ''
          ? explicitFilePath.trim()
          : await selectFile()
      if (!filePath) return { success: false, canceled: true, error: 'Import canceled' }
      const result = await importPlaylistFile(filePath)

      if (!result.success) {
        return { success: false, error: result.error }
      }

      return result
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
      const cover = null
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

  ipcMain.handle('playlist:ensure-cover', async (_event, request) => {
    const playlistPath = typeof request === 'string' ? request : request?.playlistPath
    const variant = typeof request === 'object' ? request?.variant || 'full' : 'full'
    return ensurePlaylistCover(playlistPath, {
      variant,
      allowAutoGenerate: true
    })
  })

  ipcMain.handle('playlist:get-cover', async (_event, request) => {
    const playlistPath = typeof request === 'string' ? request : request?.playlistPath
    const variant = typeof request === 'object' ? request?.variant || 'full' : 'full'
    return ensurePlaylistCover(playlistPath, {
      variant,
      allowAutoGenerate: false
    })
  })

  //Simple
  ipcMain.handle('get-playlists', async () => {
    return await getPlaylists()
  })

  ipcMain.handle('get-playlists-lite', async () => {
    return await getPlaylistsLite()
  })

  ipcMain.handle('get-playlists-minimal', async () => {
    return await getPlaylistsMinimal()
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
    return queuePlaylistDelete(filePath, event.sender)
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
      let updatedPlaylist = existingPlaylist
      let oldCoverHashToDelete = null

      if (nombre !== undefined && nombre !== null) {
        updateData.nombre = nombre.trim()
      }

      if (coverModeChanged) {
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
            updatedPlaylist = await persistPlaylistCoverForMode(
              existingPlaylist,
              collageBuffer,
              'suggested-collage',
              {
                customCoverSelection: JSON.stringify(selectedItems),
                customCoverValue: null
              }
            )
          } else {
            return { success: false, error: 'Para collage sugerido se requieren exactamente 4 selecciones' }
          }
        } else if (coverMode === 'local-image' || coverMode === 'remote-image') {
          if (!coverValue) {
            return { success: false, error: `Se requiere un valor para el modo ${coverMode}` }
          }
          let sourceBuffer = null

          if (coverMode === 'local-image') {
            if (!fs.existsSync(coverValue)) {
              return { success: false, error: 'No se encontro la imagen local seleccionada' }
            }

            const sharp = await getSharp()
            sourceBuffer = await sharp(coverValue)
              .resize(500, 500, { fit: 'cover' })
              .png()
              .toBuffer()
          } else {
            const sharp = await getSharp()
            const axios = (await import('axios')).default
            const response = await axios.get(coverValue, { responseType: 'arraybuffer' })
            sourceBuffer = await sharp(Buffer.from(response.data))
              .resize(500, 500, { fit: 'cover' })
              .png()
              .toBuffer()
          }

          updatedPlaylist = await persistPlaylistCoverForMode(existingPlaylist, sourceBuffer, coverMode, {
            customCoverSelection: null,
            customCoverValue: coverValue
          })
        } else if (coverMode === 'auto' || coverMode === null || coverMode === '') {
          oldCoverHashToDelete = existingPlaylist.customCoverHash || null
          updateData.customCoverMode = null
          updateData.customCoverHash = null
          updateData.customCoverValue = null
          updateData.customCoverSelection = null
        } else if (coverMode === 'auto-generated') {
          updatedPlaylist = existingPlaylist
        }
      }

      if (updatedPlaylist !== existingPlaylist && Object.keys(updateData).length > 0) {
        updatedPlaylist = await prisma.playlist.update({
          where: { path: filepath },
          data: updateData
        })
      }

      if (Object.keys(updateData).length > 0 && updatedPlaylist === existingPlaylist) {
        if (coverModeChanged) {
          updateData.customCoverUpdatedAt = new Date()
        }
        updatedPlaylist = await prisma.playlist.update({
          where: { path: filepath },
          data: updateData
        })
        invalidatePlaylistCache(filepath)
      }

      if (oldCoverHashToDelete) {
        await deletePlaylistCoverFromCache(oldCoverHashToDelete)
      }

      // Only invalidate cover cache and regenerate if the cover mode actually changed
      if (coverModeChanged) {
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
        return { success: false, error: 'There are no songs to add.' }
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

      const persistResult = await persistPlaylistRecord(playlistPath, { allowExistingPath: true })
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
      return { success: false, error: error.message || 'Could not add the songs.' }
    }
  })

  ipcMain.handle('save-m3u', async (event, request = {}) => {
    try {
      const {
        filePaths = [],
        targetPath = null,
        targetDirectory = null,
        nombre = '',
        persist = true
      } = request
      const hasExplicitTargetPath = typeof targetPath === 'string' && targetPath.trim() !== ''
      const hasTargetDirectory = typeof targetDirectory === 'string' && targetDirectory.trim() !== ''
      const resolvedTargetPath = hasExplicitTargetPath
        ? targetPath
        : hasTargetDirectory
          ? null
          : await saveDialog(nombre)

      if (!resolvedTargetPath && !hasTargetDirectory) {
        return { success: false, error: 'Save canceled' }
      }

      const effectiveTargetDirectory =
        hasTargetDirectory
          ? targetDirectory
          : resolvedTargetPath
            ? path.dirname(resolvedTargetPath)
            : ''

      if (persist) {
        return savePlaylistToTarget({
          filePaths,
          targetPath: resolvedTargetPath,
          targetDirectory: effectiveTargetDirectory,
          nombre
        })
      }

      return exportPlaylistToTarget({
        filePaths,
        targetPath: resolvedTargetPath,
        targetDirectory: effectiveTargetDirectory,
        nombre
      })
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
}
