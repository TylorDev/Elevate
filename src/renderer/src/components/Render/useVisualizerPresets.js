import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import MINI from 'butterchurn-presets/lib/elevate.min.js';

const PRESET_CATALOG = MINI.default || MINI;
const ALL_PRESET_KEYS = Object.keys(PRESET_CATALOG);

const STORAGE_KEYS = {
  favorites: 'visualizerPresetFavorites',
  cycleDuration: 'visualizerCycleDurationMs',
  cycleMode: 'visualizerCycleMode',
  source: 'visualizerPresetSource'
};

const DEFAULT_CYCLE_DURATION = 6000;
const DEFAULT_CYCLE_MODE = 'random';
const DEFAULT_SOURCE = 'all';

const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const loadFromStorage = (key, defaultValue) => {
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn(`Failed to load ${key} from localStorage:`, e);
  }
  return defaultValue;
};

const saveToStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Failed to save ${key} to localStorage:`, e);
  }
};

export function useVisualizerPresets() {
  const [favorites, setFavorites] = useState(() => 
    loadFromStorage(STORAGE_KEYS.favorites, [])
  );
  const [cycleDurationMs, setCycleDurationMs] = useState(() => 
    loadFromStorage(STORAGE_KEYS.cycleDuration, DEFAULT_CYCLE_DURATION)
  );
  const [cycleMode, setCycleMode] = useState(() => 
    loadFromStorage(STORAGE_KEYS.cycleMode, DEFAULT_CYCLE_MODE)
  );
  const [presetSource, setPresetSource] = useState(() => 
    loadFromStorage(STORAGE_KEYS.source, DEFAULT_SOURCE)
  );

  const [shuffledKeys, setShuffledKeys] = useState([]);
  const [currentPresetIndex, setCurrentPresetIndex] = useState(0);
  const [isPresetPaused, setIsPresetPaused] = useState(false);
  const presetIntervalRef = useRef(null);

  useEffect(() => {
    setShuffledKeys(shuffleArray(ALL_PRESET_KEYS));
  }, []);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.favorites, favorites);
  }, [favorites]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.cycleDuration, cycleDurationMs);
  }, [cycleDurationMs]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.cycleMode, cycleMode);
  }, [cycleMode]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.source, presetSource);
  }, [presetSource]);

  const allPresetItems = useMemo(() => {
    return ALL_PRESET_KEYS.map((name) => ({
      id: name,
      name,
      isFavorite: favorites.includes(name)
    }));
  }, [favorites]);

  const activePresetItems = useMemo(() => {
    if (presetSource === 'favorites') {
      return allPresetItems.filter(p => p.isFavorite);
    }
    return allPresetItems;
  }, [allPresetItems, presetSource]);

  const activePresetNames = useMemo(() => {
    return activePresetItems.map(p => p.name);
  }, [activePresetItems]);

  const getCurrentOrder = useCallback(() => {
    if (cycleMode === 'linear') {
      return activePresetNames;
    }
    return shuffledKeys.filter(key => activePresetNames.includes(key));
  }, [cycleMode, activePresetNames, shuffledKeys]);

  const currentOrder = useMemo(() => getCurrentOrder(), [getCurrentOrder]);

  const currentPresetName = currentOrder[currentPresetIndex] || "";

  useEffect(() => {
    if (currentOrder.length > 0 && !currentOrder.includes(currentPresetName)) {
      setCurrentPresetIndex(0);
    }
  }, [presetSource, cycleMode, currentOrder, currentPresetName]);

  const nextPreset = useCallback(() => {
    if (currentOrder.length === 0) return;
    setCurrentPresetIndex((prev) => (prev + 1) % currentOrder.length);
  }, [currentOrder.length]);

  const prevPreset = useCallback(() => {
    if (currentOrder.length === 0) return;
    setCurrentPresetIndex((prev) => (prev - 1 + currentOrder.length) % currentOrder.length);
  }, [currentOrder.length]);

  const togglePresetPause = useCallback(() => {
    setIsPresetPaused((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!isPresetPaused && currentOrder.length > 0) {
      if (presetIntervalRef.current) clearInterval(presetIntervalRef.current);

      presetIntervalRef.current = window.setInterval(() => {
        nextPreset();
      }, cycleDurationMs);
    }

    return () => {
      if (presetIntervalRef.current !== null) {
        clearInterval(presetIntervalRef.current);
        presetIntervalRef.current = null;
      }
    };
  }, [isPresetPaused, currentOrder, nextPreset, cycleDurationMs]);

  const setPresetIndex = useCallback((index) => {
    if (index >= 0 && index < currentOrder.length) {
      setCurrentPresetIndex(index);
    }
  }, [currentOrder.length]);

  const setPresetByName = useCallback((name) => {
    const idx = currentOrder.indexOf(name);
    if (idx >= 0) {
      setCurrentPresetIndex(idx);
    }
  }, [currentOrder]);

  const toggleFavorite = useCallback((presetName) => {
    setFavorites(prev => {
      const isFav = prev.includes(presetName);
      if (isFav) {
        return prev.filter(n => n !== presetName);
      }
      return [...prev, presetName];
    });
  }, []);

  const isFavorite = useCallback((presetName) => {
    return favorites.includes(presetName);
  }, [favorites]);

  const presetControls = {
    currentPresetName,
    currentPresetIndex,
    allPresets: currentOrder,
    isPresetPaused,
    nextPreset,
    prevPreset,
    togglePresetPause,
    setPresetIndex,
    setPresetByName,
    allPresetItems,
    activePresetItems,
    favoritePresetNames: favorites,
    cycleDurationMs,
    setCycleDurationMs,
    cycleMode,
    setCycleMode,
    presetSource,
    setPresetSource,
    toggleFavorite,
    isFavorite
  };

  return presetControls;
}