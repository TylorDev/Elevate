# Auditoria De Covers, Images Y Blobs

Este reporte documenta como funciona actualmente el sistema de imagenes de Elevate: covers de canciones, covers de playlists/directorios/colecciones, blobs creados en el renderer, caches existentes y puntos de decision para un posible `ImagesContext.jsx`.

No incluye cambios funcionales. El objetivo es tener una base clara antes de decidir si se refactoriza.

## Resumen Ejecutivo

El sistema actual ya tiene una buena separacion parcial: el trabajo pesado de leer audio, extraer metadata, redimensionar imagenes y generar collages ocurre en el main process. El renderer se encarga de pedir esos datos por IPC, convertirlos a URLs renderizables y mostrarlos.

El problema principal no es que las imagenes esten en el lugar equivocado, sino que hay dos flujos paralelos en renderer:

- Covers de canciones: `useCoverUrl()` carga thumbnails/full covers por IPC y crea `blob:` URLs.
- Covers de colecciones: `getImage()` vive en `SupeContext.jsx` y convierte buffers/data URLs de playlists, directorios, favoritos, search y formularios.

Esa duplicacion hace que la politica de cache, limpieza y revocacion de blobs quede dispersa. Un futuro `ImagesContext.jsx` tendria sentido si se limita a coordinar esas URLs en renderer, mientras main process conserva la extraccion y transformacion pesada.

## Flujo Actual De Covers De Canciones

### 1. Lectura De Metadata

La extraccion empieza en el main process, principalmente en `src/main/ipc/utils/utils.mjs`.

Cuando se necesita informacion de una cancion, `getFileInfos()` llama a `getOrCreateSong(filepath, filename)`. Esta funcion usa `music-metadata` mediante `parseFile(filepath)` para leer metadata del archivo de audio.

De ahi se obtiene:

- titulo
- artista
- album
- genero
- duracion
- numero de track
- imagen embebida en `common.picture`

Si la cancion ya existe en Prisma y tiene `metadataLoaded`, se evita parsear el archivo otra vez.

### 2. `coverHash` En Prisma

Si existe una imagen embebida, el main process calcula un hash MD5 del buffer:

```js
coverHash = hashBuffer(Buffer.from(picture.data))
```

Ese `coverHash` se guarda en el modelo `Songs` de Prisma. El hash funciona como identificador estable del cover y permite reutilizar la misma imagen cacheada sin volver a parsear el archivo.

El esquema actual contiene:

```prisma
model Songs {
  filepath  String  @unique
  coverHash String?
}
```

### 3. Cache En Disco

Cuando se encuentra una imagen embebida, el main process crea dos versiones en disco:

- `covers/thumb/{coverHash}.jpg`
- `covers/full/{coverHash}.jpg`

En desarrollo, la base del directorio es el repo. En app empaquetada, la base pasa a `app.getPath('userData')`.

La version `thumb` se genera con `sharp` a 128x128, con `fit: 'cover'` y JPEG comprimido. La version `full` tambien se normaliza a JPEG, con calidad mayor.

Esta decision es buena para rendimiento porque evita mandar imagenes enormes o parsear tags ID3 repetidamente.

### 4. IPC Para Covers

Los covers de canciones se exponen al renderer con dos handlers en `src/main/ipc/filehandlers.mjs`:

- `get-audio-cover-thumbnail`
- `get-audio-cover-full`

Ambos llaman a `getAudioCover(filePath, variant)`.

El orden de resolucion es:

1. Revisar cache en memoria del main process (`audioCoverCache`).
2. Revisar cache en disco con `getCoverFromCache(filePath, variant)`.
3. Si no existe, hacer fallback a `extractAudioCover(filePath)`.
4. Si se pidio `thumb`, redimensionar a 128px.
5. Devolver `{ data, mimeType }` al renderer.

El main process tambien limita su cache en memoria:

- TTL: 10 minutos.
- Limite: 400 entradas.

### 5. Conversion A `blob:` En Renderer

En renderer, `src/renderer/src/hooks/useCoverUrl.js` contiene el flujo de canciones.

Piezas principales:

- `DEFAULT_COVER`: placeholder SVG embebido como data URL.
- `COVER_CONFIG.thumb`: usa IPC `get-audio-cover-thumbnail`, limite 300.
- `COVER_CONFIG.full`: usa IPC `get-audio-cover-full`, limite 20.
- `coverCaches`: `Map` global por variante.
- `pendingCoverLoads`: deduplicacion de cargas concurrentes.
- `toObjectUrl(cover)`: convierte `{ data, mimeType }` en `Blob` y luego en `URL.createObjectURL(blob)`.

`useCoverUrl(filePath, variant)`:

1. Devuelve placeholder si no hay `filePath`.
2. Busca en cache de renderer.
3. Si no existe, deja placeholder temporal.
4. Llama a `preloadCoverUrl(filePath, variant)`.
5. Cuando resuelve, guarda la URL y actualiza el estado local del componente.

Cuando la cache supera su limite, `pruneCache()` elimina entradas antiguas y revoca las URLs `blob:` con `URL.revokeObjectURL`.

Este flujo esta razonablemente optimizado para canciones, especialmente en listas largas.

## Flujo Actual De Playlists, Directories, Likes Y Colecciones

El segundo flujo no pasa por `useCoverUrl()`. En muchos casos, main process genera o devuelve una imagen completa de coleccion y renderer la convierte con `getImage()`.

### 1. Collages Generados En Main Process

Hay varias rutas de generacion de covers de coleccion:

- `generateCover(files)` en `src/main/ipc/utils/utils.mjs`.
- `generateCollectionCoverFromTracks(tracks)` en `src/main/ipc/utils/collectionDetail.mjs`.
- `generatePlaylistCoverFromSelectedImages(selectedItems)` en `src/main/ipc/playlistHandlers.mjs`.

Todas usan `sharp` para redimensionar imagenes y componer collages.

La idea general:

1. Elegir hasta 4 covers relevantes.
2. Leer covers desde cache de disco cuando sea posible.
3. Redimensionar cada tile.
4. Crear un canvas transparente.
5. Componer una grilla.
6. Devolver un buffer PNG.

El ranking suele preferir canciones con mas `short_view_count`.

### 2. Playlists

Las playlists pueden tener distintos modos de cover:

- Automatico: generado desde canciones de la playlist.
- Local image: ruta local seleccionada por el usuario.
- Remote image: URL remota validada.
- Suggested collage: collage a partir de 4 covers sugeridos.

El main process guarda preferencias en columnas de `Playlist`:

- `customCoverMode`
- `customCoverValue`
- `customCoverSelection`
- `customCoverUpdatedAt`

`getEffectiveCover()` resuelve que cover debe usarse:

- Si `customCoverValue` ya es data URL, lo devuelve rapido.
- Si es imagen local, la lee y la redimensiona con `sharp`.
- Si es remota, la descarga con `axios` y la redimensiona.
- Si es collage sugerido, genera un collage.
- Si algo falla, vuelve al fallback automatico.

En endpoints como `search-playlists-page`, `get-list` y `getPlaylistDetail`, el main puede devolver `cover`, `effectiveCover` y `coverConfig`.

### 3. Directories

Los directorios no guardan un cover propio en el modelo Prisma actual. Cuando se pide detalle de un directorio, `getDirectoryDetail(directoryPath)`:

1. Lee los archivos de audio del directorio.
2. Obtiene metadata con `getFileInfos(..., { includePicture: false })`.
3. Genera un cover de coleccion con `generateCollectionCoverFromTracks(tracks)`.
4. Lo incluye en `summary.cover`.

Ese cover llega al renderer como datos de imagen, no como `filePath` de una cancion.

### 4. Likes/Favourites

El flujo de likes usa `generateCover()` sobre canciones favoritas. El resultado se devuelve junto con `fileInfos` y duracion total.

En renderer, paginas como `Favourites.jsx` convierten ese cover con `getImage('Likes', likes.cover)`.

### 5. `getImage()` En `SupeContext.jsx`

`SupeContext.jsx` mantiene:

```js
const imagesRef = useRef(new Map())
```

Y expone `getImage(name, data)`.

Su comportamiento:

1. Busca una entrada previa por `name`.
2. Si la firma es igual, devuelve la URL ya creada.
3. Si existe una URL anterior `blob:` para la misma clave, la revoca.
4. Convierte `data` con `dataToImageUrl(data)`.
5. Guarda `{ url, signature }` en el `Map`.

`dataToImageUrl()` acepta:

- `null` o `undefined`: devuelve imagen default remota.
- string `data:`, `blob:`, `http://`, `https://`: devuelve el string directo.
- `Uint8Array`: crea un `Blob` y luego `blob:`.
- objeto con `.data`: crea un `Blob`.

El punto debil: `getImage()` revoca cuando se reemplaza la misma clave, pero no tiene LRU, no tiene limite de entradas y no hay cleanup global al desmontar el provider.

## Search Y Colas Virtualizadas

### Search De Songs

La busqueda global usa `GlobalSearchContext.jsx`, que invoca:

- `search-songs-page`
- `search-playlists-page`
- `search-directories-page`

Para canciones, el main process devuelve metadata paginada. Los items incluyen `filePath` y `coverHash`, pero no incluyen bytes de imagen.

Eso es correcto: la UI puede pedir thumbnails solo cuando necesite renderizarlos.

### Search De Playlists Y Directories

Para playlists, `search-playlists-page` puede devolver `cover`/`effectiveCover`. Esas imagenes llegan como datos ya resueltos y el renderer las convierte con `getImage()`.

Para directories, `search-directories-page` actualmente devuelve metadata del directorio, pero no genera cover en la busqueda ligera. El cover se calcula en detalle o en vistas que ya tienen summary.

### `SearchEntityList`

`SearchEntityList.jsx` resuelve covers de entidades:

- Playlists: usa `getImage('search-playlist:${item.path}', item.cover)`.
- Songs: el item se renderiza en flujos donde el cover puede cargarse por `filePath`.
- Directories/settings: pueden usar iconos o placeholders.

Esto mezcla el flujo de colecciones con el flujo global de `SupeContext`.

### Colas Virtualizadas

`Cola.jsx` usa `react-window` con `FixedSizeList`.

Para covers:

1. Mantiene `visibleRange`.
2. Calcula `visibleSongs`.
3. Si la lista esta virtualizada, extiende el rango con `overscanCount`.
4. Si no esta virtualizada, precarga solo los primeros items hasta `NON_VIRTUALIZED_COVER_LIMIT`.
5. Ejecuta `preloadCoverUrl(song.filePath, 'thumb')`.
6. Guarda resultado en estado local `coverUrls`.

Este comportamiento es positivo: evita cargar covers de toda una cola enorme. La oportunidad de mejora no es cambiar la idea, sino mover la politica de carga/cancelacion/cache hacia una API central.

## Problemas Actuales

### Dos Sistemas Paralelos

Hoy existen dos formas de resolver imagenes:

- `useCoverUrl()` para covers de canciones por `filePath`.
- `getImage()` para covers ya serializados de colecciones.

Ambas crean o administran URLs renderizables, pero no comparten API ni politicas de memoria.

### Cache De Blobs Dispersa

`useCoverUrl.js` tiene LRU y revocacion al podar cache. `getImage()` tiene un `Map` persistente sin limite.

Esto crea comportamientos distintos:

- Songs tienen proteccion contra crecimiento excesivo.
- Colecciones, playlists, search y formularios pueden acumular entradas indefinidamente si se navega mucho.

### `getImage()` Sin LRU Ni Cleanup Global

`getImage()` revoca solo cuando una misma clave recibe datos distintos. Si las claves son siempre nuevas, por ejemplo muchas playlists o resultados de search, el `Map` crece.

Ademas, no se observa un cleanup que recorra `imagesRef.current` y revoque todos los blobs al desmontar `SuperProvider`.

### Responsabilidad Mezclada En `SupeContext`

`SupeContext.jsx` ya no es tan grande como versiones anteriores porque existen `PlaybackProvider`, `QueueProvider`, `PlaybackProgressProvider` y `BackgroundProvider`. Aun asi, conserva responsabilidades mezcladas:

- cache de imagenes de coleccion
- cover full de cancion actual
- MediaSession / Windows player
- Discord Rich Presence
- color dominante
- preferencias visuales como waveform
- estado `isAwaken`

Mover imagenes fuera de `SupeContext` reduciria acoplamiento y permitiria limpiar consumidores de `useSuper()`.

### Riesgo De Memoria Por `blob:` No Revocados

Toda URL creada con `URL.createObjectURL()` debe revocarse cuando deja de usarse. Si no, el navegador mantiene vivo el backing store del blob.

El flujo de canciones ya intenta controlar esto. El flujo de colecciones no tiene la misma garantia.

### Transferencia De Bytes Por IPC

El main process devuelve bytes al renderer para covers. Eso es simple y funciona, pero tiene coste:

- serializacion por IPC
- memoria duplicada temporalmente
- creacion de blobs en renderer

No es necesariamente un bug. Para thumbnails y covers pequenos es aceptable. Para full covers y collages grandes conviene mantener limites estrictos.

## Que Debe Quedarse En Main Process

El main process debe conservar todo lo que sea IO, procesamiento pesado o dependiente de Node/Electron:

- Leer archivos de audio.
- Parsear metadata con `music-metadata`.
- Calcular `coverHash`.
- Escribir y leer `covers/thumb` y `covers/full`.
- Redimensionar con `sharp`.
- Generar collages.
- Validar/leer imagenes locales.
- Descargar y normalizar imagenes remotas.
- Mantener cache en memoria de buffers con TTL.

Motivos:

- Evita bloquear el hilo UI.
- Usa librerias nativas como `sharp`.
- Tiene acceso directo al filesystem.
- Ya cuenta con Prisma y cache persistente.

## Que Debe Moverse O Centralizarse En Renderer

El renderer debe manejar lo relacionado con presentacion y vida de URLs:

- Crear `Blob` y `URL.createObjectURL`.
- Reutilizar URLs mientras una vista las necesite.
- Revocar `blob:` URLs cuando sean reemplazadas, expulsadas o al desmontar.
- Precargar covers visibles en colas virtualizadas.
- Exponer placeholders consistentes.
- Separar `thumb` y `full` para evitar cargas grandes innecesarias.

Esto no significa mover procesamiento de imagen al renderer. Significa centralizar la coordinacion de imagenes UI.

## Que Resolveria Un Futuro `ImagesContext.jsx`

Un `ImagesContext.jsx` tendria valor si ofrece una API unica para ambos flujos:

- `useSongCover(filePath, variant)`
- `preloadSongCover(filePath, variant)`
- `getSongCoverUrl(filePath, variant)`
- `getCollectionCoverUrl(key, data)`
- `preloadVisibleSongCovers(songs, options)`
- `revokeImage(key)`
- `clearImageCache(scope)`
- `DEFAULT_COVER`

Tambien deberia definir caches separadas:

- `thumb`: muchas entradas, bajo peso.
- `full`: pocas entradas, uso enfocado en current song/player.
- `collection`: covers de playlists, likes, directories y search.

Politicas recomendadas iniciales:

- `thumb`: limite aproximado de 300 entradas.
- `full`: limite aproximado de 20 entradas.
- `collection`: limite aproximado de 100 a 150 entradas.

El provider deberia limpiar todas las URLs `blob:` en su cleanup.

## Beneficios De Crear `ImagesContext.jsx`

- Un solo lugar para cache y revocacion de blobs.
- Menos responsabilidad en `SupeContext`.
- API mas clara para songs, playlists, directories, results y colas.
- Mejor control de full covers versus thumbnails.
- Mejor base para medir memoria y rendimiento.
- Menos duplicacion entre `useCoverUrl()` y `getImage()`.

## Riesgos De Crear `ImagesContext.jsx`

- Toca muchos consumidores visuales.
- Puede romper covers en playlists/search si no se conserva compatibilidad temporal.
- Puede causar renders extra si el context value no se memoiza bien.
- Puede duplicar cache durante la migracion si `useCoverUrl()` y el nuevo context conviven mal.

Para reducir riesgo, conviene migrar en dos pasos:

1. Crear el context y hacer que `useCoverUrl()` delegue internamente.
2. Migrar consumidores de `getImage()` desde `useSuper()` hacia `useImages()` por grupos pequenos.

## Criterios Para Decidir

Crear `ImagesContext.jsx` es recomendable si el objetivo es:

- reducir fugas potenciales de blobs
- limpiar `SupeContext`
- unificar covers de songs y colecciones
- preparar mejor soporte para listas virtualizadas y search
- controlar con precision cuando se usan thumbs y full covers

No seria urgente si:

- la prioridad actual es solo funcionalidad visible
- no hay sintomas de memoria
- no se planea tocar UI de playlists/search/cola pronto

La decision tecnica mas segura es mantener main process como motor de imagenes y crear `ImagesContext.jsx` solo como administrador del ciclo de vida de URLs en renderer.

## Validacion De Este Reporte

Este cambio es solo documentacion.

No se ejecutaron build, lint ni tests porque no se modifico codigo funcional. La validacion necesaria es revisar que este archivo exista en la raiz y contenga el analisis completo del sistema actual.

