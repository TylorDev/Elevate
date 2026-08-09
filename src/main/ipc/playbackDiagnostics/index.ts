import { BrowserWindow, ipcMain } from 'electron'
import type { PlaybackDiagnosticAppendPayload } from '../../Types/playbackDiagnostics.ts'
import { exportPlaybackDiagnostics } from '../../diagnostics/playbackExport.ts'
import { writePlaybackDiagnostic } from '../../diagnostics/playbackDiagnostics.ts'

export function setupPlaybackDiagnosticsHandlers(): void {
  ipcMain.handle(
    'playback-diagnostics:append',
    (event, payload: PlaybackDiagnosticAppendPayload) => {
      const success = writePlaybackDiagnostic(payload, 'renderer', event.sender.id)
      return success ? { success: true } : { success: false, error: 'Invalid diagnostic event' }
    }
  )

  ipcMain.handle('playback-diagnostics:export', (event) => {
    return exportPlaybackDiagnostics(BrowserWindow.fromWebContents(event.sender))
  })
}
