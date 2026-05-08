import React from 'react';
import { LuPlay, LuPause, LuSkipBack, LuSkipForward } from 'react-icons/lu';
import './RenderControls.scss';

const RenderControls = ({
  currentPresetName,
  currentPresetIndex,
  allPresets = [],
  isPresetPaused,
  onNext,
  onPrev,
  onTogglePause,
  onSelectPreset
}) => {
  return (
    <div className="render-controls-modern">
      <div className="controls-main">
        <button className="control-btn icon-btn" onClick={onPrev} title="Anterior Preset">
          <LuSkipBack />
        </button>
        <button className="control-btn play-btn" onClick={onTogglePause} title={isPresetPaused ? "Reanudar Loop" : "Pausar Loop"}>
          {isPresetPaused ? <LuPlay /> : <LuPause />}
        </button>
        <button className="control-btn icon-btn" onClick={onNext} title="Siguiente Preset">
          <LuSkipForward />
        </button>
      </div>
      
      <div className="preset-selector">
        <select 
          className="modern-select"
          value={currentPresetIndex} 
          onChange={(e) => onSelectPreset(Number(e.target.value))}
        >
          {allPresets.map((preset, idx) => (
            <option key={idx} value={idx}>
              {preset}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default RenderControls;
