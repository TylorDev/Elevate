import { useEffect, useState } from 'react'

export const SONG_ITEM_COMPACT_MAX_WIDTH = 749
export const DEFAULT_SONG_ITEM_HEIGHT = 88
export const COMPACT_SONG_ITEM_HEIGHT = 64

export function isCompactSongItemViewport() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.innerWidth <= SONG_ITEM_COMPACT_MAX_WIDTH
}

export function getSongItemRowHeight() {
  return isCompactSongItemViewport() ? COMPACT_SONG_ITEM_HEIGHT : DEFAULT_SONG_ITEM_HEIGHT
}

export function useSongItemRowHeight() {
  const [rowHeight, setRowHeight] = useState(() => getSongItemRowHeight())

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const mediaQuery = window.matchMedia(
      `(max-width: ${SONG_ITEM_COMPACT_MAX_WIDTH}px)`
    )
    const syncRowHeight = (event) => {
      setRowHeight(event.matches ? COMPACT_SONG_ITEM_HEIGHT : DEFAULT_SONG_ITEM_HEIGHT)
    }

    syncRowHeight(mediaQuery)

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncRowHeight)

      return () => {
        mediaQuery.removeEventListener('change', syncRowHeight)
      }
    }

    mediaQuery.addListener(syncRowHeight)

    return () => {
      mediaQuery.removeListener(syncRowHeight)
    }
  }, [])

  return rowHeight
}
