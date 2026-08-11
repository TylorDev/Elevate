import { describe, expect, it } from 'vitest'

import {
  classifyNoSoundIncident,
  normalizeNoSoundCapturePayload
} from '../../src/main/ipc/performanceDiagnostics/index.ts'

function payload(audio = {}, overrides = {}) {
  return {
    occurredAt: new Date().toISOString(),
    incidentId: crypto.randomUUID(),
    manual: true,
    audio: {
      currentTime: 4,
      duration: 120,
      progressedSeconds: 1.8,
      paused: false,
      ended: false,
      readyState: 4,
      networkState: 1,
      volume: 1,
      muted: false,
      playbackRate: 1,
      currentSrc: 'file:///C:/Music/song.mp3',
      mediaErrorCode: null,
      mediaErrorMessage: null,
      contextState: 'running',
      sampleRate: 48_000,
      baseLatency: 0.01,
      outputLatency: 0.02,
      sourceConnected: true,
      analyserConnected: true,
      destinationConnected: true,
      signal: { sampleCount: 8, rms: 0.2, peak: 0.7 },
      ...audio
    },
    ...overrides
  }
}

describe('no-sound classification', () => {
  it('rejects missing audio and bounds untrusted fields', () => {
    expect(normalizeNoSoundCapturePayload({ incidentId: 'missing-audio' })).toBeNull()
    const normalized = normalizeNoSoundCapturePayload(
      payload({ currentSrc: 'x'.repeat(5_000), mediaErrorMessage: 'e'.repeat(3_000) })
    )
    expect(normalized.audio.currentSrc).toHaveLength(4_096)
    expect(normalized.audio.mediaErrorMessage).toHaveLength(2_048)
  })

  it.each([
    [payload({ progressedSeconds: 0 }), true, 'media-not-progressing'],
    [payload({ muted: true }), true, 'element-muted-or-zero-volume'],
    [payload({}, { resumeRejected: true }), true, 'audio-context-resume-rejected'],
    [payload({ contextState: 'suspended' }), true, 'audio-context-not-running'],
    [payload({ destinationConnected: false }), true, 'graph-creation-or-connection-failed'],
    [payload({ signal: { sampleCount: 8, rms: 0, peak: 0 } }), true, 'graph-signal-zero'],
    [payload(), false, 'chromium-not-audible'],
    [payload(), true, 'external-output-suspected']
  ])('classifies the captured pipeline as %s', (input, audible, expected) => {
    expect(classifyNoSoundIncident(input, audible)).toBe(expected)
  })
})
