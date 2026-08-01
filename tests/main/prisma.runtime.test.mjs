import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createPrismaTestContext, importFreshProject } from './helpers/runtime.mjs'

let context = null

afterEach(async () => {
  if (context) {
    await context.cleanup()
    context = null
  }
})

describe('main prisma runtime', () => {
  it('initializes against an isolated SQLite database and supports core Prisma operations', async () => {
    const devDbPath = path.join(process.cwd(), 'prisma', 'dev.db')
    const beforeDevDbMtime = fs.existsSync(devDbPath) ? fs.statSync(devDbPath).mtimeMs : null

    context = await createPrismaTestContext()
    const { client, prismaModule } = context

    expect(prismaModule.getPrismaStatus()).toMatchObject({
      isInitializing: false,
      isReady: true,
      error: null
    })
    expect(path.normalize(context.databasePath)).not.toBe(path.normalize(devDbPath))

    const firstSong = await prismaModule.getPrismaClient().songs.create({
      data: {
        filepath: path.join(context.root, 'first.mp3'),
        filename: 'first',
        title: 'First',
        duration: 42,
        metadataLoaded: true
      }
    })
    await prismaModule.getPrismaClient().userPreferences.upsert({
      where: { song_id: firstSong.song_id },
      update: { is_favorite: true },
      create: { song_id: firstSong.song_id, is_favorite: true }
    })

    const found = await prismaModule.getPrismaClient().songs.findUnique({
      where: { filepath: firstSong.filepath }
    })
    const songs = await prismaModule.getPrismaClient().songs.findMany()
    const [secondSong] = await client.$transaction([
      client.songs.create({
        data: {
          filepath: path.join(context.root, 'second.mp3'),
          filename: 'second',
          title: 'Second',
          metadataLoaded: true
        }
      })
    ])

    expect(found.title).toBe('First')
    expect(songs).toHaveLength(1)
    expect(secondSong.song_id).toBeGreaterThan(firstSong.song_id)

    const afterDevDbMtime = fs.existsSync(devDbPath) ? fs.statSync(devDbPath).mtimeMs : null
    expect(afterDevDbMtime).toBe(beforeDevDbMtime)
  })

  it('preserves records when reopening an existing database', async () => {
    context = await createPrismaTestContext()
    const existingPath = path.join(context.root, 'existing.mp3')
    await context.client.songs.create({
      data: {
        filepath: existingPath,
        filename: 'existing',
        title: 'Existing record',
        metadataLoaded: true
      }
    })
    await context.prismaModule.disconnectPrisma()
    const reopenedClient = await context.prismaModule.initializePrisma()
    const existingRecord = await reopenedClient.songs.findUnique({
      where: { filepath: existingPath }
    })

    expect(existingRecord).toMatchObject({
      filepath: existingPath,
      title: 'Existing record'
    })
    await context.prismaModule.disconnectPrisma()
  })

  it('shares concurrent initialization and can reconnect in the same module', async () => {
    context = await createPrismaTestContext()
    await context.prismaModule.disconnectPrisma()

    const firstInitialization = context.prismaModule.initializePrisma()
    const secondInitialization = context.prismaModule.initializePrisma()
    const [firstClient, secondClient] = await Promise.all([
      firstInitialization,
      secondInitialization
    ])

    expect(firstInitialization).toBe(secondInitialization)
    expect(firstClient).toBe(secondClient)
    expect(context.prismaModule.getPrismaClient()).toBe(firstClient)
  })

  it('clears a rejected initialization so a later attempt can succeed', async () => {
    context = await createPrismaTestContext()
    await context.prismaModule.disconnectPrisma()
    const originalDatabaseUrl = process.env.DATABASE_URL
    process.env.DATABASE_URL = 'https://remote.example/elevate'

    await expect(context.prismaModule.initializePrisma()).rejects.toMatchObject({
      code: 'DATABASE_URL_UNSUPPORTED'
    })
    expect(context.prismaModule.getPrismaStatus()).toMatchObject({
      phase: 'failed',
      isReady: false
    })

    process.env.DATABASE_URL = originalDatabaseUrl
    const recoveredClient = await context.prismaModule.initializePrisma()
    expect(recoveredClient).toBe(context.prismaModule.getPrismaClient())
    expect(context.prismaModule.getPrismaStatus().phase).toBe('ready')
  })

  it('does not publish a late client when disconnect races initialization', async () => {
    context = await createPrismaTestContext()
    await context.prismaModule.disconnectPrisma()

    const initialization = context.prismaModule.initializePrisma()
    const disconnection = context.prismaModule.disconnectPrisma()
    await Promise.allSettled([initialization, disconnection])

    expect(context.prismaModule.getPrismaStatus()).toMatchObject({
      phase: 'idle',
      isReady: false,
      isInitializing: false
    })
    expect(() => context.prismaModule.getPrismaClient()).toThrow('database is not ready')
  })

  it('keeps playlist and playback counters atomic under concurrent writes', async () => {
    context = await createPrismaTestContext()
    const playlistRepository = await importFreshProject(
      'src/main/ipc/playlistHandlers/repository.ts'
    )
    const playback = await importFreshProject('src/main/ipc/likehandlers/playback.ts')
    const playlist = await context.client.playlist.create({
      data: {
        path: path.join(context.root, 'concurrent.m3u'),
        nombre: 'Concurrent writes'
      }
    })

    await Promise.all(
      Array.from({ length: 12 }, () => playlistRepository.incrementCounter(playlist.id))
    )

    const audioPath = path.join(context.root, 'concurrent.mp3')
    await Promise.all(
      Array.from({ length: 12 }, () =>
        playback.recordPlaybackStats({
          filePath: audioPath,
          fileName: 'concurrent.mp3',
          eventType: 'skip-award'
        })
      )
    )

    const [updatedPlaylist, historyCount, song] = await Promise.all([
      context.client.playlist.findUniqueOrThrow({ where: { id: playlist.id } }),
      context.client.historial.count({ where: { playlistId: playlist.id } }),
      context.client.songs.findUniqueOrThrow({ where: { filepath: audioPath } })
    ])
    const preferences = await context.client.userPreferences.findUniqueOrThrow({
      where: { song_id: song.song_id }
    })

    expect(updatedPlaylist.totalplays).toBe(12)
    expect(historyCount).toBe(12)
    expect(preferences.skip_count).toBe(12)
  })
})
