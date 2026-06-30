import { ipcMain } from 'electron'
import { getDirectorySnapshot } from './directories.ts'
import { resolveExistingDirectory } from './paths.ts'
import type {
  PlaylistSaveExplorerArgs,
  PlaylistSaveExplorerChannel,
  PlaylistSaveExplorerInvokeHandler
} from '../../Types/playlistSaveExplorerHandlers.ts'

export { getDirectorySnapshot } from './directories.ts'
export { getFallbackDirectory, resolveExistingDirectory, resolveStrictDirectory } from './paths.ts'
export type * from '../../Types/playlistSaveExplorerHandlers.ts'

function handlePlaylistSaveExplorer<C extends PlaylistSaveExplorerChannel>(
  channel: C,
  handler: PlaylistSaveExplorerInvokeHandler<C>
): void {
  ipcMain.handle(channel, (event, ...args) =>
    handler(event, ...(args as PlaylistSaveExplorerArgs<C>))
  )
}

export function setupPlaylistSaveExplorerHandlers(): void {
  handlePlaylistSaveExplorer('get-playlist-save-directory', async (_event, sourcePath) => ({
    path: await resolveExistingDirectory(sourcePath)
  }))

  handlePlaylistSaveExplorer('list-playlist-save-directory', (_event, directoryPath) =>
    getDirectorySnapshot(directoryPath)
  )
}
