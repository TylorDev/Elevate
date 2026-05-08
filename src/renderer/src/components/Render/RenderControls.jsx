import React from 'react';
import './RenderControls.scss';

const RenderControls = ({
  currentPresetName,
  isPresetPaused,
  onNext,
  onPrev,
  onTogglePause
}) => {
  return (
    <div className="render-controls">
      <div className="controls-container">
        <button onClick={onPrev}>Anterior Preset</button>
        <button onClick={onTogglePause}>
          {isPresetPaused ? "Reanudar Loop" : "Pausar Loop"}
        </button>
        <button onClick={onNext}>Siguiente Preset</button>
      </div>
      
      <div>
        <small className="preset-info">Preset actual: {currentPresetName || "Ninguno"}</small>
      </div>
    </div>
  );
};

export default RenderControls;
