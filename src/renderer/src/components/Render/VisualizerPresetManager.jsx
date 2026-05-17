import React, { useState } from 'react'
import { LuX } from 'react-icons/lu'
import { getSourceLabel, UseViz } from '../../Contexts/VisualizerContext'
import ControllerTab from './ControllerTab/ControllerTab'
import ListManagerTab from './ListManagerTab/ListManagerTab'
import PresetLibraryTab from './PresetLibraryTab/PresetLibraryTab'
import './VisualizerPresetManager.scss'

const TAB_OPTIONS = [
  { id: 'controller', label: 'Controller' },
  { id: 'list-manager', label: 'List Manager' },
  { id: 'preset-library', label: 'Preset Library' }
]

const VisualizerPresetManager = ({ isPage = false, onClose }) => {
  const { currentPresetName, activePlaybackSource } = UseViz()

  const [activeTab, setActiveTab] = useState('controller')

  const sourceLabel = getSourceLabel(activePlaybackSource)

  const renderActiveTab = () => {
    if (activeTab === 'list-manager') {
      return <ListManagerTab />
    }

    if (activeTab === 'preset-library') {
      return <PresetLibraryTab />
    }

    return <ControllerTab />
  }

  return (
    <div
      className={isPage ? 'preset-manager-page' : 'preset-manager-overlay'}
      onClick={isPage ? undefined : onClose}
    >
      <div
        className={`preset-manager-panel ${isPage ? 'preset-manager-panel--page' : ''}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="preset-manager-header">
          <div className="preset-manager-header__status">
            <div className="source-summary">
              <div className="source-summary__item">
                <span>Fuente activa</span>
                <strong>{sourceLabel}</strong>
              </div>
            </div>
            <div className="preset-manager-header__status-card">
              <span>Preset activo</span>
              <strong>{currentPresetName || 'Sin seleccion'}</strong>
            </div>
            <button className="close-btn" onClick={onClose} aria-label="Cerrar administrador">
              <LuX />
            </button>
          </div>
        </header>

        <section className="preset-manager-tabs" aria-label="Preset manager tabs">
          {TAB_OPTIONS.map((tab) => (
            <button
              key={tab.id}
              className={`preset-tab-trigger ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </section>

        <section className="preset-manager-workbench preset-manager-workbench--tabs">
          {renderActiveTab()}
        </section>
      </div>
    </div>
  )
}

export default VisualizerPresetManager
