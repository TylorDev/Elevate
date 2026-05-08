import { useState, useEffect, useRef, useCallback } from 'react';

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

const VIP_PRESETS = [...incontrolable, ...Perfect, ...Mid, ...Basic];

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
    setShuffledKeys(shuffleArray(VIP_PRESETS));
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

  return {
    currentPresetName: shuffledKeys[currentPresetIndex] || "",
    isPresetPaused,
    nextPreset,
    prevPreset,
    togglePresetPause
  };
}
