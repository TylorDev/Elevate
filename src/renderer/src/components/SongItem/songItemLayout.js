import { useEffect, useState } from 'react'
import { COMPACT_VIEWPORT_MAX_WIDTH } from '../../utils/compactViewport'

export const SONG_ITEM_COMPACT_MAX_HEIGHT = 500
export const DEFAULT_SONG_ITEM_HEIGHT = 88
export const COMPACT_SONG_ITEM_HEIGHT = 64

export function isCompactSongItemViewport() {
  if (typeof window === 'undefined') {
    return false
  }

  return (
    window.innerHeight <= SONG_ITEM_COMPACT_MAX_HEIGHT &&
    window.innerWidth <= COMPACT_VIEWPORT_MAX_WIDTH
  )
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
      `(max-height: ${SONG_ITEM_COMPACT_MAX_HEIGHT}px) and (max-width: ${COMPACT_VIEWPORT_MAX_WIDTH}px)`
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
