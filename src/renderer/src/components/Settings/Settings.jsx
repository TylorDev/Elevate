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
  LuListMusic
} from 'react-icons/lu'
import { useSuper } from '../../Contexts/SupeContext'
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

function Settings() {
  const {
    color,
    handleColorChange,
    backgroundImageUrl,
    handleBackgroundImageUrlChange,
    waveformVariant,
    handleWaveformVariantChange
  } = useSuper()

  const { directories, getDirectories, addDirectory, deleteDirectory, directoriesLoading } = useMini()
  const { openM3U } = usePlaylists()

  const [activeTab, setActiveTab] = useState('library')
  const [imageUrl, setImageUrl] = useState(null)

  // New state for image validation
  const [bannerDraft, setBannerDraft] = useState('')
  const [isBannerValidating, setIsBannerValidating] = useState(false)
  const [bannerError, setBannerError] = useState(null)
  const [bannerSuccess, setBannerSuccess] = useState(null)

  const [bgDraft, setBgDraft] = useState('')
  const [isBgValidating, setIsBgValidating] = useState(false)
  const [bgError, setBgError] = useState(null)
  const [bgSuccess, setBgSuccess] = useState(null)

  useEffect(() => {
    getDirectories()
  }, [])

  useEffect(() => {
    const savedImageUrl = localStorage.getItem('bannerImageUrl')
    if (savedImageUrl) {
      setImageUrl(savedImageUrl)
      if (!savedImageUrl.startsWith('data:')) {
        setBannerDraft(savedImageUrl)
      }
    } else {
      const defaultUrl = 'https://i.pinimg.com/originals/65/ff/25/65ff25ffbe3786b2de094f7051bbd873.gif'
      setImageUrl(defaultUrl)
      setBannerDraft(defaultUrl)
    }
  }, [])

  useEffect(() => {
    if (backgroundImageUrl && !backgroundImageUrl.startsWith('data:')) {
      setBgDraft(backgroundImageUrl)
    }
  }, [backgroundImageUrl])

  const validateAndApplyImage = async (type, url) => {
    if (!url) return

    const setIsValidating = type === 'banner' ? setIsBannerValidating : setIsBgValidating
    const setError = type === 'banner' ? setBannerError : setBgError
    const setSuccess = type === 'banner' ? setBannerSuccess : setBgSuccess
    const setFinalUrl = type === 'banner' ? setImageUrl : handleBackgroundImageUrlChange

    setIsValidating(true)
    setError(null)
    setSuccess(null)

    // Check for base64 data URL
    if (url.startsWith('data:')) {
      if (url.includes(';base64,')) {
        setFinalUrl(url)
        if (type === 'banner') {
          localStorage.setItem('bannerImageUrl', url)
        }
        setSuccess('Imagen base64 aplicada')
        setIsValidating(false)
        return
      } else {
        setError('Formato Base64 inválido')
        setIsValidating(false)
        return
      }
    }

    try {
      const result = await window.electron.imageSources.validateRemote(url)
      if (result.success) {
        setFinalUrl(result.resolvedUrl)
        if (type === 'banner') {
          localStorage.setItem('bannerImageUrl', result.resolvedUrl)
        }
        setSuccess('Imagen cargada con éxito')
      } else {
        setError(result.errorMessage)
      }
    } catch (err) {
      console.error('Error validating image:', err)
      setError('Error al validar la imagen')
    } finally {
      setIsValidating(false)
    }
  }

  const pickLocalImage = async (type) => {
    const setError = type === 'banner' ? setBannerError : setBgError
    const setSuccess = type === 'banner' ? setBannerSuccess : setBgSuccess
    const setFinalUrl = type === 'banner' ? setImageUrl : handleBackgroundImageUrlChange

    setError(null)
    setSuccess(null)

    try {
      const result = await window.electron.imageSources.pickLocal()
      if (result.success) {
        setFinalUrl(result.resolvedUrl)
        if (type === 'banner') {
          localStorage.setItem('bannerImageUrl', result.resolvedUrl)
          setBannerDraft(result.filePath || '')
        } else {
          setBgDraft(result.filePath || '')
        }
        setSuccess('Imagen cargada con éxito')
      } else if (result.errorCode !== 'canceled') {
        setError(result.errorMessage)
      }
    } catch (err) {
      console.error('Error picking local image:', err)
      setError('Error al seleccionar la imagen')
    }
  }

  const clearImage = (type) => {
    if (type === 'banner') {
      setImageUrl('')
      setBannerDraft('')
      setBannerError(null)
      setBannerSuccess(null)
      localStorage.removeItem('bannerImageUrl')
    } else {
      handleBackgroundImageUrlChange('')
      setBgDraft('')
      setBgError(null)
      setBgSuccess(null)
    }
  }

  return (
    <div className="Settings">
      <div className="settings-header">
        <h1>Settings</h1>
      </div>

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
                <p>
                  Import an existing `.m3u` file and add it to your playlists library.
                </p>
              </div>
              <button
                className="settings-action-btn"
                onClick={() => openM3U()}
              >
                <LuListMusic />
                <span>Import M3U</span>
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
                        {dir.totalTracks ?? '—'} tracks · {dir.totalDuration ? `${Math.floor(dir.totalDuration / 60)} min` : '—'}
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
              <span className="color-badge" style={{ background: color || 'var(--text-principal)' }}>
                {color || 'Auto'}
              </span>
            </div>

            <div className="color-picker-wrapper">
              <HexColorPicker color={color || '#baff00'} onChange={handleColorChange} />
            </div>

            <button
              className="settings-action-btn"
              onClick={() => handleColorChange('')}
            >
              <LuSparkles />
              <span>Auto cover color</span>
            </button>

            <div className="input-group">
              <label>Banner Image</label>
              <div className="input-row">
                <input
                  type="text"
                  value={bannerDraft}
                  onChange={(e) => setBannerDraft(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="settings-input"
                />
                <button
                  className="settings-action-btn s-btn"
                  onClick={() => validateAndApplyImage('banner', bannerDraft)}
                  disabled={isBannerValidating}
                >
                  {isBannerValidating ? '...' : 'Apply'}
                </button>
                <button
                  className="settings-action-btn s-btn"
                  onClick={() => pickLocalImage('banner')}
                >
                  <LuImage />
                  <span>Local</span>
                </button>
                <button
                  className="settings-icon-btn danger"
                  onClick={() => clearImage('banner')}
                  title="Clear"
                >
                  <LuTrash2 />
                </button>
              </div>
              {bannerError && <span className="settings-error">{bannerError}</span>}
              {bannerSuccess && <span className="settings-success">{bannerSuccess}</span>}
            </div>

            {imageUrl && (
              <div className="image-preview">
                <img src={imageUrl} alt="Banner preview" />
              </div>
            )}
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
                  onChange={(e) => setBgDraft(e.target.value)}
                  placeholder="https://example.com/background.jpg"
                  className="settings-input"
                />
                <button
                  className="settings-action-btn s-btn"
                  onClick={() => validateAndApplyImage('background', bgDraft)}
                  disabled={isBgValidating}
                >
                  {isBgValidating ? '...' : 'Apply'}
                </button>
                <button
                  className="settings-action-btn s-btn"
                  onClick={() => pickLocalImage('background')}
                >
                  <LuImage />
                  <span>Local</span>
                </button>
                <button
                  className="settings-icon-btn danger"
                  onClick={() => clearImage('background')}
                  title="Clear"
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
                        <span className="waveform-check"><LuCheck /></span>
                      )}
                    </div>
                    <span className="waveform-option-desc">{option.description}</span>
                  </div>
                  <div className={`waveform-visual waveform-visual--${option.value}`}>
                    {option.value === 'mirrored'
                      ? [...Array(12)].map((_, i) => (
                          <div
                            key={i}
                            className="bar"
                            style={{
                              height: `${20 + Math.sin(i * 0.8) * 60}%`,
                              animationDelay: `${i * 0.05}s`
                            }}
                          />
                        ))
                      : (
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
