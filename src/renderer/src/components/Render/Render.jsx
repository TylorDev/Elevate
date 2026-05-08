import React, { useEffect, useRef, useState } from "react";
import butterchurn from "butterchurn";
import butterchurnPresets from "butterchurn-presets";
import "./Render.scss";

// Listas combinadas de los presets VIP
const incontrolable = [
  "$$$ Royal - Mashup (197)",
  "martin - witchcraft reloaded",
  "_Aderrasi - Wanderer in Curved Space - mash0000 - faclempt kibitzing meshuggana schmaltz (Geiss color mix)",
  "gunthry is out back bloodying up the pine trees - adm atomising (v) the disintigrate (n)",
  "_Mig_049",
  "Halfbreak - Light of Breakers",
];

const Perfect = [
  "Geiss - Reaction Diffusion 2",
  "TonyMilkdrop - Magellan's Nebula [Flexi - you enter first + multiverse]",
  "Hexcollie, Pieturp, Orb, Flexi, Geiss n Demon Lord - Premeditative Urination Clause",
  "Zylot - Paint Spill (Music Reactive Paint Mix)",
  "_Geiss - untitled",
  "MilkDrop2077.R033",
  "Flexi, martin + geiss - dedicated to the sherwin maxawow",
  "martin - bombyx mori",
  "martin - disco mix 4",
];

const Mid = [
  "Unchained - Unified Drag 2",
  "martin - another kind of groove",
  "martin - chain breaker",
  "ORB - Waaa",
  "Zylot - True Visionary (Final Mix)",
  "An AdamFX n Martin Infusion 2 flexi - Why The Sky Looks Diffrent Today - AdamFx n Martin Infusion - Tack Tile Disfunction B",
  "Eo.S. - glowsticks v2 05 and proton lights (+Krash′s beat code) _Phat_remix02b",
  "$$$ Royal - Mashup (431)",
  "Rovastar + Loadus + Geiss - FractalDrop (Triple Mix)",
  "_Mig_085",
  "suksma - ed geining hateops - squeakers",
  "suksma - Rovastar - Sunflower Passion (Enlightment Mix)_Phat_edit + flexi und martin shaders - circumflex in character classes in regular expression",
  "yin - 191 - Temporal singularities",
  "martin - angel flight",
  "martin - reflections on black tiles",
];

const Basic = [
  "martin [shadow harlequins shape code] - fata morgana",
  "$$$ Royal - Mashup (220)",
  "Aderrasi - Storm of the Eye (Thunder) - mash0000 - quasi pseudo meta concentrics",
  "Aderrasi + Geiss - Airhandler (Kali Mix) - Canvas Mix",
  "Eo.S. + Zylot - skylight (Stained Glass Majesty mix)",
  "flexi + geiss - pogo cubes vs. tokamak vs. game of life [stahls jelly 4.5 finish]",
  "Geiss - Cauldron - painterly 2 (saturation remix)",
  "cope + flexi - colorful marble (ghost mix)",
  "martin - stormy sea (2010 update)",
  "Aderrasi - Potion of Spirits",
  "Rovastar - Oozing Resistance",
  "shifter - escape (sigur ros)",
  "_Rovastar + Geiss - Hurricane Nightmare (Posterize Mix)",
  "flexi - mom, why the sky looks different today",
  "_Geiss - Artifact 01",
  "suksma - heretical crosscut playpen",
  "Geiss - Thumb Drum",
  "Martin - charisma",
  "suksma - uninitialized variabowl (hydroponic chronic)",
  "Martin - liquid arrows",
  "martin - mucus cervix",
];

// Unimos todos para el visualizador
const VIP_PRESETS = [...incontrolable, ...Perfect, ...Mid, ...Basic];

const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

import { getGlobalAudioContext } from '../../utils/audioVisualizer';

const Render = ({ audioElement, width = 400, height = 400 }) => {
  const canvasRef = useRef(null);
  const visualizerRef = useRef(null);
  const animationFrameRef = useRef(null);

  const [shuffledKeys, setShuffledKeys] = useState([]);
  const [currentPresetIndex, setCurrentPresetIndex] = useState(0);
  const [isPresetPaused, setIsPresetPaused] = useState(false);
  
  const presetIntervalRef = useRef(null);
  const WavesObjetList = butterchurnPresets.getPresets();

  useEffect(() => {
    setShuffledKeys(shuffleArray(VIP_PRESETS));
  }, []);

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
      canvasRef.current.width = width;
      canvasRef.current.height = height;

      const visualizer = butterchurn.createVisualizer(
        audioCtx,
        canvasRef.current,
        {
          width: width,
          height: height,
        }
      );
      
      visualizer.connectAudio(source);
      visualizerRef.current = visualizer;

      // Cargamos el primer preset tras conectar todo
      if (shuffledKeys.length > 0) {
        const firstPreset = WavesObjetList[shuffledKeys[currentPresetIndex]] || WavesObjetList[shuffledKeys[0]];
        if (firstPreset) {
          visualizer.loadPreset(firstPreset, 2);
        }
      }

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
  }, [audioElement, width, height, shuffledKeys]); // Se rearma si el element cambia o cuando se terminan de mezclar las llaves.

  const loadPreset = (presetName) => {
    if (visualizerRef.current && WavesObjetList[presetName]) {
      try {
        visualizerRef.current.loadPreset(WavesObjetList[presetName], 2);
      } catch (e) {
        console.error("Error loading preset", presetName, e);
      }
    }
  };

  // Escuchar cambios en el índice para cargar el preset en el visualizador
  useEffect(() => {
    if (shuffledKeys.length > 0 && visualizerRef.current) {
      loadPreset(shuffledKeys[currentPresetIndex]);
    }
  }, [currentPresetIndex, shuffledKeys]);

  const nextPreset = () => {
    if (shuffledKeys.length === 0) return;
    setCurrentPresetIndex((prev) => (prev + 1) % shuffledKeys.length);
  };

  const prevPreset = () => {
    if (shuffledKeys.length === 0) return;
    setCurrentPresetIndex((prev) => (prev - 1 + shuffledKeys.length) % shuffledKeys.length);
  };

  const togglePresetPause = () => {
    setIsPresetPaused(!isPresetPaused);
  };

  useEffect(() => {
    if (!isPresetPaused && shuffledKeys.length > 0) {
      if (presetIntervalRef.current) clearInterval(presetIntervalRef.current);
      
      presetIntervalRef.current = window.setInterval(() => {
        nextPreset();
      }, 6000);
    }

    return () => {
      if (presetIntervalRef.current !== null) {
        clearInterval(presetIntervalRef.current);
        presetIntervalRef.current = null;
      }
    };
  }, [isPresetPaused, shuffledKeys]); 
  // Solo rearmamos el intervalo si cambian las llaves o se pausa

  return (
    <div className="render-wrapper">
      <div className="canvas-container" style={{ width: width, height: height }}>
        <canvas ref={canvasRef} />
      </div>

      <div className="controls-container">
        <button onClick={prevPreset}>Anterior Preset</button>
        <button onClick={togglePresetPause}>
          {isPresetPaused ? "Reanudar Loop" : "Pausar Loop"}
        </button>
        <button onClick={nextPreset}>Siguiente Preset</button>
      </div>
      
      <div>
        <small className="preset-info">Preset actual: {shuffledKeys[currentPresetIndex] || "Ninguno"}</small>
      </div>
    </div>
  );
};

export default Render;
