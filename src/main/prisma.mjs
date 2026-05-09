import 'dotenv/config'
import { existsSync, copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from './generated/prisma/client.ts'

const require = createRequire(import.meta.url)
const { app } = require('electron')
const __dirname = dirname(fileURLToPath(import.meta.url))

function toFileUrl(path) {
  return `file:${path.replace(/\\/g, '/')}`
}

function getPortableDataDir() {
  if (process.env.ELEVATE_PORTABLE_DATA_DIR) {
    return resolve(process.env.ELEVATE_PORTABLE_DATA_DIR)
  }

  if (!app.isPackaged) {
    return null
  }

  const exeDir = dirname(app.getPath('exe'))

  if (exeDir.includes('unpacked')) {
    const unpackedDataDir = join(exeDir, 'data')
    if (!existsSync(unpackedDataDir)) {
      mkdirSync(unpackedDataDir, { recursive: true })
    }
    return unpackedDataDir
  }

  const executableDataDir = join(exeDir, 'data')
  return existsSync(executableDataDir) ? executableDataDir : null
}

function getDatabasePath() {
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('file:')) {
    return null
  }

  if (process.env.DATABASE_URL?.startsWith('file:')) {
    return resolve(process.env.DATABASE_URL.replace(/^file:/, ''))
  }

  if (!app.isPackaged) {
    return resolve('prisma/dev.db')
  }

  const portableDataDir = getPortableDataDir()
  return join(portableDataDir || app.getPath('userData'), 'elevate.db')
}

function findTemplateDatabase() {
  const candidates = [
    resolve('prisma/template.db'),
    join(app.getAppPath(), 'prisma/template.db'),
    join(process.resourcesPath || '', 'prisma/template.db'),
    join(__dirname, '../../prisma/template.db')
  ]

  return candidates.find((candidate) => existsSync(candidate))
}

function ensureDatabaseFile(databasePath) {
  if (!databasePath || existsSync(databasePath)) {
    return
  }

  mkdirSync(dirname(databasePath), { recursive: true })

  const templateDatabase = findTemplateDatabase()
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

const adapter = new PrismaLibSql({
  url: getDatabaseUrl()
})

export const prisma = new PrismaClient({ adapter }).$extends({
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

export async function initializePrisma() {
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON')
  await prisma.$executeRawUnsafe('PRAGMA journal_mode = WAL')
  await prisma.$executeRawUnsafe('PRAGMA busy_timeout = 5000')
}
