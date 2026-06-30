import { describe, expect, it } from 'vitest'
import {
  calculateGridPresetBounds,
  normalizeGridPresetCells
} from '../../src/main/utils/windowGrid.ts'

describe('main window grid utilities', () => {
  it('rejects empty and disconnected selections', () => {
    expect(normalizeGridPresetCells(null)).toEqual({
      success: false,
      error: 'At least one valid grid cell is required.'
    })
    expect(normalizeGridPresetCells(['top-left', 'bottom-right'])).toEqual({
      success: false,
      error: 'Grid preset selection must form a continuous rectangle.'
    })
  })

  it('deduplicates cells and ignores invalid values', () => {
    expect(normalizeGridPresetCells(['top-left', 'top-left', 'invalid'])).toMatchObject({
      success: true,
      normalizedCells: ['top-left'],
      minRow: 0,
      maxRow: 0,
      minCol: 0,
      maxCol: 0
    })
  })

  it('preserves every pixel on displays with odd dimensions', () => {
    const workArea = { x: 10, y: 20, width: 1001, height: 801 }

    expect(calculateGridPresetBounds(['top-right'], workArea, 7)).toEqual({
      success: true,
      bounds: { x: 510, y: 20, width: 501, height: 400 },
      displayId: 7,
      workArea
    })
    expect(
      calculateGridPresetBounds(
        ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
        workArea,
        7
      )
    ).toMatchObject({ bounds: workArea })
  })
})
