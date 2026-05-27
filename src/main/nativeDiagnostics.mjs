import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)

function serializeError(error) {
  if (!error) {
    return null
  }

  return {
    name: error.name || null,
    message: error.message || String(error),
    code: error.code || null,
    stack: error.stack || null
  }
}

function resolveModule(request) {
  try {
    const resolvedPath = require.resolve(request)
    return {
      request,
      resolvedPath,
      exists: existsSync(resolvedPath)
    }
  } catch (error) {
    return {
      request,
      resolvedPath: null,
      exists: false,
      error: serializeError(error)
    }
  }
}

function resolveNativePath(probe) {
  if (probe.nativePackage && probe.nativeRelativePath) {
    const packageInfo = resolveModule(`${probe.nativePackage}/package.json`)
    const resolvedPath = packageInfo.resolvedPath
      ? join(dirname(packageInfo.resolvedPath), probe.nativeRelativePath)
      : null

    return {
      request: `${probe.nativePackage}/${probe.nativeRelativePath}`,
      resolvedPath,
      exists: Boolean(resolvedPath && existsSync(resolvedPath)),
      error: packageInfo.error || null
    }
  }

  return probe.nativeFile ? resolveModule(probe.nativeFile) : null
}

function getPhysicalNativePath(resolvedPath) {
  if (!resolvedPath || !resolvedPath.endsWith('.node')) {
    return resolvedPath
  }

  return resolvedPath.replace(/\.asar(?=\\|\/)/, '.asar.unpacked')
}

function rvaToOffset(sections, rva) {
  const section = sections.find((candidate) => {
    const sectionSize = Math.max(candidate.virtualSize, candidate.rawSize)
    return rva >= candidate.virtualAddress && rva < candidate.virtualAddress + sectionSize
  })

  if (!section) {
    throw new Error(`Unable to map PE RVA 0x${rva.toString(16)} to a file section.`)
  }

  return section.rawPointer + (rva - section.virtualAddress)
}

function readNullTerminatedAscii(buffer, offset) {
  const end = buffer.indexOf(0, offset)
  return buffer.toString('ascii', offset, end === -1 ? undefined : end)
}

function readPortableExecutableImports(path) {
  if (!path || !path.endsWith('.node') || !existsSync(path)) {
    return []
  }

  const buffer = readFileSync(path)
  const peHeaderOffset = buffer.readUInt32LE(0x3c)
  const optionalHeaderOffset = peHeaderOffset + 24
  const optionalHeaderMagic = buffer.readUInt16LE(optionalHeaderOffset)
  const dataDirectoryOffset = optionalHeaderOffset + (optionalHeaderMagic === 0x20b ? 112 : 96)
  const importTableRva = buffer.readUInt32LE(dataDirectoryOffset + 8)

  if (!importTableRva) {
    return []
  }

  const sectionCount = buffer.readUInt16LE(peHeaderOffset + 6)
  const sectionTableOffset = optionalHeaderOffset + buffer.readUInt16LE(peHeaderOffset + 20)
  const sections = []

  for (let index = 0; index < sectionCount; index += 1) {
    const offset = sectionTableOffset + index * 40
    sections.push({
      virtualSize: buffer.readUInt32LE(offset + 8),
      virtualAddress: buffer.readUInt32LE(offset + 12),
      rawSize: buffer.readUInt32LE(offset + 16),
      rawPointer: buffer.readUInt32LE(offset + 20)
    })
  }

  const imports = []
  for (let offset = rvaToOffset(sections, importTableRva); ; offset += 20) {
    const nameRva = buffer.readUInt32LE(offset + 12)

    if (!nameRva) {
      break
    }

    imports.push(readNullTerminatedAscii(buffer, rvaToOffset(sections, nameRva)))
  }

  return imports.sort((left, right) => left.localeCompare(right))
}

function getNativeImports(resolvedNativeFile) {
  const physicalPath = getPhysicalNativePath(resolvedNativeFile?.resolvedPath)

  try {
    return {
      physicalPath,
      dlls: readPortableExecutableImports(physicalPath),
      error: null
    }
  } catch (error) {
    return {
      physicalPath,
      dlls: [],
      error: serializeError(error)
    }
  }
}

function loadModule(request) {
  try {
    require(request)
    return {
      request,
      ok: true,
      error: null
    }
  } catch (error) {
    return {
      request,
      ok: false,
      error: serializeError(error)
    }
  }
}

function isLikelyMissingWindowsRuntime(error) {
  const message = `${error?.message || ''} ${error?.stack || ''}`.toLowerCase()

  return (
    process.platform === 'win32' &&
    (
      (error?.code === 'ERR_DLOPEN_FAILED' && message.includes('.node')) ||
      message.includes('specified module could not be found') ||
      message.includes('no se puede encontrar el modulo especificado') ||
      message.includes('no se puede encontrar el modulo') ||
      message.includes('no se puede encontrar el m') ||
      message.includes('dll')
    )
  )
}

function buildProbeResult(probe) {
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

export function runNativeBindingDiagnostics(log, app) {
  const probes = [
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
    },
    {
      name: 'node-audio-volume-mixer',
      module: 'node-audio-volume-mixer',
      nativeFile: 'node-audio-volume-mixer/build/Release/addon.node',
      load: false
    }
  ]

  const diagnostics = {
    app: {
      isPackaged: Boolean(app?.isPackaged),
      appPath: typeof app?.getAppPath === 'function' ? app.getAppPath() : null
    },
    process: {
      platform: process.platform,
      arch: process.arch,
      versions: process.versions,
      resourcesPath: process.resourcesPath || null,
      execPath: process.execPath
    },
    probes: probes.map(buildProbeResult)
  }

  log.info('[native diagnostics]', JSON.stringify(diagnostics))

  for (const probe of diagnostics.probes) {
    if (probe.loadResult && !probe.loadResult.ok) {
      log.error(`[native diagnostics] Failed to load ${probe.name}:`, JSON.stringify(probe))
    }
  }

  return diagnostics
}
