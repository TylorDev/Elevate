import { getOrCreateSong } from '../../utils/utils.ts'
import { getPrismaClient } from '../../prisma.ts'
import { PLAYBACK_EVENT_TYPES, STAT_SELECT } from './shared.ts'
import type { Prisma, Songs } from '../../generated/prisma/client.ts'
import type {
  PlaybackEventType,
  PlaybackIncrementUpdate,
  PlaybackPreferenceCreate,
  PlaybackRecordPayload,
  PlaybackRecordResult
} from '../../Types/likeHandlers.ts'
import {
  recordPlaybackDatabaseCommit,
  recordPlaybackDatabaseFailure,
  recordPlaybackIpcReceive
} from '../../diagnostics/playbackDiagnostics.ts'

const db = getPrismaClient
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

function normalizeCorrelationId(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, 128) : null
}

function normalizeSequence(value: unknown): number | null {
  const number = Number(value)
  return Number.isSafeInteger(number) && number >= 0 ? number : null
}

function normalizeOccurredAt(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function normalizePlaybackRecordPayload(value: unknown): PlaybackRecordPayload {
  const input = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    filePath: typeof input.filePath === 'string' ? input.filePath : null,
    fileName: typeof input.fileName === 'string' ? input.fileName.slice(0, 4_096) : null,
    eventType: normalizePlaybackEventType(input.eventType),
    duration: normalizePlaybackNumber(input.duration, 0),
    activeListeningSeconds: normalizePlaybackNumber(input.activeListeningSeconds, 0),
    countAsRepeat: input.countAsRepeat === true,
    requestId: normalizeCorrelationId(input.requestId),
    sessionId: normalizeCorrelationId(input.sessionId),
    cycleId: normalizeCorrelationId(input.cycleId),
    cycleSequence: normalizeSequence(input.cycleSequence),
    eventSequence: normalizeSequence(input.eventSequence),
    occurredAt: normalizeOccurredAt(input.occurredAt),
    diagnosticSnapshot:
      input.diagnosticSnapshot && typeof input.diagnosticSnapshot === 'object'
        ? (input.diagnosticSnapshot as PlaybackRecordPayload['diagnosticSnapshot'])
        : null
  }
}

export async function recordPlaybackStats(
  payload: PlaybackRecordPayload = {},
  context: { webContentsId?: number | null } = {}
): Promise<PlaybackRecordResult> {
  const normalizedPayload = normalizePlaybackRecordPayload(payload)
  const filePath = normalizedPayload.filePath
  const fileName = normalizedPayload.fileName
  const eventType = normalizePlaybackEventType(normalizedPayload.eventType)

  recordPlaybackIpcReceive(normalizedPayload, eventType, context.webContentsId)

  if (!filePath || !eventType) {
    recordPlaybackDatabaseFailure(
      normalizedPayload,
      eventType,
      new Error('Invalid playback payload')
    )
    return { success: false, error: 'Invalid playback payload' }
  }

  try {
    const song = await getSong(filePath, fileName || '')
    const duration = normalizePlaybackNumber(normalizedPayload.duration, Number(song.duration) || 0)
    const activeListeningSeconds = normalizePlaybackNumber(
      normalizedPayload.activeListeningSeconds,
      0
    )
    const countAsRepeat =
      eventType === 'playback-finalize' && Boolean(normalizedPayload.countAsRepeat)
    const updateData: PlaybackIncrementUpdate = {}
    const createData: PlaybackPreferenceCreate = { song_id: song.song_id }
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

    const transactionResult = await db().$transaction(async (tx) => {
      const statsBefore = await tx.userPreferences.findUnique({
        where: { song_id: song.song_id },
        select: STAT_SELECT
      })
      const statsAfter = await tx.userPreferences.upsert({
        where: { song_id: song.song_id },
        update: updateData as Prisma.UserPreferencesUncheckedUpdateInput,
        create: createData as Prisma.UserPreferencesUncheckedCreateInput,
        select: STAT_SELECT
      })
      const historyRecord = shouldCreatePlayHistory
        ? await tx.playHistory.create({
            data: {
              song_id: song.song_id
            },
            select: { id: true, timestamp: true }
          })
        : null

      return {
        statsBefore,
        statsAfter,
        playHistory: historyRecord
          ? {
              id: historyRecord.id,
              timestamp: historyRecord.timestamp.toISOString()
            }
          : null
      }
    })
    const requestedDelta = Object.fromEntries(
      Object.entries(updateData).map(([field, operation]) => [field, operation.increment])
    )

    recordPlaybackDatabaseCommit({
      payload: normalizedPayload,
      eventType,
      songId: song.song_id,
      requestedDelta,
      statsBefore: transactionResult.statsBefore,
      statsAfter: transactionResult.statsAfter,
      playHistory: transactionResult.playHistory
    })

    return {
      success: true,
      songId: song.song_id,
      eventType,
      isConsecutiveRepeat: countAsRepeat,
      requestId: normalizedPayload.requestId || null,
      sessionId: normalizedPayload.sessionId || null,
      cycleId: normalizedPayload.cycleId || null,
      stats: {
        ...transactionResult.statsAfter,
        ...(transactionResult.playHistory
          ? { lastPlayedAt: transactionResult.playHistory.timestamp }
          : {})
      }
    }
  } catch (error) {
    recordPlaybackDatabaseFailure(normalizedPayload, eventType, error)
    throw error
  }
}
