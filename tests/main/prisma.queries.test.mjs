import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createPrismaTestContext, importFreshProject, seedSong } from './helpers/runtime.mjs'

let context = null

afterEach(async () => {
  if (context) {
    await context.cleanup()
    context = null
  }
})

describe('main query helpers', () => {
  it('creates song metadata defaults and resolves last played timestamps', async () => {
    context = await createPrismaTestContext()
    const utils = await importFreshProject('src/main/ipc/utils/utils.ts')
    const filePath = path.join(context.root, 'unparseable.mp3')
    await fs.promises.writeFile(filePath, Buffer.from('not-a-real-mp3'))

    const song = await utils.getOrCreateSong(filePath, 'unparseable')
    const loadedSong = await context.client.songs.findUnique({
      where: { song_id: song.song_id },
      include: { UserPreferences: true }
    })
    const timestamp = new Date('2026-01-02T03:04:05.000Z')
    await context.client.playHistory.create({
      data: { song_id: song.song_id, timestamp }
    })

    const lastPlayed = await utils.getLastPlayedAtBySongId([song.song_id, song.song_id, 999, null])

    expect(loadedSong.metadataLoaded).toBe(true)
    expect(loadedSong.UserPreferences).toHaveLength(1)
    expect(lastPlayed.get(song.song_id)).toBe(timestamp.toISOString())
    expect(lastPlayed.has(999)).toBe(false)
  })

  it('returns likes overview and paged favorite tracks from seeded Prisma data', async () => {
    context = await createPrismaTestContext()
    const favorite = await seedSong(context.client, {
      filepath: path.join(context.root, 'favorite.mp3'),
      filename: 'favorite',
      title: 'Favorite Track',
      duration: 100,
      preference: {
        is_favorite: true,
        short_view_count: 7,
        active_listening_seconds: 80
      }
    })
    await seedSong(context.client, {
      filepath: path.join(context.root, 'other.mp3'),
      filename: 'other',
      preference: { is_favorite: false, short_view_count: 99 }
    })

    const likes = await importFreshProject('src/main/ipc/likehandlers.ts')
    const overview = await likes.getLikesOverview({ page: 1, pageSize: 10 })
    const page = await likes.getLikesTracksPage({ page: 1, pageSize: 1 })

    expect(overview).toMatchObject({
      success: true,
      type: 'likes',
      meta: { title: 'Favourites' },
      summary: {
        totalDuration: 100,
        totalShortViews: 7,
        totalAccumulatedDuration: 80,
        trackCount: 1
      }
    })
    expect(page).toMatchObject({
      page: 1,
      pageSize: 1,
      total: 1,
      hasMore: false
    })
    expect(page.items).toHaveLength(1)
    expect(page.items[0]).toMatchObject({
      song_id: favorite.song_id,
      fileName: 'favorite',
      liked: true
    })
  })

  it('reads playlists from disk and builds overview and paged track responses', async () => {
    context = await createPrismaTestContext()
    const firstPath = path.join(context.root, 'first.mp3')
    const secondPath = path.join(context.root, 'second.mp3')
    const playlistPath = path.join(context.root, 'mix.m3u')
    await fs.promises.writeFile(playlistPath, ['#EXTM3U', 'first.mp3', 'second.mp3'].join('\n'))

    await seedSong(context.client, {
      filepath: firstPath,
      filename: 'first',
      duration: 10,
      preference: { short_view_count: 4 }
    })
    await seedSong(context.client, {
      filepath: secondPath,
      filename: 'second',
      duration: 20,
      preference: { short_view_count: 8 }
    })
    await context.client.playlist.create({
      data: {
        path: playlistPath,
        nombre: 'mix',
        duracion: 30,
        numElementos: 2
      }
    })

    const playlists = await importFreshProject('src/main/ipc/playlistHandlers/index.ts')
    const overview = await playlists.getPlaylistOverview(playlistPath, { page: 1, pageSize: 10 })
    const page = await playlists.getPlaylistTracksPage(playlistPath, { page: 1, pageSize: 1 })

    expect(overview).toMatchObject({
      success: true,
      type: 'playlist',
      meta: {
        title: 'mix',
        sourcePath: playlistPath,
        editable: true
      },
      summary: {
        sourcePath: playlistPath,
        totalDuration: 30,
        totalShortViews: 12,
        trackCount: 2
      }
    })
    expect(page).toMatchObject({
      page: 1,
      pageSize: 1,
      total: 2,
      hasMore: true
    })
    expect(page.items[0].fileName).toBe('first')
  })
})
