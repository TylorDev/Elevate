# Plan: panel administrador de presets en `Music.jsx`

## Resumen
Hoy el sistema de visualizers ya hace tres cosas útiles:
- activa/desactiva el visualizer desde [Music.jsx](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Pages/Music/Music.jsx)
- renderiza un preset por nombre en [Render.jsx](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/Render/Render.jsx)
- rota presets automáticamente con una lista mezclada y un intervalo fijo de 6 segundos en [useVisualizerPresets.js](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/Render/useVisualizerPresets.js)

Pero le faltan justo las piezas que pides:
- no hay botón para abrir panel administrador
- no existe modelo de “favoritos”
- no existe configuración de duración del ciclo
- no existe modo de ciclo lineal
- no existe filtro de source `[Todos, Favoritos]`
- la UI manual actual (`RenderControls`) solo tiene prev/pause/next/select

La forma más segura es **extender el hook de presets para volverlo la fuente de verdad**, y construir un panel nuevo encima.

## Problemas actuales que el implementador debe entender

### 1. `Music.jsx` no tiene panel de administración
En [Music.jsx](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Pages/Music/Music.jsx), hoy solo existe:
- toggles de cover / visualizer / auto-mode
- `RenderControls` para modo manual

No hay estado `isPresetManagerOpen`, ni botón, ni modal/panel lateral.

### 2. `useVisualizerPresets.js` está demasiado limitado
En [useVisualizerPresets.js](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/Render/useVisualizerPresets.js):
- solo devuelve una lista mezclada `shuffledKeys`
- siempre rota cada `6000ms`
- solo sabe avanzar/retroceder dentro de esa lista
- no conoce favoritos
- no conoce source activo
- no conoce modo lineal vs aleatorio
- no expone objetos de preset con metadata, solo strings

### 3. No existe almacenamiento persistente para configuración de presets
No hay `localStorage` para:
- favoritos
- duración del ciclo
- modo de ciclo
- source actual

Si no se crea eso, todo se perderá al recargar.

### 4. `RenderControls.jsx` no es el panel correcto para este requerimiento
En [RenderControls.jsx](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/Render/RenderControls.jsx):
- solo hay navegación básica
- el selector es un `<select>`
- no muestra icono + nombre + favorito por preset

Conviene mantenerlo para control rápido manual, y crear un panel separado para administración.

## Cambios a realizar

### [src/renderer/src/components/Render/useVisualizerPresets.js](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/Render/useVisualizerPresets.js)
**Objetivo:** convertir este hook en el núcleo real del sistema.

### Paso 1: introducir configuración persistida
Agregar lectura/escritura en `localStorage` para:
- `visualizerPresetFavorites` → array de nombres
- `visualizerCycleDurationMs` → número
- `visualizerCycleMode` → `'random' | 'linear'`
- `visualizerPresetSource` → `'all' | 'favorites'`

**Autoverificación:**
- recargar la app y comprobar que los valores elegidos se mantienen

### Paso 2: modelar presets como objetos
Derivar desde `ALL_PRESET_KEYS` una lista de objetos, por ejemplo:
- `id` / `name`
- `iconKey` o `iconType` simple
- `isFavorite`

No hace falta icono real distinto por preset; basta un icono compartido para todos y un botón de favorito aparte.

**Autoverificación:**
- el hook ya no devuelve solo strings; devuelve una lista usable para UI

### Paso 3: crear lista filtrada activa
Agregar una lista derivada según `presetSource`:
- `all` → todos los presets
- `favorites` → solo favoritos

Si `favorites` está vacío y source es `favorites`, el hook debe seguir funcionando sin romperse:
- lista activa vacía
- `currentPresetName` vacío
- UI puede mostrar mensaje

**Autoverificación:**
- al cambiar source, cambia el total de presets disponibles
- con favoritos vacíos no hay crash

### Paso 4: separar orden lineal de orden aleatorio
Crear dos comportamientos:
- `linear`: usar lista activa en orden natural
- `random`: usar una cola mezclada derivada de la lista activa

No reutilizar el viejo `shuffledKeys` como única fuente de verdad.

**Autoverificación:**
- en `linear`, avanzar debe seguir el orden fijo
- en `random`, avanzar debe usar orden mezclado

### Paso 5: hacer configurable la duración del ciclo
Reemplazar el `6000` fijo por `cycleDurationMs`.

Valores iniciales recomendados:
- 5000
- 10000
- 15000
- 30000

**Autoverificación:**
- cambiar de 5s a 10s modifica claramente el tiempo entre cambios
- recargar mantiene el valor

### Paso 6: agregar favoritos
Añadir funciones al hook:
- `toggleFavorite(presetName)`
- `isFavorite(presetName)`

Asegurar que si el preset actual deja de pertenecer a la lista activa por cambiar source/favoritos:
- se reubique a un preset válido
- o quede vacío sin romper el render

**Autoverificación:**
- marcar/desmarcar favorito cambia la UI inmediatamente
- source `favorites` refleja el cambio sin recargar

### Paso 7: ampliar el retorno del hook
El hook debe devolver además de lo actual:
- `allPresetItems`
- `activePresetItems`
- `favoritePresetNames`
- `cycleDurationMs`
- `setCycleDurationMs`
- `cycleMode`
- `setCycleMode`
- `presetSource`
- `setPresetSource`
- `toggleFavorite`

**Autoverificación:**
- `Music.jsx` puede leer toda la configuración desde una sola fuente

---

### [src/renderer/src/Pages/Music/Music.jsx](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Pages/Music/Music.jsx)
**Objetivo:** conectar el panel nuevo y el botón de apertura.

### Paso 8: agregar estado para abrir/cerrar panel
Crear:
- `isPresetManagerOpen`
- toggle/close handlers

**Autoverificación:**
- botón abre y cierra el panel sin afectar reproducción

### Paso 9: agregar botón “Administrador de Presets”
Dentro de `.view-switcher`, agregar un botón nuevo visible cuando el visualizer esté activo o siempre si prefieres consistencia.
Usar un icono tipo `LuSettings`, `LuSlidersHorizontal` o similar.

**Autoverificación:**
- aparece un botón nuevo en Music
- al click abre el panel

### Paso 10: montar el nuevo panel
Importar y renderizar un componente nuevo, por ejemplo:
- `VisualizerPresetManager`

Pasarle props desde `presetControls`.

**Autoverificación:**
- el panel se renderiza con datos reales del hook
- cerrar el panel no desmonta el visualizer principal

### Paso 11: mantener `RenderControls` como control rápido
No quitar `RenderControls` todavía.
Dejarlo como control rápido manual, y usar el panel nuevo para la administración más completa.

**Autoverificación:**
- modo manual sigue funcionando como antes
- el panel añade capacidades sin romper la navegación actual

---

### [src/renderer/src/components/Render/VisualizerPresetManager.jsx](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/Render/VisualizerPresetManager.jsx)
**Archivo nuevo recomendado.**

**Objetivo:** contener toda la UI de administración.

### Paso 12: construir la estructura del panel
Secciones mínimas:
- encabezado con título + cerrar
- configuración de ciclo
- filtro de source
- lista de presets

**Autoverificación:**
- el panel ya abre/cierra aunque la lista esté estática

### Paso 13: UI de configuración de ciclo
Agregar controles para:
- duración: botones o select con `5s`, `10s`, `15s`, `30s`
- modo: segmented control o botones `Aleatorio` / `Lineal`
- source: `Todos` / `Favoritos`

**Autoverificación:**
- cada control refleja el valor actual del hook
- cambiar un control actualiza el hook inmediatamente

### Paso 14: lista de presets
Renderizar cada preset con:
- icono
- nombre
- botón de favorito

No hace falta iconografía única por preset. Usa un icono común para el preset y un corazón/estrella para favorito.

**Autoverificación:**
- cada fila muestra icono + nombre + favorito
- el botón de favorito responde visualmente

### Paso 15: acciones de selección y favorito
En cada fila:
- click en la fila: seleccionar preset actual
- click en favorito: alternar favorito sin disparar selección accidental

**Autoverificación:**
- seleccionar fila cambia el preset activo
- marcar favorito no cambia de preset salvo que lo diseñes así

### Paso 16: estado vacío para source favoritos
Si `presetSource === 'favorites'` y no hay favoritos:
- mostrar mensaje claro: “No hay presets favoritos todavía”

**Autoverificación:**
- el panel no queda en blanco silencioso
- el usuario entiende qué hacer

---

### [src/renderer/src/components/Render/VisualizerPresetManager.scss](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/Render/VisualizerPresetManager.scss)
**Archivo nuevo recomendado.**

### Paso 17: estilo del panel
Crear layout estable para:
- panel flotante / modal lateral
- lista scrolleable
- filas de preset
- estados activos/favoritos

Mantener densidad visual alta y clara; no usar tarjetas gigantes.

**Autoverificación:**
- el panel cabe bien sobre `Music`
- la lista se puede recorrer sin romper el layout
- el preset activo es visible

---

### [src/renderer/src/components/Render/RenderControls.jsx](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/Render/RenderControls.jsx)
**Objetivo:** hacer una adaptación mínima para convivir con el nuevo sistema.

### Paso 18: asegurar que use la lista activa
Cambiar `allPresets` por la lista activa correcta que venga del hook.
Si decides mantener strings para este componente, pasarle solo nombres.
Si decides migrarlo a objetos, mapear internamente.

**Autoverificación:**
- en source `favorites`, el select solo muestra favoritos
- en source `all`, muestra todos

### Paso 19: no mezclar administración con control rápido
No meter duración/source/favoritos dentro de este archivo.
Déjalo enfocado en:
- prev
- pause
- next
- select

**Autoverificación:**
- el componente sigue simple
- no duplicas UI entre dos paneles

---

### [src/renderer/src/components/Render/RenderControls.scss](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/Render/RenderControls.scss)
### Paso 20: ajustes menores si hace falta
Solo tocar si el control rápido necesita:
- mejor ancho
- mejor contraste
- estado más claro con listas filtradas

**Autoverificación:**
- no rompe el diseño actual de Music

---

### [src/renderer/src/Pages/Music/Music.scss](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Pages/Music/Music.scss)
**Objetivo:** dar espacio al botón nuevo y al panel.

### Paso 21: agregar espacio para el botón de administrador
Actualizar `.view-switcher` si hace falta para soportar un botón adicional.

**Autoverificación:**
- los botones no se montan unos sobre otros

### Paso 22: posicionar el panel
Añadir estilos para que el panel:
- no tape todo de forma torpe
- no empuje el layout principal
- quede usable sobre el visualizer/cover

Una buena opción es panel flotante anclado al área de controles.

**Autoverificación:**
- abrir el panel no mueve la portada principal
- el panel sigue visible y usable en resoluciones medianas

## Orden de implementación recomendado
1. Extender `useVisualizerPresets.js` con configuración persistida
2. Añadir favoritos
3. Añadir source `all/favorites`
4. Añadir modo `random/linear`
5. Añadir duración configurable
6. Crear `VisualizerPresetManager.jsx`
7. Crear `VisualizerPresetManager.scss`
8. Conectar el panel en `Music.jsx`
9. Ajustar `Music.scss`
10. Adaptar `RenderControls.jsx` a la lista activa

## Casos de prueba
- Abrir `Music` y activar visualizer.
- Abrir panel administrador desde el botón nuevo.
- Cambiar ciclo a 5s y verificar rotación rápida.
- Cambiar ciclo a 10s y verificar rotación más lenta.
- Cambiar modo a `lineal` y comprobar orden estable.
- Cambiar modo a `aleatorio` y comprobar orden mezclado.
- Marcar 2-3 favoritos.
- Cambiar source a `Favoritos` y comprobar que solo aparecen esos.
- Quitar un favorito estando en source `Favoritos` y comprobar que desaparece de la lista.
- Source `Favoritos` con lista vacía debe mostrar estado vacío sin errores.
- Recargar la app y comprobar persistencia de:
  - favoritos
  - duración
  - modo
  - source

## Supuestos cerrados
- El “icon” de cada preset será un icono genérico compartido, no un asset único por preset.
- Los favoritos se guardarán en `localStorage`.
- El panel de administración será un componente nuevo, separado de `RenderControls`.
- El ciclo automático seguirá viviendo dentro de `useVisualizerPresets.js`, no en `Music.jsx`.
