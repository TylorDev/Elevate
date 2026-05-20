# Validacion de Limpieza Segura en Contextos

Este documento reemplaza la auditoria anterior y valida el estado real del repo actual en `src/renderer/src/Contexts`.

Objetivo: identificar que se puede limpiar sin romper la app y que partes requieren cuidado porque siguen activas por efectos secundarios o por consumo indirecto.

---

## 1. Hallazgos del reporte anterior que ya no son correctos

### `SessionContext.jsx`

- **Estado real**: el archivo ya no existe en `src/renderer/src/Contexts`.
- **Conclusión**: no debe figurar como candidato actual de limpieza. Esa entrada del reporte estaba desactualizada.

### `launchReady` en `ArgvContext.jsx`

- **Estado real**: `launchReady` sigue sin consumidores en el renderer.
- **Conclusión**: el hallazgo de "estado no leido" es correcto.
- **Importante**: esto no significa que `ArgvContext` este muerto. `autoplayRequestId` si se usa desde `AudioContext.jsx` y `handleExternalPayload` si se usa desde `App.jsx`.

### `isAwaken` en `SupeContext.jsx`

- **Estado real**: `handleAwaken` si se consume desde `Header.jsx`, pero el valor `isAwaken` no aparece leido en ningun consumidor del renderer.
- **Conclusión**: solo el estado `isAwaken` parece huerfano. El contexto no esta muerto.

---

## 2. Validado como limpieza segura

Estas piezas se pueden eliminar o simplificar con bajo riesgo, siempre que se haga la limpieza completa de sus imports/exports asociados.

### `AppContext.jsx`

- `AppProvider` solo provee `value={{}}`.
- `useAppContext` no tiene consumidores.
- En `main.jsx`, `AppProvider` solo envuelve la app y no aporta estado ni efectos.
- **Limpieza segura**:
  - quitar `AppProvider` de `main.jsx`
  - eliminar `AppContext.jsx`

### `useAudioContext` en `AudioContext.jsx`

- El hook `useAudioContext` no tiene consumidores.
- El provider `AudioProvider` si es necesario porque monta el `<audio>`, sincroniza autoplay y registra eventos de reproduccion.
- **Limpieza segura**:
  - eliminar solo el hook `useAudioContext`
  - mantener `AudioProvider`

### `scanProgress` en `MiniContext.jsx`

- Se actualiza al recibir notificaciones IPC.
- No hay consumidores de `scanProgress` en `src/renderer/src`.
- **Limpieza segura**:
  - eliminar el estado `scanProgress`
  - eliminar su inclusion en el `contextValue`
  - simplificar la rama del listener que lo actualiza

### `launchReady` en `ArgvContext.jsx`

- Se actualiza correctamente, pero no se consume en el renderer.
- **Limpieza segura**:
  - eliminar `launchReady`
  - quitar `setLaunchReady(...)`
  - dejar intactos `autoplayRequestId` y `handleExternalPayload`

### `handleSaveClick` en `QueueContext.jsx`

- Se exporta dentro del contexto, pero no tiene consumidores.
- No participa en otros flujos internos.
- **Limpieza segura**:
  - eliminar la funcion
  - quitarla del `contextValue`

### `addhistory` en `SupeContext.jsx`

- Se exporta en `useSuper()`, pero no tiene consumidores en el renderer.
- **Limpieza segura**:
  - eliminar la funcion
  - quitarla del `contextValue`

### `ToLike` en `utilControls.jsx`

- No tiene imports ni ejecuciones.
- **Limpieza segura**:
  - eliminar la utilidad exportada

### `shuffleArray` en `Contexts/utils.jsx`

- No tiene consumidores.
- `VisualizerContext.jsx` usa otra implementacion distinta desde `visualizerUtils.js`.
- **Limpieza segura**:
  - eliminar `shuffleArray` de `Contexts/utils.jsx`

---

## 3. Limpieza parcial segura, pero no borrado total

Estas entradas del reporte anterior apuntaban a algo real, pero la accion segura no es "borrar todo".

### `AudioContext.jsx`

- El `context value` sigue siendo `{}` y no aporta API util a consumidores.
- Pero `AudioProvider` si es funcional por sus efectos secundarios.
- **Accion recomendada**:
  - no eliminar el provider
  - si quieres, convertirlo en un componente sin contexto, o mantenerlo asi y solo quitar `useAudioContext`

### `LikeContext.jsx`: `isSongLiked`, `likesong`, `unlikesong`

- No se consumen externamente desde componentes.
- Pero si se usan internamente dentro de `LikeContext.jsx` para sostener `toggleLike` y el `useEffect` de sincronizacion del track actual.
- **Accion recomendada**:
  - no eliminarlas como funciones internas
  - si quieres limpiar API publica, quitalas del `contextValue`
  - mantener `toggleLike`, `getLikes`, `isLiked`, `likeState`, `likesLookup`

### `ImagesContext.jsx`: `clearImageCache` y `revokeImage`

- No aparecen consumidas externamente en el renderer.
- `clearImageCache('all')` si se usa internamente en el cleanup del provider.
- **Accion recomendada**:
  - no eliminar la implementacion de `clearImageCache`
  - si quieres limpiar API publica, quitar `clearImageCache` y `revokeImage` del `contextValue`
  - mantenerlas como helpers del modulo si el provider sigue usandolas

### `refreshBackgroundHistory` en `BackgroundContext.jsx`

- No tiene consumidores externos detectados.
- La carga inicial del historial ya ocurre dentro del provider.
- **Accion recomendada**:
  - se puede quitar del `contextValue`
  - la funcion puede mantenerse interna si crees que volvera a ser util
  - borrarla del todo tambien parece viable hoy, pero es una limpieza de menor impacto

### `isAwaken` en `SupeContext.jsx`

- El setter `handleAwaken` si se usa.
- El valor `isAwaken` no se lee.
- **Accion recomendada**:
  - si `handleAwaken(true)` no tiene otro efecto futuro planeado, se puede eliminar tanto el estado como el setter
  - si se piensa usar pronto para UI o animaciones, conviene dejarlo

---

## 4. Que no deberia marcarse como codigo muerto

### `ArgvContext.jsx`

- `handleExternalPayload` se usa en `App.jsx`.
- `autoplayRequestId` se usa en `AudioContext.jsx` para reintentar autoplay cuando llegan archivos externos.
- **Conclusión**: no borrar el contexto; solo limpiar `launchReady`.

### `AudioProvider`

- Aunque expone un contexto vacio, el provider si es parte del runtime del reproductor.
- **Conclusión**: no eliminarlo.

### `LikeContext.jsx`

- Varias funciones listadas como "huerfanas" son privadas en la practica, pero siguen siendo necesarias para la implementacion interna.
- **Conclusión**: limpiar API publica, no la logica base.

---

## 5. Orden recomendado para limpiar sin romper la app

### Fase 1: cambios de riesgo muy bajo

1. Eliminar `AppContext.jsx` y sacar `AppProvider` de `main.jsx`.
2. Eliminar `useAudioContext`.
3. Eliminar `handleSaveClick`.
4. Eliminar `ToLike`.
5. Eliminar `shuffleArray` de `Contexts/utils.jsx`.

### Fase 2: limpieza de estados no usados

1. Eliminar `launchReady` de `ArgvContext.jsx`.
2. Eliminar `scanProgress` de `MiniContext.jsx`.
3. Evaluar si `isAwaken` se elimina o se deja reservado.

### Fase 3: limpieza de API publica de contextos

1. Quitar `isSongLiked`, `likesong` y `unlikesong` del `contextValue` de `LikeContext.jsx`.
2. Quitar `clearImageCache` y `revokeImage` del `contextValue` de `ImagesContext.jsx` si no quieres exponer helpers internos.
3. Quitar `refreshBackgroundHistory` del `contextValue` de `BackgroundContext.jsx` si no planeas usar refresco manual desde UI.
4. Quitar `addhistory` del `contextValue` de `SupeContext.jsx`.

---

## 6. Resumen ejecutivo

La auditoria anterior era util como punto de partida, pero no estaba completamente alineada con el repo actual.

### Confirmado como correcto

- `AppContext.jsx` es prescindible.
- `useAudioContext` no se usa.
- `scanProgress` no se usa.
- `launchReady` no se usa.
- `handleSaveClick` no se usa.
- `addhistory` no se usa.
- `ToLike` no se usa.
- `shuffleArray` en `Contexts/utils.jsx` no se usa.

### Parcialmente correcto

- `isAwaken` no se lee, pero `handleAwaken` si se usa.
- `clearImageCache` y `revokeImage` no se usan externamente, pero forman parte de helpers del modulo.
- `isSongLiked`, `likesong` y `unlikesong` no se consumen externamente, pero si internamente.
- `refreshBackgroundHistory` no se consume, pero su eliminacion es opcional y de menor valor.

### Incorrecto o desactualizado

- `SessionContext.jsx` ya no existe.
- `ArgvContext.jsx` no esta muerto.
- `AudioProvider` no esta muerto.

