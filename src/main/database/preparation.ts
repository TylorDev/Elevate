import { promises as fs } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { findSchemaVersionPath, resolveFileDatabaseUrl } from '../ipc/storagePaths/database.ts'
import { getStoragePaths } from '../ipc/storagePaths/index.ts'

export type DatabaseResetReason =
  | 'integrity-check-failed'
  | 'foreign-key-violation'
  | 'schema-version-mismatch'
  | 'migration-metadata-missing'

export type DatabasePreparationResult = {
  databasePath: string
  databaseUrl: string
  resetPerformed: boolean
  resetReason: DatabaseResetReason | null
  backupAvailable: boolean
}

type DatabaseValidation =
  | { valid: true }
  | { valid: false; reason: DatabaseResetReason; detail: string }

const MAX_DATABASE_BACKUPS = 3
const EXPECTED_APPLICATION_TABLES = [
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
const EXPECTED_PLAYLIST_COVER_COLUMNS = [
  'customCoverMode',
  'customCoverHash',
  'customCoverValue',
  'customCoverSelection',
  'customCoverUpdatedAt'
]

export class DatabasePreparationError extends Error {
  readonly code: string
  readonly retryable: boolean

  constructor(message: string, code: string, retryable = false, options?: ErrorOptions) {
    super(message, options)
    this.name = 'DatabasePreparationError'
    this.code = code
    this.retryable = retryable
  }
}

function toPrismaFileUrl(filePath: string): string {
  return `file:${filePath.replace(/\\/g, '/')}`
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function isPathInside(parentPath: string, candidatePath: string): boolean {
  const pathFromParent = relative(resolve(parentPath), resolve(candidatePath))
  return (
    pathFromParent !== '' &&
    pathFromParent !== '..' &&
    !pathFromParent.startsWith(`..${sep}`) &&
    !isAbsolute(pathFromParent)
  )
}

async function readExpectedSchemaVersion(): Promise<number> {
  const schemaVersionPath = findSchemaVersionPath()
  if (!schemaVersionPath) {
    throw new DatabasePreparationError(
      'Database schema version metadata is missing.',
      'DATABASE_SCHEMA_VERSION_MISSING'
    )
  }

  const parsed = JSON.parse(await fs.readFile(schemaVersionPath, 'utf8')) as {
    version?: unknown
  }
  const version = Number(parsed.version)

  if (!Number.isSafeInteger(version) || version <= 0) {
    throw new DatabasePreparationError(
      'Database schema version metadata is invalid.',
      'DATABASE_SCHEMA_VERSION_INVALID'
    )
  }

  return version
}

async function validateDatabase(
  databasePath: string,
  expectedVersion: number
): Promise<DatabaseValidation> {
  let database: DatabaseSync | null = null

  try {
    database = new DatabaseSync(databasePath)
    const quickCheck = database.prepare('PRAGMA quick_check').get() as
      | Record<string, unknown>
      | undefined
    const quickCheckValue = String(Object.values(quickCheck ?? {})[0] ?? '')
    if (quickCheckValue.toLowerCase() !== 'ok') {
      return {
        valid: false,
        reason: 'integrity-check-failed',
        detail: quickCheckValue || 'SQLite quick_check failed.'
      }
    }

    const foreignKeyCheck = database.prepare('PRAGMA foreign_key_check').all()
    if (foreignKeyCheck.length > 0) {
      return {
        valid: false,
        reason: 'foreign-key-violation',
        detail: 'SQLite foreign_key_check reported violations.'
      }
    }

    const userVersionResult = database.prepare('PRAGMA user_version').get() as
      | Record<string, unknown>
      | undefined
    const userVersion = Number(Object.values(userVersionResult ?? {})[0] ?? 0)
    if (userVersion !== expectedVersion) {
      return {
        valid: false,
        reason: 'schema-version-mismatch',
        detail: `Expected schema version ${expectedVersion}, received ${userVersion}.`
      }
    }

    const migrationTable = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_prisma_migrations'"
      )
      .get()
    if (!migrationTable) {
      return {
        valid: false,
        reason: 'migration-metadata-missing',
        detail: 'Prisma migration metadata is missing.'
      }
    }

    const appliedMigration = database
      .prepare('SELECT COUNT(*) AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL')
      .get() as { count?: number | bigint } | undefined
    if (Number(appliedMigration?.count ?? 0) < 1) {
      return {
        valid: false,
        reason: 'migration-metadata-missing',
        detail: 'Prisma does not report an applied baseline migration.'
      }
    }

    const applicationTables = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations'"
      )
      .all() as Array<{ name?: string }>
    const tableNames = new Set(applicationTables.map((row) => String(row.name ?? '')))
    const missingTables = EXPECTED_APPLICATION_TABLES.filter(
      (tableName) => !tableNames.has(tableName)
    )
    if (tableNames.size !== EXPECTED_APPLICATION_TABLES.length || missingTables.length > 0) {
      return {
        valid: false,
        reason: 'schema-version-mismatch',
        detail: `The database schema is incomplete. Missing tables: ${missingTables.join(', ') || 'none'}.`
      }
    }

    const playlistColumns = database.prepare('PRAGMA table_info("Playlist")').all() as Array<{
      name?: string
    }>
    const playlistColumnNames = new Set(playlistColumns.map((row) => String(row.name ?? '')))
    const missingCoverColumns = EXPECTED_PLAYLIST_COVER_COLUMNS.filter(
      (columnName) => !playlistColumnNames.has(columnName)
    )
    if (missingCoverColumns.length > 0) {
      return {
        valid: false,
        reason: 'schema-version-mismatch',
        detail: `The Playlist schema is incomplete. Missing columns: ${missingCoverColumns.join(', ')}.`
      }
    }

    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      reason: 'integrity-check-failed',
      detail: error instanceof Error ? error.message : 'Database validation failed.'
    }
  } finally {
    database?.close()
  }
}

async function installTemplate(databasePath: string, expectedVersion: number): Promise<void> {
  const templatePath = getStoragePaths().templateDatabasePath
  if (!templatePath || !(await exists(templatePath))) {
    throw new DatabasePreparationError(
      'The packaged database template is missing.',
      'DATABASE_TEMPLATE_MISSING'
    )
  }

  await fs.mkdir(dirname(databasePath), { recursive: true })
  const incomingPath = `${databasePath}.incoming-${process.pid}-${Date.now()}`

  try {
    await fs.copyFile(templatePath, incomingPath)
    const validation = await validateDatabase(incomingPath, expectedVersion)
    if (validation.valid === false) {
      throw new DatabasePreparationError(
        `The database template is invalid: ${validation.detail}`,
        'DATABASE_TEMPLATE_INVALID'
      )
    }
    await fs.rename(incomingPath, databasePath)
  } finally {
    await fs.rm(incomingPath, { force: true })
  }
}

async function checkpointDatabase(databasePath: string): Promise<void> {
  const database = new DatabaseSync(databasePath)
  try {
    database.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  } finally {
    database.close()
  }
}

async function pruneDatabaseBackups(backupsRoot: string): Promise<void> {
  if (!(await exists(backupsRoot))) return

  const backupDirectories = (await fs.readdir(backupsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(backupsRoot, entry.name))
    .sort((left, right) => right.localeCompare(left))

  for (const backupDirectory of backupDirectories.slice(MAX_DATABASE_BACKUPS)) {
    if (!isPathInside(backupsRoot, backupDirectory)) {
      throw new DatabasePreparationError(
        'Refusing to prune a database backup outside the backup root.',
        'DATABASE_BACKUP_PATH_INVALID'
      )
    }
    await fs.rm(backupDirectory, { recursive: true, force: true })
  }
}

async function backupAndRemoveDatabase(databasePath: string): Promise<boolean> {
  const storagePaths = getStoragePaths()
  const backupsRoot = join(storagePaths.userDataRoot, 'database-backups')
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDirectory = join(backupsRoot, timestamp)

  try {
    await checkpointDatabase(databasePath)
  } catch {
    // A corrupt database may not support checkpointing; preserve the raw files below.
  }

  await fs.mkdir(backupDirectory, { recursive: true })
  let copiedAnyFile = false

  for (const sourcePath of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
    if (!(await exists(sourcePath))) continue
    await fs.copyFile(sourcePath, join(backupDirectory, basename(sourcePath)))
    copiedAnyFile = true
  }

  if (!copiedAnyFile) {
    await fs.rm(backupDirectory, { recursive: true, force: true })
    return false
  }

  for (const sourcePath of [`${databasePath}-shm`, `${databasePath}-wal`, databasePath]) {
    await fs.rm(sourcePath, { force: true })
  }

  return true
}

function resolveDatabaseTarget(): {
  databasePath: string
  databaseUrl: string
  isAppOwned: boolean
} {
  const configuredUrl = process.env.DATABASE_URL?.trim()
  if (configuredUrl && !configuredUrl.startsWith('file:')) {
    throw new DatabasePreparationError(
      'Elevate only supports local file: SQLite database URLs.',
      'DATABASE_URL_UNSUPPORTED'
    )
  }

  if (configuredUrl) {
    const databasePath = resolveFileDatabaseUrl(configuredUrl)
    return {
      databasePath,
      databaseUrl: toPrismaFileUrl(databasePath),
      isAppOwned: false
    }
  }

  const databasePath = getStoragePaths().databasePath
  return {
    databasePath,
    databaseUrl: toPrismaFileUrl(databasePath),
    isAppOwned: true
  }
}

export async function prepareDatabase(): Promise<DatabasePreparationResult> {
  const expectedVersion = await readExpectedSchemaVersion()
  const target = resolveDatabaseTarget()

  if (!(await exists(target.databasePath))) {
    if (!target.isAppOwned) {
      throw new DatabasePreparationError(
        'The configured database file does not exist.',
        'DATABASE_FILE_MISSING'
      )
    }

    await installTemplate(target.databasePath, expectedVersion)
    return {
      databasePath: target.databasePath,
      databaseUrl: target.databaseUrl,
      resetPerformed: false,
      resetReason: null,
      backupAvailable: false
    }
  }

  const validation = await validateDatabase(target.databasePath, expectedVersion)
  if (validation.valid === true) {
    return {
      databasePath: target.databasePath,
      databaseUrl: target.databaseUrl,
      resetPerformed: false,
      resetReason: null,
      backupAvailable: false
    }
  }

  if (!target.isAppOwned) {
    throw new DatabasePreparationError(
      `The configured database is incompatible: ${validation.detail}`,
      'DATABASE_SCHEMA_MISMATCH'
    )
  }

  const backupAvailable = await backupAndRemoveDatabase(target.databasePath)
  await installTemplate(target.databasePath, expectedVersion)
  const resetValidation = await validateDatabase(target.databasePath, expectedVersion)

  if (resetValidation.valid === false) {
    throw new DatabasePreparationError(
      `The reset database is invalid: ${resetValidation.detail}`,
      'DATABASE_RESET_FAILED',
      true
    )
  }

  return {
    databasePath: target.databasePath,
    databaseUrl: target.databaseUrl,
    resetPerformed: true,
    resetReason: validation.reason,
    backupAvailable
  }
}

export function getDatabaseBackupsPath(): string {
  return join(getStoragePaths().userDataRoot, 'database-backups')
}

export async function pruneDatabaseBackupsAfterSuccessfulStart(): Promise<void> {
  await pruneDatabaseBackups(getDatabaseBackupsPath())
}
