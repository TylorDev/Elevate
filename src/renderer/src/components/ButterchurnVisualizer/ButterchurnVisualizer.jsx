import React, { useEffect, useRef, useState, useCallback } from 'react';
import butterchurn from 'butterchurn';
import butterchurnPresets from 'butterchurn-presets';
import { getGlobalAudioContext } from '../../utils/audioVisualizer';
import { LuPlay, LuPause, LuSkipBack, LuSkipForward } from 'react-icons/lu';
import { shuffle } from 'lodash';
import './ButterchurnVisualizer.scss';

export function ButterchurnVisualizer({ mediaRef }) {
  const canvasRef = useRef(null);
  const visualizerRef = useRef(null);
  const animationFrameRef = useRef(null);
  
  const [presetsArray, setPresetsArray] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  // Ref para el temporizador
  const timerRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !mediaRef || !mediaRef.current) return;

    // Obtener contexto global y nodo de origen
    const { audioContext, sourceNode } = getGlobalAudioContext(mediaRef.current);

    if (!audioContext || !sourceNode) return;

    // Inicializar Butterchurn en el Canvas de 200x100 de forma fija
    const visualizer = butterchurn.createVisualizer(audioContext, canvasRef.current, {
      width: 200,
      height: 100
    });

    // Conectar Butterchurn a la fuente
    visualizer.connectAudio(sourceNode);
    visualizerRef.current = visualizer;

    // Obtener y mezclar todos los presets
    const presetsDict = butterchurnPresets.getPresets();
    const presetKeys = Object.keys(presetsDict);
    const shuffledKeys = shuffle(presetKeys);
    
    setPresetsArray(shuffledKeys);
    
    // Cargar un Preset inicial
    if (shuffledKeys.length > 0) {
      visualizer.loadPreset(presetsDict[shuffledKeys[0]], 0);
    }

    // Loop de animación a 60fps
    const renderLoop = () => {
      visualizer.render();
      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    // Limpieza al desmontar
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (visualizerRef.current) {
        visualizerRef.current.disconnectAudio(sourceNode);
      }
    };
  }, [mediaRef]);

  // Carga un preset dado su índice con una transición de 2 segundos
  const loadPresetAtIndex = useCallback((index) => {
    if (!visualizerRef.current || presetsArray.length === 0) return;
    const presetsDict = butterchurnPresets.getPresets();
    const key = presetsArray[index];
    if (presetsDict[key]) {
      visualizerRef.current.loadPreset(presetsDict[key], 2);
    }
  }, [presetsArray]);

  const goToNext = useCallback(() => {
    if (presetsArray.length === 0) return;
    setCurrentIndex(prev => {
      const nextIndex = (prev + 1) % presetsArray.length;
      loadPresetAtIndex(nextIndex);
      return nextIndex;
    });
  }, [presetsArray, loadPresetAtIndex]);

  const goToPrevious = useCallback(() => {
    if (presetsArray.length === 0) return;
    setCurrentIndex(prev => {
      const nextIndex = prev === 0 ? presetsArray.length - 1 : prev - 1;
      loadPresetAtIndex(nextIndex);
      return nextIndex;
    });
  }, [presetsArray, loadPresetAtIndex]);

  const togglePause = useCallback(() => {
    setIsPaused(p => !p);
  }, []);

  // Intervalo automático cada 6 segundos
  useEffect(() => {
    if (isPaused || presetsArray.length === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      goToNext();
    }, 6000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, presetsArray.length, goToNext]);

  return (
    <div className="butterchurn-container">
      <canvas 
        ref={canvasRef} 
        width={200} 
        height={100} 
      />
      
      <div className="visualizer-controls">
        <LuSkipBack onClick={goToPrevious} title="Anterior Preset" />
        {isPaused ? (
          <LuPlay onClick={togglePause} title="Reanudar Cambios" />
        ) : (
          <LuPause onClick={togglePause} title="Pausar Cambios" />
        )}
        <LuSkipForward onClick={goToNext} title="Siguiente Preset" />
      </div>
    </div>
  );
}
