import type { Client } from '@xhayper/discord-rpc'
import type { IpcArgs, IpcChannel, IpcInvokeHandler } from './ipc.ts'

export type DiscordPresenceUpdatePayload = {
  title?: string | null
  artist?: string | null
  isPlaying?: boolean | null
  startedAt?: number | null
  queueSourceLabel?: string | null
}

export type DiscordPresenceActivity = {
  details: string
  state: string
  largeImageKey: string
  largeImageText: string
  smallImageKey: 'playing' | 'paused'
  smallImageText: 'Playing' | 'Paused'
  startTimestamp?: number
}

export type DiscordPresenceStatus = {
  disabled: boolean
  connected: boolean
  connecting: boolean
  hasPresence: boolean
}

export type DiscordPresenceState = {
  rpcClient: Client | null
  clientId: string
  isConnected: boolean
  isConnecting: boolean
  isDisabled: boolean
  reconnectTimer: ReturnType<typeof setTimeout> | null
  lastPresencePayload: DiscordPresenceActivity | null
}

export type DiscordPresenceIpcContract = {
  'discord-presence:update': {
    args: [payload?: DiscordPresenceUpdatePayload]
    result: void
  }
  'discord-presence:clear': {
    args: []
    result: void
  }
  'discord-presence:get-status': {
    args: []
    result: DiscordPresenceStatus
  }
}

export type DiscordPresenceChannel = IpcChannel<DiscordPresenceIpcContract>

export type DiscordPresenceArgs<C extends DiscordPresenceChannel> = IpcArgs<
  DiscordPresenceIpcContract,
  C
>

export type DiscordPresenceInvokeHandler<C extends DiscordPresenceChannel> = IpcInvokeHandler<
  DiscordPresenceArgs<C>,
  DiscordPresenceIpcContract[C]['result']
>
