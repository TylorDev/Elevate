import type { Dispatch, SetStateAction } from 'react'

import type { AudioFileInfo, AudioFilesPage } from '../../../../main/Types/filehandlers.ts'
import type { EnrichedPlaylist, PlaylistListPayload } from '../../../../main/Types/playlistHandlers.ts'
import type { ErrorResponse } from '../../../../main/Types/shared.ts'
import type {
  MutableRef,
  PlaylistGetter,
  PlaylistIpcInvoker,
  PlaylistLoadOptions,
  PlaylistPaginationOptions,
  PlaylistQueryDependencies,
  RendererPlaylistListResult
} from '../../Types/PlaylistContextTypes/index.ts'

export type PlaylistQueries = {
  getSavedLists: (options?: PlaylistLoadOptions) => Promise<EnrichedPlaylist[] | null>
  getAllSongs: (page?: number, options?: PlaylistPaginationOptions) => Promise<AudioFilesPage | null>
  getUniqueList: (
    setState: (value: RendererPlaylistListResult) => void,
    filePath?: string | null
  ) => Promise<RendererPlaylistListResult | null>
  getRandomList: () => Promise<EnrichedPlaylist | null>
  getNews: () => Promise<AudioFileInfo[]>
}

type QueryState = {
  playlistsRef: MutableRef<EnrichedPlaylist[]>
  playlistsLoadedRef: MutableRef<boolean>
  playlistsRequestRef: MutableRef<Promise<EnrichedPlaylist[]> | null>
  allSongsRequestRef: MutableRef<Promise<AudioFilesPage> | null>
  allSongsLoadedPagesRef: MutableRef<Set<number>>
}

type QuerySetters = Pick<
  PlaylistQueryDependencies,
  | 'setPlaylists'
  | 'setPlaylistsLoading'
  | 'setPlaylistsLoaded'
  | 'setPlaylistsLastLoadedAt'
  | 'setAllSongs'
  | 'setAllSongsLoading'
  | 'setAllSongsHasMore'
  | 'setAllSongsPage'
  | 'setRandomPlaylist'
  | 'setNews'
>

type QueryDependencies = QueryState &
  QuerySetters & {
    invoke: PlaylistIpcInvoker
    get: PlaylistGetter
    getNewsMessage: string
    latestInvoke: PlaylistQueryDependencies['latestInvoke']
  }

export const createPlaylistQueries = (dependencies: QueryDependencies): PlaylistQueries => {
  const {
    invoke,
    get,
    latestInvoke,
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
    getNewsMessage
  } = dependencies

  const getSavedLists = async ({ force = false }: PlaylistLoadOptions = {}) => {
    if (!force && playlistsLoadedRef.current) {
      return playlistsRef.current
    }

    if (playlistsRequestRef.current && !force) {
      return playlistsRequestRef.current
    }

    setPlaylistsLoading(true)

    const request = latestInvoke<EnrichedPlaylist[]>('get-playlists', force ? Date.now() : null)
      .then(({ isLatest, result }) => {
        if (isLatest && result) {
          playlistsRef.current = result
          playlistsLoadedRef.current = true
          setPlaylists(result)
          setPlaylistsLoaded(true)
          setPlaylistsLastLoadedAt(Date.now())
        }

        return result
      })
      .catch((error) => {
        console.error('Error loading playlists:', error)
        throw error
      })
      .finally(() => {
        if (playlistsRequestRef.current === request) {
          playlistsRequestRef.current = null
          setPlaylistsLoading(false)
        }
      })

    playlistsRequestRef.current = request
    return request
  }

  const getAllSongs = async (page = 1, { pageSize = 100, reset = false }: PlaylistPaginationOptions = {}) => {
    const nextPage = Math.max(Number(page) || 1, 1)

    if (allSongsRequestRef.current) {
      return allSongsRequestRef.current
    }

    if (!reset && allSongsLoadedPagesRef.current.has(nextPage)) {
      return null
    }

    setAllSongsLoading(true)

    if (reset) {
      setAllSongs([])
      setAllSongsHasMore(true)
      setAllSongsPage(0)
      allSongsLoadedPagesRef.current.clear()
    }

    const request = invoke<AudioFilesPage>('get-all-audio-files-page', {
      page: nextPage,
      pageSize
    })
      .then((result) => {
        const newSongs = result?.items || []

        setAllSongs((previousSongs) => {
          if (reset) {
            const seen = new Set<string>()
            return newSongs.filter((song) => {
              if (seen.has(song.filePath)) return false
              seen.add(song.filePath)
              return true
            })
          }

          const existingFilePaths = new Set(previousSongs.map((song) => song.filePath))
          const uniqueNewSongs = newSongs.filter((song) => {
            if (existingFilePaths.has(song.filePath)) return false
            existingFilePaths.add(song.filePath)
            return true
          })

          return [...previousSongs, ...uniqueNewSongs]
        })

        allSongsLoadedPagesRef.current.add(nextPage)
        setAllSongsHasMore(Boolean(result?.hasMore))
        setAllSongsPage(result?.page || nextPage)

        return result
      })
      .catch((error) => {
        console.error('Error loading all songs:', error)
        throw error
      })
      .finally(() => {
        if (allSongsRequestRef.current === request) {
          allSongsRequestRef.current = null
          setAllSongsLoading(false)
        }
      })

    allSongsRequestRef.current = request
    return request
  }

  const getUniqueList = async (
    setState: (value: RendererPlaylistListResult) => void,
    filePath?: string | null
  ) =>
    get<PlaylistListPayload | ErrorResponse>(
      'get-list',
      setState as Dispatch<SetStateAction<PlaylistListPayload | ErrorResponse>>,
      filePath,
      'se obtuvo los datos de la lista!'
    ) as Promise<RendererPlaylistListResult | null>

  const getRandomList = () =>
    get<EnrichedPlaylist | null>('get-random-playlist', setRandomPlaylist, null, 'random list cargada')

  const getNews = () => get<AudioFileInfo[]>('get-new-audio-files', setNews, null, getNewsMessage)

  return {
    getSavedLists,
    getAllSongs,
    getUniqueList,
    getRandomList,
    getNews
  }
}
