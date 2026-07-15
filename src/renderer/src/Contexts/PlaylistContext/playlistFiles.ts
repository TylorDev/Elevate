import type {
  ExportPlaylistResult,
  LoadListResult,
  PersistPlaylistRecordResult
} from '../../../../main/Types/playlistHandlers.ts'
import type {
  PlaylistExportDirectoryOptions,
  PlaylistExportOptions,
  PlaylistFileDependencies,
  PlaylistOpenOptions,
  PlaylistSaveOptions,
  PlaylistTrackInput
} from '../../Types/PlaylistContextTypes/index.ts'
import { extractTrackPaths, getErrorMessage, isCanceledResponse, isSuccessfulResponse } from './playlistUtils.ts'

export type PlaylistFileResult =
  | PersistPlaylistRecordResult
  | ExportPlaylistResult
  | { success: false; error: string }

export type PlaylistFiles = {
  openM3U: (options?: PlaylistOpenOptions) => Promise<LoadListResult | { success: false; error: string } | null | undefined>
  resolvePlaylistSaveDirectory: (sourcePath?: string) => Promise<string | null>
  listPlaylistSaveDirectory: (directoryPath: string) => Promise<unknown>
  savePlaylistFromTracks: (
    tracks?: PlaylistTrackInput[],
    options?: PlaylistSaveOptions
  ) => Promise<PlaylistFileResult>
  exportPlaylistTracks: (
    tracks?: PlaylistTrackInput[],
    options?: PlaylistExportOptions
  ) => Promise<PlaylistFileResult>
  exportPlaylistTracksToDirectory: (
    tracks?: PlaylistTrackInput[],
    options?: PlaylistExportDirectoryOptions
  ) => Promise<PlaylistFileResult>
}

export const createPlaylistFiles = (dependencies: PlaylistFileDependencies): PlaylistFiles => {
  const { invoke, refreshPlaylists, notify, translate } = dependencies

  const openM3U = async (options: PlaylistOpenOptions = {}) => {
    const filePath = typeof options === 'string' ? options : options?.filePath
    let result: LoadListResult | null | undefined

    try {
      result = filePath
        ? await invoke<LoadListResult>('load-list', filePath)
        : await invoke<LoadListResult>('load-list')
    } catch (error) {
      const errorMessage = getErrorMessage(error, 'No se pudo importar la playlist.')
      notify('error', errorMessage)
      return { success: false as const, error: errorMessage }
    }

    if (!result || isCanceledResponse(result)) {
      return result
    }

    if (!isSuccessfulResponse(result)) {
      notify('error', result.error || translate('playlists.saveFailed'))
      return result
    }

    refreshPlaylists()
    notify('success', translate('playlists.imported', { name: result.playlistName }))
    return result
  }

  const resolvePlaylistSaveDirectory = async (sourcePath = '') => {
    const result = await invoke<{ path?: string | null }>('get-playlist-save-directory', sourcePath)
    return result?.path || null
  }

  const listPlaylistSaveDirectory = (directoryPath: string) =>
    invoke('list-playlist-save-directory', directoryPath)

  const savePlaylistFromTracks = async (
    tracks: PlaylistTrackInput[] = [],
    { nombre = '', targetDirectory = '', replacePath = null }: PlaylistSaveOptions = {}
  ) => {
    const filePaths = extractTrackPaths(tracks, { trim: true, unique: true })

    if (filePaths.length === 0) {
      const errorMessage = translate('playlists.playlistRequiredTracks')
      notify('error', errorMessage)
      return { success: false as const, error: errorMessage }
    }

    let result: PersistPlaylistRecordResult | ExportPlaylistResult

    try {
      result = await invoke<PersistPlaylistRecordResult | ExportPlaylistResult>('save-m3u', {
        filePaths,
        targetDirectory,
        targetPath: replacePath,
        nombre
      })
    } catch (error) {
      const errorMessage = getErrorMessage(error, translate('playlists.saveFailed'))
      notify('error', errorMessage)
      return { success: false as const, error: errorMessage }
    }

    if (!isSuccessfulResponse(result)) {
      notify('error', result?.error || translate('playlists.saveFailed'))
      return result
    }

    await Promise.resolve(dependencies.refreshPlaylists())
    notify('success', translate('playlists.saved', { name: result.playlistName }))
    return result
  }

  const exportPlaylistTracks = async (
    tracks: PlaylistTrackInput[] = [],
    { suggestedName = '' }: PlaylistExportOptions = {}
  ) => {
    const filePaths = extractTrackPaths(tracks)

    if (filePaths.length === 0) {
      notify('error', translate('playlists.exportEmpty'))
      return { success: false as const, error: 'No tracks to export' }
    }

    let result: PersistPlaylistRecordResult | ExportPlaylistResult

    try {
      result = await invoke<PersistPlaylistRecordResult | ExportPlaylistResult>('save-m3u', {
        filePaths,
        nombre: suggestedName
      })
    } catch (error) {
      const errorMessage = getErrorMessage(error, translate('playlists.saveFailed'))
      notify('error', errorMessage)
      return { success: false as const, error: errorMessage }
    }

    if (!isSuccessfulResponse(result)) {
      if (result?.error !== 'Save canceled') {
        notify('error', result?.error || translate('playlists.saveFailed'))
      }
      return result
    }

    notify('success', translate('playlists.exported', { name: result.playlistName }))
    return result
  }

  const exportPlaylistTracksToDirectory = async (
    tracks: PlaylistTrackInput[] = [],
    { targetDirectory = '', nombre = '', replacePath = null }: PlaylistExportDirectoryOptions = {}
  ) => {
    const filePaths = extractTrackPaths(tracks)

    if (filePaths.length === 0) {
      notify('error', translate('playlists.exportEmpty'))
      return { success: false as const, error: 'No tracks to export' }
    }

    let result: PersistPlaylistRecordResult | ExportPlaylistResult

    try {
      result = await invoke<PersistPlaylistRecordResult | ExportPlaylistResult>('save-m3u', {
        filePaths,
        targetDirectory,
        targetPath: replacePath,
        nombre,
        persist: false
      })
    } catch (error) {
      const errorMessage = getErrorMessage(error, translate('playlists.saveFailed'))
      notify('error', errorMessage)
      return { success: false as const, error: errorMessage }
    }

    if (!isSuccessfulResponse(result)) {
      notify('error', result?.error || translate('playlists.saveFailed'))
      return result
    }

    notify('success', translate('playlists.exported', { name: result.playlistName }))
    return result
  }

  return {
    openM3U,
    resolvePlaylistSaveDirectory,
    listPlaylistSaveDirectory,
    savePlaylistFromTracks,
    exportPlaylistTracks,
    exportPlaylistTracksToDirectory
  }
}
