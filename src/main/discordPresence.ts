// @ts-nocheck
import log from 'electron-log/main.js'

/**
 * Discord Rich Presence service for Elevate.
 *
 * Runs entirely in the Electron main process. The renderer pushes
 * presence snapshots via IPC; this module owns the RPC connection
 * and rate‑limits updates to Discord.
 */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** @type {import('@xhayper/discord-rpc').Client | null} */
let rpcClient = null
let clientId = ''
let isConnected = false
let isConnecting = false
let isDisabled = false
let reconnectTimer = null
let lastPresencePayload = null

const RECONNECT_INTERVAL_MS = 15_000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function payloadsAreEqual(a, b) {
  if (a === b) return true
  if (!a || !b) return false

  return (
    a.details === b.details &&
    a.state === b.state &&
    a.largeImageKey === b.largeImageKey &&
    a.largeImageText === b.largeImageText &&
    a.smallImageKey === b.smallImageKey &&
    a.smallImageText === b.smallImageText &&
    a.startTimestamp === b.startTimestamp
  )
}

// ---------------------------------------------------------------------------
// Connection management
// ---------------------------------------------------------------------------

async function tryConnect() {
  if (isDisabled || isConnected || isConnecting || !rpcClient) return

  isConnecting = true
  try {
    await rpcClient.login()
    // 'ready' event will set isConnected = true
  } catch (err) {
    log.warn('[discord-rpc] Connection attempt failed:', err?.message || err)
    isConnecting = false
    scheduleReconnect()
  }
}

function scheduleReconnect() {
  if (isDisabled || reconnectTimer) return

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    void tryConnect()
  }, RECONNECT_INTERVAL_MS)
}

function cancelReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the Discord RPC service.
 * Call once during app startup. If `DISCORD_CLIENT_ID` is not set the
 * service marks itself as `disabled` and becomes a no‑op.
 */
export async function initDiscordPresence() {
  clientId = process.env.DISCORD_CLIENT_ID?.trim() || ''

  if (!clientId) {
    log.info('[discord-rpc] DISCORD_CLIENT_ID not set – presence disabled')
    isDisabled = true
    return
  }

  try {
    // Dynamic import so the dependency does not break the app if missing.
    const { Client } = await import('@xhayper/discord-rpc')

    rpcClient = new Client({ clientId })

    rpcClient.on('ready', () => {
      isConnected = true
      isConnecting = false
      cancelReconnect()
      log.info('[discord-rpc] Connected – user:', rpcClient.user?.username || '(unknown)')

      // Re‑apply last presence if one was cached while disconnected.
      if (lastPresencePayload) {
        void rpcClient.user?.setActivity(lastPresencePayload).catch(() => {})
      }
    })

    rpcClient.on('disconnected', () => {
      log.warn('[discord-rpc] Disconnected')
      isConnected = false
      isConnecting = false
      scheduleReconnect()
    })

    await tryConnect()
  } catch (err) {
    log.error('[discord-rpc] Init error:', err?.message || err)
    isDisabled = true
  }
}

/**
 * Update the Rich Presence activity.
 *
 * @param {{ title?: string, artist?: string, isPlaying?: boolean, startedAt?: number, queueSourceLabel?: string }} payload
 */
export function setPresence(payload = {}) {
  if (isDisabled) return

  const title = payload.title || ''
  const artist = payload.artist || ''
  const playing = Boolean(payload.isPlaying)

  const activity = {
    details: title || 'No track',
    state: artist || 'Listening on Elevate',
    largeImageKey: 'elevate',
    largeImageText: 'Elevate',
    smallImageKey: playing ? 'playing' : 'paused',
    smallImageText: playing ? 'Playing' : 'Paused',
    startTimestamp: playing && payload.startedAt ? payload.startedAt : undefined
  }

  // Skip redundant updates.
  if (payloadsAreEqual(lastPresencePayload, activity)) return

  lastPresencePayload = activity

  if (!isConnected) {
    // Cache it – will be applied when connection succeeds.
    if (!isConnecting && !reconnectTimer) void tryConnect()
    return
  }

  void rpcClient?.user?.setActivity(activity).catch((err) => {
    log.warn('[discord-rpc] setActivity error:', err?.message || err)
  })
}

/**
 * Clear the Rich Presence activity (idle state).
 */
export function clearPresence() {
  if (isDisabled) return

  lastPresencePayload = null

  if (!isConnected) return

  void rpcClient?.user?.clearActivity().catch((err) => {
    log.warn('[discord-rpc] clearActivity error:', err?.message || err)
  })
}

/**
 * Returns a snapshot of the service status.
 */
export function getStatus() {
  return {
    disabled: isDisabled,
    connected: isConnected,
    connecting: isConnecting,
    hasPresence: lastPresencePayload !== null
  }
}

/**
 * Gracefully tear down the RPC connection.
 * Call during app shutdown.
 */
export async function shutdownDiscordPresence() {
  cancelReconnect()
  isDisabled = true

  if (rpcClient) {
    try {
      await rpcClient.destroy()
    } catch (err) {
      log.warn('[discord-rpc] Shutdown error:', err?.message || err)
    }

    rpcClient = null
  }

  isConnected = false
  isConnecting = false
  lastPresencePayload = null
  log.info('[discord-rpc] Shut down')
}
