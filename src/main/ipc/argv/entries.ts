import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { isSupportedMediaFile } from '../../utils/libraryIngestion.ts'
import type { LaunchEntry } from '../../Types/argv.ts'

export function isPlaylistFile(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === '.m3u'
}

export function normalizeExistingPath(rawValue: unknown, workingDirectory: string): string | null {
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

export function normalizeLaunchEntries(
  rawArgs: readonly unknown[],
  workingDirectory = process.cwd()
): LaunchEntry[] {
  const appPath = path.normalize(app.getAppPath())
  const cwdPath = path.normalize(process.cwd())
  const workingDirectoryPath = path.normalize(workingDirectory)
  const seen = new Set<string>()
  const orderedEntries: LaunchEntry[] = []

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
