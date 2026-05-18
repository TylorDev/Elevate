import React from 'react'
import { LuList, LuClock, LuShuffle } from 'react-icons/lu'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import EmptyState from '../InternalComponents/EmptyState'
import PresetRow from '../InternalComponents/PresetRow'
import TabCard from '../InternalComponents/TabCard'
import {
  useVisualizerPlayback,
  useVisualizerSettingsActions,
  useVisualizerSources
} from '../useVisualizerPresets'
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
  const { allPresets, currentPresetName, isShuffled, toggleShuffle } = useVisualizerPlayback()
  const { cycleDurationMs, presetLists, presetSource } = useVisualizerSources()
  const { setCycleDurationMs, setPresetSource } = useVisualizerSettingsActions()

  const currentSourceMode = presetSource?.mode || 'all'
  const presetListOptions = [
    { value: '', label: 'Selecciona una lista' },
    ...presetLists.map((list) => ({
      value: list.id,
      label: list.name
    }))
  ]

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
    <section className="controller-tab">
      <div className="controller-tab__grid">
        <TabCard
          className="controller-tab__card controller-tab__card--source"
          eyebrow="Source"
          icon={LuList}
          title="Preset source"
          description="Choose where the cycle pulls presets from."
        >
          <div className="controller-tab__stack">
            <label className="controller-tab__field">
              <span className="controller-tab__label">Mode</span>
              <Select
                items={PRESET_SOURCE_OPTIONS}
                onValueChange={handlePresetSourceModeChange}
                value={currentSourceMode}
              >
                <SelectTrigger aria-label="Preset source mode" className="controller-tab__select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {PRESET_SOURCE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>

            {currentSourceMode === 'list' && (
              <label className="controller-tab__field">
                <span className="controller-tab__label">List</span>
                <Select
                  items={presetListOptions}
                  onValueChange={handlePresetSourceListChange}
                  value={presetSource?.listId || ''}
                >
                  <SelectTrigger aria-label="Preset source list" className="controller-tab__select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {presetListOptions.map((option) => (
                        <SelectItem key={option.value || 'empty'} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </label>
            )}
          </div>
        </TabCard>

        <TabCard
          className="controller-tab__card controller-tab__card--active-list"
          eyebrow="Current Queue"
          icon={LuList}
          title="Active presets"
          description={`${allPresets.length} preset${allPresets.length === 1 ? '' : 's'} available in the current cycle.`}
        >
          <div className="controller-tab__preset-list">
            {allPresets.length === 0 ? (
              <EmptyState title="No hay presets activos." icon={null} />
            ) : (
              <div className="controller-tab__preset-rows">
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

        <TabCard
          className="controller-tab__card controller-tab__card--timing"
          eyebrow="Cycle"
          icon={LuClock}
          title="Cycle interval"
          description="Control how long each preset stays on screen."
        >
          <div className="controller-tab__stack">
            <label className="controller-tab__field">
              <span className="controller-tab__label">Duration</span>
              <Select
                items={DURATION_OPTIONS}
                onValueChange={(value) => setCycleDurationMs(Number(value))}
                value={cycleDurationMs}
              >
                <SelectTrigger aria-label="Cycle duration" className="controller-tab__select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {DURATION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>
            <p className="controller-tab__hint">
              Current rotation updates every {Math.round(cycleDurationMs / 1000)} seconds.
            </p>
          </div>
        </TabCard>

        <TabCard
          className="controller-tab__card controller-tab__card--shuffle"
          eyebrow="Playback"
          icon={LuShuffle}
          title="Shuffle"
          description="Randomize the order of the presets in the active cycle."
        >
          <button
            aria-pressed={isShuffled}
            className={`controller-tab__toggle ${isShuffled ? 'is-active' : ''}`.trim()}
            onClick={toggleShuffle}
            type="button"
          >
            <span className="controller-tab__toggle-copy">
              <strong>{isShuffled ? 'Shuffle ON' : 'Shuffle OFF'}</strong>
              <small>{isShuffled ? 'Random order enabled' : 'Playing in listed order'}</small>
            </span>
            <span className="controller-tab__toggle-track" aria-hidden="true">
              <span className="controller-tab__toggle-thumb" />
            </span>
          </button>
        </TabCard>
      </div>
    </section>
  )
}

export default ControllerTab
