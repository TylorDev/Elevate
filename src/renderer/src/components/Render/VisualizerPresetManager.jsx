import React, { useState } from 'react'
import { LuX } from 'react-icons/lu'
import {
  getSourceLabel,
  useVisualizerPlayback,
  useVisualizerSources
} from './useVisualizerPresets'
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
  const { currentPresetName } = useVisualizerPlayback()
  const { activePlaybackSource } = useVisualizerSources()

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
    <div onClick={isPage ? undefined : onClose}>
      <div onClick={(event) => event.stopPropagation()}>
        <span>Fuente activa</span>
        <strong>{sourceLabel}</strong>
        <span>Preset activo</span>
        <strong>{currentPresetName || 'Sin seleccion'}</strong>
        <button onClick={onClose} aria-label="Cerrar administrador">
          <LuX />
        </button>

        <section aria-label="Preset manager tabs">
          {TAB_OPTIONS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} type="button">
              {tab.label}
            </button>
          ))}
        </section>

        <section>{renderActiveTab()}</section>
      </div>
    </div>
  )
}

export default VisualizerPresetManager
