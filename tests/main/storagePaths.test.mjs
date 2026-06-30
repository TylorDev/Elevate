import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { electronMock, getRegisteredIpcChannels, invokeIpc } from './helpers/electronMock.mjs'
import { createRuntimeContext, importFreshProject } from './helpers/runtime.mjs'

let runtime = null

afterEach(async () => {
  if (runtime) {
    await runtime.cleanup()
    runtime = null
  }
})

describe('storage paths', () => {
  it('resolves portable paths, database overrides and stable template candidates', async () => {
    runtime = await createRuntimeContext()
    const databasePath = path.join(runtime.root, 'custom.db')
    process.env.DATABASE_URL = `file:${databasePath}`
    const storage = await importFreshProject('src/main/ipc/storagePaths/index.ts')
    const paths = storage.getStoragePaths()

    expect(paths).toMatchObject({
      runtimeMode: 'portable-debug-override',
      isPackaged: true,
      usesPortableOverride: true,
      userDataRoot: process.env.ELEVATE_PORTABLE_DATA_DIR,
      databasePath: path.resolve(databasePath),
      updaterCacheDirName: 'elevate-updater'
    })
    expect(paths.coverThumbRoot).toBe(path.join(paths.coverCacheRoot, 'thumb'))
    expect(paths.backgroundConfigPath).toBe(
      path.join(paths.backgroundImagesRoot, 'background-config.json')
    )
    expect(paths.templateDatabaseCandidates).toHaveLength(4)
    expect(path.normalize(paths.templateDatabaseCandidates.at(-1))).toBe(
      path.normalize(path.resolve('prisma/template.db'))
    )
  })

  it('reports existing and writable fallback paths and exposes diagnostics through IPC', async () => {
    runtime = await createRuntimeContext()
    const existingFile = path.join(runtime.root, 'state.json')
    await fs.promises.writeFile(existingFile, '{}')
    const { buildPathInfo } = await importFreshProject('src/main/ipc/storagePaths/diagnostics.ts')
    const storage = await importFreshProject('src/main/ipc/storagePaths/index.ts')

    expect(buildPathInfo(existingFile)).toMatchObject({
      exists: true,
      kind: 'file',
      size: 2,
      isWritable: true
    })
    expect(
      buildPathInfo(path.join(runtime.root, 'missing.db'), {
        fallbackWritableTarget: runtime.root
      })
    ).toMatchObject({ exists: false, kind: 'missing', isWritable: true })

    storage.setupStoragePathHandlers()
    expect(getRegisteredIpcChannels()).toEqual(['app:get-storage-paths'])
    const diagnostics = await invokeIpc('app:get-storage-paths')
    expect(diagnostics).toMatchObject({
      runtimeMode: 'portable-debug-override',
      paths: { userDataRoot: { path: process.env.ELEVATE_PORTABLE_DATA_DIR } }
    })
  })

  it('distinguishes development and installed runtime modes', async () => {
    runtime = await createRuntimeContext()
    const runtimePaths = await importFreshProject('src/main/ipc/storagePaths/runtime.ts')

    electronMock.app.isPackaged = false
    expect(runtimePaths.getRuntimeMode()).toBe('development')

    electronMock.app.isPackaged = true
    delete process.env.ELEVATE_ENABLE_PORTABLE_MODE
    delete process.env.ELEVATE_PORTABLE_DATA_DIR
    expect(runtimePaths.getRuntimeMode()).toBe('installed-release')
  })
})
