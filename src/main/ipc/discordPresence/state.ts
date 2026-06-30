import type { DiscordPresenceState, DiscordPresenceStatus } from '../../Types/discordPresence.ts'

export const discordPresenceState: DiscordPresenceState = {
  rpcClient: null,
  clientId: '',
  isConnected: false,
  isConnecting: false,
  isDisabled: false,
  reconnectTimer: null,
  lastPresencePayload: null
}

export function getStatus(): DiscordPresenceStatus {
  return {
    disabled: discordPresenceState.isDisabled,
    connected: discordPresenceState.isConnected,
    connecting: discordPresenceState.isConnecting,
    hasPresence: discordPresenceState.lastPresencePayload !== null
  }
}
