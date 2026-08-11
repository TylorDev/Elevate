import { beforeEach, describe, expect, it } from 'vitest'

import {
  createPerformanceDiagnostic,
  getPerformanceDiagnosticLoggerForTests,
  normalizePerformanceDiagnosticPayload,
  recordRendererHeartbeat,
  resetPerformanceDiagnosticsForTests,
  writePerformanceDiagnostic
} from '../../src/main/diagnostics/performanceDiagnostics.ts'

function events() {
  const logger = getPerformanceDiagnosticLoggerForTests()
  return ['debug', 'info', 'warn', 'error'].flatMap((level) =>
    logger[level].mock.calls.map(([line]) => JSON.parse(line))
  )
}

beforeEach(() => {
  resetPerformanceDiagnosticsForTests()
  const logger = getPerformanceDiagnosticLoggerForTests()
  for (const level of ['debug', 'info', 'warn', 'error']) logger[level].mockClear()
})

describe('performance diagnostics logging', () => {
  it('normalizes untrusted renderer events into one bounded NDJSON envelope', () => {
    const normalized = normalizePerformanceDiagnosticPayload(
      {
        schemaVersion: 99,
        name: 'audio.graph-failure',
        occurredAt: 'invalid',
        filePath: `C:\\Music\\${'x'.repeat(5_000)}.mp3`,
        details: { error: `failure\n${'y'.repeat(5_000)}` }
      },
      'renderer',
      7
    )

    expect(normalized.schemaVersion).toBe(1)
    expect(normalized.filePath).toHaveLength(4_096)
    expect(normalized.details.error).toHaveLength(4_096)
    expect(normalized.webContentsId).toBe(7)
    expect(JSON.parse(JSON.stringify(normalized))).toEqual(normalized)
  })

  it('writes through a dedicated rotating 10 MiB logger', () => {
    expect(writePerformanceDiagnostic(createPerformanceDiagnostic('run.start'))).toBe(true)
    const logger = getPerformanceDiagnosticLoggerForTests()
    const [line] = logger.info.mock.calls.at(-1)

    expect(() => JSON.parse(line)).not.toThrow()
    expect(line).not.toContain('\n')
    expect(logger.transports.file.maxSize).toBe(10 * 1024 * 1024)
    expect(logger.transports.file.resolvePathFn()).toMatch(/performance-diagnostics\.log$/)
  })

  it('does not persist each heartbeat and reports a long-task aggregate', () => {
    const heartbeat = {
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      route: '/#/music',
      visibilityState: 'visible',
      documentHasFocus: true,
      longTasks: { count: 0, totalDurationMs: 0, maxDurationMs: 0 },
      jsHeap: null,
      activeOperation: null
    }
    expect(recordRendererHeartbeat(2, heartbeat)).toBe(true)
    expect(recordRendererHeartbeat(2, { ...heartbeat, occurredAt: new Date().toISOString() })).toBe(
      true
    )
    expect(events().filter((event) => event.name === 'metrics.summary')).toHaveLength(1)

    recordRendererHeartbeat(2, {
      ...heartbeat,
      longTasks: { count: 2, totalDurationMs: 800, maxDurationMs: 550 }
    })
    expect(events().filter((event) => event.name === 'renderer.long-task')).toHaveLength(1)
  })
})
