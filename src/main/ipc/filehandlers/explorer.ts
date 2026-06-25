// @ts-nocheck
import { shell } from 'electron'

export function revealPathInExplorer(targetPath) {
  try {
    if (!targetPath || typeof targetPath !== 'string') {
      return { success: false, error: 'Path is required' }
    }

    shell.showItemInFolder(targetPath)
    return { success: true }
  } catch (error) {
    console.error('Error revealing path in explorer:', error)
    return { success: false, error: error.message || 'Could not open the explorer.' }
  }
}

export async function openDirectoryInExplorer(targetPath) {
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
    return { success: false, error: error.message || 'Could not open the folder.' }
  }
}
