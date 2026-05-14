import React from 'react';
import { LuX, LuHeart, LuMusic, LuList, LuShuffle, LuClock } from 'react-icons/lu';
import './VisualizerPresetManager.scss';

const DURATION_OPTIONS = [
  { value: 5000, label: '5s' },
  { value: 10000, label: '10s' },
  { value: 15000, label: '15s' },
  { value: 30000, label: '30s' }
];

const VisualizerPresetManager = ({
  isOpen,
  onClose,
  activePresetItems,
  currentPresetName,
  cycleDurationMs,
  setCycleDurationMs,
  cycleMode,
  setCycleMode,
  presetSource,
  setPresetSource,
  toggleFavorite,
  onSelectPreset
}) => {
  if (!isOpen) return null;

  const isEmpty = presetSource === 'favorites' && activePresetItems.length === 0;

  return (
    <div className="preset-manager-overlay" onClick={onClose}>
      <div className="preset-manager-panel" onClick={(e) => e.stopPropagation()}>
        <div className="preset-manager-header">
          <h2>Administrador de Presets</h2>
          <button className="close-btn" onClick={onClose}>
            <LuX />
          </button>
        </div>

        <div className="preset-manager-config">
          <div className="config-section">
            <label className="config-label">
              <LuClock /> Duración
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

          <div className="config-section">
            <label className="config-label">
              <LuList /> Source
            </label>
            <div className="source-buttons">
              <button
                className={`source-btn ${presetSource === 'all' ? 'active' : ''}`}
                onClick={() => setPresetSource('all')}
              >
                Todos
              </button>
              <button
                className={`source-btn ${presetSource === 'favorites' ? 'active' : ''}`}
                onClick={() => setPresetSource('favorites')}
              >
                Favoritos
              </button>
            </div>
          </div>
        </div>

        <div className="preset-manager-list">
          {isEmpty ? (
            <div className="empty-state">
              <LuHeart className="empty-icon" />
              <p>No hay presets favoritos todavía</p>
              <small>Marca presets como favoritos para verlos aquí</small>
            </div>
          ) : (
            activePresetItems.map((preset) => (
              <div
                key={preset.id}
                className={`preset-item ${currentPresetName === preset.name ? 'active' : ''}`}
                onClick={() => onSelectPreset(preset.name)}
              >
                <div className="preset-info">
                  <LuMusic className="preset-icon" />
                  <span className="preset-name">{preset.name}</span>
                </div>
                <button
                  className={`favorite-btn ${preset.isFavorite ? 'favorited' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(preset.name);
                  }}
                >
                  <LuHeart fill={preset.isFavorite ? 'currentColor' : 'none'} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default VisualizerPresetManager;