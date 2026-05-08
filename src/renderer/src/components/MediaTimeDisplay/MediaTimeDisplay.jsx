import { useEffect, useRef } from 'react'

import './MediaTimeDisplay.scss'

import { useSuper } from '../../Contexts/SupeContext'
import { getGlobalAudioContext } from '../../utils/audioVisualizer'

const WAVEFORM_VARIANTS = new Set(['mirrored', 'oscilloscope'])
const SEEK_COLOR = '#ffffff'
const BARS_COUNT = 72
const BAR_GAP = 3

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
  // Cached dimensions includes pre-calculated bar sizes
  const dimensionsRef = useRef({ width: 0, height: 0, barWidth: 0, barStep: 0 })
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
      const width = Math.max(1, Math.floor(entry.contentRect.width * pixelRatio))
      const height = Math.max(1, Math.floor(entry.contentRect.height * pixelRatio))

      const barWidth = Math.max(2, (width - BAR_GAP * (BARS_COUNT - 1)) / BARS_COUNT)
      const barStep = barWidth + BAR_GAP

      dimensionsRef.current = { width, height, barWidth, barStep }
    })
    resizeObserver.observe(canvas)

    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) return undefined

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

      try {
        const { audioContext: ctx, analyser: analyzer } = getGlobalAudioContext(media)
        if (!ctx || !analyzer) return

        audioContext = ctx
        const analyser = analyzer

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

    // Get context once outside the loop
    const context = canvas.getContext('2d', { alpha: true })

    const draw = () => {
      if (cancelled) return

      if (!context) return

      // Use cached dimensions instead of getBoundingClientRect() every frame
      const { width, height, barWidth, barStep } = dimensionsRef.current

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
        width,
        barWidth,
        barStep
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
  width,
  barWidth,
  barStep
}) {
  const { baseColor, progressColor, mutedColor } = styles
  const progressX = width * progressRatio
  const seekPreviewX = seekPreviewRatio === null ? null : width * seekPreviewRatio
  const hasSeekPreview = seekPreviewX !== null
  const isFutureSeekPreview = hasSeekPreview && seekPreviewX > progressX
  const currentProgressSeekIndex =
    hasSeekPreview && !isFutureSeekPreview
      ? Math.min(BARS_COUNT - 1, Math.max(0, Math.round((seekPreviewX - barWidth / 2) / barStep)))
      : null

  let currentData = data;

  if (analyser && data) {
    let isSilent = false;
    if (frozenData) {
      isSilent = true;
      for (let i = 0; i < frozenData.length; i++) {
        if (frozenData[i] !== 0) {
          isSilent = false;
          break;
        }
      }
    }

    const shouldCaptureFrame = isPlaying || !isSilent;

    if (shouldCaptureFrame) {
      if (variant === 'oscilloscope') {
        analyser.getByteTimeDomainData(data)
      } else {
        analyser.getByteFrequencyData(data)
      }
      if (frozenData) frozenData.set(data)
    } else if (frozenData) {
      // Use frozen data directly without copying
      currentData = frozenData
    }
  }

  // Pre-initialize groups
  const groups = {
    [baseColor]: [],
    [progressColor]: [],
    [SEEK_COLOR]: []
  };

  const center = height / 2;
  const isOscilloscope = variant === 'oscilloscope';
  const dataLength = currentData ? currentData.length - 1 : 0;

  // Cache current sample to use as previous in the next iteration
  let currentSample = currentData?.[0] || (isOscilloscope ? 128 : 0);

  for (let index = 0; index < BARS_COUNT; index++) {
    const x = index * barStep
    const centerX = x + barWidth / 2
    const isProgress = centerX <= progressX
    const isCurrentProgressSeek = currentProgressSeekIndex === index
    const isFutureSeekBar = isFutureSeekPreview && centerX > progressX && centerX <= seekPreviewX
    const color = isCurrentProgressSeek
      ? SEEK_COLOR
      : isProgress
        ? progressColor
        : isFutureSeekBar
          ? SEEK_COLOR
          : baseColor

    if (isOscilloscope) {
      const waveLevel = (currentSample - 128) / 128
      const waveY = center + waveLevel * height * 0.18

      const nextSampleIndex = Math.floor(((index + 1) / BARS_COUNT) * dataLength)
      const nextSample = currentData?.[nextSampleIndex] || 128
      const nextWaveLevel = (nextSample - 128) / 128
      const nextWaveY = center + nextWaveLevel * height * 0.18

      groups[color].push({
        x1: centerX,
        y1: waveY,
        x2: x + barStep,
        y2: nextWaveY
      })

      currentSample = nextSample;
    } else {
      const fallback = 0;
      const sample = currentData ? currentSample : fallback;
      const level = sample / 255
      const barHeight = Math.max(4, level * height * 0.86)
      const y = (height - barHeight) / 2

      groups[color].push({ x, y, barHeight })

      if (index < BARS_COUNT - 1) {
        const nextSampleIndex = Math.floor(((index + 1) / BARS_COUNT) * dataLength)
        currentSample = currentData?.[nextSampleIndex] || fallback
      }
    }
  }

  if (isOscilloscope) {
    context.lineWidth = Math.max(2.2, barWidth * 1)
    context.lineCap = 'round'

    for (const color in groups) {
      const lines = groups[color]
      if (lines.length === 0) continue

      context.beginPath()
      context.strokeStyle = color
      for (let i = 0; i < lines.length; i++) {
        context.moveTo(lines[i].x1, lines[i].y1)
        context.lineTo(lines[i].x2, lines[i].y2)
      }
      context.stroke()
    }
  } else {
    for (const color in groups) {
      const rects = groups[color]
      if (rects.length === 0) continue

      context.beginPath()
      context.fillStyle = color
      const radius = barWidth / 2

      for (let i = 0; i < rects.length; i++) {
        const { x, y, barHeight } = rects[i]
        // Native roundRect - MUCH faster than manual path drawing
        if (context.roundRect) {
          context.roundRect(x, y, barWidth, barHeight, radius)
        } else {
          // Fallback for very old browsers just in case
          context.rect(x, y, barWidth, barHeight)
        }
      }
      context.fill()
    }
  }

  if (!analyser) {
    context.fillStyle = mutedColor
    context.globalAlpha = 0.28
    context.beginPath()
    if (context.roundRect) {
      context.roundRect(0, height / 2 - 1, width, 2, 1)
    } else {
      context.rect(0, height / 2 - 1, width, 2)
    }
    context.fill()
    context.globalAlpha = 1
  }
}
