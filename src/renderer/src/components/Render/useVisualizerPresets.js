import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import MINI from 'butterchurn-presets/lib/elevate.min.js';

const PRESET_CATALOG = MINI.default || MINI;
const ALL_PRESET_KEYS = Object.keys(PRESET_CATALOG);

const STORAGE_KEYS = {
  favorites: 'visualizerPresetFavorites',
  cycleDuration: 'visualizerCycleDurationMs',
  cycleMode: 'visualizerCycleMode',
  source: 'visualizerPresetSource',
  presetLists: 'visualizerPresetLists',
  sourceAssociations: 'visualizerPresetSourceAssociations'
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

export function createStableId(prefix) {
  if (globalThis?.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function normalizePlaybackSource(queueName) {
  if (typeof queueName !== 'string' || !queueName.trim()) {
    return null;
  }

  if (queueName.startsWith('folder:')) {
    return {
      type: 'directory',
      id: queueName.slice('folder:'.length)
    };
  }

  if (queueName === 'favourites' || queueName === 'favorites') {
    return {
      type: 'favorites',
      id: 'favorites'
    };
  }

  return {
    type: 'playlist',
    id: queueName
  };
}

export function getSourceKey(source) {
  if (!source?.type || !source?.id) {
    return '';
  }

  return `${source.type}:${source.id}`;
}

export function getSourceLabel(source) {
  if (!source?.type || !source?.id) {
    return 'Sin fuente activa';
  }

  if (source.type === 'favorites') {
    return 'Favoritos';
  }

  if (source.type === 'directory') {
    return `Directorio: ${source.id}`;
  }

  return `Playlist: ${source.id}`;
}

export function createPresetByNameMap(presetItems = []) {
  return new Map(presetItems.map((preset) => [preset.name, preset]));
}

export function mapPresetNamesToItems(presetNames = [], presetByName = new Map()) {
  return presetNames
    .map((presetName) => presetByName.get(presetName))
    .filter(Boolean);
}

export function useVisualizerPresets({ activePlaybackSource = null } = {}) {
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
  const [presetLists, setPresetLists] = useState(() =>
    loadFromStorage(STORAGE_KEYS.presetLists, [])
  );
  const [sourceAssociations, setSourceAssociations] = useState(() =>
    loadFromStorage(STORAGE_KEYS.sourceAssociations, {})
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

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.presetLists, presetLists);
  }, [presetLists]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.sourceAssociations, sourceAssociations);
  }, [sourceAssociations]);

  const favoritePresetNamesSet = useMemo(() => new Set(favorites), [favorites]);

  const allPresetItems = useMemo(() => {
    return ALL_PRESET_KEYS.map((name) => ({
      id: name,
      name,
      isFavorite: favoritePresetNamesSet.has(name)
    }));
  }, [favoritePresetNamesSet]);

  const presetByName = useMemo(() => createPresetByNameMap(allPresetItems), [allPresetItems]);

  const activeSourceKey = useMemo(
    () => getSourceKey(activePlaybackSource),
    [activePlaybackSource]
  );

  const activePresetList = useMemo(() => {
    const activeListId = sourceAssociations[activeSourceKey];

    if (!activeListId) {
      return null;
    }

    return presetLists.find((list) => list.id === activeListId) || null;
  }, [activeSourceKey, presetLists, sourceAssociations]);

  const activePresetNames = useMemo(() => {
    if (activePresetList && Array.isArray(activePresetList.presetNames)) {
      const validPresetItems = mapPresetNamesToItems(activePresetList.presetNames, presetByName);
      return validPresetItems.length > 0 ? validPresetItems.map((preset) => preset.name) : ALL_PRESET_KEYS;
    }

    return ALL_PRESET_KEYS;
  }, [activePresetList, presetByName]);

  const activePresetItems = useMemo(() => {
    return mapPresetNamesToItems(activePresetNames, presetByName);
  }, [activePresetNames, presetByName]);

  const hasBoundPresetList = Boolean(activePresetList && activePresetNames.length > 0);

  const getCurrentOrder = useCallback(() => {
    if (!hasBoundPresetList) {
      return shuffledKeys.filter((key) => activePresetNames.includes(key));
    }

    if (cycleMode === 'linear') {
      return activePresetNames;
    }
    return shuffledKeys.filter(key => activePresetNames.includes(key));
  }, [activePresetNames, cycleMode, hasBoundPresetList, shuffledKeys]);

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

  const createPresetList = useCallback((name) => {
    const trimmedName = String(name || '').trim() || 'Nueva lista';
    const timestamp = Date.now();
    const nextList = {
      id: createStableId('preset-list'),
      name: trimmedName,
      presetNames: [],
      createdAt: timestamp,
      updatedAt: timestamp
    };

    setPresetLists((prev) => [...prev, nextList]);
    return nextList;
  }, []);

  const renamePresetList = useCallback((listId, name) => {
    const trimmedName = String(name || '').trim();

    if (!listId || !trimmedName) {
      return;
    }

    setPresetLists((prev) =>
      prev.map((list) =>
        list.id === listId
          ? {
              ...list,
              name: trimmedName,
              updatedAt: Date.now()
            }
          : list
      )
    );
  }, []);

  const deletePresetList = useCallback((listId) => {
    if (!listId) {
      return;
    }

    setPresetLists((prev) => prev.filter((list) => list.id !== listId));
    setSourceAssociations((prev) => {
      const nextAssociations = {};

      Object.entries(prev).forEach(([sourceKey, associatedListId]) => {
        if (associatedListId !== listId) {
          nextAssociations[sourceKey] = associatedListId;
        }
      });

      return nextAssociations;
    });
  }, []);

  const togglePresetInList = useCallback((listId, presetName) => {
    if (!listId || !ALL_PRESET_KEYS.includes(presetName)) {
      return;
    }

    setPresetLists((prev) =>
      prev.map((list) => {
        if (list.id !== listId) {
          return list;
        }

        const hasPreset = list.presetNames.includes(presetName);
        return {
          ...list,
          presetNames: hasPreset
            ? list.presetNames.filter((name) => name !== presetName)
            : [...list.presetNames, presetName],
          updatedAt: Date.now()
        };
      })
    );
  }, []);

  const associateActiveSource = useCallback((listId) => {
    if (!activePlaybackSource?.type || !activePlaybackSource?.id || !listId) {
      return;
    }

    const sourceKey = getSourceKey(activePlaybackSource);

    setSourceAssociations((prev) => ({
      ...prev,
      [sourceKey]: listId
    }));
  }, [activePlaybackSource]);

  const associateSourceToList = useCallback((source, listId) => {
    if (!source?.type || !source?.id || !listId) {
      return;
    }

    const sourceKey = getSourceKey(source);

    if (!sourceKey) {
      return;
    }

    setSourceAssociations((prev) => ({
      ...prev,
      [sourceKey]: listId
    }));
  }, []);

  const removeActiveSourceAssociation = useCallback(() => {
    if (!activeSourceKey) {
      return;
    }

    setSourceAssociations((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, activeSourceKey)) {
        return prev;
      }

      const nextAssociations = { ...prev };
      delete nextAssociations[activeSourceKey];
      return nextAssociations;
    });
  }, [activeSourceKey]);

  const removeSourceAssociation = useCallback((source) => {
    const sourceKey = getSourceKey(source);

    if (!sourceKey) {
      return;
    }

    setSourceAssociations((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, sourceKey)) {
        return prev;
      }

      const nextAssociations = { ...prev };
      delete nextAssociations[sourceKey];
      return nextAssociations;
    });
  }, []);

  const pruneMissingSourceAssociations = useCallback((existingSources) => {
    if (!(existingSources instanceof Set)) {
      return;
    }

    setSourceAssociations((prev) => {
      const nextAssociations = {};

      Object.entries(prev).forEach(([sourceKey, listId]) => {
        if (sourceKey === 'favorites:favorites' || existingSources.has(sourceKey)) {
          nextAssociations[sourceKey] = listId;
        }
      });

      return nextAssociations;
    });
  }, []);

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
    isFavorite,
    favoritePresetNamesSet,
    presetByName,
    presetLists,
    sourceAssociations,
    activePlaybackSource,
    activeSourceKey,
    activePresetList,
    createPresetList,
    renamePresetList,
    deletePresetList,
    togglePresetInList,
    associateActiveSource,
    associateSourceToList,
    removeActiveSourceAssociation,
    removeSourceAssociation,
    pruneMissingSourceAssociations
  };

  return presetControls;
}
