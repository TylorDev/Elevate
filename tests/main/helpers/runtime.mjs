import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { vi } from 'vitest'
import { configureElectronPaths } from './electronMock.mjs'

const PROJECT_ROOT = process.cwd()
let schemaSql = null
let baselineDatabasePath = null

function prismaCliArgs(args) {
  return [path.join(PROJECT_ROOT, 'node_modules', 'prisma', 'build', 'index.js'), ...args]
}

function toFileUrl(filePath) {
  return `file:${filePath.replace(/\\/g, '/')}`
}

function rememberEnv(names) {
  return Object.fromEntries(names.map((name) => [name, process.env[name]]))
}

function restoreEnv(previousEnv) {
  for (const [name, value] of Object.entries(previousEnv)) {
    if (value === undefined) {
      delete process.env[name]
    } else {
      process.env[name] = value
    }
  }
}

function getSchemaSql() {
  if (schemaSql) {
    return schemaSql
  }

  const schemaRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'elevate-prisma-schema-'))
  const sqlPath = path.join(schemaRoot, 'schema.sql')
  const schemaPath = path.join(schemaRoot, 'schema.prisma')
  const projectSchema = fs.readFileSync(path.join(PROJECT_ROOT, 'prisma', 'schema.prisma'), 'utf8')
  const schemaWithUrl = projectSchema.replace(
    /datasource db\s*\{\s*provider\s*=\s*"sqlite"\s*\}/,
    'datasource db {\n  provider = "sqlite"\n  url      = "file:./schema-placeholder.db"\n}'
  )

  fs.writeFileSync(schemaPath, schemaWithUrl, 'utf8')

  execFileSync(
    process.execPath,
    prismaCliArgs([
      'migrate',
      'diff',
      '--from-empty',
      '--to-schema-datamodel',
      schemaPath,
      '--script',
      '--output',
      sqlPath
    ]),
    {
      cwd: PROJECT_ROOT,
      env: { ...process.env },
      stdio: 'pipe'
    }
  )

  schemaSql = fs.readFileSync(sqlPath, 'utf8')
  return schemaSql
}

function createDatabaseWithPrismaCli(databasePath) {
  const sqlPath = path.join(path.dirname(databasePath), 'schema.sql')
  fs.writeFileSync(sqlPath, getSchemaSql(), 'utf8')

  execFileSync(
    process.execPath,
    prismaCliArgs(['db', 'execute', '--url', toFileUrl(databasePath), '--file', sqlPath]),
    {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      DATABASE_URL: toFileUrl(databasePath)
    },
    stdio: 'pipe'
    }
  )
}

function getBaselineDatabasePath() {
  if (baselineDatabasePath && fs.existsSync(baselineDatabasePath)) {
    return baselineDatabasePath
  }

  const baselineRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'elevate-prisma-baseline-'))
  baselineDatabasePath = path.join(baselineRoot, 'baseline.db')
  createDatabaseWithPrismaCli(baselineDatabasePath)
  return baselineDatabasePath
}

function createDatabase(databasePath) {
  fs.copyFileSync(getBaselineDatabasePath(), databasePath)
}

export async function createRuntimeContext({ database = false } = {}) {
  const previousEnv = rememberEnv([
    'APPDATA',
    'DATABASE_URL',
    'ELEVATE_ENABLE_PORTABLE_MODE',
    'ELEVATE_PORTABLE_DATA_DIR',
    'LOCALAPPDATA'
  ])
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'elevate-main-test-'))
  const databasePath = path.join(root, 'elevate-test.db')

  process.env.ELEVATE_ENABLE_PORTABLE_MODE = '1'
  process.env.ELEVATE_PORTABLE_DATA_DIR = path.join(root, 'portable-data')
  process.env.APPDATA = path.join(root, 'appData')
  process.env.LOCALAPPDATA = path.join(root, 'localAppData')
  configureElectronPaths(root)

  if (database) {
    process.env.DATABASE_URL = toFileUrl(databasePath)
    createDatabase(databasePath)
  } else {
    delete process.env.DATABASE_URL
  }

  await fs.promises.mkdir(process.env.ELEVATE_PORTABLE_DATA_DIR, { recursive: true })

  return {
    root,
    databasePath,
    databaseUrl: toFileUrl(databasePath),
    async cleanup() {
      restoreEnv(previousEnv)
      vi.resetModules()
      await removeTempRoot(root)
    }
  }
}

export async function importFreshProject(relativePath) {
  const url = new URL(`../../../${relativePath}`, import.meta.url)
  return import(url.href)
}

export async function createPrismaTestContext() {
  const runtime = await createRuntimeContext({ database: true })
  vi.resetModules()
  const prismaModule = await importFreshProject('src/main/prisma.ts')
  const client = await prismaModule.initializePrisma()

  return {
    ...runtime,
    prismaModule,
    client,
    async cleanup() {
      await client.$disconnect()
      await runtime.cleanup()
    }
  }
}

async function removeTempRoot(root) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await fs.promises.rm(root, { recursive: true, force: true })
      return
    } catch (error) {
      if (error?.code !== 'EBUSY' && error?.code !== 'EPERM') {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)))
    }
  }

  try {
    await fs.promises.rm(root, { recursive: true, force: true })
  } catch (error) {
    if (error?.code !== 'EBUSY' && error?.code !== 'EPERM') {
      throw error
    }
  }
}

export async function seedSong(client, data = {}) {
  const song = await client.songs.create({
    data: {
      filepath: data.filepath,
      filename: data.filename || path.basename(data.filepath || 'song.mp3', path.extname(data.filepath || '.mp3')),
      title: data.title || null,
      artist: data.artist || null,
      album: data.album || null,
      genre: data.genre || null,
      duration: data.duration ?? 0,
      size: data.size ?? 0,
      metadataLoaded: data.metadataLoaded ?? true
    }
  })

  if (data.preference) {
    await client.userPreferences.create({
      data: {
        song_id: song.song_id,
        ...data.preference
      }
    })
  }

  return song
}
