import { createRequire } from 'node:module'

import { generateCover, getFileInfos, getOrCreateSong } from './utils/utils.mjs'
import { prisma } from '../prisma.mjs'

import { getSongBpm } from './utils/utils.mjs'
const require = createRequire(import.meta.url)
const electron = require('electron')
const { ipcMain } = electron
const PLAYBACK_EVENT_TYPES = new Set([
  'short-view-award',
  'long-view-award',
  'skip-award',
  'playback-finalize'
])
const STAT_SELECT = {
  play_count: true,
  skip_count: true,
  short_view_count: true,
  long_view_count: true,
  long_play_seconds: true,
  active_listening_seconds: true,
  consecutive_repeat_count: true,
  bpm: true,
  is_favorite: true
}

let lastRecordedPlaybackSongId = null

function withoutPictures(fileInfos) {
  return fileInfos.map((fileInfo) => ({ ...fileInfo, picture: undefined }))
}

async function markUserPreference(songId, preferenceField, preferenceValue = true) {
  await prisma.userPreferences.upsert({
    where: { song_id: songId },
    update: { [preferenceField]: preferenceValue },
    create: {
      song_id: songId,
      [preferenceField]: preferenceValue
    }
  })
}

async function isSongLiked(songId) {
  const preference = await prisma.userPreferences.findUnique({
    where: { song_id: songId },
    select: { is_favorite: true }
  })
  return preference?.is_favorite || false
}

async function getUserPreferencesByCriteria(criteria) {
  try {
    // Obtener todas las preferencias de usuario que cumplen con el criterio
    const userPreferences = await prisma.userPreferences.findMany({
      where: criteria,
      select: {
        Songs: {
          select: {
            filepath: true,
            filename: true
          }
        }
      }
    })

    // Extraer las canciones según el criterio
    const songs = userPreferences.map((preference) => preference.Songs)

    console.debug(`Songs count:`, songs.length)

    const filePaths = songs.map((song) => song.filepath)
    const coverData = await getFileInfos(filePaths)
    const cover = await generateCover(coverData)
    const tracks = withoutPictures(coverData)
    const totalDuration = tracks.reduce((acc, track) => acc + track.duration, 0)
    return { fileInfos: tracks, cover, totalDuration }
  } catch (error) {
    console.error('Error retrieving songs:', error)
    return { success: false, error: error.message }
  }
}

async function updateSongPreference(filepath, updateAction, updateData) {
  try {
    // Verificar si la canción existe en la tabla Songs
    const song = await prisma.songs.findUnique({
      where: { filepath }
    })

    if (!song) {
      console.debug('Song not found:', { filepath })
      return { success: false, error: 'Song not found' }
    }

    const songId = song.song_id

    // Verificar el estado actual de la canción en UserPreferences
    const preference = await prisma.userPreferences.findUnique({
      where: { song_id: songId }
    })

    if (preference) {
      // Realizar la acción de actualización o eliminación según el caso
      await updateAction(songId, updateData)
      console.debug('Song updated successfully:', { songId })
      return { success: true, songId }
    } else {
      console.debug('Song not found in user preferences:', { filepath })
      return { success: false, error: 'Song not found in user preferences' }
    }
  } catch (error) {
    console.error('Error updating song preference:', error)
    return { success: false, error: error.message }
  }
}

async function addPlayHistory(song_id) {
  try {
    // Upsert UserPreference: Si no existe, se crea con valores predeterminados.
    await prisma.userPreferences.upsert({
      where: { song_id },
      update: {
        play_count: {
          increment: 1
        },
        short_view_count: {
          increment: 1
        }
      },
      create: {
        song_id,
        play_count: 1, // Inicializa play_count en 1
        short_view_count: 1
      }
    })

    // Crear un nuevo registro en PlayHistory
    await prisma.playHistory.create({
      data: {
        song_id
      }
    })

    console.log(`Play history updated for song_id: ${song_id}`)
  } catch (error) {
    console.error('Error updating play history:', error)
  }
}

async function getMostPlayedSongsWithDetails() {
  try {
    const userPreferences = await prisma.userPreferences.findMany({
      orderBy: {
        short_view_count: 'desc'
      },
      select: {
        short_view_count: true,
        Songs: {
          select: {
            filepath: true,
            filename: true
          }
        }
      }
    })

    // Extraer las canciones más escuchadas con detalles adicionales (filepath y filename)
    const songs = userPreferences.map((record) => ({
      filepath: record.Songs.filepath,
      filename: record.Songs.filename,
      short_view_count: record.short_view_count
    }))
    const paths = songs.map((song) => song.filepath)
    const firstTenPaths = paths.slice(0, 10)
    console.log(firstTenPaths)
    return firstTenPaths
  } catch (error) {
    console.error('Error retrieving most played songs:', error)
    return { success: false, error: error.message }
  }
}

function formatRankedSong(record, metricKey) {
  const song = record.Songs
  return {
    song_id: song.song_id,
    filePath: song.filepath,
    fileName: song.filename,
    title: song.title,
    artist: song.artist,
    album: song.album,
    genre: song.genre,
    year: song.year,
    duration: Number(song.duration) || 0,
    coverHash: song.coverHash,
    short_view_count: Number(record.short_view_count) || 0,
    long_view_count: Number(record.long_view_count) || 0,
    long_play_seconds: Number(record.long_play_seconds) || 0,
    active_listening_seconds: Number(record.active_listening_seconds) || 0,
    consecutive_repeat_count: Number(record.consecutive_repeat_count) || 0,
    skip_count: Number(record.skip_count) || 0,
    metricValue: Number(record[metricKey]) || 0
  }
}

async function getRanking(metricKey, limit = 50) {
  const rows = await prisma.userPreferences.findMany({
    where: {
      [metricKey]: {
        gt: 0
      }
    },
    orderBy: {
      [metricKey]: 'desc'
    },
    take: limit,
    include: {
      Songs: true
    }
  })

  return rows.map((record) => formatRankedSong(record, metricKey))
}

async function getStatisticsRankings(request = {}) {
  const limit = Math.min(Math.max(Number(request?.limit) || 50, 1), 100)
  const [shortViews, longViews, duration, repeats, skips] = await Promise.all([
    getRanking('short_view_count', limit),
    getRanking('long_view_count', limit),
    getRanking('long_play_seconds', limit),
    getRanking('consecutive_repeat_count', limit),
    getRanking('skip_count', limit)
  ])

  return {
    success: true,
    rankings: {
      shortViews,
      longViews,
      duration,
      repeats,
      skips
    }
  }
}
async function getPlayHistoryOrdered(page = 1) {
  const pageSize = 10 // Número de elementos por página

  try {
    // Contar el total de registros en PlayHistory
    const totalRecords = await prisma.playHistory.count()

    // Calcular el número máximo de páginas
    const maxPages = Math.ceil(totalRecords / pageSize)

    // Obtener solo 10 registros de PlayHistory ordenados por el campo timestamp más reciente
    const playHistoryRecords = await prisma.playHistory.findMany({
      orderBy: {
        timestamp: 'desc' // Ordenar de más reciente a más antiguo
      },
      take: pageSize, // Limitar a 10 registros
      skip: (page - 1) * pageSize, // Omitir elementos según la página
      select: {
        song_id: true,
        timestamp: true, // Incluye el campo timestamp para información adicional
        Songs: {
          select: {
            filepath: true,
            filename: true
          }
        }
      }
    })

    // Extraer canciones según el historial de reproducción
    const songs = playHistoryRecords.map((record) => record.Songs)

    // Obtener información adicional de las canciones
    const filePaths = songs.map((song) => song.filepath)
    const fileInfos = await getFileInfos(filePaths, { includePicture: false })

    return { fileInfos, maxPages }
  } catch (error) {
    console.error('Error retrieving play history:', error)
    return { success: false, error: error.message }
  }
}

async function getRecentHistoryOrdered() {
  try {
    // Obtener todos los registros de PlayHistory ordenados por el campo timestamp más reciente
    const playHistoryRecords = await prisma.playHistory.findMany({
      orderBy: {
        timestamp: 'desc' // Ordenar de más reciente a más antiguo
      },
      select: {
        song_id: true,
        timestamp: true, // Incluye el campo timestamp para información adicional
        Songs: {
          select: {
            filepath: true,
            filename: true
          }
        }
      }
    })

    // Filtrar canciones únicas basadas en el song_id y obtener la más reciente
    const uniqueSongs = new Map()
    playHistoryRecords.forEach((record) => {
      if (!uniqueSongs.has(record.song_id)) {
        uniqueSongs.set(record.song_id, record.Songs)
      }
    })

    // Convertir el Map a un array de canciones
    const songs = Array.from(uniqueSongs.values())

    // Opcional: Si necesitas información adicional de las canciones, puedes obtenerla aquí
    const filePaths = songs.map((song) => song.filepath)
    const fileInfos = await getFileInfos(filePaths, { includePicture: false })

    return fileInfos
  } catch (error) {
    console.error('Error retrieving play history:', error)
    return { success: false, error: error.message }
  }
}

async function getLatestPlayHistoryRecord() {
  try {
    // Obtener el registro más reciente de PlayHistory ordenado por el campo timestamp
    const latestPlayHistoryRecord = await prisma.playHistory.findFirst({
      orderBy: {
        timestamp: 'desc' // Ordenar de más reciente a más antiguo
      },
      select: {
        song_id: true,
        timestamp: true, // Incluye el campo timestamp para información adicional
        Songs: {
          select: {
            filepath: true,
            filename: true
          }
        }
      }
    })

    if (!latestPlayHistoryRecord) {
      return { success: false, message: 'No play history records found.' }
    }

    // console.debug('Latest play history record:', latestPlayHistoryRecord)

    // Opcional: Si necesitas información adicional de la canción, puedes obtenerla aquí
    const fileInfos = await getFileInfos([latestPlayHistoryRecord.Songs.filepath], {
      includePicture: false
    })

    return fileInfos.length > 0 ? fileInfos[0] : null
  } catch (error) {
    console.error('Error retrieving latest play history record:', error)
    return { success: false, error: error.message }
  }
}
function normalizeSearchQuery(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().replace(/\s+/g, ' ')
}

function normalizeSearchText(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function compactSearchText(value) {
  return normalizeSearchText(value).replace(/\s+/g, '')
}

function parseArtistTitleFromFilename(filename) {
  if (typeof filename !== 'string' || !filename.includes(' - ')) {
    return { artist: '', title: '' }
  }

  const [artistPart, ...titleParts] = filename.split(' - ')
  const artist = artistPart?.trim() || ''
  const title = titleParts.join(' - ').trim()

  if (!artist || !title) {
    return { artist: '', title: '' }
  }

  return { artist, title }
}

function createQueryInfo(query) {
  const normalized = normalizeSearchText(query)
  const compact = compactSearchText(query)

  return {
    raw: query,
    normalized,
    compact
  }
}

function normalizePlaybackNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

async function recordPlaybackStats(payload = {}) {
  const filePath = payload?.filePath
  const fileName = payload?.fileName
  const eventType = String(payload?.eventType || '')

  if (!filePath || !PLAYBACK_EVENT_TYPES.has(eventType)) {
    return { success: false, error: 'Invalid playback payload' }
  }

  const song = await getOrCreateSong(filePath, fileName || '')
  const duration = normalizePlaybackNumber(payload?.duration, Number(song.duration) || 0)
  const activeListeningSeconds = normalizePlaybackNumber(payload?.activeListeningSeconds, 0)
  const shouldCreateHistory = Boolean(payload?.shortViewAwarded || payload?.longViewAwarded)
  const isConsecutiveRepeat =
    eventType === 'playback-finalize' && shouldCreateHistory
      ? lastRecordedPlaybackSongId === song.song_id
      : false
  const updateData = {}
  const createData = { song_id: song.song_id }
  let shouldCreatePlayHistory = false

  if (eventType === 'skip-award') {
    updateData.skip_count = { increment: 1 }
    createData.skip_count = 1
  }

  if (eventType === 'short-view-award') {
    updateData.short_view_count = { increment: 1 }
    updateData.play_count = { increment: 1 }
    createData.short_view_count = 1
    createData.play_count = 1
  }

  if (eventType === 'long-view-award') {
    updateData.long_view_count = { increment: 1 }
    updateData.long_play_seconds = { increment: duration }
    createData.long_view_count = 1
    createData.long_play_seconds = duration
  }

  if (eventType === 'playback-finalize') {
    updateData.active_listening_seconds = { increment: activeListeningSeconds }
    createData.active_listening_seconds = activeListeningSeconds
    shouldCreatePlayHistory = shouldCreateHistory
  }

  if (isConsecutiveRepeat) {
    updateData.consecutive_repeat_count = { increment: 1 }
    createData.consecutive_repeat_count = 1
  }

  await prisma.$transaction(async (tx) => {
    await tx.userPreferences.upsert({
      where: { song_id: song.song_id },
      update: updateData,
      create: createData
    })

    if (shouldCreatePlayHistory) {
      await tx.playHistory.create({
        data: {
          song_id: song.song_id
        }
      })
    }
  })

  if (eventType === 'playback-finalize' && shouldCreateHistory) {
    lastRecordedPlaybackSongId = song.song_id
  }

  const stats = await prisma.userPreferences.findUnique({
    where: { song_id: song.song_id },
    select: STAT_SELECT
  })

  return {
    success: true,
    songId: song.song_id,
    eventType,
    isConsecutiveRepeat,
    stats
  }
}

function getFieldMatchScore(value, queryInfo) {
  const normalizedValue = normalizeSearchText(value)

  if (!normalizedValue || !queryInfo.normalized) {
    return null
  }

  if (normalizedValue === queryInfo.normalized) {
    return 0
  }

  if (normalizedValue.startsWith(queryInfo.normalized)) {
    return 1
  }

  if (normalizedValue.includes(queryInfo.normalized)) {
    return 2
  }

  const compactValue = compactSearchText(value)

  if (!compactValue || !queryInfo.compact) {
    return null
  }

  if (compactValue === queryInfo.compact) {
    return 3
  }

  if (compactValue.startsWith(queryInfo.compact)) {
    return 4
  }

  if (compactValue.includes(queryInfo.compact)) {
    return 5
  }

  return null
}

function getSongSearchMatch(song, queryInfo, filters) {
  const parsedFromFilename = parseArtistTitleFromFilename(song.filename || '')
  const title = String(song.title || '')
  const filename = String(song.filename || '')
  const artist = String(song.artist || '')

  const candidateScores = []

  if (filters.name) {
    candidateScores.push(
      getFieldMatchScore(title, queryInfo),
      getFieldMatchScore(parsedFromFilename.title, queryInfo) != null
        ? getFieldMatchScore(parsedFromFilename.title, queryInfo) + 10
        : null,
      getFieldMatchScore(filename, queryInfo) != null
        ? getFieldMatchScore(filename, queryInfo) + 20
        : null,
      getFieldMatchScore(`${artist} ${title}`, queryInfo) != null
        ? getFieldMatchScore(`${artist} ${title}`, queryInfo) + 30
        : null,
      getFieldMatchScore(`${parsedFromFilename.artist} ${parsedFromFilename.title}`, queryInfo) != null
        ? getFieldMatchScore(`${parsedFromFilename.artist} ${parsedFromFilename.title}`, queryInfo) + 40
        : null
    )
  }

  if (filters.artist) {
    candidateScores.push(
      getFieldMatchScore(artist, queryInfo) != null ? getFieldMatchScore(artist, queryInfo) + 50 : null,
      getFieldMatchScore(parsedFromFilename.artist, queryInfo) != null
        ? getFieldMatchScore(parsedFromFilename.artist, queryInfo) + 60
        : null
    )
  }

  const priority = candidateScores
    .filter((score) => score != null)
    .sort((left, right) => left - right)[0]

  return {
    matches: priority != null,
    priority: priority ?? Number.POSITIVE_INFINITY
  }
}

async function searchSongsPage(request = {}) {
  const query = normalizeSearchQuery(request?.query)
  const page = Math.max(Number(request?.page) || 1, 1)
  const pageSize = Math.min(Math.max(Number(request?.pageSize) || 50, 1), 100)
  const filters = {
    name: request?.filters?.name !== false,
    artist: request?.filters?.artist !== false
  }

  if (!query || (!filters.name && !filters.artist)) {
    return {
      items: [],
      page,
      pageSize,
      total: 0,
      hasMore: false
    }
  }

  const offset = (page - 1) * pageSize
  const queryInfo = createQueryInfo(query)

  try {
    const songs = await prisma.songs.findMany({
      include: {
        UserPreferences: {
          select: STAT_SELECT
        }
      }
    })

    const matchedSongs = songs
      .map((song) => ({
        song,
        match: getSongSearchMatch(song, queryInfo, filters)
      }))
      .filter(({ match }) => match.matches)
      .sort((left, right) => {
        if (left.match.priority !== right.match.priority) {
          return left.match.priority - right.match.priority
        }

        const leftName = normalizeSearchText(left.song.title || left.song.filename || '')
        const rightName = normalizeSearchText(right.song.title || right.song.filename || '')

        if (leftName !== rightName) {
          return leftName.localeCompare(rightName)
        }

        const leftArtist = normalizeSearchText(left.song.artist || '')
        const rightArtist = normalizeSearchText(right.song.artist || '')

        if (leftArtist !== rightArtist) {
          return leftArtist.localeCompare(rightArtist)
        }

        return left.song.song_id - right.song.song_id
      })
      .map(({ song }) => song)

    const total = matchedSongs.length
    const paginatedSongs = matchedSongs.slice(offset, offset + pageSize)
    const items = Array.isArray(paginatedSongs)
      ? paginatedSongs.map((song) => ({
          song_id: song.song_id,
          filePath: song.filepath,
          fileName: song.title || song.filename,
          artist: song.artist || '',
          album: song.album || '',
          genre: song.genre || '',
          year: song.year || 0,
          duration: Number(song.duration) || 0,
          size: song.size || 0,
          trackNumber: song.trackNumber || 0,
          metadataLoaded: Boolean(song.metadataLoaded),
          skip_count: Number(song.UserPreferences?.[0]?.skip_count) || 0,
          short_view_count: Number(song.UserPreferences?.[0]?.short_view_count) || 0,
          long_view_count: Number(song.UserPreferences?.[0]?.long_view_count) || 0,
          long_play_seconds: Number(song.UserPreferences?.[0]?.long_play_seconds) || 0,
          active_listening_seconds:
            Number(song.UserPreferences?.[0]?.active_listening_seconds) || 0,
          consecutive_repeat_count:
            Number(song.UserPreferences?.[0]?.consecutive_repeat_count) || 0
        }))
      : []

    return {
      items,
      page,
      pageSize,
      total: Number(total || 0),
      hasMore: offset + items.length < total
    }
  } catch (error) {
    console.error('Error searching songs page:', error)
    throw error
  }
}

export function setupLikeSongHandlers() {
  ipcMain.handle('like-song', async (event, common) => {
    try {
      console.debug(common.fileName)
      const song = await getOrCreateSong(common.filePath, common.fileName)
      await markUserPreference(song.song_id, 'is_favorite')

      return { success: true, songId: song.song_id }
    } catch (error) {
      console.error('Error liking song:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('is-song-liked', async (event, filepath, filename) => {
    try {
      const song = await getOrCreateSong(filepath, filename)
      const liked = await isSongLiked(song.song_id)

      return { success: true, liked }
    } catch (error) {
      console.error('Error checking if song is liked:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('add-history', async (event, filepath, filename) => {
    try {
      const song = await getOrCreateSong(filepath, filename)
      await addPlayHistory(song.song_id)

      return { success: true, songId: song.song_id }
    } catch (error) {
      console.error('Error liking song:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('playback:record', async (event, payload) => {
    try {
      return await recordPlaybackStats(payload)
    } catch (error) {
      console.error('Error recording playback stats:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('unlike-song', (event, common) => {
    return updateSongPreference(common.filePath, async (songId) => {
      await prisma.userPreferences.update({
        where: { song_id: songId },
        data: { is_favorite: false }
      })
    })
  })

  ipcMain.handle('get-likes', async (event) => {
    return await getUserPreferencesByCriteria({ is_favorite: true })
  })

  ipcMain.handle('get-likes-number', async (event) => {
    try {
      // Obtener la cantidad total de preferencias de usuario que cumplen con el criterio
      const totalLikes = await prisma.userPreferences.count({
        where: { is_favorite: true }
      })

      return totalLikes // Devolver solo el número total de likes
    } catch (error) {
      console.error('Error retrieving likes:', error)
      throw error
    }
  })

  ipcMain.handle('listen-later-song', async (event, filepath, filename) => {
    try {
      // Obtén o crea la canción
      const song = await getOrCreateSong(filepath, filename)

      await markUserPreference(song.song_id, 'listen_later')

      return { success: true, songId: song.song_id }
    } catch (error) {
      console.error('Error adding song to listen later:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('get-listen-later', async (event) => {
    return getUserPreferencesByCriteria({ listen_later: true })
  })

  ipcMain.handle('get-history', async (event, page) => {
    return getPlayHistoryOrdered(page)
  })

  ipcMain.handle('get-recents', async (event) => {
    const likes = await getRecentHistoryOrdered()
    return likes.slice(0, 5) // Mostrar solo los primeros 5 elementos únicos
  })

  ipcMain.handle('get-lastest', async (event) => {
    return getLatestPlayHistoryRecord()
  })

  ipcMain.handle('get-most-played', async (event) => {
    const paths = await getMostPlayedSongsWithDetails()
    return getFileInfos(paths, { includePicture: false })
  })

  ipcMain.handle('statistics:get-rankings', async (event, request) => {
    try {
      return await getStatisticsRankings(request)
    } catch (error) {
      console.error('Error retrieving statistics rankings:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('remove-listen-later', (event, filepath, filename) => {
    return updateSongPreference(filepath, async (songId) => {
      // Actualizar el estado "Listen Later"
      await prisma.userPreferences.update({
        where: { song_id: songId },
        data: { listen_later: false }
      })
    })
  })
}

export function setupMusicHandlers() {
  ipcMain.handle('get-bpm', async (event, common) => {
    try {
      const { filePath, fileName } = common
      const fileInfo = await getSongBpm(common)

      console.log('recibido[getbpm-Handler]', fileInfo.bpm) // Verifica que fileInfo.bpm tenga el valor correcto

      const song = await getOrCreateSong(filePath, fileName)
      await markUserPreference(song.song_id, 'bpm', parseInt(fileInfo.bpm))

      return fileInfo
    } catch (error) {
      console.error(`Error in get-bpm handler:`, error)
      throw error
    }
  })

  ipcMain.handle('search-songs-page', async (event, request) => {
    return searchSongsPage(request)
  })
}
