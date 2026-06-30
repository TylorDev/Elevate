import { ipcMain } from 'electron'
import { clearPresence, setPresence } from './activity.ts'
import { initDiscordPresence, shutdownDiscordPresence } from './connection.ts'
import { getStatus } from './state.ts'
import type {
  DiscordPresenceArgs,
  DiscordPresenceChannel,
  DiscordPresenceInvokeHandler
} from '../../Types/discordPresence.ts'

export { clearPresence, getStatus, initDiscordPresence, setPresence, shutdownDiscordPresence }
export type * from '../../Types/discordPresence.ts'

function handleDiscordPresence<C extends DiscordPresenceChannel>(
  channel: C,
  handler: DiscordPresenceInvokeHandler<C>
): void {
  ipcMain.handle(channel, (event, ...args) => handler(event, ...(args as DiscordPresenceArgs<C>)))
}

export function setupDiscordPresenceHandlers(): void {
  handleDiscordPresence('discord-presence:update', (_event, payload) => setPresence(payload))
  handleDiscordPresence('discord-presence:clear', () => clearPresence())
  handleDiscordPresence('discord-presence:get-status', () => getStatus())
}
