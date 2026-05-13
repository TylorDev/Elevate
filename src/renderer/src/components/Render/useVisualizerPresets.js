import { useState, useEffect, useRef, useCallback } from 'react';
import MINI from 'butterchurn-presets/lib/elevate.min.js';

const PRESET_CATALOG = MINI.default || MINI;
const ALL_PRESET_KEYS = Object.keys(PRESET_CATALOG);

const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export function useVisualizerPresets() {
  const [shuffledKeys, setShuffledKeys] = useState([]);
  const [currentPresetIndex, setCurrentPresetIndex] = useState(0);
  const [isPresetPaused, setIsPresetPaused] = useState(false);
  const presetIntervalRef = useRef(null);

  useEffect(() => {
    setShuffledKeys(shuffleArray(ALL_PRESET_KEYS));
  }, []);

  const nextPreset = useCallback(() => {
    if (shuffledKeys.length === 0) return;
    setCurrentPresetIndex((prev) => (prev + 1) % shuffledKeys.length);
  }, [shuffledKeys.length]);

  const prevPreset = useCallback(() => {
    if (shuffledKeys.length === 0) return;
    setCurrentPresetIndex((prev) => (prev - 1 + shuffledKeys.length) % shuffledKeys.length);
  }, [shuffledKeys.length]);

  const togglePresetPause = useCallback(() => {
    setIsPresetPaused((prev) => !prev);
  }, []);

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
  }, [isPresetPaused, shuffledKeys, nextPreset]);

  const setPresetIndex = useCallback((index) => {
    if (index >= 0 && index < shuffledKeys.length) {
      setCurrentPresetIndex(index);
    }
  }, [shuffledKeys.length]);

  return {
    currentPresetName: shuffledKeys[currentPresetIndex] || "",
    currentPresetIndex,
    allPresets: shuffledKeys,
    isPresetPaused,
    nextPreset,
    prevPreset,
    togglePresetPause,
    setPresetIndex
  };
}
