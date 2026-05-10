import fs from 'fs'
import path from 'path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const electron = require('electron')
const { app, ipcMain } = electron

function getFallbackDirectory() {
  const candidates = [app.getPath('music'), app.getPath('documents'), app.getPath('home')]

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return path.resolve(candidate)
    }
  }

  return path.resolve(process.cwd())
}

function sortEntriesByName(entries = []) {
  return entries.sort((left, right) =>
    left.name.localeCompare(right.name, undefined, {
      sensitivity: 'base'
    })
  )
}

async function resolveExistingDirectory(directoryPath) {
  if (typeof directoryPath === 'string' && directoryPath.trim() !== '') {
    try {
      const resolvedPath = path.resolve(directoryPath)
      const stats = await fs.promises.stat(resolvedPath)

      if (stats.isDirectory()) {
        return resolvedPath
      }
    } catch {
      // Fallback handled below.
    }
  }

  return getFallbackDirectory()
}

async function getDirectorySnapshot(directoryPath) {
  const currentPath = await resolveExistingDirectory(directoryPath)
  const entries = await fs.promises.readdir(currentPath, { withFileTypes: true })
  const directories = []
  const files = []

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

export function setupPlaylistSaveExplorerHandlers() {
  ipcMain.handle('get-playlist-save-directory', async (event, sourcePath) => {
    const directoryPath = await resolveExistingDirectory(sourcePath)

    return {
      path: directoryPath
    }
  })

  ipcMain.handle('list-playlist-save-directory', async (event, directoryPath) => {
    return getDirectorySnapshot(directoryPath)
  })
}
