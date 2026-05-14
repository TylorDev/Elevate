# Plan: añadir formulario de edición de playlist con `Nombre` y `Cover`

## Resumen

El sistema ya tiene una base útil:

- [PlaylistPage.jsx](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Pages/PlaylistPage/PlaylistPage.jsx) ya abre un modal de edición
- [PlaylistForm.jsx](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/PlaylistForm/PlaylistForm.jsx) ya edita `nombre`
- el backend ya sabe generar un cover automático a partir de canciones de la playlist en [playlistHandlers.mjs](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/main/ipc/playlistHandlers.mjs)

Pero hoy faltan tres piezas clave:

1. la playlist **no tiene un campo persistente de cover personalizado**
2. no existe un endpoint para obtener **las 10 canciones con más `short_view_count` dentro de esa playlist**
3. el formulario no tiene UI para elegir:
   - collage de 4 imágenes entre 10 sugeridas
   - imagen local
   - imagen remota por URL

La implementación correcta es:

- mantener el nombre editable **solo en DB**
- añadir soporte de **cover personalizado persistido**
- seguir usando el cover automático actual como fallback
- hacer que el formulario permita elegir entre:
  - collage manual 4-de-10
  - imagen local
  - URL

## Problemas actuales que hay que resolver

### 1. `Playlist` no guarda cover personalizado

En el backend, el cover de playlist se calcula en tiempo real con `generateCover(...)` y se cachea en memoria. No hay un campo tipo `customCover`.

Eso significa que si el usuario edita un cover:

- hoy no hay dónde persistirlo
- al recargar se perdería

### 2. `PlaylistForm.jsx` solo edita texto

El formulario actual en [PlaylistForm.jsx](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/PlaylistForm/PlaylistForm.jsx) solo maneja:

- `path`
- `nombre`
- métricas de solo lectura

No hay estados ni controles para cover.

### 3. `get-list` devuelve solo el cover automático actual

En [playlistHandlers.mjs](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/main/ipc/playlistHandlers.mjs), `get-list`:

- procesa canciones
- genera `cover` automático
- devuelve `processedData`, `playlistData`, `cover`

No devuelve:

- top 10 sugeridas por shortviews
- cover personalizado resuelto
- tipo de cover activo

### 4. `change-list-name` es demasiado limitado

El handler `change-list-name` hoy en realidad llama `updatePlaylistByPath(filepath, newData)` pero:

- no devuelve una respuesta clara
- no está pensado como “update playlist metadata”
- el nombre sugiere que solo cambia el nombre

Conviene reemplazarlo por un handler más explícito.

---

## Fase 1: persistencia del cover personalizado

### Paso 1. Añadir almacenamiento persistente para cover personalizado

**Archivo:** [prisma/schema.prisma](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/prisma/schema.prisma)

Añadir a `Playlist` campos para guardar el cover personalizado sin tocar el archivo `.m3u`.

Campos recomendados:

- `customCoverMode String?`
  - valores esperados: `'suggested-collage' | 'local-image' | 'remote-image'`
- `customCoverValue String?`
  - para local o URL remota: referencia persistida
- `customCoverSelection String?`
  - JSON con las 4 selecciones cuando sea collage manual
- opcionalmente `customCoverUpdatedAt DateTime?`

**Autoverificación:**

- el schema compila sin errores
- existe una migración nueva solo para estos campos

### Paso 2. Crear migración Prisma

**Archivo:** nueva migración en `prisma/migrations/...`

Generar la migración que agrega esos campos.

**Autoverificación:**

- la migración contiene solo los `ALTER TABLE` necesarios
- no modifica datos existentes no relacionados

---

## Fase 2: backend para covers sugeridos y actualización de metadata

### Paso 3. Crear helper para top 10 por shortviews dentro de una playlist

**Archivo:** [src/main/ipc/playlistHandlers.mjs](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/main/ipc/playlistHandlers.mjs)

Añadir una función nueva que:

1. lea las canciones de la playlist
2. obtenga para cada canción:
   - `filePath`
   - `title`
   - `artist`
   - `coverHash` o cover disponible
   - `short_view_count`
3. ordene por `short_view_count` descendente
4. devuelva las 10 primeras

No basta con `processPlaylistCover(...)` actual, porque necesitas devolver datos utilizables en UI, no solo lo mínimo para collage automático.

**Autoverificación:**

- para una playlist con datos, la función devuelve máximo 10 canciones
- el primer elemento tiene `short_view_count >=` el segundo
- canciones sin cover no rompen la lista

### Paso 4. Crear helper para construir collage manual de 4 imágenes

**Archivo:** [src/main/ipc/playlistHandlers.mjs](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/main/ipc/playlistHandlers.mjs) o helper nuevo en `utils.mjs`

Añadir una función que reciba exactamente 4 imágenes fuente y genere un cover 2x2.

No modificar `generateCover(files)` existente para este caso si eso complica el comportamiento actual. Es mejor un helper nuevo, por ejemplo:

- `generatePlaylistCoverFromSelectedImages(selectedItems)`

**Autoverificación:**

- con 4 imágenes válidas devuelve un cover válido
- con menos de 4 falla con error claro
- no cambia el comportamiento del cover automático actual

### Paso 5. Crear resolver de “cover efectivo”

**Archivo:** [src/main/ipc/playlistHandlers.mjs](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/main/ipc/playlistHandlers.mjs)

Crear una función única que devuelva el cover que realmente debe usar la playlist:

1. si hay `customCoverMode` activo y válido, usar cover personalizado
2. si no, usar `getCachedPlaylistCover(...)`

Esto evita duplicar la lógica en:

- `get-playlists`
- `get-list`
- búsqueda de playlists

**Autoverificación:**

- playlist sin custom cover sigue mostrando cover automático
- playlist con custom cover muestra el personalizado

### Paso 6. Ampliar `get-list`

**Archivo:** [src/main/ipc/playlistHandlers.mjs](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/main/ipc/playlistHandlers.mjs)

Modificar el handler `get-list` para que además de `processedData`, `playlistData` y `cover`, devuelva:

- `suggestedCovers`
- `effectiveCover`
- `coverConfig` o metadata equivalente del cover personalizado

**Autoverificación:**

- el payload de `get-list` incluye esos campos nuevos
- si no hay custom cover, `coverConfig` viene vacío pero `suggestedCovers` sí existe

### Paso 7. Crear handler dedicado para actualizar metadata de playlist

**Archivo:** [src/main/ipc/playlistHandlers.mjs](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/main/ipc/playlistHandlers.mjs)

Crear un IPC nuevo, por ejemplo:

- `update-playlist-metadata`

Debe aceptar:

- `path`
- `nombre`
- `coverMode`
- `coverValue`
- `coverSelection`

Reglas:

- `nombre` actualiza solo la DB
- nunca renombra el archivo real `.m3u`
- si cover es collage manual, validar 4 selecciones exactas
- si cover es local/url, guardar referencia persistente
- invalidar caché de cover de esa playlist

**Autoverificación:**

- actualizar nombre cambia la UI pero no el path del archivo
- actualizar cover persiste tras recargar la página

### Paso 8. Mantener o deprecar `change-list-name`

**Archivo:** [src/main/ipc/playlistHandlers.mjs](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/main/ipc/playlistHandlers.mjs)

No reutilizar `change-list-name` para todo.
Déjalo temporalmente o reemplázalo internamente, pero el formulario nuevo debe usar el handler explícito nuevo.

**Autoverificación:**

- no queda ambigüedad entre “editar nombre” y “editar metadata completa”

---

## Fase 3: contexto y consumo en renderer

### Paso 9. Añadir método nuevo en `PlaylistsContex`

**Archivo:** [src/renderer/src/Contexts/PlaylistsContex.jsx](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/PlaylistsContex.jsx)

Agregar una función nueva, por ejemplo:

- `updatePlaylistMetadata(path, payload)`

Esta debe:

1. invocar `update-playlist-metadata`
2. refrescar playlists con `getSavedLists({ force: true })`
3. devolver respuesta clara
4. mostrar toast de error si falla

**Autoverificación:**

- el contexto expone la nueva función
- la llamada devuelve `success: true/false`
- refresca la playlist editada tras guardar

### Paso 10. Mantener compatibilidad con `PlaylistPage`

**Archivo:** [src/renderer/src/Pages/PlaylistPage/PlaylistPage.jsx](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Pages/PlaylistPage/PlaylistPage.jsx)

Cambiar el modal para usar:

- `onUpdate={updatePlaylistMetadata}`

Asegurarse de que `current` use el `effectiveCover` nuevo en vez de depender solo de `current.cover`.

**Autoverificación:**

- al guardar desde el formulario, la portada mostrada en la página cambia
- el modal sigue abriendo/cerrando igual

---

## Fase 4: formulario de edición de playlist

### Paso 11. Rediseñar el estado del formulario

**Archivo:** [src/renderer/src/components/PlaylistForm/PlaylistForm.jsx](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/PlaylistForm/PlaylistForm.jsx)

Reemplazar el `formData` plano actual por estado estructurado:

- `nombre`
- `coverMode`
  - `'suggested-collage'`
  - `'local-image'`
  - `'remote-image'`
- `selectedSuggestedCoverIds`
- `localImageValue`
- `remoteImageValue`
- `previewUrl`
- `errorMessage`
- `isSubmitting`

El `path` sigue existiendo, pero solo como identificador no editable.

**Autoverificación:**

- el formulario sigue cargando valores iniciales al abrirse
- no rompe si una playlist no tiene custom cover

### Paso 12. Mostrar solo el campo editable de nombre

**Archivo:** [PlaylistForm.jsx](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/PlaylistForm/PlaylistForm.jsx)

Mantener editable:

- `Nombre`

Mantener el `path` solo como texto informativo o input deshabilitado.

Quitar del foco de edición:

- `duracion`
- `numElementos`
- `totalplays`

Pueden mostrarse como metadata, pero no como inputs del formulario.

**Autoverificación:**

- el usuario solo puede editar nombre y cover
- ya no parece un formulario genérico de DB

### Paso 13. Añadir selector de modo de cover

**Archivo:** [PlaylistForm.jsx](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/PlaylistForm/PlaylistForm.jsx)

Agregar una UI para elegir uno de 3 modos:

- `Sugeridos`
- `Imagen local`
- `URL`

**Autoverificación:**

- al cambiar modo, cambia el bloque visible correspondiente
- no se mezclan inputs de distintos modos

### Paso 14. Añadir bloque de covers sugeridos

**Archivo:** [PlaylistForm.jsx](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/PlaylistForm/PlaylistForm.jsx)

Mostrar las 10 sugerencias derivadas de `suggestedCovers`.

Cada sugerencia debe mostrar:

- cover
- nombre o título breve
- indicador de shortviews opcional si ayuda al usuario

Permitir seleccionar exactamente 4.

Reglas:

- si selecciona una quinta, bloquear o reemplazar solo si decides una regla clara
- preferible: bloquear con mensaje “Selecciona solo 4 imágenes”

**Autoverificación:**

- se pueden seleccionar 4
- no se permiten 3 al guardar
- la selección se refleja visualmente

### Paso 15. Añadir preview del collage seleccionado

**Archivo:** [PlaylistForm.jsx](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/PlaylistForm/PlaylistForm.jsx)

Cuando haya 4 sugeridas seleccionadas:

- mostrar preview del collage resultante
- si no quieres generarlo en frontend, mostrar una preview simple 2x2 local de esas 4 imágenes

**Autoverificación:**

- seleccionar 4 imágenes muestra una preview coherente
- cambiar una selección actualiza la preview

### Paso 16. Añadir bloque para imagen local

**Archivo:** [PlaylistForm.jsx](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/PlaylistForm/PlaylistForm.jsx)

Añadir:

- botón `Elegir imagen`
- preview
- estado de error

Este paso asume que existe o se creará el flujo de selección local tipo `Settings`. Si aún no existe, el plan debe reutilizar el mismo mecanismo que vayas a introducir allí.

**Autoverificación:**

- elegir una imagen local llena el preview
- cancelar selección no rompe el formulario

### Paso 17. Añadir bloque para URL

**Archivo:** [PlaylistForm.jsx](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/PlaylistForm/PlaylistForm.jsx)

Añadir:

- input de URL
- botón de aplicar/cargar
- preview
- error claro

Idealmente reutilizar la misma validación que `Settings` vaya a usar para URL de imagen.

**Autoverificación:**

- URL válida muestra preview
- URL inválida muestra error claro y no pisa el cover actual

### Paso 18. Validar antes de guardar

**Archivo:** [PlaylistForm.jsx](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/PlaylistForm/PlaylistForm.jsx)

Antes del submit:

- `nombre` no vacío
- si `coverMode === suggested-collage`, debe haber exactamente 4 imágenes
- si `coverMode === local-image`, debe haber imagen local válida
- si `coverMode === remote-image`, debe haber URL validada

**Autoverificación:**

- cada error bloquea el submit con mensaje claro
- un formulario válido sí guarda

### Paso 19. Enviar payload final al backend

**Archivo:** [PlaylistForm.jsx](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/PlaylistForm/PlaylistForm.jsx)

Al guardar:

- enviar `path`
- enviar `nombre`
- enviar `coverMode`
- enviar `coverValue`
- enviar `coverSelection`

Cerrar modal solo después de respuesta exitosa.

**Autoverificación:**

- si el backend falla, el modal permanece abierto
- si guarda bien, se cierra y se refresca la playlist

---

## Fase 5: estilos del formulario

### Paso 20. Rediseñar `PlaylistForm.scss`

**Archivo:** [src/renderer/src/components/PlaylistForm/PlaylistForm.scss](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/PlaylistForm/PlaylistForm.scss)

Añadir estilos para:

- layout de secciones
- selector de modo de cover
- grid de 10 sugerencias
- estado seleccionado
- preview del collage
- preview local/URL
- errores inline

Evitar un formulario largo y genérico; debe sentirse como editor de playlist.

**Autoverificación:**

- la grilla de 10 covers es navegable
- las 4 selecciones se distinguen claramente
- el formulario sigue usable en tamaños medianos

---

## Orden recomendado de implementación

1. Añadir campos a `Playlist` en Prisma
2. Crear migración
3. Crear helper backend para top 10 por shortviews
4. Crear resolver de cover efectivo
5. Ampliar `get-list`
6. Crear `update-playlist-metadata`
7. Añadir `updatePlaylistMetadata` al contexto
8. Conectar `PlaylistPage.jsx`
9. Rediseñar `PlaylistForm.jsx` estado base
10. Añadir edición de nombre
11. Añadir modo `Sugeridos`
12. Añadir selección exacta de 4 imágenes
13. Añadir preview de collage
14. Añadir modo `Imagen local`
15. Añadir modo `URL`
16. Añadir validación de submit
17. Rediseñar `PlaylistForm.scss`

## Casos de prueba

- Editar solo `nombre` cambia el nombre en UI sin cambiar el archivo `.m3u`.
- Seleccionar 4 de 10 covers sugeridos guarda y persiste.
- Seleccionar menos de 4 en modo sugeridos bloquea el guardado.
- Elegir imagen local válida guarda y persiste.
- Introducir URL válida guarda y persiste.
- Reabrir la playlist muestra el cover personalizado.
- Quitar custom cover y volver a automático muestra el collage generado por shortviews como antes.
- Playlist sin suficientes covers útiles no rompe el formulario; muestra las sugerencias disponibles y un estado claro si no alcanza para collage manual.

## Supuestos cerrados

- El nombre editable es solo `playlist.nombre` en DB; el archivo real `.m3u` no se renombra.
- El cover personalizado debe persistir y sobrescribir visualmente el cover automático.
- El cover automático actual sigue existiendo como fallback.
- La selección “4 de 10 sugeridas” genera un collage manual, no solo guarda referencias visuales sin composición.
- La carga de imagen local y por URL reutilizará, cuando sea posible, la misma estrategia de validación segura que se implemente para `Settings`.
