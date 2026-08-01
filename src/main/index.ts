import { app, dialog } from 'electron'
import { createStartupFailureDialog } from './main/startupFailure.ts'

async function launchApplication(): Promise<void> {
  try {
    const { startApplication } = await import('./main/bootstrap.ts')
    startApplication()
  } catch (error) {
    console.error('Fatal error while loading the Electron main process:', error)
    const failureDialog = createStartupFailureDialog(error)
    dialog.showErrorBox(failureDialog.title, failureDialog.content)
    app.exit(1)
  }
}

void launchApplication()
