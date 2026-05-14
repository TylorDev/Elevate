import './PlaylistForm.scss'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { dataToImageUrl } from '../../Contexts/utils'
import { useSuper } from '../../Contexts/SupeContext'

function resolveSuggestedCoverUrl(cover) {
  if (cover?.picture?.[0]?.data) {
    return dataToImageUrl(cover.picture[0])
  }

  return null
}

const PlaylistForm = ({
  playlist,
  suggestedCovers = [],
  coverConfig = {},
  automaticCover,
  effectiveCover,
  onUpdate,
  close
}) => {
  const { getImage } = useSuper()
  const initialCoverMode = coverConfig?.customCoverMode || 'auto'
  const initialSelectedIds = Array.isArray(coverConfig?.customCoverSelection)
    ? coverConfig.customCoverSelection
        .map((selection) =>
          typeof selection === 'string'
            ? selection
            : selection?.suggestedId || selection?.filePath || selection?.coverHash || null
        )
        .filter(Boolean)
    : []

  const [nombre, setNombre] = useState(playlist?.nombre || '')
  const [coverMode, setCoverMode] = useState(initialCoverMode)
  const [selectedSuggestedCoverIds, setSelectedSuggestedCoverIds] = useState(initialSelectedIds)
  const [localImageValue, setLocalImageValue] = useState('')
  const [localResolvedUrl, setLocalResolvedUrl] = useState('')
  const [localPreviewUrl, setLocalPreviewUrl] = useState('')
  const [remoteImageValue, setRemoteImageValue] = useState('')
  const [remoteResolvedUrl, setRemoteResolvedUrl] = useState('')
  const [remotePreviewUrl, setRemotePreviewUrl] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResolvingLocal, setIsResolvingLocal] = useState(false)
  const [isResolvingRemote, setIsResolvingRemote] = useState(false)

  useEffect(() => {
    setNombre(playlist?.nombre || '')
  }, [playlist?.nombre])

  useEffect(() => {
    const nextMode = coverConfig?.customCoverMode || 'auto'
    const nextSelectedIds = Array.isArray(coverConfig?.customCoverSelection)
      ? coverConfig.customCoverSelection
          .map((selection) =>
            typeof selection === 'string'
              ? selection
              : selection?.suggestedId || selection?.filePath || selection?.coverHash || null
          )
          .filter(Boolean)
      : []

    setCoverMode(nextMode)
    setSelectedSuggestedCoverIds(nextSelectedIds)

    if (nextMode === 'local-image') {
      setLocalImageValue(coverConfig?.customCoverValue || '')
      setLocalResolvedUrl(coverConfig?.customCoverValue || '')
      setLocalPreviewUrl(coverConfig?.customCoverValue || '')
      setRemoteImageValue('')
      setRemoteResolvedUrl('')
      setRemotePreviewUrl('')
    } else if (nextMode === 'remote-image') {
      setRemoteImageValue('')
      setRemoteResolvedUrl(coverConfig?.customCoverValue || '')
      setRemotePreviewUrl(coverConfig?.customCoverValue || '')
      setLocalImageValue('')
      setLocalResolvedUrl('')
      setLocalPreviewUrl('')
    } else {
      setLocalImageValue('')
      setLocalResolvedUrl('')
      setLocalPreviewUrl('')
      setRemoteImageValue('')
      setRemoteResolvedUrl('')
      setRemotePreviewUrl('')
    }
  }, [coverConfig])

  const collagePreviewUrls = useMemo(
    () =>
      selectedSuggestedCoverIds
        .map((id) => suggestedCovers.find((cover) => cover.suggestedId === id))
        .filter(Boolean)
        .map((cover) => resolveSuggestedCoverUrl(cover))
        .filter(Boolean),
    [selectedSuggestedCoverIds, suggestedCovers]
  )

  const handleCoverModeChange = useCallback((nextMode) => {
    setCoverMode(nextMode)
    setErrorMessage('')
  }, [])

  const handleSuggestedCoverClick = useCallback((cover) => {
    const selectedId = cover.suggestedId

    setSelectedSuggestedCoverIds((previous) => {
      if (previous.includes(selectedId)) {
        return previous.filter((id) => id !== selectedId)
      }

      if (previous.length >= 4) {
        setErrorMessage('Selecciona solo 4 imágenes')
        return previous
      }

      setErrorMessage('')
      return [...previous, selectedId]
    })
  }, [])

  const handleLocalImageSelect = useCallback(async () => {
    setIsResolvingLocal(true)
    setErrorMessage('')

    try {
      const result = await window.electron.imageSources.pickLocal()
      if (result?.success) {
        setLocalImageValue(result.filePath || '')
        setLocalResolvedUrl(result.resolvedUrl || '')
        setLocalPreviewUrl(result.resolvedUrl || '')
      } else if (result?.errorCode !== 'canceled') {
        setErrorMessage(result?.errorMessage || 'No se pudo seleccionar la imagen')
      }
    } catch (error) {
      console.error('Error picking local image:', error)
      setErrorMessage('No se pudo seleccionar la imagen')
    } finally {
      setIsResolvingLocal(false)
    }
  }, [])

  const handleRemoteImageApply = useCallback(async () => {
    const url = remoteImageValue.trim()
    if (!url) {
      setErrorMessage('Introduce una URL válida')
      return
    }

    setIsResolvingRemote(true)
    setErrorMessage('')

    try {
      const result = await window.electron.imageSources.validateRemote(url)
      if (result?.success) {
        setRemoteResolvedUrl(result.resolvedUrl || '')
        setRemotePreviewUrl(result.resolvedUrl || '')
      } else {
        setErrorMessage(result?.errorMessage || 'No se pudo validar la imagen remota')
      }
    } catch (error) {
      console.error('Error validating remote image:', error)
      setErrorMessage('No se pudo validar la imagen remota')
    } finally {
      setIsResolvingRemote(false)
    }
  }, [remoteImageValue])

  const handleResetCover = useCallback(() => {
    setCoverMode('auto')
    setSelectedSuggestedCoverIds([])
    setLocalImageValue('')
    setLocalResolvedUrl('')
    setLocalPreviewUrl('')
    setRemoteImageValue('')
    setRemoteResolvedUrl('')
    setRemotePreviewUrl('')
    setErrorMessage('')
  }, [])

  const validateForm = useCallback(() => {
    if (!nombre.trim()) {
      setErrorMessage('El nombre no puede estar vacío')
      return false
    }

    if (coverMode === 'suggested-collage' && selectedSuggestedCoverIds.length !== 4) {
      setErrorMessage('Selecciona exactamente 4 imágenes para el collage')
      return false
    }

    if (coverMode === 'local-image' && !localResolvedUrl) {
      setErrorMessage('Selecciona una imagen local válida')
      return false
    }

    if (coverMode === 'remote-image' && !remoteResolvedUrl) {
      setErrorMessage('Aplica una URL de imagen válida antes de guardar')
      return false
    }

    return true
  }, [coverMode, localResolvedUrl, nombre, remoteResolvedUrl, selectedSuggestedCoverIds.length])

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault()
    setErrorMessage('')

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    const payload = {
      nombre: nombre.trim()
    }

    if (coverMode === 'suggested-collage') {
      payload.coverMode = 'suggested-collage'
      payload.coverSelection = selectedSuggestedCoverIds
    } else if (coverMode === 'local-image') {
      payload.coverMode = 'local-image'
      payload.coverValue = localResolvedUrl
    } else if (coverMode === 'remote-image') {
      payload.coverMode = 'remote-image'
      payload.coverValue = remoteResolvedUrl
    } else {
      payload.coverMode = 'auto'
    }

    try {
      const response = await onUpdate(playlist.path, payload)
      if (response?.success) {
        close()
      } else {
        setErrorMessage(response?.error || 'Error al guardar')
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [
    close,
    coverMode,
    localResolvedUrl,
    nombre,
    onUpdate,
    playlist.path,
    remoteResolvedUrl,
    selectedSuggestedCoverIds,
    validateForm
  ])

  const automaticCoverUrl = automaticCover ? getImage(`${playlist?.path}:auto`, automaticCover) : ''
  const effectiveCoverUrl = effectiveCover ? getImage(`${playlist?.path}:effective`, effectiveCover) : ''

  return (
    <form onSubmit={handleSubmit} className="playlist-form">
      <div className="playlist-form__header">
        <h2>Editar Playlist</h2>
      </div>

      <div className="playlist-form__body">
        <div className="playlist-form__field">
          <label className="playlist-form__label">Nombre</label>
          <input
            type="text"
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            className="playlist-form__input"
            placeholder="Nombre de la playlist"
          />
        </div>

        <div className="playlist-form__field">
          <label className="playlist-form__label">Path</label>
          <input
            type="text"
            value={playlist?.path || ''}
            className="playlist-form__input playlist-form__input--disabled"
            disabled
          />
        </div>

        <div className="playlist-form__section">
          <div className="playlist-form__section-header">
            <label className="playlist-form__label">Portada</label>
            <button type="button" className="playlist-form__clear-btn" onClick={handleResetCover}>
              Restablecer
            </button>
          </div>

          <div className="playlist-form__cover-modes">
            <button
              type="button"
              className={`playlist-form__mode-btn ${coverMode === 'auto' ? 'playlist-form__mode-btn--active' : ''}`}
              onClick={() => handleCoverModeChange('auto')}
            >
              Automático
            </button>
            <button
              type="button"
              className={`playlist-form__mode-btn ${coverMode === 'suggested-collage' ? 'playlist-form__mode-btn--active' : ''}`}
              onClick={() => handleCoverModeChange('suggested-collage')}
            >
              Sugeridos
            </button>
            <button
              type="button"
              className={`playlist-form__mode-btn ${coverMode === 'local-image' ? 'playlist-form__mode-btn--active' : ''}`}
              onClick={() => handleCoverModeChange('local-image')}
            >
              Imagen local
            </button>
            <button
              type="button"
              className={`playlist-form__mode-btn ${coverMode === 'remote-image' ? 'playlist-form__mode-btn--active' : ''}`}
              onClick={() => handleCoverModeChange('remote-image')}
            >
              URL
            </button>
          </div>

          {coverMode === 'auto' && (
            <div className="playlist-form__cover-preview">
              <p className="playlist-form__cover-info">
                Se usará la portada automática basada en las canciones más escuchadas.
              </p>
              {automaticCoverUrl ? (
                <div className="playlist-form__cover-current">
                  <img src={automaticCoverUrl} alt="Cover automático" />
                </div>
              ) : null}
            </div>
          )}

          {coverMode === 'suggested-collage' && (
            <div className="playlist-form__suggested">
              <p className="playlist-form__cover-info">
                Selecciona exactamente 4 imágenes ({selectedSuggestedCoverIds.length}/4)
              </p>

              {suggestedCovers.length > 0 ? (
                <div className="playlist-form__suggested-grid">
                  {suggestedCovers.map((cover) => {
                    const isSelected = selectedSuggestedCoverIds.includes(cover.suggestedId)
                    const coverUrl = resolveSuggestedCoverUrl(cover)

                    return (
                      <button
                        key={cover.suggestedId}
                        type="button"
                        className={`playlist-form__suggested-item ${isSelected ? 'playlist-form__suggested-item--selected' : ''}`}
                        onClick={() => handleSuggestedCoverClick(cover)}
                      >
                        {coverUrl ? (
                          <img src={coverUrl} alt={cover.title || 'Cover'} />
                        ) : (
                          <div className="playlist-form__suggested-placeholder">Sin cover</div>
                        )}
                        <div className="playlist-form__suggested-info">
                          <span className="playlist-form__suggested-title">{cover.title || 'Sin título'}</span>
                          {cover.artist ? (
                            <span className="playlist-form__suggested-artist">{cover.artist}</span>
                          ) : null}
                        </div>
                        {isSelected ? <div className="playlist-form__suggested-check">✓</div> : null}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="playlist-form__cover-info">
                  No hay suficientes covers disponibles para crear un collage.
                </p>
              )}

              {selectedSuggestedCoverIds.length > 0 ? (
                <div className="playlist-form__selected-info">
                  <p>Seleccionadas: {selectedSuggestedCoverIds.length}/4</p>
                  <button
                    type="button"
                    className="playlist-form__clear-btn"
                    onClick={() => setSelectedSuggestedCoverIds([])}
                  >
                    Limpiar selección
                  </button>
                </div>
              ) : null}

              {collagePreviewUrls.length > 0 ? (
                <div className="playlist-form__collage-preview">
                  <h4>Vista previa del collage</h4>
                  <div className="playlist-form__collage-grid">
                    {collagePreviewUrls.map((image, index) => (
                      <img key={`${image}-${index}`} src={image} alt={`Collage ${index + 1}`} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {coverMode === 'local-image' && (
            <div className="playlist-form__local">
              <button
                type="button"
                className="playlist-form__select-btn"
                onClick={handleLocalImageSelect}
                disabled={isResolvingLocal}
              >
                {isResolvingLocal ? 'Cargando imagen...' : 'Elegir imagen'}
              </button>
              {localPreviewUrl ? (
                <div className="playlist-form__local-preview">
                  <img src={localPreviewUrl} alt="Preview local" />
                  <button
                    type="button"
                    className="playlist-form__clear-btn"
                    onClick={() => {
                      setLocalImageValue('')
                      setLocalResolvedUrl('')
                      setLocalPreviewUrl('')
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {coverMode === 'remote-image' && (
            <div className="playlist-form__remote">
              <div className="playlist-form__remote-input-group">
                <input
                  type="text"
                  value={remoteImageValue}
                  onChange={(event) => {
                    setRemoteImageValue(event.target.value)
                    setRemoteResolvedUrl('')
                    setRemotePreviewUrl('')
                  }}
                  placeholder="https://ejemplo.com/imagen.jpg"
                  className="playlist-form__input"
                />
                <button
                  type="button"
                  className="playlist-form__apply-btn"
                  onClick={handleRemoteImageApply}
                  disabled={isResolvingRemote}
                >
                  {isResolvingRemote ? 'Validando...' : 'Aplicar'}
                </button>
              </div>
              {remotePreviewUrl ? (
                <div className="playlist-form__remote-preview">
                  <img src={remotePreviewUrl} alt="Preview remota" />
                  <button
                    type="button"
                    className="playlist-form__clear-btn"
                    onClick={() => {
                      setRemoteImageValue('')
                      setRemoteResolvedUrl('')
                      setRemotePreviewUrl('')
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {coverMode !== 'auto' && effectiveCoverUrl ? (
            <div className="playlist-form__effective-preview">
              <p className="playlist-form__cover-info">Cover actual guardado</p>
              <div className="playlist-form__cover-current">
                <img src={effectiveCoverUrl} alt="Cover actual" />
              </div>
            </div>
          ) : null}
        </div>

        {errorMessage ? <div className="playlist-form__error">{errorMessage}</div> : null}
      </div>

      <div className="playlist-form__actions">
        <button type="button" className="playlist-form__cancel-btn" onClick={close}>
          Cancelar
        </button>
        <button type="submit" className="playlist-form__submit-btn" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}

export default PlaylistForm
