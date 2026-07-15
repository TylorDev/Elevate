import { describe, expect, it } from 'vitest'

import {
  createCategoryState,
  filterSettingItems,
  hasSearchFilePath,
  isSearchPageResponse,
  normalizeSearchQuery
} from '../../../src/renderer/src/Contexts/GlobalSearchContext/searchUtils.ts'
import { createSettingItems } from '../../../src/renderer/src/Contexts/GlobalSearchContext/searchConfig.ts'

describe('GlobalSearchContext search utilities', () => {
  it('normalizes whitespace and invalid queries', () => {
    expect(normalizeSearchQuery('  trip   hop  ')).toBe('trip hop')
    expect(normalizeSearchQuery(null)).toBe('')
  })

  it('creates empty category state', () => {
    expect(createCategoryState()).toEqual({
      items: [],
      loading: false,
      hasMore: false,
      page: 0,
      total: 0
    })
  })

  it('filters configuration items by title and subtitle', () => {
    const settings = createSettingItems((key) => key === 'search.primaryColor' ? 'Primary color' : key)

    expect(filterSettingItems('primary', settings)).toHaveLength(1)
    expect(filterSettingItems('', settings)).toEqual(settings)
  })

  it('validates paginated responses and selectable songs', () => {
    expect(isSearchPageResponse({
      items: [{ filePath: 'song.mp3' }],
      page: 1,
      pageSize: 50,
      total: 1,
      hasMore: false
    })).toBe(true)
    expect(isSearchPageResponse({ items: [] })).toBe(false)
    expect(hasSearchFilePath({ filePath: 'song.mp3' })).toBe(true)
    expect(hasSearchFilePath({ filePath: '' })).toBe(false)
  })
})
