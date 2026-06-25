// @ts-nocheck
import fs from 'fs'
import path from 'path'
import {
  deletePlaylistCoverFromCache,
  ensureCoverDir,
  getCoverFromCache,
  getPlaylistCoverFromCache,
  processPlaylist,
  savePlaylistCoverToCache
} from '../utils/utils.ts'
import { generateCollectionCoverFromTracks } from '../utils/collectionDetail.ts'
import { prisma } from '../../prisma.ts'
import {
  dataUrlToBuffer,
  isSourcePathValue
} from './shared.ts'
import {
  getPlaylist,
  invalidatePlaylistCache
} from './repository.ts'

let sharpModulePromise = null

async function getSharp() {
  if (!sharpModulePromise) {
    sharpModulePromise = import('sharp').then((module) => module.default)
  }

  return sharpModulePromise
}

export function buildCoverConfig(playlist) {
  if (!playlist) {
    return null
  }

  return {
    customCoverMode: playlist.customCoverMode || null,
    customCoverHash: playlist.customCoverHash || null,
    customCoverValue: playlist.customCoverValue || null,
    customCoverSelection: playlist.customCoverSelection
      ? JSON.parse(playlist.customCoverSelection)
      : null
  }
}

export function buildPlaylistSummary(playlist, effectiveCover = null) {
  if (!playlist) {
    return null
  }

  return {
    id: playlist.id,
    path: playlist.path,
    nombre: playlist.nombre,
    duracion: playlist.duracion,
    numElementos: playlist.numElementos,
    createdAt: playlist.createdAt,
    totalplays: playlist.totalplays,
    customCoverHash: playlist.customCoverHash || null,
    cover: effectiveCover,
    effectiveCover,
    coverConfig: buildCoverConfig(playlist)
  }
}

export async function getTop10SuggestedCovers(playlistPath) {
  try {
    const baseDir = path.dirname(playlistPath)
    const songs = await processPlaylist(playlistPath, baseDir)
    const sortedSongs = songs
      .filter((song) => song.coverHash || song.filePath)
      .sort((a, b) => (Number(b.short_view_count) || 0) - (Number(a.short_view_count) || 0))
      .slice(0, 10)

    return Promise.all(
      sortedSongs.map(async (song, index) => {
        const cover = song.filePath ? await getCoverFromCache(song.filePath, 'full') : null

        return {
          suggestedId: song.filePath || song.coverHash || `suggested-${index}`,
          filePath: song.filePath || null,
          title: song.title || song.fileName || null,
          artist: song.artist || null,
          coverHash: song.coverHash || null,
          short_view_count: Number(song.short_view_count) || 0,
          picture: cover?.data
            ? [{ data: cover.data, type: 'Cover (front)', format: cover.mimeType || 'image/jpeg' }]
            : []
        }
      })
    )
  } catch (error) {
    console.error('Error getting top 10 suggested covers:', error)
    return []
  }
}

export async function generatePlaylistCoverFromSelectedImages(selectedItems) {
  if (!selectedItems || selectedItems.length !== 4) {
    throw new Error('Exactly 4 images are required for the collage')
  }

  try {
    const imageBuffers = []

    for (const item of selectedItems) {
      if (item.filePath) {
        const cachedCover = await getCoverFromCache(item.filePath, 'full')
        if (cachedCover?.data) {
          imageBuffers.push(Buffer.from(cachedCover.data))
          continue
        }
      }

      if (item.coverHash) {
        const cacheDir = ensureCoverDir()
        const fullCoverPath = path.join(cacheDir, 'full', `${item.coverHash}.jpg`)
        if (fs.existsSync(fullCoverPath)) {
          imageBuffers.push(await fs.promises.readFile(fullCoverPath))
          continue
        }
      }

      if (item.picture && item.picture[0]?.data) {
        imageBuffers.push(Buffer.from(item.picture[0].data))
      } else if (item.localPath && fs.existsSync(item.localPath)) {
        imageBuffers.push(await fs.promises.readFile(item.localPath))
      } else if (item.resolvedUrl) {
        const parsed = dataUrlToBuffer(item.resolvedUrl)
        if (parsed?.buffer) {
          imageBuffers.push(parsed.buffer)
        }
      }
    }

    if (imageBuffers.length < 4) {
      throw new Error('Could not fetch the 4 images for the collage')
    }

    const sharp = await getSharp()
    const resizedImages = await Promise.all(
      imageBuffers.slice(0, 4).map((buffer) =>
        sharp(buffer).resize(250, 250, { fit: 'cover' }).toBuffer()
      )
    )

    const canvas = sharp({
      create: {
        width: 500,
        height: 500,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })

    const composites = resizedImages.map((img, index) => ({
      input: img,
      top: Math.floor(index / 2) * 250,
      left: (index % 2) * 250
    }))

    const tileBuffer = await canvas.composite(composites).png().toBuffer()
    return tileBuffer
  } catch (error) {
    console.error('Error generating collage from selected images:', error)
    throw error
  }
}

export async function persistPlaylistCoverForMode(playlist, coverBuffer, mode, extras = {}) {
  if (!playlist?.path || !coverBuffer) {
    return playlist
  }

  const savedCover = await savePlaylistCoverToCache(coverBuffer)
  if (!savedCover?.coverHash) {
    return playlist
  }

  const oldCoverHash = playlist.customCoverHash || null
  const nextMode = mode || playlist.customCoverMode || null
  const updateData = {
    customCoverMode: nextMode,
    customCoverHash: savedCover.coverHash,
    customCoverSelection:
      extras.customCoverSelection !== undefined
        ? extras.customCoverSelection
        : playlist.customCoverSelection || null,
    customCoverUpdatedAt: new Date()
  }

  if (extras.customCoverValue !== undefined) {
    updateData.customCoverValue = extras.customCoverValue
  } else if (nextMode === 'auto-generated' || nextMode === 'suggested-collage') {
    updateData.customCoverValue = null
  } else {
    updateData.customCoverValue = playlist.customCoverValue || null
  }

  const updatedPlaylist = await prisma.playlist.update({
    where: { path: playlist.path },
    data: updateData
  })

  invalidatePlaylistCache(playlist.path)

  if (oldCoverHash && oldCoverHash !== savedCover.coverHash) {
    await deletePlaylistCoverFromCache(oldCoverHash)
  }

  return updatedPlaylist
}

async function materializeStoredPlaylistCover(playlist, { allowAutoGenerate = false } = {}) {
  if (!playlist) {
    return { playlist: null, cover: null }
  }

  if (playlist.customCoverHash) {
    const cachedCover = await getPlaylistCoverFromCache(playlist.customCoverHash, 'full')
    if (cachedCover) {
      return { playlist, cover: cachedCover }
    }
  }

  let coverBuffer = null
  let nextMode = playlist.customCoverMode || null
  let nextCoverValue
  let nextCoverSelection

  if (typeof playlist.customCoverValue === 'string' && playlist.customCoverValue.startsWith('data:')) {
    const parsed = dataUrlToBuffer(playlist.customCoverValue)
    if (parsed?.buffer) {
      coverBuffer = parsed.buffer
      nextCoverValue =
        nextMode === 'local-image' || nextMode === 'remote-image'
          ? null
          : nextMode === 'auto-generated' || nextMode === 'suggested-collage'
            ? null
            : playlist.customCoverValue
    }
  } else if (playlist.customCoverMode === 'local-image') {
    if (isSourcePathValue(playlist.customCoverValue) && fs.existsSync(playlist.customCoverValue)) {
      const sharp = await getSharp()
      coverBuffer = await sharp(playlist.customCoverValue)
        .resize(500, 500, { fit: 'cover' })
        .png()
        .toBuffer()
      nextCoverValue = playlist.customCoverValue
    }
  } else if (playlist.customCoverMode === 'remote-image') {
    if (isSourcePathValue(playlist.customCoverValue)) {
      const sharp = await getSharp()
      const axios = (await import('axios')).default
      const response = await axios.get(playlist.customCoverValue, { responseType: 'arraybuffer' })
      coverBuffer = await sharp(Buffer.from(response.data))
        .resize(500, 500, { fit: 'cover' })
        .png()
        .toBuffer()
      nextCoverValue = playlist.customCoverValue
    }
  } else if (playlist.customCoverMode === 'suggested-collage') {
    const selection = playlist.customCoverSelection
      ? JSON.parse(playlist.customCoverSelection)
      : null

    if (selection && Array.isArray(selection) && selection.length === 4) {
      coverBuffer = await generatePlaylistCoverFromSelectedImages(selection)
      nextCoverSelection = playlist.customCoverSelection
      nextCoverValue = null
    }
  } else if (
    allowAutoGenerate &&
    (playlist.customCoverMode === 'auto-generated' || !playlist.customCoverMode)
  ) {
    const tracks = (await processPlaylist(playlist.path, path.dirname(playlist.path))).map((song) => ({
      ...song,
      picture: undefined
    }))

    if (tracks.length > 0) {
      coverBuffer = await generateCollectionCoverFromTracks(tracks)
      nextMode = 'auto-generated'
      nextCoverValue = null
      nextCoverSelection = null
    }
  }

  if (!coverBuffer) {
    return { playlist, cover: null }
  }

  const updatedPlaylist = await persistPlaylistCoverForMode(playlist, coverBuffer, nextMode, {
    customCoverValue: nextCoverValue,
    customCoverSelection: nextCoverSelection
  })
  const persistedCover = updatedPlaylist?.customCoverHash
    ? await getPlaylistCoverFromCache(updatedPlaylist.customCoverHash, 'full')
    : null

  return {
    playlist: updatedPlaylist,
    cover: persistedCover
  }
}

export async function getEffectiveCover(playlist, fallbackCover = null) {
  try {
    const { cover } = await materializeStoredPlaylistCover(playlist, { allowAutoGenerate: false })
    return cover || fallbackCover || null
  } catch (error) {
    console.error('Error getting effective cover:', error)
    return fallbackCover ?? null
  }
}

export async function ensurePlaylistCover(playlistPath, { variant = 'full', allowAutoGenerate = true } = {}) {
  try {
    if (typeof playlistPath !== 'string' || playlistPath.trim() === '') {
      return { success: false, error: 'playlistPath is required' }
    }

    const playlist = await getPlaylist(playlistPath.trim())
    if (!playlist) {
      return { success: false, error: 'Playlist no encontrada' }
    }

    const { playlist: updatedPlaylist, cover } = await materializeStoredPlaylistCover(playlist, {
      allowAutoGenerate
    })

    if (!cover) {
      return { success: false, error: 'There are no covers available to generate the cover.' }
    }

    const coverHash = updatedPlaylist?.customCoverHash || playlist.customCoverHash || null
    const variantCover =
      coverHash && variant !== 'full'
        ? await getPlaylistCoverFromCache(coverHash, variant)
        : cover

    return {
      success: true,
      cover: variantCover || cover,
      coverHash,
      coverConfig: buildCoverConfig(updatedPlaylist || playlist)
    }
  } catch (error) {
    console.error('Error ensuring playlist cover:', error)
    return { success: false, error: error.message || 'No se pudo resolver la portada.' }
  }
}

export async function enrichPlaylistWithCover(playlist, options = {}) {
  if (options?.coverError) {
    return {
      ...playlist,
      cover: null,
      effectiveCover: null,
      coverConfig: buildCoverConfig(playlist)
    }
  }

  const effectiveCover = await getEffectiveCover(playlist)
  return {
    ...playlist,
    cover: effectiveCover,
    effectiveCover,
    coverConfig: buildCoverConfig(playlist)
  }
}

export async function updatePlaylistMetadata({ path: filepath, nombre, coverMode, coverValue, coverSelection }) {
  try {
    if (!filepath) {
      return { success: false, error: 'filepath is required' }
    }

    const existingPlaylist = await prisma.playlist.findUnique({
      where: { path: filepath }
    })

    if (!existingPlaylist) {
      return { success: false, error: 'Playlist no encontrada' }
    }

    const updateData = {}
    const coverModeChanged = coverMode !== undefined
    let updatedPlaylist = existingPlaylist
    let oldCoverHashToDelete = null

    if (nombre !== undefined && nombre !== null) {
      updateData.nombre = nombre.trim()
    }

    if (coverModeChanged) {
      if (coverMode === 'suggested-collage') {
        if (coverSelection && Array.isArray(coverSelection) && coverSelection.length === 4) {
          const suggestedCovers = await getTop10SuggestedCovers(filepath)
          const selectedItems = coverSelection
            .map((selection) => {
              const selectedId =
                typeof selection === 'string'
                  ? selection
                  : selection?.suggestedId || selection?.filePath || selection?.coverHash || null

              return suggestedCovers.find((cover) => cover.suggestedId === selectedId)
            })
            .filter(Boolean)
            .map((cover) => ({
              suggestedId: cover.suggestedId,
              filePath: cover.filePath,
              coverHash: cover.coverHash
            }))

          if (selectedItems.length !== 4) {
            return { success: false, error: 'No se pudieron resolver las 4 selecciones del collage' }
          }

          const collageBuffer = await generatePlaylistCoverFromSelectedImages(selectedItems)
          updatedPlaylist = await persistPlaylistCoverForMode(
            existingPlaylist,
            collageBuffer,
            'suggested-collage',
            {
              customCoverSelection: JSON.stringify(selectedItems),
              customCoverValue: null
            }
          )
        } else {
          return { success: false, error: 'Para collage sugerido se requieren exactamente 4 selecciones' }
        }
      } else if (coverMode === 'local-image' || coverMode === 'remote-image') {
        if (!coverValue) {
          return { success: false, error: `Se requiere un valor para el modo ${coverMode}` }
        }
        let sourceBuffer = null

        if (coverMode === 'local-image') {
          if (!fs.existsSync(coverValue)) {
            return { success: false, error: 'No se encontro la imagen local seleccionada' }
          }

          const sharp = await getSharp()
          sourceBuffer = await sharp(coverValue)
            .resize(500, 500, { fit: 'cover' })
            .png()
            .toBuffer()
        } else {
          const sharp = await getSharp()
          const axios = (await import('axios')).default
          const response = await axios.get(coverValue, { responseType: 'arraybuffer' })
          sourceBuffer = await sharp(Buffer.from(response.data))
            .resize(500, 500, { fit: 'cover' })
            .png()
            .toBuffer()
        }

        updatedPlaylist = await persistPlaylistCoverForMode(existingPlaylist, sourceBuffer, coverMode, {
          customCoverSelection: null,
          customCoverValue: coverValue
        })
      } else if (coverMode === 'auto' || coverMode === null || coverMode === '') {
        oldCoverHashToDelete = existingPlaylist.customCoverHash || null
        updateData.customCoverMode = null
        updateData.customCoverHash = null
        updateData.customCoverValue = null
        updateData.customCoverSelection = null
      } else if (coverMode === 'auto-generated') {
        updatedPlaylist = existingPlaylist
      }
    }

    if (updatedPlaylist !== existingPlaylist && Object.keys(updateData).length > 0) {
      updatedPlaylist = await prisma.playlist.update({
        where: { path: filepath },
        data: updateData
      })
    }

    if (Object.keys(updateData).length > 0 && updatedPlaylist === existingPlaylist) {
      if (coverModeChanged) {
        updateData.customCoverUpdatedAt = new Date()
      }
      updatedPlaylist = await prisma.playlist.update({
        where: { path: filepath },
        data: updateData
      })
      invalidatePlaylistCache(filepath)
    }

    if (oldCoverHashToDelete) {
      await deletePlaylistCoverFromCache(oldCoverHashToDelete)
    }

    // Only invalidate cover cache and regenerate if the cover mode actually changed
    if (coverModeChanged) {
      const effectiveCover = await getEffectiveCover(updatedPlaylist)

      return {
        success: true,
        playlist: buildPlaylistSummary(updatedPlaylist, effectiveCover),
        coverConfig: buildCoverConfig(updatedPlaylist),
        effectiveCover
      }
    }

    // Name-only change: return immediately without touching covers
    return {
      success: true,
      playlist: buildPlaylistSummary(updatedPlaylist, null),
      coverConfig: buildCoverConfig(updatedPlaylist),
      effectiveCover: null
    }
  } catch (error) {
    console.error('Error updating playlist metadata:', error)
    return { success: false, error: error.message }
  }
}
