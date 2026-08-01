const MAX_WRITE_ATTEMPTS = 3
const RETRY_DELAYS_MS = [50, 125]

function getErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return ''
  const code = Reflect.get(error, 'code')
  return typeof code === 'string' ? code.toUpperCase() : ''
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message.toUpperCase() : String(error).toUpperCase()
}

export function isRetryableDatabaseWriteError(error: unknown): boolean {
  const code = getErrorCode(error)
  if (code === 'P2034' || code === 'SQLITE_BUSY' || code === 'SQLITE_LOCKED') return true

  const message = getErrorMessage(error)
  return message.includes('SQLITE_BUSY') || message.includes('SQLITE_LOCKED')
}

export async function withDatabaseWriteRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (!isRetryableDatabaseWriteError(error) || attempt === MAX_WRITE_ATTEMPTS - 1) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]))
    }
  }

  throw lastError
}
