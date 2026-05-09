import { useEffect, useState } from 'react'
import { dedupedInvoke } from '../Contexts/utils'

const DEFAULT_COVER =
  'data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22128%22 height=%22128%22 viewBox=%220 0 128 128%22%3E%3Crect width=%22128%22 height=%22128%22 fill=%22%23141414%22/%3E%3Cpath d=%22M45 84V35h42v49%22 fill=%22none%22 stroke=%22%23baff00%22 stroke-width=%228%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/%3E%3Ccircle cx=%2238%22 cy=%2287%22 r=%2213%22 fill=%22%23baff00%22/%3E%3Ccircle cx=%2280%22 cy=%2287%22 r=%2213%22 fill=%22%23baff00%22/%3E%3C/svg%3E'

const COVER_CONFIG = {
  thumb: {
    action: 'get-audio-cover-thumbnail',
    limit: 300
  },
  full: {
    action: 'get-audio-cover-full',
    limit: 20
  }
}

const coverCaches = {
  thumb: new Map(),
  full: new Map()
}

const pendingCoverLoads = {
  thumb: new Map(),
  full: new Map()
}

function toObjectUrl(cover) {
  if (!cover?.data) return null

  const rawData = cover.data?.data || cover.data
  const data = rawData instanceof Uint8Array ? rawData : new Uint8Array(rawData)
  const blob = new Blob([data], { type: cover.mimeType || 'image/jpeg' })

  return URL.createObjectURL(blob)
}

function touchCacheEntry(cache, key, entry) {
  cache.delete(key)
  cache.set(key, entry)
}

function pruneCache(cache, limit) {
  while (cache.size > limit) {
    const [oldestKey, oldestEntry] = cache.entries().next().value
    cache.delete(oldestKey)

    if (oldestEntry?.url?.startsWith('blob:')) {
      URL.revokeObjectURL(oldestEntry.url)
    }
  }
}

function getCoverCache(variant = 'thumb') {
  return coverCaches[variant] || coverCaches.thumb
}

function getPendingCoverLoads(variant = 'thumb') {
  return pendingCoverLoads[variant] || pendingCoverLoads.thumb
}

function getCoverConfig(variant = 'thumb') {
  return COVER_CONFIG[variant] || COVER_CONFIG.thumb
}

export function getCachedCoverUrl(filePath, variant = 'thumb') {
  if (!filePath) return DEFAULT_COVER

  const cache = getCoverCache(variant)
  const cachedEntry = cache.get(filePath)

  if (!cachedEntry) {
    return null
  }

  touchCacheEntry(cache, filePath, cachedEntry)
  return cachedEntry.url || DEFAULT_COVER
}

export function preloadCoverUrl(filePath, variant = 'thumb') {
  if (!filePath) {
    return Promise.resolve(DEFAULT_COVER)
  }

  const cachedUrl = getCachedCoverUrl(filePath, variant)
  if (cachedUrl) {
    return Promise.resolve(cachedUrl)
  }

  const cache = getCoverCache(variant)
  const pendingLoads = getPendingCoverLoads(variant)
  const config = getCoverConfig(variant)
  const pendingLoad = pendingLoads.get(filePath)

  if (pendingLoad) {
    return pendingLoad
  }

  const loadPromise = dedupedInvoke(config.action, filePath)
    .then((cover) => {
      const url = toObjectUrl(cover) || DEFAULT_COVER
      cache.set(filePath, { url })
      pruneCache(cache, config.limit)
      return url
    })
    .catch((error) => {
      console.error(`Error loading ${variant} cover:`, error)
      cache.set(filePath, { url: DEFAULT_COVER })
      pruneCache(cache, config.limit)
      return DEFAULT_COVER
    })
    .finally(() => {
      pendingLoads.delete(filePath)
    })

  pendingLoads.set(filePath, loadPromise)
  return loadPromise
}

export function useCoverUrl(filePath, variant = 'thumb') {
  const [coverUrl, setCoverUrl] = useState(DEFAULT_COVER)

  useEffect(() => {
    let isMounted = true

    if (!filePath) {
      setCoverUrl(DEFAULT_COVER)
      return () => {
        isMounted = false
      }
    }

    const cachedUrl = getCachedCoverUrl(filePath, variant)

    if (cachedUrl) {
      setCoverUrl(cachedUrl)
      return () => {
        isMounted = false
      }
    }

    setCoverUrl(DEFAULT_COVER)

    preloadCoverUrl(filePath, variant).then((url) => {
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

export { DEFAULT_COVER }
