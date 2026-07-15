import { describe, expect, it, vi } from 'vitest'

import { createQueuePlaybackActions } from '../../../src/renderer/src/Contexts/QueueContext/queuePlayback.ts'
import {
  isPlaylistListPayload,
  isSuccessfulResponse
} from '../../../src/renderer/src/Contexts/QueueContext/queueUtils.ts'

const createTrack = (filePath) => ({ filePath, fileName: filePath })

describe('QueueContext playback boundary', () => {
  it('validates playlist and mutation responses at the IPC boundary', () => {
    expect(isPlaylistListPayload({ processedData: [createTrack('one.mp3')] })).toBe(true)
    expect(isPlaylistListPayload({ processedData: 'invalid' })).toBe(false)
    expect(isSuccessfulResponse({ success: true, songName: 'One' })).toBe(true)
    expect(isSuccessfulResponse({ success: true, songName: 42 })).toBe(false)
    expect(isSuccessfulResponse({ success: false })).toBe(false)
  })

  it('loads a directory queue and navigates only when requested', async () => {
    const applyBaseQueue = vi.fn()
    const navigate = vi.fn()
    const setCurrentFile = vi.fn()
    const setCurrentIndex = vi.fn()
    const invoke = vi.fn().mockResolvedValue([createTrack('one.mp3')])
    const actions = createQueuePlaybackActions({
      applyBaseQueue,
      invoke,
      navigate,
      setCurrentFile,
      setCurrentIndex
    })

    await expect(actions.openDirectoryQueue('C:\\Music')).resolves.toEqual([
      createTrack('one.mp3')
    ])
    expect(applyBaseQueue).toHaveBeenCalledWith([createTrack('one.mp3')], 'folder:C:\\Music', 0)
    expect(navigate).toHaveBeenCalledWith('/directories/C%3A%5CMusic/false')

    navigate.mockClear()
    await actions.openDirectoryQueue('C:\\Music', { shouldNavigate: false })
    expect(navigate).not.toHaveBeenCalled()
  })

  it('loads playlist tracks and ignores invalid IPC payloads', async () => {
    const applyBaseQueue = vi.fn()
    const navigate = vi.fn()
    const setCurrentFile = vi.fn()
    const setCurrentIndex = vi.fn()
    const invoke = vi.fn().mockResolvedValue({ processedData: [createTrack('one.mp3')] })
    const actions = createQueuePlaybackActions({
      applyBaseQueue,
      invoke,
      navigate,
      setCurrentFile,
      setCurrentIndex
    })

    await actions.handleQueueAndPlay(undefined, undefined, 'playlist.m3u')

    expect(applyBaseQueue).toHaveBeenCalledWith(
      [createTrack('one.mp3')],
      'playlist.m3u',
      0
    )
    expect(setCurrentFile).toHaveBeenCalledWith(createTrack('one.mp3'))
    expect(navigate).toHaveBeenCalledWith('/playlists/playlist.m3u')

    invoke.mockResolvedValueOnce({ success: false, error: 'invalid' })
    applyBaseQueue.mockClear()
    await actions.handleQueueAndPlay(undefined, undefined, 'invalid.m3u')
    expect(applyBaseQueue).not.toHaveBeenCalled()
  })
})
