import { useEffect, useRef } from 'react'

import './MediaTimeDisplay.scss'

import { useSuper } from '../../Contexts/SupeContext'

const audioSources = new WeakMap()

export const MediaTimeDisplay = ({ variant = 'mirrored' }) => {
  const { currentFile, progress, duration, handleTimelineClick, mediaRef } = useSuper()
  const canvasRef = useRef(null)
  const analyserRef = useRef(null)
  const dataRef = useRef(null)
  const animationRef = useRef(null)
  const progressRatioRef = useRef(0)
  const progressRatio = duration ? Math.min(progress / duration, 1) : 0

  useEffect(() => {
    progressRatioRef.current = progressRatio
  }, [progressRatio])

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) return undefined

    const AudioContextClass = window.AudioContext || window.webkitAudioContext

    let cancelled = false
    let audioContext
    let retryTimer
    let media

    const setupAudio = () => {
      if (cancelled) return

      media = mediaRef.current

      if (!media) {
        retryTimer = window.setTimeout(setupAudio, 100)
        return
      }

      if (!AudioContextClass) return

      try {
        const sourceRecord = audioSources.get(media)
        audioContext = sourceRecord?.audioContext || new AudioContextClass()
        const analyser = sourceRecord?.analyser || audioContext.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.82

        const source = sourceRecord?.source || audioContext.createMediaElementSource(media)
        if (!sourceRecord) {
          audioSources.set(media, { analyser, audioContext, source })
          source.connect(analyser)
          source.connect(audioContext.destination)
        }

        analyserRef.current = analyser
        dataRef.current = new Uint8Array(analyser.frequencyBinCount)
        media.addEventListener('play', resumeAudioContext)
        if (!media.paused) resumeAudioContext()
      } catch (error) {
        analyserRef.current = null
        dataRef.current = null
      }
    }

    const resumeAudioContext = () => {
      if (audioContext?.state === 'suspended') {
        audioContext.resume()
      }
    }

    const draw = () => {
      if (cancelled) return

      const context = canvas.getContext('2d')
      if (!context) return

      const rect = canvas.getBoundingClientRect()
      const pixelRatio = window.devicePixelRatio || 1
      const width = Math.max(1, Math.floor(rect.width * pixelRatio))
      const height = Math.max(1, Math.floor(rect.height * pixelRatio))

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }

      context.clearRect(0, 0, width, height)
      drawWaveform({
        analyser: analyserRef.current,
        context,
        data: dataRef.current,
        height,
        progressRatio: progressRatioRef.current,
        variant,
        width
      })

      animationRef.current = window.requestAnimationFrame(draw)
    }

    setupAudio()
    draw()

    return () => {
      cancelled = true
      if (retryTimer) window.clearTimeout(retryTimer)
      if (animationRef.current) window.cancelAnimationFrame(animationRef.current)
      media?.removeEventListener('play', resumeAudioContext)
    }
  }, [currentFile?.filePath, duration, mediaRef, variant])

  return (
    <div
      id="Otimeline"
      className={`waveform waveform-${variant}`}
      onClick={handleTimelineClick}
      role="slider"
      aria-label="Song progress"
      aria-valuemin={0}
      aria-valuemax={Math.floor(duration || 0)}
      aria-valuenow={Math.floor(progress || 0)}
    >
      <canvas ref={canvasRef} />
    </div>
  )
}

function drawWaveform({ analyser, context, data, height, progressRatio, variant, width }) {
  const styles = getComputedStyle(document.documentElement)
  const baseColor = styles.getPropertyValue('--secondary').trim() || '#1a1a1a'
  const progressColor = styles.getPropertyValue('--text-principal').trim() || '#baff00'
  const mutedColor = styles.getPropertyValue('--text-secondary').trim() || '#6f6f6f'
  const bars = 72
  const gap = 3
  const barWidth = Math.max(2, (width - gap * (bars - 1)) / bars)
  const progressX = width * progressRatio

  if (analyser && data) {
    analyser.getByteFrequencyData(data)
  }

  for (let index = 0; index < bars; index++) {
    const x = index * (barWidth + gap)
    const centerX = x + barWidth / 2
    const sample = data?.[Math.floor((index / bars) * (data.length - 1))]
    const fallback = 0.22 + Math.abs(Math.sin(index * 0.43)) * 0.56
    const level = sample ? sample / 255 : fallback
    const color = centerX <= progressX ? progressColor : baseColor

    context.fillStyle = color

    if (variant === 'oscilloscope') {
      const center = height / 2
      const waveY = center + Math.sin(index * 0.55) * level * height * 0.33
      const nextLevel = data?.[Math.floor(((index + 1) / bars) * (data.length - 1))]
      const nextFallback = 0.22 + Math.abs(Math.sin((index + 1) * 0.43)) * 0.56
      const nextWaveY =
        center +
        Math.sin((index + 1) * 0.55) *
        ((nextLevel ? nextLevel / 255 : nextFallback) * height * 0.33)

      context.strokeStyle = color
      context.lineWidth = Math.max(2, barWidth * 0.6)
      context.lineCap = 'round'
      context.beginPath()
      context.moveTo(centerX, waveY)
      context.lineTo(x + barWidth + gap, nextWaveY)
      context.stroke()
    } else {
      const barHeight = Math.max(4, level * height * 0.86)
      const y = (height - barHeight) / 2
      roundedRect(context, x, y, barWidth, barHeight, barWidth / 2)
    }
  }

  if (!analyser) {
    context.fillStyle = mutedColor
    context.globalAlpha = 0.28
    roundedRect(context, 0, height / 2 - 1, width, 2, 1)
    context.globalAlpha = 1
  }
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath()
  context.moveTo(x + radius, y)
  context.lineTo(x + width - radius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + radius)
  context.lineTo(x + width, y + height - radius)
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  context.lineTo(x + radius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - radius)
  context.lineTo(x, y + radius)
  context.quadraticCurveTo(x, y, x + radius, y)
  context.fill()
}
