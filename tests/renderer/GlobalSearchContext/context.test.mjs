import { describe, expect, it } from 'vitest'

import {
  GlobalSearchProvider,
  useGlobalSearch
} from '../../../src/renderer/src/Contexts/GlobalSearchContext/index.ts'
import { getGlobalSearchContextValue } from '../../../src/renderer/src/Contexts/GlobalSearchContext/GlobalSearchProvider.tsx'

describe('GlobalSearchContext public contract', () => {
  it('exports the provider and hook through index.ts', () => {
    expect(GlobalSearchProvider).toBeTypeOf('function')
    expect(useGlobalSearch).toBeTypeOf('function')
  })

  it('throws when the hook is used outside its provider', () => {
    expect(() => getGlobalSearchContextValue(null)).toThrow(
      'useGlobalSearch must be used within a GlobalSearchProvider'
    )
  })
})
