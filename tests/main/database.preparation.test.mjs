import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { createRuntimeContext, importFreshProject } from './helpers/runtime.mjs'

let context = null

function sha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

afterEach(async () => {
  if (context) {
    await context.cleanup()
    context = null
  }
})

describe('database preparation', () => {
  it('installs the managed database atomically without modifying the template', async () => {
    context = await createRuntimeContext()
    const templatePath = path.join(process.cwd(), 'prisma', 'template.db')
    const templateHash = sha256(templatePath)
    const databasePath = path.join(process.env.ELEVATE_PORTABLE_DATA_DIR, 'elevate.db')
    const { prepareDatabase } = await importFreshProject('src/main/database/preparation.ts')

    const result = await prepareDatabase()

    expect(result).toMatchObject({
      databasePath,
      resetPerformed: false,
      backupAvailable: false
    })
    expect(sha256(databasePath)).toBe(templateHash)
    expect(sha256(templatePath)).toBe(templateHash)
  })

  it('backs up and replaces an incompatible managed database', async () => {
    context = await createRuntimeContext()
    const databasePath = path.join(process.env.ELEVATE_PORTABLE_DATA_DIR, 'elevate.db')
    fs.writeFileSync(databasePath, 'not-a-sqlite-database')
    const { getDatabaseBackupsPath, prepareDatabase } = await importFreshProject(
      'src/main/database/preparation.ts'
    )

    const result = await prepareDatabase()
    const backupDirectories = fs.readdirSync(getDatabaseBackupsPath())
    const backedUpDatabase = path.join(getDatabaseBackupsPath(), backupDirectories[0], 'elevate.db')

    expect(result).toMatchObject({
      databasePath,
      resetPerformed: true,
      backupAvailable: true,
      resetReason: 'integrity-check-failed'
    })
    expect(fs.readFileSync(backedUpDatabase, 'utf8')).toBe('not-a-sqlite-database')
    expect(fs.statSync(databasePath).size).toBeGreaterThan(0)
  })

  it('resets a managed database with an old schema version', async () => {
    context = await createRuntimeContext()
    const databasePath = path.join(process.env.ELEVATE_PORTABLE_DATA_DIR, 'elevate.db')
    fs.copyFileSync(path.join(process.cwd(), 'prisma', 'template.db'), databasePath)
    const database = new DatabaseSync(databasePath)
    database.exec('PRAGMA user_version = 0')
    database.close()
    const { prepareDatabase } = await importFreshProject('src/main/database/preparation.ts')

    await expect(prepareDatabase()).resolves.toMatchObject({
      resetPerformed: true,
      backupAvailable: true,
      resetReason: 'schema-version-mismatch'
    })
  })

  it('resets an incomplete managed schema even when its version metadata matches', async () => {
    context = await createRuntimeContext()
    const databasePath = path.join(process.env.ELEVATE_PORTABLE_DATA_DIR, 'elevate.db')
    const database = new DatabaseSync(databasePath)
    database.exec(`
      CREATE TABLE "_prisma_migrations" ("finished_at" TEXT);
      INSERT INTO "_prisma_migrations" ("finished_at") VALUES (CURRENT_TIMESTAMP);
      CREATE TABLE "Playlist" ("id" INTEGER PRIMARY KEY);
      PRAGMA user_version = 1;
    `)
    database.close()
    const { prepareDatabase } = await importFreshProject('src/main/database/preparation.ts')

    await expect(prepareDatabase()).resolves.toMatchObject({
      resetPerformed: true,
      backupAvailable: true,
      resetReason: 'schema-version-mismatch'
    })
  })

  it('rejects an incompatible custom database without modifying or backing it up', async () => {
    context = await createRuntimeContext()
    const customDatabasePath = path.join(context.root, 'external.db')
    const originalContents = 'external-database-must-remain-untouched'
    fs.writeFileSync(customDatabasePath, originalContents)
    process.env.DATABASE_URL = `file:${customDatabasePath.replace(/\\/g, '/')}`
    const { getDatabaseBackupsPath, prepareDatabase } = await importFreshProject(
      'src/main/database/preparation.ts'
    )

    await expect(prepareDatabase()).rejects.toMatchObject({
      code: 'DATABASE_SCHEMA_MISMATCH'
    })
    expect(fs.readFileSync(customDatabasePath, 'utf8')).toBe(originalContents)
    expect(fs.existsSync(getDatabaseBackupsPath())).toBe(false)
  })
})
