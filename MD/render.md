# Optimización de Render.jsx y Music.jsx

## Resumen

Análisis profundo de rendimiento de dos componentes React: el visualizador Butterchurn (`Render.jsx`) y la página principal de música (`Music.jsx`). Se identificaron **14 problemas concretos** con impacto real en CPU, memoria y UX.

---

## 🔴 Problemas Encontrados — Render.jsx

### P1. `dimensions` como estado causa re-renders + teardown del visualizador (CRÍTICO)

**Líneas:** 12, 18-29, 32-38, 40-94

```jsx
const [dimensions, setDimensions] = useState({ width: 0, height: 0 }); // L12
// ResizeObserver llama setDimensions → re-render
// El effect principal depende de [dimensions.width, dimensions.height] → L94
// Cada resize DESTRUYE y RECREA el visualizador completo
```

**Por qué afecta:** `ResizeObserver` dispara frecuentemente durante resize. Cada cambio de `dimensions`:
1. Re-renderiza el componente.
2. Ejecuta el cleanup del effect principal (cancela `rAF`, desconecta audio).
3. Re-ejecuta el effect completo (crea nuevo visualizador Butterchurn, reconecta audio, inicia nuevo render loop).

Butterchurn ya tiene `setRendererSize()` para esto. No hay necesidad de destruir y recrear.

**Impacto:** Freeze de ~200-500ms por cada resize frame. Parpadeo visual. Reconexión innecesaria de Web Audio.

**Solución:** Usar `useRef` para dimensions. El ResizeObserver actualiza el ref y llama directamente a `visualizerRef.current.setRendererSize()`. El effect principal solo depende de `audioElement`.

---

### P2. `getPresets()` se llama en cada cambio de preset (MEDIO)

**Líneas:** 70, 99

```jsx
const presets = butterchurnPresets.getPresets(); // Llamado en init Y en cada preset change
```

**Por qué afecta:** `getPresets()` retorna un objeto grande con ~100+ presets. Llamarlo en cada transición (cada 6 segundos en auto-mode) genera presión innecesaria en GC.

**Solución:** Cachear el resultado en un `useRef` o variable de módulo ya que los presets no cambian en runtime.

---

### P3. Dependencias incorrectas en el effect de preset dinámico (MEDIO)

**Línea 109:**
```jsx
}, [presetName, dimensions.width, dimensions.height]);
```

**Por qué afecta:** `dimensions.width` y `dimensions.height` no se usan dentro del effect. Esto causa cargas de preset duplicadas en cada resize (el preset se carga 2 veces: una por el init effect, otra por este effect).

**Solución:** Dependencia solo de `[presetName]`.

---

### P4. El render loop no se pausa cuando el audio está pausado (BAJO-MEDIO)

**Líneas 76-82:**
```jsx
const renderLoop = () => {
  visualizer.render();
  animationFrameRef.current = requestAnimationFrame(renderLoop);
};
```

**Por qué afecta:** El visualizador ejecuta `render()` a 60fps incluso cuando la pestaña está en segundo plano o el audio está pausado. `requestAnimationFrame` se throttlea en background, pero sigue consumiendo CPU.

**Solución:** Escuchar eventos `play`/`pause` del `audioElement` para iniciar/detener el loop. Guardar referencia con refs para evitar stale closures.

---

### P5. Inline style object se recrea en cada render (BAJO)

**Línea 113:**
```jsx
<canvas ref={canvasRef} style={{ display: 'block' }} />
```

**Por qué afecta:** Crea un nuevo objeto en cada render. Impacto mínimo pero fácil de corregir.

**Solución:** Hoistear la constante fuera del componente.

---

## 🟡 Problemas Encontrados — Music.jsx

### P6. `handleMouseMove` se recrea en cada render y causa re-renders innecesarios (ALTO)

**Líneas 39-45:**
```jsx
const handleMouseMove = () => {
  setShowControls(true);  // ← setState en CADA mousemove
  if (idleTimer.current) clearTimeout(idleTimer.current);
  idleTimer.current = setTimeout(() => { setShowControls(false); }, 10000);
};
```

**Por qué afecta:**
1. La función se recrea en cada render (sin `useCallback`).
2. `setShowControls(true)` se llama en CADA evento `mousemove` (decenas de veces por segundo), incluso cuando `showControls` ya es `true`. Cada llamada fuerza un re-render.

**Impacto:** 30-60 re-renders/segundo durante movimiento del mouse. Cada re-render recalcula todo el JSX incluyendo evaluaciones condicionales.

**Solución:** Usar `useCallback` + ref para `showControls` y solo llamar `setShowControls(true)` cuando no está ya visible.

---

### P7. `presetControls` retorna un objeto nuevo en cada render → re-render en cascada (ALTO)

**Línea 26:**
```jsx
const presetControls = useVisualizerPresets();
```

El hook `useVisualizerPresets` retorna un **objeto literal nuevo** en cada render (L125-134 del hook):
```jsx
return {
  currentPresetName: shuffledKeys[currentPresetIndex] || "",
  // ... nuevo objeto cada vez
};
```

**Por qué afecta:** Cada re-render de `Music` (causado por `handleMouseMove`, cambio de `showControls`, etc.) crea un nuevo objeto `presetControls`. Si este se pasa como props, los hijos siempre ven props "nuevas".

**Solución:** Dentro de `useVisualizerPresets`, envolver el return en `useMemo`. (Nota: esto es un cambio al hook, no a Music.jsx. Si no queremos tocar el hook, podemos destructurar las propiedades directamente en Music.jsx y usar los primitivos individuales).

> [!IMPORTANT]
> El hook `useVisualizerPresets` no está en scope de optimización según las reglas. La solución dentro de Music.jsx es destructurar y pasar primitivos directamente a los hijos.

---

### P8. Effect de `autoMode` tiene dependencia incompleta (stale closure) (MEDIO)

**Líneas 29-37:**
```jsx
useEffect(() => {
  if (autoMode && presetControls.isPresetPaused) {
    presetControls.togglePresetPause();
  } else if (!autoMode && !presetControls.isPresetPaused) {
    presetControls.togglePresetPause();
  }
}, [autoMode]); // ← falta presetControls.isPresetPaused y togglePresetPause
```

**Por qué afecta:** Si `presetControls.isPresetPaused` cambia por otra razón, este effect no reacciona. Además, `presetControls` se lee con un closure potencialmente stale.

**Solución:** Añadir dependencias correctas y simplificar la lógica: solo sincronizar cuando `autoMode !== !isPresetPaused`.

---

### P9. `handleLikeClick` se recrea en cada render (BAJO-MEDIO)

**Líneas 64-69:**
```jsx
const handleLikeClick = (event) => {
  event.stopPropagation();
  if (currentFile) { toggleLike(currentFile); }
};
```

**Por qué afecta:** Se recrea en cada render. Impacto moderado ya que se pasa como prop al botón.

**Solución:** `useCallback` con dependencia en `[currentFile, toggleLike]`.

---

### P10. Effect de `mediaRef` sincronización tiene dependencia en `audioEl` que puede causar loop (BAJO)

**Líneas 52-56:**
```jsx
useEffect(() => {
  if (mediaRef?.current && !audioEl) {
    setAudioEl(mediaRef.current);
  }
}, [mediaRef, audioEl]);
```

**Por qué afecta:** `mediaRef` es un `useRef` — su referencia de objeto nunca cambia, por lo que como dependencia es inútil. `audioEl` como dependencia causa re-ejecución cuando se establece, aunque el guard `!audioEl` lo previene.

**Solución:** Usar un efecto con `[]` y un retry pattern, o simplemente inicializar directamente si `mediaRef.current` ya existe al montar.

---

### P11. Inline arrow functions en onClick se recrean cada render (BAJO)

**Líneas 138, 145, 152:**
```jsx
onClick={() => setShowCover(!showCover)}
onClick={() => setEnableVisualizer(!enableVisualizer)}  
onClick={() => setAutoMode(!autoMode)}
```

**Por qué afecta:** Recreación de funciones en cada render. Impacto bajo ya que son botones simples, pero se puede mejorar con `useCallback` o functional setState.

**Solución:** Usar functional setState pattern: `setShowCover(prev => !prev)` dentro de callbacks estables con `useCallback`.

---

### P12. Inline `style` objects con `backgroundImage` se recrean cada render (BAJO)

**Líneas 82, 91:**
```jsx
style={{ backgroundImage: `url(${currentCover})` }}
```

**Por qué afecta:** Nuevo objeto en cada render. Cuando `currentCover` no cambia, es trabajo desperdiciado.

**Solución:** `useMemo` basado en `currentCover`.

---

### P13. Derivaciones de `title`, `artist`, `views` se recalculan en cada render (BAJO)

**Líneas 71-73:**
```jsx
const title = currentFile?.title || currentFile?.fileName || 'Unknown Title';
const artist = currentFile?.artist || 'Unknown Artist';
const views = currentFile?.play_count || 0;
```

**Por qué afecta:** Impacto negligible — son operaciones de acceso a propiedades. No requiere `useMemo` ya que sería una micro-optimización que añade overhead.

**Decisión:** NO optimizar. El costo del `useMemo` supera el beneficio.

---

### P14. `<Render>` se monta/desmonta al toggle de `enableVisualizer` (MEDIO)

**Líneas 95-102:**
```jsx
{enableVisualizer && audioEl && (
  <div className="visualizer-background">
    <Render audioElement={audioEl} presetName={...} />
  </div>
)}
```

**Por qué afecta:** Cada toggle destruye y recrea completamente el componente `Render` + su visualizador Butterchurn + la conexión Web Audio. El mount de Butterchurn es costoso (~50-100ms).

**Solución:** Usar CSS `display: none` / `visibility: hidden` en lugar de mount/unmount condicional. Así el visualizador persiste en DOM pero no es visible. Combinar con la pausa del render loop (P4) para que no consuma CPU cuando está oculto.

> [!WARNING]
> **Tradeoff:** Mantener Render montado consume ~5-10MB de memoria extra para el canvas WebGL y el contexto de Butterchurn incluso cuando está oculto. Si la memoria es crítica, el approach actual (mount/unmount) puede ser preferible. **Recomendación:** Mantener mount/unmount actual pero optimizar el tiempo de init dentro de Render.jsx.

---

## Propuesta de Cambios

### [MODIFY] [Render.jsx](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/Render/Render.jsx)

| Fix | Cambio | Impacto |
|-----|--------|---------|
| P1 | `dimensions` → `useRef`, ResizeObserver directo | 🔴 CRÍTICO |
| P2 | Cachear `getPresets()` en variable de módulo | 🟡 MEDIO |
| P3 | Remover `dimensions` de deps del preset effect | 🟡 MEDIO |
| P4 | Pausar render loop cuando audio pausado | 🟡 MEDIO |
| P5 | Hoistear `canvasStyle` fuera del componente | 🟢 BAJO |

### [MODIFY] [Music.jsx](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Pages/Music/Music.jsx)

| Fix | Cambio | Impacto |
|-----|--------|---------|
| P6 | `handleMouseMove` con ref guard + useCallback | 🔴 ALTO |
| P8 | Corregir dependencias del autoMode effect | 🟡 MEDIO |
| P9 | `useCallback` para `handleLikeClick` | 🟢 BAJO |
| P10 | Simplificar effect de `mediaRef` | 🟢 BAJO |
| P11 | `useCallback` para toggle handlers | 🟢 BAJO |
| P12 | `useMemo` para background style objects | 🟢 BAJO |

### Cambios descartados (no tocar)

| Item | Razón |
|------|-------|
| P7 | Requiere modificar `useVisualizerPresets.js` (fuera de scope) |
| P13 | Micro-optimización — useMemo sería más costoso que el cálculo |
| P14 | Tradeoff de memoria no justifica mantener Render montado siempre |

---

## Plan de Verificación

### Tests Manuales
1. **Resize:** Verificar que el visualizador se redimensiona sin parpadeo ni reinicio.
2. **Preset rotation:** Verificar que los presets cambian suavemente cada 6s en auto-mode.
3. **Mouse hover:** Verificar que los controles aparecen/desaparecen correctamente.
4. **Toggle visualizador:** Verificar mount/unmount sin errores.
5. **Like button:** Verificar que funciona correctamente.
6. **Console:** Verificar sin errores ni warnings nuevos.

### Performance Profiling
- Verificar con React DevTools Profiler que los re-renders de `Music` durante mousemove se reducen de ~30-60/s a ~1 (solo el primer move).
