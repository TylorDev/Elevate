import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createPrismaTestContext } from './helpers/runtime.mjs'

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

    const firstSong = await prismaModule.prisma.songs.create({
      data: {
        filepath: path.join(context.root, 'first.mp3'),
        filename: 'first',
        title: 'First',
        duration: 42,
        metadataLoaded: true
      }
    })
    await prismaModule.prisma.userPreferences.upsert({
      where: { song_id: firstSong.song_id },
      update: { is_favorite: true },
      create: { song_id: firstSong.song_id, is_favorite: true }
    })

    const found = await prismaModule.prisma.songs.findUnique({
      where: { filepath: firstSong.filepath }
    })
    const songs = await prismaModule.prisma.songs.findMany()
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
})
