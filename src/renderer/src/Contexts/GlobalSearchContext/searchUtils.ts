import type { PageResult } from '../../../../main/Types/shared.ts'
import type {
  GlobalSearchCategoryState,
  GlobalSearchSettingItem
} from '../../Types/GlobalSearchContextTypes/index.ts'

export function normalizeSearchQuery(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().replace(/\s+/g, ' ')
}

export function createCategoryState<T>(): GlobalSearchCategoryState<T> {
  return {
    items: [],
    loading: false,
    hasMore: false,
    page: 0,
    total: 0
  }
}

export function filterSettingItems(
  query: string,
  settingItems: GlobalSearchSettingItem[]
): GlobalSearchSettingItem[] {
  if (!query) {
    return settingItems
  }

  const loweredQuery = query.toLocaleLowerCase()
  return settingItems.filter((item) =>
    `${item.title} ${item.subtitle}`.toLocaleLowerCase().includes(loweredQuery)
  )
}

export function isSearchPageResponse<T>(value: unknown): value is PageResult<T> {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    Array.isArray(record.items) &&
    typeof record.page === 'number' &&
    typeof record.pageSize === 'number' &&
    typeof record.total === 'number' &&
    typeof record.hasMore === 'boolean'
  )
}

export function hasSearchFilePath(value: unknown): value is { filePath: string } {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>
  return typeof record.filePath === 'string' && record.filePath.length > 0
}

export function getSearchItemPath(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return ''
  }

  const record = value as Record<string, unknown>
  const actionPayload = record.actionPayload

  if (typeof record.path === 'string' && record.path.length > 0) {
    return record.path
  }

  if (actionPayload && typeof actionPayload === 'object') {
    const payload = actionPayload as Record<string, unknown>
    return typeof payload.path === 'string' ? payload.path : ''
  }

  return ''
}
