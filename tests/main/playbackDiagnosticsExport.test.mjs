import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import log from 'electron-log/main.js'
import JSZip from 'jszip'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { exportPlaybackDiagnostics } from '../../src/main/diagnostics/playbackExport.ts'
import { getPlaybackDiagnosticsPaths } from '../../src/main/diagnostics/playbackDiagnostics.ts'
import { configureElectronPaths, setSaveDialogResult } from './helpers/electronMock.mjs'

let root

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'elevate-playback-export-'))
  configureElectronPaths(root)
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('playback diagnostics ZIP export', () => {
  it('streams current and rotated logs plus manifest, summary and guide without the database', async () => {
    const outputPath = path.join(root, 'diagnostics.zip')
    const playbackPaths = getPlaybackDiagnosticsPaths()
    const generalPath = path.join(root, 'logs', 'main.log')
    await mkdir(path.dirname(playbackPaths.current), { recursive: true })
    await Promise.all([
      writeFile(playbackPaths.current, '{"name":"db.commit"}\n'),
      writeFile(playbackPaths.old, '{"name":"award.request"}\n'),
      writeFile(generalPath, 'general log\n')
    ])
    log.transports.file.getFile.mockReturnValue({ path: generalPath })
    setSaveDialogResult({ canceled: false, filePath: outputPath })

    await expect(exportPlaybackDiagnostics(null)).resolves.toEqual({
      success: true,
      filePath: outputPath
    })

    const zip = await JSZip.loadAsync(await readFile(outputPath))
    const names = Object.keys(zip.files)
    expect(names).toContain('logs/playback-diagnostics.log')
    expect(names).toContain('logs/playback-diagnostics.old.log')
    expect(names).toContain('logs/general-main.log')
    expect(names).toContain('manifest.json')
    expect(names).toContain('playback-summary.json')
    expect(names).toContain('README.txt')
    expect(names.some((name) => /\.sqlite$|\.db$/i.test(name))).toBe(false)

    const manifest = JSON.parse(await zip.file('manifest.json').async('string'))
    const summary = JSON.parse(await zip.file('playback-summary.json').async('string'))
    expect(manifest.appRunId).toMatch(/^[0-9a-f-]{36}$/i)
    expect(manifest.logging.playbackMaxFileBytes).toBe(10 * 1024 * 1024)
    expect(summary).toMatchObject({ limit: 50, tracks: [] })
  })

  it('treats cancellation as a normal result and creates no archive', async () => {
    setSaveDialogResult({ canceled: true, filePath: undefined })

    await expect(exportPlaybackDiagnostics(null)).resolves.toEqual({
      success: false,
      code: 'canceled',
      error: ''
    })
  })

  it('handles absent rotated logs and removes partial output after a failure', async () => {
    const outputPath = path.join(root, 'missing-parent', 'diagnostics.zip')
    setSaveDialogResult({ canceled: false, filePath: outputPath })

    const result = await exportPlaybackDiagnostics(null)
    expect(result).toMatchObject({ success: false, code: 'export-failed' })
    await expect(readFile(outputPath)).rejects.toThrow()
  })
})
