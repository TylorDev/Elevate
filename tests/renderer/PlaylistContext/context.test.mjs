import { describe, expect, it } from 'vitest'

import { PlaylistsProvider, usePlaylists } from '../../../src/renderer/src/Contexts/PlaylistContext/index.ts'
import { getPlaylistContextValue } from '../../../src/renderer/src/Contexts/PlaylistContext/PlaylistsProvider.tsx'

describe('PlaylistContext public contract', () => {
  it('preserves the canonical context exports', () => {
    expect(PlaylistsProvider).toBeTypeOf('function')
    expect(usePlaylists).toBeTypeOf('function')
  })

  it('throws the provider boundary error for an empty context', () => {
    expect(() => getPlaylistContextValue(null)).toThrow(
      'usePlaylists must be used within a PlaylistsProvider'
    )
  })
})
