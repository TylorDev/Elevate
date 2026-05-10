import { useCallback, useEffect, useMemo, useState } from 'react'
import Modal from '../Modal/Modal'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
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

export function PlaylistSaveModal({ isVisible, onClose, tracks = [], sourceName = '' }) {
  const {
    resolvePlaylistSaveDirectory,
    listPlaylistSaveDirectory,
    savePlaylistFromTracks
  } = usePlaylists()
  const [currentDirectory, setCurrentDirectory] = useState('')
  const [directoryState, setDirectoryState] = useState({
    currentPath: '',
    parentPath: null,
    directories: [],
    files: []
  })
  const [nombre, setNombre] = useState('')
  const [selectedFilePath, setSelectedFilePath] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const trackCount = tracks.length

  const loadDirectory = useCallback(
    async (directoryPath, { preserveSelection = false } = {}) => {
      setIsLoading(true)
      setError('')

      try {
        const nextState = await listPlaylistSaveDirectory(directoryPath)
        setCurrentDirectory(nextState.currentPath)
        setDirectoryState(nextState)

        if (!preserveSelection) {
          setSelectedFilePath(null)
        }
      } catch (loadError) {
        console.error('Error loading playlist save directory:', loadError)
        setError('No se pudo abrir esta carpeta.')
      } finally {
        setIsLoading(false)
      }
    },
    [listPlaylistSaveDirectory]
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
      } catch (loadError) {
        console.error('Error initializing playlist save modal:', loadError)
        if (isMounted) {
          setError('No se pudo abrir el explorador de playlists.')
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
  }, [])

  const handleNameChange = useCallback((event) => {
    const nextName = event.target.value
    setNombre(nextName)
    setError('')

    if (selectedFilePath && getPlaylistNameFromPath(selectedFilePath) !== nextName.trim()) {
      setSelectedFilePath(null)
    }
  }, [selectedFilePath])

  const saveModeLabel = useMemo(() => {
    if (selectedFilePath) {
      return 'Reemplazar archivo existente'
    }

    return 'Crear archivo nuevo'
  }, [selectedFilePath])

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault()

      if (!nombre.trim()) {
        setError('Escribe un nombre para la playlist.')
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
          nombre,
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
    <Modal
      isVisible={isVisible}
      closeModal={onClose}
      contentClassName="playlist-save-modal"
    >
      <form className="playlist-save-modal__form" onSubmit={handleSubmit}>
        <div className="playlist-save-modal__header">
          <div>
            <h2>Guardar como playlist</h2>
            <p>{trackCount} tracks en la lista actual</p>
          </div>
          <span className="playlist-save-modal__mode">{saveModeLabel}</span>
        </div>

        <label className="playlist-save-modal__field">
          <span>Nombre</span>
          <input
            type="text"
            value={nombre}
            onChange={handleNameChange}
            placeholder="Mi playlist"
            maxLength={80}
          />
        </label>

        <div className="playlist-save-modal__path">
          <span>Carpeta actual</span>
          <strong title={currentDirectory}>{currentDirectory || 'Cargando...'}</strong>
        </div>

        <section className="playlist-save-modal__browser" aria-label="Explorador de playlists">
          <div className="playlist-save-modal__browser-bar">
            <button
              type="button"
              onClick={() => loadDirectory(directoryState.parentPath)}
              disabled={!directoryState.parentPath || isLoading}
            >
              Subir
            </button>
            <span title={directoryState.currentPath}>{directoryState.currentPath || '...'}</span>
          </div>

          <div className="playlist-save-modal__browser-grid">
            <div className="playlist-save-modal__column">
              <div className="playlist-save-modal__column-title">Carpetas</div>
              <div className="playlist-save-modal__entries">
                {directoryState.directories.map((directory) => (
                  <button
                    key={directory.path}
                    type="button"
                    className="playlist-save-modal__entry"
                    onClick={() => loadDirectory(directory.path)}
                  >
                    <span className="playlist-save-modal__entry-icon">DIR</span>
                    <span>{directory.name}</span>
                  </button>
                ))}

                {!isLoading && directoryState.directories.length === 0 && (
                  <div className="playlist-save-modal__empty">No hay carpetas disponibles.</div>
                )}
              </div>
            </div>

            <div className="playlist-save-modal__column">
              <div className="playlist-save-modal__column-title">Archivos .m3u</div>
              <div className="playlist-save-modal__entries">
                {directoryState.files.map((file) => (
                  <button
                    key={file.path}
                    type="button"
                    className={
                      selectedFilePath === file.path
                        ? 'playlist-save-modal__entry is-selected'
                        : 'playlist-save-modal__entry'
                    }
                    onClick={() => handleFileSelect(file.path)}
                  >
                    <span className="playlist-save-modal__entry-icon">M3U</span>
                    <span>{file.name}</span>
                  </button>
                ))}

                {!isLoading && directoryState.files.length === 0 && (
                  <div className="playlist-save-modal__empty">No hay archivos .m3u en esta carpeta.</div>
                )}
              </div>
            </div>
          </div>
        </section>

        {error && <div className="playlist-save-modal__error">{error}</div>}

        <div className="playlist-save-modal__actions">
          <button type="button" onClick={onClose} disabled={isSaving}>
            Cancelar
          </button>
          <button type="submit" disabled={isSaving || isLoading || trackCount === 0}>
            {isSaving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default PlaylistSaveModal
