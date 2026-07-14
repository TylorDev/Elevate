import {
  DEFAULT_COVER,
  getSongCoverUrl,
  preloadSongCover,
  useSongCover
} from '../Contexts/ImagesContext'

export function getCachedCoverUrl(filePath, variant = 'thumb') {
  return getSongCoverUrl(filePath, variant)
}

export function preloadCoverUrl(filePath, variant = 'thumb') {
  return preloadSongCover(filePath, variant)
}

export function useCoverUrl(filePath, variant = 'thumb') {
  return useSongCover(filePath, variant)
}

export { DEFAULT_COVER }
