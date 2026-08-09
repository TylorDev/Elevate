# Informe: múltiples short views y toasts al restaurar la ventana

Fecha: 8 de agosto de 2026  
Alcance: Elevate 2.0.3, React-Toastify 10.0.6 y Electron 41.5.

## Diagnóstico principal

El síntoma visible tiene dos conceptos diferentes:

1. **Varias short views registradas para varias sesiones o canciones.** Cada canción que supera diez segundos genera legítimamente un `short-view-award`.
2. **Todos los toasts continúan vivos mientras la ventana está minimizada y aparecen juntos al restaurarla.** Este es el bug de interfaz confirmado por el código.

No hay evidencia en la implementación de que una misma sesión normal envíe varias short views: el controlador usa el flag `session.shortViewAwarded` y un `Set` de solicitudes en vuelo para impedirlo. La prueba existente `tests/renderer/AudioContext.test.mjs:117-127` confirma que, después de conceder una short view, una segunda evaluación de la misma sesión no vuelve a invocar IPC; `AudioContext.test.mjs:146-165` también confirma que dos evaluaciones simultáneas solo envían una solicitud.

Sin embargo, cada sesión válida llama a `toast.success('+1 short views')` sin identificar la canción, sin `toastId`, sin límite global y sin comprobar si la ventana es visible. Cuando varias canciones se reproducen en segundo plano, se crean varios toasts indistinguibles. React-Toastify los conserva pausados durante la pérdida de foco y Electron puede retrasar su renderizado/animación. Al restaurar o maximizar la ventana, todos se hacen visibles y reanudan su temporizador a la vez.

Por tanto, **muchos toasts iguales no demuestran por sí solos que `short_view_count` se haya incrementado varias veces para el mismo ciclo**. Lo que sí demuestran es que se emitió una notificación por cada award exitoso acumulado mientras la interfaz no estaba visible.

## Causa raíz completa

### 1. Se crea un toast nuevo por cada short view

Después de que el proceso principal responde `success: true`, el controlador ejecuta incondicionalmente `notifyShortView()`:

- `src/renderer/src/Contexts/AudioContext/audioTracking.ts:81-94`
- `src/renderer/src/Contexts/AudioContext/AudioProvider.tsx:70-72`

La llamada actual es:

```tsx
toast.success('+1 short views', TOAST_OPTIONS)
```

`TOAST_OPTIONS` no contiene `toastId`, `containerId` ni una estrategia de actualización/agregación (`audioUtils.ts:10-19`). React-Toastify genera un ID diferente para cada llamada, así que todas se consideran notificaciones distintas.

### 2. React-Toastify pausa los toasts al perder el foco

El `ToastContainer` principal (`src/renderer/src/Layouts/Main/Main.tsx:246-259`) configura:

- `autoClose={3000}`;
- `newestOnTop`;
- `pauseOnHover`;
- ningún `limit`;
- ningún valor explícito para `pauseOnFocusLoss`.

La versión instalada es React-Toastify 10.0.6 (`package-lock.json:12492-12495`). Su configuración predeterminada define `pauseOnFocusLoss: true`. Su implementación escucha `window.blur` para pausar el progreso y `window.focus` para reanudarlo.

Cada toast de short view especifica `autoClose: 1400`, pero ese tiempo no continúa consumiéndose mientras el toast está pausado. Si la ventana permanece minimizada durante veinte minutos, los avisos creados en ese intervalo pueden seguir presentes con casi todo su tiempo pendiente.

### 3. No hay límite de notificaciones

El contenedor no tiene `limit`. Si diez tracks conceden short view mientras la ventana está minimizada, React-Toastify puede mantener diez toasts activos. `newestOnTop` solo cambia el orden; no agrupa ni elimina elementos.

Configurar únicamente `limit={3}` limitaría los visibles, pero los demás pasarían a una cola. Al recuperar el foco, esa cola seguiría mostrando notificaciones una tras otra. Por ello, `limit` es una defensa secundaria, no la solución completa.

### 4. Electron limita el renderer minimizado

`BrowserWindow` no define `webPreferences.backgroundThrottling` (`src/main/main/windowManager.ts:77-96`). Electron usa `true` de forma predeterminada.

La documentación oficial indica que, al quedar el contenido en segundo plano:

- se limitan animaciones y timers;
- una ventana minimizada u oculta pasa a `document.visibilityState === 'hidden'`;
- el renderer oculto vuelve a activarse al restaurar la ventana.

React-Toastify usa una animación CSS para el progreso de `autoClose`. Aunque se desactivara `pauseOnFocusLoss`, el throttling de Electron todavía puede impedir que las animaciones avancen normalmente mientras la ventana está oculta. Esto explica por qué maximizar/restaurar hace que el conjunto aparezca o empiece a cerrarse de golpe.

### 5. La notificación no conserva contexto de canción

`notifyShortView` no recibe `session`, `filePath`, título ni instante de reproducción. Todos los avisos dicen exactamente `+1 short views`.

Una respuesta atrasada de la canción A puede mostrar su toast cuando ya está activa la canción D. Visualmente parece que D recibió otra short view. El método que actualiza la tarjeta actual sí compara el `filePath` (`AudioProvider.tsx:49-63`), pero el toast no hace esa comparación.

### 6. Las respuestas y callbacks pueden agruparse al restaurar

El award espera una llamada `ipcRenderer.invoke('playback:record')`. Cuando responde:

1. se actualizan estadísticas;
2. se marca `session.shortViewAwarded = true`;
3. se llama a `notifyShortView()`.

Si el renderer oculto procesa tarde algunas continuaciones o repaints, varias notificaciones pueden materializarse en una ráfaga al restaurar. Incluso si IPC respondió y el toast ya existía en el DOM oculto, el resultado visual es el mismo: todos aparecen juntos.

## Secuencia del bug

```text
La ventana pierde foco y se minimiza
  -> React-Toastify pausa el autoClose por window.blur
  -> Electron oculta y limita el renderer

Track A alcanza 10 s
  -> short_view_count(A) += 1
  -> se crea toast #1 oculto/pausado

Track B alcanza 10 s
  -> short_view_count(B) += 1
  -> se crea toast #2 oculto/pausado

Track C alcanza 10 s
  -> short_view_count(C) += 1
  -> se crea toast #3 oculto/pausado

La ventana se restaura o maximiza
  -> Electron reactiva el renderer
  -> React-Toastify recibe window.focus
  -> #1, #2 y #3 se renderizan/reanudan juntos
  -> todos muestran el mismo texto "+1 short views"
```

## ¿Puede duplicarse realmente el contador de la misma canción?

### Dentro de una única sesión normal

La ruta habitual tiene dos barreras:

1. `maybeAwardShortView` termina si `session.shortViewAwarded === true`.
2. `runAward` usa la clave `${session.id}:short-view-award` para rechazar una segunda solicitud mientras la primera está pendiente.

Esto hace improbable que una ráfaga de eventos `timeupdate` de la misma sesión produzca varios incrementos. El comportamiento está cubierto por pruebas unitarias.

### Entre sesiones diferentes del mismo archivo

Sí puede haber varios incrementos legítimos para el mismo `filePath`: cada vez que la canción vuelve a reproducirse y abre otro ciclo puede obtener otra short view. Si una cola repite la canción durante el periodo minimizado, al restaurar aparecerán varios toasts iguales y el contador de esa canción habrá subido varias veces correctamente.

### Duplicados reales por falta de idempotencia en el backend

El proceso principal no recibe `sessionId`, `cycleId` ni `eventId`. Cada payload válido `short-view-award` ejecuta:

```text
short_view_count += 1
play_count += 1
PlayHistory.create(...)
```

El `Set` del renderer solo protege la instancia en memoria. Si por una carrera futura, reintento, recreación de controlador o fallo entre commit y respuesta se envía dos veces el mismo evento lógico, Prisma no puede reconocer el duplicado. El backend tampoco tiene una restricción única por sesión/ciclo.

Por ello, **el bug observado se explica principalmente por acumulación visual**, pero el diseño no ofrece una garantía durable contra duplicados reales.

### No es posible auditarlo con precisión después del hecho

`PlayHistory` registra una fila por short view, pero no almacena ID de sesión, posición, inicio, fin ni causa. La tabla `PlaybackEvent` existe, pero este flujo no la usa. Dos filas cercanas pueden ser dos reproducciones válidas o un duplicado; el modelo actual no permite distinguirlas con certeza.

## Soluciones posibles

### Solución recomendada: no crear toasts individuales en segundo plano

El tracking debe seguir guardando métricas, pero la capa de notificaciones debe conocer la visibilidad:

1. Si la ventana está visible, mostrar el toast normal.
2. Si está minimizada/oculta, no crear el toast; acumular contadores en memoria, por ejemplo `{ shortViews: 3, longViews: 2 }`.
3. Al restaurar, mostrar como máximo un resumen:

```text
En segundo plano: 3 short views y 2 long views registradas
```

También es válido no mostrar resumen si estas métricas se consideran telemetría y no una acción que el usuario necesite confirmar.

La visibilidad puede obtenerse mediante `document.visibilityState`, porque Electron marca minimizadas/ocultas como `hidden` con la configuración actual. Para mayor precisión también conviene ampliar `WindowStatePayload` con `isVisible`, ya que el evento actual solo contiene `isMinimized`; al cerrar a bandeja, `isMinimized` puede ser `false` aunque la ventana esté oculta.

Ventajas:

- elimina el llenado de pantalla;
- mantiene intacta la persistencia de métricas;
- evita asociar visualmente awards antiguos con la canción actual;
- no aumenta consumo de CPU/GPU en segundo plano.

### Añadir un `toastId` estable o actualizar un único toast

Como mitigación rápida:

```tsx
toast.success('+1 short views', {
  ...TOAST_OPTIONS,
  toastId: 'playback-short-view'
})
```

Mientras ese toast siga activo, React-Toastify ignorará nuevos toasts con el mismo ID. Una variante mejor mantiene un contador y usa `toast.update`:

```text
3 short views registradas
```

El ID debería ser por tipo de métrica, no por canción, si el objetivo es que nunca haya una torre de notificaciones. Si se usa `${filePath}:short-view`, todavía podrían acumularse muchos toasts de canciones diferentes.

Limitación: un toast estable puede permanecer pausado durante toda la minimización. Por eso debe combinarse con supresión/agregación por visibilidad.

### Añadir un límite al contenedor

Usar `limit={2}` o `limit={3}` en `ToastContainer` protege el layout. Debe acompañarse de:

- `toast.clearWaitingQueue()` al ocultar o restaurar; o
- una política que descarte notificaciones de reproducción antiguas.

Sin limpiar la cola, el usuario verá el spam de forma secuencial en lugar de simultánea.

### Configurar `pauseOnFocusLoss={false}`

Esto evita la pausa explícita de React-Toastify por `window.blur`:

```tsx
<ToastContainer pauseOnFocusLoss={false} />
```

No es una solución suficiente porque:

- Electron todavía puede frenar la animación CSS con `backgroundThrottling: true`;
- el usuario no necesita consumir visualmente toasts mientras la ventana está minimizada;
- no evita que las notificaciones se creen;
- no resuelve duplicados reales ni falta de contexto.

Puede usarse como defensa adicional, no como corrección principal.

### Desactivar `backgroundThrottling`

Configurar:

```ts
webPreferences: {
  backgroundThrottling: false
}
```

permitiría que timers y animaciones sigan avanzando con la ventana minimizada. Podría hacer que los toasts caduquen antes de restaurar.

No es la recomendación principal:

- Electron puede seguir dibujando frames de toda la ventana;
- aumenta consumo de recursos;
- cambia el comportamiento de Page Visibility, que puede permanecer `visible` incluso minimizada;
- trata el síntoma de los toasts, pero no la política incorrecta de emitir UI invisible;
- no vuelve idempotentes los eventos.

Si se elige esta opción, la detección de ventana oculta debe basarse en eventos explícitos de `BrowserWindow`, no solamente en `document.visibilityState`.

### Hacer idempotente la persistencia

Para garantizar que una misma short view lógica nunca se aplique dos veces:

1. generar `sessionId` y `cycleId` estables en el inicio de reproducción;
2. incluirlos en `playback:record`;
3. persistir un evento con clave única `(cycleId, eventType)`;
4. dentro de una transacción, insertar el evento solo si no existe y actualizar el agregado una sola vez;
5. devolver `alreadyRecorded: true` en reintentos.

Esto permite reintentos seguros y auditoría. Puede aprovechar `PlaybackEvent` o una tabla más pequeña de awards idempotentes.

### Incluir contexto de canción en notificaciones y logs

Aunque se implemente agregación, el sistema debería pasar el contexto completo:

```text
sessionId
filePath
title
eventType
visibilityState
requestedAt
recordedAt
```

Para diagnóstico, registrar temporalmente esos campos tanto al enviar IPC como después de la transacción permitiría comprobar si el mismo `sessionId` llegó dos veces.

## Propuesta priorizada

| Prioridad | Cambio | Resultado |
| --- | --- | --- |
| P0 | Suprimir toasts individuales cuando la ventana no está visible y mostrar un único resumen al restaurar | Elimina el bug visible sin afectar estadísticas. |
| P0 | Usar un único `toastId`/toast actualizable para short views y otro para long views | Evita torres de notificaciones incluso ante ráfagas en primer plano. |
| P1 | Añadir `limit={3}` y limpiar la cola de notificaciones de playback antiguas | Protección adicional del layout. |
| P1 | Añadir `sessionId`/`cycleId` y restricción única backend | Impide duplicados reales y habilita auditoría. |
| P1 | Añadir logs estructurados temporales para award y commit | Confirma si el caso reportado también duplica SQLite. |
| P2 | Decidir si `pauseOnFocusLoss={false}` mejora otras notificaciones | Ajuste de UX, insuficiente por sí solo. |
| P2 | Evaluar `backgroundThrottling: false` solo con medición de consumo | Mitigación de scheduler, no solución de dominio. |

## Plan de verificación de una corrección

No basta con confirmar que ya no se ven muchos toasts. Hay que comprobar por separado UI y base de datos:

1. Preparar tres canciones de más de 15 segundos y una cola conocida.
2. Registrar los valores iniciales de `short_view_count` y filas `PlayHistory`.
3. Minimizar antes de alcanzar diez segundos.
4. Permitir que se reproduzcan las tres canciones.
5. Restaurar/maximizar.
6. Verificar que aparezca cero o un toast resumen, nunca tres individuales.
7. Verificar que cada canción reproducida una vez haya incrementado exactamente uno.
8. Repetir la misma canción dos veces y comprobar exactamente dos incrementos, cada uno con distinto `cycleId`.
9. Simular dos envíos del mismo `(cycleId, short-view-award)` y comprobar un solo incremento.
10. Repetir ocultando en bandeja, porque no es idéntico a minimizar.

Pruebas automatizadas necesarias:

- burst de `timeupdate` durante una solicitud pendiente;
- varias sesiones en background con un solo resumen;
- transición `hidden -> visible`;
- cola de toasts limitada/limpiada;
- backend idempotente ante el mismo `cycleId`;
- dos ciclos legítimos del mismo archivo;
- cierre a bandeja frente a minimización;
- respuesta IPC antigua cuando otra canción está activa.

No se requiere una prueba visual para validar la lógica; el notifier puede probarse con `document.visibilityState` simulado y mocks de React-Toastify.

## Conclusión

La causa más probable y directamente demostrable del reporte es la combinación de:

```text
un toast nuevo por award
+ pauseOnFocusLoss=true
+ backgroundThrottling=true
+ contenedor sin limit
+ mensajes sin identidad de canción
= todos los toasts de reproducción acumulados aparecen juntos al restaurar
```

La deduplicación en memoria hace que una misma sesión normalmente solo escriba una short view. Por eso el primer arreglo debe estar en la política de notificaciones: no emitir UI individual mientras la ventana esté oculta, agregar el resultado y mostrar como máximo un resumen al volver.

En paralelo, conviene hacer el backend idempotente con IDs de ciclo. Esa segunda medida no es necesaria para explicar la torre de toasts, pero sí es necesaria para garantizar que nunca exista una duplicación real del contador y para poder demostrarlo con datos auditables.

## Fuentes consultadas

- Código local de Elevate en los archivos y líneas citados.
- Código distribuido de React-Toastify 10.0.6 instalado en `node_modules`, donde los defaults incluyen `pauseOnFocusLoss: true` y cada toast sin `toastId` recibe un ID generado.
- Documentación oficial de React-Toastify consultada mediante Context7: `ToastContainer`, `toastId`, `toast.isActive`, `limit` y `clearWaitingQueue`.
- Documentación oficial de Electron consultada mediante Context7: `backgroundThrottling`, Page Visibility y activación del renderer al restaurar una ventana minimizada.
