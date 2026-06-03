# PRD: Elevate.MD

## 1. Resumen

Elevate.MD documenta la experiencia principal de Elevate como reproductor musical local con visualizador, biblioteca navegable, playlists, directorios, telemetria de escucha, historial por cancion y un sistema optimizado de covers.

El producto prioriza:

- Reproduccion local fluida con cola persistente y acciones rapidas.
- Visualizador grafico reactivo al audio con bajo consumo cuando el audio esta pausado.
- Navegacion rapida por biblioteca, playlists, directorios, likes, historial y rankings.
- Telemetria util basada en vistas, duracion, repeticiones, skips y actividad reciente.
- Covers cargados bajo demanda con cache LRU y revocacion de blobs para controlar memoria.

## 2. Objetivos

- Consolidar el comportamiento esperado de las pantallas y componentes clave del reproductor.
- Definir contratos funcionales entre renderer, contextos e IPC de Electron.
- Mantener listas grandes fluidas mediante virtualizacion y carga diferida.
- Reducir consumo de CPU y memoria en visualizador, rankings y covers.
- Asegurar que errores secundarios no bloqueen reproduccion ni navegacion.

## 3. Alcance

Incluido:

- Visualizador: `src/renderer/src/components/Render/Render.jsx`.
- Motor grafico: `src/renderer/src/Pages/Music/Music.jsx`.
- Biblioteca: `src/renderer/src/components/QueueTabsPanel/QueueTabsPanel.jsx`.
- Playlists: `src/renderer/src/components/QueueTabsPanel/Playlists/PlaylistsQueueTab.jsx`.
- Directorios: `src/renderer/src/components/QueueTabsPanel/Directories/DirectoriesQueueTab.jsx`.
- Telemetria: `src/renderer/src/Pages/Statistics/Statistics.jsx`, `src/renderer/src/Pages/Feed/Feed.jsx`, `src/renderer/src/components/AudioPlayer/AudioPlayer.jsx`, `src/renderer/src/components/CollectionInsights/CollectionInsightsPanel.jsx`.
- Historial: `src/renderer/src/Pages/History/History.jsx`, `src/renderer/src/components/SongItem/SongItem.jsx`, `src/renderer/src/Pages/History/HistorySong.jsx`.
- Optimizacion de covers: `src/renderer/src/Contexts/ImagesContext.jsx`.

Fuera de alcance:

- Reescritura completa de arquitectura.
- Cambio de rutas publicas existentes.
- Cambio de nombres de canales IPC salvo que una iteracion futura lo requiera.
- Normalizacion completa del copy bilingue de la UI.

## 4. Usuarios y Casos de Uso

### Usuario principal

Persona que escucha musica local desde Elevate y necesita navegar rapidamente por biblioteca, playlists, directorios, historial y rankings sin que la app se sienta pesada.

### Casos de uso principales

- Reproducir una cancion desde cualquier lista y continuar controlandola desde `AudioPlayer`.
- Abrir `/music`, alternar cover y visualizador, y controlar presets.
- Navegar playlists y directorios grandes sin congelamientos.
- Reproducir una playlist o directorio aleatorio.
- Consultar estadisticas globales de la biblioteca.
- Consultar rankings de colecciones en Feed.
- Abrir historial de una cancion desde el cover o desde History.
- Ver covers rapidamente sin consumir memoria de forma indefinida.

## 5. Requisitos Funcionales

### 5.1 Visualizador: Render.jsx

`Render.jsx` debe ser el componente canvas responsable de renderizar Butterchurn sobre el `audioElement` global.

Requisitos:

- Inicializar Butterchurn solo cuando existan `audioElement`, canvas y dimensiones validas.
- Obtener `audioContext` y `sourceNode` desde `getGlobalAudioContext(audioElement)`.
- Usar presets desde `butterchurn-presets/lib/elevate.min.js`.
- Mantener presets cacheados a nivel modulo para evitar reconstruccion por render.
- Exponer el canvas por `canvasRefExternal`, tanto con callback ref como object ref.
- Usar `ResizeObserver` para actualizar `canvas.width`, `canvas.height` y `visualizer.setRendererSize(width, height)` sin destruir el visualizador.
- Cargar preset inicial sin blend y cambios posteriores con blend suave de 2 segundos.
- Arrancar `requestAnimationFrame` solo al reproducir audio.
- Detener `requestAnimationFrame` al pausar audio o desmontar componente.
- Desconectar audio del visualizador al desmontar.

Criterios de aceptacion:

- Redimensionar la ventana no debe reinicializar el visualizador.
- Pausar el audio detiene el render loop.
- Cambiar preset no debe recrear el canvas ni el audio source.
- Si no hay audio context o source node, se registra error y la app sigue operativa.

### 5.2 Motor Grafico: Music.jsx

`Music.jsx` es la pantalla inmersiva de reproduccion y visualizador.

Requisitos:

- Consumir `currentFile`, `mediaElement`, estado de reproduccion, progreso, cover activo y configuracion de visualizador.
- Alternar entre:
  - Cover visible.
  - Cover como fondo.
  - Visualizador Butterchurn.
- Activar visualizador automaticamente cuando se oculta cover si no estaba activo.
- Restaurar cover cuando se desactiva visualizador si no hay cover visible.
- Mostrar visualizador tambien en modo Picture-in-Picture.
- En Picture-in-Picture:
  - Mostrar visualizador si existe audio.
  - Mostrar empty state si no hay audio.
  - Exponer cerrar, previous, play/pause, next y timeline.
  - Ajustar minimum size y always-on-top via `window.electron.windowControls`.
- Exponer controles de visualizador:
  - Shuffle de presets.
  - Pausa/reanudacion de ciclo.
  - Duracion de ciclo: 10, 15 y 30 segundos.
  - Preset anterior/siguiente.
  - Favorito.
  - Eliminar preset de la lista activa cuando aplique.
- Permitir guardar preset actual en listas existentes o crear nueva lista.
- Permitir cargar lista de presets: favoritos, todos o lista especifica.
- Capturar frame de preset actual como cover de preset cuando exista canvas disponible.
- Abrir historial de cancion actual con `/history/song/:filePath` al hacer click en el cover.
- Mostrar menu contextual con acciones de cover, visualizador, guardar preset, cargar lista y administrar presets.
- Mantener hint de click derecho hasta que el usuario lo descarte o la preferencia lo oculte.
- Mantener atajos:
  - `Tab`: alterna cover/visualizer.
  - `T`: alterna Step.
  - `F1`: alterna favorito del preset.
  - `ArrowRight` y `ArrowLeft`: navegar presets.
  - `ArrowDown`: pausa/reanuda ciclo.
  - `ArrowUp`: alterna shuffle.

Criterios de aceptacion:

- El fondo reproduce/pause al click solo si no se hace click en botones.
- El visualizador se activa en PIP aunque la vista normal no lo este mostrando.
- Los cambios de listas de preset muestran feedback sin bloquear reproduccion.
- Los atajos no actuan si el usuario escribe en inputs o textareas.

### 5.3 Biblioteca: QueueTabsPanel.jsx

`QueueTabsPanel.jsx` define la navegacion lateral de fuentes de cola.

Tabs requeridos:

- `current`: cola actual.
- `playlists`: playlists importadas o creadas.
- `directories`: directorios agregados.
- `likes`: canciones favoritas.
- `all`: biblioteca completa.

Requisitos:

- Renderizar como `aside`.
- Usar `role="tablist"`, `role="tab"` y `role="tabpanel"`.
- Mantener `activeTab` local.
- Instanciar solo el componente activo.
- Pasar `isActive` y `onSelectTab` al tab activo.

Criterios de aceptacion:

- Cambiar tabs no debe cargar datos de tabs inactivos salvo que sus componentes ya los tengan cacheados.
- Cada tab debe ser navegable con labels accesibles via `title` y atributos ARIA.

### 5.4 Playlists: PlaylistsQueueTab.jsx

`PlaylistsQueueTab.jsx` administra playlists dentro del panel de cola.

Requisitos:

- Cargar playlists ligeras al activar tab mediante `get-playlists-minimal`.
- Deduplicar request activo con `liteRequestRef`.
- Mantener estado local independiente del contexto global.
- Sincronizar cambios externos usando `playlistsLastLoadedAt`.
- Filtrar playlists en borrado mediante `deletingPlaylistPaths`.
- Mostrar empty state con accion `Import M3U`.
- Tras importar M3U, forzar recarga ligera.
- Virtualizar playlists con `VirtualizedQueueEntityList`.
- Al seleccionar playlist:
  - Cargar contenido con `getUniqueList`.
  - Mostrar `Cola` con `preserveOrder`.
  - Usar `redirectActiveToMusic`.
  - Habilitar pin move con `pinMoveScope="source-local"` y `sourceKey` igual al path de playlist.
- Permitir playlist aleatoria:
  - `get-random-playlist`.
  - `get-list`.
  - Validar existencia de `path` y tracks.
  - Reproducir con `playQueueShuffled(tracks, randomPlaylist.path)`.
  - Registrar historial de playlist con `addPlaylisthistory`.
  - Mostrar toast de error si no hay playlist, esta vacia o falla.

Criterios de aceptacion:

- El tab no carga playlists hasta estar activo.
- Playlists en borrado desaparecen de inmediato.
- Seleccion eliminada o inexistente limpia detalle y vuelve a estado seguro.
- Random playlist no permite doble ejecucion concurrente.

### 5.5 Directorios: DirectoriesQueueTab.jsx

`DirectoriesQueueTab.jsx` administra directorios dentro del panel de cola.

Requisitos:

- Cargar directorios al activar tab mediante `getDirectories`.
- Agrupar directorios por carpeta padre.
- Ordenar grupos y directorios alfabeticamente.
- Mostrar empty state con accion `Import Directory`.
- Cargar cantidad total con `get-directories-number`.
- Permitir directorio aleatorio:
  - `get-random-directory`.
  - `get-audio-in-directory`.
  - Validar `path` y tracks.
  - Reproducir con `playQueueShuffled(tracks, "folder:<path>")`.
  - Mostrar toast de error si no hay directorio, esta vacio o falla.
- Al seleccionar grupo, mostrar directorios del grupo virtualizados.
- Al seleccionar directorio:
  - Cargar tracks con `getDirFiles`.
  - Mostrar `Cola` con `preserveOrder`.
  - Usar source name `folder:<path>`.
  - Habilitar pin move local con `sourceKey="folder:<path>"`.

Criterios de aceptacion:

- El tab no carga directorios hasta estar activo.
- El boton random aparece solo si no hay grupo/directorio seleccionado y existe al menos un directorio.
- La navegacion back respeta jerarquia: directorio -> grupo -> raiz.

### 5.6 AudioPlayer.jsx

`AudioPlayer.jsx` es el control global visible del reproductor.

Requisitos:

- Mostrar cover actual desde `currentCover`.
- Al hacer click en cover, navegar a `/music` si hay `currentFile`.
- Mostrar metadata con titulo y artista.
- Permitir like/unlike desde la fila de acciones.
- Mostrar progreso con `AudioPlayerProgressRow`.
- Exponer controles:
  - Shuffle.
  - Previous.
  - Play/Pause.
  - Next.
  - Repeat.
  - Volumen/mute desde `SliderVolume`.
  - Mostrar/ocultar queue panel.
  - Entrar a Picture-in-Picture.
- Ajustar variante de volumen segun ancho de ventana.

Criterios de aceptacion:

- Los botones reflejan estado activo de shuffle, repeat y queue.
- PIP esta deshabilitado si no hay cancion actual.
- Like no propaga click al resto del reproductor.

### 5.7 Statistics.jsx

`Statistics.jsx` muestra telemetria global de biblioteca.

Requisitos:

- Cargar overview con `statistics:get-overview` y `pageSize: 50`.
- Mostrar loading shell usando `CollectionInsightsPanel`.
- Mostrar error si falla carga.
- Renderizar `CollectionInsightsPanel` en `mode="library"`.
- Cargar mas ranking con `statistics:get-ranking-page`.
- Fusionar paginas solo si la pagina nueva avanza.
- Reproducir ranking completo:
  - Cargar paginas con `pageSize: 200`.
  - Continuar hasta `hasMore=false`.
  - Reproducir con `playQueueShuffled(rankingTracks, "statistics:<tabId>")`.
- Reproducir biblioteca completa:
  - Cargar `get-all-audio-files`.
  - Cachear resultado en `allTracksCacheRef`.
  - Reproducir con `playQueueShuffled(tracks, "statistics")`.

Criterios de aceptacion:

- Los rankings reproducidos incluyen todas las paginas, no solo la visible.
- Si la biblioteca esta vacia, se muestra empty state y las acciones se deshabilitan.
- Errores de ranking se muestran sin romper la pagina completa.

### 5.8 Feed.jsx

`Feed.jsx` muestra rankings de colecciones.

Requisitos:

- Soportar scopes:
  - `mixed`.
  - `playlists`.
  - `directories`.
- Cachear overview por scope con `overviewCacheRef`.
- Cargar feed con `feed:get-collection-rankings`.
- Manejar respuesta `cacheMiss + refreshing` manteniendo loading/refresco.
- Escuchar `feed:collection-rankings-updated`.
- Al recibir update, invalidar cache del scope y recargar si corresponde.
- Permitir refresh manual con `feed:refresh-collection-rankings`.
- Renderizar cards de ranking:
  - Actividad reciente.
  - Short views.
  - Long views.
  - Duracion total.
  - Duracion acumulada.
  - Repeticiones.
  - Skips.
- Virtualizar la lista activa con `FixedSizeList`.
- Adaptar altura de filas a layouts `default`, `vertical` y `horizontal`.
- Abrir coleccion:
  - Playlist: `/playlists/:path`.
  - Directorio: `/directories/:path/false`.

Criterios de aceptacion:

- Cambiar scope usa cache si existe.
- Refresh manual no duplica listeners.
- El feed mantiene estado de loading compacto en layouts moviles.
- Cargar mas ranking concatena solo la nueva pagina.

### 5.9 CollectionInsightsPanel.jsx

`CollectionInsightsPanel.jsx` es el panel reusable de insights.

Requisitos:

- Soportar `mode="collection"` y `mode="library"`.
- Aceptar rankings precomputados o construir rankings desde `tracks`.
- Mostrar cards para:
  - Duracion.
  - Short views.
  - Long views.
  - Duracion acumulada.
  - Repeticiones.
  - Skips.
- Opcionalmente mostrar tab secundaria `All Songs`.
- Mostrar board activo con valor agregado y acciones.
- Usar covers thumb de top track para cards/board.
- Usar cover de coleccion en modo collection cuando aplique.
- Calcular color dominante para fondo/acento.
- Renderizar `Cola` con:
  - `preserveOrder`.
  - `virtualized`.
  - `virtualizationThreshold=20`.
  - `insightMode` cuando el tab no sea `allSongs`.
  - `insightValueResolver` por metrica.
  - `hasMore`, `isLoading`, `onLoadMore`.
- Permitir reproducir coleccion completa y ranking especifico si se proporcionan callbacks.
- Mostrar skeletons, empty collection y empty ranking.

Criterios de aceptacion:

- El tab `allSongs` solo aparece cuando `showAllSongsTab=true`.
- En layout compacto, los botones de play por card se deshabilitan para evitar UI saturada.
- El panel de biblioteca llena alto disponible.

### 5.10 History.jsx

`History.jsx` muestra historial de escucha paginado.

Requisitos:

- Cargar pagina inicial con `getHistory({ page: 1, pageSize: 10 })`.
- Mantener `items`, `page`, `hasMore`, `isLoading`.
- Evitar cargar pagina ya cargada o request duplicado.
- Al cargar paginas adicionales, deduplicar por `filePath`.
- Permitir refresh manual:
  - Limpiar items.
  - Reiniciar pagina.
  - Reiniciar `hasMore`.
  - Limpiar paginas cargadas.
  - Forzar pagina 1.
- Renderizar `Cola` con:
  - `preserveOrder`.
  - `virtualized`.
  - `groupByTime`.
  - `playbackMode="single"`.
  - `hasMore`, `isLoading`, `onLoadMore`.
  - `onPlayOverride` para abrir detalle.
- Abrir detalle en `/history/song/:filePath`.

Criterios de aceptacion:

- La pagina inicial muestra skeleton.
- Infinite load se dispara cerca del final.
- Refrescar no mantiene duplicados.
- Click en cancion del historial abre detalle, no reproduce lista completa.

### 5.11 SongItem.jsx

`SongItem.jsx` es la fila base memoizada de cancion.

Requisitos:

- Mostrar:
  - Cover lazy.
  - Titulo.
  - Artista.
  - Carpeta contenedora cuando exista.
  - Duracion.
  - Like/unlike.
  - Estado activo con barra de progreso.
  - Valor de insight cuando aplique.
- Ser compatible con listas virtualizadas mediante `style`.
- Abrir menu contextual con:
  - Add to queue.
  - Add later.
  - Add to playlist.
  - Save as playlist.
  - Remove, deshabilitado para directorios.
- El submenu de playlist debe:
  - Cargar playlists al abrir si no estan cargadas.
  - Buscar por nombre.
  - Permitir crear playlist desde query.
  - Añadir track a playlist existente.
  - Evitar submits concurrentes.
- Mantener comparadores memo estrictos para `SongItemView`, `SongItemContainer`, filas virtuales y estilos.

Criterios de aceptacion:

- Cambios de cover, like, active state o insight value rerenderizan solo la fila afectada.
- Like no dispara reproduccion por propagacion.
- Crear o añadir playlist cierra menu y muestra feedback.

### 5.12 HistorySong.jsx

`HistorySong.jsx` muestra detalle historico por cancion.

Requisitos:

- Decodificar `filePath` desde params de ruta.
- Cargar timeline con `history:get-song-timeline`.
- Usar `useSongCover(filePath, "full")`.
- Mostrar estados:
  - Loading.
  - Error con accion volver.
  - Contenido.
- Mostrar hero con cover, titulo y artista.
- Mostrar stats:
  - Total records.
  - Fecha agregada a biblioteca.
  - Ultima reproduccion.
  - Peak day.
- Renderizar chart diario con barras, linea, area y tooltip.
- Mostrar timeline con evento de biblioteca y eventos de reproduccion.
- Volver con `navigate(-1)` si hay historial de navegacion; si no, ir a `/history`.

Criterios de aceptacion:

- Si no hay registros suficientes, el chart muestra estado vacio.
- Fechas invalidas muestran fallback.
- Error de IPC no rompe la app.

### 5.13 ImagesContext.jsx

`ImagesContext.jsx` centraliza covers y cache.

Requisitos:

- Exponer `DEFAULT_COVER`.
- Soportar variantes de cancion:
  - `thumb`: `get-audio-cover-thumbnail`, limite 300.
  - `full`: `get-audio-cover-full`, limite 20.
- Soportar cache de colecciones con limite 150.
- Mantener caches por `Map` y tocar entradas para comportamiento LRU.
- Deduplicar cargas pendientes:
  - Canciones por `filePath` y variante.
  - Colecciones por `coverKey:coverSignature`.
  - Playlist auto covers por `playlist:auto:<path>`.
  - Playlist persisted covers por `coverKey:signature:variant`.
- Convertir buffers/arrays/objectos Buffer a `Blob` y object URL.
- Aceptar data URLs, blob URLs y URLs http(s) como strings validos.
- Usar `DEFAULT_COVER` ante datos invalidos o errores.
- Revocar object URLs:
  - Al podar cache.
  - Al reemplazar entrada.
  - Al revocar imagen individual.
  - Al limpiar cache.
  - Al desmontar provider.
- Notificar cambios de cache de colecciones a subscribers.
- Exponer hooks:
  - `useSongCover(filePath, variant)`.
  - `useCollectionCover(coverKey, coverSignature)`.
- Exponer utilidades:
  - `getSongCoverUrl`.
  - `preloadSongCover`.
  - `preloadVisibleSongCovers`.
  - `getCollectionCoverUrl`.
  - `getCachedCollectionCoverUrl`.
  - `setCollectionCoverBlob`.
  - `ensurePlaylistAutoCover`.
  - `preloadPlaylistCover`.
  - `preloadCollectionCover`.
  - `revokeImage`.
  - `clearImageCache`.

Criterios de aceptacion:

- Covers visibles cargan con fallback inmediato.
- Cargas duplicadas del mismo cover comparten promesa.
- Limpiar cache invalida cargas pendientes por revision.
- No quedan object URLs vivos al desmontar `ImagesProvider`.

## 6. Contratos IPC

### Visual y covers

- `get-audio-cover-thumbnail(filePath)`
- `get-audio-cover-full(filePath)`
- `feed:get-collection-cover({ coverKey, coverSignature })`
- `playlist:ensure-cover({ playlistPath, variant })`
- `playlist:get-cover({ playlistPath, coverHash, variant })`

### Biblioteca

- `get-playlists-minimal()`
- `get-random-playlist()`
- `get-list(playlistPath)`
- `get-all-directories()`
- `get-audio-in-directory(directoryPath)`
- `get-directories-number()`
- `get-random-directory()`

### Telemetria

- `statistics:get-overview({ pageSize })`
- `statistics:get-ranking-page({ tabId, page, pageSize })`
- `feed:get-collection-rankings({ scope, tabId?, page, pageSize })`
- `feed:refresh-collection-rankings({ scope })`
- Evento `feed:collection-rankings-updated({ scope })`

### Historial

- `get-history({ page, pageSize })`
- `history:get-song-timeline({ filePath })`

## 7. Modelo de Datos Minimo

### Track

Campos minimos esperados por la UI:

- `filePath`
- `fileName` o `title`
- `artist`
- `duration`
- `short_view_count`
- `long_view_count`
- `active_listening_seconds`
- `consecutive_repeat_count`
- `skip_count`
- `lastPlayedAt`
- `liked`

### Coleccion

Campos minimos esperados por Feed e insights:

- `type`
- `path`
- `name`
- `coverKey`
- `coverSignature`
- `recentActivityAt`
- `totalShortViews`
- `totalLongViews`
- `totalDuration`
- `totalAccumulatedDuration`
- `totalRepeats`
- `totalSkips`
- `rankings`

### Ranking paginado

Forma minima:

```js
{
  items: [],
  page: 1,
  pageSize: 50,
  total: 0,
  totalValue: 0,
  hasMore: false
}
```

## 8. Estados y Fallos

Cada pantalla debe manejar:

- Loading inicial.
- Loading incremental.
- Empty state.
- Error recuperable.
- Accion deshabilitada mientras exista request activo.

Reglas:

- Un fallo de cover no bloquea listas, reproduccion ni rankings.
- Un fallo de ranking no desmonta `AudioPlayer` ni cola actual.
- Random playlist/directory debe validar fuente y tracks antes de reproducir.
- Requests de paginas no deben duplicar resultados si el usuario dispara cargas repetidas.
- Listeners IPC deben limpiarse al desmontar.

## 9. Performance

Requisitos:

- Butterchurn no debe renderizar a 60 FPS cuando el audio esta pausado.
- `Render.jsx` no debe reconstruir visualizador por resize.
- `QueueTabsPanel` debe cargar datos por tab activo.
- Listas grandes deben usar `react-window`.
- `Cola` debe precargar covers solo de filas visibles y overscan.
- `ImagesContext` debe limitar caches y revocar object URLs.
- Cards y filas de ranking deben usar thumbnails, no covers full.
- `HistorySong` puede usar cover full porque es vista de detalle.

Metricas sugeridas:

- Resize de ventana no incrementa instancias activas de visualizer.
- Cache thumb no supera 300 entradas.
- Cache full no supera 20 entradas.
- Cache collection no supera 150 entradas.
- Scroll de listas grandes mantiene interaccion fluida.

## 10. Accesibilidad

Requisitos:

- Tabs con `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls` y `aria-labelledby`.
- Botones icon-only con `aria-label` o `title`.
- Estados loading con `aria-busy` donde aplique.
- Imagenes decorativas de covers pueden usar `alt=""`; covers principales deben tener alt util cuando el contexto lo requiera.
- Controles PIP agrupados con `role="group"` y label descriptivo.

## 11. Criterios de Aceptacion Globales

- El visualizador no se reinicializa al redimensionar.
- Al pausar audio, el render loop se detiene.
- Picture-in-Picture muestra visualizador si hay audio y empty state si no lo hay.
- Playlists y directorios cargan solo al activar su tab.
- Las listas grandes se mantienen fluidas mediante virtualizacion.
- Random playlist y random directory reproducen una fuente valida o muestran error controlado.
- Statistics y Feed soportan loading, error, empty state, refresh y paginacion.
- Los rankings se reproducen completos, no solo la primera pagina visible.
- History pagina sin duplicar canciones por `filePath`.
- HistorySong muestra grafico o empty state aunque haya pocos registros.
- Covers usan fallback ante errores y liberan blobs al limpiar cache.
- Ninguna pantalla bloquea reproduccion si falla una carga secundaria.

## 12. Plan de Pruebas

### Unitarias

- Formateadores de duracion, metricas y fechas.
- `buildCollectionRankings`.
- `buildCollectionSummaryFromTracks`.
- `getInsightAggregateValue`.
- `getInsightTrackValueLabel`.
- Cache de imagenes: hit, miss, dedupe, prune, revoke y clear.

### Integracion renderer

- Cambio de tabs en `QueueTabsPanel`.
- Carga lazy de playlists.
- Carga lazy de directorios.
- Paginacion en `Statistics`.
- Paginacion en `Feed`.
- Paginacion en `History`.
- Acciones de play ranking.
- Accion play full library shuffled.
- Random playlist y random directory.

### E2E/manual

- Reproducir cancion y abrir `/music`.
- Alternar cover y visualizer.
- Activar y salir de Picture-in-Picture.
- Abrir historial desde cover en Music.
- Abrir historial desde History.
- Crear playlist desde menu contextual de una cancion.
- Añadir cancion a playlist existente.
- Navegar rankings con biblioteca grande.
- Confirmar que scroll virtualizado no presenta congelamientos.

### Performance

- Verificar que caches no superan limites definidos.
- Confirmar que `Cola` precarga solo visibles + overscan.
- Confirmar que visualizador no consume render loop en pausa.
- Confirmar que resize de visualizador no recrea instancia Butterchurn.

## 13. Supuestos

- Elevate mantiene React, Electron IPC, Butterchurn, Prisma/backend actual y `react-window`.
- El PRD describe el estado objetivo inmediato sobre la arquitectura existente.
- Las rutas actuales se mantienen.
- Los contratos IPC existentes se mantienen.
- La UI puede continuar con copy mixto espanol/ingles hasta una iteracion especifica de localizacion.

