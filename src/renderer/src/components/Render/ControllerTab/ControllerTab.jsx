import React from 'react'
import { LuList, LuClock, LuShuffle } from 'react-icons/lu'
import EmptyState from '../InternalComponents/EmptyState'
import PresetRow from '../InternalComponents/PresetRow'
import TabCard from '../InternalComponents/TabCard'
import { UseViz } from '../../../Contexts/VisualizerContext'
import './ControllerTab.scss'

const DURATION_OPTIONS = [
  { value: 5000, label: '5s' },
  { value: 10000, label: '10s' },
  { value: 15000, label: '15s' },
  { value: 30000, label: '30s' }
]

const PRESET_SOURCE_OPTIONS = [
  { value: 'all', label: 'All presets' },
  { value: 'list', label: 'Specific List' },
  { value: 'favorites', label: 'Favourites' }
]

const ControllerTab = () => {
  const {
    allPresets,
    currentPresetName,
    cycleDurationMs,
    isShuffled,
    presetLists,
    presetSource,
    setCycleDurationMs,
    setPresetSource,
    toggleShuffle
  } = UseViz()

  const currentSourceMode = presetSource?.mode || 'all'

  const handlePresetSourceModeChange = (nextMode) => {
    if (nextMode === 'list') {
      setPresetSource({
        mode: 'list',
        listId: presetSource?.listId || presetLists[0]?.id || null
      })
      return
    }

    setPresetSource({
      mode: nextMode,
      listId: null
    })
  }

  const handlePresetSourceListChange = (listId) => {
    setPresetSource({
      mode: 'list',
      listId: listId || null
    })
  }

  return (
    <section>
      <div>
        <TabCard eyebrow="Current List" icon={LuList}>
          <div>
            <select
              value={currentSourceMode}
              onChange={(event) => handlePresetSourceModeChange(event.target.value)}
            >
              {PRESET_SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {currentSourceMode === 'list' && (
              <select
                value={presetSource?.listId || ''}
                onChange={(event) => handlePresetSourceListChange(event.target.value)}
              >
                <option value="">Selecciona una lista</option>
                {presetLists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </TabCard>

        <TabCard eyebrow="Current List (Temp)" icon={LuList}>
          <div>
            {allPresets.length === 0 ? (
              <EmptyState title="No hay presets activos." icon={null} />
            ) : (
              <div>
                {allPresets.map((presetName, index) => {
                  const isActive = currentPresetName === presetName
                  return (
                    <PresetRow
                      active={isActive}
                      index={index}
                      isStatic
                      key={`${presetName}-${index}`}
                      name={presetName}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </TabCard>

        <TabCard eyebrow="Selector de ciclo" icon={LuClock}>
          <select
            value={String(cycleDurationMs)}
            onChange={(event) => setCycleDurationMs(Number(event.target.value))}
          >
            {DURATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </TabCard>

        <TabCard eyebrow="Shuffle" icon={LuShuffle}>
          <button
            onClick={toggleShuffle}
            type="button"
          >
            <span>
              <span />
            </span>
            <span>{isShuffled ? 'Shuffle ON' : 'Shuffle OFF'}</span>
          </button>
        </TabCard>
      </div>
    </section>
  )
}

export default ControllerTab
