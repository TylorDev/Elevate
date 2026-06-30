import path from 'path'
import { prisma } from '../../prisma.ts'
import { deletePlaylistCoverFromCache } from '../../utils/utils.ts'
import {
  extractPlaylistName,
  getErrorMessage,
  getRandomIndex,
  normalizePlaylistFileName,
  normalizeSearchQuery
} from './shared.ts'
import type { Playlist, PrismaClient } from '../../generated/prisma/client.ts'
import type {
  EnrichedPlaylist,
  PlaylistDeleteCompletedPayload,
  PlaylistDeleteQueuedResponse,
  PlaylistDeleteResult,
  PlaylistEnricher,
  PlaylistIdentityRecord,
  PlaylistListRequest,
  PlaylistMinimal,
  PlaylistNameRecord,
  PlaylistSearchItem,
  PlaylistSearchPage,
  PlaylistSearchRequest,
  PlaylistSender,
  UpsertPlaylistMetadataInput,
  UpsertPlaylistMetadataResult
} from '../../Types/playlistHandlers.ts'

const db = prisma as unknown as PrismaClient
const pendingPlaylistRequests = new Map<string, Promise<EnrichedPlaylist[]>>()
let deletePlaylistJobCounter = 0

export function invalidatePlaylistCache(): void {
  pendingPlaylistRequests.clear()
}

export async function upsertPlaylistMetadataPreservingName(
  filepath: string,
  data: UpsertPlaylistMetadataInput
): Promise<UpsertPlaylistMetadataResult> {
  try {
    const existingPlaylist = await db.playlist.findUnique({
      where: {
        path: filepath
      }
    })

    if (existingPlaylist) {
      const updatedPlaylist = await db.playlist.update({
        where: {
          path: filepath
        },
        data: {
          ...data,
          nombre: existingPlaylist.nombre
        }
      })
      invalidatePlaylistCache()

      return { success: true, playlist: updatedPlaylist }
    }

    const newPlaylist = await db.playlist.create({
      data: {
        ...data,
        path: filepath
      } as Parameters<typeof db.playlist.create>[0]['data']
    })
    invalidatePlaylistCache()

    return { success: true, playlist: newPlaylist }
  } catch (error) {
    console.error('Error handling playlist in database:', error)
    return { success: false, error: 'Error handling playlist in database.' }
  }
}

export async function updatePlaylist(
  playlistPath: string,
  nombre: string,
  duracion = 0,
  numElementos = 0,
  totalplays = 0
): Promise<Playlist> {
  const playlist = await db.playlist.upsert({
    where: { path: playlistPath },
    update: {
      nombre,
      duracion,
      numElementos,
      totalplays
    },
    create: {
      path: playlistPath,
      nombre,
      duracion,
      numElementos,
      totalplays
    }
  })
  invalidatePlaylistCache()

  return playlist
}

export async function getPlaylist(filePath: string | null | undefined): Promise<Playlist | null> {
  if (!filePath) {
    return null
  }

  try {
    return await db.playlist.findUnique({
      where: { path: filePath }
    })
  } catch (error) {
    console.error('Error getting playlist:', error)
    return null
  }
}

export async function incrementCounter(playlistId: number): Promise<void> {
  try {
    await db.historial.create({
      data: { playlistId }
    })

    await db.playlist.update({
      where: { id: playlistId },
      data: { totalplays: { increment: 1 } }
    })
  } catch (error) {
    console.error('Error updating playlist:', error)
  }
}

function isPrismaRecordNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && Reflect.get(error, 'code') === 'P2025'
}

async function deletePlaylist(filePath: string): Promise<PlaylistDeleteResult> {
  try {
    const existingPlaylist = await db.playlist.findUnique({
      where: { path: filePath },
      select: { customCoverHash: true }
    })

    await db.playlist.delete({
      where: { path: filePath }
    })
    invalidatePlaylistCache()
    await deletePlaylistCoverFromCache(existingPlaylist?.customCoverHash || null)

    return { success: true, path: filePath }
  } catch (error) {
    if (isPrismaRecordNotFound(error)) {
      invalidatePlaylistCache()
      return { success: true, path: filePath, notFound: true }
    }

    console.error('Error deleting playlist:', error)

    return {
      success: false,
      message: 'Error deleting playlist',
      error: getErrorMessage(error, 'Error deleting playlist')
    }
  }
}

export function queuePlaylistDelete(
  filePath: string | null | undefined,
  sender: PlaylistSender
): PlaylistDeleteQueuedResponse {
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    return { success: false, error: 'Invalid playlist path.' }
  }

  const normalizedPath = filePath.trim()
  const jobId = `delete-playlist-${Date.now()}-${++deletePlaylistJobCounter}`

  setImmediate(async () => {
    const result = await deletePlaylist(normalizedPath)
    const payload: PlaylistDeleteCompletedPayload = {
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

export async function getPlays(filePath: string): Promise<number> {
  try {
    const playlist = await getPlaylist(filePath)

    if (!playlist) {
      return 0
    }

    return await db.historial.count({
      where: { playlistId: playlist.id }
    })
  } catch (error) {
    console.error('Error counting playlist occurrences:', error)
    return 0
  }
}

async function processPlaylistsBatch<TOutput>(
  playlists: Playlist[],
  concurrency = 3,
  enrichPlaylist: PlaylistEnricher<Playlist, TOutput>
): Promise<TOutput[]> {
  const results = new Array<TOutput>(playlists.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < playlists.length) {
      const index = nextIndex
      nextIndex += 1
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

export async function getPlaylists<TOutput = EnrichedPlaylist>(
  { take = null, skip = null }: PlaylistListRequest = {},
  enrichPlaylist: PlaylistEnricher<Playlist, TOutput> = ((playlist) => playlist as TOutput)
): Promise<TOutput[]> {
  const requestKey = JSON.stringify({ take, skip })
  const pendingRequest = pendingPlaylistRequests.get(requestKey)

  if (pendingRequest) {
    return pendingRequest as Promise<TOutput[]>
  }

  const options: Parameters<typeof db.playlist.findMany>[0] = {
    orderBy: {
      totalplays: 'desc'
    }
  }

  if (take !== null) options.take = take
  if (skip !== null) options.skip = skip

  const request = db.playlist
    .findMany(options)
    .then((playlists) => processPlaylistsBatch(playlists, 3, enrichPlaylist))
    .finally(() => {
      pendingPlaylistRequests.delete(requestKey)
    })

  pendingPlaylistRequests.set(requestKey, request as Promise<EnrichedPlaylist[]>)
  return request
}

export async function getPlaylistsMinimal(): Promise<PlaylistMinimal[]> {
  const playlists = await db.playlist.findMany({
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

  return playlists.map((playlist) => ({
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

export async function getRandomPlaylist<TOutput = EnrichedPlaylist>(
  enrichPlaylist: PlaylistEnricher<Playlist, TOutput> = ((playlist) => playlist as TOutput)
): Promise<TOutput | null> {
  try {
    const totalPlaylists = await db.playlist.count()
    if (totalPlaylists === 0) return null

    const randomIndex = getRandomIndex(totalPlaylists)
    const [randomPlaylist] = await getPlaylists({ take: 1, skip: randomIndex }, enrichPlaylist)

    return randomPlaylist || null
  } catch (error) {
    console.error('Error fetching random playlist:', error)
    return null
  }
}

export async function getPlaylistsNumber(): Promise<number> {
  try {
    return await db.playlist.count()
  } catch (error) {
    console.error('Error retrieving playlists count:', error)
    throw error
  }
}

export async function createPlaylistRecord(
  filePath: string,
  playlistName: string,
  totalTracks: number,
  totalDuration = 0
): Promise<Playlist> {
  const playlist = await db.playlist.create({
    data: {
      path: filePath,
      nombre: playlistName,
      duracion: totalDuration,
      numElementos: totalTracks,
      totalplays: 0
    }
  })

  invalidatePlaylistCache()
  return playlist
}

export async function findPlaylistByNameInsensitive(
  playlistName: string
): Promise<PlaylistNameRecord | null> {
  const normalizedPlaylistName = normalizePlaylistFileName(playlistName).toLowerCase()
  const playlists = await db.playlist.findMany({
    select: {
      nombre: true,
      path: true
    }
  })

  return (
    playlists.find(
      (playlist) => normalizePlaylistFileName(playlist.nombre).toLowerCase() === normalizedPlaylistName
    ) || null
  )
}

export async function findPlaylistsByNameInsensitive(
  playlistName: string
): Promise<PlaylistIdentityRecord[]> {
  const normalizedPlaylistName = normalizePlaylistFileName(playlistName).toLowerCase()
  const playlists = await db.playlist.findMany({
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

export async function playlistNameExistsInDatabase(
  playlistName: string,
  filePath: string | null = null
): Promise<boolean> {
  const conflictingPlaylist = await findPlaylistByNameInsensitive(playlistName)

  if (!conflictingPlaylist) {
    return false
  }

  if (filePath && conflictingPlaylist.path === filePath) {
    return false
  }

  return true
}

export async function playlistPathExistsInDatabase(filePath: string | null | undefined): Promise<boolean> {
  if (!filePath) {
    return false
  }

  const conflictingPlaylist = await db.playlist.findUnique({
    where: { path: path.resolve(filePath) }
  })

  return Boolean(conflictingPlaylist)
}

export async function playlistIdentityExistsInDatabase(
  playlistName: string,
  filePath: string
): Promise<boolean> {
  const [conflictingName, conflictingPath] = await Promise.all([
    playlistNameExistsInDatabase(playlistName),
    playlistPathExistsInDatabase(filePath)
  ])

  return conflictingName || conflictingPath
}

export async function searchPlaylistsPage<TOutput extends EnrichedPlaylist = EnrichedPlaylist>(
  request: PlaylistSearchRequest = {},
  enrichPlaylist: PlaylistEnricher<Playlist, TOutput> = ((playlist) => playlist as TOutput)
): Promise<PlaylistSearchPage> {
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

  const matchingPlaylists = await db.playlist.findMany({
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

  const items: PlaylistSearchItem[] = await Promise.all(
    pageItems.map(async (playlist) => {
      const enrichedPlaylist = await enrichPlaylist(playlist)

      return {
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
      }
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

export async function getPlaylistByPathOrNull(filePath: string): Promise<Playlist | null> {
  return db.playlist.findUnique({
    where: { path: filePath }
  })
}

export function getPlaylistNameFromPath(filePath: string): string {
  return extractPlaylistName(filePath)
}
