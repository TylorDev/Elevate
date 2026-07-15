import type { AudioFileInfo } from '../../../../main/Types/filehandlers.ts'
import type {
  DirectorySearchItem
} from '../../../../main/Types/filehandlers.ts'
import type { PlaylistSearchItem } from '../../../../main/Types/playlistHandlers.ts'
import type { SearchSongItem } from '../../../../main/Types/likeHandlers.ts'
import type {
  GlobalSearchActionDependencies,
  GlobalSearchActions,
  GlobalSearchSettingItem
} from '../../Types/GlobalSearchContextTypes/index.ts'
import { getSearchItemPath, hasSearchFilePath } from './searchUtils.ts'

function toQueueTrack(song: SearchSongItem): AudioFileInfo | null {
  if (!hasSearchFilePath(song)) {
    return null
  }

  return song as unknown as AudioFileInfo
}

export function createGlobalSearchActions({
  closeSearch,
  navigate,
  appendToQueueAndPlay,
  handleQueueAndPlay,
  openDirectoryQueue
}: GlobalSearchActionDependencies): GlobalSearchActions {
  const handleSongSelect = (song: SearchSongItem): void => {
    const queueTrack = toQueueTrack(song)

    if (!queueTrack) {
      return
    }

    appendToQueueAndPlay(queueTrack)
    closeSearch()
  }

  const handlePlaylistSelect = async (item: PlaylistSearchItem): Promise<void> => {
    await handleQueueAndPlay(undefined, undefined, getSearchItemPath(item))
    closeSearch()
  }

  const handleDirectorySelect = async (item: DirectorySearchItem): Promise<void> => {
    await openDirectoryQueue(getSearchItemPath(item))
    closeSearch()
  }

  const handleSettingSelect = (item: GlobalSearchSettingItem): void => {
    navigate(item.actionPayload?.route || '/settings')
    closeSearch()
  }

  return {
    handleSongSelect,
    handlePlaylistSelect,
    handleDirectorySelect,
    handleSettingSelect
  }
}
