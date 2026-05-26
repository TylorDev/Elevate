import { getCoverFromCache } from './utils.mjs'

let sharpModulePromise = null

async function getSharp() {
  if (!sharpModulePromise) {
    sharpModulePromise = import('sharp').then((module) => module.default)
  }

  return sharpModulePromise
}

function toNumber(value) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

export function buildCollectionSummary(tracks = [], { sourcePath = '', cover = null } = {}) {
  const summary = tracks.reduce(
    (accumulator, track) => {
      accumulator.totalDuration += toNumber(track?.duration)
      accumulator.totalShortViews += toNumber(track?.short_view_count)
      accumulator.totalLongViews += toNumber(track?.long_view_count)
      accumulator.totalAccumulatedDuration += toNumber(track?.active_listening_seconds)
      accumulator.totalRepeats += toNumber(track?.consecutive_repeat_count)
      accumulator.totalSkips += toNumber(track?.skip_count)
      accumulator.trackCount += 1
      return accumulator
    },
    {
      totalDuration: 0,
      sourcePath,
      totalShortViews: 0,
      totalLongViews: 0,
      totalAccumulatedDuration: 0,
      totalRepeats: 0,
      totalSkips: 0,
      trackCount: 0,
      cover
    }
  )

  summary.cover = cover
  summary.sourcePath = sourcePath
  return summary
}

export async function generateCollectionCoverFromTracks(tracks = []) {
  if (!Array.isArray(tracks) || tracks.length === 0) {
    return null
  }

  const uniqueTracks = []
  const seenFilePaths = new Set()

  for (const track of tracks) {
    if (!track?.filePath || seenFilePaths.has(track.filePath)) {
      continue
    }

    seenFilePaths.add(track.filePath)
    uniqueTracks.push(track)
  }

  const rankedTracks = uniqueTracks
    .slice()
    .sort((left, right) => toNumber(right?.short_view_count) - toNumber(left?.short_view_count))

  const imageBuffers = []

  for (const track of rankedTracks) {
    const cachedCover = await getCoverFromCache(track.filePath, 'full')
    if (cachedCover?.data) {
      imageBuffers.push(Buffer.from(cachedCover.data))
    }

    if (imageBuffers.length === 4) {
      break
    }
  }

  if (imageBuffers.length === 0) {
    return null
  }

  const tileSize = 250
  const gridSize = Math.max(1, Math.ceil(Math.sqrt(imageBuffers.length)))
  const totalSize = gridSize * tileSize
  const sharp = await getSharp()

  const resizedImages = await Promise.all(
    imageBuffers.map((buffer) => sharp(buffer).resize(tileSize, tileSize, { fit: 'cover' }).toBuffer())
  )

  const canvas = sharp({
    create: {
      width: totalSize,
      height: totalSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })

  const composites = resizedImages.map((image, index) => ({
    input: image,
    top: Math.floor(index / gridSize) * tileSize,
    left: (index % gridSize) * tileSize
  }))

  return canvas.composite(composites).png().toBuffer()
}
