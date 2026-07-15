import { describe, expect, it } from 'vitest'

import { PlaylistsProvider, usePlaylists } from '../../../src/renderer/src/Contexts/PlaylistsContex.tsx'
import { getPlaylistContextValue } from '../../../src/renderer/src/Contexts/PlaylistContext/PlaylistsProvider.tsx'
import { PlaylistsProvider as FolderProvider } from '../../../src/renderer/src/Contexts/PlaylistContext/index.ts'

describe('PlaylistContext public contract', () => {
  it('preserves the legacy facade exports', () => {
    expect(PlaylistsProvider).toBe(FolderProvider)
    expect(usePlaylists).toBeTypeOf('function')
  })

  it('throws the provider boundary error for an empty context', () => {
    expect(() => getPlaylistContextValue(null)).toThrow(
      'usePlaylists must be used within a PlaylistsProvider'
    )
  })
})
