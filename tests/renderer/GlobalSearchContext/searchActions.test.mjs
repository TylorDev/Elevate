import { describe, expect, it, vi } from 'vitest'

import { createGlobalSearchActions } from '../../../src/renderer/src/Contexts/GlobalSearchContext/searchActions.ts'

describe('GlobalSearchContext selection actions', () => {
  it('routes selections and closes the search', async () => {
    const closeSearch = vi.fn()
    const navigate = vi.fn()
    const appendToQueueAndPlay = vi.fn()
    const handleQueueAndPlay = vi.fn().mockResolvedValue(undefined)
    const openDirectoryQueue = vi.fn().mockResolvedValue([])
    const actions = createGlobalSearchActions({
      closeSearch,
      navigate,
      appendToQueueAndPlay,
      handleQueueAndPlay,
      openDirectoryQueue
    })

    actions.handleSongSelect({ filePath: 'song.mp3' })
    await actions.handlePlaylistSelect({ path: 'playlist.m3u' })
    await actions.handleDirectorySelect({ path: 'C:\\Music' })
    actions.handleSettingSelect({ actionPayload: { route: '/settings' } })

    expect(appendToQueueAndPlay).toHaveBeenCalledWith({ filePath: 'song.mp3' })
    expect(handleQueueAndPlay).toHaveBeenCalledWith(undefined, undefined, 'playlist.m3u')
    expect(openDirectoryQueue).toHaveBeenCalledWith('C:\\Music')
    expect(navigate).toHaveBeenCalledWith('/settings')
    expect(closeSearch).toHaveBeenCalledTimes(4)
  })

  it('ignores songs without a file path', () => {
    const appendToQueueAndPlay = vi.fn()
    const actions = createGlobalSearchActions({
      closeSearch: vi.fn(),
      navigate: vi.fn(),
      appendToQueueAndPlay,
      handleQueueAndPlay: vi.fn(),
      openDirectoryQueue: vi.fn()
    })

    actions.handleSongSelect({ filePath: '' })
    expect(appendToQueueAndPlay).not.toHaveBeenCalled()
  })
})
