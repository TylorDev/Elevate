# Plan para activar `Always On Top` en `StatusBar`

## Resumen
Implementar `Always On Top` siguiendo el patrón de controles de ventana que ya existe en Electron: `main` expone la capacidad por IPC, `preload` la publica en `window.electron.windowControls`, y `StatusBar.jsx` consume el estado y lo conecta al botón con feedback visual.

Decisión cerrada: `Always On Top` será **solo de sesión**. No se guardará en `window-state.json` ni se restaurará al reiniciar la app.

## Cambios archivo por archivo

### [src/main/index.mjs](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/main/index.mjs)
- Ampliar `getWindowStatePayload()` para incluir `isAlwaysOnTop: Boolean(mainWin?.isAlwaysOnTop?.())`.
- En `setupWindowControlHandlers()`, agregar un nuevo handler IPC:
  - canal sugerido: `window:toggle-always-on-top`
  - comportamiento:
    1. salir temprano si `mainWin` no existe o está destruida
    2. leer `mainWin.isAlwaysOnTop()`
    3. invertirlo con `mainWin.setAlwaysOnTop(!currentValue)`
    4. llamar `sendWindowState()` para que el renderer reciba el nuevo estado
- Mantener el patrón actual: no devolver estado parcial “a mano”; la fuente de verdad debe seguir siendo `getWindowStatePayload()`.
- No tocar `loadWindowState()` ni `saveWindowState()`, porque ya quedó definido que esta preferencia no persiste entre sesiones.
- En `createWindow()`, no hace falta setear nada especial para restauración; la ventana arranca con `alwaysOnTop = false` por defecto.
- Verificación manual esperada:
  - al clickar el botón, la ventana pasa arriba de otras ventanas
  - al clickar otra vez, vuelve al comportamiento normal
  - el evento `window:state-changed` refleja el cambio sin reiniciar renderer

### [src/preload/index.mjs](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/preload/index.mjs)
- Extender `windowControls` con un método nuevo:
  - `toggleAlwaysOnTop: () => ipcRenderer.invoke('window:toggle-always-on-top')`
- No crear un namespace nuevo; conviene mantenerlo dentro de `windowControls` porque conceptualmente pertenece al mismo grupo que `minimize`, `toggleMaximize`, `restore`, `close`.
- No cambiar `onStateChange`; ya sirve para propagar el nuevo campo `isAlwaysOnTop`.

### [src/renderer/src/components/StatusBar/StatusBar.jsx](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/StatusBar/StatusBar.jsx)
- Ampliar el estado local `windowState` con `isAlwaysOnTop: false` en su valor inicial.
- Aprovechar el `useEffect` existente:
  - `getState()` ya hidrata el estado inicial
  - `onStateChange()` ya escucha cambios
  - no hace falta un segundo efecto si el payload nuevo llega completo
- Conectar el botón `Always on top`:
  - pasar `isActive={windowState.isAlwaysOnTop}`
  - agregar `onClick={() => void window.electron.windowControls.toggleAlwaysOnTop()}`
- Ajustar el `title` para que refleje estado real:
  - apagado: `Activar always on top`
  - encendido: `Desactivar always on top`
  - si prefieres mantener el texto en inglés por consistencia visual, usar `Enable always on top` / `Disable always on top`
- Mantener `LuPin`; ya comunica bien la intención.
- No introducir estado optimista local. El botón debe depender del estado confirmado por IPC para no desincronizar UI y ventana real.
- Verificar que el botón queda resaltado con la clase activa actual cuando `isAlwaysOnTop` sea `true`.

### [src/renderer/src/components/StatusBar/StatusBar.scss](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/StatusBar/StatusBar.scss)
- **No requiere cambios funcionales**.
- La variante `.status-bar__icon-button.is-active` ya existe y sirve para marcar visualmente el botón pineado.
- Solo tocar este archivo si, al probar, el estado activo del pin no se diferencia lo suficiente del resto.

## Interfaces públicas / contrato a cambiar
- `window.electron.windowControls.getState()` pasará a devolver además:
  - `isAlwaysOnTop: boolean`
- `window.electron.windowControls` expondrá además:
  - `toggleAlwaysOnTop(): Promise<void>`

## Pruebas y escenarios
- Estado inicial:
  - al abrir la app, `isAlwaysOnTop` debe venir en `false`
  - el botón no debe aparecer activo
- Toggle:
  - primer click activa always-on-top y enciende el estilo activo
  - segundo click lo desactiva y apaga el estilo activo
- Sincronización:
  - `StatusBar` debe reflejar el valor que llegue por `getState()` y por `onStateChange()`
  - no debe romper minimizado, maximizado ni cierre
- Ciclo de vida:
  - cerrar y volver a abrir la app debe reiniciar `Always On Top` en `false`
  - ocultar a bandeja y restaurar dentro de la misma sesión debe conservar el estado actual de `Always On Top`

## Supuestos cerrados
- La feature será **solo de sesión**.
- El botón se integra al API existente de `windowControls`; no se creará un módulo IPC separado.
- El feedback visual usará la clase activa ya existente en `StatusBar.scss`.
