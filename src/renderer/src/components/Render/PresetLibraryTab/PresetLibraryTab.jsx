import React, { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { FixedSizeList } from 'react-window'
import { LuCheck, LuHeart, LuList, LuMusic, LuSearch } from 'react-icons/lu'
import EmptyState from '../InternalComponents/EmptyState'
import PresetRow from '../InternalComponents/PresetRow'
import {
  createPresetByNameMap,
  mapPresetNamesToItems,
  useVisualizerCatalog,
  useVisualizerFavoriteActions,
  useVisualizerListActions,
  useVisualizerPlayback,
  useVisualizerSources
} from '../useVisualizerPresets'
import './PresetLibraryTab.scss'

const PRESET_ROW_HEIGHT = 58
const PRESET_OVERSCAN = 8
const VISIBLE_PRESET_ROWS = 5
const VIRTUAL_LIST_HEIGHT = PRESET_ROW_HEIGHT * VISIBLE_PRESET_ROWS

function PresetLibraryTab() {
  const { allPresetItems } = useVisualizerCatalog()
  const { toggleFavorite } = useVisualizerFavoriteActions()
  const { togglePresetInList } = useVisualizerListActions()
  const { currentPresetName, setPresetByName } = useVisualizerPlayback()
  const { activePresetList, presetLists, presetSource } = useVisualizerSources()

  const [selectedListId, setSelectedListId] = useState('')
  const [catalogQuery, setCatalogQuery] = useState('')
  const deferredCatalogQuery = useDeferredValue(catalogQuery)

  useEffect(() => {
    setSelectedListId((currentId) => {
      if (presetLists.some((list) => list.id === currentId)) {
        return currentId
      }

      if (presetSource?.mode === 'list' && presetSource?.listId) {
        const sourceListExists = presetLists.some((list) => list.id === presetSource.listId)
        if (sourceListExists) {
          return presetSource.listId
        }
      }

      if (activePresetList?.id && presetLists.some((list) => list.id === activePresetList.id)) {
        return activePresetList.id
      }

      return presetLists[0]?.id || ''
    })
  }, [activePresetList?.id, presetLists, presetSource?.listId, presetSource?.mode])

  const selectedList = useMemo(
    () => presetLists.find((list) => list.id === selectedListId) || null,
    [presetLists, selectedListId]
  )

  const presetByName = useMemo(() => createPresetByNameMap(allPresetItems), [allPresetItems])

  const selectedPresetItems = useMemo(
    () => mapPresetNamesToItems(selectedList?.presetNames || [], presetByName),
    [presetByName, selectedList?.presetNames]
  )

  const selectedPresetNamesSet = useMemo(
    () => new Set(selectedList?.presetNames || []),
    [selectedList?.presetNames]
  )

  const normalizedCatalogQuery = useMemo(
    () => deferredCatalogQuery.trim().toLowerCase(),
    [deferredCatalogQuery]
  )

  const availableCatalogItems = useMemo(() => {
    if (!normalizedCatalogQuery) {
      return allPresetItems
    }

    return allPresetItems.filter((preset) =>
      preset.name.toLowerCase().includes(normalizedCatalogQuery)
    )
  }, [allPresetItems, normalizedCatalogQuery])

  const hasSelectedList = Boolean(selectedList?.id)

  return (
    <section className="preset-library-tab">
      <div className="preset-library-tab__toolbar">
        <label className="preset-library-tab__search">
          <LuSearch />
          <input
            type="text"
            value={catalogQuery}
            placeholder="Search Preset"
            onChange={(event) => setCatalogQuery(event.target.value)}
          />
        </label>
      </div>

      <div className="preset-library-tab__grid">
        <section className="preset-library-tab__panel">
          <div className="preset-library-tab__panel-header">
            <div className="preset-library-tab__panel-copy">
              <span className="preset-library-tab__eyebrow">Selected List</span>
              <h3>{selectedList?.name || 'Sin lista'}</h3>
              <span className="preset-library-tab__meta">
                {selectedPresetItems.length} presets guardados
              </span>
            </div>
            <div className={`preset-library-tab__status ${hasSelectedList ? 'is-active' : ''}`.trim()}>
              {hasSelectedList ? <LuCheck /> : <LuList />}
              <span>{hasSelectedList ? 'Lista activa' : 'Selecciona una preset list'}</span>
            </div>
          </div>

          {!hasSelectedList ? (
            <EmptyState
              icon={LuList}
              title="No hay preset list seleccionada."
              description="Elige una lista en List Manager para empezar a curar presets aqui."
            />
          ) : selectedPresetItems.length === 0 ? (
            <EmptyState
              icon={LuMusic}
              title="Esta lista todavia no tiene presets."
              description="Agrega presets desde la biblioteca para poblarla."
            />
          ) : (
            <FixedSizeList
              height={VIRTUAL_LIST_HEIGHT}
              itemCount={selectedPresetItems.length}
              itemSize={PRESET_ROW_HEIGHT}
              itemKey={(index) => selectedPresetItems[index]?.id || index}
              overscanCount={PRESET_OVERSCAN}
              width="100%"
              className="preset-library-tab__virtual-list"
            >
              {({ index, style }) => {
                const preset = selectedPresetItems[index]

                if (!preset) {
                  return null
                }

                return (
                  <PresetRow
                    active={currentPresetName === preset.name}
                    actions={
                      <>
                        <button
                          className="preset-library-tab__action"
                          onClick={(event) => {
                            event.stopPropagation()
                            togglePresetInList(selectedList.id, preset.name)
                          }}
                          title="Quitar de la lista"
                        >
                          Quitar
                        </button>
                        <button
                          className={`preset-library-tab__icon-action ${preset.isFavorite ? 'is-active' : ''}`.trim()}
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleFavorite(preset.name)
                          }}
                          title={preset.isFavorite ? 'Quitar favorito' : 'Marcar favorito'}
                        >
                          <LuHeart fill={preset.isFavorite ? 'currentColor' : 'none'} />
                        </button>
                      </>
                    }
                    index={index}
                    name={preset.name}
                    onClick={() => setPresetByName(preset.name)}
                    style={style}
                  />
                )
              }}
            </FixedSizeList>
          )}
        </section>

        <section className="preset-library-tab__panel">
          <div className="preset-library-tab__panel-header">
            <div className="preset-library-tab__panel-copy">
              <span className="preset-library-tab__eyebrow">Library</span>
              <h3>Preset Library</h3>
              <span className="preset-library-tab__meta">
                {availableCatalogItems.length} presets disponibles
              </span>
            </div>
          </div>

          {availableCatalogItems.length === 0 ? (
            <EmptyState icon={LuSearch} title="No hay presets para esa busqueda." description="" />
          ) : (
            <FixedSizeList
              height={VIRTUAL_LIST_HEIGHT}
              itemCount={availableCatalogItems.length}
              itemSize={PRESET_ROW_HEIGHT}
              itemKey={(index) => `catalog-${availableCatalogItems[index]?.id || index}`}
              overscanCount={PRESET_OVERSCAN}
              width="100%"
              className="preset-library-tab__virtual-list"
            >
              {({ index, style }) => {
                const preset = availableCatalogItems[index]

                if (!preset) {
                  return null
                }

                const isIncluded = selectedPresetNamesSet.has(preset.name)

                return (
                  <PresetRow
                    active={currentPresetName === preset.name}
                    actions={
                      <>
                        <button
                          className="preset-library-tab__action"
                          onClick={(event) => {
                            event.stopPropagation()

                            if (!selectedList?.id || isIncluded) {
                              return
                            }

                            togglePresetInList(selectedList.id, preset.name)
                          }}
                          disabled={!selectedList?.id || isIncluded}
                          title={isIncluded ? 'Ya agregado a la lista' : 'Agregar a la lista'}
                        >
                          {isIncluded ? 'Agregado' : 'Agregar'}
                        </button>
                        <button
                          className={`preset-library-tab__icon-action ${preset.isFavorite ? 'is-active' : ''}`.trim()}
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleFavorite(preset.name)
                          }}
                          title={preset.isFavorite ? 'Quitar favorito' : 'Marcar favorito'}
                        >
                          <LuHeart fill={preset.isFavorite ? 'currentColor' : 'none'} />
                        </button>
                      </>
                    }
                    index={index}
                    indexMuted
                    name={preset.name}
                    onClick={() => setPresetByName(preset.name)}
                    style={style}
                  />
                )
              }}
            </FixedSizeList>
          )}
        </section>
      </div>
    </section>
  )
}

export default PresetLibraryTab
