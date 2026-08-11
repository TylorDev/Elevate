import type { AudioPipelineSnapshot } from '../../../main/Types/performanceDiagnostics.ts'
import { appendPerformanceEvent } from '../diagnostics/performanceDiagnostics'

type AudioGraphRecord = {
  audioContext: AudioContext
  sourceNode: MediaElementAudioSourceNode | null
  analyser: AnalyserNode
  sourceConnected: boolean
  analyserConnected: boolean
  destinationConnected: boolean
  graphError: string | null
  resumeRejected: boolean
  lastResumeError: string | null
  probePromise: Promise<AudioSignalSummary> | null
}

export type AudioSignalSummary = {
  sampleCount: number
  rms: number
  peak: number
}

const audioSources = new WeakMap<HTMLMediaElement, AudioGraphRecord>()

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function contextDetails(context: AudioContext): Record<string, string | number | null> {
  const withOutputLatency = context as AudioContext & { outputLatency?: number }
  return {
    state: context.state,
    sampleRate: Number(context.sampleRate) || null,
    baseLatency: Number(context.baseLatency) || null,
    outputLatency: Number(withOutputLatency.outputLatency) || null
  }
}

function userActivationSnapshot(): Record<string, boolean | null> {
  return {
    isActive: navigator.userActivation?.isActive ?? null,
    hasBeenActive: navigator.userActivation?.hasBeenActive ?? null
  }
}

function appendAudioEvent(
  name:
    | 'audio.context-created'
    | 'audio.context-state-change'
    | 'audio.context-resume-attempt'
    | 'audio.context-resume-result'
    | 'audio.graph-created'
    | 'audio.graph-failure'
    | 'audio.signal-probe',
  audioElement: HTMLMediaElement,
  details: Record<string, unknown>,
  level: 'info' | 'warn' | 'error' = 'info'
): void {
  appendPerformanceEvent(name, {
    level,
    filePath: audioElement.currentSrc || null,
    details
  })
}

export function resumeGlobalAudioContext(
  audioElement: HTMLMediaElement | null,
  cause: string
): Promise<void> | null {
  if (!audioElement) return null
  const record = audioSources.get(audioElement)
  if (!record || record.audioContext.state !== 'suspended') return null
  const previousState = record.audioContext.state
  appendAudioEvent('audio.context-resume-attempt', audioElement, {
    cause,
    previousState,
    userActivation: userActivationSnapshot(),
    ...contextDetails(record.audioContext)
  })
  return record.audioContext.resume().then(
    () => {
      record.resumeRejected = false
      record.lastResumeError = null
      appendAudioEvent('audio.context-resume-result', audioElement, {
        cause,
        success: true,
        previousState,
        ...contextDetails(record.audioContext)
      })
    },
    (error) => {
      record.resumeRejected = true
      record.lastResumeError = errorMessage(error)
      appendAudioEvent(
        'audio.context-resume-result',
        audioElement,
        {
          cause,
          success: false,
          previousState,
          error: record.lastResumeError,
          ...contextDetails(record.audioContext)
        },
        'error'
      )
      throw error
    }
  )
}

export const getGlobalAudioContext = (audioElement: HTMLMediaElement | null) => {
  if (!audioElement) return { audioContext: null, sourceNode: null, analyser: null }

  const AudioContextClass = window.AudioContext
  if (!AudioContextClass) return { audioContext: null, sourceNode: null, analyser: null }

  let record = audioSources.get(audioElement)
  if (!record) {
    const audioContext = new AudioContextClass()
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.82

    record = {
      audioContext,
      sourceNode: null,
      analyser,
      sourceConnected: false,
      analyserConnected: false,
      destinationConnected: false,
      graphError: null,
      resumeRejected: false,
      lastResumeError: null,
      probePromise: null
    }
    audioSources.set(audioElement, record)
    appendAudioEvent('audio.context-created', audioElement, contextDetails(audioContext))
    audioContext.addEventListener('statechange', () => {
      appendAudioEvent(
        'audio.context-state-change',
        audioElement,
        contextDetails(audioContext),
        audioContext.state === 'running' ? 'info' : 'warn'
      )
    })

    try {
      record.sourceNode = audioContext.createMediaElementSource(audioElement)
      record.sourceConnected = true
      record.sourceNode.connect(analyser)
      record.analyserConnected = true
      record.sourceNode.connect(audioContext.destination)
      record.destinationConnected = true
      appendAudioEvent('audio.graph-created', audioElement, {
        sourceConnected: record.sourceConnected,
        analyserConnected: record.analyserConnected,
        destinationConnected: record.destinationConnected,
        fftSize: analyser.fftSize
      })
    } catch (error) {
      record.graphError = errorMessage(error)
      appendAudioEvent(
        'audio.graph-failure',
        audioElement,
        {
          error: record.graphError,
          sourceConnected: record.sourceConnected,
          analyserConnected: record.analyserConnected,
          destinationConnected: record.destinationConnected
        },
        'error'
      )
      console.warn('Could not create MediaElementSourceNode:', error)
    }
  }

  if (record.audioContext.state === 'suspended') {
    resumeGlobalAudioContext(audioElement, 'get-global-audio-context')?.catch(console.error)
  }

  return record
}

async function wait(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))
}

export async function probeAudioSignal(
  audioElement: HTMLMediaElement,
  cause: string
): Promise<AudioSignalSummary> {
  const record = audioSources.get(audioElement)
  if (!record?.analyser || !record.analyserConnected) {
    const empty = { sampleCount: 0, rms: 0, peak: 0 }
    appendAudioEvent('audio.signal-probe', audioElement, { cause, ...empty }, 'warn')
    return empty
  }
  if (record.probePromise) return record.probePromise

  record.probePromise = (async () => {
    const buffer = new Float32Array(record.analyser.fftSize)
    let squaredTotal = 0
    let peak = 0
    let valueCount = 0
    const sampleCount = 8
    for (let sample = 0; sample < sampleCount; sample += 1) {
      record.analyser.getFloatTimeDomainData(buffer)
      for (const value of buffer) {
        const absolute = Math.abs(value)
        peak = Math.max(peak, absolute)
        squaredTotal += value * value
        valueCount += 1
      }
      if (sample < sampleCount - 1) await wait(250)
    }
    const result = {
      sampleCount,
      rms: valueCount ? Math.sqrt(squaredTotal / valueCount) : 0,
      peak
    }
    appendAudioEvent(
      'audio.signal-probe',
      audioElement,
      { cause, ...result, contextState: record.audioContext.state },
      result.rms <= 0.0005 && result.peak <= 0.002 ? 'warn' : 'info'
    )
    return result
  })().finally(() => {
    record.probePromise = null
  })
  return record.probePromise
}

function finite(value: unknown): number | null {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export async function captureAudioPipelineSnapshot(
  audioElement: HTMLAudioElement,
  cause: string,
  existingSignal?: AudioSignalSummary,
  probeStartedAt?: number
): Promise<{ audio: AudioPipelineSnapshot; resumeRejected: boolean }> {
  const startedAt = probeStartedAt ?? finite(audioElement.currentTime) ?? 0
  const signal = existingSignal || (await probeAudioSignal(audioElement, cause))
  const endedAt = finite(audioElement.currentTime) || 0
  const record = audioSources.get(audioElement)
  const context = record?.audioContext || null
  const withOutputLatency = context as (AudioContext & { outputLatency?: number }) | null
  return {
    resumeRejected: Boolean(record?.resumeRejected),
    audio: {
      currentTime: finite(audioElement.currentTime),
      duration: finite(audioElement.duration),
      progressedSeconds: Math.max(0, endedAt - startedAt),
      paused: audioElement.paused,
      ended: audioElement.ended,
      readyState: finite(audioElement.readyState),
      networkState: finite(audioElement.networkState),
      volume: finite(audioElement.volume),
      muted: audioElement.muted,
      playbackRate: finite(audioElement.playbackRate),
      currentSrc: audioElement.currentSrc || null,
      mediaErrorCode: finite(audioElement.error?.code),
      mediaErrorMessage: audioElement.error?.message || null,
      contextState: context?.state || null,
      sampleRate: finite(context?.sampleRate),
      baseLatency: finite(context?.baseLatency),
      outputLatency: finite(withOutputLatency?.outputLatency),
      sourceConnected: record?.sourceConnected ?? null,
      analyserConnected: record?.analyserConnected ?? null,
      destinationConnected: record?.destinationConnected ?? null,
      signal
    }
  }
}
