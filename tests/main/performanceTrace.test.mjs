import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  getPerformanceTracePaths,
  initializePerformanceTrace,
  resetPerformanceTraceForTests,
  startPerformanceTrace,
  stopPerformanceTrace
} from '../../src/main/diagnostics/performanceTrace.ts'
import { configureElectronPaths, electronMock } from './helpers/electronMock.mjs'

let root

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'elevate-performance-trace-'))
  configureElectronPaths(root)
  resetPerformanceTraceForTests()
})

afterEach(async () => {
  resetPerformanceTraceForTests()
  await rm(root, { recursive: true, force: true })
})

describe('performance trace manager', () => {
  it('records for the current run and atomically promotes a completed trace', async () => {
    electronMock.contentTracing.stopRecording.mockImplementationOnce(async (filePath) => {
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, '{"traceEvents":[]}')
      return filePath
    })

    const started = await startPerformanceTrace('now')
    expect(started).toMatchObject({ success: true, status: { state: 'recording', mode: 'now' } })

    const stopped = await stopPerformanceTrace('test')
    expect(stopped).toMatchObject({ state: 'captured', mode: 'now' })
    await expect(readFile(getPerformanceTracePaths().captured, 'utf8')).resolves.toContain(
      'traceEvents'
    )
  })

  it('persists a one-shot request for the next launch without starting tracing now', async () => {
    const result = await startPerformanceTrace('next-launch')
    expect(result).toMatchObject({ success: true, status: { state: 'armed', mode: 'next-launch' } })
    await expect(readFile(getPerformanceTracePaths().armedState, 'utf8')).resolves.toContain(
      'armedAt'
    )
    expect(electronMock.contentTracing.startRecording).not.toHaveBeenCalled()

    resetPerformanceTraceForTests()
    const launched = await initializePerformanceTrace()
    expect(launched).toMatchObject({ state: 'recording', mode: 'next-launch' })
    expect(electronMock.contentTracing.startRecording).toHaveBeenCalledTimes(1)
    await expect(readFile(getPerformanceTracePaths().armedState, 'utf8')).rejects.toThrow()
  })
})
