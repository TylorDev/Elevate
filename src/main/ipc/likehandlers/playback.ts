import { getOrCreateSong } from '../../utils/utils.ts'
import { prisma } from '../../prisma.ts'
import {
  PLAYBACK_EVENT_TYPES,
  STAT_SELECT
} from './shared.ts'
import type { Prisma, PrismaClient, Songs } from '../../generated/prisma/client.ts'
import type {
  PlaybackEventType,
  PlaybackIncrementUpdate,
  PlaybackPreferenceCreate,
  PlaybackRecordPayload,
  PlaybackRecordResult
} from '../../Types/likeHandlers.ts'

const db = prisma as unknown as PrismaClient
const getSong = getOrCreateSong as (
  filepath?: string | null,
  filename?: string | null
) => Promise<Songs>

function normalizePlaybackNumber(value: unknown, fallback = 0): number {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

function normalizePlaybackEventType(value: unknown): PlaybackEventType | null {
  const eventType = String(value || '')
  return PLAYBACK_EVENT_TYPES.has(eventType as PlaybackEventType)
    ? (eventType as PlaybackEventType)
    : null
}

export async function recordPlaybackStats(
  payload: PlaybackRecordPayload = {}
): Promise<PlaybackRecordResult> {
  const filePath = payload?.filePath
  const fileName = payload?.fileName
  const eventType = normalizePlaybackEventType(payload?.eventType)

  if (!filePath || !eventType) {
    return { success: false, error: 'Invalid playback payload' }
  }

  const song = await getSong(filePath, fileName || '')
  const duration = normalizePlaybackNumber(payload?.duration, Number(song.duration) || 0)
  const activeListeningSeconds = normalizePlaybackNumber(payload?.activeListeningSeconds, 0)
  const countAsRepeat =
    eventType === 'playback-finalize' && Boolean(payload?.countAsRepeat)
  const updateData: PlaybackIncrementUpdate = {}
  const createData: PlaybackPreferenceCreate = { song_id: song.song_id }
  let shouldCreatePlayHistory = false
  let createdPlayHistoryAt: string | null = null

  if (eventType === 'skip-award') {
    updateData.skip_count = { increment: 1 }
    createData.skip_count = 1
  }

  if (eventType === 'short-view-award') {
    updateData.short_view_count = { increment: 1 }
    updateData.play_count = { increment: 1 }
    createData.short_view_count = 1
    createData.play_count = 1
    shouldCreatePlayHistory = true
  }

  if (eventType === 'long-view-award') {
    updateData.long_view_count = { increment: 1 }
    updateData.long_play_seconds = { increment: duration }
    createData.long_view_count = 1
    createData.long_play_seconds = duration
  }

  if (eventType === 'repeat-award') {
    updateData.consecutive_repeat_count = { increment: 1 }
    createData.consecutive_repeat_count = 1
  }

  if (eventType === 'playback-finalize') {
    updateData.active_listening_seconds = { increment: activeListeningSeconds }
    createData.active_listening_seconds = activeListeningSeconds
  }

  if (countAsRepeat) {
    updateData.consecutive_repeat_count = { increment: 1 }
    createData.consecutive_repeat_count = 1
  }

  await db.$transaction(async (tx) => {
    await tx.userPreferences.upsert({
      where: { song_id: song.song_id },
      update: updateData as Prisma.UserPreferencesUncheckedUpdateInput,
      create: createData as Prisma.UserPreferencesUncheckedCreateInput
    })

    if (shouldCreatePlayHistory) {
      const historyRecord = await tx.playHistory.create({
        data: {
          song_id: song.song_id
        }
      })
      createdPlayHistoryAt = historyRecord.timestamp?.toISOString?.() || null
    }
  })

  const stats = await db.userPreferences.findUnique({
    where: { song_id: song.song_id },
    select: STAT_SELECT
  })

  return {
    success: true,
    songId: song.song_id,
    eventType,
    isConsecutiveRepeat: countAsRepeat,
    stats: {
      ...(stats || {}),
      ...(createdPlayHistoryAt ? { lastPlayedAt: createdPlayHistoryAt } : {})
    }
  }
}
