import mockRequire from 'mock-require'
import { afterEach, vi } from 'vitest'
import { electronMock, resetElectronMock } from './helpers/electronMock.mjs'

mockRequire('electron', electronMock)

vi.mock('electron', () => electronMock)

vi.mock('electron-log/main.js', () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    transports: {
      file: {},
      console: {}
    }
  }

  return {
    default: logger,
    ...logger
  }
})

afterEach(() => {
  resetElectronMock()
  vi.unstubAllGlobals()
})
