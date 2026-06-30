import { ipcMain } from 'electron'
import { getStorageDiagnostics } from './diagnostics.ts'
import { getStoragePaths } from './paths.ts'
import type {
  StoragePathsArgs,
  StoragePathsChannel,
  StoragePathsInvokeHandler
} from '../../Types/storagePaths.ts'

export { getStorageDiagnostics, getStoragePaths }
export type * from '../../Types/storagePaths.ts'

function handleStoragePaths<C extends StoragePathsChannel>(
  channel: C,
  handler: StoragePathsInvokeHandler<C>
): void {
  ipcMain.handle(channel, (event, ...args) => handler(event, ...(args as StoragePathsArgs<C>)))
}

export function setupStoragePathHandlers(): void {
  handleStoragePaths('app:get-storage-paths', () => getStorageDiagnostics())
}
