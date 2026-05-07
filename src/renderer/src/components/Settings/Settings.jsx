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
  LuLibrary
} from 'react-icons/lu'
import { useSuper } from '../../Contexts/SupeContext'
import { useMini } from '../../Contexts/MiniContext'
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

  const [activeTab, setActiveTab] = useState('library')
  const [imageUrl, setImageUrl] = useState(null)

  useEffect(() => {
    getDirectories()
  }, [])

  const handleUrlChange = (event) => {
    const newUrl = event.target.value
    setImageUrl(newUrl)
    localStorage.setItem('bannerImageUrl', newUrl)
  }

  const handleBackgroundChange = (event) => {
    const newUrl = event.target.value
    handleBackgroundImageUrlChange(newUrl)
  }

  useEffect(() => {
    const savedImageUrl = localStorage.getItem('bannerImageUrl')
    if (savedImageUrl) {
      setImageUrl(savedImageUrl)
    } else {
      setImageUrl(
        'https://i.pinimg.com/originals/65/ff/25/65ff25ffbe3786b2de094f7051bbd873.gif'
      )
    }
  }, [])

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
              onClick={addDirectory}
              disabled={directoriesLoading}
            >
              <LuFolderPlus />
              <span>Add Folder</span>
            </button>

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
              <label>Banner Image URL</label>
              <div className="input-row">
                <input
                  type="text"
                  value={imageUrl || ''}
                  onChange={handleUrlChange}
                  placeholder="https://example.com/image.jpg"
                  className="settings-input"
                />
                <button
                  className="settings-icon-btn danger"
                  onClick={() => handleUrlChange({ target: { value: '' } })}
                  title="Clear"
                >
                  <LuTrash2 />
                </button>
              </div>
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
              <label>Background Image URL</label>
              <div className="input-row">
                <input
                  type="text"
                  value={backgroundImageUrl || ''}
                  onChange={handleBackgroundChange}
                  placeholder="https://example.com/background.jpg"
                  className="settings-input"
                />
                <button
                  className="settings-icon-btn danger"
                  onClick={() => handleBackgroundImageUrlChange('')}
                  title="Clear"
                >
                  <LuTrash2 />
                </button>
              </div>
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
