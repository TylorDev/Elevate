import { useCallback, useEffect, useMemo, useState } from 'react'
import { LuArrowLeft, LuArrowRight, LuFolderOpen, LuMoveUp } from 'react-icons/lu'
import Modal from '../Modal/Modal'
import { useI18n } from '../../Contexts/I18nContext'
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

function getPlaylistNameValidationError(name = '', t = (key) => key) {
  const trimmedName = String(name).trim()

  if (!trimmedName) {
    return t('modals.playlistSave.invalidName')
  }

  if (/[\x00-\x1f]/.test(trimmedName)) {
    return t('modals.playlistSave.invalidControlCharacter')
  }

  if (/[<>:"/\\|?*]/.test(trimmedName)) {
    return t('modals.playlistSave.invalidControlCharacter')
  }

  if (/[. ]$/.test(trimmedName)) {
    return t('modals.playlistSave.invalidTrailingCharacter')
  }

  if (WINDOWS_RESERVED_FILE_NAMES.has(trimmedName.toUpperCase())) {
    return t('modals.playlistSave.reservedName')
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

export function PlaylistSaveModal({
  isVisible,
  onClose,
  tracks = [],
  sourceName = '',
  onSubmitSave = null,
  submitLabel = 'Save',
  titleOverride = '',
  modeLabel = ''
}) {
  const { t } = useI18n()
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
  const modalTitle = titleOverride || t('modals.playlistSave.saveTitle')
  const submitButtonLabel = isSaving ? t('common.saving') : submitLabel

  const loadDirectory = useCallback(
    async (directoryPath, options = {}) => {
      const { preserveSelection = false, preserveName = false, updateHistory = true } = options

      if (typeof directoryPath !== 'string' || directoryPath.trim() === '') {
        setNavigationError(t('modals.playlistSave.noFolderToOpen'))
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
        setNavigationError(loadError?.message || t('modals.playlistSave.openFolderFailed'))
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [historyIndex, listPlaylistSaveDirectory, navigationHistory, t]
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
          setError(t('modals.playlistSave.openExplorerFailed'))
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
  }, [isVisible, listPlaylistSaveDirectory, resolvePlaylistSaveDirectory, sourceName, t])

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
      setNavigationError(t('modals.playlistSave.navigationPathRequired'))
      return
    }

    await loadDirectory(trimmedAddress, {
      preserveName: true,
      preserveSelection: false,
      updateHistory: true
    })
  }, [addressInput, loadDirectory, t])

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
      const validationError = getPlaylistNameValidationError(normalizedName, t)

      if (validationError) {
        setError(validationError)
        return
      }

      if (!currentDirectory) {
        setError(t('modals.playlistSave.selectedFolderRequired'))
        return
      }

      setIsSaving(true)
      setError('')

      try {
        const result = onSubmitSave
          ? await onSubmitSave({
              tracks,
              nombre: normalizedName,
              targetDirectory: currentDirectory,
              replacePath: selectedFilePath
            })
          : await savePlaylistFromTracks(tracks, {
              nombre: normalizedName,
              targetDirectory: currentDirectory,
              replacePath: selectedFilePath
            })

        if (result?.success) {
          onClose()
          return
        }

        setError(result?.error || t('playlists.saveFailed'))
      } finally {
        setIsSaving(false)
      }
    },
    [currentDirectory, nombre, onClose, onSubmitSave, savePlaylistFromTracks, selectedFilePath, t, tracks]
  )

  return (
    <Modal isVisible={isVisible} closeModal={onClose} contentClassName="playlist-save-modal">
      <form className="playlist-save-modal__form" onSubmit={handleSubmit}>
        <div className="playlist-save-modal__header">
          <div className="playlist-save-modal__header-copy">
            {modeLabel ? <span className="playlist-save-modal__eyebrow">{modeLabel}</span> : null}
            <h2>{modalTitle}</h2>
          </div>
        </div>

        <section className="playlist-save-modal__browser" aria-label={t('modals.playlistSave.browserLabel')}>
          <div className="playlist-save-modal__toolbar">
            <button
              type="button"
              className="playlist-save-modal__nav-button"
              onClick={() => void handleGoBack()}
              disabled={!canGoBack || isLoading}
              aria-label={t('common.previous')}
            >
              <LuArrowLeft />
            </button>

            <button
              type="button"
              className="playlist-save-modal__nav-button"
              onClick={() => void handleGoForward()}
              disabled={!canGoForward || isLoading}
              aria-label={t('common.next')}
            >
              <LuArrowRight />
            </button>

            <button
              type="button"
              className="playlist-save-modal__nav-button"
              onClick={() => void handleGoUp()}
              disabled={!directoryState.parentPath || isLoading}
              aria-label={t('common.up')}
            >
              <LuMoveUp />
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
                placeholder={t('modals.playlistSave.absolutePathPlaceholder')}
                spellCheck={false}
                disabled={isLoading}
                aria-label={t('modals.playlistSave.folderAddress')}
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
                  {t('modals.playlistSave.emptyDirectory')}
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
                {t('common.cancel')}
              </button>
              <button type="submit" disabled={isSaving || isLoading || trackCount === 0}>
                {submitButtonLabel}
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
