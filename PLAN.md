# Plan.MD - Audio Player UI Refresh

## Summary
Implementar una nueva composición del player en `AudioPlayer.jsx` con el orden visual exacto: `Metadata` - `Controls` - `MediaTimeDisplay` - `Timer`.

El cambio separa responsabilidades: `Metadata` muestra datos y like, `Controls` concentra acciones de reproducción y overflow, `MediaTimeDisplay` queda como waveform/progress bar, y `Timer` muestra tiempos junto con el nuevo control vertical de volumen.

## Key Changes

- Crear `Plan.MD` en la raíz del repo con este plan.
- Actualizar `AudioPlayer.jsx` para importar y renderizar:
  `Metadata`, `Controls`, `MediaTimeDisplay`, `Timer`.
- Ajustar `AudioPlayer.scss` para una grilla de 4 zonas:
  `metadata`, `controls`, `waveform`, `timer`, manteniendo comportamiento responsive.

## Component Changes

- `Metadata.jsx`
  - Mover el botón de like desde `Controls` hacia `Metadata`.
  - Usar `useLikes()` para leer `likeState.currentLike` y ejecutar `toggleLike(currentFile)`.
  - Evitar que el click del botón like dispare la navegación a `/music` usando `event.stopPropagation()`.
  - Reorganizar layout como grid: cover a la izquierda ocupando 3 filas, datos al centro, like a la derecha ocupando las filas.
  - Filas visuales:
    - Cover - Title - Like
    - Cover - Artist - Like
    - Cover - Views - Like

- `Controls.jsx`
  - Mantener visibles solo: overflow menu, Back, Play/Pause, Next.
  - Mover Like, Mute, Step, Shuffle, Repeat y List al menú overflow.
  - Como Like se moverá a `Metadata`, no duplicarlo dentro del overflow.
  - El menú overflow se abre con botón de tres puntos usando icono `LuEllipsis`.
  - Cerrar el menú al hacer click fuera y al seleccionar una acción.
  - Estilizar Play/Pause con fondo `$text-principal`, forma circular, icono contrastado y tamaño consistente.
  - Layout final: Menu - Back - Play - Next.

- `MediaTimeDisplay.jsx`
  - Eliminar los textos de tiempo de este componente.
  - Reemplazar la barra actual por un waveform clickeable que actúe como progress bar.
  - Implementar prop `variant`, con valores:
    - `mirrored` por defecto: waveform simétrica/mirrored.
    - `oscilloscope`: versión configurable alternativa.
  - Usar `progress / duration` para rellenar de izquierda a derecha.
  - Usar `$secondary` o `$text-secondary` como base y `$text-principal` como progreso.
  - Conectar al audio actual mediante `mediaRef` y Web Audio API (`AudioContext`, `AnalyserNode`) para que reaccione al audio reproducido.
  - Incluir fallback visual estable si no hay canción, duración o permisos de audio context.

- `Timer.jsx`
  - Crear `src/renderer/src/components/Timer/Timer.jsx`.
  - Crear `src/renderer/src/components/Timer/Timer.scss`.
  - Mostrar tiempo actual y duración con formato `m:ss / m:ss`.
  - Leer `progress` y `duration` desde `useSuper()`.

- `SliderVolume`
  - Crear `src/renderer/src/components/SliderVolume/SliderVolume.jsx`.
  - Crear `src/renderer/src/components/SliderVolume/SliderVolume.scss`.
  - Mostrar botón de volumen.
  - Al presionarlo, abrir un slider vertical.
  - El slider ajusta `mediaRef.current.volume`.
  - Incluir flecha/botón para ocultar el panel.
  - Cerrar automáticamente al hacer click fuera.
  - Usar `$text-principal` para track/progreso/thumb.
  - Sincronizar iconos con estado: volumen normal, bajo, mute.

## Context/API Changes

- Actualizar `SupeContext.jsx` para exponer control de volumen:
  - `volume`
  - `setVolume`
  - `setMediaVolume(value)`
- `setMediaVolume(value)` debe:
  - limitar el valor entre `0` y `1`;
  - actualizar `mediaRef.current.volume`;
  - actualizar estado `volume`;
  - desmutear si el valor es mayor a `0`;
  - mutear si el valor llega a `0`.
- Mantener `toggleMute` compatible con el comportamiento actual.

## Styling

- Usar variables existentes:
  - `$text-principal`
  - `$text-secondary`
  - `$secondary`
  - `$principal`
- Evitar cards anidadas o layouts decorativos innecesarios.
- Usar botones compactos, circulares y con estados hover/focus claros.
- Garantizar que títulos largos en `Metadata` no rompan layout: ellipsis, `min-width: 0`, `overflow: hidden`.
- El overflow y el slider deben tener `z-index` suficiente para aparecer sobre el player.

## Test Plan

- Ejecutar `npm run build`.
- Verificar manualmente en la app:
  - El orden visual del player es `Metadata - Controls - MediaTimeDisplay - Timer`.
  - Like funciona desde `Metadata` y no navega accidentalmente.
  - Click en metadata fuera del like sigue navegando a `/music`.
  - Overflow abre/cierra correctamente.
  - Back, Play/Pause y Next siguen visibles y funcionales.
  - Play/Pause tiene fondo `$text-principal` y forma circular.
  - Waveform avanza de izquierda a derecha y permite seek por click.
  - `variant="mirrored"` y `variant="oscilloscope"` renderizan correctamente.
  - Timer muestra `current / duration`.
  - SliderVolume abre verticalmente, ajusta volumen, se cierra con flecha y click fuera.
  - Responsive: player no se desborda en anchos pequeños.

## Assumptions

- `Plan.MD` se creará en la raíz del repo.
- `MediaTimeDisplay` usará `variant="mirrored"` por defecto.
- La waveform debe reaccionar al audio real mediante Web Audio API, con fallback visual cuando no haya datos disponibles.
- El botón Like vivirá solo en `Metadata`, no duplicado dentro de `Controls`.
