import type { Rectangle } from 'electron'
import type {
  GridPresetCalculationResult,
  GridPresetCell,
  NormalizedGridPreset
} from '../Types/main.ts'
import type { RequiredErrorResponse } from '../Types/shared.ts'

export const GRID_PRESET_CELLS: Record<GridPresetCell, { row: number; col: number }> = {
  'top-left': { row: 0, col: 0 },
  'top-right': { row: 0, col: 1 },
  'bottom-left': { row: 1, col: 0 },
  'bottom-right': { row: 1, col: 1 }
}

function gridError(error: string): RequiredErrorResponse {
  return { success: false, error }
}

export function normalizeGridPresetCells(
  cells: unknown
): NormalizedGridPreset | RequiredErrorResponse {
  const normalizedCells = Array.isArray(cells)
    ? ([
        ...new Set(
          cells.filter(
            (cell): cell is GridPresetCell =>
              typeof cell === 'string' && Object.hasOwn(GRID_PRESET_CELLS, cell)
          )
        )
      ] as GridPresetCell[])
    : []

  if (normalizedCells.length === 0) {
    return gridError('At least one valid grid cell is required.')
  }

  const positions = normalizedCells.map((cell) => GRID_PRESET_CELLS[cell])
  const rows = positions.map(({ row }) => row)
  const cols = positions.map(({ col }) => col)
  const minRow = Math.min(...rows)
  const maxRow = Math.max(...rows)
  const minCol = Math.min(...cols)
  const maxCol = Math.max(...cols)
  const expectedCount = (maxRow - minRow + 1) * (maxCol - minCol + 1)

  if (expectedCount !== normalizedCells.length) {
    return gridError('Grid preset selection must form a continuous rectangle.')
  }

  return { success: true, normalizedCells, minRow, maxRow, minCol, maxCol }
}

export function calculateGridPresetBounds(
  cells: unknown,
  workArea: Rectangle | null | undefined,
  displayId: number
): GridPresetCalculationResult {
  const selection = normalizeGridPresetCells(cells)
  if (selection.success === false) return selection
  if (!workArea) return gridError('Unable to resolve display work area.')

  const halfWidth = Math.floor(workArea.width / 2)
  const halfHeight = Math.floor(workArea.height / 2)
  const colWidths = [halfWidth, workArea.width - halfWidth]
  const rowHeights = [halfHeight, workArea.height - halfHeight]
  const colStarts = [workArea.x, workArea.x + colWidths[0]]
  const rowStarts = [workArea.y, workArea.y + rowHeights[0]]
  const width = colWidths
    .slice(selection.minCol, selection.maxCol + 1)
    .reduce((total, value) => total + value, 0)
  const height = rowHeights
    .slice(selection.minRow, selection.maxRow + 1)
    .reduce((total, value) => total + value, 0)

  return {
    success: true,
    bounds: {
      x: colStarts[selection.minCol],
      y: rowStarts[selection.minRow],
      width,
      height
    },
    displayId,
    workArea
  }
}
