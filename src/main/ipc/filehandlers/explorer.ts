import { shell } from 'electron'
import { getErrorMessage } from './shared.ts'
import type { ExplorerActionResult } from '../../Types/filehandlers.ts'

export function revealPathInExplorer(targetPath: string | null | undefined): ExplorerActionResult {
  try {
    if (!targetPath || typeof targetPath !== 'string') {
      return { success: false, error: 'Path is required' }
    }

    shell.showItemInFolder(targetPath)
    return { success: true }
  } catch (error) {
    console.error('Error revealing path in explorer:', error)
    return { success: false, error: getErrorMessage(error, 'Could not open the explorer.') }
  }
}

export async function openDirectoryInExplorer(
  targetPath: string | null | undefined
): Promise<ExplorerActionResult> {
  try {
    if (!targetPath || typeof targetPath !== 'string') {
      return { success: false, error: 'Path is required' }
    }

    const openError = await shell.openPath(targetPath)

    if (openError) {
      return { success: false, error: openError }
    }

    return { success: true }
  } catch (error) {
    console.error('Error opening directory in explorer:', error)
    return { success: false, error: getErrorMessage(error, 'Could not open the folder.') }
  }
}
