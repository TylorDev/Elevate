import React, { useEffect, useRef, useState } from "react";
import butterchurn from "butterchurn";
import butterchurnPresets from "butterchurn-presets";
import { getGlobalAudioContext } from '../../utils/audioVisualizer';
import "./Render.scss";

const Render = ({ audioElement, presetName }) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const visualizerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Use ResizeObserver to auto-size to parent container
  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Update visualizer dimensions when size changes
  useEffect(() => {
    if (visualizerRef.current && canvasRef.current && dimensions.width > 0 && dimensions.height > 0) {
      canvasRef.current.width = dimensions.width;
      canvasRef.current.height = dimensions.height;
      visualizerRef.current.setRendererSize(dimensions.width, dimensions.height);
    }
  }, [dimensions]);

  useEffect(() => {
    // Only initialize if we have audio and actual dimensions
    if (!audioElement || !canvasRef.current || dimensions.width === 0 || dimensions.height === 0) return;

    if (visualizerRef.current) return; // Prevent double initialization

    const { audioContext: audioCtx, sourceNode: source } = getGlobalAudioContext(audioElement);

    if (!audioCtx || !source) {
      console.error("Could not retrieve global audio context or source node");
      return;
    }

    canvasRef.current.width = dimensions.width;
    canvasRef.current.height = dimensions.height;

    const visualizer = butterchurn.createVisualizer(
      audioCtx,
      canvasRef.current,
      {
        width: dimensions.width,
        height: dimensions.height,
      }
    );
    
    visualizer.connectAudio(source);
    visualizerRef.current = visualizer;

    // Load initial preset if available
    if (presetName) {
      const presets = butterchurnPresets.getPresets();
      if (presets[presetName]) {
        visualizer.loadPreset(presets[presetName], 0); // initial load
      }
    }

    const renderLoop = () => {
      visualizer.render();
      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };
    
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    renderLoop();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (visualizerRef.current && source) {
        visualizerRef.current.disconnectAudio(source);
      }
      visualizerRef.current = null;
    };
  }, [audioElement, dimensions.width, dimensions.height]); 

  // Load preset dynamically
  useEffect(() => {
    if (presetName && visualizerRef.current) {
      const presets = butterchurnPresets.getPresets();
      if (presets[presetName]) {
        try {
          // Blend time of 2 seconds
          visualizerRef.current.loadPreset(presets[presetName], 2);
        } catch (e) {
          console.error("Error loading preset", presetName, e);
        }
      }
    }
  }, [presetName, dimensions.width, dimensions.height]);

  return (
    <div className="render-wrapper" ref={containerRef}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  );
};

export default Render;
