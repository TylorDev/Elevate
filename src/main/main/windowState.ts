import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'
import { screen, type BrowserWindow } from 'electron'
import log from 'electron-log/main.js'
import { getStoragePaths } from '../ipc/storagePaths/index.ts'
import type { PersistedWindowState } from '../Types/main.ts'
import { getMainWindow } from './context.ts'

const WINDOW_STATE_DEBOUNCE_MS = 250

let cachedState: PersistedWindowState = {}
let pendingState: PersistedWindowState | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let writeQueue: Promise<void> = Promise.resolve()

function getConfigPath(): string {
  return getStoragePaths().windowStatePath
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseWindowState(value: unknown): PersistedWindowState | null {
  if (!value || typeof value !== 'object') return null
  const state = value as PersistedWindowState
  if (!isFiniteNumber(state.x) || !isFiniteNumber(state.y)) return null

  const isVisible = screen
    .getAllDisplays()
    .some(
      ({ bounds }) =>
        state.x! >= bounds.x &&
        state.x! < bounds.x + bounds.width &&
        state.y! >= bounds.y &&
        state.y! < bounds.y + bounds.height
    )

  return isVisible ? state : null
}

export async function loadWindowState(): Promise<PersistedWindowState | null> {
  try {
    const data = await fs.readFile(getConfigPath(), 'utf8')
    const state = parseWindowState(JSON.parse(data))
    cachedState = state ?? {}
    return state
  } catch {
    cachedState = {}
    return null
  }
}

function captureWindowState(mainWindow: BrowserWindow): PersistedWindowState {
  const isMaximized = mainWindow.isMaximized()
  const isMinimized = mainWindow.isMinimized()
  const nextState: PersistedWindowState = { ...cachedState, isMaximized, isMinimized }

  if (!isMaximized && !isMinimized) {
    Object.assign(nextState, mainWindow.getBounds())
  }

  return nextState
}

async function writePendingState(): Promise<void> {
  const state = pendingState
  if (!state) return
  pendingState = null
  cachedState = state
  const configPath = getConfigPath()
  await fs.mkdir(dirname(configPath), { recursive: true })
  await fs.writeFile(configPath, JSON.stringify(state))
}

export function scheduleWindowStateSave(mainWindow = getMainWindow()): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  pendingState = captureWindowState(mainWindow)

  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    void flushWindowState().catch((error) => log.error('Failed to save window state:', error))
  }, WINDOW_STATE_DEBOUNCE_MS)
}

export async function flushWindowState(mainWindow = getMainWindow()): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    pendingState = captureWindowState(mainWindow)
  }

  writeQueue = writeQueue.then(writePendingState, writePendingState)
  await writeQueue
}

export function resetWindowStateStore(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  cachedState = {}
  pendingState = null
  writeQueue = Promise.resolve()
}
