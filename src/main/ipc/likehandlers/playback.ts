// @ts-nocheck
import { getOrCreateSong } from '../utils/utils.ts'
import { prisma } from '../../prisma.ts'
import {
  PLAYBACK_EVENT_TYPES,
  STAT_SELECT
} from './shared.ts'

function normalizePlaybackNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

export async function recordPlaybackStats(payload = {}) {
  const filePath = payload?.filePath
  const fileName = payload?.fileName
  const eventType = String(payload?.eventType || '')

  if (!filePath || !PLAYBACK_EVENT_TYPES.has(eventType)) {
    return { success: false, error: 'Invalid playback payload' }
  }

  const song = await getOrCreateSong(filePath, fileName || '')
  const duration = normalizePlaybackNumber(payload?.duration, Number(song.duration) || 0)
  const activeListeningSeconds = normalizePlaybackNumber(payload?.activeListeningSeconds, 0)
  const countAsRepeat =
    eventType === 'playback-finalize' && Boolean(payload?.countAsRepeat)
  const updateData = {}
  const createData = { song_id: song.song_id }
  let shouldCreatePlayHistory = false
  let createdPlayHistoryAt = null

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

  await prisma.$transaction(async (tx) => {
    await tx.userPreferences.upsert({
      where: { song_id: song.song_id },
      update: updateData,
      create: createData
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

  const stats = await prisma.userPreferences.findUnique({
    where: { song_id: song.song_id },
    select: STAT_SELECT
  })

  return {
    success: true,
    songId: song.song_id,
    eventType,
    isConsecutiveRepeat: countAsRepeat,
    stats: {
      ...stats,
      ...(createdPlayHistoryAt ? { lastPlayedAt: createdPlayHistoryAt } : {})
    }
  }
}
