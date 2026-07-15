import type {
  AppendTracksToPlaylistResult,
  PlaylistDeleteCompletedPayload,
  PlaylistDeleteQueuedResponse,
  UpdatePlaylistMetadataRequest,
  UpdatePlaylistMetadataResult
} from '../../../../main/Types/playlistHandlers.ts'
import type {
  PlaylistDeleteResponse,
  PlaylistMutationDependencies,
  PlaylistHistoryResponse,
  PlaylistTrackInput
} from '../../Types/PlaylistContextTypes/index.ts'
import {
  extractTrackPaths,
  getErrorMessage,
  isSuccessfulResponse,
  normalizePlaylistPath,
  PLAYLIST_DELETE_TOAST_ID
} from './playlistUtils.ts'

export type PlaylistMutations = {
  addPlaylisthistory: (path?: string | null) => Promise<PlaylistHistoryResponse>
  updatePlaylistMetadata: (
    path: string,
    payload: Omit<UpdatePlaylistMetadataRequest, 'path'>
  ) => Promise<UpdatePlaylistMetadataResult>
  deletePlaylist: (filePath?: string | null) => PlaylistDeleteResponse
  isPlaylistDeleting: (filePath: string) => boolean
  handlePlaylistDeleteCompleted: (result: PlaylistDeleteCompletedPayload) => void
  removeSongFromList: (playlistPath: string, index: number) => Promise<void>
  addSongToList: (playlistPath: string, newTrack: unknown) => Promise<void>
  appendTracksToPlaylist: (
    playlistPath: string,
    tracks?: PlaylistTrackInput[]
  ) => Promise<AppendTracksToPlaylistResult>
}

export const createPlaylistMutations = (dependencies: PlaylistMutationDependencies): PlaylistMutations => {
  const {
    invoke,
    playlistsRef,
    pendingDeletesRef,
    pendingJobsRef,
    processedJobsRef,
    setPlaylists,
    setPlaylistsLoaded,
    setPlaylistsLastLoadedAt,
    setDeletingPlaylistPaths,
    refreshPlaylists,
    notify,
    translate,
    removeTrack,
    addSong
  } = dependencies

  const removeDeletingPlaylistPath = (filePath: string) => {
    setDeletingPlaylistPaths((previousPaths) => previousPaths.filter((path) => path !== filePath))
  }

  const addDeletingPlaylistPath = (filePath: string) => {
    setDeletingPlaylistPaths((previousPaths) =>
      previousPaths.includes(filePath) ? previousPaths : [...previousPaths, filePath]
    )
  }

  const showPlaylistDeleteToast = (type: 'success' | 'error', message: string) =>
    notify(type, message, PLAYLIST_DELETE_TOAST_ID)

  const restoreOptimisticPlaylistDelete = (filePath: string) => {
    const deletedPlaylist = pendingDeletesRef.current.get(filePath)
    pendingDeletesRef.current.delete(filePath)
    removeDeletingPlaylistPath(filePath)

    if (deletedPlaylist) {
      setPlaylists((previousPlaylists) => {
        if (previousPlaylists.some((playlist) => playlist.path === filePath)) {
          return previousPlaylists
        }

        const nextPlaylists = [deletedPlaylist, ...previousPlaylists]
        playlistsRef.current = nextPlaylists
        return nextPlaylists
      })
    }

    setPlaylistsLoaded(false)
    void refreshPlaylists().catch((error) => {
      console.error('Error restoring playlists after deletion:', error)
    })
  }

  const addPlaylisthistory = async (path?: string | null): Promise<PlaylistHistoryResponse> => {
    try {
      const fileInfo = await invoke<void>('load-list-to-history', path)
      return { success: true, message: 'Data sent successfully', fileInfo }
    } catch (error) {
      notify('error', getErrorMessage(error, 'Error saving file'))
      return { success: false, message: 'Error saving file', error }
    }
  }

  const updatePlaylistMetadata = async (
    path: string,
    payload: Omit<UpdatePlaylistMetadataRequest, 'path'>
  ) => {
    const response = await invoke<UpdatePlaylistMetadataResult>('update-playlist-metadata', {
      path,
      ...payload
    })

    if (response.success) {
      if (response.playlist) {
        setPlaylists((previousPlaylists) => {
          const nextPlaylists = previousPlaylists.map((playlist) =>
            playlist.path === path
              ? {
                  ...playlist,
                  ...response.playlist,
                  cover: response.effectiveCover ?? playlist.cover,
                  effectiveCover: response.effectiveCover ?? playlist.effectiveCover,
                  coverConfig: response.coverConfig ?? playlist.coverConfig
                }
              : playlist
          )
          playlistsRef.current = nextPlaylists
          return nextPlaylists
        })
        setPlaylistsLoaded(true)
        setPlaylistsLastLoadedAt(Date.now())
      }
    } else {
      console.error('Error updating playlist metadata:', response.error)
      notify('error', response.error || translate('playlists.saveFailed'))
    }

    return response
  }

  const deletePlaylist = (filePath?: string | null): PlaylistDeleteResponse => {
    const normalizedPath = normalizePlaylistPath(filePath)

    if (!normalizedPath) {
      const errorMessage = translate('playlists.invalidPath')
      notify('error', errorMessage)
      return { success: false, error: errorMessage }
    }

    if (pendingDeletesRef.current.has(normalizedPath)) {
      return { success: true, queued: true, path: normalizedPath, duplicate: true }
    }

    const playlistSnapshot =
      playlistsRef.current.find((playlist) => playlist.path === normalizedPath) || null

    setPlaylists((previousPlaylists) => {
      const nextPlaylists = previousPlaylists.filter((playlist) => playlist.path !== normalizedPath)
      playlistsRef.current = nextPlaylists
      return nextPlaylists
    })

    pendingDeletesRef.current.set(normalizedPath, playlistSnapshot)
    addDeletingPlaylistPath(normalizedPath)

    void invoke<PlaylistDeleteQueuedResponse>('delete-playlist', normalizedPath)
      .then((result) => {
        if (!result?.success) {
          restoreOptimisticPlaylistDelete(normalizedPath)
          showPlaylistDeleteToast('error', result?.error || translate('playlists.saveFailed'))
        }

        if (result?.success && 'jobId' in result && typeof result.jobId === 'string') {
          pendingJobsRef.current.set(result.jobId, normalizedPath)
        }
      })
      .catch((error) => {
        restoreOptimisticPlaylistDelete(normalizedPath)
        showPlaylistDeleteToast('error', getErrorMessage(error, translate('playlists.saveFailed')))
      })

    return { success: true, queued: true, path: normalizedPath }
  }

  const isPlaylistDeleting = (filePath: string) => pendingDeletesRef.current.has(filePath)

  const handlePlaylistDeleteCompleted = (result: PlaylistDeleteCompletedPayload) => {
    const eventJobId = result?.jobId
    const eventPath = result?.path || (eventJobId ? pendingJobsRef.current.get(eventJobId) : undefined)

    if (eventJobId && processedJobsRef.current.has(eventJobId)) {
      return
    }

    if (eventJobId) {
      processedJobsRef.current.add(eventJobId)
      pendingJobsRef.current.delete(eventJobId)
    }

    const deletedPlaylist = eventPath ? pendingDeletesRef.current.get(eventPath) : null

    if (result?.success) {
      if (eventPath) {
        pendingDeletesRef.current.delete(eventPath)
        removeDeletingPlaylistPath(eventPath)
      }
      setPlaylistsLoaded(false)
      setPlaylistsLastLoadedAt(Date.now())
      showPlaylistDeleteToast(
        'success',
        deletedPlaylist?.nombre ? `Playlist deleted: ${deletedPlaylist.nombre}` : 'Playlist deleted.'
      )
      return
    }

    if (eventPath) {
      restoreOptimisticPlaylistDelete(eventPath)
    } else {
      void refreshPlaylists().catch((error) => {
        console.error('Error refreshing playlists after deletion:', error)
      })
    }

    showPlaylistDeleteToast('error', result?.error || translate('playlists.saveFailed'))
  }

  const removeSongFromList = async (playlistPath: string, index: number) => {
    await removeTrack(playlistPath, index)
    await refreshPlaylists()
  }

  const addSongToList = async (playlistPath: string, newTrack: unknown) => {
    await addSong(playlistPath, newTrack)
    await refreshPlaylists()
  }

  const appendTracksToPlaylist = async (playlistPath: string, tracks: PlaylistTrackInput[] = []) => {
    const filePaths = extractTrackPaths(tracks)
    const result = await invoke<AppendTracksToPlaylistResult>('append-tracks-to-playlist', {
      playlistPath,
      filePaths
    })

    if (isSuccessfulResponse(result)) {
      await refreshPlaylists()
    }

    return result
  }

  return {
    addPlaylisthistory,
    updatePlaylistMetadata,
    deletePlaylist,
    isPlaylistDeleting,
    handlePlaylistDeleteCompleted,
    removeSongFromList,
    addSongToList,
    appendTracksToPlaylist
  }
}
