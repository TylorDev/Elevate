import { afterEach, describe, expect, it } from 'vitest'

import {
  appendUniqueTracks,
  normalizeQueue,
} from '../../../src/renderer/src/Contexts/QueueContext/queueUtils.ts'
import { createDisplayedQueue, removeTrackFromQueue } from '../../../src/renderer/src/Contexts/QueueContext/queueState.ts'
import {
  EMPTY_QUEUE_STATE,
  readStorageValue
} from '../../../src/renderer/src/Contexts/QueueContext/queueStorage.ts'

const createTrack = (filePath) => ({
  filePath,
  fileName: filePath.split('\\').pop(),
  title: filePath,
  artist: null
})

const originalLocalStorage = globalThis.localStorage

afterEach(() => {
  if (originalLocalStorage === undefined) {
    delete globalThis.localStorage
  } else {
    globalThis.localStorage = originalLocalStorage
  }
})

describe('QueueContext queue helpers', () => {
  it('uses the fallback when persisted data is corrupt', () => {
    globalThis.localStorage = {
      getItem: () => '{invalid json',
      setItem: () => undefined
    }

    expect(readStorageValue('queueState', EMPTY_QUEUE_STATE, normalizeQueue)).toEqual(
      EMPTY_QUEUE_STATE
    )
  })

  it('normalizes empty and invalid queue values', () => {
    expect(normalizeQueue(undefined)).toEqual([])
    expect(normalizeQueue([createTrack('one.mp3'), {}, null])).toEqual([createTrack('one.mp3')])
  })

  it('deduplicates incoming tracks against the existing queue and each other', () => {
    const existing = [createTrack('one.mp3')]
    const incoming = [createTrack('one.mp3'), createTrack('two.mp3'), createTrack('two.mp3')]

    expect(appendUniqueTracks(existing, incoming)).toEqual([createTrack('two.mp3')])
  })

  it('keeps the active track first when creating a shuffled queue', () => {
    const first = createTrack('one.mp3')
    const second = createTrack('two.mp3')
    const third = createTrack('three.mp3')

    expect(createDisplayedQueue([first, second, third], true, second)[0]).toBe(second)
  })

  it('updates the active file and index when removing the current track', () => {
    const first = createTrack('one.mp3')
    const second = createTrack('two.mp3')
    const third = createTrack('three.mp3')
    const state = {
      currentQueue: [first, second, third],
      originalQueue: [first, second, third],
      queueName: 'test'
    }

    const result = removeTrackFromQueue(state, second, 1, 1)

    expect(result.currentFile).toBe(third)
    expect(result.currentIndex).toBe(1)
    expect(result.queueState.currentQueue).toEqual([first, third])
    expect(result.queueState.originalQueue).toEqual([first, third])
  })

  it('shifts the active index when removing an earlier track', () => {
    const first = createTrack('one.mp3')
    const second = createTrack('two.mp3')
    const third = createTrack('three.mp3')
    const state = {
      currentQueue: [first, second, third],
      originalQueue: [first, second, third],
      queueName: 'test'
    }

    const result = removeTrackFromQueue(state, third, 2, 0)

    expect(result.currentFile).toBe(third)
    expect(result.currentIndex).toBe(1)
  })

  it('clears the active file when the last track is removed', () => {
    const track = createTrack('one.mp3')
    const state = {
      currentQueue: [track],
      originalQueue: [track],
      queueName: 'test'
    }

    const result = removeTrackFromQueue(state, track, 0, 0)

    expect(result.currentFile).toBeNull()
    expect(result.currentIndex).toBe(0)
    expect(result.queueState).toEqual({
      currentQueue: [],
      originalQueue: [],
      queueName: 'test'
    })
  })

  it('returns null for an invalid removal index', () => {
    expect(removeTrackFromQueue(EMPTY_QUEUE_STATE, null, 0, 0)).toBeNull()
  })
})
