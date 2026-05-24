import { useCallback, useEffect, useMemo, useState } from 'react'
import { LuArrowLeft, LuArrowRight, LuFolderOpen, LuMoveUp } from 'react-icons/lu'
import Modal from '../Modal/Modal'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import ExploremItem from './ExploremItem'
import './PlaylistSaveModal.scss'

function getSourcePath(sourceName = '') {
  if (typeof sourceName !== 'string') {
    return ''
  }

  if (sourceName.startsWith('folder:')) {
    return sourceName.slice('folder:'.length)
  }

  return sourceName
}

function getPlaylistNameFromPath(filePath = '') {
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    return ''
  }

  const normalizedPath = filePath.replace(/\\/g, '/')
  const leaf = normalizedPath.split('/').filter(Boolean).pop() || ''
  return leaf.replace(/\.m3u$/i, '')
}

function normalizePlaylistName(name = '') {
  return String(name)
    .trim()
    .replace(/\.m3u$/i, '')
}

const WINDOWS_RESERVED_FILE_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9'
])

function getPlaylistNameValidationError(name = '') {
  const trimmedName = String(name).trim()

  if (!trimmedName) {
    return 'Escribe un nombre valido para la playlist.'
  }

  if (/[\x00-\x1f]/.test(trimmedName)) {
    return 'El nombre de la playlist contiene caracteres no permitidos.'
  }

  if (/[<>:"/\\|?*]/.test(trimmedName)) {
    return 'El nombre de la playlist contiene caracteres no permitidos.'
  }

  if (/[. ]$/.test(trimmedName)) {
    return 'El nombre de la playlist no puede terminar en punto o espacio.'
  }

  if (WINDOWS_RESERVED_FILE_NAMES.has(trimmedName.toUpperCase())) {
    return 'El nombre de la playlist esta reservado por el sistema.'
  }

  return ''
}

function createEmptyDirectoryState() {
  return {
    currentPath: '',
    parentPath: null,
    directories: [],
    files: []
  }
}

function buildBrowserEntries(directoryState) {
  const directories = Array.isArray(directoryState?.directories) ? directoryState.directories : []
  const files = Array.isArray(directoryState?.files) ? directoryState.files : []

  return [
    ...directories.map((directory) => ({
      ...directory,
      entryType: 'directory'
    })),
    ...files.map((file) => ({
      ...file,
      entryType: 'file'
    }))
  ]
}

export function PlaylistSaveModal({ isVisible, onClose, tracks = [], sourceName = '' }) {
  const { resolvePlaylistSaveDirectory, listPlaylistSaveDirectory, savePlaylistFromTracks } =
    usePlaylists()
  const [currentDirectory, setCurrentDirectory] = useState('')
  const [directoryState, setDirectoryState] = useState(createEmptyDirectoryState)
  const [navigationHistory, setNavigationHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [addressInput, setAddressInput] = useState('')
  const [nombre, setNombre] = useState('')
  const [selectedFilePath, setSelectedFilePath] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [navigationError, setNavigationError] = useState('')

  const trackCount = tracks.length
  const canGoBack = historyIndex > 0
  const canGoForward = historyIndex >= 0 && historyIndex < navigationHistory.length - 1
  const browserEntries = useMemo(() => buildBrowserEntries(directoryState), [directoryState])

  const loadDirectory = useCallback(
    async (directoryPath, options = {}) => {
      const { preserveSelection = false, preserveName = false, updateHistory = true } = options

      if (typeof directoryPath !== 'string' || directoryPath.trim() === '') {
        setNavigationError('No hay una carpeta valida para abrir.')
        return false
      }

      setIsLoading(true)
      setError('')
      setNavigationError('')

      try {
        const nextState = await listPlaylistSaveDirectory(directoryPath)

        setCurrentDirectory(nextState.currentPath)
        setDirectoryState(nextState)
        setAddressInput(nextState.currentPath)

        if (!preserveSelection) {
          setSelectedFilePath(null)
        }

        if (!preserveName && !preserveSelection) {
          setNombre('')
        }

        if (updateHistory) {
          const baseHistory = navigationHistory.slice(0, historyIndex + 1)
          const nextHistory =
            baseHistory[baseHistory.length - 1] === nextState.currentPath
              ? baseHistory
              : [...baseHistory, nextState.currentPath]

          setNavigationHistory(nextHistory)
          setHistoryIndex(nextHistory.length - 1)
        }

        return true
      } catch (loadError) {
        console.error('Error loading playlist save directory:', loadError)
        setNavigationError(loadError?.message || 'No se pudo abrir esta carpeta.')
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [historyIndex, listPlaylistSaveDirectory, navigationHistory]
  )

  useEffect(() => {
    if (!isVisible) {
      return
    }

    let isMounted = true

    const initialize = async () => {
      setNombre('')
      setSelectedFilePath(null)
      setError('')
      setNavigationError('')
      setCurrentDirectory('')
      setDirectoryState(createEmptyDirectoryState())
      setNavigationHistory([])
      setHistoryIndex(-1)
      setAddressInput('')
      setIsLoading(true)

      try {
        const initialDirectory = await resolvePlaylistSaveDirectory(getSourcePath(sourceName))

        if (!isMounted || !initialDirectory) {
          return
        }

        const nextState = await listPlaylistSaveDirectory(initialDirectory)

        if (!isMounted) {
          return
        }

        setCurrentDirectory(nextState.currentPath)
        setDirectoryState(nextState)
        setAddressInput(nextState.currentPath)
        setNavigationHistory([nextState.currentPath])
        setHistoryIndex(0)
      } catch (loadError) {
        console.error('Error initializing playlist save modal:', loadError)
        if (isMounted) {
          setError('No se pudo abrir el explorador de playlists.')
          setNavigationError(loadError?.message || '')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void initialize()

    return () => {
      isMounted = false
    }
  }, [isVisible, listPlaylistSaveDirectory, resolvePlaylistSaveDirectory, sourceName])

  const handleFileSelect = useCallback((filePath) => {
    setSelectedFilePath(filePath)
    setNombre(getPlaylistNameFromPath(filePath))
    setError('')
    setNavigationError('')
  }, [])

  const handleNameChange = useCallback(
    (event) => {
      const nextName = normalizePlaylistName(event.target.value)
      setNombre(nextName)
      setError('')

      if (selectedFilePath && getPlaylistNameFromPath(selectedFilePath) !== nextName) {
        setSelectedFilePath(null)
      }
    },
    [selectedFilePath]
  )

  const handleAddressSubmit = useCallback(async () => {
    const trimmedAddress = addressInput.trim()

    if (!trimmedAddress) {
      setNavigationError('Escribe una ruta para navegar.')
      return
    }

    await loadDirectory(trimmedAddress, {
      preserveName: true,
      preserveSelection: false,
      updateHistory: true
    })
  }, [addressInput, loadDirectory])

  const handleGoBack = useCallback(async () => {
    if (!canGoBack) return

    const previousIndex = historyIndex - 1
    const targetPath = navigationHistory[previousIndex]
    const success = await loadDirectory(targetPath, {
      preserveName: true,
      preserveSelection: false,
      updateHistory: false
    })

    if (success) {
      setHistoryIndex(previousIndex)
    }
  }, [canGoBack, historyIndex, loadDirectory, navigationHistory])

  const handleGoForward = useCallback(async () => {
    if (!canGoForward) return

    const nextIndex = historyIndex + 1
    const targetPath = navigationHistory[nextIndex]
    const success = await loadDirectory(targetPath, {
      preserveName: true,
      preserveSelection: false,
      updateHistory: false
    })

    if (success) {
      setHistoryIndex(nextIndex)
    }
  }, [canGoForward, historyIndex, loadDirectory, navigationHistory])

  const handleGoUp = useCallback(async () => {
    if (!directoryState.parentPath) return

    await loadDirectory(directoryState.parentPath, {
      preserveName: true,
      preserveSelection: false,
      updateHistory: true
    })
  }, [directoryState.parentPath, loadDirectory])

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault()

      const normalizedName = normalizePlaylistName(nombre)
      const validationError = getPlaylistNameValidationError(normalizedName)

      if (validationError) {
        setError(validationError)
        return
      }

      if (!currentDirectory) {
        setError('No hay una carpeta seleccionada.')
        return
      }

      setIsSaving(true)
      setError('')

      try {
        const result = await savePlaylistFromTracks(tracks, {
          nombre: normalizedName,
          targetDirectory: currentDirectory,
          replacePath: selectedFilePath
        })

        if (result?.success) {
          onClose()
          return
        }

        setError(result?.error || 'No se pudo guardar la playlist.')
      } finally {
        setIsSaving(false)
      }
    },
    [currentDirectory, nombre, onClose, savePlaylistFromTracks, selectedFilePath, tracks]
  )

  return (
    <Modal isVisible={isVisible} closeModal={onClose} contentClassName="playlist-save-modal">
      <form className="playlist-save-modal__form" onSubmit={handleSubmit}>
        <section className="playlist-save-modal__browser" aria-label="Explorador de playlists">
          <div className="playlist-save-modal__toolbar">
            <button
              type="button"
              className="playlist-save-modal__nav-button"
              onClick={() => void handleGoBack()}
              disabled={!canGoBack || isLoading}
              aria-label="Previous"
            >
              <LuArrowLeft />
              <span>Previous</span>
            </button>

            <button
              type="button"
              className="playlist-save-modal__nav-button"
              onClick={() => void handleGoForward()}
              disabled={!canGoForward || isLoading}
              aria-label="Next"
            >
              <LuArrowRight />
              <span>Next</span>
            </button>

            <button
              type="button"
              className="playlist-save-modal__nav-button"
              onClick={() => void handleGoUp()}
              disabled={!directoryState.parentPath || isLoading}
              aria-label="Up"
            >
              <LuMoveUp />
              <span>Up</span>
            </button>

            <div className="playlist-save-modal__address">
              <LuFolderOpen className="playlist-save-modal__address-icon" />
              <input
                type="text"
                value={addressInput}
                onChange={(event) => {
                  setAddressInput(event.target.value)
                  setNavigationError('')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void handleAddressSubmit()
                  }
                }}
                placeholder="Pega una direccion absoluta"
                spellCheck={false}
                disabled={isLoading}
                aria-label="Direccion de carpeta"
              />
            </div>
          </div>

          {navigationError && (
            <div className="playlist-save-modal__error playlist-save-modal__error--subtle">
              {navigationError}
            </div>
          )}

          <div className="playlist-save-modal__content">
            <section className="playlist-save-modal__section">
              <div className="playlist-save-modal__browser-grid">
                {browserEntries.map((entry) => {
                  const isDirectory = entry.entryType === 'directory'
                  const isSelectedFile =
                    entry.entryType === 'file' && selectedFilePath === entry.path

                  return (
                    <ExploremItem
                      key={entry.path}
                      entry={entry}
                      isSelected={isSelectedFile}
                      isDisabled={isLoading}
                      onClick={() => {
                        if (isDirectory) {
                          void loadDirectory(entry.path, {
                            preserveName: true,
                            preserveSelection: false,
                            updateHistory: true
                          })
                          return
                        }

                        handleFileSelect(entry.path)
                      }}
                    />
                  )
                })}
              </div>

              {!isLoading && browserEntries.length === 0 && (
                <div className="playlist-save-modal__empty">
                  No hay carpetas ni archivos <code>.m3u</code> en esta ubicacion.
                </div>
              )}
            </section>
          </div>
        </section>

        <div className="playlist-save-modal__footer">
          <div className="playlist-save-modal__footer-bar">
            <label className="playlist-save-modal__name-field">
              <span>Name</span>
              <input
                type="text"
                value={nombre}
                onChange={handleNameChange}
                placeholder="MyList"
                maxLength={80}
              />
            </label>
            <div className="playlist-save-modal__actions">
              <button type="button" onClick={onClose} disabled={isSaving}>
                Cancel
              </button>
              <button type="submit" disabled={isSaving || isLoading || trackCount === 0}>
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>

        {error && <div className="playlist-save-modal__error">{error}</div>}
      </form>
    </Modal>
  )
}

export default PlaylistSaveModal
