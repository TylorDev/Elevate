import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { toast } from 'react-toastify'

import type { AudioFileInfo, AudioFilesPage } from '../../../../main/Types/filehandlers.ts'
import type { EnrichedPlaylist } from '../../../../main/Types/playlistHandlers.ts'
import type {
  PlaylistContextProps,
  PlaylistContextValue,
  PlaylistIpcInvoker,
  PlaylistGetter,
  PlaylistQueryDependencies
} from '../../Types/PlaylistContextTypes/index.ts'
import { useSongCover } from '../ImagesContext'
import { useI18n } from '../I18nContext'
import { useMini } from '../MiniContext'
import { useQueue } from '../QueueContext'
import { createLatestOnlyInvoker, dedupedInvoke, ElectronGetter } from '../utils'
import { createPlaylistFiles } from './playlistFiles.ts'
import { createPlaylistMutations } from './playlistMutations.ts'
import { registerPlaylistNotifications } from './playlistNotifications.ts'
import { createPlaylistQueries } from './playlistQueries.ts'
import { createToastNotifier } from './playlistUtils.ts'

export const PlaylistContext = createContext<PlaylistContextValue | null>(null)

export const getPlaylistContextValue = (context: PlaylistContextValue | null): PlaylistContextValue => {
  if (!context) {
    throw new Error('usePlaylists must be used within a PlaylistsProvider')
  }

  return context
}

export const usePlaylists = (): PlaylistContextValue => {
  return getPlaylistContextValue(useContext(PlaylistContext))
}

export const PlaylistsProvider = ({ children }: PlaylistContextProps) => {
  const { t } = useI18n()
  const { currentFile, removeTrack, addSong } = useQueue()
  const currentCover = useSongCover(currentFile?.filePath, 'full')
  const { getDirectories, deleteDirectory } = useMini() as {
    getDirectories: (options?: { force?: boolean }) => Promise<unknown>
    deleteDirectory: (path: string) => Promise<unknown>
  }

  const [allSongs, setAllSongs] = useState<AudioFileInfo[]>([])
  const [allSongsLoading, setAllSongsLoading] = useState(false)
  const [allSongsHasMore, setAllSongsHasMore] = useState(true)
  const [allSongsPage, setAllSongsPage] = useState(0)
  const [randomPlaylist, setRandomPlaylist] = useState<EnrichedPlaylist | null>(null)
  const [playlists, setPlaylists] = useState<EnrichedPlaylist[]>([])
  const [playlistsLoading, setPlaylistsLoading] = useState(false)
  const [playlistsLoaded, setPlaylistsLoaded] = useState(false)
  const [playlistsLastLoadedAt, setPlaylistsLastLoadedAt] = useState<number | null>(null)
  const [deletingPlaylistPaths, setDeletingPlaylistPaths] = useState<string[]>([])
  const [news, setNews] = useState<AudioFileInfo[]>([])

  const playlistsRef = useRef<EnrichedPlaylist[]>([])
  const playlistsLoadedRef = useRef(false)
  const playlistsRequestRef = useRef<Promise<EnrichedPlaylist[]> | null>(null)
  const playlistsInvokerRef = useRef(createLatestOnlyInvoker())
  const pendingPlaylistDeletesRef = useRef(new Map<string, EnrichedPlaylist | null>())
  const pendingPlaylistDeleteJobsRef = useRef(new Map<string, string>())
  const processedPlaylistDeleteJobsRef = useRef(new Set<string>())
  const allSongsRequestRef = useRef<Promise<AudioFilesPage> | null>(null)
  const allSongsLoadedPagesRef = useRef(new Set<number>())

  playlistsRef.current = playlists
  playlistsLoadedRef.current = playlistsLoaded

  const invoke = useCallback(
    ((channel: string, ...args: unknown[]) =>
      dedupedInvoke(channel, ...args) as Promise<unknown>) as PlaylistIpcInvoker,
    []
  )

  const latestInvoke = useCallback(
    ((channel: string, ...args: unknown[]) =>
      playlistsInvokerRef.current(channel, ...args) as Promise<{
        isLatest: boolean
        result: unknown
      }>) as PlaylistQueryDependencies['latestInvoke'],
    []
  )

  const getter = useCallback<PlaylistGetter>(
    (channel, setState, value, message) => ElectronGetter(channel, setState, value, message),
    []
  )

  const notify = useMemo(
    () =>
      createToastNotifier({
        error: (message, options) => toast.error(message, options),
        success: (message, options) => toast.success(message, options),
        isActive: (toastId) => toast.isActive(toastId),
        update: (toastId, options) => toast.update(toastId, options)
      }),
    []
  )

  const queries = useMemo(
    () =>
      createPlaylistQueries({
        invoke,
        get: getter,
        playlistsRef,
        playlistsLoadedRef,
        playlistsRequestRef,
        setPlaylists,
        setPlaylistsLoading,
        setPlaylistsLoaded,
        setPlaylistsLastLoadedAt,
        allSongsRequestRef,
        allSongsLoadedPagesRef,
        setAllSongs,
        setAllSongsLoading,
        setAllSongsHasMore,
        setAllSongsPage,
        setRandomPlaylist,
        setNews,
        getNewsMessage: t('toasts.recentsLoaded'),
        latestInvoke
      }),
    [getter, invoke, latestInvoke, t]
  )

  const refreshPlaylists = useCallback(() => queries.getSavedLists({ force: true }), [queries])

  const mutations = useMemo(
    () =>
      createPlaylistMutations({
        invoke,
        playlistsRef,
        pendingDeletesRef: pendingPlaylistDeletesRef,
        pendingJobsRef: pendingPlaylistDeleteJobsRef,
        processedJobsRef: processedPlaylistDeleteJobsRef,
        setPlaylists,
        setPlaylistsLoaded,
        setPlaylistsLastLoadedAt,
        setDeletingPlaylistPaths,
        refreshPlaylists,
        notify,
        translate: t,
        removeTrack,
        addSong
      }),
    [addSong, invoke, notify, refreshPlaylists, removeTrack, t]
  )

  const files = useMemo(
    () =>
      createPlaylistFiles({
        invoke,
        refreshPlaylists,
        notify,
        translate: t
      }),
    [invoke, notify, refreshPlaylists, t]
  )

  const deleteDirectoryList = useCallback(
    async (path: string) => {
      await deleteDirectory(path)
      setAllSongs([])
      allSongsLoadedPagesRef.current.clear()
      await queries.getAllSongs(1, { reset: true })
    },
    [deleteDirectory, queries]
  )

  useEffect(
    () =>
      registerPlaylistNotifications({
        ipc: window.electron.ipcRenderer,
        getAllSongs: queries.getAllSongs,
        getDirectories,
        handlePlaylistDeleteCompleted: mutations.handlePlaylistDeleteCompleted,
        notify,
        translate: t
      }),
    [getDirectories, mutations.handlePlaylistDeleteCompleted, notify, queries.getAllSongs, t]
  )

  const contextValue = useMemo<PlaylistContextValue>(
    () => ({
      allSongs,
      allSongsLoading,
      allSongsHasMore,
      allSongsPage,
      playlists,
      deletingPlaylistPaths,
      playlistsLoading,
      playlistsLoaded,
      playlistsLastLoadedAt,
      getSavedLists: queries.getSavedLists,
      addPlaylisthistory: mutations.addPlaylisthistory,
      deletePlaylist: mutations.deletePlaylist,
      isPlaylistDeleting: mutations.isPlaylistDeleting,
      getUniqueList: queries.getUniqueList,
      getAllSongs: queries.getAllSongs,
      openM3U: files.openM3U,
      randomPlaylist,
      updatePlaylistMetadata: mutations.updatePlaylistMetadata,
      news,
      getNews: queries.getNews,
      currentCover,
      getRandomList: queries.getRandomList,
      removeSongFromList: mutations.removeSongFromList,
      addSongToList: mutations.addSongToList,
      appendTracksToPlaylist: mutations.appendTracksToPlaylist,
      deleteDirectoryList,
      exportPlaylistTracks: files.exportPlaylistTracks,
      exportPlaylistTracksToDirectory: files.exportPlaylistTracksToDirectory,
      resolvePlaylistSaveDirectory: files.resolvePlaylistSaveDirectory,
      listPlaylistSaveDirectory: files.listPlaylistSaveDirectory,
      savePlaylistFromTracks: files.savePlaylistFromTracks
    }),
    [
      allSongs,
      allSongsHasMore,
      allSongsLoading,
      allSongsPage,
      currentCover,
      deleteDirectoryList,
      deletingPlaylistPaths,
      files,
      mutations,
      news,
      playlists,
      playlistsLastLoadedAt,
      playlistsLoaded,
      playlistsLoading,
      queries,
      randomPlaylist
    ]
  )

  return <PlaylistContext.Provider value={contextValue}>{children}</PlaylistContext.Provider>
}
