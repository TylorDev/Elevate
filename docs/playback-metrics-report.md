# Reporte del registro de reproducciones y métricas por canción

Fecha del análisis: 8 de agosto de 2026  
Alcance: implementación actual de Elevate 2.0.3 (Electron 41, React 19 y Prisma 7 con SQLite).

## Resumen ejecutivo

Elevate no registra una reproducción completa como una sola operación. El renderer crea una sesión temporal por canción y, a partir de eventos del elemento HTML `<audio>`, envía cinco tipos de mensajes IPC independientes al proceso principal:

1. `short-view-award`
2. `long-view-award`
3. `repeat-award`
4. `skip-award`
5. `playback-finalize`

El proceso principal traduce cada mensaje en incrementos atómicos sobre `UserPreferences`. Una short view también incrementa `play_count` y crea una fila en `PlayHistory`. No se crean filas en `PlaybackEvent`, pese a que esa tabla existe en el esquema.

La pérdida de foco, por sí sola, no desactiva el conteo. No hay código que consulte `window.focus`, `blur`, `document.hasFocus()` ni `document.visibilityState`. Sin embargo, minimizar u ocultar la ventana sí puede retrasar la evaluación y persistencia: `BrowserWindow` no configura `backgroundThrottling`, cuyo valor predeterminado en Electron es `true`. Electron documenta que, al quedar la página en segundo plano, se limitan animaciones y timers y que una ventana minimizada u oculta pasa al estado de visibilidad `hidden`. Como toda la detección vive en el renderer y depende de eventos del `<audio>`, el sistema no garantiza que las métricas se escriban inmediatamente mientras la ventana está minimizada u oculta.

También existen problemas más deterministas que la minimización:

- Al salir de la aplicación, el proceso principal desconecta Prisma antes de pedir al renderer que finalice la reproducción actual. Se puede perder `active_listening_seconds` de la sesión en curso y cualquier premio pendiente.
- Al terminar una canción, un listener intenta finalizarla como `ended`, mientras otro listener avanza de pista inmediatamente. El cambio de pista puede finalizar primero la misma sesión como `track-change`, clasificarla erróneamente como skip e impedir la lógica de repetición posterior al fin natural.
- El flujo de repetición puede sumar dos unidades por un solo ciclo repetido: una al reiniciar y otra cuando la repetición alcanza long view.
- El tiempo “activo” se calcula con reloj de pared (`Date.now()`), no con el avance real de `audio.currentTime`. Suspensión del equipo, buffering o retrasos del renderer pueden inflarlo.

## 1. Datos persistidos

Las métricas agregadas viven en `UserPreferences`, con una fila por `song_id`:

| Campo | Qué representa en la implementación actual |
| --- | --- |
| `play_count` | Se incrementa exactamente junto con una short view. No es un contador independiente de inicios de reproducción. |
| `short_view_count` | Ciclos que alcanzaron al menos 10 segundos de tiempo activo calculado. |
| `long_view_count` | Ciclos que alcanzaron al menos 70% de posición y 40% de la duración en tiempo activo calculado. |
| `long_play_seconds` | Suma la duración completa de la canción por cada long view; no suma los segundos realmente escuchados. |
| `active_listening_seconds` | Suma el tiempo activo calculado al finalizar cada ciclo. |
| `consecutive_repeat_count` | Incrementos generados por reinicios/repeticiones calificadas. El nombre no implica que se restablezca cuando cambia la canción; es un acumulado histórico. |
| `skip_count` | Sesiones no finalizadas naturalmente, sin long view y con menos de 30 segundos activos. |

Referencias: `prisma/schema.prisma:62-75` y `src/main/ipc/likehandlers/playback.ts:51-84`.

Además:

- `PlayHistory` recibe una fila solamente cuando se concede una short view (`playback.ts:56-62,93-100`).
- `lastPlayedAt` se deriva de esas filas, por lo que significa “última short view registrada”, no “última vez que se presionó play” (`src/main/utils/utils.ts:280-306`).
- Los rankings de “más reproducidas” ordenan por `short_view_count`, no por `play_count` (`src/main/ipc/likehandlers/history.ts:41-66`).
- `PlaybackEvent` y `AppHistoryEvent` existen en Prisma, pero este flujo no escribe en ellas. No hay actualmente un registro durable por sesión con inicio, fin, progreso o causa de terminación (`prisma/schema.prisma:124-164`).

## 2. Umbrales exactos

Los umbrales están definidos en `src/renderer/src/Contexts/AudioContext/audioUtils.ts:3-8`:

| Regla | Valor |
| --- | --- |
| Short view | 10,000 ms de tiempo activo |
| Ventana de skip | Menos de 30,000 ms de tiempo activo |
| Progreso mínimo de long view | 70% de `currentTime / duration` |
| Escucha activa mínima de long view | 40% de la duración |
| Zona válida para considerar reinicio/replay | Primer 16% de la canción |
| Retroceso mínimo para detectar wrap automático | 1.5 segundos |

Consecuencias de estas reglas:

- Una canción de menos de 25 segundos puede conseguir long view antes de conseguir short view, porque 40% de su duración es menor que 10 segundos.
- Una canción de menos de 10 segundos no puede conseguir short view en condiciones normales, aunque sí puede conseguir long view. Por tanto, puede tener `long_view_count > 0`, pero `play_count = 0` y no aparecer en `PlayHistory`.
- Llegar al 70% mediante seek no invalida la long view. Solo se exige que el acumulado activo alcance 40% de la duración, aunque ese tiempo haya sido escuchado en otras partes de la canción.
- Una salida a los 29.999 segundos sin long view cuenta como skip; a los 30.000 segundos ya no.

## 3. Flujo completo en el renderer

### 3.1 Apertura de sesión

Cuando cambia `currentFile.filePath`, `AudioProvider` crea una sesión en memoria (`AudioProvider.tsx:230-244` y `audioSession.ts:16-38`) con:

- identificador `${filePath}|${Date.now()}`;
- archivo y duración conocida;
- tiempo activo acumulado en cero;
- última posición conocida en cero;
- flags de short view, long view, skip, repetición y finalización en `false`.

La sesión se abre al seleccionar la canción, no cuando se confirma que el audio empezó a sonar.

### 3.2 Inicio y acumulación de tiempo activo

El `<audio>` se crea oculto, con `src` derivado del path y `autoPlay` (`AudioProvider.tsx:384-393`). En el evento `play`, se guarda `Date.now()` como inicio del segmento activo (`AudioProvider.tsx:264-270`; `audioSession.ts:52-58`).

El tiempo activo se calcula así:

```text
activeListeningMs acumulado
+ (Date.now() - activeSegmentStartedAt), si existe un segmento abierto
```

Al pausar, terminar o finalizar la sesión se cierra el segmento y se suma esa diferencia (`audioSession.ts:40-67`). No se integra el delta de `audio.currentTime`.

### 3.3 Evaluación durante la reproducción

Se evalúan premios en estos eventos:

- `play`;
- `pause`;
- `timeupdate`;
- `durationchange`;
- `loadedmetadata`;
- `seeked`;
- `ended`;
- finalización por cambio de pista o desmontaje.

Los listeners están en `AudioProvider.tsx:257-359`.

Cada evaluación intenta primero short view y después long view (`audioTracking.ts:127-134`). Los premios usan un `Set` local para evitar dos solicitudes iguales mientras una de ellas está en vuelo (`audioTracking.ts:16-79`). El flag de la sesión se marca solo después de que el proceso principal responde con `success: true`.

### 3.4 Short view

`maybeAwardShortView` exige:

- sesión existente y no finalizada;
- `shortViewAwarded === false`;
- al menos 10,000 ms activos.

Entonces envía `short-view-award` (`audioTracking.ts:81-94`). Si la escritura funciona:

- `short_view_count += 1`;
- `play_count += 1`;
- se crea una fila de `PlayHistory`;
- el renderer actualiza las estadísticas del `currentFile` si todavía es la misma canción;
- se muestra el toast `+1 short views`.

### 3.5 Long view

`maybeAwardLongView` exige simultáneamente (`audioTracking.ts:96-125`):

```text
duration > 0
currentTime / duration >= 0.70
activeListeningMs >= duration * 1000 * 0.40
```

Si se concede:

- `long_view_count += 1`;
- `long_play_seconds += duration`;
- se muestra el toast `+1 long views`.

Si la sesión es una repetición marcada como pendiente de completar, después de guardar la long view también envía `repeat-award`.

### 3.6 Skip

Al finalizar una sesión por una causa distinta de `ended`, se concede un skip si (`audioSession.ts:132-141`):

```text
skip todavía no concedido
long view todavía no concedida
causa != ended
activeListeningMs < 30,000
```

No se exige que haya ocurrido un evento `play`. Una sesión creada al seleccionar una canción puede contar como skip con cero segundos si cambia de pista o se desmonta el provider.

### 3.7 Repeticiones

Hay dos entradas al flujo de repetición:

1. **Wrap o seek hacia el inicio después de una long view.** En `timeupdate` se detecta un retroceso de al menos 1.5 segundos hacia el primer 16%; en `seeked` basta con volver hacia atrás al primer 16% (`AudioProvider.tsx:278-325`). `confirmQualifiedCycleAndRestart` finaliza el ciclo con `countAsRepeat: true`, reinicia los contadores del ciclo y deja `replayCyclePendingCompletionRepeat = true` (`AudioProvider.tsx:112-140`).
2. **Play posterior a un `ended` calificado.** Una finalización natural con long view crea `pendingReplayRef`. Si vuelve a iniciarse el mismo archivo dentro del primer 16%, se envía una finalización de cero segundos con `countAsRepeat: true`, se reinicia el ciclo y se marca la repetición pendiente de completar (`AudioProvider.tsx:142-187`).

En ambos caminos, `countAsRepeat: true` ya incrementa `consecutive_repeat_count` en el backend. Si el nuevo ciclo alcanza long view, `audioTracking.ts:115-120` envía además `repeat-award`, que vuelve a incrementar el mismo contador.

### 3.8 Finalización del ciclo

`finalizePlaybackSession` (`AudioProvider.tsx:189-228`) ejecuta, en orden:

1. marca `finalizing = true`;
2. sincroniza duración y posición;
3. cierra el segmento activo;
4. vuelve a evaluar short y long view;
5. intenta registrar skip;
6. envía `playback-finalize` con el total de `activeListeningSeconds`;
7. si tuvo éxito, marca la sesión finalizada y, solo para `ended` con long view, crea el replay pendiente.

`playback-finalize` únicamente incrementa `active_listening_seconds`. Los campos `shortViewAwarded` y `longViewAwarded` incluidos por el renderer no forman parte del contrato persistido y el proceso principal los ignora.

## 4. Flujo IPC y persistencia

El renderer llama:

```text
window.electron.ipcRenderer.invoke('playback:record', payload)
```

La API preload pasa el canal directamente a `ipcRenderer.invoke` (`src/preload/index.ts:14-17`). El handler principal captura errores y responde `{ success: false }` (`src/main/ipc/likehandlers/index.ts:55-62`).

`recordPlaybackStats` (`src/main/ipc/likehandlers/playback.ts:31-118`):

1. valida `filePath` y el tipo de evento;
2. obtiene o crea la canción;
3. normaliza duración y tiempo activo;
4. construye incrementos Prisma según el evento;
5. ejecuta un `userPreferences.upsert` en una transacción;
6. dentro de la misma transacción crea `PlayHistory` si es short view;
7. vuelve a leer las estadísticas y las devuelve al renderer.

Los incrementos de un evento individual son atómicos. La prueba `tests/main/prisma.runtime.test.mjs:144-184` verifica que doce escrituras concurrentes de skip terminan con `skip_count = 12`.

No obstante, el protocolo no envía un `sessionId` ni un `eventId` único al backend. Por ello, el backend no es idempotente: dos mensajes válidos iguales incrementan dos veces, aunque representen el mismo evento lógico.

## 5. Comportamiento con foco, minimización y bandeja

### Ventana visible pero fuera de foco

No existe una condición que suspenda métricas por pérdida de foco. Una ventana visible que queda detrás de otra debería seguir el mismo flujo lógico. No hay listeners de `focus`, `blur` o `visibilitychange` en el seguimiento.

Por tanto, si las métricas dejan de registrarse únicamente al cambiar el foco, la causa no está en una regla intencional de `AudioProvider`; habría que reproducir y observar eventos/IPC para identificar si el renderer se está bloqueando por otra razón.

### Ventana minimizada u oculta en la bandeja

La ventana se crea sin indicar `backgroundThrottling` (`src/main/main/windowManager.ts:77-96`), así que conserva el valor predeterminado `true`. Electron documenta que esta opción limita animaciones y timers cuando el contenido queda en segundo plano. También documenta que minimizar u ocultar una `BrowserWindow` cambia la Page Visibility API a `hidden` cuando el throttling está activo.

El botón cerrar no destruye la ventana: mientras la app no esté saliendo, el evento `close` se cancela y la ventana se oculta en la bandeja (`windowManager.ts:64-69,120-127`). Minimizar tampoco desmonta React.

El audio puede continuar, pero el registro no tiene una garantía de persistencia en tiempo real porque:

- la decisión de otorgar vistas vive en el renderer;
- depende de que el renderer procese eventos del `<audio>`;
- no existe un listener `visibilitychange` que haga checkpoint antes de quedar oculto;
- no existe un timer o sesión equivalente en el proceso principal;
- no se configura `backgroundThrottling: false`.

Si los eventos se retrasan, `Date.now()` puede hacer que el siguiente evento al restaurar la ventana recupere de golpe el tiempo de pared transcurrido. Eso puede producir el síntoma “no se registró mientras estaba minimizada y apareció al volver”. Si no ocurre otro evento antes de salir o fallar el renderer, ese estado solo existía en memoria y se pierde.

Desactivar `backgroundThrottling` evitaría este tipo de limitación del renderer, pero Electron advierte que mantenerlo desactivado puede conservar el dibujo de frames de toda la ventana. Es una corrección simple con costo energético; una solución robusta es persistir checkpoints idempotentes y mover el estado durable de la sesión al proceso principal.

## 6. Problemas y riesgos encontrados

### P0 — Pérdida de la sesión activa al salir de la aplicación

`requestShutdown` guarda el estado de la ventana, detiene servicios y desconecta Prisma antes de llamar `app.quit()` (`src/main/main/lifecycle.ts:28-44`). No solicita al renderer que finalice la sesión de audio. Cuando la ventana se destruye y el cleanup de React intenta ejecutar `finalizePlaybackSession('audio-provider-unmount')`, la base ya puede estar desconectada o el IPC puede no completar.

Impacto:

- se pierde el tramo actual de `active_listening_seconds`;
- una short/long view cuyo umbral se alcanzó pero aún no se evaluó puede perderse;
- un skip pendiente puede perderse;
- el cierre “correcto” de la app no garantiza un flush de analítica.

### P0 — Carrera entre `ended` y avance automático de pista

`AudioProvider` escucha `ended`, evalúa premios de forma asíncrona y después llama `finalizePlaybackSession('ended')` (`AudioProvider.tsx:328-332`). `PlaybackProvider` tiene otro listener `ended` que llama inmediatamente a `handleNextClick()` (`src/renderer/src/Contexts/PlaybackContext.tsx:92-109`).

El cambio de `currentFile` ejecuta el cleanup que llama `finalizePlaybackSession('track-change')` (`AudioProvider.tsx:230-244`). Como la evaluación de `ended` espera IPC, el cleanup puede marcar la sesión como `finalizing` antes que la ruta natural.

Impacto posible:

- un final natural se trata como cambio de pista;
- una canción corta o sin long view puede sumar skip pese a haber terminado;
- no se crea `pendingReplay`, porque solo se crea con razón `ended`;
- el resultado depende del orden temporal de listeners, React e IPC.

### P0 — Doble conteo potencial de una repetición

Al detectar el inicio de una repetición se finaliza con `countAsRepeat: true`, lo que ya suma uno (`playback.ts:45,81-84`). Después, si el ciclo repetido llega a long view, se envía `repeat-award`, que suma otro (`audioTracking.ts:112-121`; `playback.ts:71-74`).

Una única repetición calificada puede producir `consecutive_repeat_count += 2`. Además, un seek manual hacia el primer 16% después de una long view puede contar la primera unidad aunque el usuario no vuelva a reproducir.

### P1 — Throttling al minimizar u ocultar

La configuración actual deja `backgroundThrottling: true`. No hay checkpoint al ocultar ni seguimiento alternativo en main. Esto puede retrasar eventos y escrituras o dejar métricas en memoria hasta restaurar la ventana.

Este riesgo no se aplica de la misma manera a una ventana meramente desenfocada pero visible; no hay evidencia en el código de una regla por foco.

### P1 — Tiempo activo basado en reloj de pared

El contador usa `Date.now() - activeSegmentStartedAt`. Mientras no llegue `pause`, todo ese intervalo se considera escucha activa. No comprueba que `currentTime` haya avanzado.

Casos que pueden inflarlo:

- equipo suspendido y reanudado;
- archivo haciendo buffering o I/O bloqueado;
- renderer congelado o fuertemente retrasado;
- cambio del reloj del sistema;
- audio detenido sin que el listener procese aún el evento correspondiente.

El requisito de progreso protege parcialmente la long view, pero no protege short view ni `active_listening_seconds`.

### P1 — Fallos de IPC sin cola durable ni reintento garantizado

Los errores se capturan y devuelven `null`/`success: false` (`audioTracking.ts:34-51`). Los premios pueden reintentarse en un evento posterior porque el flag no cambia, pero:

- si no llega otro evento, se pierden;
- el skip fallido no tiene una cola de reintento;
- una finalización fallida durante cambio de pista queda desconectada de la nueva sesión;
- `playback-finalize` fallido puede perder todo el tiempo activo del ciclo.

El payload de finalización incluye los flags de premios, pero el backend no los usa para reconciliar eventos faltantes.

### P1 — Sesiones con cero reproducción pueden contar como skip

La sesión se abre al cambiar `currentFile`, y `shouldAwardSkip` no exige que haya comenzado un segmento. Cambiar de pista antes de que `play` ocurra, un fallo de autoplay o el doble montaje de efectos de `React.StrictMode` en desarrollo pueden finalizar una sesión de cero segundos como skip.

### P1 — Historial y `play_count` no cubren canciones muy cortas

Como ambos dependen exclusivamente de short view, una canción de menos de 10 segundos puede terminar, obtener long view y aun así no sumar `play_count` ni `PlayHistory`. Para duraciones de 10 a 24.999 segundos, una long view también puede aparecer antes que la short view.

### P2 — `long_play_seconds` sobrestima el tiempo escuchado

Cada long view suma la duración total del archivo aunque la regla solo exija 70% de progreso y 40% de escucha activa. El nombre sugiere tiempo reproducido, pero la implementación representa “duración nominal de canciones que calificaron como long view”.

### P2 — Backend no idempotente

Los flags y el `Set` del renderer reducen duplicados locales, pero el proceso principal no conoce la identidad de la sesión o del evento. Cualquier envío duplicado incrementa de nuevo. Esto agrava carreras, reintentos futuros y restauración después de fallos.

### P2 — Wrap perdido si la long view todavía está en vuelo

La detección de wrap exige `session.longViewAwarded === true`. Ese flag se marca después de que responde IPC. Si la canción vuelve al inicio mientras `long-view-award` sigue en vuelo, el primer `timeupdate` del nuevo ciclo puede actualizar `lastKnownCurrentTime` sin detectar repetición. El siguiente wrap puede mezclar dos ciclos en la misma sesión.

### P2 — Modelo de eventos detallados sin usar

`PlaybackEvent` ya tiene campos adecuados para `startedAt`, `endedAt`, segundos, ratio, short/long view y origen, pero el flujo actual solo actualiza agregados y `PlayHistory`. Esto dificulta auditar, corregir duplicados y reconstruir métricas después de un bug.

## 7. Cobertura de pruebas actual

`tests/renderer/AudioContext.test.mjs` cubre helpers y controlador aislado:

- acumulación de tiempo;
- reset de ciclo;
- umbral de replay;
- regla de skip;
- creación de replay pendiente;
- short view una sola vez;
- requisitos de long view;
- deduplicación mientras un IPC está en vuelo;
- mantenimiento de flags ante error;
- payload de finalización.

No cubre el componente `AudioProvider` con un `<audio>` real o simulado, por lo que faltan pruebas de:

- orden de los dos listeners `ended`;
- cambio automático de pista frente a finalización;
- loop real y wrap;
- doble incremento de repeat;
- salida de la aplicación;
- ventana minimizada/oculta;
- `visibilitychange` y background throttling;
- canciones menores de 10 y 25 segundos;
- autoplay fallido y sesiones de cero segundos;
- system sleep, saltos de reloj o buffering;
- recuperación de IPC/Prisma no disponible.

## 8. Recomendaciones priorizadas

### Fase 1: corregir integridad inmediata

1. Unificar el manejo de `ended`: el mismo coordinador debe finalizar con razón `ended` y solo después avanzar la cola. Evitar dos listeners independientes con efectos asíncronos que compiten.
2. Definir una sola semántica de repeat. Recomendación: crear el repeat al iniciar el ciclo repetido, pero confirmarlo/incrementarlo una sola vez al alcanzar el criterio deseado; nunca incrementar tanto en `countAsRepeat` como en `repeat-award`.
3. Implementar un handshake de apagado: renderer pausa/captura estado, envía y espera el flush; main solo desconecta Prisma después de confirmarlo, con timeout y logging.
4. Añadir `hasStartedPlayback` a la sesión y exigirlo para short, long, skip y finalización de tiempo.

### Fase 2: hacer durable el seguimiento en segundo plano

1. Asignar `sessionId` y `cycleId` estables.
2. Persistir eventos/checkpoints idempotentes en main; usar una clave única por tipo de evento y ciclo.
3. Enviar deltas de escucha, no el total acumulado repetidamente.
4. Hacer checkpoint en `pause`, `ended`, cambio de pista, `visibilitychange`, suspensión del sistema y apagado.
5. Considerar `backgroundThrottling: false` como mitigación rápida si el consumo energético es aceptable, pero no como sustituto de persistencia durable.
6. Calcular escucha activa con una combinación de `currentTime` monotónico y reloj monotónico (`performance.now()`), limitando cada delta a progreso de media razonable. Manejar seeks explícitamente.

### Fase 3: normalizar el modelo analítico

1. Decidir si `play_count` significa inicio, short view o reproducción terminada. Hoy duplica `short_view_count`.
2. Decidir si `long_play_seconds` debe ser tiempo real o duración nominal; renombrar o corregir.
3. Definir el comportamiento de pistas cortas para que historial, play count y vistas no se contradigan.
4. Usar `PlaybackEvent` como fuente auditable y derivar agregados, o eliminarlo si no será parte del diseño.
5. Registrar razón de fin (`ended`, `skip`, `track-change`, `quit`, `error`) y origen de reproducción.

## 9. Matriz de escenarios esperados con la implementación actual

| Escenario | Resultado actual probable |
| --- | --- |
| Escuchar 9 s y cambiar | `skip +1`; sin short; se finalizan ~9 s activos. |
| Escuchar 10 s y cambiar | `short +1`, `play_count +1`, historial +1; `skip +1` mientras no haya long y siga bajo 30 s. |
| Escuchar 25 s y cambiar | Short +1 y skip +1 si no hubo long. Short y skip no son mutuamente excluyentes. |
| Escuchar 30 s y cambiar sin long | Short +1; no skip; se finalizan ~30 s. |
| Llegar a 70% con al menos 40% de duración activa | Long +1 y `long_play_seconds += duración completa`. |
| Canción de 8 s completada | Puede sumar long, pero normalmente no short, play count ni historial. |
| Fin natural de canción | Debería no sumar skip, pero la carrera con avance de cola puede tratarlo como `track-change`. |
| Repetir después de long view | Puede sumar repeat al reiniciar y otro al completar long view. |
| Seek al inicio después de long view | Puede contar un repeat aunque no se reanude la reproducción. |
| Perder foco con ventana visible | No hay una regla que detenga el conteo. |
| Minimizar u ocultar a bandeja | El renderer queda sujeto a throttling; la escritura puede retrasarse hasta un evento posterior/restauración. |
| Salir mientras se reproduce | El tramo no finalizado puede perderse porque Prisma se desconecta sin flush del renderer. |

## 10. Conclusión

El diseño actual funciona bien en el caso ideal de una ventana activa, eventos ordenados e IPC/SQLite disponibles: los incrementos individuales son atómicos y el renderer evita premios duplicados mientras una solicitud está en vuelo. Sin embargo, la sesión es efímera y está concentrada en el renderer. No hay garantía transaccional que abarque una reproducción completa.

La minimización es un riesgo real de retraso porque Electron conserva el throttling predeterminado y no existe checkpoint al ocultar. No obstante, no es la única ni la principal causa de pérdida: el apagado sin flush, la carrera de `ended`, el doble camino de repeat y el uso de reloj de pared son problemas concretos observables directamente en el código. Corregir primero la coordinación de fin de pista y apagado, y después introducir sesiones idempotentes persistidas en main, daría un sistema confiable tanto en primer plano como minimizado o en bandeja.

## Fuentes técnicas externas consultadas

- Electron, `WebPreferences.backgroundThrottling`: valor predeterminado `true` y throttling de animaciones/timers en segundo plano.
- Electron, Page Visibility de `BrowserWindow`: una ventana minimizada u oculta pasa a `hidden`; con throttling desactivado permanece `visible`.
- Electron, `webContents.getBackgroundThrottling()` y `setBackgroundThrottling()`.

Estas fuentes se consultaron mediante Context7 sobre la documentación oficial de Electron. Las conclusiones específicas de Elevate se basan en los archivos y líneas citados a lo largo del reporte.
