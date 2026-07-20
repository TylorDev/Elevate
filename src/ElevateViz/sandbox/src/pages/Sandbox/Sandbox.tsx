import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ElevateViz, ElevateVizHost } from '@elevate-viz'
import type { ElevateVizAudioGraph, ElevateVizView } from '@elevate-viz'
import { DiagnosticsBar } from '../../components/DiagnosticsBar/DiagnosticsBar'
import { FilePicker } from '../../components/FilePicker/FilePicker'
import { ViewSwitcher } from '../../components/ViewSwitcher/ViewSwitcher'
import { SandboxLayout } from '../../layouts/SandboxLayout/SandboxLayout'
import { createBrowserVisualizerPersistence } from '../../services/browserVisualizerPersistence'
import { createMp3Asset, createPlaceholderCoverDataUrl } from '../../utils/mp3Asset'
import type { Mp3Asset } from '../../utils/mp3Asset'
import styles from './Sandbox.module.scss'

const EMPTY_AUDIO_GRAPH: ElevateVizAudioGraph = {
  audioElement: null,
  audioContext: null,
  sourceNode: null,
  analyser: null
}

export function Sandbox() {
  const browserPersistence = useMemo(() => createBrowserVisualizerPersistence(), [])
  const audioRef = useRef<HTMLAudioElement>(null)
  const assetRef = useRef<Mp3Asset | null>(null)
  const loadIdRef = useRef(0)
  const [view, setView] = useState<ElevateVizView>('stage')
  const [asset, setAsset] = useState<Mp3Asset | null>(null)
  const [assetSession, setAssetSession] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [audioGraph, setAudioGraph] = useState<ElevateVizAudioGraph>(EMPTY_AUDIO_GRAPH)
  const [isLoading, setIsLoading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progressSeconds, setProgressSeconds] = useState(0)
  const [durationSeconds, setDurationSeconds] = useState(0)
  const [audioState, setAudioState] = useState('sin archivo')
  const [nonFatalError, setNonFatalError] = useState<string | null>(null)
  const [isStepEnabled, setIsStepEnabled] = useState(false)
  const [persistenceMode, setPersistenceMode] = useState(browserPersistence.getMode)

  useEffect(() => browserPersistence.subscribe(setPersistenceMode), [browserPersistence])

  useEffect(() => {
    const audioElement = audioRef.current
    if (!audioElement || typeof AudioContext === 'undefined') return undefined

    let audioContext: AudioContext | null = null
    let sourceNode: MediaElementAudioSourceNode | null = null
    let analyser: AnalyserNode | null = null

    try {
      audioContext = new AudioContext()
      sourceNode = audioContext.createMediaElementSource(audioElement)
      analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.82
      sourceNode.connect(analyser)
      analyser.connect(audioContext.destination)
      setAudioGraph({ audioElement, audioContext, sourceNode, analyser })
    } catch (error) {
      setNonFatalError(
        error instanceof Error ? error.message : 'Web Audio no está disponible en este navegador.'
      )
      setAudioGraph({ ...EMPTY_AUDIO_GRAPH, audioElement })
    }

    const handlePlay = () => {
      setIsPlaying(true)
      setAudioState('reproduciendo')
      void audioContext?.resume()
    }
    const handlePause = () => {
      setIsPlaying(false)
      setAudioState(audioElement.ended ? 'finalizado' : 'pausado')
    }
    const handleTime = () => setProgressSeconds(audioElement.currentTime || 0)
    const handleDuration = () => {
      if (Number.isFinite(audioElement.duration)) setDurationSeconds(audioElement.duration)
    }
    const handleError = () => setNonFatalError('El navegador no pudo decodificar este MP3.')

    audioElement.addEventListener('play', handlePlay)
    audioElement.addEventListener('pause', handlePause)
    audioElement.addEventListener('timeupdate', handleTime)
    audioElement.addEventListener('durationchange', handleDuration)
    audioElement.addEventListener('loadedmetadata', handleDuration)
    audioElement.addEventListener('error', handleError)

    return () => {
      audioElement.pause()
      audioElement.removeEventListener('play', handlePlay)
      audioElement.removeEventListener('pause', handlePause)
      audioElement.removeEventListener('timeupdate', handleTime)
      audioElement.removeEventListener('durationchange', handleDuration)
      audioElement.removeEventListener('loadedmetadata', handleDuration)
      audioElement.removeEventListener('error', handleError)
      sourceNode?.disconnect()
      analyser?.disconnect()
      void audioContext?.close()
    }
  }, [])

  useEffect(
    () => () => {
      assetRef.current?.revoke()
    },
    []
  )

  const handleFile = useCallback(async (nextFile: File | null) => {
    if (!nextFile) return

    const loadId = ++loadIdRef.current
    setIsLoading(true)
    setNonFatalError(null)
    setAudioState('leyendo metadata')

    try {
      const nextAsset = await createMp3Asset(nextFile)
      if (loadId !== loadIdRef.current) {
        nextAsset.revoke()
        return
      }

      audioRef.current?.pause()
      assetRef.current?.revoke()
      assetRef.current = nextAsset
      setFile(nextFile)
      setAsset(nextAsset)
      setAssetSession((value) => value + 1)
      setProgressSeconds(0)
      setDurationSeconds(nextAsset.durationSeconds)
      setAudioState('listo')
      setNonFatalError(nextAsset.warning)
      setView('stage')
    } catch (error) {
      setAudioState('archivo rechazado')
      setNonFatalError(error instanceof Error ? error.message : 'No se pudo abrir el archivo.')
    } finally {
      if (loadId === loadIdRef.current) setIsLoading(false)
    }
  }, [])

  const togglePlayback = useCallback(() => {
    const element = audioRef.current
    if (!element || !asset) return

    if (element.paused) {
      void element.play().catch((error) => {
        setNonFatalError(error instanceof Error ? error.message : 'No se pudo iniciar el audio.')
      })
    } else {
      element.pause()
    }
  }, [asset])

  const restartTrack = useCallback(() => {
    if (!audioRef.current) return
    audioRef.current.currentTime = 0
  }, [])

  const seek = useCallback((event: React.MouseEvent<HTMLElement>) => {
    const element = audioRef.current
    if (!element || !Number.isFinite(element.duration)) return
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    element.currentTime = ratio * element.duration
  }, [])

  const activeSource = file
    ? { type: 'playlist' as const, id: file.name, label: `Sandbox · ${file.name}` }
    : null

  const header = (
    <div className={styles.headerContent}>
      <div className={styles.intro}>
        <span className={styles.eyebrow}>BROWSER SANDBOX · SIN IPC</span>
        <h1>ElevateViz, fuera de Electron</h1>
        <p>Sube un MP3 para probar audio, cover ID3, Butterchurn y persistencia degradable.</p>
      </div>
      <div className={styles.actions}>
        <FilePicker fileName={file?.name} disabled={isLoading} onSelect={handleFile} />
        <ViewSwitcher value={view} onChange={setView} />
        <audio
          className={styles.audio}
          ref={audioRef}
          src={asset?.audioUrl}
          controls
          preload="metadata"
        />
      </div>
      <p className={styles.help}>
        En Stage: <kbd>Tab</kbd> Cover/Viz · <kbd>←</kbd><kbd>→</kbd> presets · <kbd>↑</kbd> shuffle · <kbd>↓</kbd> pausa del ciclo · <kbd>F1</kbd> favorito.
      </p>
    </div>
  )

  return (
    <SandboxLayout
      header={header}
      diagnostics={
        <DiagnosticsBar
          fileName={file?.name}
          durationSeconds={durationSeconds}
          audioState={audioState}
          hasEmbeddedCover={Boolean(asset?.hasEmbeddedCover)}
          persistenceMode={persistenceMode}
          warning={nonFatalError}
        />
      }
    >
      <ElevateVizHost
        audio={audioGraph}
        playback={{
          isPlaying,
          hasCurrentTrack: Boolean(asset),
          currentTrackId: file?.name ?? null,
          progressSeconds,
          durationSeconds,
          onTogglePlayPause: togglePlayback,
          onPrevious: restartTrack,
          onNext: restartTrack,
          onSeek: seek
        }}
        coverUrl={asset?.coverUrl ?? createPlaceholderCoverDataUrl()}
        activeSource={activeSource}
        availableSources={activeSource ? [activeSource] : []}
        preferences={{
          rightClickHintDisabled: false,
          isStepEnabled,
          onToggleStep: () => setIsStepEnabled((value) => !value)
        }}
        persistence={browserPersistence.persistence}
      >
        <ElevateViz
          key={`${view}:${assetSession}`}
          view={view}
          defaultDisplayMode={asset ? 'visualizer' : 'cover'}
          onNavigateStage={() => setView('stage')}
          onNavigatePresets={() => setView('presets')}
        />
      </ElevateVizHost>
    </SandboxLayout>
  )
}
