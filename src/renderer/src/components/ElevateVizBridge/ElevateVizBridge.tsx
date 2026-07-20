/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, type ReactNode } from 'react'
import { ElevateVizHost, type VisualizerSource } from '@elevate-viz'
import { useBackground } from '../../Contexts/BackgroundContext'
import { useMini } from '../../Contexts/MiniContext'
import { usePlayback } from '../../Contexts/PlaybackContext'
import { usePlaybackProgress } from '../../Contexts/PlaybackProgressContext'
import { usePlaylists } from '../../Contexts/PlaylistContext'
import { useQueue } from '../../Contexts/QueueContext'
import { useSuper } from '../../Contexts/SupeContext'
import { getGlobalAudioContext } from '../../utils/audioVisualizer'
import './ElevateVizBridge.module.scss'

interface ElevateVizBridgeProps {
  children: ReactNode
}

function normalizeActiveSource(queueName: unknown): VisualizerSource | null {
  if (typeof queueName !== 'string' || !queueName.trim()) return null
  if (queueName.startsWith('folder:')) {
    return { type: 'directory', id: queueName.slice('folder:'.length) }
  }
  if (queueName === 'favourites' || queueName === 'favorites') {
    return { type: 'favorites', id: 'favorites', label: 'Favoritos' }
  }
  return { type: 'playlist', id: queueName }
}

export function ElevateVizBridge({ children }: ElevateVizBridgeProps) {
  const { backgroundImageUrl } = useBackground()
  const {
    directories,
    directoriesLoaded,
    directoriesLoading,
    getDirectories
  } = useMini() as any
  const { isPlaying, mediaElement, togglePlayPause } = usePlayback()
  const { duration, progress, handleTimelineClick } = usePlaybackProgress() as any
  const {
    currentCover,
    getSavedLists,
    playlists,
    playlistsLoaded,
    playlistsLoading
  } = usePlaylists()
  const { currentFile, handleNextClick, handlePreviousClick, queueState } = useQueue()
  const { isStep, rightClickHintDisabled, toggleStep } = useSuper() as any

  useEffect(() => {
    if (!playlistsLoaded && !playlistsLoading) void getSavedLists()
    if (!directoriesLoaded && !directoriesLoading) void getDirectories()
  }, [
    directoriesLoaded,
    directoriesLoading,
    getDirectories,
    getSavedLists,
    playlistsLoaded,
    playlistsLoading
  ])

  const audio = useMemo(() => {
    const graph = getGlobalAudioContext(mediaElement)
    return { audioElement: mediaElement || null, ...graph }
  }, [mediaElement])

  const activeSource = useMemo(
    () => normalizeActiveSource(queueState?.queueName),
    [queueState?.queueName]
  )

  const availableSources = useMemo<VisualizerSource[]>(
    () => [
      { type: 'favorites', id: 'favorites', label: 'Favoritos' },
      ...playlists
        .filter((playlist) => playlist?.path)
        .map((playlist) => ({
          type: 'playlist' as const,
          id: playlist.path,
          label: playlist.nombre || playlist.path
        })),
      ...directories
        .filter((directory) => directory?.path)
        .map((directory) => ({
          type: 'directory' as const,
          id: directory.path,
          label: directory.name || directory.path.split('\\').pop() || directory.path
        }))
    ],
    [directories, playlists]
  )

  return (
    <ElevateVizHost
      audio={audio}
      playback={{
        isPlaying,
        hasCurrentTrack: Boolean(currentFile),
        currentTrackId: currentFile?.filePath || null,
        progressSeconds: progress,
        durationSeconds: duration,
        onTogglePlayPause: togglePlayPause,
        onPrevious: handlePreviousClick,
        onNext: handleNextClick,
        onSeek: handleTimelineClick
      }}
      coverUrl={currentCover || backgroundImageUrl}
      activeSource={activeSource}
      availableSources={availableSources}
      preferences={{
        rightClickHintDisabled,
        isStepEnabled: isStep,
        onToggleStep: toggleStep
      }}
    >
      {children}
    </ElevateVizHost>
  )
}
