import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPrismaTestContext, createRuntimeContext, importFreshProject } from './helpers/runtime.mjs'

let runtime = null

afterEach(async () => {
  if (runtime) {
    await runtime.cleanup()
    runtime = null
  }
})

describe('main utility behavior', () => {
  it('classifies supported media extensions case-insensitively and materializes mp4 sources as cached mp3 paths', async () => {
    runtime = await createRuntimeContext()
    const media = await importFreshProject('src/main/ipc/utils/mediaFileSupport.ts')
    const sourcePath = path.join(runtime.root, 'Video Source.MP4')
    await fs.promises.writeFile(sourcePath, Buffer.from('fake-video-audio'))

    expect(media.isSupportedAudioFile('track.FLAC')).toBe(true)
    expect(media.isSupportedAudioFile('movie.mp4')).toBe(false)
    expect(media.isSupportedMediaFile('movie.MP4')).toBe(true)
    expect(media.isSupportedMediaFile('cover.jpg')).toBe(false)

    const firstConvertedPath = await media.resolveImportableAudioPath(sourcePath)
    const secondConvertedPath = await media.resolveImportableAudioPath(sourcePath)

    expect(firstConvertedPath).toBe(secondConvertedPath)
    expect(path.extname(firstConvertedPath)).toBe('.mp3')
    expect(fs.existsSync(firstConvertedPath)).toBe(true)
    expect(await fs.promises.readFile(firstConvertedPath, 'utf8')).toBe('fake-video-audio')
  })

  it('builds collection summaries with numeric coercion and stable extras', async () => {
    runtime = await createRuntimeContext()
    const { buildCollectionSummary } = await importFreshProject('src/main/ipc/utils/collectionDetail.ts')
    const { buildCollectionSummaryFromFileInfos, buildRankingPageFromTracks, mapSongRecordToFileInfo } =
      await importFreshProject('src/main/ipc/utils/utils.ts')

    const tracks = [
      {
        duration: '10',
        short_view_count: 3,
        long_view_count: '2',
        active_listening_seconds: '30',
        consecutive_repeat_count: 1,
        skip_count: 'bad'
      },
      {
        duration: 5,
        short_view_count: 7,
        active_listening_seconds: 15,
        skip_count: 2
      }
    ]

    expect(buildCollectionSummary(tracks, { sourcePath: 'library', cover: 'cover-data' })).toMatchObject({
      sourcePath: 'library',
      cover: 'cover-data',
      totalDuration: 15,
      totalShortViews: 10,
      totalLongViews: 2,
      totalAccumulatedDuration: 45,
      totalRepeats: 1,
      totalSkips: 2,
      trackCount: 2
    })
    expect(buildCollectionSummaryFromFileInfos(tracks, { sourcePath: 'likes' })).toMatchObject({
      sourcePath: 'likes',
      totalDuration: 15,
      totalShortViews: 10,
      totalSkips: 2,
      trackCount: 2
    })

    const ranking = buildRankingPageFromTracks(
      [
        { fileName: 'zero', short_view_count: 0 },
        { fileName: 'middle', short_view_count: 4 },
        { fileName: 'top', short_view_count: 9 }
      ],
      'short_view_count',
      { page: 1, pageSize: 1 }
    )
    expect(ranking.items.map((item) => item.fileName)).toEqual(['top'])
    expect(ranking).toMatchObject({ total: 2, totalValue: 13, hasMore: true })

    expect(
      mapSongRecordToFileInfo(
        {
          song_id: 1,
          filepath: 'C:/music/song.mp3',
          filename: 'song',
          duration: '123',
          UserPreferences: [{ is_favorite: true, bpm: 128, skip_count: 2 }]
        },
        { source: 'unit' }
      )
    ).toMatchObject({
      song_id: 1,
      filePath: 'C:/music/song.mp3',
      fileName: 'song',
      duration: 123,
      bpm: 128,
      skip_count: 2,
      liked: true,
      source: 'unit'
    })
  })

  it('returns null for collection cover generation when no cached covers are available', async () => {
    runtime = await createPrismaTestContext()
    const { generateCollectionCoverFromTracks } = await importFreshProject('src/main/ipc/utils/collectionDetail.ts')

    const result = await generateCollectionCoverFromTracks([
      { filePath: 'a.mp3', short_view_count: 1 },
      { filePath: 'a.mp3', short_view_count: 99 },
      { filePath: 'b.mp3', short_view_count: 10 }
    ])

    expect(result).toBeNull()
  })
})
