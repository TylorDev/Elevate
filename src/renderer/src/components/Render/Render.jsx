import React, { useEffect, useRef, useState } from "react";
import butterchurn from "butterchurn";
import butterchurnPresets from "butterchurn-presets";
import { getGlobalAudioContext } from '../../utils/audioVisualizer';
import "./Render.scss";

const Render = ({ audioElement, height = 400, presetName }) => {
  const canvasRef = useRef(null);
  const visualizerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Resize listener
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Update visualizer dimensions when windowWidth or height changes
  useEffect(() => {
    if (visualizerRef.current && canvasRef.current) {
      canvasRef.current.width = windowWidth;
      canvasRef.current.height = height;
      visualizerRef.current.setRendererSize(windowWidth, height);
    }
  }, [windowWidth, height]);

  useEffect(() => {
    if (!audioElement || !canvasRef.current) return;

    // Initialize global audio context and source node
    const { audioContext: audioCtx, sourceNode: source } = getGlobalAudioContext(audioElement);

    if (!audioCtx || !source) {
      console.error("Could not retrieve global audio context or source node");
      return;
    }

    // Inicializar visualizador si tenemos todo
    if (canvasRef.current) {
      canvasRef.current.width = windowWidth;
      canvasRef.current.height = height;

      const visualizer = butterchurn.createVisualizer(
        audioCtx,
        canvasRef.current,
        {
          width: windowWidth,
          height: height,
        }
      );
      
      visualizer.connectAudio(source);
      visualizerRef.current = visualizer;

      const renderLoop = () => {
        visualizer.render();
        animationFrameRef.current = requestAnimationFrame(renderLoop);
      };
      
      // Aseguramos no encadenar requestAnimationFrames
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      renderLoop();
    }

    // Cleanup local: detiene la animación y desconecta el visualizador del source.
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (visualizerRef.current && source) {
        visualizerRef.current.disconnectAudio(source);
      }
    };
  }, [audioElement]); // Solo se inicializa con el audioElement

  // Escuchar cambios en el presetName para cargarlo
  useEffect(() => {
    if (presetName && visualizerRef.current) {
      const presets = butterchurnPresets.getPresets();
      if (presets[presetName]) {
        try {
          visualizerRef.current.loadPreset(presets[presetName], 2);
        } catch (e) {
          console.error("Error loading preset", presetName, e);
        }
      }
    }
  }, [presetName]);

  return (
    <div className="render-wrapper">
      <div className="canvas-container" style={{ width: windowWidth, height: height }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
};

export default Render;
