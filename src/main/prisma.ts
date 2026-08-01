import { PrismaLibSql } from '@prisma/adapter-libsql'
import {
  prepareDatabase,
  pruneDatabaseBackupsAfterSuccessfulStart
} from './database/preparation.ts'
import { PrismaClient } from './generated/prisma/client.ts'
import type { PrismaStatus, PrismaStatusError } from './Types/main.ts'

export type AppDb = PrismaClient

const DEFAULT_PRISMA_WAIT_TIMEOUT_MS = 15_000

const databaseState: PrismaStatus = {
  phase: 'idle',
  isInitializing: false,
  isReady: false,
  error: null,
  recovery: {
    resetPerformed: false,
    resetReason: null,
    backupAvailable: false
  },
  initStartedAt: null,
  initFinishedAt: null
}

let prismaClient: AppDb | null = null
let initializePrismaPromise: Promise<AppDb> | null = null
let lifecycleQueue: Promise<void> = Promise.resolve()

function enqueueLifecycle<T>(operation: () => Promise<T>): Promise<T> {
  const run = lifecycleQueue.then(operation, operation)
  lifecycleQueue = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

function getErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return 'DATABASE_INIT_FAILED'
  const code = Reflect.get(error, 'code')
  return typeof code === 'string' && code ? code : 'DATABASE_INIT_FAILED'
}

function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return true
  const retryable = Reflect.get(error, 'retryable')
  return typeof retryable === 'boolean' ? retryable : true
}

function serializeError(error: unknown): PrismaStatusError {
  return {
    message: error instanceof Error ? error.message : 'Database initialization failed.',
    code: getErrorCode(error),
    retryable: isRetryableError(error)
  }
}

function createUnavailableError(message: string): Error & { code: string } {
  const error = new Error(message) as Error & { code: string }
  error.code = databaseState.error?.code || 'DATABASE_NOT_READY'
  return error
}

async function configureClient(client: AppDb): Promise<void> {
  await client.$connect()
  await client.$executeRawUnsafe('PRAGMA foreign_keys = ON')
  await client.$executeRawUnsafe('PRAGMA journal_mode = WAL')
  await client.$executeRawUnsafe('PRAGMA busy_timeout = 5000')
}

async function createPrismaClient(): Promise<AppDb> {
  const preparation = await prepareDatabase()
  databaseState.recovery = {
    resetPerformed: preparation.resetPerformed,
    resetReason: preparation.resetReason,
    backupAvailable: preparation.backupAvailable
  }

  const adapter = new PrismaLibSql({ url: preparation.databaseUrl })
  const client = new PrismaClient({
    adapter,
    errorFormat: 'minimal',
    transactionOptions: {
      maxWait: 5_000,
      timeout: 10_000
    }
  })

  try {
    await configureClient(client)
    await pruneDatabaseBackupsAfterSuccessfulStart()
    return client
  } catch (error) {
    await client.$disconnect().catch(() => undefined)
    throw error
  }
}

export function getPrismaClient(): AppDb {
  if (!prismaClient || !databaseState.isReady) {
    throw createUnavailableError('The database is not ready.')
  }
  return prismaClient
}

export function getPrismaStatus(): PrismaStatus {
  return {
    phase: databaseState.phase,
    isInitializing: databaseState.isInitializing,
    isReady: databaseState.isReady,
    error: databaseState.error ? { ...databaseState.error } : null,
    recovery: { ...databaseState.recovery },
    initStartedAt: databaseState.initStartedAt,
    initFinishedAt: databaseState.initFinishedAt
  }
}

export function initializePrisma(): Promise<AppDb> {
  if (prismaClient && databaseState.phase === 'ready') {
    return Promise.resolve(prismaClient)
  }
  if (initializePrismaPromise) {
    return initializePrismaPromise
  }

  databaseState.phase = 'preparing'
  databaseState.isInitializing = true
  databaseState.isReady = false
  databaseState.error = null
  databaseState.recovery = {
    resetPerformed: false,
    resetReason: null,
    backupAvailable: false
  }
  databaseState.initStartedAt = new Date().toISOString()
  databaseState.initFinishedAt = null

  const initialization = enqueueLifecycle(async () => {
    if (prismaClient) return prismaClient

    const client = await createPrismaClient()
    prismaClient = client
    databaseState.phase = 'ready'
    databaseState.isReady = true
    return client
  })

  const trackedInitialization = initialization
    .catch((error) => {
      databaseState.phase = 'failed'
      databaseState.isReady = false
      databaseState.error = serializeError(error)
      throw error
    })
    .finally(() => {
      databaseState.isInitializing = false
      databaseState.initFinishedAt = new Date().toISOString()
      if (initializePrismaPromise === trackedInitialization) {
        initializePrismaPromise = null
      }
    })

  initializePrismaPromise = trackedInitialization
  return trackedInitialization
}

export async function disconnectPrisma(): Promise<void> {
  databaseState.phase = 'disconnecting'
  databaseState.isInitializing = false
  databaseState.isReady = false

  await enqueueLifecycle(async () => {
    const client = prismaClient
    prismaClient = null
    initializePrismaPromise = null
    if (client) {
      await client.$disconnect()
    }
    databaseState.phase = 'idle'
    databaseState.isInitializing = false
    databaseState.isReady = false
    databaseState.error = null
    databaseState.initStartedAt = null
    databaseState.initFinishedAt = new Date().toISOString()
  })
}

export async function waitForPrisma(options: { timeoutMs?: number } = {}): Promise<AppDb> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_PRISMA_WAIT_TIMEOUT_MS
  const initialization = initializePrisma()
  let timeoutId: NodeJS.Timeout | undefined

  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(
      () => reject(createUnavailableError(`Database initialization exceeded ${timeoutMs}ms.`)),
      timeoutMs
    )
  })

  try {
    return await Promise.race([initialization, timeout])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}
