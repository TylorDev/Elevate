# Optimización del Sistema de Carga de Directorios

Refactorizar el pipeline de importación/escaneo de directorios para manejar correctamente carpetas vacías, directorios con cientos de miles de archivos, y estructuras anidadas complejas — sin bloquear ni el renderer ni el main process.

---

## User Review Required

> [!IMPORTANT]
> **Detección automática de subdirectorios:** Cuando el usuario seleccione `C:\Music`, y dentro existan carpetas como `Rock/`, `Jazz/`, `Compilations/`, el sistema registrará **cada subdirectorio que contenga audio** como entrada independiente en la DB. La carpeta raíz solo se registra si ella misma contiene archivos de audio directos. ¿Es este el comportamiento deseado, o preferirías que la carpeta raíz siempre se registre?

> [!IMPORTANT]
> **File watcher recursivo:** `chokidar` soporta watching recursivo. Esto significa que si el usuario agrega `C:\Music`, se vigilarán **todos** los subdirectorios automáticamente (añadidos, eliminados, renombrados). El impacto en recursos es mínimo gracias al debounce, pero en directorios con ~100K+ archivos el watcher consumirá algo más de memoria. ¿Es aceptable?

## Open Questions

> [!WARNING]
> **Carpetas vacías:** Actualmente si un directorio no contiene archivos de audio, se muestra con `0 tracks · — min`. ¿Debería filtrarse y no registrarse, o mostrarse con un indicador visual de "vacío"?

---

## Diagnóstico del Sistema Actual

| Problema | Archivo | Impacto |
|---|---|---|
| `getAllAudioFiles()` es **síncrono** (`readdirSync` + `statSync`) | [utils.mjs:42-68](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/main/ipc/utils/utils.mjs#L42-L68) | Bloquea el event loop del main process con directorios grandes |
| `getTotalDuration()` escanea todo + parsea metadata de cada archivo | [utils.mjs:350-355](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/main/ipc/utils/utils.mjs#L350-L355) | Se ejecuta **por cada directorio** en `getDirectoriesWithDetails` |
| `totalTracks` y `totalDuration` se recalculan en cada request | [filehandlers.mjs:166-186](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/main/ipc/filehandlers.mjs#L166-L186) | Caché de solo 60s; sin persistencia |
| `fs.watch` no se inicia para directorios nuevos | [filehandlers.mjs:298-322](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/main/ipc/filehandlers.mjs#L298-L322) | Cambios no detectados hasta reinicio |
| `fs.watch` solo detecta `rename` en el root, no es recursivo | [filehandlers.mjs:231-241](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/main/ipc/filehandlers.mjs#L231-L241) | No detecta cambios en subcarpetas |
| No hay detección automática de subdirectorios | [filehandlers.mjs:298-322](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/main/ipc/filehandlers.mjs#L298-L322) | Una carpeta con 50 sub-artistas se trata como un solo bloque |
| Modelo `Directory` solo almacena `path` | [schema.prisma:74-77](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/prisma/schema.prisma#L74-L77) | `totalTracks` y `totalDuration` siempre se recalculan |

---

## Proposed Changes

### Component 1: Prisma Schema — Modelo `Directory` Enriquecido

#### [MODIFY] [schema.prisma](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/prisma/schema.prisma)

Agregar campos persistidos para evitar recalcular stats en cada request:

```prisma
model Directory {
  id            Int      @id @default(autoincrement())
  path          String   @unique
  parentId      Int?
  parent        Directory?  @relation("DirectoryTree", fields: [parentId], references: [id], onDelete: Cascade)
  children      Directory[] @relation("DirectoryTree")
  totalTracks   Int      @default(0)
  totalDuration Float    @default(0)
  lastScannedAt DateTime?
  createdAt     DateTime @default(now())
}
```

**Cambios clave:**
- `totalTracks` / `totalDuration` — Persistidos en DB, actualizados por el scanner
- `parentId` / `parent` / `children` — Relación auto-referencial para la jerarquía de subcarpetas
- `lastScannedAt` — Saber cuándo se escaneó por última vez
- `createdAt` — Metadata de auditoría

Después del cambio, ejecutar migración:
```bash
npx prisma migrate dev --name add-directory-metadata
npx prisma generate
```

---

### Component 2: Scanner Asíncrono — `directoryScanner.mjs`

#### [NEW] [directoryScanner.mjs](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/main/ipc/utils/directoryScanner.mjs)

Reemplaza `getAllAudioFiles` (síncrono) con un scanner completamente asíncrono que **no bloquea el event loop**.

**Funcionalidades:**

1. **`scanDirectoryAsync(dirPath)`** — Walk recursivo usando `fs.promises.readdir` + `fs.promises.stat`. Procesa en lotes de ~50 entries con `setImmediate()` entre lotes para ceder el event loop.

2. **`discoverSubdirectories(rootPath)`** — Analiza la estructura interna de una carpeta:
   - Busca subcarpetas que contengan al menos 1 archivo de audio (.mp3/.wav/.flac)
   - Retorna un array de paths únicos de subcarpetas "relevantes"
   - Si la carpeta raíz tiene audio directo, también se incluye

3. **`indexDirectoryIncrementally(dirPath, onProgress)`** — Indexa archivos de audio de un directorio en batches:
   - Escanea paths asíncronamente
   - Procesa metadata en lotes de 20 archivos con `getOrCreateSong()`
   - Emite progreso via callback (`{ processed, total, dirPath }`)
   - Acumula `totalTracks` y `totalDuration` sin bloquear

4. **`computeDirectoryStats(dirPath)`** — Versión liviana que solo cuenta tracks y suma duración leyendo de la DB en vez de re-parsear archivos:
   - Busca Songs en DB cuyo `filepath` empiece con `dirPath`
   - Si faltan songs, solo indexa los faltantes

**Diseño no-bloqueante:**
```javascript
async function walkAsync(dir, audioFiles = []) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true })
  
  for (let i = 0; i < entries.length; i++) {
    // Ceder el event loop cada 50 entries
    if (i > 0 && i % 50 === 0) {
      await new Promise(resolve => setImmediate(resolve))
    }
    
    const entry = entries[i]
    const fullPath = path.join(dir, entry.name)
    
    if (entry.isDirectory()) {
      await walkAsync(fullPath, audioFiles)
    } else if (AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      audioFiles.push(fullPath)
    }
  }
  
  return audioFiles
}
```

---

### Component 3: File Watcher Robusto — `directoryWatcher.mjs`

#### [NEW] [directoryWatcher.mjs](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/main/ipc/utils/directoryWatcher.mjs)

Reemplaza el sistema `fs.watch` actual con `chokidar` para watching recursivo y confiable.

**Responsabilidades:**

1. **`startWatching(dirPath)`** — Inicia un watcher recursivo con chokidar para un directorio
2. **`stopWatching(dirPath)`** — Detiene el watcher de un directorio específico  
3. **`stopAll()`** — Detiene todos los watchers (para cleanup en `app.quit`)

**Eventos manejados:**

| Evento | Acción |
|---|---|
| `add` (archivo nuevo) | `getOrCreateSong()` + actualizar stats del directorio en DB + invalidar cache + notificar renderer |
| `unlink` (archivo eliminado) | Eliminar song de DB + actualizar stats + invalidar cache + notificar renderer |
| `change` (archivo modificado) | Re-parsear metadata del song si `metadataLoaded=true` + invalidar cache |
| `addDir` (subcarpeta nueva) | Si contiene audio, registrar como Directory hijo en DB |
| `unlinkDir` (subcarpeta eliminada) | Eliminar Directory de DB + sus songs |

**Configuración de chokidar:**
```javascript
const watcher = chokidar.watch(dirPath, {
  persistent: true,
  ignoreInitial: true,           // No re-procesar archivos existentes
  awaitWriteFinish: {            // Esperar que archivos terminen de copiarse
    stabilityThreshold: 1000,
    pollInterval: 200
  },
  depth: Infinity,               // Recursivo
  ignored: /(^|[\/\\])\../, // Ignorar archivos ocultos
})
```

**Debounce para batch updates:**
Los eventos se acumulan en un buffer durante 500ms antes de actualizar la DB y notificar al renderer. Esto evita N escrituras individuales cuando se copian 100 archivos de golpe.

```javascript
// Pseudocódigo del debounce
const pendingChanges = new Map()  // dirPath -> { added: Set, removed: Set }
let debounceTimer = null

function queueChange(type, filePath, dirPath) {
  if (!pendingChanges.has(dirPath)) {
    pendingChanges.set(dirPath, { added: new Set(), removed: new Set() })
  }
  pendingChanges.get(dirPath)[type].add(filePath)
  
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => flushChanges(), 500)
}

async function flushChanges() {
  for (const [dirPath, changes] of pendingChanges) {
    // Process all changes in batch
    await processBatchChanges(dirPath, changes)
    await updateDirectoryStats(dirPath)
    invalidateDirectoryCache(dirPath)
    sendNotification('[directory-changed]')
  }
  pendingChanges.clear()
}
```

**Dependencia:** Instalar `chokidar`
```bash
npm install chokidar
```

---

### Component 4: Handlers Refactorizados — `filehandlers.mjs`

#### [MODIFY] [filehandlers.mjs](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/main/ipc/filehandlers.mjs)

**Cambios:**

1. **Handler `'add-directory'`** — Refactorizado:
   ```
   dialog.showOpenDialog()
   → discoverSubdirectories(selectedPath)
   → Para cada subdirectorio: prisma.directory.upsert (con parentId)
   → Retornar inmediatamente { success, directories: [...paths] }
   → Disparar indexación incremental en background (no bloquea respuesta IPC)
   → startWatching(selectedPath)
   ```

2. **Handler `'get-all-directories'`** — Simplificado:
   ```
   prisma.directory.findMany({ include stats })
   → Ya no necesita getDirectoryDetails() ni getTotalDuration()
   → Los stats vienen directo de la DB
   → Solo recalcular si lastScannedAt es null
   ```

3. **Handler `'delete-directory'`** — Mejorado:
   ```
   stopWatching(path)
   → prisma.directory.delete (cascade elimina hijos)
   → invalidateDirectoryCache(path)
   ```

4. **Nuevo handler `'rescan-directory'`** — Para forzar un re-escaneo manual:
   ```
   indexDirectoryIncrementally(path, progress => sendProgress(progress))
   → Actualizar totalTracks/totalDuration en DB
   ```

5. **Nuevo handler `'get-directory-scan-progress'`** — Para que el renderer pueda suscribirse al progreso.

6. **Eliminar** `getTotalDuration()` de la ruta crítica de `get-all-directories`.

7. **Eliminar** `getAllAudioFiles()` síncrono — reemplazado por `scanDirectoryAsync()`.

8. **Eliminar** `startWatchingDirectories()` y `watchDirectory()` actuales — reemplazados por `directoryWatcher.mjs`.

**El `getCachedAudioFiles()` ahora usa el scanner async:**
```javascript
async function getCachedAudioFiles(dirPath) {
  const cached = audioPathsCache.get(dirPath)
  if (cached && cached.expiresAt > Date.now()) return cached.files

  const files = await scanDirectoryAsync(dirPath)  // ← async ahora
  audioPathsCache.set(dirPath, { files, expiresAt: Date.now() + AUDIO_PATHS_TTL })
  return files
}
```

---

### Component 5: `utils.mjs` — Funciones Refactorizadas

#### [MODIFY] [utils.mjs](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/main/ipc/utils/utils.mjs)

1. **Eliminar `getAllAudioFiles()`** — Reemplazada por `scanDirectoryAsync()` del nuevo módulo.

2. **Eliminar `getTotalDuration()`** — Reemplazada por lectura directa de `Directory.totalTracks` / `Directory.totalDuration` de la DB.

3. **`getFileInfos()`** — Sin cambios funcionales, pero ahora recibe paths del scanner async.

4. **`getOrCreateSong()`** — Sin cambios, sigue siendo el corazón de la indexación.

---

### Component 6: Setup e Inicialización — `index.mjs`

#### [MODIFY] [index.mjs](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/main/index.mjs)

```javascript
app.whenReady().then(async () => {
  // ... existing setup ...
  
  setupFilehandlers()   // registra handlers (ya no inicia watchers internamente)
  
  // Nuevo: iniciar watchers para todos los directorios existentes
  const { initializeWatchers } = await import('./ipc/utils/directoryWatcher.mjs')
  await initializeWatchers()  // Lee directorios de DB e inicia chokidar para cada uno
  
  createWindow()
})

app.on('window-all-closed', () => {
  // Cleanup: detener todos los watchers
  const { stopAll } = require('./ipc/utils/directoryWatcher.mjs')
  stopAll()
  // ... existing shutdown ...
})
```

---

### Component 7: Renderer — Soporte para Progreso y Eventos

#### [MODIFY] [MiniContext.jsx](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/MiniContext.jsx)

Cambios mínimos en el renderer:

1. **`addDirectory()`** — Después de que el handler retorne, el scanner corre en background. Escuchar evento `'directory-scan-progress'` para mostrar progreso.

2. **Nuevo estado `scanProgress`** — `{ dirPath, processed, total }` para feedback visual.

3. **Escuchar evento `'directory-changed'`** — Cuando el watcher detecta cambios, refrescar automáticamente:
   ```javascript
   useEffect(() => {
     const handleDirectoryChanged = () => {
       getDirectories({ force: true })
     }
     window.electron.ipcRenderer.on('directory-changed', handleDirectoryChanged)
     return () => window.electron.ipcRenderer.off('directory-changed', handleDirectoryChanged)
   }, [])
   ```

#### [MODIFY] [PlaylistsContex.jsx](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/PlaylistsContex.jsx)

- Actualizar el listener de `'notification'` para también manejar `'[directory-changed]'` (refrescar allSongs).

---

### Component 8: Preload — Nuevo canal de evento

#### [MODIFY] [index.mjs](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/preload/index.mjs)

El preload ya expone `on` / `off` genéricos, así que **no necesita cambios**. Los nuevos eventos (`'directory-changed'`, `'directory-scan-progress'`) funcionan automáticamente a través de `webContents.send()`.

---

## Resumen de Archivos

| Acción | Archivo | Cambio |
|---|---|---|
| MODIFY | `prisma/schema.prisma` | Agregar campos a `Directory` |
| NEW | `src/main/ipc/utils/directoryScanner.mjs` | Scanner asíncrono no-bloqueante |
| NEW | `src/main/ipc/utils/directoryWatcher.mjs` | Watcher con chokidar + debounce |
| MODIFY | `src/main/ipc/filehandlers.mjs` | Refactorizar handlers, eliminar código síncrono |
| MODIFY | `src/main/ipc/utils/utils.mjs` | Eliminar `getAllAudioFiles` y `getTotalDuration` |
| MODIFY | `src/main/index.mjs` | Integrar watcher init + cleanup |
| MODIFY | `src/renderer/src/Contexts/MiniContext.jsx` | Progreso + auto-refresh |
| MODIFY | `src/renderer/src/Contexts/PlaylistsContex.jsx` | Manejar nuevo evento |
| — | `src/preload/index.mjs` | Sin cambios necesarios |

---

## Verification Plan

### Automated Tests

```bash
# 1. Migración Prisma
npx prisma migrate dev --name add-directory-metadata
npx prisma generate

# 2. Build verification
npm run build

# 3. App startup
npm run dev
```

### Manual Verification

1. **Directorio vacío:** Agregar una carpeta sin archivos de audio → debe registrarse con `0 tracks, 0 duration`
2. **Directorio con subcarpetas:** Agregar `C:\Music` que contiene `Rock/`, `Jazz/`, `Pop/` → cada subcarpeta aparece como directorio individual
3. **Directorio gigante:** Agregar una carpeta con ~10,000 archivos → la UI no se congela, el progreso se muestra, los stats se guardan en DB
4. **File watcher - agregar:** Copiar un .mp3 nuevo a un directorio vigilado → el directorio actualiza su conteo automáticamente
5. **File watcher - eliminar:** Borrar un .mp3 de un directorio vigilado → el conteo se actualiza
6. **File watcher - mover/renombrar:** Mover un archivo dentro del directorio → se detecta el cambio
7. **Persistencia de stats:** Reiniciar la app → `totalTracks` y `totalDuration` se leen de DB inmediatamente, sin re-escaneo
8. **Eliminar directorio padre:** Eliminar un directorio con hijos → cascade elimina los hijos
