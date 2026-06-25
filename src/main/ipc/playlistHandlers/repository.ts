// @ts-nocheck
import path from 'path'
import { prisma } from '../../prisma.ts'
import { deletePlaylistCoverFromCache } from '../utils/utils.ts'
import {
  extractPlaylistName,
  getRandomIndex,
  normalizePlaylistFileName,
  normalizeSearchQuery
} from './shared.ts'

const pendingPlaylistRequests = new Map()
let deletePlaylistJobCounter = 0

export function invalidatePlaylistCache(playlistPath = null) {
  pendingPlaylistRequests.clear()
}

export async function upsertPlaylistMetadataPreservingName(filepath, data) {
  try {
    // Busca la playlist existente para obtener el nombre actual.
    const existingPlaylist = await prisma.playlist.findUnique({
      where: {
        path: filepath
      }
    })

    if (existingPlaylist) {
      // Si la playlist existe, actualizala conservando el nombre actual.
      const updatedPlaylist = await prisma.playlist.update({
        where: {
          path: filepath
        },
        data: {
          ...data,
          nombre: existingPlaylist.nombre // Manten el nombre actual.
        }
      })
      invalidatePlaylistCache(filepath)

      return { success: true, playlist: updatedPlaylist }
    } else {
      // Si la playlist no existe, creala con el nombre y datos proporcionados.
      const newPlaylist = await prisma.playlist.create({
        data: {
          ...data,
          path: filepath // Usa el filepath como identificador unico.
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

export async function updatePlaylist(path, nombre, duracion = 0, numElementos = 0, totalplays = 0) {
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

export async function getPlaylist(filePath) {
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

export async function incrementCounter(playlistId) {
  try {
    // Anadir al historial
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
    // Manejar el error segun sea necesario
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

export function queuePlaylistDelete(filePath, sender) {
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

export async function getPlays(filePath) {
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

async function processPlaylistsBatch(playlists, concurrency = 3, enrichPlaylist = (playlist) => playlist) {
  const results = new Array(playlists.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < playlists.length) {
      const index = nextIndex++
      const playlist = playlists[index]

      try {
        results[index] = await enrichPlaylist(playlist)
      } catch (error) {
        console.error(`Error processing cover for playlist ${playlist.path}:`, error)
        results[index] = await enrichPlaylist(playlist, { coverError: error })
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, playlists.length) }, () => worker())
  await Promise.all(workers)
  return results
}

export async function getPlaylists({ take = null, skip = null } = {}, enrichPlaylist = (playlist) => playlist) {
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
    .then((playlists) => processPlaylistsBatch(playlists, 3, enrichPlaylist))
    .finally(() => {
      pendingPlaylistRequests.delete(requestKey)
    })

  pendingPlaylistRequests.set(requestKey, request)
  return request
}

export async function getPlaylistsMinimal() {
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

export async function getRandomPlaylist(enrichPlaylist = (playlist) => playlist) {
  try {
    const totalPlaylists = await prisma.playlist.count()
    if (totalPlaylists === 0) return null

    const randomIndex = getRandomIndex(totalPlaylists)
    const [randomPlaylist] = await getPlaylists({ take: 1, skip: randomIndex }, enrichPlaylist)

    return randomPlaylist
  } catch (error) {
    console.error('Error fetching random playlist:', error)
    return null
  }
}

export async function getPlaylistsNumber() {
  try {
    const totalPlaylists = await prisma.playlist.count()
    return totalPlaylists // Devuelve solo el numero total de playlists
  } catch (error) {
    console.error('Error retrieving playlists count:', error)
    throw error
  }
}

export async function createPlaylistRecord(filePath, playlistName, totalTracks, totalDuration = 0) {
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

export async function findPlaylistByNameInsensitive(playlistName) {
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

export async function findPlaylistsByNameInsensitive(playlistName) {
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

export async function playlistNameExistsInDatabase(playlistName, filePath = null) {
  const conflictingPlaylist = await findPlaylistByNameInsensitive(playlistName)

  if (!conflictingPlaylist) {
    return false
  }

  if (filePath && conflictingPlaylist.path === filePath) {
    return false
  }

  return true
}

export async function playlistPathExistsInDatabase(filePath) {
  if (!filePath) {
    return false
  }

  const conflictingPlaylist = await prisma.playlist.findUnique({
    where: { path: path.resolve(filePath) }
  })

  return Boolean(conflictingPlaylist)
}

export async function playlistIdentityExistsInDatabase(playlistName, filePath) {
  const [conflictingName, conflictingPath] = await Promise.all([
    playlistNameExistsInDatabase(playlistName),
    playlistPathExistsInDatabase(filePath)
  ])

  return conflictingName || conflictingPath
}

export async function searchPlaylistsPage(request = {}, enrichPlaylist = (playlist) => playlist) {
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
      const enrichedPlaylist = await enrichPlaylist(playlist)

      return ({
      type: 'playlist',
      id: playlist.id,
      title: playlist.nombre,
      subtitle: `${playlist.numElementos} tracks`,
      meta: playlist.path,
      actionPayload: {
        path: playlist.path
      },
      cover: enrichedPlaylist.effectiveCover,
      effectiveCover: enrichedPlaylist.effectiveCover,
      coverConfig: enrichedPlaylist.coverConfig,
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

export async function getPlaylistByPathOrNull(filePath) {
  return prisma.playlist.findUnique({
    where: { path: filePath }
  })
}

export function getPlaylistNameFromPath(filePath) {
  return extractPlaylistName(filePath)
}
