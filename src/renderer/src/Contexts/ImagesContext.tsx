import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { dedupedInvoke } from './utils'

const ImagesContext = createContext(null)

const DEFAULT_COVER =
  'data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22128%22 height=%22128%22 viewBox=%220 0 128 128%22%3E%3Crect width=%22128%22 height=%22128%22 fill=%22%230A0A0A%22/%3E%3Cpath d=%22M45 84V35h42v49%22 fill=%22none%22 stroke=%22%23baff00%22 stroke-width=%228%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/%3E%3Ccircle cx=%2238%22 cy=%2287%22 r=%2213%22 fill=%22%23baff00%22/%3E%3Ccircle cx=%2280%22 cy=%2287%22 r=%2213%22 fill=%22%23baff00%22/%3E%3C/svg%3E'

const SONG_COVER_CONFIG = {
  thumb: {
    action: 'get-audio-cover-thumbnail',
    limit: 300
  },
  full: {
    action: 'get-audio-cover-full',
    limit: 20
  }
}

const CACHE_LIMITS = {
  thumb: SONG_COVER_CONFIG.thumb.limit,
  full: SONG_COVER_CONFIG.full.limit,
  collection: 150
}

const imageCaches = {
  thumb: new Map(),
  full: new Map(),
  collection: new Map()
}

const pendingSongLoads = {
  thumb: new Map(),
  full: new Map()
}
const pendingCollectionLoads = new Map()
const pendingPlaylistAutoCoverLoads = new Map()
const pendingPlaylistCoverLoads = new Map()
const collectionCacheSubscribers = new Set()

const VALID_CACHE_SCOPES = new Set(['thumb', 'full', 'collection'])

const cacheRevisions = {
  thumb: 0,
  full: 0,
  collection: 0
}

function normalizeSongVariant(variant = 'thumb') {
  return variant === 'full' ? 'full' : 'thumb'
}

function getCache(scope = 'collection') {
  return imageCaches[scope]
}

function getPendingLoads(variant = 'thumb') {
  return pendingSongLoads[normalizeSongVariant(variant)]
}

function normalizeCacheScope(scope = 'collection') {
  if (scope === 'all') {
    return 'all'
  }

  if (VALID_CACHE_SCOPES.has(scope)) {
    return scope
  }

  console.warn(`Invalid image cache scope: ${scope}`)
  return null
}

function revokeUrl(url) {
  if (url?.startsWith?.('blob:')) {
    URL.revokeObjectURL(url)
  }
}

function toUint8Array(input) {
  if (!input) return null

  if (input instanceof Uint8Array) {
    return input
  }

  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input)
  }

  if (Array.isArray(input)) {
    return new Uint8Array(input)
  }

  if (input?.type === 'Buffer' && Array.isArray(input.data)) {
    return new Uint8Array(input.data)
  }

  if (input?.data) {
    return toUint8Array(input.data)
  }

  return null
}

function toObjectUrl(input, mimeType = 'image/jpeg') {
  const data = toUint8Array(input?.data ?? input)
  if (!data) return null

  const blob = new Blob([data], { type: input?.mimeType || input?.format || mimeType })
  return URL.createObjectURL(blob)
}

function imageDataToUrl(input, mimeType = 'image/png') {
  if (input == null) {
    return DEFAULT_COVER
  }

  if (typeof input === 'string') {
    if (
      input.startsWith('data:') ||
      input.startsWith('blob:') ||
      input.startsWith('http://') ||
      input.startsWith('https://')
    ) {
      return input
    }

    return DEFAULT_COVER
  }

  return toObjectUrl(input, mimeType) || DEFAULT_COVER
}

function getCollectionSignature(data) {
  if (typeof data === 'string') {
    return data
  }

  return data
}

function touchCacheEntry(cache, key, entry) {
  cache.delete(key)
  cache.set(key, entry)
}

function pruneCache(scope) {
  const cache = getCache(scope)
  const limit = CACHE_LIMITS[scope] || CACHE_LIMITS.collection

  if (!cache) return

  while (cache.size > limit) {
    const [oldestKey, oldestEntry] = cache.entries().next().value
    cache.delete(oldestKey)
    revokeUrl(oldestEntry?.url)
  }
}

function notifyCollectionCacheSubscribers(key) {
  for (const subscriber of collectionCacheSubscribers) {
    subscriber(key)
  }
}

function subscribeCollectionCache(subscriber) {
  collectionCacheSubscribers.add(subscriber)
  return () => {
    collectionCacheSubscribers.delete(subscriber)
  }
}

function getPlaylistAutoCoverKey(playlistPath) {
  return playlistPath ? `playlist:auto:${playlistPath}` : ''
}

function getPlaylistPathFromCoverKey(coverKey = '') {
  const prefix = 'playlist:auto:'
  if (!coverKey.startsWith(prefix)) return ''
  return coverKey.slice(prefix.length)
}

export function getSongCoverUrl(filePath, variant = 'thumb') {
  if (!filePath) return DEFAULT_COVER

  const normalizedVariant = normalizeSongVariant(variant)
  const cache = getCache(normalizedVariant)
  const cachedEntry = cache.get(filePath)

  if (!cachedEntry) {
    return null
  }

  touchCacheEntry(cache, filePath, cachedEntry)
  return cachedEntry.url || DEFAULT_COVER
}

export function preloadSongCover(filePath, variant = 'thumb') {
  if (!filePath) {
    return Promise.resolve(DEFAULT_COVER)
  }

  const normalizedVariant = normalizeSongVariant(variant)
  const cachedUrl = getSongCoverUrl(filePath, normalizedVariant)

  if (cachedUrl) {
    return Promise.resolve(cachedUrl)
  }

  const cache = getCache(normalizedVariant)
  const pendingLoads = getPendingLoads(normalizedVariant)
  const pendingLoad = pendingLoads.get(filePath)

  if (pendingLoad) {
    return pendingLoad
  }

  const config = SONG_COVER_CONFIG[normalizedVariant]
  const loadRevision = cacheRevisions[normalizedVariant]
  const loadPromise = dedupedInvoke(config.action, filePath)
    .then((cover) => {
      const url = toObjectUrl(cover) || DEFAULT_COVER

      if (loadRevision !== cacheRevisions[normalizedVariant]) {
        revokeUrl(url)
        return DEFAULT_COVER
      }

      cache.set(filePath, { url })
      pruneCache(normalizedVariant)
      return url
    })
    .catch((error) => {
      console.error(`Error loading ${normalizedVariant} cover:`, error)
      cache.set(filePath, { url: DEFAULT_COVER })
      pruneCache(normalizedVariant)
      return DEFAULT_COVER
    })
    .finally(() => {
      pendingLoads.delete(filePath)
    })

  pendingLoads.set(filePath, loadPromise)
  return loadPromise
}

export function getCollectionCoverUrl(key, data) {
  if (!key) {
    return imageDataToUrl(data)
  }

  const cache = getCache('collection')
  const existingEntry = cache.get(key)
  const signature = getCollectionSignature(data)

  if (existingEntry?.signature === signature) {
    touchCacheEntry(cache, key, existingEntry)
    return existingEntry.url || DEFAULT_COVER
  }

  revokeUrl(existingEntry?.url)

  const url = imageDataToUrl(data)
  cache.set(key, {
    signature,
    url
  })
  pruneCache('collection')
  return url
}

export function getCachedCollectionCoverUrl(key, signature = undefined) {
  if (!key) return null

  const cachedEntry = getCache('collection').get(key)
  if (!cachedEntry?.url) return null

  if (signature !== undefined && cachedEntry.signature !== signature) {
    return null
  }

  touchCacheEntry(getCache('collection'), key, cachedEntry)
  return cachedEntry.url
}

export function setCollectionCoverBlob(key, blobOrBuffer, signature = key) {
  if (!key || !blobOrBuffer) return null

  const cache = getCache('collection')
  const existingEntry = cache.get(key)

  if (existingEntry?.signature === signature && existingEntry?.url) {
    touchCacheEntry(cache, key, existingEntry)
    return existingEntry.url
  }

  revokeUrl(existingEntry?.url)

  const url = imageDataToUrl(blobOrBuffer, 'image/png')
  cache.set(key, {
    signature,
    url
  })
  pruneCache('collection')
  notifyCollectionCacheSubscribers(key)
  return url
}

export function ensurePlaylistAutoCover(playlistPath, options = {}) {
  const coverKey = options.coverKey || getPlaylistAutoCoverKey(playlistPath)
  const signature = options.signature || coverKey

  if (!playlistPath || !coverKey) {
    return Promise.resolve(null)
  }

  const cachedUrl = getCachedCollectionCoverUrl(coverKey, signature)
  if (cachedUrl) {
    return Promise.resolve(cachedUrl)
  }

  const pendingLoad = pendingPlaylistAutoCoverLoads.get(coverKey)
  if (pendingLoad) {
    return pendingLoad
  }

  const loadPromise = dedupedInvoke('playlist:ensure-cover', {
    playlistPath,
    variant: options.variant || 'full'
  })
    .then((response) => {
      if (!response?.success || !response?.cover) {
        return null
      }

      return setCollectionCoverBlob(coverKey, response.cover, response.coverHash || signature)
    })
    .catch((error) => {
      console.error('Error generating playlist cover:', error)
      return null
    })
    .finally(() => {
      pendingPlaylistAutoCoverLoads.delete(coverKey)
    })

  pendingPlaylistAutoCoverLoads.set(coverKey, loadPromise)
  return loadPromise
}

export function preloadPlaylistCover(playlistPath, coverHash, options = {}) {
  const coverKey = options.coverKey || getPlaylistAutoCoverKey(playlistPath)
  const signature = coverHash || options.signature || ''
  const variant = options.variant || 'full'

  if (!playlistPath || !coverKey || !signature) {
    return Promise.resolve(null)
  }

  const cachedUrl = getCachedCollectionCoverUrl(coverKey, signature)
  if (cachedUrl) {
    return Promise.resolve(cachedUrl)
  }

  const pendingKey = `${coverKey}:${signature}:${variant}`
  const pendingLoad = pendingPlaylistCoverLoads.get(pendingKey)
  if (pendingLoad) {
    return pendingLoad
  }

  const loadPromise = dedupedInvoke('playlist:get-cover', {
    playlistPath,
    coverHash: signature,
    variant
  })
    .then((response) => {
      if (!response?.success || !response?.cover) {
        return null
      }

      return setCollectionCoverBlob(coverKey, response.cover, response.coverHash || signature)
    })
    .catch((error) => {
      console.error('Error loading persisted playlist cover:', error)
      return null
    })
    .finally(() => {
      pendingPlaylistCoverLoads.delete(pendingKey)
    })

  pendingPlaylistCoverLoads.set(pendingKey, loadPromise)
  return loadPromise
}

export function preloadCollectionCover(coverKey, coverSignature) {
  if (!coverKey) {
    return Promise.resolve(DEFAULT_COVER)
  }

  const cache = getCache('collection')
  const cachedEntry = cache.get(coverKey)

  if (cachedEntry?.signature === coverSignature) {
    touchCacheEntry(cache, coverKey, cachedEntry)
    return Promise.resolve(cachedEntry.url || DEFAULT_COVER)
  }

  const pendingKey = `${coverKey}:${coverSignature || ''}`
  const pendingLoad = pendingCollectionLoads.get(pendingKey)

  if (pendingLoad) {
    return pendingLoad
  }

  revokeUrl(cachedEntry?.url)

  const loadRevision = cacheRevisions.collection
  const loadPromise = dedupedInvoke('feed:get-collection-cover', {
    coverKey,
    coverSignature
  })
    .then((cover) => {
      const url = toObjectUrl(cover, 'image/png') || DEFAULT_COVER

      if (loadRevision !== cacheRevisions.collection) {
        revokeUrl(url)
        return DEFAULT_COVER
      }

      cache.set(coverKey, {
        signature: coverSignature,
        url
      })
      pruneCache('collection')
      return url
    })
    .catch((error) => {
      console.error('Error loading collection cover:', error)
      cache.set(coverKey, {
        signature: coverSignature,
        url: DEFAULT_COVER
      })
      pruneCache('collection')
      return DEFAULT_COVER
    })
    .finally(() => {
      pendingCollectionLoads.delete(pendingKey)
    })

  pendingCollectionLoads.set(pendingKey, loadPromise)
  return loadPromise
}

export function preloadVisibleSongCovers(songs = [], options = {}) {
  const variant = normalizeSongVariant(options.variant)
  const limit = Number.isFinite(options.limit) ? Math.max(0, options.limit) : songs.length
  const visibleSongs = songs.slice(0, limit)

  return Promise.all(
    visibleSongs.map(async (song) => ({
      filePath: song?.filePath,
      url: await preloadSongCover(song?.filePath, variant)
    }))
  )
}

export function revokeImage(key, scope = 'collection') {
  if (!key) return

  const normalizedScope = normalizeCacheScope(scope)
  if (!normalizedScope || normalizedScope === 'all') return

  const cache = getCache(normalizedScope)
  const entry = cache.get(key)
  cache.delete(key)
  revokeUrl(entry?.url)
  if (normalizedScope === 'collection') {
    notifyCollectionCacheSubscribers(key)
  }
}

export function clearImageCache(scope = 'all') {
  const normalizedScope = normalizeCacheScope(scope)
  if (!normalizedScope) return

  const scopes = normalizedScope === 'all' ? Object.keys(imageCaches) : [normalizedScope]

  for (const currentScope of scopes) {
    const cache = getCache(currentScope)
    cacheRevisions[currentScope] += 1

    for (const entry of cache.values()) {
      revokeUrl(entry?.url)
    }

    cache.clear()
  }

  if (normalizedScope === 'all' || normalizedScope === 'thumb') {
    pendingSongLoads.thumb.clear()
  }

  if (normalizedScope === 'all' || normalizedScope === 'full') {
    pendingSongLoads.full.clear()
  }

  if (normalizedScope === 'all' || normalizedScope === 'collection') {
    pendingCollectionLoads.clear()
    pendingPlaylistAutoCoverLoads.clear()
    pendingPlaylistCoverLoads.clear()
    notifyCollectionCacheSubscribers(null)
  }
}

export function useSongCover(filePath, variant = 'thumb') {
  const [coverUrl, setCoverUrl] = useState(DEFAULT_COVER)

  useEffect(() => {
    let isMounted = true

    if (!filePath) {
      setCoverUrl(DEFAULT_COVER)
      return () => {
        isMounted = false
      }
    }

    const cachedUrl = getSongCoverUrl(filePath, variant)

    if (cachedUrl) {
      setCoverUrl(cachedUrl)
      return () => {
        isMounted = false
      }
    }

    setCoverUrl(DEFAULT_COVER)

    preloadSongCover(filePath, variant).then((url) => {
      if (isMounted) {
        setCoverUrl(url)
      }
    })

    return () => {
      isMounted = false
    }
  }, [filePath, variant])

  return coverUrl
}

export function useCollectionCover(coverKey, coverSignature) {
  const [coverUrl, setCoverUrl] = useState(DEFAULT_COVER)

  useEffect(() => {
    let isMounted = true

    if (!coverKey) {
      setCoverUrl(DEFAULT_COVER)
      return () => {
        isMounted = false
      }
    }

    if (coverKey?.startsWith?.('playlist:auto:')) {
      const playlistPath = getPlaylistPathFromCoverKey(coverKey)
      const cachedPlaylistUrl = getCachedCollectionCoverUrl(coverKey, coverSignature)

      setCoverUrl(cachedPlaylistUrl || DEFAULT_COVER)

      if (!cachedPlaylistUrl && playlistPath && coverSignature) {
        preloadPlaylistCover(playlistPath, coverSignature, {
          coverKey,
          signature: coverSignature
        }).then((url) => {
          if (isMounted && url) {
            setCoverUrl(url)
          }
        })
      }

      const unsubscribe = subscribeCollectionCache((changedKey) => {
        if (changedKey !== null && changedKey !== coverKey) return

        const nextCachedUrl = getCachedCollectionCoverUrl(coverKey, coverSignature)
        if (isMounted) {
          setCoverUrl(nextCachedUrl || DEFAULT_COVER)
        }
      })

      return () => {
        isMounted = false
        unsubscribe()
      }
    }

    const cachedEntry = getCache('collection').get(coverKey)
    if (cachedEntry?.signature === coverSignature && cachedEntry?.url) {
      touchCacheEntry(getCache('collection'), coverKey, cachedEntry)
      setCoverUrl(cachedEntry.url || DEFAULT_COVER)
      return () => {
        isMounted = false
      }
    }

    setCoverUrl(DEFAULT_COVER)
    preloadCollectionCover(coverKey, coverSignature).then((url) => {
      if (isMounted) {
        setCoverUrl(url)
      }
    })

    return () => {
      isMounted = false
    }
  }, [coverKey, coverSignature])

  return coverUrl
}

export function ImagesProvider({ children }) {
  useEffect(() => {
    return () => {
      clearImageCache('all')
    }
  }, [])

  const contextValue = useMemo(
    () => ({
      DEFAULT_COVER,
      clearImageCache,
      getCollectionCoverUrl,
      getCachedCollectionCoverUrl,
      getSongCoverUrl,
      preloadCollectionCover,
      preloadPlaylistCover,
      preloadSongCover,
      preloadVisibleSongCovers,
      ensurePlaylistAutoCover,
      revokeImage,
      setCollectionCoverBlob,
      useCollectionCover,
      useSongCover
    }),
    []
  )

  return <ImagesContext.Provider value={contextValue}>{children}</ImagesContext.Provider>
}

export function useImages() {
  const context = useContext(ImagesContext)

  if (!context) {
    throw new Error('useImages must be used within an ImagesProvider')
  }

  return context
}

export { DEFAULT_COVER }
