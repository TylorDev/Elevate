import path from 'path'
import { prisma } from '../../prisma.mjs'
import { discoverSubdirectories, indexDirectoryIncrementally, scanDirectoryAsync } from './directoryScanner.mjs'
import { startWatching } from './directoryWatcher.mjs'
import { getFileInfos } from './utils.mjs'
import {
  isSupportedAudioFile,
  isSupportedMediaFile,
  resolveImportableAudioPaths
} from './mediaFileSupport.mjs'

export { isSupportedAudioFile, isSupportedMediaFile }

function uniquePaths(paths) {
  return [...new Set(paths.map((currentPath) => path.normalize(currentPath)))]
}

function getPathDepth(dirPath) {
  return path
    .normalize(dirPath)
    .split(path.sep)
    .filter(Boolean).length
}

async function registerDirectoryTree(rootPath, audioDirs) {
  // Check if the parent directory is already registered in the library.
  // If it is, this import is a child of an existing branch, not a new root.
  const parentPath = path.dirname(rootPath)
  const existingParent = parentPath !== rootPath
    ? await prisma.directory.findUnique({ where: { path: parentPath } })
    : null

  const rootDirectory = await prisma.directory.upsert({
    where: { path: rootPath },
    update: { parentId: existingParent?.id ?? null },
    create: { path: rootPath, parentId: existingParent?.id ?? null }
  })

  const sortedDirectories = uniquePaths(audioDirs)
    .filter((dirPath) => dirPath !== rootPath)
    .sort((leftPath, rightPath) => {
      const depthDifference = getPathDepth(leftPath) - getPathDepth(rightPath)

      if (depthDifference !== 0) {
        return depthDifference
      }

      return leftPath.localeCompare(rightPath)
    })

  for (const dirPath of sortedDirectories) {
    if (dirPath === rootPath) {
      continue
    }

    const parentPath = path.dirname(dirPath)
    const parentRecord = await prisma.directory.findUnique({
      where: { path: parentPath }
    })

    await prisma.directory.upsert({
      where: { path: dirPath },
      update: {
        parentId: parentRecord?.id || rootDirectory.id
      },
      create: {
        path: dirPath,
        parentId: parentRecord?.id || rootDirectory.id
      }
    })
  }

  return rootDirectory
}

function startBackgroundIndexing(dirPaths, notifyRenderer) {
  setTimeout(async () => {
    for (const dirPath of dirPaths) {
      try {
        const stats = await indexDirectoryIncrementally(dirPath, (progress) => {
          notifyRenderer(
            JSON.stringify({
              type: 'scan-progress',
              ...progress
            })
          )
        })

        await prisma.directory.updateMany({
          where: { path: dirPath },
          data: {
            totalTracks: stats.totalTracks,
            totalDuration: stats.totalDuration,
            lastScannedAt: new Date()
          }
        })
      } catch (error) {
        console.error(`Error indexing ${dirPath}:`, error.message)
      }
    }

    notifyRenderer('[directory-changed]')
  }, 0)
}

export async function addDirectoryToLibrary(
  rootPath,
  {
    notifyRenderer = () => {},
    invalidateDirectoryCache = () => {}
  } = {}
) {
  const normalizedRootPath = path.normalize(rootPath)

  // If this directory is already registered in the library (as root or child),
  // skip re-registration to avoid detaching it from its branch or causing
  // redundant re-indexing.
  const existingDirectory = await prisma.directory.findUnique({
    where: { path: normalizedRootPath }
  })

  if (existingDirectory) {
    return {
      success: true,
      message: 'This directory is already imported in your library.',
      alreadyImported: true,
      count: 0,
      directories: [],
      songs: []
    }
  }

  const recursiveAudioFiles = uniquePaths(await scanDirectoryAsync(normalizedRootPath, true))

  if (recursiveAudioFiles.length === 0) {
    return { success: false, message: 'No audio files found in the selected directory.' }
  }

  const audioDirs = uniquePaths(await discoverSubdirectories(normalizedRootPath))
  const dirsToRegister = uniquePaths([normalizedRootPath, ...audioDirs])

  await registerDirectoryTree(normalizedRootPath, dirsToRegister)
  invalidateDirectoryCache()
  void startWatching(normalizedRootPath)
  startBackgroundIndexing(dirsToRegister, notifyRenderer)

  const importableAudioFiles = await resolveImportableAudioPaths(recursiveAudioFiles)
  const songs = await getFileInfos(importableAudioFiles)

  return {
    success: true,
    message: 'Directory added successfully.',
    count: dirsToRegister.length,
    directories: dirsToRegister,
    songs
  }
}
