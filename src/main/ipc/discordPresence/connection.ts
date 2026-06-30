import log from 'electron-log/main.js'
import { discordPresenceState } from './state.ts'

export const RECONNECT_INTERVAL_MS = 15_000

function getErrorMessage(error: unknown): unknown {
  if (error && typeof error === 'object') {
    return Reflect.get(error, 'message') || error
  }
  return error
}

export async function tryConnect(): Promise<void> {
  const state = discordPresenceState
  if (state.isDisabled || state.isConnected || state.isConnecting || !state.rpcClient) return

  state.isConnecting = true
  try {
    await state.rpcClient.login()
  } catch (error) {
    log.warn('[discord-rpc] Connection attempt failed:', getErrorMessage(error))
    state.isConnecting = false
    scheduleReconnect()
  }
}

export function scheduleReconnect(): void {
  const state = discordPresenceState
  if (state.isDisabled || state.reconnectTimer) return

  state.reconnectTimer = setTimeout(() => {
    state.reconnectTimer = null
    void tryConnect()
  }, RECONNECT_INTERVAL_MS)
}

export function cancelReconnect(): void {
  const state = discordPresenceState
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer)
    state.reconnectTimer = null
  }
}

export async function initDiscordPresence(): Promise<void> {
  const state = discordPresenceState
  state.clientId = process.env.DISCORD_CLIENT_ID?.trim() || ''

  if (!state.clientId) {
    log.info('[discord-rpc] DISCORD_CLIENT_ID not set – presence disabled')
    state.isDisabled = true
    return
  }

  try {
    const { Client } = await import('@xhayper/discord-rpc')
    state.rpcClient = new Client({ clientId: state.clientId })

    state.rpcClient.on('ready', () => {
      state.isConnected = true
      state.isConnecting = false
      cancelReconnect()
      log.info('[discord-rpc] Connected – user:', state.rpcClient?.user?.username || '(unknown)')

      if (state.lastPresencePayload) {
        void state.rpcClient?.user?.setActivity(state.lastPresencePayload).catch(() => {})
      }
    })

    state.rpcClient.on('disconnected', () => {
      log.warn('[discord-rpc] Disconnected')
      state.isConnected = false
      state.isConnecting = false
      scheduleReconnect()
    })

    await tryConnect()
  } catch (error) {
    log.error('[discord-rpc] Init error:', getErrorMessage(error))
    state.isDisabled = true
  }
}

export async function shutdownDiscordPresence(): Promise<void> {
  const state = discordPresenceState
  cancelReconnect()
  state.isDisabled = true

  if (state.rpcClient) {
    try {
      await state.rpcClient.destroy()
    } catch (error) {
      log.warn('[discord-rpc] Shutdown error:', getErrorMessage(error))
    }
    state.rpcClient = null
  }

  state.isConnected = false
  state.isConnecting = false
  state.lastPresencePayload = null
  log.info('[discord-rpc] Shut down')
}
