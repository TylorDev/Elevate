import { app, dialog } from 'electron'
import fs from 'fs'
import path from 'path'
import { prisma } from '../../prisma.ts'
import { processPlaylist } from '../../utils/utils.ts'
import {
  createPlaylistRecord,
  findPlaylistByNameInsensitive,
  findPlaylistsByNameInsensitive,
  getPlays,
  invalidatePlaylistCache,
  playlistIdentityExistsInDatabase,
  updatePlaylist
} from './repository.ts'
import {
  extractPlaylistName,
  getErrorMessage,
  getPlaylistNameValidationError,
  getPlaylistTrackSignature,
  getProtectedPathMessage,
  hasDuplicatePlaylistTrackPaths,
  isProtectedPathError,
  normalizePlaylistFileName,
  resolvePlaylistTrackPath,
  sanitizePlaylistTrackPaths,
  stripControlCharacters,
  stripPlaylistExtension
} from './shared.ts'
import type { Playlist, PrismaClient } from '../../generated/prisma/client.ts'
import type {
  AudioFileInfo,
  DuplicateImportedPlaylist,
  ExportPlaylistResult,
  PersistPlaylistRecordOptions,
  PersistPlaylistRecordResult,
  PlaylistDetails,
  ResolveUniquePlaylistPathRequest,
  SaveM3uFileResult,
  SaveM3uRequest,
  SavePlaylistResult,
  SavePlaylistToTargetRequest
} from '../../Types/playlistHandlers.ts'

const db = prisma as unknown as PrismaClient
const processPlaylistTracks = processPlaylist as (
  filepath: string,
  baseDir: string,
  options?: Record<string, unknown>
) => Promise<AudioFileInfo[]>

export async function selectFile(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'M3U Files', extensions: ['m3u'] }]
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return result.filePaths[0]
}

export async function saveDialog(nombre = ''): Promise<string | null> {
  let isValid = false
  let filePath: string | null = null
  const suggestedFileName =
    stripControlCharacters(stripPlaylistExtension(nombre))
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/[. ]+$/g, '') || 'playlist'

  while (!isValid) {
    const { filePath: selectedPath } = await dialog.showSaveDialog({
      title: 'Save list',
      defaultPath: path.join(app.getPath('documents'), `${suggestedFileName}.m3u`),
      filters: [{ name: 'Playlists', extensions: ['m3u'] }]
    })

    if (!selectedPath) {
      console.log('The dialog was canceled')
      return null
    }

    const fileName = path.basename(selectedPath, path.extname(selectedPath))

    if (fileName.length > 2 && fileName.length < 15) {
      isValid = true
      filePath = selectedPath
    } else {
      console.debug(fileName)
      console.log(
        'The file name must be more than 5 and fewer than 15 characters. Try again.'
      )
    }
  }

  return filePath
}

const createM3uContent = (filePaths: string[]): string => filePaths.join('\n')

const saveM3uFile = async (m3uFilePath: string, m3uContent: string): Promise<SaveM3uFileResult> => {
  try {
    await fs.promises.writeFile(m3uFilePath, m3uContent)
    return { success: true, path: m3uFilePath }
  } catch (err) {
    return {
      success: false,
      error: isProtectedPathError(err) ? getProtectedPathMessage() : getErrorMessage(err)
    }
  }
}

export async function resolveUniquePlaylistPath({
  targetDirectory,
  requestedName,
  targetPath = null
}: ResolveUniquePlaylistPathRequest = {}): Promise<string> {
  if (!targetDirectory) {
    throw new Error('Target directory is required')
  }

  const baseName = targetPath ? extractPlaylistName(targetPath) : requestedName || ''
  const validationError = getPlaylistNameValidationError(baseName)
  if (validationError) {
    throw new Error(validationError)
  }

  const normalizedName = normalizePlaylistFileName(baseName)
  const resolvedDirectory = path.resolve(targetDirectory)
  let candidateIndex = 1

  while (true) {
    const candidateName = candidateIndex === 1 ? normalizedName : `${normalizedName} (${candidateIndex})`
    const candidatePath = path.join(resolvedDirectory, `${candidateName}.m3u`)
    const candidateExistsOnDisk = fs.existsSync(candidatePath)
    const candidateExistsInDb = await playlistIdentityExistsInDatabase(candidateName, candidatePath)

    if (!candidateExistsOnDisk && !candidateExistsInDb) {
      return candidatePath
    }

    candidateIndex += 1
  }
}

export async function savePlaylist(filePath: string, filePaths: string[]): Promise<SavePlaylistResult> {
  const playlistName = extractPlaylistName(filePath)
  const m3uContent = createM3uContent(filePaths)
  const saveResult = await saveM3uFile(filePath, m3uContent)

  if (!saveResult.success) {
    return { success: false, error: saveResult.error }
  }

  return { success: true, playlistName }
}

export async function persistPlaylistRecord(
  filePath: string,
  { allowExistingPath = false }: PersistPlaylistRecordOptions = {}
): Promise<PersistPlaylistRecordResult> {
  const playlistName = extractPlaylistName(filePath)
  const [existingPlaylistByPath, conflictingPlaylistByName] = await Promise.all([
    db.playlist.findUnique({ where: { path: filePath } }),
    findPlaylistByNameInsensitive(playlistName)
  ])

  if (existingPlaylistByPath && !allowExistingPath) {
    return {
      success: false,
      error: `Ya existe una playlist registrada en esta ruta.`
    }
  }

  if (conflictingPlaylistByName && conflictingPlaylistByName.path !== filePath) {
    return {
      success: false,
      error: `Ya existe una playlist llamada "${playlistName}".`
    }
  }

  const { totalDuration, totalTracks } = await getPlaylistDetails(filePath)
  const playlist = await updatePlaylist(filePath, playlistName, totalDuration, totalTracks, 0)

  return {
    success: true,
    path: filePath,
    playlistName,
    playlist
  }
}

export async function savePlaylistToTarget({
  filePaths,
  targetPath = null,
  targetDirectory = null,
  nombre = ''
}: SavePlaylistToTargetRequest = {}): Promise<PersistPlaylistRecordResult> {
  const normalizedFilePaths = sanitizePlaylistTrackPaths(filePaths)

  if (normalizedFilePaths.length === 0) {
    return {
      success: false,
      error: 'A playlist must have at least one song.'
    }
  }

  const playlistPath = await resolveUniquePlaylistPath({
    targetPath,
    targetDirectory,
    requestedName: nombre
  })
  const { success, error } = await savePlaylist(playlistPath, normalizedFilePaths)

  if (!success) {
    return { success: false, error }
  }

  invalidatePlaylistCache()
  return persistPlaylistRecord(playlistPath)
}

export async function exportPlaylistToTarget({
  filePaths,
  targetPath = null,
  targetDirectory = null,
  nombre = ''
}: SavePlaylistToTargetRequest = {}): Promise<ExportPlaylistResult> {
  const normalizedFilePaths = sanitizePlaylistTrackPaths(filePaths)

  if (normalizedFilePaths.length === 0) {
    return {
      success: false,
      error: 'A playlist must have at least one song.'
    }
  }

  const normalizedTargetPath =
    typeof targetPath === 'string' && targetPath.trim() !== '' ? path.resolve(targetPath) : null
  const normalizedTargetDirectory =
    typeof targetDirectory === 'string' && targetDirectory.trim() !== ''
      ? path.resolve(targetDirectory)
      : normalizedTargetPath
        ? path.dirname(normalizedTargetPath)
        : ''

  if (!normalizedTargetDirectory) {
    return {
      success: false,
      error: 'There is no valid destination folder.'
    }
  }

  const baseName = normalizedTargetPath ? extractPlaylistName(normalizedTargetPath) : nombre
  const validationError = getPlaylistNameValidationError(baseName)

  if (validationError) {
    return { success: false, error: validationError }
  }

  const exportPath = normalizedTargetPath
    ? normalizedTargetPath
    : path.join(
        normalizedTargetDirectory,
        `${normalizePlaylistFileName(baseName)}.m3u`
      )

  const { success, error } = await savePlaylist(exportPath, normalizedFilePaths)

  if (!success) {
    return { success: false, error }
  }

  return {
    success: true,
    path: exportPath,
    playlistName: extractPlaylistName(exportPath)
  }
}

export async function getPlaylistDetails(playlistPath: string): Promise<PlaylistDetails> {
  const m3uDirectory = path.dirname(playlistPath)
  const tracks = await processPlaylistTracks(playlistPath, m3uDirectory)
  const totalDuration = tracks.reduce((acc, track) => acc + track.duration, 0)
  const totalTracks = tracks.length
  const contador = getPlays(playlistPath)
  return { totalDuration, totalTracks, contador }
}

export async function getM3ufilepaths(filepath: string): Promise<string[]> {
  return readPlaylistTrackPaths(filepath)
}

export async function readPlaylistTrackPaths(filepath: string): Promise<string[]> {
  const fileContent = await fs.promises.readFile(filepath, 'utf-8')
  const baseDirectory = path.dirname(filepath)
  const absolutePaths = fileContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
  return absolutePaths.map((trackPath) => resolvePlaylistTrackPath(trackPath, baseDirectory))
}

async function findDuplicateImportedPlaylist({
  name,
  path: importedPath,
  trackSignature
}: {
  name: string
  path: string
  trackSignature: string
}): Promise<DuplicateImportedPlaylist> {
  const samePathPlaylist = await db.playlist.findUnique({
    where: { path: importedPath }
  })

  if (samePathPlaylist) {
    return {
      type: 'same-path',
      playlist: samePathPlaylist
    }
  }

  const sameNamePlaylists = await findPlaylistsByNameInsensitive(name)

  for (const playlist of sameNamePlaylists) {
    try {
      const existingTrackPaths = await readPlaylistTrackPaths(playlist.path)
      const existingTrackSignature = getPlaylistTrackSignature(existingTrackPaths)

      if (existingTrackSignature === trackSignature) {
        return {
          type: 'same-name-and-tracks',
          playlist
        }
      }
    } catch (error) {
      console.warn('Could not compare playlist during import:', playlist.path, getErrorMessage(error))
    }
  }

  if (sameNamePlaylists.length > 0) {
    return {
      type: 'same-name',
      playlist: sameNamePlaylists[0]
    }
  }

  return null
}

async function persistImportedPlaylistRecord(
  filePath: string,
  filePaths: string[]
): Promise<PersistPlaylistRecordResult> {
  const playlistName = extractPlaylistName(filePath)
  const existingPlaylistByPath = await db.playlist.findUnique({
    where: { path: filePath }
  })

  if (existingPlaylistByPath) {
    return {
      success: false,
      error: 'Ya existe una playlist registrada en esta ruta.'
    }
  }

  const conflictingPlaylistByName = await findPlaylistByNameInsensitive(playlistName)
  if (conflictingPlaylistByName) {
    return {
      success: false,
      error: `Ya existe una playlist llamada "${playlistName}".`
    }
  }

  const playlist: Playlist = await createPlaylistRecord(filePath, playlistName, filePaths.length, 0)

  return {
    success: true,
    path: filePath,
    playlistName,
    playlist
  }
}

export async function importPlaylistFile(filePath: string): Promise<PersistPlaylistRecordResult> {
  const resolvedFilePath = path.resolve(filePath)
  const playlistName = extractPlaylistName(resolvedFilePath)
  const validationError = getPlaylistNameValidationError(playlistName)

  if (validationError) {
    return {
      success: false,
      error: validationError
    }
  }

  const filePaths = await readPlaylistTrackPaths(resolvedFilePath)
  const normalizedFilePaths = sanitizePlaylistTrackPaths(filePaths)

  if (normalizedFilePaths.length === 0) {
    return {
      success: false,
      error: 'A playlist must have at least one song.'
    }
  }

  const trackSignature = getPlaylistTrackSignature(normalizedFilePaths)
  const duplicateImport = await findDuplicateImportedPlaylist({
    name: playlistName,
    path: resolvedFilePath,
    trackSignature
  })

  if (duplicateImport?.type === 'same-path') {
    return {
      success: false,
      error: 'Ya existe una playlist registrada en esta ruta.'
    }
  }

  if (duplicateImport?.type === 'same-name-and-tracks') {
    return {
      success: false,
      error: 'A playlist with the same name and songs already exists.'
    }
  }

  const needsCleanCopy =
    duplicateImport?.type === 'same-name' || hasDuplicatePlaylistTrackPaths(filePaths)

  if (!needsCleanCopy) {
    return persistImportedPlaylistRecord(resolvedFilePath, normalizedFilePaths)
  }

  const playlistPath = await resolveUniquePlaylistPath({
    targetPath: resolvedFilePath,
    targetDirectory: path.dirname(resolvedFilePath),
    requestedName: playlistName
  })
  const { success, error } = await savePlaylist(playlistPath, normalizedFilePaths)

  if (!success) {
    return { success: false, error }
  }

  return persistImportedPlaylistRecord(playlistPath, normalizedFilePaths)
}

export async function saveM3uRequest(
  request: SaveM3uRequest = {}
): Promise<PersistPlaylistRecordResult | ExportPlaylistResult> {
  const {
    filePaths = [],
    targetPath = null,
    targetDirectory = null,
    nombre = '',
    persist = true
  } = request
  const hasExplicitTargetPath = typeof targetPath === 'string' && targetPath.trim() !== ''
  const hasTargetDirectory = typeof targetDirectory === 'string' && targetDirectory.trim() !== ''
  const resolvedTargetPath = hasExplicitTargetPath
    ? targetPath
    : hasTargetDirectory
      ? null
      : await saveDialog(nombre)

  if (!resolvedTargetPath && !hasTargetDirectory) {
    return { success: false, error: 'Save canceled' }
  }

  const effectiveTargetDirectory =
    hasTargetDirectory
      ? targetDirectory
      : resolvedTargetPath
        ? path.dirname(resolvedTargetPath)
        : ''

  if (persist) {
    return savePlaylistToTarget({
      filePaths,
      targetPath: resolvedTargetPath,
      targetDirectory: effectiveTargetDirectory,
      nombre
    })
  }

  return exportPlaylistToTarget({
    filePaths,
    targetPath: resolvedTargetPath,
    targetDirectory: effectiveTargetDirectory,
    nombre
  })
}
