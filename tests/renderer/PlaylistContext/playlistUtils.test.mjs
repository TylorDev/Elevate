import { describe, expect, it } from 'vitest'

import {
  extractTrackPaths,
  isScanProgressMessage,
  normalizePlaylistPath
} from '../../../src/renderer/src/Contexts/PlaylistContext/playlistUtils.ts'

describe('PlaylistContext utils', () => {
  it('normalizes Windows paths and preserves special characters', () => {
    expect(normalizePlaylistPath('  C:\\Music\\Mi lista [1] #.m3u  ')).toBe(
      'C:\\Music\\Mi lista [1] #.m3u'
    )
    expect(normalizePlaylistPath(null)).toBe('')
  })

  it('extracts valid track paths and supports trimming and deduplication', () => {
    const tracks = [
      { filePath: 'C:\\Music\\a.mp3' },
      { filePath: '  C:\\Music\\b.mp3  ' },
      { filePath: 'C:\\Music\\a.mp3' },
      { filePath: '' },
      { filePath: null },
      {}
    ]

    expect(extractTrackPaths(tracks)).toEqual([
      'C:\\Music\\a.mp3',
      '  C:\\Music\\b.mp3  ',
      'C:\\Music\\a.mp3'
    ])
    expect(extractTrackPaths(tracks, { trim: true, unique: true })).toEqual([
      'C:\\Music\\a.mp3',
      'C:\\Music\\b.mp3'
    ])
  })

  it('ignores scan progress notifications while accepting regular strings', () => {
    expect(isScanProgressMessage('{"type":"scan-progress","percent":50}')).toBe(true)
    expect(isScanProgressMessage('playlist updated')).toBe(false)
    expect(isScanProgressMessage('{invalid')).toBe(false)
  })
})
