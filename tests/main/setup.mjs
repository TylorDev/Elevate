import mockRequire from 'mock-require'
import { afterEach, vi } from 'vitest'
import { electronMock, resetElectronMock } from './helpers/electronMock.mjs'

mockRequire('electron', electronMock)

vi.mock('electron', () => electronMock)

vi.mock('electron-log/main.js', () => {
  const createLogger = () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    initialize: vi.fn(),
    transports: {
      file: {
        getFile: vi.fn(() => ({ path: 'main.log' }))
      },
      console: {}
    }
  })
  const logger = createLogger()
  logger.create = vi.fn(() => createLogger())

  return {
    default: logger,
    ...logger
  }
})

afterEach(() => {
  resetElectronMock()
  vi.unstubAllGlobals()
})
