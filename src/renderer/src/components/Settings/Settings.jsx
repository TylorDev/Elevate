import { HexColorPicker } from 'react-colorful'
import { useEffect, useState } from 'react'
import {
  LuPalette,
  LuImage,
  LuAudioWaveform,
  LuTrash2,
  LuSparkles,
  LuCheck,
  LuFolderOpen,
  LuFolderPlus,
  LuLibrary,
  LuListMusic,
  LuMessageSquare
} from 'react-icons/lu'
import { useSuper } from '../../Contexts/SupeContext'
import { useBackground } from '../../Contexts/BackgroundContext'
import { useMini } from '../../Contexts/MiniContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import './Settings.scss'

const TABS = [
  { id: 'library', label: 'Library', icon: <LuLibrary /> },
  { id: 'colors', label: 'Colors', icon: <LuPalette /> },
  { id: 'background', label: 'Background', icon: <LuImage /> },
  { id: 'waveform', label: 'Waveform', icon: <LuAudioWaveform /> }
]

const WAVEFORM_OPTIONS = [
  {
    value: 'mirrored',
    label: 'Mirrored',
    description: 'Classic symmetric frequency bars'
  },
  {
    value: 'oscilloscope',
    label: 'Oscilloscope',
    description: 'Real-time audio waveform line'
  }
]

function getBackgroundDraftValue(item) {
  if (!item?.sourceValue) {
    return ''
  }

  return item.sourceValue.startsWith('legacy-data:') ? '' : item.sourceValue
}

function Settings() {
  const {
    color,
    handleColorChange,
    waveformVariant,
    handleWaveformVariantChange,
    discordRpcEnabled,
    toggleDiscordRpc
  } = useSuper()
  const {
    currentBackground,
    backgroundImageUrl,
    backgroundHistory,
    backgroundLoading,
    applyRemoteBackground,
    pickLocalBackground,
    selectBackgroundFromHistory,
    removeBackgroundHistoryItem,
    clearBackground
  } = useBackground()

  const { directories, getDirectories, addDirectory, deleteDirectory, directoriesLoading } =
    useMini()
  const { openM3U } = usePlaylists()

  const [activeTab, setActiveTab] = useState('library')
  const [bgDraft, setBgDraft] = useState('')
  const [isBgValidating, setIsBgValidating] = useState(false)
  const [bgError, setBgError] = useState(null)
  const [bgSuccess, setBgSuccess] = useState(null)

  useEffect(() => {
    getDirectories()
  }, [])

  useEffect(() => {
    setBgDraft(getBackgroundDraftValue(currentBackground))
  }, [currentBackground])

  const applyBackgroundDraft = async () => {
    if (!bgDraft?.trim()) return

    setIsBgValidating(true)
    setBgError(null)
    setBgSuccess(null)

    try {
      const result = await applyRemoteBackground(bgDraft.trim())
      if (result?.success) {
        setBgDraft(getBackgroundDraftValue(result.current) || bgDraft.trim())
        setBgSuccess('Imagen cargada con exito')
      } else if (result?.errorCode !== 'canceled') {
        setBgError(result?.errorMessage || 'No se pudo aplicar la imagen')
      }
    } catch (error) {
      console.error('Error applying background image:', error)
      setBgError('Error al validar la imagen')
    } finally {
      setIsBgValidating(false)
    }
  }

  const pickLocalImage = async () => {
    setIsBgValidating(true)
    setBgError(null)
    setBgSuccess(null)

    try {
      const result = await pickLocalBackground()
      if (result?.success) {
        setBgDraft(getBackgroundDraftValue(result.current))
        setBgSuccess('Imagen cargada con exito')
      } else if (result?.errorCode !== 'canceled') {
        setBgError(result?.errorMessage || 'No se pudo cargar la imagen')
      }
    } catch (error) {
      console.error('Error picking local background:', error)
      setBgError('Error al seleccionar la imagen')
    } finally {
      setIsBgValidating(false)
    }
  }

  const clearImage = () => {
    void (async () => {
      setBgError(null)
      setBgSuccess(null)

      const result = await clearBackground()
      if (result?.success) {
        setBgDraft('')
        setBgSuccess('Fondo limpiado')
      } else {
        setBgError(result?.errorMessage || 'No se pudo limpiar el fondo')
      }
    })()
  }

  const handleUseHistoryItem = async (itemId) => {
    setIsBgValidating(true)
    setBgError(null)
    setBgSuccess(null)

    try {
      const result = await selectBackgroundFromHistory(itemId)
      if (result?.success) {
        setBgDraft(getBackgroundDraftValue(result.current))
        setBgSuccess('Imagen reutilizada con exito')
      } else {
        setBgError(result?.errorMessage || 'No se pudo reutilizar la imagen')
      }
    } catch (error) {
      console.error('Error selecting background history item:', error)
      setBgError('Error al reutilizar la imagen')
    } finally {
      setIsBgValidating(false)
    }
  }

  const handleRemoveHistoryItem = async (itemId) => {
    setBgError(null)
    setBgSuccess(null)

    try {
      const result = await removeBackgroundHistoryItem(itemId)
      if (result?.success) {
        setBgSuccess('Imagen eliminada del historial')
      } else {
        setBgError(result?.errorMessage || 'No se pudo eliminar la imagen')
      }
    } catch (error) {
      console.error('Error removing background history item:', error)
      setBgError('Error al eliminar la imagen')
    }
  }

  return (
    <div className="Settings">
      <nav className="settings-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <div className="settings-content">
        {activeTab === 'library' && (
          <section className="settings-section">
            <div className="section-header">
              <h2>Music Directories</h2>
            </div>
            <p className="section-description">
              Add folders containing your music files. Elevate will scan them for audio tracks.
            </p>

            <button
              className="settings-action-btn"
              onClick={() => addDirectory()}
              disabled={directoriesLoading}
            >
              <LuFolderPlus />
              <span>Add Folder</span>
            </button>

            <div className="settings-card">
              <div className="settings-card__icon">
                <LuListMusic />
              </div>
              <div className="settings-card__content">
                <h3>Import Playlist</h3>
                <p>Import an existing `.m3u` file and add it to your playlists library.</p>
              </div>
              <button className="settings-action-btn" onClick={() => openM3U()}>
                <LuListMusic />
                <span>Import M3U</span>
              </button>
            </div>

            <div className="settings-card">
              <div className="settings-card__icon">
                <LuMessageSquare />
              </div>
              <div className="settings-card__content">
                <h3>Discord Rich Presence</h3>
                <p>Show what you're listening to on your Discord profile.</p>
              </div>
              <button
                className={`toggle-switch ${discordRpcEnabled ? 'active' : ''}`}
                onClick={toggleDiscordRpc}
                role="switch"
                aria-checked={discordRpcEnabled}
                aria-label="Toggle Discord Rich Presence"
              >
                <span className="toggle-switch__thumb" />
              </button>
            </div>

            <div className="directory-list">
              {directories.length === 0 && (
                <div className="directory-empty">
                  <LuFolderOpen />
                  <span>No directories added yet</span>
                </div>
              )}
              {directories.map((dir) => (
                <div key={dir.path} className="directory-item">
                  <div className="directory-info">
                    <LuFolderOpen className="directory-icon" />
                    <div className="directory-meta">
                      <span className="directory-path">{dir.path}</span>
                      <span className="directory-stats">
                        {dir.totalTracks ?? '-'} tracks ·{' '}
                        {dir.totalDuration ? `${Math.floor(dir.totalDuration / 60)} min` : '-'}
                      </span>
                    </div>
                  </div>
                  <button
                    className="settings-icon-btn danger"
                    onClick={() => deleteDirectory(dir.path)}
                    title="Remove directory"
                  >
                    <LuTrash2 />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'colors' && (
          <section className="settings-section">
            <div className="section-header">
              <h2>Accent Color</h2>
              <span className="color-badge" style={{ background: color || 'var(--Dynamic-color)' }}>
                {color || 'Auto'}
              </span>
            </div>

            <div className="color-picker-wrapper">
              <HexColorPicker color={color || '#baff00'} onChange={handleColorChange} />
            </div>

            <button className="settings-action-btn" onClick={() => handleColorChange('')}>
              <LuSparkles />
              <span>Auto cover color</span>
            </button>
          </section>
        )}

        {activeTab === 'background' && (
          <section className="settings-section">
            <div className="section-header">
              <h2>Page Background</h2>
            </div>

            <div className="input-group">
              <label>Background Image</label>
              <div className="input-row">
                <input
                  type="text"
                  value={bgDraft}
                  onChange={(event) => setBgDraft(event.target.value)}
                  placeholder="https://example.com/background.jpg"
                  className="settings-input"
                />
                <button
                  className="settings-action-btn s-btn"
                  onClick={applyBackgroundDraft}
                  disabled={isBgValidating || backgroundLoading}
                >
                  {isBgValidating ? '...' : 'Apply'}
                </button>
                <button
                  className="settings-action-btn s-btn"
                  onClick={pickLocalImage}
                  disabled={isBgValidating || backgroundLoading}
                >
                  <LuImage />
                  <span>Local</span>
                </button>
                <button
                  className="settings-icon-btn danger"
                  onClick={clearImage}
                  title="Clear"
                  disabled={backgroundLoading}
                >
                  <LuTrash2 />
                </button>
              </div>
              {bgError && <span className="settings-error">{bgError}</span>}
              {bgSuccess && <span className="settings-success">{bgSuccess}</span>}
            </div>

            {backgroundImageUrl && (
              <div className="image-preview">
                <img src={backgroundImageUrl} alt="Background preview" />
              </div>
            )}

            <div className="background-history">
              <div className="section-header">
                <h2>Recent Backgrounds</h2>
              </div>

              {backgroundHistory.length === 0 ? (
                <div className="background-history__empty">
                  No recent backgrounds yet. Apply a local image or URL to start your reusable
                  history.
                </div>
              ) : (
                <div className="background-history__grid">
                  {backgroundHistory.map((item) => {
                    const isActive = currentBackground?.id === item.id

                    return (
                      <article
                        key={item.id}
                        className={`background-history__card ${isActive ? 'is-active' : ''}`}
                      >
                        <div className="background-history__preview">
                          {item.resolvedUrl ? (
                            <img
                              src={item.resolvedUrl}
                              alt={item.displaySource || 'Background history'}
                            />
                          ) : (
                            <div className="background-history__placeholder">No preview</div>
                          )}
                          <span className={`background-history__badge type-${item.sourceType}`}>
                            {item.sourceType === 'remote' ? 'URL' : 'Local'}
                          </span>
                          {item.status !== 'ready' && (
                            <span className={`background-history__badge status-${item.status}`}>
                              {item.status}
                            </span>
                          )}
                        </div>

                        <div className="background-history__meta">
                          <strong title={item.sourceValue}>
                            {item.displaySource || item.sourceValue}
                          </strong>
                          <span title={item.sourceValue}>{item.sourceValue}</span>
                        </div>

                        <div className="background-history__actions">
                          <button
                            className="settings-action-btn s-btn"
                            onClick={() => handleUseHistoryItem(item.id)}
                            disabled={isActive || backgroundLoading}
                          >
                            {isActive ? 'Active' : 'Use'}
                          </button>
                          <button
                            className="settings-icon-btn danger"
                            onClick={() => handleRemoveHistoryItem(item.id)}
                            title="Remove from history"
                            disabled={isActive || backgroundLoading}
                          >
                            <LuTrash2 />
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'waveform' && (
          <section className="settings-section">
            <div className="section-header">
              <h2>Waveform Style</h2>
            </div>
            <p className="section-description">
              Choose the visualization style for the audio player timeline.
            </p>

            <div className="waveform-options">
              {WAVEFORM_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`waveform-option ${waveformVariant === option.value ? 'active' : ''}`}
                  onClick={() => handleWaveformVariantChange(option.value)}
                >
                  <div className="waveform-option-content">
                    <div className="waveform-option-header">
                      <span className="waveform-option-label">{option.label}</span>
                      {waveformVariant === option.value && (
                        <span className="waveform-check">
                          <LuCheck />
                        </span>
                      )}
                    </div>
                    <span className="waveform-option-desc">{option.description}</span>
                  </div>
                  <div className={`waveform-visual waveform-visual--${option.value}`}>
                    {option.value === 'mirrored' ? (
                      [...Array(12)].map((_, index) => (
                        <div
                          key={index}
                          className="bar"
                          style={{
                            height: `${20 + Math.sin(index * 0.8) * 60}%`,
                            animationDelay: `${index * 0.05}s`
                          }}
                        />
                      ))
                    ) : (
                      <svg viewBox="0 0 100 40" preserveAspectRatio="none">
                        <path
                          d="M0,20 Q10,5 20,20 T40,20 T60,20 T80,20 T100,20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

export default Settings
