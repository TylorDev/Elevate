import React, { useEffect, useRef, useCallback, useState } from 'react'
import butterchurn from 'butterchurn'
import butterchurnPresets from 'butterchurn-presets'
import MINI from 'butterchurn-presets/lib/elevate.min.js'
import { getGlobalAudioContext } from '../../utils/audioVisualizer'
import './Render.scss'

// [P2] Cache presets at module level â€” getPresets() returns a large object
// that never changes at runtime. Avoids re-creating it every 6 seconds.
const CACHED_PRESETS = MINI

// [P5] Hoisted static style object â€” avoids creating a new object per render.
const CANVAS_STYLE = { display: 'block' }

const Render = ({ audioElement, presetName }) => {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const visualizerRef = useRef(null)
  const animationFrameRef = useRef(null)

  // [P1] Dimensions stored as ref instead of state.
  // ResizeObserver updates are handled imperatively via setRendererSize()
  // without triggering React re-renders or tearing down the visualizer.
  const dimensionsRef = useRef({ width: 0, height: 0 })

  // One-time flag: flips to true when ResizeObserver provides valid dimensions.
  // This triggers the init effect to retry after the container is measured.
  const [hasDimensions, setHasDimensions] = useState(false)

  // [P4] Track whether the render loop should be active.
  const isPlayingRef = useRef(false)

  // [P4] Start/stop the render loop based on audio play state.
  const startRenderLoop = useCallback(() => {
    if (animationFrameRef.current) return // Already running
    if (!visualizerRef.current) return

    const loop = () => {
      if (!visualizerRef.current) return
      visualizerRef.current.render()
      animationFrameRef.current = requestAnimationFrame(loop)
    }
    animationFrameRef.current = requestAnimationFrame(loop)
  }, [])

  const stopRenderLoop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [])

  // [P1] ResizeObserver â€” updates canvas + visualizer size imperatively.
  // No state updates, no re-renders, no visualizer teardown.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          const isFirst = dimensionsRef.current.width === 0
          dimensionsRef.current = { width, height }

          // Flip flag once so the init effect can run
          if (isFirst) setHasDimensions(true)

          // Update canvas resolution directly
          if (canvasRef.current) {
            canvasRef.current.width = width
            canvasRef.current.height = height
          }

          // Update Butterchurn renderer size if already initialized
          if (visualizerRef.current) {
            visualizerRef.current.setRendererSize(width, height)
          }
        }
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Main initialization effect â€” only depends on audioElement.
  // [P1] No longer depends on dimensions, so resize won't destroy the visualizer.
  useEffect(() => {
    if (!audioElement || !canvasRef.current) return

    // Wait for container to have actual dimensions
    const { width, height } = dimensionsRef.current
    if (width === 0 || height === 0) return

    // Prevent double initialization
    if (visualizerRef.current) return

    const { audioContext: audioCtx, sourceNode: source } = getGlobalAudioContext(audioElement)

    if (!audioCtx || !source) {
      console.error('Could not retrieve global audio context or source node')
      return
    }

    canvasRef.current.width = width
    canvasRef.current.height = height

    const visualizer = butterchurn.createVisualizer(audioCtx, canvasRef.current, { width, height })

    visualizer.connectAudio(source)
    visualizerRef.current = visualizer

    // Load initial preset if available
    if (presetName && CACHED_PRESETS[presetName]) {
      visualizer.loadPreset(CACHED_PRESETS[presetName], 0)
    }

    // [P4] Listen for play/pause to start/stop the render loop.
    // This avoids burning CPU at 60fps when audio is paused.
    const handlePlay = () => {
      isPlayingRef.current = true
      startRenderLoop()
    }
    const handlePause = () => {
      isPlayingRef.current = false
      stopRenderLoop()
    }

    audioElement.addEventListener('play', handlePlay)
    audioElement.addEventListener('pause', handlePause)

    // Start loop immediately if audio is already playing
    if (!audioElement.paused) {
      isPlayingRef.current = true
      startRenderLoop()
    }

    return () => {
      // Cleanup render loop
      stopRenderLoop()

      // Cleanup audio event listeners
      audioElement.removeEventListener('play', handlePlay)
      audioElement.removeEventListener('pause', handlePause)

      // Disconnect audio from visualizer
      if (visualizerRef.current && source) {
        visualizerRef.current.disconnectAudio(source)
      }
      visualizerRef.current = null
    }
  }, [audioElement, hasDimensions, startRenderLoop, stopRenderLoop])

  // [P3] Load preset dynamically â€” depends ONLY on presetName.
  // Previously had dimensions.width/height as deps which caused
  // duplicate preset loads on every resize.
  useEffect(() => {
    if (presetName && visualizerRef.current && CACHED_PRESETS[presetName]) {
      try {
        // Blend time of 2 seconds for smooth transition
        visualizerRef.current.loadPreset(CACHED_PRESETS[presetName], 2)
      } catch (e) {
        console.error('Error loading preset', presetName, e)
      }
    }
  }, [presetName])

  return (
    <div className="render-wrapper" ref={containerRef}>
      <canvas ref={canvasRef} style={CANVAS_STYLE} />
    </div>
  )
}

export default Render
