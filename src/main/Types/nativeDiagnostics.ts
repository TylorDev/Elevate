import type { App } from 'electron'

export type SerializedNativeError = {
  name: string | null
  message: string
  code: string | number | null
  stack: string | null
}

export type ModuleResolutionSuccess = {
  request: string
  resolvedPath: string
  exists: boolean
}

export type ModuleResolutionFailure = {
  request: string
  resolvedPath: null
  exists: false
  error: SerializedNativeError | null
}

export type ModuleResolutionResult = ModuleResolutionSuccess | ModuleResolutionFailure

export type NativePathResolution = {
  request: string
  resolvedPath: string | null
  exists: boolean
  error: SerializedNativeError | null
}

export type NativeProbe = {
  name: string
  module: string
  nativeFile?: string
  nativePackage?: string
  nativeRelativePath?: string
  requiredAtStartup?: boolean
  load?: boolean
}

export type PortableExecutableSection = {
  virtualSize: number
  virtualAddress: number
  rawSize: number
  rawPointer: number
}

export type NativeImportsResult = {
  physicalPath: string | null
  dlls: string[]
  error: SerializedNativeError | null
}

export type NativeModuleLoadResult = {
  request: string
  ok: boolean
  error: SerializedNativeError | null
}

export type NativeProbeResult = {
  name: string
  module: string
  nativeFile: string | null
  requiredAtStartup: boolean
  resolvedModule: ModuleResolutionResult
  resolvedNativeFile: ModuleResolutionResult | NativePathResolution | null
  nativeImports: NativeImportsResult
  loadResult: NativeModuleLoadResult | null
  likelyMissingRuntime: boolean
  hint: string | null
}

export type NativeDiagnosticsReport = {
  app: {
    isPackaged: boolean
    appPath: string | null
  }
  process: {
    platform: NodeJS.Platform
    arch: string
    versions: NodeJS.ProcessVersions
    resourcesPath: string | null
    execPath: string
  }
  probes: NativeProbeResult[]
}

export type NativeDiagnosticsLogger = Pick<Console, 'info' | 'error'>

export type NativeDiagnosticsApp = Pick<App, 'isPackaged' | 'getAppPath'>
