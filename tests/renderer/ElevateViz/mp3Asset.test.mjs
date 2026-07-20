import { File } from 'node:buffer'
import { describe, expect, it, vi } from 'vitest'

import {
  createMp3Asset,
  createPlaceholderCoverDataUrl,
  isMp3File
} from '../../../src/ElevateViz/sandbox/src/utils/mp3Asset.ts'

const mp3 = (name = 'track.mp3') => new File([new Uint8Array([73, 68, 51])], name, {
  type: 'audio/mpeg'
})

function createUrlApi() {
  let id = 0
  return {
    createObjectURL: vi.fn(() => `blob:test-${++id}`),
    revokeObjectURL: vi.fn()
  }
}

describe('sandbox MP3 asset', () => {
  it('rejects an empty or non-MP3 selection before allocating URLs', async () => {
    const urlApi = createUrlApi()
    const text = new File(['not audio'], 'notes.txt', { type: 'text/plain' })

    expect(isMp3File(text)).toBe(false)
    await expect(createMp3Asset(text, { urlApi })).rejects.toThrow('MP3 válido')
    expect(urlApi.createObjectURL).not.toHaveBeenCalled()
  })

  it('extracts an embedded cover and revokes both object URLs', async () => {
    const urlApi = createUrlApi()
    const asset = await createMp3Asset(mp3(), {
      urlApi,
      parseMetadata: async () => ({
        common: {
          title: 'Test Track',
          artist: 'Test Artist',
          picture: [{ data: new Uint8Array([255, 216, 255]), format: 'image/jpeg' }]
        },
        format: { duration: 125.4 }
      })
    })

    expect(asset).toMatchObject({
      coverUrl: 'blob:test-2',
      hasEmbeddedCover: true,
      title: 'Test Track',
      artist: 'Test Artist',
      durationSeconds: 125.4,
      warning: null
    })

    asset.revoke()
    expect(urlApi.revokeObjectURL).toHaveBeenNthCalledWith(1, 'blob:test-1')
    expect(urlApi.revokeObjectURL).toHaveBeenNthCalledWith(2, 'blob:test-2')
  })

  it('uses the internal placeholder when the MP3 has no cover', async () => {
    const urlApi = createUrlApi()
    const asset = await createMp3Asset(mp3('without-cover.mp3'), {
      urlApi,
      parseMetadata: async () => ({ common: {}, format: { duration: 12 } })
    })

    expect(asset.hasEmbeddedCover).toBe(false)
    expect(asset.coverUrl).toBe(createPlaceholderCoverDataUrl())
    expect(asset.title).toBe('without-cover')
  })

  it('keeps invalid MP3 metadata non-fatal and still releases the audio URL', async () => {
    const urlApi = createUrlApi()
    const asset = await createMp3Asset(mp3('broken.mp3'), {
      urlApi,
      parseMetadata: async () => {
        throw new Error('invalid ID3')
      }
    })

    expect(asset.warning).toBe('invalid ID3')
    expect(asset.hasEmbeddedCover).toBe(false)
    expect(asset.coverUrl).toContain('data:image/svg+xml')

    asset.revoke()
    expect(urlApi.revokeObjectURL).toHaveBeenCalledTimes(1)
  })
})
