# Reporte de Uso y Visualización de Toasts en Elevate

Este documento presenta una auditoría completa del sistema de notificaciones **Toast** en la aplicación Elevate. El sistema está construido sobre la biblioteca `react-toastify` y se utiliza para proporcionar feedback inmediato y no intrusivo al usuario sobre acciones de reproducción, gestión de playlists, biblioteca y estado del sistema.

---

## 1. Configuración Global (`ToastContainer`)

El contenedor principal que renderiza y gestiona las colas de notificaciones se encuentra montado en el layout principal de la aplicación:

* **Archivo de Montaje**: [Main.jsx](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Layouts/Main/Main.jsx#L57)
* **Ubicación en el DOM**: Se renderiza al final del componente wrapper `Main` para asegurar que las notificaciones floten por encima de todos los componentes visuales (como el visualizador de audio, la barra de estado y el reproductor).

```jsx
// src/renderer/src/Layouts/Main/Main.jsx
<ToastContainer />
```

---

## 2. Mapa Detallado de Usos por Componente y Contexto

A continuación se detallan todas las llamadas activas del método `toast` organizadas por capa arquitectónica.

### 2.1. Gestión de Favoritos (`LikeContext.jsx`)
Usa notificaciones con una duración de **1000 ms** para confirmar de manera rápida cuando una pista es agregada o removida de favoritos.

* **Likes de Canciones (`likesong`)**:
  * **Tipo**: `toast.success`
  * **Mensaje**: `"liked"`
  * **Configuración**: `position: 'bottom-right', autoClose: 1000, theme: 'dark'`
  * **Ubicación**: [LikeContext.jsx:L88-97](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/LikeContext.jsx#L88-L97)
* **Dislikes de Canciones (`unlikesong`)**:
  * **Tipo**: `toast.warning`
  * **Mensaje**: `"disliked"`
  * **Configuración**: `position: 'bottom-right', autoClose: 1000, theme: 'dark'`
  * **Ubicación**: [LikeContext.jsx:L103-112](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/LikeContext.jsx#L103-L112)

---

### 2.2. Gestión de Playlists (`PlaylistsContex.jsx`)
Muestra feedback informativo sobre el guardado, la exportación y la actualización de playlists M3U. Utiliza animaciones `Bounce` de `react-toastify`.

* **Error en Actualización de Metadatos**:
  * **Tipo**: `toast.error`
  * **Mensaje**: Dinámico (`response.error || 'Error al actualizar la playlist'`)
  * **Ubicación**: [PlaylistsContex.jsx:L189-199](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/PlaylistsContex.jsx#L189-L199)
* **Validación de Playlist sin Canciones**:
  * **Tipo**: `toast.error`
  * **Mensaje**: `"No hay canciones para guardar."` o `"No hay canciones para exportar."`
  * **Ubicaciones**: [PlaylistsContex.jsx:L258](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/PlaylistsContex.jsx#L258) y [PlaylistsContex.jsx:L337](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/PlaylistsContex.jsx#L337)
* **Error de Guardado de Playlist**:
  * **Tipo**: `toast.error`
  * **Mensaje**: Dinámico (`error?.message || 'No se pudo guardar la playlist.'`)
  * **Ubicaciones**: [PlaylistsContex.jsx:L282](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/PlaylistsContex.jsx#L282) y [PlaylistsContex.jsx:L298](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/PlaylistsContex.jsx#L298)
* **Playlist Guardada con Éxito**:
  * **Tipo**: `toast.success`
  * **Mensaje**: `"Playlist guardada: {result.playlistName}"`
  * **Ubicación**: [PlaylistsContex.jsx:L314-324](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/PlaylistsContex.jsx#L314-L324)
* **Error de Exportación de Playlist**:
  * **Tipo**: `toast.error`
  * **Mensaje**: Dinámico (`error?.message || 'No se pudo exportar la playlist.'`)
  * **Ubicaciones**: [PlaylistsContex.jsx:L359](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/PlaylistsContex.jsx#L359) y [PlaylistsContex.jsx:L375](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/PlaylistsContex.jsx#L375)
* **Playlist Exportada con Éxito**:
  * **Tipo**: `toast.success`
  * **Mensaje**: `"Playlist exportada: {result.playlistName}"`
  * **Ubicación**: [PlaylistsContex.jsx:L391](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/PlaylistsContex.jsx#L391)
* **Notificaciones del Sistema e IPC (`handleNotification`)**:
  * **Tipo**: `toast.success`
  * **Mensaje**: Dinámico enviado por IPC (`message || 'Completado!'`)
  * **Nota**: Filtra y omite los eventos de tipo `scan-progress` para evitar saturación visual durante el escaneo.
  * **Ubicación**: [PlaylistsContex.jsx:L433](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/PlaylistsContex.jsx#L433)

---

### 2.3. Cola de Reproducción (`QueueContext.jsx`)
Muestra el éxito de las operaciones directas sobre la cola activa.

* **Remover Pista de la Cola Activa (`removeFromCurrentQueue`)**:
  * **Tipo**: `toast.success`
  * **Mensaje**: `"Eliminada correctamente!"`
  * **Ubicación**: [QueueContext.jsx:L272-282](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/QueueContext.jsx#L272-L282)
* **Remover Pista de una Playlist Guardada (`removeTrack`)**:
  * **Tipo**: `toast.success` (ejecutado con un delay de `1000ms` tras actualizar el archivo mediante IPC)
  * **Mensaje**: `"Eliminada correctamente!"`
  * **Ubicación**: [QueueContext.jsx:L453-463](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/QueueContext.jsx#L453-L463)
* **Agregar Canción a una Playlist Guardada (`addSong`)**:
  * **Tipo**: `toast.success`
  * **Mensaje**: `"Agregada: {result.songName}"`
  * **Ubicación**: [QueueContext.jsx:L491-501](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/QueueContext.jsx#L491-L501)

---

### 2.4. Logros de Visualización de Audio (`AudioContext.jsx`)
Mapea el sistema de "recompensas" de visualización de audio según la duración de la pista escuchada de manera activa. Usa un objeto de configuración unificado `TOAST_OPTIONS`.

* **Configuración Unificada**:
  ```javascript
  const TOAST_OPTIONS = {
    position: 'bottom-right',
    autoClose: 1400,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    progress: undefined,
    theme: 'dark'
  }
  ```
* **Visualización Corta Alcanzada (`SHORT_VIEW_MS` = 10 seg)**:
  * **Tipo**: `toast.success`
  * **Mensaje**: `"+1 short views"`
  * **Ubicación**: [AudioContext.jsx:L162](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/AudioContext.jsx#L162)
* **Visualización Larga Alcanzada (Escucha >= 80% de la pista)**:
  * **Tipo**: `toast.success`
  * **Mensaje**: `"+1 long views"`
  * **Ubicación**: [AudioContext.jsx:L183](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/AudioContext.jsx#L183)

---

### 2.5. Utilidades e Invokes IPC Genéricos (`utils.jsx`)
El sistema de utilidades encapsula las peticiones IPC de Electron y adjunta notificaciones automáticas en caso de éxito/error de operaciones genéricas.

* **Operación Exitosa en Getter (`ElectronGetter`)**:
  * **Tipo**: `toast.success`
  * **Nota**: Comentado por defecto en la base del código actual para evitar spam visual en cargas de colecciones rutinarias.
  * **Ubicación**: [utils.jsx:L62](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/utils.jsx#L62)
* **Error en Getter (`ElectronGetter` / `ElectronGetter2`)**:
  * **Tipo**: `toast.error`
  * **Mensaje**: Dinámico (`error.message || 'Error desconocido'`)
  * **Ubicaciones**: [utils.jsx:L80](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/utils.jsx#L80) y [utils.jsx:L116](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/utils.jsx#L116)
* **Eliminación Exitosa (`ElectronDelete`)**:
  * **Tipo**: `toast.warning`
  * **Mensaje**: Dinámico enviado al helper (`message || 'Eliminado!'`)
  * **Ubicación**: [utils.jsx:L100](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/utils.jsx#L100)
* **Errores en Setters (`ElectronSetter` / `ElectronSetter2` / `ElectronSetter3` / `ElectronSetter4`)**:
  * **Tipo**: `toast.error`
  * **Mensaje**: Dinámico de error devuelto
  * **Ubicaciones**: [utils.jsx:L140](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/utils.jsx#L140), [utils.jsx:L164](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/utils.jsx#L164), [utils.jsx:L189](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/utils.jsx#L189), [utils.jsx:L218](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/utils.jsx#L218)

---

### 2.6. Vistas y Páginas de Usuario

#### `Music.jsx` (Sección de Configuración y Gestión de Presets del Visualizador)
* **Guardado de Preset**:
  * **Tipo**: `toast.success`
  * **Mensaje**: `"Preset guardado!"`
  * **Ubicación**: [Music.jsx:L283](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Pages/Music/Music.jsx#L283)
* **Error en Creación de Preset**:
  * **Tipo**: `toast.error`
  * **Mensaje**: `"No se pudo crear la preset list"`
  * **Ubicación**: [Music.jsx:L327](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Pages/Music/Music.jsx#L327)
* **Preset Eliminado con Éxito**:
  * **Tipo**: `toast.success`
  * **Mensaje**: `"Preset eliminado de {effectivePresetList.name}"`
  * **Ubicación**: [Music.jsx:L357](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Pages/Music/Music.jsx#L357)
* **Error al Eliminar Preset**:
  * **Tipo**: `toast.error`
  * **Mensaje**: `"No se pudo eliminar el preset de la lista actual"`
  * **Ubicación**: [Music.jsx:L360](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Pages/Music/Music.jsx#L360)

#### `CollectionPage.jsx`
* **Error al Abrir Directorio en Explorador**:
  * **Tipo**: `toast.error`
  * **Mensaje**: Dinámico (`result?.error || 'No se pudo abrir el explorador.'`)
  * **Ubicación**: [CollectionPage.jsx:L376](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Pages/CollectionPage/CollectionPage.jsx#L376)
* **Error al Compilar/Guardar Playlist desde Vista**:
  * **Tipo**: `toast.error`
  * **Mensaje**: Dinámico (`result?.error || 'No se pudo crear la playlist.'`)
  * **Ubicación**: [CollectionPage.jsx:L413](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Pages/CollectionPage/CollectionPage.jsx#L413)

#### `CollectionAddToPlaylistModal.jsx` (Modal de Guardado)
* **Error de Inserción Masiva**:
  * **Tipo**: `toast.error`
  * **Mensaje**: `"No se pudieron agregar las canciones."`
  * **Ubicación**: [CollectionAddToPlaylistModal.jsx:L32](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/CollectionAddToPlaylistModal/CollectionAddToPlaylistModal.jsx#L32)
* **Inserción Masiva Exitosa**:
  * **Tipo**: `toast.success`
  * **Mensaje**: `"Se agregaron {filePaths.length} canciones correctamente"`
  * **Ubicación**: [CollectionAddToPlaylistModal.jsx:L46](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/CollectionAddToPlaylistModal/CollectionAddToPlaylistModal.jsx#L46)

---

## 3. Patrón de Diseño y Consistencia de Toasts

* **Tema Visual**: Prácticamente el 100% de los toasts utilizan `theme: 'dark'` para integrarse de forma nativa con la estética del reproductor de música.
* **Duración**: La duración estándar es de **3000 ms** para notificaciones complejas, acortada a **1000-1400 ms** para acciones inmediatas frecuentes (Favoritos, Recompensas de escucha) con el fin de mejorar la fluidez de interacción.
* **Transiciones**: Se utiliza `transition: Bounce` mayoritariamente en la capa de listas de reproducción para dar un impacto alegre y dinámico.
* **Estilo CSS**: En `SongItem.jsx` (Línea 8), se realiza la importación de la hoja de estilos de la librería:
  ```javascript
  import 'react-toastify/dist/ReactToastify.css'
  ```

---

## 4. Oportunidades de Optimización en `src/renderer/src/Contexts/utils.jsx`

Tras revisar la implementación de las utilidades e IPC wrappers genéricos en [utils.jsx](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/utils.jsx), se han identificado varias áreas clave de optimización que reducirán la duplicación de código, prevendrán bugs en producción y mejorarán el rendimiento.

### 4.1. Reducción drástica del código repetitivo de Toasts (DRY)
* **Problema**: Las opciones de configuración de Toast se repiten textualmente 7 veces en el archivo (alrededor de 70 líneas duplicadas de configuración). Esto incrementa innecesariamente el tamaño del bundle del frontend y dificulta el mantenimiento uniforme.
* **Solución**: Declarar una constante global `DEFAULT_TOAST_OPTIONS` en el archivo, o crear un wrapper simple `showToast(message, type = 'error')`.

**Refactorización sugerida**:
```javascript
const DEFAULT_TOAST_OPTIONS = {
  position: 'bottom-right',
  autoClose: 3000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  progress: undefined,
  theme: 'dark',
  transition: Bounce
}

const showToast = (message, type = 'error') => {
  const content = typeof message === 'object' ? (message?.message || 'Error desconocido') : message
  toast[type](content, DEFAULT_TOAST_OPTIONS)
}
```

---

### 4.2. Bug de serialización en `toast.error(error)`
* **Problema**: En funciones como `ElectronGetter2` (Línea 140), `ElectronSetter` (Línea 164), `ElectronSetter2` (Línea 189) y `electronInvoke` (Línea 218), se pasa el objeto `error` completo a `toast.error(error, ...)`. En React y entornos de producción, pasar un objeto `Error` de JS directo a `toast` suele provocar que se muestre la cadena literal `"[object Object]"` en la interfaz de usuario en lugar del mensaje real del error.
* **Solución**: Siempre extraer de manera segura la cadena descriptiva mediante `error?.message || error || 'Error desconocido'`.

---

### 4.3. Prevención de errores de borde (Boundary Check) en `shuffleArray`
* **Problema**: El algoritmo Fisher-Yates implementado (Líneas 3-17) copia y reordena el array original asumiendo que contiene elementos suficientes y que `currentIndex` es un índice válido. Si se pasa un array vacío `[]` o con un solo elemento `[song]`, destructurar `[newArray[0], newArray[currentIndex]] = [newArray[currentIndex], newArray[0]]` escribirá valores `undefined` sparse y provocará comportamientos inesperados o roturas de tipado en el reproductor.
* **Solución**: Agregar una cláusula de guarda al inicio del helper.

**Refactorización sugerida**:
```javascript
export const shuffleArray = (array, currentIndex) => {
  if (!Array.isArray(array) || array.length <= 1) {
    return [...(array || [])]
  }
  let newArray = [...array]
  // El resto del algoritmo permanece intacto
  ...
}
```

---

### 4.4. Optimización de Hashing de Claves en `dedupedInvoke`
* **Problema**: La función `getInvokeKey` utiliza `JSON.stringify(args)` para generar claves únicas de de-duplicación de peticiones activas IPC. Si las colecciones crecen o se transfieren grandes listas de metadatos o canciones completas como parámetros, `JSON.stringify` es costoso para la CPU y puede lanzar excepciones si hay referencias circulares.
* **Solución**: Generar claves simplificadas si los parámetros son primitivos (números, strings) o implementar un serializador ligero optimizado.

**Refactorización sugerida**:
```javascript
function getInvokeKey(action, args) {
  if (args.length === 0) return action
  try {
    return `${action}:${JSON.stringify(args)}`
  } catch {
    // Fallback robusto en caso de error de serialización
    return `${action}:${Date.now()}`
  }
}
```

---

### 4.5. Fusión de Wrappers IPC Redundantes
* **Problema**: Existen wrappers redundantes y confusos como `ElectronGetter` vs `ElectronGetter2` (uno arroja el error de nuevo y el otro lo consume internamente de manera silenciosa) y `ElectronSetter` vs `ElectronSetter2`. 
* **Solución**: Unificar en un único cliente IPC modular o estandarizar las respuestas bajo un contrato `{ success, data, error }` (similar al utilizado en `ElectronSetter2`), eliminando callbacks de `setState` pasados directamente, lo cual mejora la separación de responsabilidades entre la vista y las utilidades.
