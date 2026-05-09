import path from 'path'
import { prisma } from '../../prisma.mjs'
import { discoverSubdirectories, indexDirectoryIncrementally, scanDirectoryAsync } from './directoryScanner.mjs'
import { startWatching } from './directoryWatcher.mjs'
import { getFileInfos } from './utils.mjs'

export const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.flac', '.ogg'])

export function isSupportedAudioFile(filePath) {
  return AUDIO_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

function uniquePaths(paths) {
  return [...new Set(paths.map((currentPath) => path.normalize(currentPath)))]
}

async function registerDirectoryTree(rootPath, audioDirs) {
  const rootDirectory = await prisma.directory.upsert({
    where: { path: rootPath },
    update: {},
    create: { path: rootPath }
  })

  for (const dirPath of audioDirs) {
    if (dirPath === rootPath) {
      continue
    }

    const parentPath = path.dirname(dirPath)
    const parentRecord = await prisma.directory.findUnique({
      where: { path: parentPath }
    })

    await prisma.directory.upsert({
      where: { path: dirPath },
      update: {},
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
  const recursiveAudioFiles = uniquePaths(await scanDirectoryAsync(normalizedRootPath, true))

  if (recursiveAudioFiles.length === 0) {
    return { success: false, message: 'No audio files found in the selected directory.' }
  }

  const audioDirs = uniquePaths(await discoverSubdirectories(normalizedRootPath))
  const dirsToRegister = uniquePaths([normalizedRootPath, ...audioDirs])

  await registerDirectoryTree(normalizedRootPath, dirsToRegister)
  invalidateDirectoryCache()
  startWatching(normalizedRootPath)
  startBackgroundIndexing(dirsToRegister, notifyRenderer)

  const songs = await getFileInfos(recursiveAudioFiles)

  return {
    success: true,
    message: 'Directory added successfully.',
    count: dirsToRegister.length,
    directories: dirsToRegister,
    songs
  }
}
