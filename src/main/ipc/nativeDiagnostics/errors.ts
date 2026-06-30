import type { SerializedNativeError } from '../../Types/nativeDiagnostics.ts'

function readErrorProperty(error: object, property: string): unknown {
  return Reflect.get(error, property)
}

export function serializeError(error: unknown): SerializedNativeError | null {
  if (!error) {
    return null
  }

  if (typeof error !== 'object') {
    return {
      name: null,
      message: String(error),
      code: null,
      stack: null
    }
  }

  const name = readErrorProperty(error, 'name')
  const message = readErrorProperty(error, 'message')
  const code = readErrorProperty(error, 'code')
  const stack = readErrorProperty(error, 'stack')

  return {
    name: typeof name === 'string' && name ? name : null,
    message: typeof message === 'string' && message ? message : String(error),
    code: typeof code === 'string' || typeof code === 'number' ? code : null,
    stack: typeof stack === 'string' && stack ? stack : null
  }
}
