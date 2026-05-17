import React, { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { FixedSizeList } from 'react-window';
import {
  LuCheck,
  LuClock,
  LuFolder,
  LuHeart,
  LuLink,
  LuList,
  LuMusic,
  LuPencil,
  LuPlus,
  LuSearch,
  LuShuffle,
  LuTrash2,
  LuUnlink,
  LuX
} from 'react-icons/lu';
import {
  createPresetByNameMap,
  getSourceLabel,
  mapPresetNamesToItems
} from './useVisualizerPresets';
import ControllerTab from './ControllerTab/ControllerTab';
import './VisualizerPresetManager.scss';
const DURATION_OPTIONS = [
  { value: 5000, label: '5s' },
  { value: 10000, label: '10s' },
  { value: 15000, label: '15s' },
  { value: 30000, label: '30s' }
];

const TAB_OPTIONS = [
  { id: 'controller', label: 'Controller' },
  { id: 'list-manager', label: 'List Manager' },
  { id: 'preset-library', label: 'Preset Library' }
];

const PRESET_SOURCE_OPTIONS = [
  { value: 'all', label: 'All presets' },
  { value: 'list', label: 'Specific List' },
  { value: 'favorites', label: 'Favourites' }
];

const PRESET_ROW_HEIGHT = 58;
const PRESET_OVERSCAN = 8;
const DEFAULT_LIST_HEIGHT = 280;

const VirtualizedPresetRow = memo(function VirtualizedPresetRow({ index, style, data }) {
  const preset = data.items[index];

  if (!preset) {
    return null;
  }

  return data.renderRow(preset, index, style);
});

function VirtualizedPresetPane({ className, items, renderRow, itemKey }) {
  const containerRef = useRef(null);
  const [height, setHeight] = useState(DEFAULT_LIST_HEIGHT);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return undefined;
    }

    const updateHeight = () => {
      const nextHeight = Math.max(container.clientHeight || 0, DEFAULT_LIST_HEIGHT);
      setHeight((currentHeight) => (currentHeight === nextHeight ? currentHeight : nextHeight));
    };

    updateHeight();

    if (typeof window.ResizeObserver !== 'function') {
      window.addEventListener('resize', updateHeight);
      return () => window.removeEventListener('resize', updateHeight);
    }

    const resizeObserver = new window.ResizeObserver(updateHeight);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  const itemData = useMemo(
    () => ({
      items,
      renderRow
    }),
    [items, renderRow]
  );

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
  );
}

const VisualizerPresetManager = ({
  isPage = false,
  onClose,
  allPresetItems = [],
  currentPresetName,
  cycleDurationMs,
  setCycleDurationMs,
  isShuffled,
  toggleShuffle,
  allPresets = [],
  presetSource,
  setPresetSource,
  toggleFavorite,
  presetLists = [],
  activePresetList,
  activePlaybackSource,
  sourceAssociations = {},
  createPresetList,
  renamePresetList,
  deletePresetList,
  togglePresetInList,
  associateActiveSource,
  associateSourceToList,
  removeActiveSourceAssociation,
  removeSourceAssociation,
  availableAssociationSources = [],
  onSelectPreset
}) => {
  const [activeTab, setActiveTab] = useState('controller');
  const [newListName, setNewListName] = useState('');
  const [selectedListId, setSelectedListId] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [manualSourceKey, setManualSourceKey] = useState('');
  const deferredCatalogQuery = useDeferredValue(catalogQuery);

  useEffect(() => {
    setSelectedListId((currentId) => {
      if (presetLists.some((list) => list.id === currentId)) {
        return currentId;
      }

      if (presetSource?.mode === 'list' && presetSource?.listId) {
        const sourceListExists = presetLists.some((list) => list.id === presetSource.listId);
        if (sourceListExists) {
          return presetSource.listId;
        }
      }

      if (activePresetList?.id && presetLists.some((list) => list.id === activePresetList.id)) {
        return activePresetList.id;
      }

      return presetLists[0]?.id || '';
    });
  }, [activePresetList?.id, presetLists, presetSource?.listId, presetSource?.mode]);

  const selectedList = useMemo(
    () => presetLists.find((list) => list.id === selectedListId) || null,
    [presetLists, selectedListId]
  );

  useEffect(() => {
    setRenameValue(selectedList?.name || '');
  }, [selectedList?.id, selectedList?.name]);

  const presetByName = useMemo(() => createPresetByNameMap(allPresetItems), [allPresetItems]);
  const selectedPresetItems = useMemo(
    () => mapPresetNamesToItems(selectedList?.presetNames || [], presetByName),
    [presetByName, selectedList?.presetNames]
  );
  const selectedPresetNamesSet = useMemo(
    () => new Set(selectedList?.presetNames || []),
    [selectedList?.presetNames]
  );

  const normalizedCatalogQuery = useMemo(
    () => deferredCatalogQuery.trim().toLowerCase(),
    [deferredCatalogQuery]
  );

  const availableCatalogItems = useMemo(() => {
    if (!normalizedCatalogQuery) {
      return allPresetItems;
    }

    return allPresetItems.filter((preset) =>
      preset.name.toLowerCase().includes(normalizedCatalogQuery)
    );
  }, [allPresetItems, normalizedCatalogQuery]);

  const sourceLabel = getSourceLabel(activePlaybackSource);
  const hasActiveSource = Boolean(activePlaybackSource?.type && activePlaybackSource?.id);
  const hasSelectedList = Boolean(selectedList?.id);
  const activeAssociationName = activePresetList?.name || 'Sin vinculacion';
  const totalAssociations = Object.keys(sourceAssociations).length;
  const selectedListDisplayName = selectedList?.name || 'Ninguna lista seleccionada';
  const currentSourceMode = presetSource?.mode || 'all';

  const normalizedAssociationSources = useMemo(
    () =>
      availableAssociationSources.map((source) => ({
        ...source,
        sourceKey: source.sourceKey || `${source.type}:${source.id}`
      })),
    [availableAssociationSources]
  );

  const manualSource = useMemo(
    () =>
      normalizedAssociationSources.find((source) => source.sourceKey === manualSourceKey) || null,
    [manualSourceKey, normalizedAssociationSources]
  );

  const manualAssociationListName = useMemo(() => {
    const linkedListId = sourceAssociations[manualSourceKey];
    return presetLists.find((list) => list.id === linkedListId)?.name || 'Sin vinculacion';
  }, [manualSourceKey, presetLists, sourceAssociations]);

  useEffect(() => {
    setManualSourceKey((currentKey) => {
      if (normalizedAssociationSources.some((source) => source.sourceKey === currentKey)) {
        return currentKey;
      }

      if (activePlaybackSource?.type && activePlaybackSource?.id) {
        return `${activePlaybackSource.type}:${activePlaybackSource.id}`;
      }

      return normalizedAssociationSources[0]?.sourceKey || '';
    });
  }, [activePlaybackSource?.id, activePlaybackSource?.type, normalizedAssociationSources]);


  const handleCreateList = () => {
    const createdList = createPresetList?.(newListName);

    if (createdList?.id) {
      setSelectedListId(createdList.id);
      setNewListName('');
    }
  };

  const handleManualAssociate = () => {
    if (!manualSource || !selectedList?.id) {
      return;
    }

    associateSourceToList?.(
      {
        type: manualSource.type,
        id: manualSource.id
      },
      selectedList.id
    );
  };

  const handleManualRemoveAssociation = () => {
    if (!manualSource) {
      return;
    }

    removeSourceAssociation?.({
      type: manualSource.type,
      id: manualSource.id
    });
  };

  const handleRenameList = () => {
    if (!selectedList?.id) {
      return;
    }

    renamePresetList?.(selectedList.id, renameValue);
  };

  const handleDeleteList = () => {
    if (!selectedList?.id) {
      return;
    }

    deletePresetList?.(selectedList.id);
  };

  const handlePresetSourceModeChange = (nextMode) => {
    if (nextMode === 'list') {
      setPresetSource?.({
        mode: 'list',
        listId: selectedList?.id || presetLists[0]?.id || null
      });
      return;
    }

    setPresetSource?.({
      mode: nextMode,
      listId: null
    });
  };

  const handlePresetSourceListChange = (listId) => {
    setSelectedListId(listId);
    setPresetSource?.({
      mode: 'list',
      listId: listId || null
    });
  };

  const renderSelectedPresetRow = useMemo(
    () => (preset, index, style) => (
      <div
        style={style}
        className={`preset-item ${currentPresetName === preset.name ? 'active' : ''}`}
        onClick={() => onSelectPreset(preset.name)}
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
              event.stopPropagation();
              togglePresetInList?.(selectedList.id, preset.name);
            }}
            title="Quitar de la lista"
          >
            Quitar
          </button>
          <button
            className={`favorite-btn ${preset.isFavorite ? 'favorited' : ''}`}
            onClick={(event) => {
              event.stopPropagation();
              toggleFavorite(preset.name);
            }}
            title={preset.isFavorite ? 'Quitar favorito' : 'Marcar favorito'}
          >
            <LuHeart fill={preset.isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
    ),
    [currentPresetName, onSelectPreset, selectedList?.id, toggleFavorite, togglePresetInList]
  );

  const renderCatalogPresetRow = useMemo(
    () => (preset, index, style) => {
      const isIncluded = selectedPresetNamesSet.has(preset.name);

      return (
        <div
          style={style}
          className={`preset-item preset-item--catalog ${currentPresetName === preset.name ? 'active' : ''}`}
          onClick={() => onSelectPreset(preset.name)}
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
                event.stopPropagation();

                if (!selectedList?.id || isIncluded) {
                  return;
                }

                togglePresetInList?.(selectedList.id, preset.name);
              }}
              disabled={!selectedList?.id || isIncluded}
              title={isIncluded ? 'Ya agregado a la lista' : 'Agregar a la lista'}
            >
              {isIncluded ? 'Agregado' : 'Agregar'}
            </button>
            <button
              className={`favorite-btn ${preset.isFavorite ? 'favorited' : ''}`}
              onClick={(event) => {
                event.stopPropagation();
                toggleFavorite(preset.name);
              }}
              title={preset.isFavorite ? 'Quitar favorito' : 'Marcar favorito'}
            >
              <LuHeart fill={preset.isFavorite ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>
      );
    },
    [
      currentPresetName,
      onSelectPreset,
      selectedList?.id,
      selectedPresetNamesSet,
      toggleFavorite,
      togglePresetInList
    ]
  );


  const renderListManagerTab = () => (
    <section className="preset-tab-view">
      <div className="preset-grid preset-grid--list-manager">
        <article className="manager-card">
          <div className="manager-card__header">
            <span className="config-label">
              <LuPlus /> Crear list
            </span>
            <small>Genera una nueva preset list para curar un flujo visual propio.</small>
          </div>
          <div className="list-create-row">
            <input
              className="manager-input"
              type="text"
              value={newListName}
              placeholder="Nombre de la nueva lista"
              onChange={(event) => setNewListName(event.target.value)}
            />
            <button className="action-btn primary" onClick={handleCreateList} type="button">
              Crear
            </button>
          </div>
        </article>

        <article className="manager-card">
          <div className="manager-card__header">
            <span className="config-label">
              <LuPencil /> Gestion de list
            </span>
            <small>Selecciona la preset list que editaras, renombraras o eliminaras.</small>
          </div>
          <div className="manager-stack">
            <select
              className="manager-select"
              value={selectedListId}
              onChange={(event) => setSelectedListId(event.target.value)}
            >
              <option value="">Selecciona una lista</option>
              {presetLists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>

            <div className="list-create-row">
              <input
                className="manager-input"
                type="text"
                value={renameValue}
                placeholder="Renombra la lista"
                onChange={(event) => setRenameValue(event.target.value)}
                disabled={!hasSelectedList}
              />
              <button
                className="action-btn"
                onClick={handleRenameList}
                disabled={!hasSelectedList}
                type="button"
              >
                <LuPencil /> Guardar
              </button>
            </div>

            <button
              className="action-btn danger action-btn--full"
              onClick={handleDeleteList}
              disabled={!hasSelectedList}
              type="button"
            >
              <LuTrash2 /> Eliminar Playlist
            </button>
          </div>
        </article>

        <article className="manager-card">
          <div className="manager-card__header">
            <span className="config-label">
              <LuFolder /> Fuente Activa
            </span>
            <small>Referencia rapida de lo que esta sonando y de la lista asociada actualmente.</small>
          </div>
          <div className="source-summary">
            <div className="source-summary__item">
              <span>Fuente activa</span>
              <strong>{sourceLabel}</strong>
            </div>
            <div className="source-summary__item">
              <span>Vinculo activo</span>
              <strong>{activeAssociationName}</strong>
            </div>
          </div>
        </article>

        <article className="manager-card">
          <div className="manager-card__header">
            <span className="config-label">
              <LuLink /> Vinculo Automatico
            </span>
            <small>Asigna la preset list elegida a la fuente que esta reproduciendo ahora mismo.</small>
          </div>
          <div className="list-actions-row">
            <button
              className="action-btn primary"
              onClick={() => associateActiveSource?.(selectedList?.id)}
              disabled={!hasSelectedList || !hasActiveSource}
              type="button"
            >
              <LuLink /> Vinculo Automatico
            </button>
            <button
              className="action-btn"
              onClick={() => removeActiveSourceAssociation?.()}
              disabled={!hasActiveSource}
              type="button"
            >
              <LuUnlink /> Quitar vinculo activo
            </button>
          </div>
        </article>

        <article className="manager-card manager-card--full">
          <div className="manager-card__header">
            <span className="config-label">
              <LuList /> Asignar relacion
            </span>
            <small>Escoge una fuente concreta de directorio, playlist o favoritos y vinculala manualmente.</small>
          </div>
          <div className="manager-stack">
            <select
              className="manager-select"
              value={manualSourceKey}
              onChange={(event) => setManualSourceKey(event.target.value)}
            >
              <option value="">Selecciona una fuente</option>
              {normalizedAssociationSources.map((source) => (
                <option key={source.sourceKey} value={source.sourceKey}>
                  {source.label}
                </option>
              ))}
            </select>

            <div className="manager-note">
              Vinculada ahora a: <strong>{manualAssociationListName}</strong>
            </div>

            <div className="list-actions-row">
              <button
                className="action-btn"
                onClick={handleManualAssociate}
                disabled={!hasSelectedList || !manualSource}
                type="button"
              >
                <LuLink /> Vincular manualmente
              </button>
              <button
                className="action-btn"
                onClick={handleManualRemoveAssociation}
                disabled={!manualSource}
                type="button"
              >
                <LuUnlink /> Quitar vinculo
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  );

  const renderPresetLibraryTab = () => (
    <section className="preset-tab-view preset-tab-view--library">
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
  );

  const renderActiveTab = () => {
    if (activeTab === 'list-manager') {
      return renderListManagerTab();
    }

    if (activeTab === 'preset-library') {
      return renderPresetLibraryTab();
    }

    return (
      <ControllerTab
        currentPresetName={currentPresetName}
        currentSourceMode={currentSourceMode}
        presetSource={presetSource}
        handlePresetSourceModeChange={handlePresetSourceModeChange}
        handlePresetSourceListChange={handlePresetSourceListChange}
        sourceLabel={sourceLabel}
        cycleDurationMs={cycleDurationMs}
        setCycleDurationMs={setCycleDurationMs}
        isShuffled={isShuffled}
        toggleShuffle={toggleShuffle}
        DURATION_OPTIONS={DURATION_OPTIONS}
        PRESET_SOURCE_OPTIONS={PRESET_SOURCE_OPTIONS}
        presetLists={presetLists}
        allPresets={allPresets}
      />
    );
  };

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
          <div className="preset-manager-header__copy">
            <span className="preset-manager-header__eyebrow">Preset Control Room</span>
            <h2>Administrador de Presets</h2>
            <p>
              Construye listas visuales, cambia el ritmo del loop y vincula cada fuente con una
              identidad propia.
            </p>
          </div>

          <div className="preset-manager-header__status">
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
  );
};

export default VisualizerPresetManager;
