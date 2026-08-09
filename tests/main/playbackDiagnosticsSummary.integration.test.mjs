import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { createPrismaTestContext, importFreshProject, seedSong } from './helpers/runtime.mjs'

let context

afterEach(async () => {
  await context?.cleanup()
  context = null
})

describe('playback diagnostics database summary', () => {
  it('keeps duplicate requests observable without changing the current counting behavior', async () => {
    context = await createPrismaTestContext()
    const filePath = path.join(context.root, 'duplicate.mp3')
    const song = await seedSong(context.client, { filepath: filePath })
    const { recordPlaybackStats } = await importFreshProject(
      'src/main/ipc/likehandlers/playback.ts'
    )
    const sessionId = crypto.randomUUID()
    const cycleId = crypto.randomUUID()
    const basePayload = {
      filePath,
      fileName: 'duplicate.mp3',
      eventType: 'short-view-award',
      sessionId,
      cycleId,
      cycleSequence: 1,
      eventSequence: 1,
      occurredAt: new Date().toISOString()
    }

    await recordPlaybackStats({ ...basePayload, requestId: crypto.randomUUID() })
    await recordPlaybackStats({ ...basePayload, requestId: crypto.randomUUID(), eventSequence: 2 })

    const [stats, historyCount] = await Promise.all([
      context.client.userPreferences.findUnique({ where: { song_id: song.song_id } }),
      context.client.playHistory.count({ where: { song_id: song.song_id } })
    ])
    expect(stats.short_view_count).toBe(2)
    expect(stats.play_count).toBe(2)
    expect(historyCount).toBe(2)
  })

  it('matches Prisma counters and first/last history timestamps for the top tracks', async () => {
    context = await createPrismaTestContext()
    const first = await seedSong(context.client, {
      filepath: path.join(context.root, 'top.mp3'),
      duration: 180,
      preference: {
        short_view_count: 51,
        play_count: 51,
        long_view_count: 4,
        consecutive_repeat_count: 3
      }
    })
    await seedSong(context.client, {
      filepath: path.join(context.root, 'second.mp3'),
      preference: { short_view_count: 6, play_count: 6 }
    })
    const firstAt = new Date('2026-08-08T10:00:00.000Z')
    const lastAt = new Date('2026-08-09T11:30:00.000Z')
    await context.client.playHistory.createMany({
      data: [
        { song_id: first.song_id, timestamp: firstAt },
        { song_id: first.song_id, timestamp: lastAt }
      ]
    })

    const { buildPlaybackDiagnosticsSummary } = await importFreshProject(
      'src/main/diagnostics/playbackExport.ts'
    )
    const summary = await buildPlaybackDiagnosticsSummary()

    expect(summary.tracks).toHaveLength(2)
    expect(summary.tracks[0]).toMatchObject({
      song_id: first.song_id,
      filePath: first.filepath,
      short_view_count: 51,
      play_count: 51,
      long_view_count: 4,
      consecutive_repeat_count: 3,
      playHistoryCount: 2,
      firstPlayHistoryAt: firstAt.toISOString(),
      lastPlayHistoryAt: lastAt.toISOString()
    })
    expect(summary.tracks[1].short_view_count).toBe(6)
  })
})
