import log from 'electron-log/main.js'
import { tryConnect } from './connection.ts'
import { discordPresenceState } from './state.ts'
import type {
  DiscordPresenceActivity,
  DiscordPresenceUpdatePayload
} from '../../Types/discordPresence.ts'

export function payloadsAreEqual(
  left: DiscordPresenceActivity | null,
  right: DiscordPresenceActivity | null
): boolean {
  if (left === right) return true
  if (!left || !right) return false

  return (
    left.details === right.details &&
    left.state === right.state &&
    left.largeImageKey === right.largeImageKey &&
    left.largeImageText === right.largeImageText &&
    left.smallImageKey === right.smallImageKey &&
    left.smallImageText === right.smallImageText &&
    left.startTimestamp === right.startTimestamp
  )
}

export function buildPresenceActivity(
  payload: DiscordPresenceUpdatePayload = {}
): DiscordPresenceActivity {
  const playing = Boolean(payload.isPlaying)
  return {
    details: payload.title || 'No track',
    state: payload.artist || 'Listening on Elevate',
    largeImageKey: 'elevate',
    largeImageText: 'Elevate',
    smallImageKey: playing ? 'playing' : 'paused',
    smallImageText: playing ? 'Playing' : 'Paused',
    startTimestamp: playing && payload.startedAt ? payload.startedAt : undefined
  }
}

export function setPresence(payload: DiscordPresenceUpdatePayload = {}): void {
  const state = discordPresenceState
  if (state.isDisabled) return

  const activity = buildPresenceActivity(payload)
  if (payloadsAreEqual(state.lastPresencePayload, activity)) return
  state.lastPresencePayload = activity

  if (!state.isConnected) {
    if (!state.isConnecting && !state.reconnectTimer) void tryConnect()
    return
  }

  void state.rpcClient?.user?.setActivity(activity).catch((error: unknown) => {
    const message = error && typeof error === 'object' ? Reflect.get(error, 'message') : error
    log.warn('[discord-rpc] setActivity error:', message || error)
  })
}

export function clearPresence(): void {
  const state = discordPresenceState
  if (state.isDisabled) return

  state.lastPresencePayload = null
  if (!state.isConnected) return

  void state.rpcClient?.user?.clearActivity().catch((error: unknown) => {
    const message = error && typeof error === 'object' ? Reflect.get(error, 'message') : error
    log.warn('[discord-rpc] clearActivity error:', message || error)
  })
}
