import { afterEach, describe, expect, it, vi } from 'vitest'
import { getRegisteredIpcChannels, invokeIpc } from './helpers/electronMock.mjs'
import { createRuntimeContext, importFreshProject } from './helpers/runtime.mjs'

const rpcMock = vi.hoisted(() => ({ instances: [] }))

vi.mock('@xhayper/discord-rpc', () => {
  class Client {
    constructor(options) {
      this.options = options
      this.handlers = new Map()
      this.user = {
        username: 'test-user',
        setActivity: vi.fn(async () => {}),
        clearActivity: vi.fn(async () => {})
      }
      this.login = vi.fn(async () => {
        this.handlers.get('ready')?.()
      })
      this.destroy = vi.fn(async () => {})
      rpcMock.instances.push(this)
    }

    on(event, handler) {
      this.handlers.set(event, handler)
    }
  }

  return { Client }
})

let runtime = null
let previousClientId

afterEach(async () => {
  vi.useRealTimers()
  rpcMock.instances.length = 0
  if (previousClientId === undefined) delete process.env.DISCORD_CLIENT_ID
  else process.env.DISCORD_CLIENT_ID = previousClientId
  previousClientId = undefined

  if (runtime) {
    await runtime.cleanup()
    runtime = null
  }
})

describe('discord presence', () => {
  it('builds playing and paused activities and detects redundant payloads', async () => {
    runtime = await createRuntimeContext()
    const activity = await importFreshProject('src/main/ipc/discordPresence/activity.ts')
    const playing = activity.buildPresenceActivity({
      title: 'Track',
      artist: 'Artist',
      isPlaying: true,
      startedAt: 123
    })
    const paused = activity.buildPresenceActivity({})

    expect(playing).toMatchObject({
      details: 'Track',
      state: 'Artist',
      smallImageKey: 'playing',
      startTimestamp: 123
    })
    expect(paused).toMatchObject({
      details: 'No track',
      state: 'Listening on Elevate',
      smallImageKey: 'paused'
    })
    expect(activity.payloadsAreEqual(playing, { ...playing })).toBe(true)
    expect(activity.payloadsAreEqual(playing, paused)).toBe(false)
  })

  it('disables the service cleanly when no Discord client id is configured', async () => {
    runtime = await createRuntimeContext()
    previousClientId = process.env.DISCORD_CLIENT_ID
    delete process.env.DISCORD_CLIENT_ID
    const discord = await importFreshProject('src/main/ipc/discordPresence/index.ts')

    await discord.initDiscordPresence()
    expect(discord.getStatus()).toEqual({
      disabled: true,
      connected: false,
      connecting: false,
      hasPresence: false
    })
    expect(rpcMock.instances).toHaveLength(0)
  })

  it('connects, deduplicates presence, reconnects and shuts down through its public API', async () => {
    vi.useFakeTimers()
    runtime = await createRuntimeContext()
    previousClientId = process.env.DISCORD_CLIENT_ID
    process.env.DISCORD_CLIENT_ID = 'client-id'
    const discord = await importFreshProject('src/main/ipc/discordPresence/index.ts')

    discord.setupDiscordPresenceHandlers()
    await discord.initDiscordPresence()
    const client = rpcMock.instances[0]

    expect(getRegisteredIpcChannels()).toEqual([
      'discord-presence:update',
      'discord-presence:clear',
      'discord-presence:get-status'
    ])
    await invokeIpc('discord-presence:update', {
      title: 'Track',
      artist: 'Artist',
      isPlaying: true,
      startedAt: 100
    })
    await invokeIpc('discord-presence:update', {
      title: 'Track',
      artist: 'Artist',
      isPlaying: true,
      startedAt: 100
    })
    expect(client.user.setActivity).toHaveBeenCalledTimes(1)
    expect(await invokeIpc('discord-presence:get-status')).toEqual({
      disabled: false,
      connected: true,
      connecting: false,
      hasPresence: true
    })

    await invokeIpc('discord-presence:clear')
    expect(client.user.clearActivity).toHaveBeenCalledTimes(1)

    client.handlers.get('disconnected')?.()
    await vi.advanceTimersByTimeAsync(15_000)
    expect(client.login).toHaveBeenCalledTimes(2)

    await discord.shutdownDiscordPresence()
    expect(client.destroy).toHaveBeenCalledTimes(1)
    expect(discord.getStatus()).toEqual({
      disabled: true,
      connected: false,
      connecting: false,
      hasPresence: false
    })
  })
})
