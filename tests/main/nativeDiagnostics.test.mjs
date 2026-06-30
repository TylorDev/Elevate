import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { electronMock } from './helpers/electronMock.mjs'
import { importFreshProject } from './helpers/runtime.mjs'

describe('native diagnostics', () => {
  it('serializes failures and resolves modules without throwing', async () => {
    const { serializeError } = await importFreshProject('src/main/ipc/nativeDiagnostics/errors.ts')
    const { resolveModule } = await importFreshProject('src/main/ipc/nativeDiagnostics/modules.ts')

    expect(serializeError(Object.assign(new Error('broken'), { code: 'E_TEST' }))).toMatchObject({
      name: 'Error',
      message: 'broken',
      code: 'E_TEST'
    })
    expect(serializeError('plain failure')).toEqual({
      name: null,
      message: 'plain failure',
      code: null,
      stack: null
    })
    expect(resolveModule('sharp/package.json')).toMatchObject({ exists: true })
    expect(resolveModule('definitely-missing-elevate-module')).toMatchObject({
      resolvedPath: null,
      exists: false
    })
  })

  it('maps PE offsets and converts native paths outside ASAR', async () => {
    const { getPhysicalNativePath } = await importFreshProject(
      'src/main/ipc/nativeDiagnostics/modules.ts'
    )
    const { readPortableExecutableImports, rvaToOffset } = await importFreshProject(
      'src/main/ipc/nativeDiagnostics/portableExecutable.ts'
    )
    const sections = [
      { virtualSize: 0x200, virtualAddress: 0x1000, rawSize: 0x180, rawPointer: 0x400 }
    ]

    expect(rvaToOffset(sections, 0x1010)).toBe(0x410)
    expect(() => rvaToOffset(sections, 0x5000)).toThrow('Unable to map PE RVA')
    expect(getPhysicalNativePath(path.join('app.asar', 'addon.node'))).toContain(
      `app.asar.unpacked${path.sep}addon.node`
    )
    expect(readPortableExecutableImports('missing.node')).toEqual([])
  })

  it('builds and logs a report with an injectable safe probe', async () => {
    const { runNativeBindingDiagnostics } = await importFreshProject(
      'src/main/ipc/nativeDiagnostics/index.ts'
    )
    const logger = { info: vi.fn(), error: vi.fn() }
    const report = runNativeBindingDiagnostics(logger, electronMock.app, [
      { name: 'node-path', module: 'node:path', load: false }
    ])

    expect(report).toMatchObject({
      app: { isPackaged: true },
      probes: [{ name: 'node-path', module: 'node:path', loadResult: null }]
    })
    expect(logger.info).toHaveBeenCalledWith('[native diagnostics]', expect.any(String))
    expect(logger.error).not.toHaveBeenCalled()
  })
})
