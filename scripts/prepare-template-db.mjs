import { spawn } from 'node:child_process'
import { access, copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const projectRoot = process.cwd()
const prismaRoot = join(projectRoot, 'prisma')
const templatePath = join(prismaRoot, 'template.db')
const incomingTemplatePath = join(prismaRoot, '.template.db.incoming')
const previousTemplatePath = join(prismaRoot, '.template.db.previous')
const prismaCliPath = join(projectRoot, 'node_modules', 'prisma', 'build', 'index.js')
const prismaConfigPath = join(projectRoot, 'prisma.config.ts')
const schemaVersionPath = join(prismaRoot, 'schema-version.json')
const scriptPath = fileURLToPath(import.meta.url)
const expectedApplicationTables = [
  'AppHistoryEvent',
  'Directory',
  'Historial',
  'PlaybackEvent',
  'PlayHistory',
  'PlayerSession',
  'Playlist',
  'Songs',
  'UserPreferences',
  'VisualizerPresetFavorite',
  'VisualizerPresetList',
  'VisualizerPresetListItem',
  'VisualizerSettings',
  'VisualizerSourceAssociation'
]
const expectedPlaylistCoverColumns = [
  'customCoverMode',
  'customCoverHash',
  'customCoverValue',
  'customCoverSelection',
  'customCoverUpdatedAt'
]

async function exists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function runPrisma(args, databaseUrl) {
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [prismaCliPath, ...args], {
      cwd: projectRoot,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl
      },
      stdio: 'inherit',
      shell: false
    })

    child.once('error', rejectPromise)
    child.once('exit', (code, signal) => {
      if (signal) {
        rejectPromise(new Error(`Prisma exited with signal ${signal}.`))
        return
      }

      if ((code ?? 0) !== 0) {
        rejectPromise(new Error(`Prisma exited with code ${code ?? 0}.`))
        return
      }

      resolvePromise()
    })
  })
}

async function runTemplateValidator(databaseUrl, expectedVersion) {
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      process.execPath,
      [scriptPath, '--validate-template', databaseUrl, String(expectedVersion)],
      {
        cwd: projectRoot,
        stdio: 'inherit',
        shell: false
      }
    )

    child.once('error', rejectPromise)
    child.once('exit', (code, signal) => {
      if (signal || (code ?? 0) !== 0) {
        rejectPromise(
          new Error(
            signal
              ? `Template validation exited with signal ${signal}.`
              : `Template validation exited with code ${code}.`
          )
        )
        return
      }
      resolvePromise()
    })
  })
}

async function readSchemaVersion() {
  const rawValue = JSON.parse(await readFile(schemaVersionPath, 'utf8'))
  const version = Number(rawValue?.version)

  if (!Number.isSafeInteger(version) || version <= 0) {
    throw new Error('prisma/schema-version.json must contain a positive integer version.')
  }

  return version
}

function toPrismaFileUrl(filePath) {
  return `file:${filePath.replace(/\\/g, '/')}`
}

async function validateDatabase(databaseUrl, expectedVersion) {
  const { createClient } = await import('@libsql/client')
  const client = createClient({ url: databaseUrl })

  try {
    await client.execute('PRAGMA foreign_keys = ON')
    await client.execute(`PRAGMA user_version = ${expectedVersion}`)
    const quickCheck = await client.execute('PRAGMA quick_check')
    const quickCheckValue = String(quickCheck.rows[0]?.[0] ?? '')

    if (quickCheckValue.toLowerCase() !== 'ok') {
      throw new Error(`Template quick_check failed: ${quickCheckValue || 'unknown error'}`)
    }

    const foreignKeyCheck = await client.execute('PRAGMA foreign_key_check')
    if (foreignKeyCheck.rows.length > 0) {
      throw new Error('Template foreign_key_check reported violations.')
    }

    const migrationTable = await client.execute({
      sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      args: ['_prisma_migrations']
    })
    if (migrationTable.rows.length !== 1) {
      throw new Error('Template does not contain Prisma migration metadata.')
    }

    const appliedMigrations = await client.execute(
      'SELECT COUNT(*) AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL'
    )
    if (Number(appliedMigrations.rows[0]?.count ?? 0) < 1) {
      throw new Error('Template does not contain an applied baseline migration.')
    }

    const applicationTables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations'"
    )
    const tableNames = new Set(applicationTables.rows.map((row) => String(row.name ?? row[0])))
    const missingTables = expectedApplicationTables.filter(
      (tableName) => !tableNames.has(tableName)
    )
    if (tableNames.size !== expectedApplicationTables.length || missingTables.length > 0) {
      throw new Error(
        `Template application tables do not match the Prisma schema. Missing: ${missingTables.join(', ') || 'none'}.`
      )
    }

    const playlistColumns = await client.execute('PRAGMA table_info("Playlist")')
    const playlistColumnNames = new Set(
      playlistColumns.rows.map((row) => String(row.name ?? row[1]))
    )
    const missingCoverColumns = expectedPlaylistCoverColumns.filter(
      (columnName) => !playlistColumnNames.has(columnName)
    )
    if (missingCoverColumns.length > 0) {
      throw new Error(
        `Template Playlist table is missing cover columns: ${missingCoverColumns.join(', ')}.`
      )
    }

    await client.execute('PRAGMA wal_checkpoint(TRUNCATE)')
  } finally {
    await client.close()
  }
}

async function replaceTemplateAtomically(sourcePath) {
  await mkdir(dirname(templatePath), { recursive: true })
  await rm(incomingTemplatePath, { force: true })
  await rm(previousTemplatePath, { force: true })
  await copyFile(sourcePath, incomingTemplatePath)

  const hadPreviousTemplate = await exists(templatePath)
  if (hadPreviousTemplate) {
    await rename(templatePath, previousTemplatePath)
  }

  try {
    await rename(incomingTemplatePath, templatePath)
    await rm(previousTemplatePath, { force: true })
  } catch (error) {
    if (hadPreviousTemplate && (await exists(previousTemplatePath))) {
      await rename(previousTemplatePath, templatePath)
    }
    throw error
  } finally {
    await rm(incomingTemplatePath, { force: true })
  }
}

async function removeTemporaryRoot(temporaryRoot) {
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      await rm(temporaryRoot, { recursive: true, force: true })
      return
    } catch (error) {
      if ((error?.code !== 'EBUSY' && error?.code !== 'EPERM') || attempt === 8) {
        throw error
      }
      await delay(attempt * 100)
    }
  }
}

async function main() {
  const schemaVersion = await readSchemaVersion()
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'elevate-template-'))
  const temporaryDatabasePath = resolve(temporaryRoot, 'template.db')
  const databaseUrl = toPrismaFileUrl(temporaryDatabasePath)

  console.log(`Generating Prisma template schema version ${schemaVersion}...`)

  try {
    // Prisma Migrate 7.8 expects the SQLite file to exist before migrate deploy.
    await writeFile(temporaryDatabasePath, '')
    await runPrisma(['migrate', 'deploy', '--config', prismaConfigPath], databaseUrl)
    await runPrisma(['migrate', 'status', '--config', prismaConfigPath], databaseUrl)
    await runTemplateValidator(databaseUrl, schemaVersion)
    await replaceTemplateAtomically(temporaryDatabasePath)
    console.log(`Generated ${templatePath}`)
  } finally {
    await removeTemporaryRoot(temporaryRoot)
  }
}

const operation =
  process.argv[2] === '--validate-template'
    ? validateDatabase(process.argv[3], Number(process.argv[4]))
    : main()

operation.catch((error) => {
  console.error('Failed to generate template.db:', error)
  process.exitCode = 1
})
