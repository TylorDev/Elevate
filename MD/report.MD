# Auditoria Electron Produccion / Unpacked

Fecha: 2026-05-26  
Objetivo: auditar por que `dist/win-unpacked/elevate.exe` tarda demasiado o se queda congelada antes de cargar el renderer, con foco en main process, Prisma, ASAR/unpacked y bundles del renderer.

## Resumen Ejecutivo

`Fixes.md` esta parcialmente implementado. Los cambios mas importantes ya aterrizaron: se removio `dotenv/config`, Prisma ya se inicializa de forma lazy dentro de `initializePrisma()`, los watchers ya no bloquean directamente antes de crear la ventana, y el paquete ya no incluye `dev.db-shm`, `dev.db-wal` ni migrations dentro de `resources/prisma`.

El bloqueo principal, sin embargo, sigue vivo: `src/main/index.mjs` todavia ejecuta `await initializePrisma()` antes de `createTray()` y `createWindow()`. Si Prisma, `@prisma/adapter-libsql`, el runtime WASM o el native binding de libsql se queda esperando en produccion/unpacked, Electron nunca llega a ejecutar `loadFile()` y el renderer no tiene oportunidad de pintar.

La hipotesis mas fuerte sigue siendo correcta: si `npm run dev` arranca normal pero el unpacked queda congelado sin cargar renderer, el problema probablemente esta en main process antes de crear la ventana, no en React como primer sospechoso.

## Estado De Implementacion De `Fixes.md`

Implementado:

- `import 'dotenv/config'` fue removido de `src/main/prisma.mjs`.
- Prisma ya no se instancia en module scope; ahora `new PrismaLibSql()` y `new PrismaClient()` ocurren dentro de `initializePrisma()`.
- `initializeWatchers()` ya no se espera antes de `createWindow()`; ahora corre en background con `.catch(...)`.
- `processAndDispatchLaunchArgs()` ya no se espera durante startup inicial; ahora se dispara con `void`.
- `electron-builder.yml` ya excluye `dev.db-shm`, `dev.db-wal` y `migrations/**`.
- `dist/win-unpacked/resources/prisma` contiene solo `schema.prisma` y `template.db`.
- `puppeteer` ya no esta en `dependencies`.
- `react-devtools` esta en `devDependencies`, no en `dependencies`.

Parcial o pendiente:

- `initializePrisma()` sigue bloqueando antes de crear la ventana.
- El cliente Prisma ya es lazy, pero su primera inicializacion sigue en la ruta critica del arranque visual.
- `initializePrisma()` todavia ejecuta operaciones sync de FS y varias sentencias SQL secuenciales.
- Imports pesados del main bundle siguen presentes antes de que el renderer pinte.

## Timeline Real De Arranque Actual

El flujo actual en `src/main/index.mjs` es aproximadamente:

```text
main module eval
  -> imports del bundle principal
  -> resolveIconPath() con fs.existsSync()
  -> nativeImage para tray/thumbar icons
  -> process.loadEnvFile() con try/catch
  -> app.requestSingleInstanceLock()

app.whenReady()
  -> app.setAppUserModelId()
  -> log.info("App started")
  -> await initializePrisma()
       -> getDatabaseUrl()
       -> getStoragePaths()
       -> existsSync(databasePath)
       -> mkdirSync(databaseDir) si falta
       -> copyFileSync(template.db, elevate.db) si falta
       -> new PrismaLibSql({ url })
       -> new PrismaClient({ adapter })
       -> PRAGMA foreign_keys
       -> PRAGMA journal_mode = WAL
       -> PRAGMA busy_timeout
       -> CREATE TABLE / CREATE INDEX secuenciales
  -> prisma = prismaClient
  -> registrar IPC handlers
  -> createTray()
  -> createWindow()
  -> loadFile(out/renderer/index.html)
  -> initDiscordPresence() en background
  -> initializeWatchers() en background
  -> processAndDispatchLaunchArgs() en background
```

Punto critico: `createWindow()` y `mainWindow.loadFile()` ocurren despues de Prisma. Por eso un bloqueo en Prisma se ve como "no carga el renderer".

## Bloqueadores Probables En Main Process

### 1. Prisma Todavia Esta En La Ruta Critica

Archivo: `src/main/index.mjs`  
Riesgo: alto

`await initializePrisma()` ocurre antes de crear la ventana. Aunque el fix lazy redujo el trabajo en module-evaluation time, movio el costo a `app.whenReady()` antes del primer paint.

Impacto esperado:

- Si `@libsql` tarda en resolver/cargar el native binding desde `app.asar.unpacked`, no hay ventana.
- Si el runtime de Prisma/WASM tarda en inicializar, no hay ventana.
- Si el archivo SQLite queda bloqueado o WAL tarda, no hay ventana.
- Si `template.db` debe copiarse en primer arranque y el FS esta lento, no hay ventana.

### 2. Trabajo Sync De FS Durante Startup

Archivos principales:

- `src/main/index.mjs`
- `src/main/prisma.mjs`
- `src/main/storagePaths.mjs`

Operaciones relevantes:

- `fs.existsSync()` para resolver iconos.
- `fs.readFileSync()` para `window-state.json`.
- `existsSync(databasePath)` dentro de Prisma.
- `mkdirSync(databaseDir)` si la base no existe.
- `copyFileSync(template.db, elevate.db)` en primer arranque.
- `existsSync()` sobre candidatos de `template.db`.

Estas operaciones son pequenas individualmente, pero en produccion ocurren sobre rutas empaquetadas, `%APPDATA%`, `process.resourcesPath` y potencialmente antivirus/Defender. En conjunto pueden explicar stalls frios.

### 3. Imports Pesados Dentro Del Bundle Principal

El build actual `out/main/index.js` incluye imports o codigo de:

- `sharp`
- `music-metadata`
- `axios`
- `cheerio`
- `chokidar`
- `@prisma/adapter-libsql`
- runtime de `@prisma/client`

Esto no significa que todo ejecute trabajo pesado inmediatamente, pero si aumenta parse/compile/evaluation cost del main process y eleva el riesgo de native binding resolution antes del primer paint. `sharp`, `@libsql`, `@parcel/watcher` y `node-audio-volume-mixer` aparecen bajo `app.asar.unpacked/node_modules`, lo cual confirma presencia de binarios nativos o dependencias que Electron debe resolver con cuidado en produccion.

## Riesgos Prisma / libsql / ASAR

El paquete unpacked contiene:

```text
dist/win-unpacked/resources/app.asar
dist/win-unpacked/resources/app.asar.unpacked/node_modules/@libsql
dist/win-unpacked/resources/app.asar.unpacked/node_modules/@img
dist/win-unpacked/resources/app.asar.unpacked/node_modules/@parcel
dist/win-unpacked/resources/prisma/schema.prisma
dist/win-unpacked/resources/prisma/template.db
```

Esto esta mejor que el estado descrito en `Fixes.md`: ya no hay `dev.db-shm`, `dev.db-wal` ni migrations en `resources/prisma`.

Riesgos que quedan:

- `new PrismaLibSql({ url })` se ejecuta antes de mostrar UI.
- El native binding de libsql debe resolverse desde `app.asar.unpacked`.
- El runtime Prisma con `engineType = "client"` incluye query compiler WASM/runtime en el bundle.
- `initializePrisma()` no tiene timeout, fallback visual ni estado intermedio visible para el usuario.
- Si la base en `%APPDATA%` queda bloqueada, corrupta o lenta, el usuario ve una app congelada en vez de una ventana con error recuperable.

## Riesgos Renderer / Bundle Size

El renderer no parece ser el primer bloqueo si la ventana nunca se crea, pero si contribuye al tiempo total despues de `loadFile()`.

Assets observados en `out/renderer/assets`:

- `index-*.js`: ~3.29 MB
- `Music-*.js`: ~1.44 MB
- `index-*.css`: ~159 KB
- total `out/renderer`: ~5.58 MB

La ruta inicial redirige a `/music`, por lo que despues del bundle principal se carga el chunk de `Music`.

Riesgos:

- `src/renderer/src/main.jsx` monta muchos providers globales antes de pintar la experiencia principal.
- `Main.jsx` envuelve toda la app en `VisualizerProvider`.
- `VisualizerContext.jsx` importa `butterchurn-presets/lib/elevate.min.js` en el contexto global, aunque el usuario no haya activado el visualizer.
- La pantalla inicial `/music` importa `Render`, `useVisualizerPresets` y bastantes iconos/controles, lo cual eleva el costo del primer route chunk.

Si el main process se desbloquea, el siguiente cuello de botella probable sera el JS inicial del renderer.

## Tamano Del Paquete

Mediciones actuales:

- `dist/win-unpacked/resources/app.asar`: ~381 MB
- `resources/Elevate`: ~2.64 MB
- `out/renderer`: ~5.58 MB

`Fixes.md` mencionaba `puppeteer` como causa probable del ASAR grande, pero eso ya no aplica al `package.json` actual. El ASAR sigue siendo muy grande y merece una auditoria separada con analisis de contenido del ASAR/dependencias. El tamano no necesariamente bloquea por si solo, pero aumenta costo de lectura, antivirus scanning y cold start.

## Recomendaciones Priorizadas

### P0 - Sacar Prisma Del Camino Del Primer Paint

Cambiar el orden de arranque para crear la ventana antes de `initializePrisma()`:

```text
app.whenReady()
  -> registrar IPC minimo de ventana/diagnostico
  -> createTray()
  -> createWindow()
  -> loadFile()
  -> iniciar Prisma en background
  -> cuando Prisma este listo, registrar o habilitar handlers dependientes de DB
```

La app deberia poder pintar una UI inicial aunque la base de datos tarde o falle.

### P1 - Estado `databaseReady` Y Timeouts

Agregar un estado central de DB:

- `databaseReady: false | true`
- `databaseError: null | error`
- `databaseInitStartedAt`
- `databaseInitFinishedAt`

Los handlers dependientes de Prisma deben:

- esperar con timeout corto, o
- responder `{ success: false, code: "DATABASE_INITIALIZING" }`, o
- mostrar en renderer un estado de "Inicializando biblioteca".

Esto evita que IPCs tempranos queden colgados si el renderer consulta datos antes de que Prisma este listo.

### P2 - Instrumentacion De Startup

Agregar timestamps alrededor de:

- inicio de `app.whenReady()`
- antes/despues de `initializePrisma()`
- antes/despues de `createWindow()`
- antes/despues de `loadFile()`
- `ready-to-show`
- primer mensaje/IPC del renderer
- inicio/fin de `initializeWatchers()`

Sin esto, el diagnostico depende demasiado de inferencia.

### P3 - Diferir Imports Pesados

Mover a imports dinamicos o modulos lazy:

- `sharp` solo cuando se procesan covers/imagenes.
- `music-metadata` solo cuando se escanean archivos.
- `chokidar` solo cuando se inicializan watchers.
- `axios`/`cheerio` solo cuando se usa scraping/feed.
- `butterchurn-presets` solo cuando el visualizer se abre o se activa.

La meta es que el main process inicial solo cargue Electron, logging, ventana, storage minimo y diagnostico.

### P4 - Reducir Costo Del Renderer Inicial

Separar visualizer/admin presets de la ruta inicial `/music`:

- No montar `VisualizerProvider` global si no es necesario para el primer paint.
- Cargar presets de Butterchurn bajo demanda.
- Revisar si `Music` puede pintar cover/player primero y luego hidratar controles avanzados.
- Auditar dependencias de `index-*.js` para reducir los ~3.29 MB iniciales.

## Pruebas Y Validacion Recomendada

Despues de aplicar fixes futuros:

1. Ejecutar `npm run build:unpack`.
2. Confirmar que `dist/win-unpacked/resources/prisma` no contiene `dev.db`, `dev.db-shm`, `dev.db-wal` ni `migrations`.
3. Ejecutar el unpacked con logging:

```powershell
cd "c:\Users\Jimbo\Downloads\Music\xc\Elevate\dist\win-unpacked"
.\elevate.exe --enable-logging --v=1
```

4. Revisar logs para confirmar orden:

```text
app.whenReady start
createWindow start
loadFile start
renderer first console/IPC
initializePrisma start
initializePrisma done/error
ready-to-show
```

5. Validar que `/music` pinta aunque Prisma tarde o falle.
6. Medir assets en `out/renderer/assets` y comparar antes/despues.
7. Probar primer arranque limpio borrando solo la DB de usuario de prueba, no recursos del repo.

## Conclusion

La auditoria confirma que `Fixes.md` avanzo bastante, pero el fix decisivo aun no esta completo: Prisma sigue antes de la ventana. Para resolver el congelamiento de `dist/win-unpacked`, la prioridad debe ser invertir el contrato de arranque: primero ventana y renderer minimo, despues base de datos y servicios pesados en background.

Cuando la UI exista desde el primer segundo, cualquier problema de Prisma/libsql/ASAR dejara de verse como "la app murio congelada" y pasara a ser un error diagnosticable, logueable y recuperable.
