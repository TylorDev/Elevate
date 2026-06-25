// @ts-nocheck
import { prisma } from '../../prisma.ts'
import { updateDirectoryStats } from '../utils/directoryScanner.ts'
import { stopWatching } from '../utils/directoryWatcher.ts'
import { getFileInfos } from '../utils/utils.ts'
import { getCachedAudioFiles } from './audioLibrary.ts'
import {
  getDirectoryChildrenCount,
  getDirectoryKind,
  getPathLeaf,
  getRandomIndex,
  isRootDirectoryRecord,
  normalizeSearchQuery,
  toNumber
} from './shared.ts'

let pendingDirectoriesRequest = null

export function clearPendingDirectoriesRequest() {
  pendingDirectoriesRequest = null
}

async function getDirectoryRecursiveStats(directoryPath) {
  const audioFiles = Array.from(
    new Set(await getCachedAudioFiles(directoryPath, { recursive: true }))
  )

  if (audioFiles.length === 0) {
    return {
      recursiveTotalTracks: 0,
      recursiveTotalDuration: 0
    }
  }

  const songs = await prisma.songs.findMany({
    where: {
      filepath: {
        in: audioFiles
      }
    },
    select: {
      duration: true
    }
  })

  return {
    recursiveTotalTracks: audioFiles.length,
    recursiveTotalDuration: songs.reduce((total, song) => total + toNumber(song.duration), 0)
  }
}

export async function enrichDirectory(directory) {
  if (!directory) {
    return null
  }

  const childrenCount = getDirectoryChildrenCount(directory)
  const directoryKind = getDirectoryKind({
    ...directory,
    childrenCount
  })
  const directTotals = {
    recursiveTotalTracks: toNumber(directory.totalTracks),
    recursiveTotalDuration: toNumber(directory.totalDuration)
  }
  const recursiveTotals =
    directoryKind === 'root' ? await getDirectoryRecursiveStats(directory.path) : directTotals

  return {
    ...directory,
    childrenCount,
    directoryKind,
    ...recursiveTotals
  }
}

export async function enrichDirectories(directories = []) {
  return Promise.all(directories.map((directory) => enrichDirectory(directory)))
}

export async function getDirectoryByPath(directoryPath) {
  return prisma.directory.findUnique({
    where: { path: directoryPath },
    include: {
      _count: {
        select: {
          children: true
        }
      }
    }
  })
}

export async function getDirectoryBranch(directoryId) {
  const directories = await prisma.directory.findMany({
    select: {
      id: true,
      path: true,
      parentId: true
    }
  })
  const childrenByParentId = new Map()

  for (const directory of directories) {
    const currentChildren = childrenByParentId.get(directory.parentId) || []
    currentChildren.push(directory)
    childrenByParentId.set(directory.parentId, currentChildren)
  }

  const branch = []
  const stack = [...(childrenByParentId.get(directoryId) || [])]

  while (stack.length > 0) {
    const directory = stack.pop()
    branch.push(directory)
    stack.push(...(childrenByParentId.get(directory.id) || []))
  }

  return branch
}

export async function getDirectoryAudioFiles(directory) {
  const enrichedDirectory = directory?.directoryKind ? directory : await enrichDirectory(directory)

  if (!enrichedDirectory?.path) {
    return []
  }

  const recursive = enrichedDirectory?.directoryKind === 'root'

  return getCachedAudioFiles(enrichedDirectory.path, { recursive })
}

export async function getAudioInDirectory(directoryPath) {
  const directory = await getDirectoryByPath(directoryPath)

  if (!directory) {
    return []
  }

  const directoryData = await enrichDirectory(directory)
  const audioFiles = await getDirectoryAudioFiles(directoryData)
  const uniqueAudioFiles = Array.from(new Set(audioFiles))

  return getFileInfos(uniqueAudioFiles, { includePicture: false })
}

export async function deleteDirectory(dirPath, { invalidateDirectoryCache }) {
  try {
    const directory = await getDirectoryByPath(dirPath)

    if (!directory) {
      return { success: false, message: 'Directory not found.' }
    }

    if (getDirectoryChildrenCount(directory) > 0) {
      return {
        success: false,
        message: 'Directories with imported children must be removed as a branch.'
      }
    }

    await stopWatching(dirPath)
    await prisma.directory.delete({
      where: { path: dirPath }
    })
    invalidateDirectoryCache(dirPath)
    return { success: true, message: 'Directory deleted successfully.' }
  } catch (error) {
    console.error('Error deleting directory:', error)
    return { success: false, message: 'Error deleting directory.' }
  }
}

export async function deleteDirectoryBranch(request, { invalidateDirectoryCache }) {
  try {
    const dirPath = typeof request === 'string' ? request : request?.path

    if (!dirPath || typeof dirPath !== 'string') {
      return { success: false, message: 'Directory path is required.' }
    }

    const directory = await getDirectoryByPath(dirPath)

    if (!directory) {
      return { success: false, message: 'Directory not found.' }
    }

    const descendants = await getDirectoryBranch(directory.id)
    const deletedPaths = [directory.path, ...descendants.map((child) => child.path)]

    for (const currentPath of deletedPaths) {
      await stopWatching(currentPath).catch((error) => {
        console.error(`Error stopping watcher for ${currentPath}:`, error)
      })
    }

    await prisma.directory.delete({
      where: { path: dirPath }
    })

    invalidateDirectoryCache(dirPath)

    return {
      success: true,
      message: 'Directory branch removed successfully.',
      deletedDirectories: deletedPaths.length,
      deletedPaths
    }
  } catch (error) {
    console.error('Error deleting directory branch:', error)
    return { success: false, message: 'Error deleting directory branch.' }
  }
}

export async function getAllDirectories() {
  if (pendingDirectoriesRequest) {
    return pendingDirectoriesRequest
  }

  pendingDirectoriesRequest = (async () => {
    const directories = await prisma.directory.findMany({
      include: {
        _count: {
          select: {
            children: true
          }
        }
      }
    })

    const unscanned = directories.filter((d) => !d.lastScannedAt)
    if (unscanned.length > 0) {
      for (const dir of unscanned) {
        try {
          const stats = await updateDirectoryStats(dir.path)
          dir.totalTracks = stats.totalTracks
          dir.totalDuration = stats.totalDuration
        } catch (err) {
          console.error(`Error initial scan for ${dir.path}:`, err.message)
        }
      }
    }

    return enrichDirectories(directories)
  })().finally(() => {
    pendingDirectoriesRequest = null
  })

  return pendingDirectoriesRequest
}

export async function getDirectoriesNumber() {
  const directories = await prisma.directory.findMany({
    include: {
      _count: {
        select: {
          children: true
        }
      }
    }
  })

  return directories.filter((directory) => !isRootDirectoryRecord(directory)).length
}

export async function searchDirectoriesPage(request = {}) {
  const query = normalizeSearchQuery(request?.query)
  const page = Math.max(Number(request?.page) || 1, 1)
  const pageSize = Math.min(Math.max(Number(request?.pageSize) || 30, 1), 60)

  if (!query) {
    return {
      items: [],
      page,
      pageSize,
      total: 0,
      hasMore: false
    }
  }

  const matchingDirectories = await prisma.directory.findMany({
    where: {
      path: {
        contains: query
      }
    },
    include: {
      _count: {
        select: {
          children: true
        }
      }
    }
  })

  const sortedDirectories = matchingDirectories
    .slice()
    .sort((left, right) =>
      getPathLeaf(left.path).localeCompare(getPathLeaf(right.path), undefined, {
        sensitivity: 'base'
      })
    )

  const start = (page - 1) * pageSize
  const pagedDirectories = await enrichDirectories(sortedDirectories.slice(start, start + pageSize))
  const items = pagedDirectories.map((directory) => {
    const visibleTracks =
      directory.directoryKind === 'root'
        ? directory.recursiveTotalTracks
        : directory.totalTracks
    const visibleDuration =
      directory.directoryKind === 'root'
        ? directory.recursiveTotalDuration
        : directory.totalDuration

    return {
      type: 'directory',
      id: directory.id,
      title: getPathLeaf(directory.path),
      subtitle:
        directory.directoryKind === 'root'
          ? `Root - ${visibleTracks ?? 0} tracks`
          : `${visibleTracks ?? 0} tracks`,
      meta: directory.path,
      actionPayload: {
        path: directory.path
      },
      path: directory.path,
      totalTracks: directory.totalTracks,
      totalDuration: directory.totalDuration,
      recursiveTotalTracks: directory.recursiveTotalTracks,
      recursiveTotalDuration: directory.recursiveTotalDuration,
      visibleTracks,
      visibleDuration,
      directoryKind: directory.directoryKind
    }
  })

  return {
    items,
    page,
    pageSize,
    total: sortedDirectories.length,
    hasMore: start + items.length < sortedDirectories.length
  }
}

export async function getRandomDirectory() {
  try {
    const directories = await prisma.directory.findMany({
      include: {
        _count: {
          select: {
            children: true
          }
        }
      },
      orderBy: {
        id: 'asc'
      }
    })
    const normalDirectories = directories.filter((directory) => !isRootDirectoryRecord(directory))

    if (normalDirectories.length === 0) return null

    const randomIndex = getRandomIndex(normalDirectories.length)

    return enrichDirectory(normalDirectories[randomIndex])
  } catch (error) {
    console.error('Error fetching random directory:', error)
    return null
  }
}
