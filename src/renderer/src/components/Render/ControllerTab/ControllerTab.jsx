import React from 'react';
import { LuMusic, LuList, LuClock, LuShuffle } from 'react-icons/lu';
import './ControllerTab.scss';

const ControllerTab = ({
  currentPresetName, // Still needed for the active item highlight in the temp list
  currentSourceMode,
  presetSource,
  handlePresetSourceModeChange,
  handlePresetSourceListChange,
  sourceLabel,
  cycleDurationMs,
  setCycleDurationMs,
  isShuffled,
  toggleShuffle,
  DURATION_OPTIONS,
  PRESET_SOURCE_OPTIONS,
  presetLists,
  allPresets
}) => {
  return (
    <section className="preset-tab-view preset-tab-view--controller">
      <div className="preset-grid preset-grid--controller">
        
        {/* Row 1: Col 1 */}
        <article className="manager-card">
          <div className="manager-card__header">
            <span className="config-label">
              <LuList /> Current List
            </span>
          </div>
          <div className="manager-stack">
            <select
              className="manager-select"
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
                className="manager-select"
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

            <div className="manager-note">
              Reproduciendo desde: <strong>{sourceLabel}</strong>
            </div>
          </div>
        </article>

        {/* Row 1, 2, 3: Col 2 (Spans 3 Rows) */}
        <article className="manager-card manager-card--temp-list">
          <div className="manager-card__header">
            <span className="config-label">
              <LuList /> Current List (Temp)
            </span>
          </div>
          
          <div className="temp-list-container">
            {allPresets.length === 0 ? (
              <div className="empty-state empty-state--compact">
                <p>No hay presets activos.</p>
              </div>
            ) : (
              <div className="temp-list-scroll">
                {allPresets.map((presetName, index) => {
                  const isActive = currentPresetName === presetName;
                  return (
                    <div 
                      key={`${presetName}-${index}`} 
                      className={`preset-item ${isActive ? 'active' : ''}`}
                    >
                      <div className="preset-info">
                        <span className="preset-index">{index + 1}</span>
                        <LuMusic className="preset-icon" />
                        <span className="preset-name">{presetName}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </article>

        {/* Row 2: Col 1 */}
        <article className="manager-card">
          <div className="manager-card__header">
            <span className="config-label">
              <LuClock /> Selector de ciclo
            </span>
          </div>
          <select
            className="manager-select"
            value={String(cycleDurationMs)}
            onChange={(event) => setCycleDurationMs(Number(event.target.value))}
          >
            {DURATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </article>

        {/* Row 3: Col 1 */}
        <article className="manager-card">
          <div className="manager-card__header">
            <span className="config-label">
              <LuShuffle /> Shuffle
            </span>
          </div>
          <button
            className={`toggle-pill ${isShuffled ? 'active' : ''}`}
            onClick={toggleShuffle}
            type="button"
          >
            <span className="toggle-pill__track">
              <span className="toggle-pill__thumb" />
            </span>
            <span className="toggle-pill__label">
              {isShuffled ? 'Shuffle ON' : 'Shuffle OFF'}
            </span>
          </button>
        </article>

      </div>
    </section>
  );
};

export default ControllerTab;
