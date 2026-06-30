import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

export function getFallbackDirectory(): string {
  const candidates = [app.getPath('music'), app.getPath('documents'), app.getPath('home')]

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return path.resolve(candidate)
    }
  }

  return path.resolve(process.cwd())
}

export async function resolveExistingDirectory(directoryPath: unknown): Promise<string> {
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

export async function resolveStrictDirectory(directoryPath: unknown): Promise<string> {
  if (typeof directoryPath !== 'string' || directoryPath.trim() === '') {
    throw new Error('Invalid folder path.')
  }

  const resolvedPath = path.resolve(directoryPath)

  let stats
  try {
    stats = await fs.promises.stat(resolvedPath)
  } catch {
    throw new Error('The selected folder does not exist.')
  }

  if (!stats.isDirectory()) {
    throw new Error('The selected path is not a directory.')
  }

  return resolvedPath
}
