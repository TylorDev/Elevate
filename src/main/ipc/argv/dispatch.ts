import { normalizeLaunchEntries } from './entries.ts'
import { processLaunchEntries } from './processing.ts'
import {
  createEmptyPayload,
  getPayloadKind,
  summarizePayload,
  WINDOWS_OPEN_BATCH_MS
} from './shared.ts'
import type {
  LaunchDispatchRequest,
  LaunchEntry,
  LaunchPayload,
  NotifyLaunchRenderer,
  ProcessAndDispatchLaunchArgsOptions
} from '../../Types/argv.ts'
import type { BrowserWindow } from 'electron'

const pendingLaunchPayloads: LaunchPayload[] = []
let rendererLaunchChannelReady = false
let pendingDispatchRequests: LaunchDispatchRequest[] = []
let dispatchTimer: ReturnType<typeof setTimeout> | null = null

export function markLaunchWindowPending(): void {
  rendererLaunchChannelReady = false
}

export function takePendingLaunchPayloads(): LaunchPayload[] {
  rendererLaunchChannelReady = true
  const payloads = pendingLaunchPayloads.slice()
  pendingLaunchPayloads.length = 0
  console.info('[argv/main] renderer requested pending payloads', {
    pending: payloads.length,
    payloads: payloads.map(summarizePayload)
  })
  return payloads
}

export async function dispatchPayloadToRenderer(
  payload: LaunchPayload | null | undefined,
  mainWindow?: BrowserWindow | null
): Promise<void> {
  if (
    !payload ||
    payload.kind === 'empty' ||
    (payload.kind !== 'playlist-import' && payload.songs.length === 0)
  ) {
    return
  }

  if (
    rendererLaunchChannelReady &&
    mainWindow &&
    !mainWindow.isDestroyed() &&
    !mainWindow.webContents.isDestroyed()
  ) {
    console.info('[argv/main] sending payload to renderer', summarizePayload(payload))
    mainWindow.webContents.send('argv-files-processed', payload)
    return
  }

  console.info('[argv/main] queueing pending payload', summarizePayload(payload))
  pendingLaunchPayloads.push(payload)
}

export function mergeLaunchRequestEntries(
  requests: readonly LaunchDispatchRequest[]
): LaunchEntry[] {
  const mergedEntries: LaunchEntry[] = []
  const seenEntryPaths = new Set<string>()

  for (const request of requests) {
    for (const entry of request.entries) {
      if (seenEntryPaths.has(entry.path)) {
        continue
      }

      seenEntryPaths.add(entry.path)
      mergedEntries.push(entry)
    }
  }

  return mergedEntries
}

async function flushDispatchBuffer(mainWindow?: BrowserWindow | null): Promise<void> {
  dispatchTimer = null

  const requests = pendingDispatchRequests
  pendingDispatchRequests = []

  const mergedEntries = mergeLaunchRequestEntries(requests)

  const mergedPayload = await processLaunchEntries(mergedEntries, {
    notifyRenderer: requests[0]?.notifyRenderer,
    invalidateDirectoryCache: requests[0]?.invalidateDirectoryCache
  })

  console.info('[argv/main] flushing request batch', {
    count: requests.length,
    entries: mergedEntries,
    merged: summarizePayload(mergedPayload)
  })

  await dispatchPayloadToRenderer(mergedPayload, mainWindow)
}

function enqueueLaunchRequest(
  request: LaunchDispatchRequest,
  mainWindow: BrowserWindow | null | undefined,
  batchWindowMs: number
): void {
  if (request.entries.length === 0) {
    return
  }

  pendingDispatchRequests.push(request)
  console.info('[argv/main] buffered request', {
    buffered: pendingDispatchRequests.length,
    entries: request.entries
  })

  if (dispatchTimer) {
    clearTimeout(dispatchTimer)
  }

  dispatchTimer = setTimeout(async () => {
    await flushDispatchBuffer(mainWindow)
  }, batchWindowMs)
}

export async function processAndDispatchLaunchArgs(
  rawArgs: readonly unknown[],
  {
    mainWindow,
    workingDirectory = process.cwd(),
    notifyRenderer = (() => {}) as NotifyLaunchRenderer,
    invalidateDirectoryCache = () => {},
    batchWindowMs = WINDOWS_OPEN_BATCH_MS
  }: ProcessAndDispatchLaunchArgsOptions = {}
): Promise<LaunchPayload> {
  const orderedEntries = normalizeLaunchEntries(rawArgs, workingDirectory)

  console.info('[argv/main] normalized launch entries', {
    rawArgs,
    workingDirectory,
    entries: orderedEntries
  })

  if (orderedEntries.length === 0) {
    return createEmptyPayload()
  }

  if (batchWindowMs > 0) {
    enqueueLaunchRequest(
      {
        entries: orderedEntries,
        notifyRenderer,
        invalidateDirectoryCache
      },
      mainWindow,
      batchWindowMs
    )

    const files = orderedEntries.filter((entry) => entry.type === 'file').map((entry) => entry.path)
    const directories = orderedEntries
      .filter((entry) => entry.type === 'directory')
      .map((entry) => entry.path)
    const kind = getPayloadKind(files, directories)

    if (kind === 'empty') {
      return {
        kind,
        files,
        directories,
        songs: [],
        hasDirectories: false,
        queueName: 'Argv Queue',
        startIndex: 0
      }
    }

    return {
      kind,
      files,
      directories,
      songs: [],
      hasDirectories: directories.length > 0,
      queueName: 'Argv Queue',
      startIndex: 0
    }
  }

  const payload = await processLaunchEntries(orderedEntries, {
    notifyRenderer,
    invalidateDirectoryCache
  })

  console.info('[argv/main] processed launch payload', summarizePayload(payload))
  await dispatchPayloadToRenderer(payload, mainWindow)
  return payload
}
