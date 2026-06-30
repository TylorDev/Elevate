import fs from 'node:fs'
import path from 'node:path'
import { resolveStrictDirectory } from './paths.ts'
import type {
  PlaylistSaveDirectoryEntry,
  PlaylistSaveDirectorySnapshot,
  PlaylistSaveFileEntry
} from '../../Types/playlistSaveExplorerHandlers.ts'

function sortEntriesByName<T extends { name: string }>(entries: T[]): T[] {
  return entries.sort((left, right) =>
    left.name.localeCompare(right.name, undefined, {
      sensitivity: 'base'
    })
  )
}

export async function getDirectorySnapshot(
  directoryPath: unknown
): Promise<PlaylistSaveDirectorySnapshot> {
  const currentPath = await resolveStrictDirectory(directoryPath)
  const entries = await fs.promises.readdir(currentPath, { withFileTypes: true })
  const directories: PlaylistSaveDirectoryEntry[] = []
  const files: PlaylistSaveFileEntry[] = []

  for (const entry of entries) {
    const entryPath = path.join(currentPath, entry.name)

    if (entry.isDirectory()) {
      directories.push({
        name: entry.name,
        path: entryPath,
        type: 'directory'
      })
      continue
    }

    if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.m3u') {
      files.push({
        name: entry.name,
        path: entryPath,
        type: 'file'
      })
    }
  }

  const parentPath = path.dirname(currentPath)

  return {
    currentPath,
    parentPath: parentPath !== currentPath ? parentPath : null,
    directories: sortEntriesByName(directories),
    files: sortEntriesByName(files)
  }
}
