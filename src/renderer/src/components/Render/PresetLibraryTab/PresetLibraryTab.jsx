import React, { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { FixedSizeList } from 'react-window'
import { LuCheck, LuHeart, LuList, LuMusic, LuSearch } from 'react-icons/lu'
import {
  createPresetByNameMap,
  mapPresetNamesToItems,
  UseViz
} from '../../../Contexts/VisualizerContext'
import './PresetLibraryTab.scss'

const PRESET_ROW_HEIGHT = 58
const PRESET_OVERSCAN = 8
const DEFAULT_LIST_HEIGHT = 280

const VirtualizedPresetRow = memo(function VirtualizedPresetRow({ index, style, data }) {
  const preset = data.items[index]

  if (!preset) {
    return null
  }

  return data.renderRow(preset, index, style)
})

function VirtualizedPresetPane({ className, items, renderRow, itemKey }) {
  const containerRef = useRef(null)
  const [height, setHeight] = useState(DEFAULT_LIST_HEIGHT)

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return undefined
    }

    const updateHeight = () => {
      const nextHeight = Math.max(container.clientHeight || 0, DEFAULT_LIST_HEIGHT)
      setHeight((currentHeight) => (currentHeight === nextHeight ? currentHeight : nextHeight))
    }

    updateHeight()

    if (typeof window.ResizeObserver !== 'function') {
      window.addEventListener('resize', updateHeight)
      return () => window.removeEventListener('resize', updateHeight)
    }

    const resizeObserver = new window.ResizeObserver(updateHeight)
    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [])

  const itemData = useMemo(
    () => ({
      items,
      renderRow
    }),
    [items, renderRow]
  )

  return (
    <div ref={containerRef} className={className}>
      <FixedSizeList
        height={height}
        itemCount={items.length}
        itemData={itemData}
        itemKey={(index, data) => itemKey(data.items[index], index)}
        itemSize={PRESET_ROW_HEIGHT}
        overscanCount={PRESET_OVERSCAN}
        width="100%"
      >
        {VirtualizedPresetRow}
      </FixedSizeList>
    </div>
  )
}

function PresetLibraryTab() {
  const {
    allPresetItems,
    currentPresetName,
    activePresetList,
    presetLists,
    presetSource,
    toggleFavorite,
    setPresetByName,
    togglePresetInList
  } = UseViz()

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

  const renderSelectedPresetRow = useMemo(
    () => (preset, index, style) => (
      <div
        style={style}
        className={`preset-item ${currentPresetName === preset.name ? 'active' : ''}`}
        onClick={() => setPresetByName(preset.name)}
      >
        <div className="preset-info">
          <span className="preset-index">{index + 1}</span>
          <LuMusic className="preset-icon" />
          <span className="preset-name">{preset.name}</span>
        </div>
        <div className="preset-actions">
          <button
            className="list-toggle-btn selected"
            onClick={(event) => {
              event.stopPropagation()
              togglePresetInList(selectedList.id, preset.name)
            }}
            title="Quitar de la lista"
          >
            Quitar
          </button>
          <button
            className={`favorite-btn ${preset.isFavorite ? 'favorited' : ''}`}
            onClick={(event) => {
              event.stopPropagation()
              toggleFavorite(preset.name)
            }}
            title={preset.isFavorite ? 'Quitar favorito' : 'Marcar favorito'}
          >
            <LuHeart fill={preset.isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
    ),
    [currentPresetName, selectedList?.id, setPresetByName, toggleFavorite, togglePresetInList]
  )

  const renderCatalogPresetRow = useMemo(
    () => (preset, index, style) => {
      const isIncluded = selectedPresetNamesSet.has(preset.name)

      return (
        <div
          style={style}
          className={`preset-item preset-item--catalog ${currentPresetName === preset.name ? 'active' : ''}`}
          onClick={() => setPresetByName(preset.name)}
        >
          <div className="preset-info">
            <span className="preset-index muted">{index + 1}</span>
            <LuMusic className="preset-icon" />
            <span className="preset-name">{preset.name}</span>
          </div>
          <div className="preset-actions">
            <button
              className={`list-toggle-btn ${isIncluded ? 'selected' : ''}`}
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
              className={`favorite-btn ${preset.isFavorite ? 'favorited' : ''}`}
              onClick={(event) => {
                event.stopPropagation()
                toggleFavorite(preset.name)
              }}
              title={preset.isFavorite ? 'Quitar favorito' : 'Marcar favorito'}
            >
              <LuHeart fill={preset.isFavorite ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>
      )
    },
    [
      currentPresetName,
      selectedList?.id,
      selectedPresetNamesSet,
      setPresetByName,
      toggleFavorite,
      togglePresetInList
    ]
  )

  return (
    <section className="preset-tab-view preset-library-tab">
      <div className="preset-library-toolbar">
        <label className="catalog-search catalog-search--full">
          <LuSearch />
          <input
            type="text"
            value={catalogQuery}
            placeholder="Search Preset"
            onChange={(event) => setCatalogQuery(event.target.value)}
          />
        </label>
      </div>

      <div className="preset-manager-columns preset-manager-columns--library">
        <section className="preset-column">
          <div className="preset-column__header">
            <div>
              <span className="preset-column__eyebrow">Selected List</span>
              <h3>{selectedList?.name || 'Sin lista'}</h3>
              <span>{selectedPresetItems.length} presets guardados</span>
            </div>
            <div className="preset-column__meta">
              {hasSelectedList ? <LuCheck /> : <LuList />}
              <span>{hasSelectedList ? 'Lista activa' : 'Selecciona una preset list'}</span>
            </div>
          </div>

          {!hasSelectedList ? (
            <div className="empty-state empty-state--compact">
              <LuList className="empty-icon" />
              <p>No hay preset list seleccionada.</p>
              <small>Elige una lista en List Manager para empezar a curar presets aqui.</small>
            </div>
          ) : selectedPresetItems.length === 0 ? (
            <div className="empty-state empty-state--compact">
              <LuMusic className="empty-icon" />
              <p>Esta lista todavia no tiene presets.</p>
              <small>Agrega presets desde la biblioteca para poblarla.</small>
            </div>
          ) : (
            <VirtualizedPresetPane
              className="preset-virtual-list"
              items={selectedPresetItems}
              itemKey={(preset) => preset.id}
              renderRow={renderSelectedPresetRow}
            />
          )}
        </section>

        <section className="preset-column">
          <div className="preset-column__header">
            <div>
              <span className="preset-column__eyebrow">All preset list</span>
              <h3>Preset Library</h3>
              <span>{availableCatalogItems.length} presets disponibles</span>
            </div>
          </div>

          {availableCatalogItems.length === 0 ? (
            <div className="empty-state empty-state--compact">
              <LuSearch className="empty-icon" />
              <p>No hay presets para esa busqueda.</p>
            </div>
          ) : (
            <VirtualizedPresetPane
              className="preset-virtual-list"
              items={availableCatalogItems}
              itemKey={(preset) => `catalog-${preset.id}`}
              renderRow={renderCatalogPresetRow}
            />
          )}
        </section>
      </div>
    </section>
  )
}

export default PresetLibraryTab
