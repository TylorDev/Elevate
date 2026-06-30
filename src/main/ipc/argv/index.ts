import { ipcMain } from 'electron'
import { processLaunchArgs } from './processing.ts'
import {
  markLaunchWindowPending,
  processAndDispatchLaunchArgs,
  takePendingLaunchPayloads
} from './dispatch.ts'
import type { ArgvArgs, ArgvChannel, ArgvInvokeHandler } from '../../Types/argv.ts'

export { markLaunchWindowPending, processAndDispatchLaunchArgs, processLaunchArgs }
export type * from '../../Types/argv.ts'

function handleArgv<C extends ArgvChannel>(channel: C, handler: ArgvInvokeHandler<C>): void {
  ipcMain.handle(channel, (event, ...args) => handler(event, ...(args as ArgvArgs<C>)))
}

export function setupArgvHandlers(): void {
  handleArgv('get-argv-files', async () => takePendingLaunchPayloads())

  handleArgv('process-dropped-paths', async (event, droppedPaths = []) => {
    return processLaunchArgs(droppedPaths, {
      workingDirectory: process.cwd(),
      notifyRenderer: (message) => {
        if (message) {
          event.sender.send('notification', message)
        }
      }
    })
  })
}
