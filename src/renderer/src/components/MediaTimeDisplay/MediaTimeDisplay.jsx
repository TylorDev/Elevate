import { useEffect, useRef } from 'react'

import './MediaTimeDisplay.scss'

import { useSuper } from '../../Contexts/SupeContext'

const audioSources = new WeakMap()
const WAVEFORM_VARIANTS = new Set(['mirrored', 'oscilloscope'])

export const MediaTimeDisplay = ({ variant = 'mirrored' }) => {
  const { currentFile, progress, duration, handleTimelineClick, isPlaying, mediaRef } = useSuper()
  const canvasRef = useRef(null)
  const analyserRef = useRef(null)
  const dataRef = useRef(null)
  const frozenDataRef = useRef(null)
  const animationRef = useRef(null)
  const progressRatioRef = useRef(0)
  const isPlayingRef = useRef(isPlaying)
  const seekPreviewRatioRef = useRef(null)
  const variantRef = useRef(normalizeVariant(variant))
  const dimensionsRef = useRef({ width: 0, height: 0 })
  const cachedStylesRef = useRef({ baseColor: '#1a1a1a', progressColor: '#baff00', mutedColor: '#6f6f6f' })
  const progressRatio = duration ? Math.min(progress / duration, 1) : 0

  useEffect(() => {
    progressRatioRef.current = progressRatio
  }, [progressRatio])

  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  useEffect(() => {
    variantRef.current = normalizeVariant(variant)
  }, [variant])

  // Cache computed styles — only recalculate when CSS variables could change
  useEffect(() => {
    const updateStyles = () => {
      const styles = getComputedStyle(document.documentElement)
      cachedStylesRef.current = {
        baseColor: styles.getPropertyValue('--text-secondary').trim() || '#1a1a1a',
        progressColor: styles.getPropertyValue('--text-principal').trim() || '#baff00',
        mutedColor: styles.getPropertyValue('--text-secondary').trim() || '#6f6f6f'
      }
    }

    updateStyles()

    // Re-read when color theme might change
    const observer = new MutationObserver(updateStyles)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'class']
    })

    return () => observer.disconnect()
  }, [])

  // Cache canvas dimensions — only recalculate on resize
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const pixelRatio = window.devicePixelRatio || 1
      dimensionsRef.current = {
        width: Math.max(1, Math.floor(entry.contentRect.width * pixelRatio)),
        height: Math.max(1, Math.floor(entry.contentRect.height * pixelRatio))
      }
    })
    resizeObserver.observe(canvas)

    return () => resizeObserver.disconnect()
  }, [])

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
        frozenDataRef.current = new Uint8Array(analyser.frequencyBinCount)
        media.addEventListener('play', resumeAudioContext)
        if (!media.paused) resumeAudioContext()
      } catch (error) {
        analyserRef.current = null
        dataRef.current = null
        frozenDataRef.current = null
      }
    }

    const resumeAudioContext = () => {
      if (audioContext?.state === 'suspended') {
        audioContext.resume()
      }
    }

    const draw = () => {
      if (cancelled) return

      const context = canvas.getContext('2d', { alpha: true })
      if (!context) return

      // Use cached dimensions instead of getBoundingClientRect() every frame
      const { width, height } = dimensionsRef.current

      if (width === 0 || height === 0) {
        animationRef.current = window.requestAnimationFrame(draw)
        return
      }

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }

      context.clearRect(0, 0, width, height)
      drawWaveform({
        analyser: analyserRef.current,
        context,
        data: dataRef.current,
        frozenData: frozenDataRef.current,
        height,
        isPlaying: isPlayingRef.current,
        progressRatio: progressRatioRef.current,
        seekPreviewRatio: seekPreviewRatioRef.current,
        styles: cachedStylesRef.current,
        variant: variantRef.current,
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
  }, [currentFile?.filePath, duration, mediaRef])

  const normalizedVariant = normalizeVariant(variant)
  const updateSeekPreview = (event) => {
    seekPreviewRatioRef.current = getPointerRatio(event)
  }

  const clearSeekPreview = () => {
    seekPreviewRatioRef.current = null
  }

  return (
    <div
      id="Otimeline"
      className={`waveform waveform-${normalizedVariant}`}
      onClick={handleTimelineClick}
      onPointerDown={updateSeekPreview}
      onPointerLeave={clearSeekPreview}
      onPointerMove={updateSeekPreview}
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

function getPointerRatio(event) {
  const rect = event.currentTarget.getBoundingClientRect()
  if (!rect.width) return 0

  return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
}

function normalizeVariant(variant) {
  if (variant === 'scilloscope') return 'oscilloscope'
  return WAVEFORM_VARIANTS.has(variant) ? variant : 'mirrored'
}

function drawWaveform({
  analyser,
  context,
  data,
  frozenData,
  height,
  isPlaying,
  progressRatio,
  seekPreviewRatio,
  styles,
  variant,
  width
}) {
  const { baseColor, progressColor, mutedColor } = styles
  const seekColor = '#ffffff'
  const bars = 72
  const gap = 3
  const barWidth = Math.max(2, (width - gap * (bars - 1)) / bars)
  const barStep = barWidth + gap
  const progressX = width * progressRatio
  const seekPreviewX = seekPreviewRatio === null ? null : width * seekPreviewRatio
  const hasSeekPreview = seekPreviewX !== null
  const isFutureSeekPreview = hasSeekPreview && seekPreviewX > progressX
  const currentProgressSeekIndex =
    hasSeekPreview && !isFutureSeekPreview
      ? Math.min(bars - 1, Math.max(0, Math.round((seekPreviewX - barWidth / 2) / barStep)))
      : null

  if (analyser && data) {
    const shouldCaptureFrame = isPlaying || !frozenData?.some((value) => value !== 0)

    if (shouldCaptureFrame) {
      if (variant === 'oscilloscope') {
        analyser.getByteTimeDomainData(data)
      } else {
        analyser.getByteFrequencyData(data)
      }

      if (frozenData) frozenData.set(data)
    } else if (frozenData) {
      data.set(frozenData)
    }
  }

  for (let index = 0; index < bars; index++) {
    const x = index * (barWidth + gap)
    const centerX = x + barWidth / 2
    const sample = data?.[Math.floor((index / bars) * (data.length - 1))]
    const fallback = variant === 'oscilloscope' ? 128 : 0
    const level = sample ? sample / 255 : fallback
    const isProgress = centerX <= progressX
    const isCurrentProgressSeek = currentProgressSeekIndex === index
    const isFutureSeekBar = isFutureSeekPreview && centerX > progressX && centerX <= seekPreviewX
    const color = isCurrentProgressSeek
      ? seekColor
      : isProgress
        ? progressColor
        : isFutureSeekBar
          ? seekColor
          : baseColor

    context.fillStyle = color

    if (variant === 'oscilloscope') {
      const center = height / 2
      const waveLevel = sample ? (sample - 128) / 128 : 0
      const waveY = center + waveLevel * height * 0.18
      const nextLevel = data?.[Math.floor(((index + 1) / bars) * (data.length - 1))]
      const nextWaveLevel = nextLevel ? (nextLevel - 128) / 128 : 0
      const nextWaveY =
        center +
        nextWaveLevel * height * 0.18

      context.strokeStyle = color
      context.lineWidth = Math.max(2.2, barWidth * 1)
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
