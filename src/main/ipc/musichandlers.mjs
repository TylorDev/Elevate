import { ipcMain } from 'electron'
import { getFileInfoWithSongData } from './utils/utils.mjs'

export function setupMusicHandlers() {
  ipcMain.handle('getbpm', async (event, filePath, common) => {
    try {
      const fileInfo = await getFileInfoWithSongData(filePath, common)
      return fileInfo
    } catch (error) {
      console.error(`Error in getbpm handler:`, error)
      throw error
    }
  })
}
