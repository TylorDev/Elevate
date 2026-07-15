import type {
  GlobalSearchFilterId,
  GlobalSearchSettingItem,
  GlobalSearchTranslator
} from '../../Types/GlobalSearchContextTypes/index.ts'

export const SONGS_PAGE_SIZE = 50
export const PLAYLISTS_PAGE_SIZE = 30
export const DIRECTORIES_PAGE_SIZE = 30

export const GLOBAL_SEARCH_FILTERS: Array<{
  id: GlobalSearchFilterId
  labelKey: string
}> = [
  { id: 'directory', labelKey: 'search.directory' },
  { id: 'playlist', labelKey: 'search.playlist' },
  { id: 'artist', labelKey: 'search.artist' },
  { id: 'name', labelKey: 'search.name' },
  { id: 'configuration', labelKey: 'search.configuration' }
]

export function createSettingItems(translate: GlobalSearchTranslator): GlobalSearchSettingItem[] {
  return [
    {
      type: 'setting',
      id: 'change-background',
      title: translate('search.changeBackground'),
      subtitle: translate('search.openVisualSettings'),
      meta: '/settings',
      actionPayload: { route: '/settings' }
    },
    {
      type: 'setting',
      id: 'primary-color',
      title: translate('search.primaryColor'),
      subtitle: translate('search.openColorSettings'),
      meta: '/settings',
      actionPayload: { route: '/settings' }
    },
    {
      type: 'setting',
      id: 'add-directory',
      title: translate('search.addDirectory'),
      subtitle: translate('search.openLibrarySettings'),
      meta: '/settings',
      actionPayload: { route: '/settings' }
    }
  ]
}
