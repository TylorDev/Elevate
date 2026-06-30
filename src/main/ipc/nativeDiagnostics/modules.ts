import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { serializeError } from './errors.ts'
import type {
  ModuleResolutionResult,
  NativeModuleLoadResult,
  NativePathResolution,
  NativeProbe
} from '../../Types/nativeDiagnostics.ts'

const require = createRequire(import.meta.url)

export function resolveModule(request: string): ModuleResolutionResult {
  try {
    const resolvedPath = require.resolve(request)
    return { request, resolvedPath, exists: existsSync(resolvedPath) }
  } catch (error) {
    return { request, resolvedPath: null, exists: false, error: serializeError(error) }
  }
}

export function resolveNativePath(
  probe: NativeProbe
): ModuleResolutionResult | NativePathResolution | null {
  if (probe.nativePackage && probe.nativeRelativePath) {
    const packageInfo = resolveModule(`${probe.nativePackage}/package.json`)
    const resolvedPath = packageInfo.resolvedPath
      ? join(dirname(packageInfo.resolvedPath), probe.nativeRelativePath)
      : null

    return {
      request: `${probe.nativePackage}/${probe.nativeRelativePath}`,
      resolvedPath,
      exists: Boolean(resolvedPath && existsSync(resolvedPath)),
      error: 'error' in packageInfo ? packageInfo.error : null
    }
  }

  return probe.nativeFile ? resolveModule(probe.nativeFile) : null
}

export function getPhysicalNativePath(resolvedPath: string | null | undefined): string | null {
  if (!resolvedPath || !resolvedPath.endsWith('.node')) {
    return resolvedPath || null
  }

  return resolvedPath.replace(/\.asar(?=\\|\/)/, '.asar.unpacked')
}

export function loadModule(request: string): NativeModuleLoadResult {
  try {
    require(request)
    return { request, ok: true, error: null }
  } catch (error) {
    return { request, ok: false, error: serializeError(error) }
  }
}
