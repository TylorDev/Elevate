// @ts-nocheck
import { promises as fs } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { getStoragePaths } from './storagePaths.ts'

const DEFAULT_PRISMA_WAIT_TIMEOUT_MS = 15_000

const databaseState = {
  isInitializing: false,
  isReady: false,
  error: null,
  initStartedAt: null,
  initFinishedAt: null
}

let prismaClient = null
let initializePrismaPromise = null

function toFileUrl(path) {
  return `file:${path.replace(/\\/g, '/')}`
}

function getDatabasePath() {
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('file:')) {
    return null
  }

  if (process.env.DATABASE_URL?.startsWith('file:')) {
    return resolve(process.env.DATABASE_URL.replace(/^file:/, ''))
  }

  return getStoragePaths().databasePath
}

async function pathExists(path) {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

async function ensureDatabaseFile(databasePath) {
  if (!databasePath || await pathExists(databasePath)) {
    return
  }

  await fs.mkdir(dirname(databasePath), { recursive: true })

  const templateDatabase = getStoragePaths().templateDatabasePath
  if (templateDatabase) {
    await fs.copyFile(templateDatabase, databasePath)
  }
}

async function getDatabaseUrl() {
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('file:')) {
    return process.env.DATABASE_URL
  }

  const databasePath = getDatabasePath()
  await ensureDatabaseFile(databasePath)
  return toFileUrl(databasePath)
}

const writeOperations = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany'
])
let writeQueue = Promise.resolve()

function serializeWrite(operation) {
  const run = writeQueue.then(operation, operation)
  writeQueue = run.catch(() => {})
  return run
}

function createPrismaUnavailableError(message = 'Prisma is still initializing.') {
  const error = new Error(message)
  error.code = databaseState.error ? 'DATABASE_INIT_FAILED' : 'DATABASE_INITIALIZING'
  error.databaseState = getPrismaStatus()
  return error
}

function createPrismaTimeoutError(timeoutMs) {
  return createPrismaUnavailableError(`Prisma did not become ready within ${timeoutMs}ms.`)
}

async function getReadyPrismaClient(timeoutMs = DEFAULT_PRISMA_WAIT_TIMEOUT_MS) {
  if (prismaClient) {
    return prismaClient
  }

  if (databaseState.error) {
    throw createPrismaUnavailableError(databaseState.error?.message || 'Prisma initialization failed.')
  }

  if (!initializePrismaPromise) {
    void initializePrisma()
  }

  let timeoutId
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(createPrismaTimeoutError(timeoutMs)), timeoutMs)
  })

  try {
    await Promise.race([initializePrismaPromise, timeoutPromise])
  } finally {
    clearTimeout(timeoutId)
  }

  if (!prismaClient) {
    throw createPrismaUnavailableError()
  }

  return prismaClient
}

function createDeferredPrismaAccessor(path = []) {
  return new Proxy(function deferredPrismaAccessor() {}, {
    get(_target, property) {
      if (property === 'then') {
        return undefined
      }

      if (property === Symbol.toStringTag) {
        return 'DeferredPrismaAccessor'
      }

      return createDeferredPrismaAccessor([...path, property])
    },
    apply(_target, _thisArg, args) {
      return getReadyPrismaClient().then((client) => {
        const methodName = path[path.length - 1]
        const parent = path.slice(0, -1).reduce((current, key) => current?.[key], client)
        const method = parent?.[methodName]

        if (typeof method !== 'function') {
          throw new Error(`Prisma method is unavailable: ${path.join('.')}`)
        }

        return method.apply(parent, args)
      })
    }
  })
}

export const prisma = createDeferredPrismaAccessor()

export function getPrismaStatus() {
  return {
    isInitializing: databaseState.isInitializing,
    isReady: databaseState.isReady,
    error: databaseState.error
      ? {
          message: databaseState.error.message,
          code: databaseState.error.code || null,
          stack: databaseState.error.stack || null
        }
      : null,
    initStartedAt: databaseState.initStartedAt,
    initFinishedAt: databaseState.initFinishedAt
  }
}

export async function waitForPrisma(options = {}) {
  return getReadyPrismaClient(options.timeoutMs)
}

export async function initializePrisma() {
  if (initializePrismaPromise) {
    return initializePrismaPromise
  }

  databaseState.isInitializing = true
  databaseState.isReady = false
  databaseState.error = null
  databaseState.initStartedAt = new Date().toISOString()
  databaseState.initFinishedAt = null

  initializePrismaPromise = initializePrismaClient()
    .then((client) => {
      prismaClient = client
      databaseState.isReady = true
      return client
    })
    .catch((error) => {
      databaseState.error = error
      throw error
    })
    .finally(() => {
      databaseState.isInitializing = false
      databaseState.initFinishedAt = new Date().toISOString()
    })

  return initializePrismaPromise
}

async function initializePrismaClient() {
  const [{ PrismaLibSql }, { PrismaClient }] = await Promise.all([
    import('@prisma/adapter-libsql'),
    import('./generated/prisma/client.ts')
  ])

  const adapter = new PrismaLibSql({
    url: await getDatabaseUrl()
  })

  const client = new PrismaClient({ adapter }).$extends({
    query: {
      $allModels: {
        $allOperations({ operation, query, args }) {
          if (!writeOperations.has(operation)) {
            return query(args)
          }

          return serializeWrite(() => query(args))
        }
      }
    }
  })

  await client.$executeRawUnsafe('PRAGMA foreign_keys = ON')
  await client.$executeRawUnsafe('PRAGMA journal_mode = WAL')
  await client.$executeRawUnsafe('PRAGMA busy_timeout = 5000')
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "VisualizerPresetList" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "VisualizerSettings" (
      "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
      "cycleDurationMs" INTEGER NOT NULL DEFAULT 6000,
      "presetSourceMode" TEXT NOT NULL DEFAULT 'ALL',
      "presetSourceListId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "VisualizerSettings_presetSourceListId_fkey"
        FOREIGN KEY ("presetSourceListId")
        REFERENCES "VisualizerPresetList" ("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE
    )
  `)
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "VisualizerPresetFavorite" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "presetName" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await client.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "VisualizerPresetFavorite_presetName_key"
      ON "VisualizerPresetFavorite"("presetName")
  `)
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "VisualizerPresetListItem" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "listId" TEXT NOT NULL,
      "presetName" TEXT NOT NULL,
      "position" INTEGER NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "VisualizerPresetListItem_listId_fkey"
        FOREIGN KEY ("listId")
        REFERENCES "VisualizerPresetList" ("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
    )
  `)
  await client.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "VisualizerPresetListItem_listId_presetName_key"
      ON "VisualizerPresetListItem"("listId", "presetName")
  `)
  await client.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "VisualizerPresetListItem_listId_position_idx"
      ON "VisualizerPresetListItem"("listId", "position")
  `)
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "VisualizerSourceAssociation" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "sourceType" TEXT NOT NULL,
      "sourceId" TEXT NOT NULL,
      "listId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "VisualizerSourceAssociation_listId_fkey"
        FOREIGN KEY ("listId")
        REFERENCES "VisualizerPresetList" ("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
    )
  `)
  await client.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "VisualizerSourceAssociation_sourceType_sourceId_key"
      ON "VisualizerSourceAssociation"("sourceType", "sourceId")
  `)
  await client.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "VisualizerSourceAssociation_listId_idx"
      ON "VisualizerSourceAssociation"("listId")
  `)

  return client
}
