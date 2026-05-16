# Plan Para Reorganizar `AudioPlayer` Entre `950px` y `1360px`

## Resumen

Aplicar un layout responsive específico en `AudioPlayer` solo para el rango `950px <= width <= 1360px`, manteniendo intacto el layout actual fuera de ese breakpoint. La solución debe resolverse principalmente en `AudioPlayer.scss`, conservando la estructura JSX actual salvo que aparezca una limitación puntual de alineación.

## Cambios De Implementaci

- Añadir un bloque `@media (min-width: 950px) and (max-width: 1360px)` en [AudioPlayer.scss](/abs/path?missing)  
  Ruta real: `src/renderer/src/components/AudioPlayer/AudioPlayer.scss`.
- Dentro de ese breakpoint, redefinir la grilla de `.AudioPlayer` para que use áreas con spans:
  - Fila 1: `cover | Metadata | progressRow | volume`
  - Fila 2: `cover | Metadata | like | controls | menu`
  - Fila 3: `cover | Stats`
- Interpretación cerrada del layout:
  - `cover` ocupa las 3 filas.
  - `Metadata` ocupa filas 1 y 2.
  - `Stats` queda debajo de `Metadata` en la fila 3.
  - `progressRow` aparece solo en fila 1.
  - `volume` aparece solo en fila 1, a la derecha.
  - `like`, `controls` y `menu` ocupan la fila 2.
- Ajustar `grid-template-columns` en ese breakpoint para reflejar 5 tracks lógicos, por ejemplo:
  - columna 1: `cover`
  - columna 2: `Metadata/Stats`
  - columnas 3-5: bloque de acciones y progreso
- Usar una plantilla equivalente a esta intención:
  - `"cover Metadata progressRow progressRow volume"`
  - `"cover Metadata like controls menu"`
  - `"cover Stats    .    .        ."`
- Ajustar `grid-template-rows` para compactar el contenido dentro de la altura actual de `8.5rem`, sin cambiar `--player-height`.
- Reducir `gap`, `padding`, y alineaciones en ese breakpoint para que las 3 filas entren sin colisión visual.
- Afinar estilos de estas áreas dentro del breakpoint:
  - `.AudioPlayer__progress-row`: hacerla más compacta, con menor `gap` y texto de tiempo más apretado si hace falta.
  - `.AudioPlayer__controls`: mantener centrado horizontal, pero probablemente con `gap` más corto.
  - `.AudioPlayer__Stats`: permitir alineación a inicio y revisar si necesita `flex-wrap: wrap` o reducción leve de chips.
  - `.AudioPlayer__cover`: conservar proporción cuadrada, pero validar si la altura visual actual sigue funcionando al spanning de 3 filas.
  - `.SliderVolume`: mantener `grid-area: volume`, verificando alineación vertical con la fila 1.
- No tocar `AudioPlayer.jsx` salvo que el comportamiento del DOM obligue a introducir un wrapper para agrupar elementos; con la estructura actual, en principio no debería ser necesario.

## APIs E Interfaces

- No hay cambios de props, contexto, hooks, ni contratos públicos.
- No se agregan componentes nuevos.
- El cambio es puramente de layout y responsive behavior en CSS.

## Pruebas Y Escenarios

- Verificar en ancho dentro del rango:
  - `950px`
  - `1100px`
  - `1360px`
- Verificar inmediatamente fuera del rango:
  - `949px`
  - `1361px`
- Confirmar visualmente:
  - `cover` span de 3 filas
  - `metadata` span de 2 filas
  - `stats` debajo de metadata
  - `progressRow` visible solo en fila 1
  - `like`, `controls`, `menu` alineados en fila 2
  - `volume` anclado en fila 1
- Probar con título y artista largos para validar truncado.
- Probar con números grandes en `Cortas` y `Skips` para validar que no rompan la fila 3.
- Abrir `PlayerMenu` y `SliderVolume` en ese breakpoint para confirmar que sus paneles flotantes no queden cortados ni mal posicionados.

## Suposiciones Cerradas

- Se implementa la versión “con spans”.
- La altura del player debe mantenerse en `8.5rem`.
- Fuera del rango `950px-1360px`, el layout actual no se modifica.
- El orden funcional del DOM se conserva; solo cambia la distribución visual.
