// @ts-nocheck
import fs from 'fs'
import path from 'path'
import { app, ipcMain } from 'electron'
import { importPlaylistFile } from './ipc/playlistHandlers.ts'
import { getFileInfos } from './ipc/utils/utils.ts'
import { addDirectoryToLibrary, isSupportedMediaFile } from './ipc/utils/libraryIngestion.ts'
import { resolveImportableAudioPaths } from './ipc/utils/mediaFileSupport.ts'

const pendingLaunchPayloads = []
let rendererLaunchChannelReady = false
const WINDOWS_OPEN_BATCH_MS = 450
let pendingDispatchRequests = []
let dispatchTimer = null

function createEmptyPayload() {
  return {
    kind: 'empty',
    files: [],
    directories: [],
    songs: [],
    hasDirectories: false,
    queueName: '',
    startIndex: 0
  }
}

function isPlaylistFile(filePath) {
  return path.extname(filePath).toLowerCase() === '.m3u'
}

function normalizeExistingPath(rawValue, workingDirectory) {
  if (typeof rawValue !== 'string') {
    return null
  }

  const trimmed = rawValue.trim().replace(/^"(.*)"$/, '$1')
  if (!trimmed || trimmed.startsWith('-')) {
    return null
  }

  const resolvedPath = path.isAbsolute(trimmed)
    ? path.normalize(trimmed)
    : path.resolve(workingDirectory, trimmed)

  if (!fs.existsSync(resolvedPath)) {
    return null
  }

  return resolvedPath
}

function getQueueName(kind, files, directories) {
  if (kind === 'single-file') {
    return files[0]
  }

  if (kind === 'directory') {
    return directories[0]
  }

  return 'Argv Queue'
}

function getPayloadKind(files, directories) {
  if (directories.length === 1 && files.length === 0) {
    return 'directory'
  }

  if (directories.length === 0 && files.length === 1) {
    return 'single-file'
  }

  if (directories.length === 0 && files.length > 1) {
    return 'multi-file'
  }

  if (directories.length > 0 || files.length > 0) {
    return 'mixed'
  }

  return 'empty'
}

function appendUniqueSongs(targetSongs, incomingSongs, seenSongPaths) {
  for (const song of incomingSongs) {
    if (!song?.filePath || seenSongPaths.has(song.filePath)) {
      continue
    }

    seenSongPaths.add(song.filePath)
    targetSongs.push(song)
  }
}

function summarizePayload(payload) {
  return {
    kind: payload.kind,
    files: payload.files?.length || 0,
    directories: payload.directories?.length || 0,
    songs: payload.songs?.length || 0,
    queueName: payload.queueName,
    playlistPath: payload.playlistPath || null
  }
}

function normalizeLaunchEntries(rawArgs, workingDirectory = process.cwd()) {
  const appPath = path.normalize(app.getAppPath())
  const cwdPath = path.normalize(process.cwd())
  const workingDirectoryPath = path.normalize(workingDirectory)
  const seen = new Set()
  const orderedEntries = []

  for (const rawArg of rawArgs) {
    const resolvedPath = normalizeExistingPath(rawArg, workingDirectory)
    if (!resolvedPath) {
      continue
    }

    if (
      resolvedPath === appPath ||
      resolvedPath === cwdPath ||
      resolvedPath === workingDirectoryPath
    ) {
      continue
    }

    if (seen.has(resolvedPath)) {
      continue
    }

    seen.add(resolvedPath)

    const stats = fs.statSync(resolvedPath)
    if (stats.isDirectory()) {
      orderedEntries.push({ type: 'directory', path: resolvedPath })
      continue
    }

    if (stats.isFile() && isSupportedMediaFile(resolvedPath)) {
      orderedEntries.push({ type: 'file', path: resolvedPath })
      continue
    }

    if (stats.isFile() && isPlaylistFile(resolvedPath)) {
      orderedEntries.push({ type: 'playlist', path: resolvedPath })
    }
  }

  return orderedEntries
}

async function processLaunchEntries(
  orderedEntries,
  {
    notifyRenderer = () => {},
    invalidateDirectoryCache = () => {}
  } = {}
) {
  if (orderedEntries.length === 0) {
    return createEmptyPayload()
  }

  const files = []
  const directories = []
  const songs = []
  const seenSongPaths = new Set()
  const playlistEntries = orderedEntries.filter((entry) => entry.type === 'playlist')

  if (playlistEntries.length === 1 && orderedEntries.length === 1) {
    let importedPlaylist

    try {
      importedPlaylist = await importPlaylistFile(playlistEntries[0].path)
    } catch (error) {
      notifyRenderer({
        type: 'toast',
        variant: 'error',
        message: error?.message || 'No se pudo importar la playlist.'
      })
      return createEmptyPayload()
    }

    if (!importedPlaylist?.success) {
      notifyRenderer({
        type: 'toast',
        variant: 'error',
        message: importedPlaylist?.error || 'No se pudo importar la playlist.'
      })
      return createEmptyPayload()
    }

    notifyRenderer({
      type: 'toast',
      variant: 'success',
      message: `Playlist importada: ${importedPlaylist.playlistName}`
    })

    return {
      kind: 'playlist-import',
      files: [],
      directories: [],
      songs: [],
      hasDirectories: false,
      queueName: importedPlaylist.playlistName || importedPlaylist.path,
      startIndex: 0,
      playlistPath: importedPlaylist.path,
      playlistName: importedPlaylist.playlistName
    }
  }

  const filePaths = orderedEntries
    .filter((entry) => entry.type === 'file')
    .map((entry) => entry.path)

  if (filePaths.length > 0) {
    const importableFilePaths = await resolveImportableAudioPaths(filePaths)
    files.push(...importableFilePaths)
    const fileSongs = await getFileInfos(importableFilePaths)
    appendUniqueSongs(songs, fileSongs, seenSongPaths)
  }

  const directoryEntries = orderedEntries.filter((entry) => entry.type === 'directory')
  for (const entry of directoryEntries) {
    directories.push(entry.path)
    const result = await addDirectoryToLibrary(entry.path, {
      notifyRenderer,
      invalidateDirectoryCache
    })

    if (result.success && result.songs?.length) {
      appendUniqueSongs(songs, result.songs, seenSongPaths)
    }
  }

  const kind = getPayloadKind(files, directories)
  return {
    kind,
    files,
    directories,
    songs,
    hasDirectories: directories.length > 0,
    queueName: getQueueName(kind, files, directories),
    startIndex: 0
  }
}

async function dispatchPayloadToRenderer(payload, mainWindow) {
  if (
    !payload ||
    payload.kind === 'empty' ||
    (payload.kind !== 'playlist-import' && payload.songs.length === 0)
  ) {
    return
  }

  if (
    rendererLaunchChannelReady &&
    mainWindow &&
    !mainWindow.isDestroyed() &&
    !mainWindow.webContents.isDestroyed()
  ) {
    console.info('[argv/main] sending payload to renderer', summarizePayload(payload))
    mainWindow.webContents.send('argv-files-processed', payload)
    return
  }

  console.info('[argv/main] queueing pending payload', summarizePayload(payload))
  pendingLaunchPayloads.push(payload)
}

async function flushDispatchBuffer(mainWindow) {
  dispatchTimer = null

  const requests = pendingDispatchRequests
  pendingDispatchRequests = []

  const mergedEntries = []
  const seenEntryPaths = new Set()

  for (const request of requests) {
    for (const entry of request.entries) {
      if (seenEntryPaths.has(entry.path)) {
        continue
      }

      seenEntryPaths.add(entry.path)
      mergedEntries.push(entry)
    }
  }

  const mergedPayload = await processLaunchEntries(mergedEntries, {
    notifyRenderer: requests[0]?.notifyRenderer,
    invalidateDirectoryCache: requests[0]?.invalidateDirectoryCache
  })

  console.info('[argv/main] flushing request batch', {
    count: requests.length,
    entries: mergedEntries,
    merged: summarizePayload(mergedPayload)
  })

  await dispatchPayloadToRenderer(mergedPayload, mainWindow)
}

function enqueueLaunchRequest(request, mainWindow, batchWindowMs) {
  if (!request || !request.entries || request.entries.length === 0) {
    return
  }

  pendingDispatchRequests.push(request)
  console.info('[argv/main] buffered request', {
    buffered: pendingDispatchRequests.length,
    entries: request.entries
  })

  if (dispatchTimer) {
    clearTimeout(dispatchTimer)
  }

  dispatchTimer = setTimeout(async () => {
    await flushDispatchBuffer(mainWindow)
  }, batchWindowMs)
}

export function markLaunchWindowPending() {
  rendererLaunchChannelReady = false
}

export function setupArgvHandlers() {
  ipcMain.handle('get-argv-files', async () => {
    rendererLaunchChannelReady = true
    const payloads = pendingLaunchPayloads.slice()
    pendingLaunchPayloads.length = 0
    console.info('[argv/main] renderer requested pending payloads', {
      pending: payloads.length,
      payloads: payloads.map(summarizePayload)
    })
    return payloads
  })

  ipcMain.handle('process-dropped-paths', async (_, droppedPaths = []) => {
    return processLaunchArgs(droppedPaths, {
      workingDirectory: process.cwd(),
      notifyRenderer: (message) => {
        if (message) {
          _.sender.send('notification', message)
        }
      }
    })
  })

}

export async function processLaunchArgs(
  rawArgs,
  {
    workingDirectory = process.cwd(),
    notifyRenderer = () => {},
    invalidateDirectoryCache = () => {}
  } = {}
) {
  const orderedEntries = normalizeLaunchEntries(rawArgs, workingDirectory)

  console.info('[argv/main] normalized launch entries', {
    rawArgs,
    workingDirectory,
    entries: orderedEntries
  })

  const payload = await processLaunchEntries(orderedEntries, {
    notifyRenderer,
    invalidateDirectoryCache
  })

  console.info('[argv/main] processed launch payload', summarizePayload(payload))
  return payload
}

export async function processAndDispatchLaunchArgs(
  rawArgs,
  {
    mainWindow,
    workingDirectory = process.cwd(),
    notifyRenderer = () => {},
    invalidateDirectoryCache = () => {},
    batchWindowMs = WINDOWS_OPEN_BATCH_MS
  } = {}
) {
  const orderedEntries = normalizeLaunchEntries(rawArgs, workingDirectory)

  console.info('[argv/main] normalized launch entries', {
    rawArgs,
    workingDirectory,
    entries: orderedEntries
  })

  if (orderedEntries.length === 0) {
    return createEmptyPayload()
  }

  if (batchWindowMs > 0) {
    enqueueLaunchRequest({
      entries: orderedEntries,
      notifyRenderer,
      invalidateDirectoryCache
    }, mainWindow, batchWindowMs)

    return {
      kind: getPayloadKind(
        orderedEntries.filter((entry) => entry.type === 'file').map((entry) => entry.path),
        orderedEntries.filter((entry) => entry.type === 'directory').map((entry) => entry.path)
      ),
      files: orderedEntries.filter((entry) => entry.type === 'file').map((entry) => entry.path),
      directories: orderedEntries.filter((entry) => entry.type === 'directory').map((entry) => entry.path),
      songs: [],
      hasDirectories: orderedEntries.some((entry) => entry.type === 'directory'),
      queueName: 'Argv Queue',
      startIndex: 0
    }
  }

  const payload = await processLaunchEntries(orderedEntries, {
    notifyRenderer,
    invalidateDirectoryCache
  })

  console.info('[argv/main] processed launch payload', summarizePayload(payload))
  await dispatchPayloadToRenderer(payload, mainWindow)
  return payload
}
