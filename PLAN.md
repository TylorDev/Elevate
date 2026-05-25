# Análisis y Solución: Bloqueo de UI al Importar Playlists

Este documento detalla los hallazgos sobre por qué la interfaz de usuario (UI) se congela al importar o arrastrar una playlist, y las soluciones propuestas/implementadas para corregirlo.

## 🔍 Hallazgos (Root Cause Analysis)

El congelamiento de la UI durante la importación no se debe a la lectura del archivo `.m3u` en sí, sino a lo que ocurre inmediatamente después de que la importación es exitosa.

1. **El disparador (Trigger):**
   Cuando invocas `openM3U` (o arrastras un archivo), una vez que el archivo se lee y se guarda en la base de datos, el contexto de React llama a `refreshPlaylistsInBackground()`.

2. **La cascada de eventos:**
   `refreshPlaylistsInBackground()` llama a `getSavedLists({ force: true })`, lo que obliga a la aplicación a solicitar de nuevo **todas** las playlists desde el proceso principal (`main`) usando el IPC `get-playlists`.

3. **El Cuello de Botella (El Bloqueo del Event Loop):**
   El handler de `get-playlists` en `playlistHandlers.mjs` lee todas las playlists de la base de datos y luego las pasa por la función `processPlaylistsBatch(playlists, 3)`.
   Esta función itera sobre cada playlist y llama a `getEffectiveCover()`. Si hay muchas playlists y algunas no tienen el cover en caché, el sistema utiliza la librería `sharp` y operaciones de I/O intensivas para generar collages de imágenes de las portadas de las canciones.
   
4. **Consecuencia en la UI:**
   Aunque la generación de imágenes tiene partes asíncronas, la cantidad de operaciones de CPU y lectura de archivos ahoga el *Event Loop* de Node.js en el proceso principal. Cuando el proceso principal está ahogado, los mensajes IPC desde el proceso *Renderer* (la UI de React) no pueden ser contestados a tiempo, lo que resulta en que toda la aplicación de React se congele o no responda temporalmente (UI blocking) hasta que terminen de generarse las portadas.

---

## 🛠 Soluciones Implementadas

### Solución 1: Carga Diferida y Liviana (QueueTabs)
En lugar de depender de la lista global de playlists (la cual tiene las portadas pesadas y congela la UI), la pestaña `PlaylistsQueueTab` fue refactorizada para usar **Estado Local** y un endpoint **Liviano**.

- Se creó un nuevo IPC `get-playlists-lite` que **solo** devuelve metadata de texto y portadas que *ya están en la RAM* (`playlistCoverCache`). No intenta generar nada con `sharp`.
- La pestaña carga estos datos al instante sin bloquear el Event Loop.
- Los covers faltantes se suplen visualmente con un ícono genérico (`<LuListMusic />`) para mantener la estética.

### Solución 2: Reacción Inmediata sin Bloqueo
Para solucionar que la UI no se actualice tras la importación (especialmente en el empty state o desde otras vistas), la pestaña ahora reacciona de dos maneras:

1. **Reacción Explicita:** Cuando le das clic al botón de importar (`openM3U`) desde el "Empty State" de la pestaña, ahora forzamos una recarga liviana con `loadLitePlaylists({ force: true })` inmediatamente después, ignorando la recarga pesada que ocurre en el background global.
2. **Reacción Reactiva Global:** Se implementó un guardián de tiempo (`playlistsLastLoadedAt`) proveniente del estado global. Cuando la importación en background o el drag-and-drop global terminan, este timestamp cambia. El QueueTab detecta este cambio pasivamente y marca su caché local como "obsoleta". Apenas vuelves al QueueTab, realiza un llamado a `get-playlists-lite`, actualizando la lista en milisegundos sin congelar nada.

### Solución 3: Remoción Optimista (Fix al borrar y bloqueo de modal)
Adicional al bloqueo de importación, el borrar sufría de lo mismo: la UI esperaba a que todo el estado global se sincronizara antes de quitar el modal.
- Se resolvió con un `displayedPlaylists` derivado que usa la variable `deletingPlaylistPaths`. 
- En el mismo milisegundo que haces clic en "Eliminar", la playlist se saca del array renderizado de forma optimista. Esto desmonta el componente y destruye el Modal de confirmación al instante, logrando una sensación de cero latencia en la UI.
