import { serializeError } from './errors.ts'
import { getPhysicalNativePath, loadModule, resolveModule, resolveNativePath } from './modules.ts'
import { readPortableExecutableImports } from './portableExecutable.ts'
import type {
  NativeImportsResult,
  NativeProbe,
  NativeProbeResult,
  SerializedNativeError
} from '../../Types/nativeDiagnostics.ts'

export const DEFAULT_NATIVE_PROBES: NativeProbe[] = [
  {
    name: 'libsql',
    module: 'libsql',
    nativeFile: '@libsql/win32-x64-msvc',
    requiredAtStartup: true
  },
  {
    name: 'sharp',
    module: 'sharp',
    nativePackage: '@img/sharp-win32-x64',
    nativeRelativePath: 'lib/sharp-win32-x64.node'
  }
]

export function getNativeImports(
  resolvedNativeFile: ReturnType<typeof resolveNativePath>
): NativeImportsResult {
  const physicalPath = getPhysicalNativePath(resolvedNativeFile?.resolvedPath)

  try {
    return { physicalPath, dlls: readPortableExecutableImports(physicalPath), error: null }
  } catch (error) {
    return { physicalPath, dlls: [], error: serializeError(error) }
  }
}

export function isLikelyMissingWindowsRuntime(
  error: SerializedNativeError | null | undefined,
  platform: NodeJS.Platform = process.platform
): boolean {
  const message = `${error?.message || ''} ${error?.stack || ''}`.toLowerCase()
  return (
    platform === 'win32' &&
    ((error?.code === 'ERR_DLOPEN_FAILED' && message.includes('.node')) ||
      message.includes('specified module could not be found') ||
      message.includes('no se puede encontrar el modulo especificado') ||
      message.includes('no se puede encontrar el modulo') ||
      message.includes('no se puede encontrar el m') ||
      message.includes('dll'))
  )
}

export function buildProbeResult(probe: NativeProbe): NativeProbeResult {
  const resolvedModule = resolveModule(probe.module)
  const resolvedNativeFile = resolveNativePath(probe)
  const nativeImports = getNativeImports(resolvedNativeFile)
  const loadResult = probe.load === false ? null : loadModule(probe.module)
  const likelyMissingRuntime = isLikelyMissingWindowsRuntime(loadResult?.error)

  return {
    name: probe.name,
    module: probe.module,
    nativeFile: probe.nativeFile || null,
    requiredAtStartup: Boolean(probe.requiredAtStartup),
    resolvedModule,
    resolvedNativeFile,
    nativeImports,
    loadResult,
    likelyMissingRuntime,
    hint: likelyMissingRuntime
      ? 'Windows found the .node file but could not load one of its dependent DLLs. Install or bundle Microsoft Visual C++ Redistributable x64.'
      : null
  }
}
