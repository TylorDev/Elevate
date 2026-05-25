import { HexColorPicker } from 'react-colorful'
import { useEffect, useMemo, useState } from 'react'
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
import ConfirmActionModal from '../ConfirmActionModal/ConfirmActionModal'
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
  },
  {
    value: 'simple',
    label: 'Simple',
    description: 'Lightweight progress bar with thumb'
  }
]

function getBackgroundDraftValue(item) {
  if (!item?.sourceValue) {
    return ''
  }

  return item.sourceValue.startsWith('legacy-data:') ? '' : item.sourceValue
}

function getPathLeaf(path = '') {
  const normalizedPath = String(path).replace(/\\/g, '/')
  const parts = normalizedPath.split('/').filter(Boolean)
  return parts[parts.length - 1] || path
}

function formatDirectoryMinutes(duration = 0) {
  const minutes = Math.floor((Number(duration) || 0) / 60)
  return minutes > 0 ? `${minutes} min` : '-'
}

function buildDirectoryTree(directories = []) {
  const nodeById = new Map()

  directories.forEach((directory) => {
    nodeById.set(directory.id, {
      ...directory,
      children: []
    })
  })

  const roots = []

  nodeById.forEach((node) => {
    const parent = nodeById.get(node.parentId)

    if (parent) {
      parent.children.push(node)
      return
    }

    roots.push(node)
  })

  const sortNodes = (nodes) => {
    nodes.sort((left, right) =>
      getPathLeaf(left.path).localeCompare(getPathLeaf(right.path), undefined, {
        sensitivity: 'base'
      })
    )
    nodes.forEach((node) => sortNodes(node.children))
  }

  sortNodes(roots)
  return roots
}

function getDirectoryTreeStats(directory) {
  const hasChildren = directory.children?.length > 0
  const tracks = hasChildren
    ? Number(directory.recursiveTotalTracks) || Number(directory.totalTracks) || 0
    : Number(directory.totalTracks) || 0
  const duration = hasChildren
    ? Number(directory.recursiveTotalDuration) || Number(directory.totalDuration) || 0
    : Number(directory.totalDuration) || 0

  return {
    hasChildren,
    tracks,
    duration,
    affectedDirectories: 1 + (directory.children || []).reduce((total, child) => {
      return total + getDirectoryTreeStats(child).affectedDirectories
    }, 0)
  }
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

  const {
    directories,
    getDirectories,
    addDirectory,
    deleteDirectory,
    deleteDirectoryBranch,
    directoriesLoading
  } = useMini()
  const { openM3U } = usePlaylists()

  const [activeTab, setActiveTab] = useState('library')
  const [bgDraft, setBgDraft] = useState('')
  const [isBgValidating, setIsBgValidating] = useState(false)
  const [bgError, setBgError] = useState(null)
  const [bgSuccess, setBgSuccess] = useState(null)
  const [directoryDeleteTarget, setDirectoryDeleteTarget] = useState(null)
  const directoryTree = useMemo(() => buildDirectoryTree(directories), [directories])

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

  const openDirectoryDeleteConfirm = (directory) => {
    const stats = getDirectoryTreeStats(directory)
    setDirectoryDeleteTarget({
      directory,
      mode: stats.hasChildren ? 'branch' : 'single',
      ...stats
    })
  }

  const closeDirectoryDeleteConfirm = () => {
    setDirectoryDeleteTarget(null)
  }

  const confirmDirectoryDelete = async () => {
    const target = directoryDeleteTarget

    if (!target?.directory?.path) {
      return
    }

    setDirectoryDeleteTarget(null)

    if (target.mode === 'branch') {
      await deleteDirectoryBranch(target.directory.path)
      return
    }

    await deleteDirectory(target.directory.path)
  }

  const renderDirectoryNode = (directory, depth = 0) => {
    const stats = getDirectoryTreeStats(directory)
    const isRoot = directory.directoryKind === 'root'
    const isBranch = stats.hasChildren

    return (
      <div key={directory.path} className="directory-tree-node">
        <div
          className={`directory-item ${isBranch ? 'is-branch' : ''} ${isRoot ? 'is-root' : ''}`}
          style={{ '--directory-depth': depth }}
        >
          <div className="directory-info">
            <LuFolderOpen className="directory-icon" />
            <div className="directory-meta">
              <div className="directory-title-row">
                <span className="directory-name">{getPathLeaf(directory.path)}</span>
                {isBranch && <span className="directory-badge">Branch</span>}
                {isRoot && <span className="directory-badge is-root">Root</span>}
              </div>
              <span className="directory-path">{directory.path}</span>
              <span className="directory-stats">
                {stats.tracks} tracks · {formatDirectoryMinutes(stats.duration)}
                {isBranch ? ` · ${stats.affectedDirectories} directories` : ''}
              </span>
            </div>
          </div>
          <button
            className="settings-icon-btn danger"
            onClick={() => openDirectoryDeleteConfirm(directory)}
            title={isBranch ? 'Remove directory branch' : 'Remove directory'}
          >
            <LuTrash2 />
          </button>
        </div>

        {isBranch && (
          <div className="directory-children">
            {directory.children.map((child) => renderDirectoryNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="Settings">
      <nav className="settings-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
            aria-label={tab.label}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <div className="settings-content">
        {activeTab === 'library' && (
          <section className="settings-section settings-section--library">
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
              {directoryTree.map((directory) => renderDirectoryNode(directory))}
            </div>
          </section>
        )}

        {activeTab === 'colors' && (
          <section className="settings-section settings-section--colors">
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
          <section className="settings-section settings-section--background">
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
          <section className="settings-section settings-section--waveform">
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
                    ) : option.value === 'oscilloscope' ? (
                      <svg viewBox="0 0 100 40" preserveAspectRatio="none">
                        <path
                          d="M0,20 Q10,5 20,20 T40,20 T60,20 T80,20 T100,20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                      </svg>
                    ) : (
                      <>
                        <div className="simple-track" />
                        <div className="simple-progress" />
                        <div className="simple-thumb" />
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
      <ConfirmActionModal
        isVisible={Boolean(directoryDeleteTarget)}
        title={
          directoryDeleteTarget?.mode === 'branch'
            ? 'Remove directory branch?'
            : 'Remove directory?'
        }
        message={
          directoryDeleteTarget?.mode === 'branch'
            ? `This removes ${directoryDeleteTarget?.affectedDirectories || 0} directory registrations from Elevate, including all imported subdirectories under "${getPathLeaf(directoryDeleteTarget?.directory?.path)}". Your files and song stats will not be deleted.`
            : `This removes "${getPathLeaf(directoryDeleteTarget?.directory?.path)}" from Elevate. Your files and song stats will not be deleted.`
        }
        confirmLabel={
          directoryDeleteTarget?.mode === 'branch'
            ? 'Remove directory branch'
            : 'Remove directory'
        }
        onCancel={closeDirectoryDeleteConfirm}
        onConfirm={confirmDirectoryDelete}
      />
    </div>
  )
}

export default Settings
