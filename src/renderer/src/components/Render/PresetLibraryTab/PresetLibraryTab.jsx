import React, { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { LuArrowLeft, LuCheck, LuHeart, LuList, LuMusic, LuSearch } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import Button from '../InternalComponents/Button'
import Card from '../InternalComponents/Card'
import EmptyState from '../InternalComponents/EmptyState'
import PresetList from '../InternalComponents/PresetList'
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
  const navigate = useNavigate()
  const { allPresetItems } = useVisualizerCatalog()
  const { toggleFavorite } = useVisualizerFavoriteActions()
  const { togglePresetInList } = useVisualizerListActions()
  const { currentPresetName, setPresetByName } = useVisualizerPlayback()
  const { activePresetList, presetLists, presetSource } = useVisualizerSources()

  const [selectedListId, setSelectedListId] = useState('')
  const [catalogQuery, setCatalogQuery] = useState('')
  const deferredCatalogQuery = useDeferredValue(catalogQuery)

  useEffect(() => {
    if (activePresetList?.id && presetLists.some((list) => list.id === activePresetList.id)) {
      setSelectedListId(activePresetList.id)
      return
    }

    if (presetSource?.mode === 'list' && presetSource?.listId) {
      const sourceListExists = presetLists.some((list) => list.id === presetSource.listId)
      setSelectedListId(sourceListExists ? presetSource.listId : '')
      return
    }

    setSelectedListId('')
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
        <Button
          className="preset-library-tab__back"
          onClick={() => navigate(-1)}
          type="button"
          variant="back"
        >
          <LuArrowLeft />
          <span>Back</span>
        </Button>
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
        <Card
          header={
            <div className="preset-library-tab__panel-header">
              <div className="preset-library-tab__panel-copy">
                <span className="preset-library-tab__eyebrow">Selected List</span>
                <h3>{selectedList?.name || 'Sin lista'}</h3>
                <span className="preset-library-tab__meta">
                  {selectedPresetItems.length} presets guardados
                </span>
              </div>
              <div
                className={`preset-library-tab__status ${hasSelectedList ? 'is-active' : ''}`.trim()}
              >
                {hasSelectedList ? <LuCheck /> : <LuList />}
                <span>{hasSelectedList ? 'Lista activa' : 'Selecciona una preset list'}</span>
              </div>
            </div>
          }
        >

          {!hasSelectedList ? (
            <EmptyState
              icon={LuList}
              title="No hay preset list seleccionada."
              description="Carga o crea una preset list activa para empezar a curar presets aqui."
            />
          ) : selectedPresetItems.length === 0 ? (
            <EmptyState
              icon={LuMusic}
              title="Esta lista todavia no tiene presets."
              description="Agrega presets desde la biblioteca para poblarla."
            />
          ) : (
            <PresetList
              activePresetName={currentPresetName}
              height={VIRTUAL_LIST_HEIGHT}
              itemHeight={PRESET_ROW_HEIGHT}
              itemKey={(preset, index) => preset?.id || index}
              items={selectedPresetItems}
              onSelectPreset={setPresetByName}
              renderActions={(preset) => (
                <>
                  <Button
                    onClick={(event) => {
                      event.stopPropagation()
                      togglePresetInList(selectedList.id, preset.name)
                    }}
                    title="Quitar de la lista"
                  >
                    Quitar
                  </Button>
                  <Button
                    className={preset.isFavorite ? 'preset-button--active' : ''}
                    onClick={(event) => {
                      event.stopPropagation()
                      toggleFavorite(preset.name)
                    }}
                    title={preset.isFavorite ? 'Quitar favorito' : 'Marcar favorito'}
                    variant="icon"
                  >
                    <LuHeart fill={preset.isFavorite ? 'currentColor' : 'none'} />
                  </Button>
                </>
              )}
            />
          )}
        </Card>

        <Card
          header={
            <div className="preset-library-tab__panel-header">
              <div className="preset-library-tab__panel-copy">
                <span className="preset-library-tab__eyebrow">Library</span>
                <h3>Preset Library</h3>
                <span className="preset-library-tab__meta">
                  {availableCatalogItems.length} presets disponibles
                </span>
              </div>
            </div>
          }
        >

          {availableCatalogItems.length === 0 ? (
            <EmptyState icon={LuSearch} title="No hay presets para esa busqueda." description="" />
          ) : (
            <PresetList
              activePresetName={currentPresetName}
              height={VIRTUAL_LIST_HEIGHT}
              indexMuted
              itemHeight={PRESET_ROW_HEIGHT}
              itemKey={(preset, index) => `catalog-${preset?.id || index}`}
              items={availableCatalogItems}
              onSelectPreset={setPresetByName}
              renderActions={(preset) => {
                const isIncluded = selectedPresetNamesSet.has(preset.name)

                return (
                  <>
                    <Button
                      disabled={!selectedList?.id || isIncluded}
                      onClick={(event) => {
                        event.stopPropagation()

                        if (!selectedList?.id || isIncluded) {
                          return
                        }

                        togglePresetInList(selectedList.id, preset.name)
                      }}
                      title={isIncluded ? 'Ya agregado a la lista' : 'Agregar a la lista'}
                    >
                      {isIncluded ? 'Agregado' : 'Agregar'}
                    </Button>
                    <Button
                      className={preset.isFavorite ? 'preset-button--active' : ''}
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleFavorite(preset.name)
                      }}
                      title={preset.isFavorite ? 'Quitar favorito' : 'Marcar favorito'}
                      variant="icon"
                    >
                      <LuHeart fill={preset.isFavorite ? 'currentColor' : 'none'} />
                    </Button>
                  </>
                )
              }}
            />
          )}
        </Card>
      </div>
    </section>
  )
}

export default PresetLibraryTab
