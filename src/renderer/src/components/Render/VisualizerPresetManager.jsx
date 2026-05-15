import React, { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { FixedSizeList } from 'react-window';
import {
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
import { createPresetByNameMap, getSourceLabel, mapPresetNamesToItems } from './useVisualizerPresets';
import './VisualizerPresetManager.scss';

const DURATION_OPTIONS = [
  { value: 5000, label: '5s' },
  { value: 10000, label: '10s' },
  { value: 15000, label: '15s' },
  { value: 30000, label: '30s' }
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

function VirtualizedPresetPane({
  className,
  items,
  renderRow,
  itemKey
}) {
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
  cycleMode,
  setCycleMode,
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

      if (activePresetList?.id && presetLists.some((list) => list.id === activePresetList.id)) {
        return activePresetList.id;
      }

      return presetLists[0]?.id || '';
    });
  }, [activePresetList?.id, presetLists]);

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

    return allPresetItems.filter((preset) => preset.name.toLowerCase().includes(normalizedCatalogQuery));
  }, [allPresetItems, normalizedCatalogQuery]);

  const sourceLabel = getSourceLabel(activePlaybackSource);
  const hasActiveSource = Boolean(activePlaybackSource?.type && activePlaybackSource?.id);
  const hasSelectedList = Boolean(selectedList?.id);
  const activeAssociationName = activePresetList?.name || 'Sin vinculacion';
  const totalAssociations = Object.keys(sourceAssociations).length;
  const selectedListDisplayName = selectedList?.name || 'Ninguna lista seleccionada';

  const normalizedAssociationSources = useMemo(
    () =>
      availableAssociationSources.map((source) => ({
        ...source,
        sourceKey: source.sourceKey || `${source.type}:${source.id}`
      })),
    [availableAssociationSources]
  );

  const manualSource = useMemo(
    () => normalizedAssociationSources.find((source) => source.sourceKey === manualSourceKey) || null,
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
    [currentPresetName, onSelectPreset, selectedList?.id, selectedPresetNamesSet, toggleFavorite, togglePresetInList]
  );

  return (
    <div
      className={isPage ? 'preset-manager-page' : 'preset-manager-overlay'}
      onClick={isPage ? undefined : onClose}
    >
      <div className={`preset-manager-panel ${isPage ? 'preset-manager-panel--page' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="preset-manager-header">
          <h2>Administrador de Presets</h2>
          <button className="close-btn" onClick={onClose}>
            <LuX />
          </button>
        </div>

        <div className="preset-manager-config">
          <div className="config-section">
            <label className="config-label">
              <LuClock /> Duracion
            </label>
            <div className="duration-buttons">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`duration-btn ${cycleDurationMs === opt.value ? 'active' : ''}`}
                  onClick={() => setCycleDurationMs(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="config-section">
            <label className="config-label">
              <LuShuffle /> Modo
            </label>
            <div className="mode-buttons">
              <button
                className={`mode-btn ${cycleMode === 'random' ? 'active' : ''}`}
                onClick={() => setCycleMode('random')}
              >
                Aleatorio
              </button>
              <button
                className={`mode-btn ${cycleMode === 'linear' ? 'active' : ''}`}
                onClick={() => setCycleMode('linear')}
              >
                Lineal
              </button>
            </div>
          </div>
        </div>

        <div className="preset-manager-association">
          <div className="association-card">
            <span className="association-label">Fuente activa</span>
            <strong>{sourceLabel}</strong>
          </div>
          <div className="association-card">
            <span className="association-label">Lista seleccionada</span>
            <strong>{selectedListDisplayName}</strong>
          </div>
          <div className="association-card">
            <span className="association-label">Lista vinculada</span>
            <strong>{activeAssociationName}</strong>
          </div>
          <div className="association-card">
            <span className="association-label">Asociaciones</span>
            <strong>{totalAssociations}</strong>
          </div>
        </div>

        <div className="preset-manager-lists">
          <div className="config-section">
            <label className="config-label">
              <LuPlus /> Crear lista
            </label>
            <div className="list-create-row">
              <input
                className="manager-input"
                type="text"
                value={newListName}
                placeholder="Nueva lista"
                onChange={(e) => setNewListName(e.target.value)}
              />
              <button className="action-btn primary" onClick={handleCreateList}>
                Crear
              </button>
            </div>
          </div>

          <div className="config-section">
            <label className="config-label">
              <LuList /> Lista seleccionada
            </label>
            <select
              className="manager-select"
              value={selectedListId}
              onChange={(e) => setSelectedListId(e.target.value)}
            >
              <option value="">Selecciona una lista</option>
              {presetLists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          </div>

          <div className="config-section">
            <label className="config-label">
              <LuPencil /> Renombrar lista
            </label>
            <div className="list-create-row">
              <input
                className="manager-input"
                type="text"
                value={renameValue}
                placeholder="Nombre de la lista"
                onChange={(e) => setRenameValue(e.target.value)}
                disabled={!hasSelectedList}
              />
              <button className="action-btn" onClick={handleRenameList} disabled={!hasSelectedList}>
                Guardar
              </button>
            </div>
          </div>

          <div className="list-actions-row">
            <button
              className="action-btn primary"
              onClick={() => associateActiveSource?.(selectedList?.id)}
              disabled={!hasSelectedList || !hasActiveSource}
            >
              <LuLink /> Vinculo automatico
            </button>
            <button
              className="action-btn"
              onClick={() => removeActiveSourceAssociation?.()}
              disabled={!hasActiveSource}
            >
              <LuUnlink /> Quitar automatico
            </button>
            <button className="action-btn danger" onClick={handleDeleteList} disabled={!hasSelectedList}>
              <LuTrash2 /> Eliminar lista
            </button>
          </div>

          <div className="config-section">
            <label className="config-label">
              <LuFolder /> Vinculo manual
            </label>
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
              Vinculada ahora a: {manualAssociationListName}
            </div>
          </div>

          <div className="list-actions-row">
            <button
              className="action-btn"
              onClick={handleManualAssociate}
              disabled={!hasSelectedList || !manualSource}
            >
              <LuLink /> Vincular manualmente
            </button>
            <button
              className="action-btn"
              onClick={handleManualRemoveAssociation}
              disabled={!manualSource}
            >
              <LuUnlink /> Quitar vinculo manual
            </button>
          </div>
        </div>

        {!hasSelectedList ? (
          <div className="preset-manager-empty-shell">
            <div className="empty-state">
              <LuList className="empty-icon" />
              <p>Crea o selecciona una lista para editar sus presets.</p>
              <small>El catalogo y la lista guardada aparecen cuando hay una lista activa.</small>
            </div>
          </div>
        ) : (
          <div className="preset-manager-columns">
            <section className="preset-column">
              <div className="preset-column__header">
                <div>
                  <h3>Mi lista</h3>
                  <span>{selectedPresetItems.length} presets guardados</span>
                </div>
              </div>

              {selectedPresetItems.length === 0 ? (
                <div className="empty-state empty-state--compact">
                  <LuMusic className="empty-icon" />
                  <p>Esta lista todavia no tiene presets.</p>
                  <small>Agrega presets desde el catalogo de la derecha.</small>
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
                  <h3>Catalogo</h3>
                  <span>{availableCatalogItems.length} presets disponibles</span>
                </div>
                <label className="catalog-search">
                  <LuSearch />
                  <input
                    type="text"
                    value={catalogQuery}
                    placeholder="Buscar preset"
                    onChange={(e) => setCatalogQuery(e.target.value)}
                  />
                </label>
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
        )}
      </div>
    </div>
  );
};

export default VisualizerPresetManager;
