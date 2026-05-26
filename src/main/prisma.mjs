
import { existsSync, copyFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from './generated/prisma/client.ts'
import { getStoragePaths } from './storagePaths.mjs'

const require = createRequire(import.meta.url)
const { app } = require('electron')

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

function ensureDatabaseFile(databasePath) {
  if (!databasePath || existsSync(databasePath)) {
    return
  }

  mkdirSync(dirname(databasePath), { recursive: true })

  const templateDatabase = getStoragePaths().templateDatabasePath
  if (templateDatabase) {
    copyFileSync(templateDatabase, databasePath)
  }
}

function getDatabaseUrl() {
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('file:')) {
    return process.env.DATABASE_URL
  }

  const databasePath = getDatabasePath()
  ensureDatabaseFile(databasePath)
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

// Prisma client is initialized lazily inside initializePrisma() to ensure
// app paths and native bindings resolve correctly after app.whenReady().
export let prisma = null

export async function initializePrisma() {
  const adapter = new PrismaLibSql({
    url: getDatabaseUrl()
  })

  prisma = new PrismaClient({ adapter }).$extends({
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

  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON')
  await prisma.$executeRawUnsafe('PRAGMA journal_mode = WAL')
  await prisma.$executeRawUnsafe('PRAGMA busy_timeout = 5000')
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "VisualizerPresetList" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await prisma.$executeRawUnsafe(`
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
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "VisualizerPresetFavorite" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "presetName" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "VisualizerPresetFavorite_presetName_key"
      ON "VisualizerPresetFavorite"("presetName")
  `)
  await prisma.$executeRawUnsafe(`
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
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "VisualizerPresetListItem_listId_presetName_key"
      ON "VisualizerPresetListItem"("listId", "presetName")
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "VisualizerPresetListItem_listId_position_idx"
      ON "VisualizerPresetListItem"("listId", "position")
  `)
  await prisma.$executeRawUnsafe(`
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
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "VisualizerSourceAssociation_sourceType_sourceId_key"
      ON "VisualizerSourceAssociation"("sourceType", "sourceId")
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "VisualizerSourceAssociation_listId_idx"
      ON "VisualizerSourceAssociation"("listId")
  `)
}
