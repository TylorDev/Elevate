import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { importFreshProject } from './helpers/runtime.mjs'

const PROJECT_ROOT = process.cwd()

describe('Windows installer prerequisites', () => {
  it('uses the packaged app id for the Windows process identity', () => {
    const config = fs.readFileSync(path.join(PROJECT_ROOT, 'electron-builder.yml'), 'utf8')
    const bootstrap = fs.readFileSync(
      path.join(PROJECT_ROOT, 'src', 'main', 'main', 'bootstrap.ts'),
      'utf8'
    )
    const appId = config.match(/^appId:\s*(\S+)$/m)?.[1]

    expect(appId).toBe('com.tylordev.elevate')
    expect(bootstrap).toContain(`app.setAppUserModelId('${appId}')`)
  })

  it('uses an assisted per-user installer with a checked launch option', () => {
    const config = fs.readFileSync(path.join(PROJECT_ROOT, 'electron-builder.yml'), 'utf8')

    expect(config).toMatch(/nsis:\s*[\s\S]*oneClick: false/)
    expect(config).toMatch(/nsis:\s*[\s\S]*perMachine: false/)
    expect(config).toMatch(/nsis:\s*[\s\S]*runAfterFinish: true/)
    expect(config).not.toMatch(/extraResources:[\s\S]*vc_redist\.x64\.exe/)
  })

  it('checks and installs the VC++ runtime before application files are installed', () => {
    const installer = fs.readFileSync(path.join(PROJECT_ROOT, 'build', 'installer.nsh'), 'utf8')

    expect(installer).toContain('!macro customInit')
    expect(installer).toContain('!macro customInstallMode')
    expect(installer).toContain('VersionCompare')
    expect(installer).toContain('VC\\Runtimes\\x64')
    expect(installer).toContain('/install /passive /norestart')
    expect(installer).toContain('/install /quiet /norestart')
    expect(installer).toContain('SetErrorLevel 3010')
    expect(installer).not.toContain('!macro customInstall\n')
  })
})

describe('early startup failure dialog', () => {
  it('identifies a missing Windows native runtime', async () => {
    const { createStartupFailureDialog, isMissingWindowsRuntimeStartupError } =
      await importFreshProject('src/main/main/startupFailure.ts')
    const error = Object.assign(new Error('The specified module could not be found: index.node'), {
      code: 'ERR_DLOPEN_FAILED'
    })

    expect(isMissingWindowsRuntimeStartupError(error, 'win32')).toBe(true)
    expect(isMissingWindowsRuntimeStartupError(error, 'linux')).toBe(false)
    expect(createStartupFailureDialog(error, 'win32')).toMatchObject({
      title: 'Elevate necesita Microsoft Visual C++'
    })
  })

  it('keeps unrelated startup failures generic', async () => {
    const { createStartupFailureDialog } = await importFreshProject(
      'src/main/main/startupFailure.ts'
    )

    expect(createStartupFailureDialog(new Error('Renderer configuration failed'), 'win32')).toEqual(
      expect.objectContaining({ title: 'Elevate no pudo iniciarse' })
    )
  })
})
