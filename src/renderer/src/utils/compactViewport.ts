import { useEffect, useState } from 'react'

export const COMPACT_VIEWPORT_MAX_HEIGHT = 500
export const COMPACT_VIEWPORT_MAX_WIDTH = 940
export const COMPACT_HEADER_MAX_WIDTH = 750
export const COLLECTION_HORIZONTAL_MAX_HEIGHT = 620
export const COLLECTION_MOVIL_MIN_WIDTH = COMPACT_HEADER_MAX_WIDTH + 1
export const COLLECTION_MOVIL_MAX_WIDTH = 1039

export function isCompactViewportHeight() {
  if (typeof window === 'undefined') {
    return false
  }

  return (
    window.innerHeight <= COMPACT_VIEWPORT_MAX_HEIGHT &&
    window.innerWidth <= COMPACT_VIEWPORT_MAX_WIDTH
  )
}

export function useIsCompactViewportHeight() {
  const [isCompactHeight, setIsCompactHeight] = useState(() => isCompactViewportHeight())

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const mediaQuery = window.matchMedia(
      `(max-height: ${COMPACT_VIEWPORT_MAX_HEIGHT}px) and (max-width: ${COMPACT_VIEWPORT_MAX_WIDTH}px)`
    )
    const syncCompactHeight = (event) => {
      setIsCompactHeight(event.matches)
    }

    syncCompactHeight(mediaQuery)

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncCompactHeight)

      return () => {
        mediaQuery.removeEventListener('change', syncCompactHeight)
      }
    }

    mediaQuery.addListener(syncCompactHeight)

    return () => {
      mediaQuery.removeListener(syncCompactHeight)
    }
  }, [])

  return isCompactHeight
}

export function isCompactHeaderViewport() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.innerWidth <= COMPACT_HEADER_MAX_WIDTH
}

export function useIsCompactHeaderViewport() {
  const [isCompactHeader, setIsCompactHeader] = useState(() => isCompactHeaderViewport())

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const mediaQuery = window.matchMedia(`(max-width: ${COMPACT_HEADER_MAX_WIDTH}px)`)
    const syncCompactHeader = (event) => {
      setIsCompactHeader(event.matches)
    }

    syncCompactHeader(mediaQuery)

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncCompactHeader)

      return () => {
        mediaQuery.removeEventListener('change', syncCompactHeader)
      }
    }

    mediaQuery.addListener(syncCompactHeader)

    return () => {
      mediaQuery.removeListener(syncCompactHeader)
    }
  }, [])

  return isCompactHeader
}

export function isCollectionHorizontalViewport() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.innerHeight <= COLLECTION_HORIZONTAL_MAX_HEIGHT
}

export function useIsCollectionHorizontalViewport() {
  const [isCollectionHorizontalViewportMatch, setIsCollectionHorizontalViewportMatch] = useState(() =>
    isCollectionHorizontalViewport()
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const mediaQuery = window.matchMedia(`(max-height: ${COLLECTION_HORIZONTAL_MAX_HEIGHT}px)`)
    const syncCollectionHorizontalViewport = (event) => {
      setIsCollectionHorizontalViewportMatch(event.matches)
    }

    syncCollectionHorizontalViewport(mediaQuery)

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncCollectionHorizontalViewport)

      return () => {
        mediaQuery.removeEventListener('change', syncCollectionHorizontalViewport)
      }
    }

    mediaQuery.addListener(syncCollectionHorizontalViewport)

    return () => {
      mediaQuery.removeListener(syncCollectionHorizontalViewport)
    }
  }, [])

  return isCollectionHorizontalViewportMatch
}

export function isCollectionMovilEligibleViewport() {
  if (typeof window === 'undefined') {
    return false
  }

  return (
    window.innerWidth >= COLLECTION_MOVIL_MIN_WIDTH &&
    window.innerWidth <= COLLECTION_MOVIL_MAX_WIDTH
  )
}

export function useIsCollectionMovilEligibleViewport() {
  const [isCollectionMovilEligibleViewportMatch, setIsCollectionMovilEligibleViewportMatch] = useState(() =>
    isCollectionMovilEligibleViewport()
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const mediaQuery = window.matchMedia(
      `(min-width: ${COLLECTION_MOVIL_MIN_WIDTH}px) and (max-width: ${COLLECTION_MOVIL_MAX_WIDTH}px)`
    )
    const syncCollectionMovilEligibleViewport = (event) => {
      setIsCollectionMovilEligibleViewportMatch(event.matches)
    }

    syncCollectionMovilEligibleViewport(mediaQuery)

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncCollectionMovilEligibleViewport)

      return () => {
        mediaQuery.removeEventListener('change', syncCollectionMovilEligibleViewport)
      }
    }

    mediaQuery.addListener(syncCollectionMovilEligibleViewport)

    return () => {
      mediaQuery.removeListener(syncCollectionMovilEligibleViewport)
    }
  }, [])

  return isCollectionMovilEligibleViewportMatch
}
