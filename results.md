# Results: Comparacion De `ImagesContext.jsx` Vs `report.md`

Este documento compara el reporte original de covers/images/blobs con la app actual despues de crear `src/renderer/src/Contexts/ImagesContext.jsx`.

## Resumen

`ImagesContext.jsx` resolvio el problema central del reporte: ya no hay dos caches principales separadas para canciones y colecciones en renderer. Los covers de canciones, playlists, directories, favourites, search y previews ahora pasan por una coordinacion comun con LRU y revocacion de `blob:`.

Aun asi, siguen vigentes algunos riesgos: el main process todavia transfiere bytes por IPC, los covers de coleccion/directorio siguen generandose como buffers completos, `dataToImageUrl()` sigue existiendo como helper peligroso si alguien lo reutiliza, y hay detalles de invalidacion/cache que conviene ajustar antes de considerar el sistema cerrado.

## Problemas Del Reporte Que Quedaron Resueltos

### 1. Dos Sistemas Paralelos En Renderer

Estado actual: mayormente resuelto.

Antes:

- `useCoverUrl()` manejaba covers de canciones.
- `SupeContext#getImage()` manejaba covers de colecciones.

Ahora:

- `useCoverUrl.js` es un wrapper de compatibilidad hacia `ImagesContext`.
- Los consumidores de `getImage()` migraron a `useImages().getCollectionCoverUrl`.
- `SupeContext.jsx` ya no mantiene `imagesRef` ni expone `getImage`.

Resultado: la app tiene una API central para URLs de imagen en renderer.

### 2. `getImage()` Sin LRU Ni Cleanup Global

Estado actual: resuelto.

`getImage()` fue removido de `SupeContext.jsx`. La cache de colecciones ahora vive en `ImagesContext.jsx` con:

- limite `collection: 150`
- `pruneCache('collection')`
- `revokeUrl()` al reemplazar o expulsar entradas
- cleanup global en `ImagesProvider` al desmontar

Esto elimina el crecimiento indefinido del viejo `Map` de `SupeContext`.

### 3. Cache De Blobs Dispersa

Estado actual: mayormente resuelto.

`ImagesContext.jsx` centraliza:

- `thumb`: 300 entradas
- `full`: 20 entradas
- `collection`: 150 entradas

Tambien centraliza:

- `Blob`
- `URL.createObjectURL`
- `URL.revokeObjectURL`
- preloads pendientes de songs
- placeholders

La cache sigue siendo modular global, pero ahora esta en un solo modulo especializado.

### 4. Responsabilidad De Imagenes En `SupeContext`

Estado actual: parcialmente resuelto.

`SupeContext` ya no contiene cache de imagenes de coleccion ni conversion de blobs. Sigue usando el cover full actual via `useSongCover(currentFile?.filePath, 'full')` para MediaSession, color dominante y taskbar.

Lo que todavia vive en `SupeContext`:

- MediaSession / Windows player
- Discord Rich Presence
- color dominante
- waveform preference
- `isAwaken`
- `toggleStep`

La parte de imagenes fue removida, pero `SupeContext` sigue mezclando varias responsabilidades no relacionadas con imagenes.

### 5. Placeholder Consistente

Estado actual: mejorado.

`ImagesContext.jsx` centraliza `DEFAULT_COVER` y `useCoverUrl.js` lo reexporta. El viejo fallback remoto de `dataToImageUrl()` ya no aparece en los consumidores migrados.

## Problemas Que Siguen Vigentes

### 1. Transferencia De Bytes Por IPC

Estado actual: sigue vigente.

El main process sigue devolviendo covers como `{ data, mimeType }` por IPC en:

- `get-audio-cover-thumbnail`
- `get-audio-cover-full`

El renderer sigue creando blobs a partir de esos bytes. Esto no es incorrecto, pero mantiene los costes descritos en el reporte:

- serializacion por IPC
- memoria duplicada temporalmente
- creacion de blobs en renderer

El riesgo es aceptable para thumbnails. Para `full` covers y collages grandes, sigue siendo un punto de vigilancia.

### 2. Covers De Coleccion Siguen Viajando Como Buffers Completos

Estado actual: sigue vigente.

Playlists, favourites y collection pages pueden recibir covers generados por `sharp` como buffers/data URLs completos. `ImagesContext` controla mejor la vida del blob en renderer, pero no reduce el coste de generar, transportar o retener temporalmente esos buffers.

Esto afecta especialmente:

- collages de playlists
- favourites/likes
- directory detail
- suggested collage previews

### 3. Directories No Tienen Cover Persistente

Estado actual: sigue vigente.

El reporte indicaba que directories no guardan cover propio en Prisma. Eso sigue igual. Cuando se pide detalle de directorio, el main puede generar un cover de coleccion desde tracks.

Problema restante:

- el cover de directorio puede recalcularse en vez de reutilizar una entidad persistida
- no hay `coverHash`/cache durable especifica para directory covers
- search de directories sigue siendo ligero y no trae cover

Esto puede estar bien por ahora, pero sigue siendo una diferencia funcional respecto a playlists.

### 4. `dataToImageUrl()` Sigue Existiendo Y Puede Crear Blobs Sin Control

Estado actual: sigue vigente como riesgo latente.

`src/renderer/src/Contexts/utils.jsx` todavia exporta `dataToImageUrl()`, y esa funcion todavia llama a `URL.createObjectURL()` sin LRU ni cleanup.

Actualmente no quedan usos activos fuera del propio helper, pero si alguien lo reutiliza en una nueva pantalla, puede reintroducir el problema que `ImagesContext` acaba de resolver.

Recomendacion:

- marcarlo como deprecated
- mover cualquier conversion futura a `ImagesContext`
- idealmente eliminarlo cuando no haya compatibilidad pendiente

### 5. Color Dominante Sigue Corriendo En Renderer

Estado actual: sigue vigente.

`SupeContext.jsx` sigue llamando a `extractDominantColor(currentCoverUrl)`. El reporte mencionaba que esta operacion usa canvas y `getImageData()` en renderer.

`ImagesContext` no cambia ese flujo. Aunque ahora el cover full viene de `useSongCover`, el calculo de color sigue siendo trabajo del hilo UI.

Riesgo:

- cambios frecuentes de cancion con covers pesados pueden generar trabajo extra en renderer
- no hay cache explicita por `coverHash` o `filePath` para el color dominante

### 6. `useCoverUrl.js` Sigue Existiendo Como Wrapper

Estado actual: vigente por compatibilidad.

Esto fue intencional: `TrackCard`, `Statistics` y `PlaylistsContex` siguen importando `useCoverUrl`. Ya no es una cache separada, pero el nombre puede ocultar que la fuente real es `ImagesContext`.

No es un bug, pero a mediano plazo conviene migrar esos consumidores a `useSongCover` para que el API publica sea mas clara.

### 7. No Hay Verificacion Runtime De Memoria/Blobs

Estado actual: sigue vigente.

El build valida que compila, pero no demuestra que:

- el numero de blobs vivos se mantiene estable
- el LRU expulsa como se espera en navegacion real
- las URLs revocadas no siguen siendo usadas por alguna vista

Sigue pendiente una prueba manual o instrumentacion de memoria navegando muchas playlists, search results y colas largas.

## Problemas Nuevos O Detalles Detectados En `ImagesContext.jsx`

### 1. `clearImageCache('collection')` Invalida Cargas Pendientes De Songs

`clearImageCache(scope)` incrementa `cacheRevision` siempre. Esa revision se usa para descartar resultados tardios de `preloadSongCover()`.

Efecto secundario:

- si se llama `clearImageCache('collection')` mientras un thumb/full esta cargando, esa carga de song se descarta y devuelve `DEFAULT_COVER`
- el hook que esperaba esa carga puede quedarse con placeholder hasta que cambien sus dependencias o se vuelva a pedir

No es grave si `clearImageCache` se usa poco, pero es una inconsistencia de scope.

Recomendacion:

- usar revision por scope o solo invalidar revision de songs cuando se limpie `thumb`, `full` o `all`

### 2. Firmas De Coleccion Basadas En Identidad De Objeto

`getCollectionSignature(data)` devuelve el objeto original cuando `data` no es string.

Eso funciona si el mismo objeto se mantiene estable en estado. Pero si una pantalla reconstruye un objeto `{ data }` equivalente en cada render, `ImagesContext` lo interpretara como imagen nueva:

- revoca la URL anterior
- crea un nuevo blob
- actualiza el LRU

Recomendacion:

- cuando exista `coverHash`, `suggestedId`, `filePath` o algun id estable, usarlo como parte de la firma
- considerar una firma barata para buffers si aparecen recreaciones frecuentes

### 3. `useSongCover` En El Context Value Puede Confundir

`ImagesContext` exporta `useSongCover` como hook normal y tambien lo incluye en el objeto de contexto.

Usar hooks desde objetos de contexto puede confundir a futuros contributors, porque el nombre empieza con `use` y debe respetar reglas de hooks.

No es un fallo actual porque los consumidores usan el export directo o funciones no-hook. Pero conviene decidir una convencion:

- exportar `useSongCover` solo como named export
- dejar en `useImages()` solo funciones imperativas (`preloadSongCover`, `getCollectionCoverUrl`, etc.)

### 4. `revokeImage(key, scope)` Puede Apuntar A Collection Si Scope Es Invalido

`getCache(scope)` cae a `collection` si el scope no existe. Eso es comodo, pero puede borrar una entrada de collection por error si se llama con un scope mal escrito.

Recomendacion:

- validar scopes permitidos
- no hacer fallback silencioso en operaciones destructivas como `revokeImage` y `clearImageCache`

## Estado De Los Criterios Del Reporte

| Criterio | Estado actual |
| --- | --- |
| Un solo lugar para cache y revocacion de blobs | Cumplido para consumidores migrados |
| Menos responsabilidad en `SupeContext` | Cumplido para imagenes, parcial para el resto |
| API clara para songs/playlists/directories/results/colas | Mayormente cumplido |
| Control de `thumb` vs `full` | Cumplido en renderer |
| Base para medir memoria y rendimiento | Mejorada, pero falta instrumentacion |
| Main process como motor pesado de imagenes | Se mantiene |
| No cambiar Prisma ni IPC | Se mantiene |

## Prioridades Recomendadas

1. Ajustar `clearImageCache` para que la invalidacion sea por scope y no afecte cargas de songs cuando solo se limpia `collection`.
2. Deprecar o eliminar `dataToImageUrl()` para evitar que vuelva el flujo sin cleanup.
3. Migrar los imports restantes de `useCoverUrl` a `useSongCover` cuando se quiera retirar el wrapper.
4. Cachear color dominante por `filePath`, `coverHash` o URL para reducir trabajo de canvas.
5. Evaluar persistencia/cache de covers de directory si el detalle de directorios se vuelve costoso.
6. Hacer una prueba manual de memoria con navegacion intensiva por playlists, search y colas virtualizadas.

## Conclusion

La migracion a `ImagesContext.jsx` resolvio los problemas mas importantes del reporte en el renderer: duplicacion de caches, ausencia de LRU para colecciones y blobs sin cleanup global.

Los problemas que siguen vigentes ya no son principalmente de organizacion en renderer, sino de coste de datos y procesamiento: bytes por IPC, collages/buffers completos, directorios sin cover persistente y color dominante calculado en UI. El nuevo contexto deja la app en una posicion mucho mejor para medir y atacar esos puntos sin volver a dispersar la logica de imagenes.

