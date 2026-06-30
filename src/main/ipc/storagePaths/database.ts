import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app } from 'electron'
import { getResolvedUserDataRoot } from './runtime.ts'

function getStableMainModuleDirectory(): string {
  const moduleDirectory = dirname(fileURLToPath(import.meta.url))
  const parentDirectory = dirname(moduleDirectory)

  if (moduleDirectory.endsWith(join('ipc', 'storagePaths')) || parentDirectory.endsWith('ipc')) {
    return resolve(moduleDirectory, '../..')
  }

  return moduleDirectory
}

export function getDatabasePath(): string {
  if (process.env.DATABASE_URL?.startsWith('file:')) {
    return resolve(process.env.DATABASE_URL.replace(/^file:/, ''))
  }

  if (!app.isPackaged) return resolve('prisma/dev.db')
  return join(getResolvedUserDataRoot(), 'elevate.db')
}

export function getTemplateDatabaseCandidates(): string[] {
  return [
    resolve('prisma/template.db'),
    join(app.getAppPath(), 'prisma/template.db'),
    join(process.resourcesPath || '', 'prisma/template.db'),
    join(getStableMainModuleDirectory(), '../../prisma/template.db')
  ]
}

export function findTemplateDatabasePath(): string | null {
  return getTemplateDatabaseCandidates().find((candidate) => existsSync(candidate)) || null
}
