# Plan para que `Settings.jsx` acepte imágenes locales y remotas con validación clara

## Resumen

Hoy `Settings.jsx` permite escribir URLs, pero no valida si realmente apuntan a una imagen, no soporta bien archivos locales del usuario y además choca con la CSP actual, que solo deja cargar imágenes de `self`, `data:`, `blob:` y `https://i.pinimg.com`.

La solución más robusta es **no depender de permitir “cualquier dominio” directamente en `img-src`**. En vez de eso, `Settings` debe:

- aceptar **archivo local** o **URL remota**
- mandar esa entrada al proceso principal
- validar allí si el recurso existe y si realmente es una imagen
- convertirlo a una **URL segura local (`blob:` o `data:`)** para el renderer
- guardar junto con esa URL un estado claro de error o éxito

Así resolvemos CSP, validación y mensajes de error en un solo flujo.

## Problemas actuales

### 1. La CSP bloquea casi cualquier imagen remota

En [src/renderer/index.html](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/index.html:8), `img-src` está limitado a:

- `'self'`
- `data:`
- `blob:`
- `https://i.pinimg.com`

Por eso una imagen como `https://github.com/TylorDev.png` queda bloqueada aunque sea una imagen válida.

### 2. `Settings.jsx` guarda texto sin validar

En [src/renderer/src/components/Settings/Settings.jsx](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/Settings/Settings.jsx:60) y [Settings.jsx](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/Settings/Settings.jsx:66):

- solo se guarda la URL en estado/localStorage
- no se comprueba si responde
- no se comprueba `Content-Type`
- no se distingue imagen válida de HTML, 404, timeout o CSP

### 3. El background consume la URL cruda

En [src/renderer/src/components/Background/Background.jsx](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/Background/Background.jsx:24), el fondo usa:

- `style={{ backgroundImage: \`url(${imageUrl})\` }}`

Eso significa que aunque el preview se arreglara, el fondo real seguiría rompiéndose si se guarda una URL remota que CSP no permite.

### 4. No hay mensajes de error útiles

Ahora mismo el usuario no recibe una explicación concreta de:

- “esta URL devolvió HTML, no una imagen”
- “el servidor respondió 404”
- “no se pudo conectar”
- “el archivo local no es una imagen”
- “la imagen no se pudo leer”

## Enfoque recomendado

Usar **validación y normalización en el proceso principal**.

El renderer no debería usar URLs remotas arbitrarias directamente. En su lugar:

1. el usuario pega una URL o elige un archivo local
2. el renderer invoca IPC
3. el main process:
   - descarga o lee el archivo
   - valida el tipo MIME
   - detecta HTML u otras respuestas inválidas
   - devuelve una imagen segura para renderer (`blob`/`data`) o una ruta local interna
4. `Settings` muestra preview y guarda el resultado normalizado

Esto evita abrir demasiado la CSP y permite dar errores mucho más precisos.

## Cambios por archivo

### [src/renderer/src/components/Settings/Settings.jsx](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/Settings/Settings.jsx)

**Objetivo:** convertir los inputs actuales en un flujo real de selección + validación + preview + error.

**Qué hacer:**

1. Separar claramente dos superficies:
   - `Banner Image`
   - `Background Image`
2. Para cada una, manejar estado local más rico:
   - `draftValue`
   - `resolvedImageUrl`
   - `sourceType` (`remote` o `local`)
   - `isValidating`
   - `errorMessage`
3. Cambiar el flujo de `onChange`:
   - escribir en el input no debe guardar automáticamente como valor final
   - guardar solo cuando el usuario confirme (`Apply`, `Load`, o blur controlado)
4. Agregar botón para elegir archivo local:
   - algo tipo `Choose Image`
   - dispara un IPC de selección de archivo o un `<input type="file" accept="image/*">`
5. Al confirmar URL remota:
   - invocar IPC de validación/remoto
   - si responde imagen válida, actualizar preview y persistir valor normalizado
   - si falla, mostrar mensaje claro y no sobrescribir el valor bueno anterior
6. Al elegir archivo local:
   - validar extensión/MIME vía IPC
   - si es correcto, crear preview segura y persistir
   - si no, mostrar error claro
7. Mostrar mensajes de estado por bloque:
   - cargando
   - error
   - éxito
8. No renderizar `<img src={rawUrl}>` directamente con la URL remota pegada por el usuario.
9. El banner (`bannerImageUrl`) y el fondo (`backgroundImageUrl`) deben guardar ya la versión segura/resuelta, no el input crudo.

**Mensajes de error a contemplar en este archivo:**

- “La URL no devolvió una imagen.”
- “La URL devolvió una página HTML en lugar de una imagen.”
- “El servidor respondió con estado 404.”
- “No se pudo conectar con el servidor de la imagen.”
- “El archivo seleccionado no es una imagen compatible.”
- “No se pudo leer la imagen seleccionada.”

---

### [src/renderer/src/components/Settings/Settings.scss](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/Settings/Settings.scss)

**Objetivo:** dar espacio a selección local, errores y feedback.

**Qué hacer:**

1. Añadir estilos para una fila de acciones del input:
   - input URL
   - botón `Apply`
   - botón `Choose Image`
   - botón `Clear`
2. Añadir estilos para estado de carga:
   - spinner o texto sutil
3. Añadir estilos para mensajes:
   - error visible pero sobrio
   - éxito discreto
4. Añadir estilos para preview inválido o placeholder cuando no haya imagen
5. Mantener consistencia con el resto de Settings

---

### [src/renderer/src/components/Background/Background.jsx](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/Background/Background.jsx)

**Objetivo:** consumir solo una imagen ya validada/normalizada.

**Qué hacer:**

1. Mantener la lectura desde storage o contexto, pero asumir que el valor ya no es una URL remota arbitraria, sino una URL segura resuelta.
2. Si se introduce estructura más rica en storage, por ejemplo:
   - `{ original, resolved, sourceType }`
     entonces este componente debe leer `resolved`.
3. Si la carga falla igualmente en runtime:
   - no romper el fondo
   - ocultarlo o caer a estado vacío
4. Evitar depender de polling si al mismo tiempo se puede centralizar mejor en contexto; si no se cambia eso ahora, al menos adaptar el valor leído.

---

### [src/renderer/src/Contexts/SupeContext.jsx](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/SupeContext.jsx)

**Objetivo:** centralizar persistencia y shape del valor del background.

**Qué hacer:**

1. Cambiar `backgroundImageUrl` para que no sea solo un string simple si hace falta más metadata.
2. Definir una estructura persistida, por ejemplo:
   - `originalInput`
   - `resolvedUrl`
   - `sourceType`
   - `lastError` opcional
3. Ajustar `handleBackgroundImageUrlChange` para guardar esa estructura o, como mínimo, guardar el `resolvedUrl` final ya validado.
4. Mantener compatibilidad con valores antiguos de localStorage:
   - si hay un string viejo, tratarlo como `resolvedUrl` legacy
5. No validar red aquí; la validación debe vivir en IPC/main.

---

### [src/main/index.mjs](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/main/index.mjs)

**Objetivo:** registrar handlers IPC nuevos para selección y validación de imágenes.

**Qué hacer:**

1. Añadir handlers IPC para:
   - seleccionar imagen local
   - validar/cargar imagen remota
2. Los handlers deberían vivir idealmente en un módulo IPC dedicado, pero si por estilo del proyecto conviene aquí primero, dejarlo claramente encapsulado.
3. Definir payloads de respuesta consistentes:
   - `success`
   - `resolvedUrl` o `imageDataUrl`
   - `mimeType`
   - `errorCode`
   - `errorMessage`

**Casos de error que debe devolver main:**

- `invalid_url`
- `network_error`
- `http_error`
- `html_response`
- `unsupported_content_type`
- `file_not_found`
- `invalid_local_file`
- `read_failed`

---

### [src/main/ipc/... nuevo módulo recomendado, por ejemplo `src/main/ipc/imageSourceHandlers.mjs`](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/main/ipc)

**Archivo nuevo recomendado.**

**Objetivo:** encapsular la lógica de imágenes externas/locales.

**Qué hacer:**

1. Crear un handler para URL remota:
   - recibir URL
   - validar protocolo (`http:`/`https:`)
   - hacer fetch desde main
   - inspeccionar `status`
   - inspeccionar `content-type`
2. Reglas de validación remota:
   - si `status >= 400`, devolver error claro con código HTTP
   - si `content-type` incluye `text/html`, devolver mensaje específico:
     - “La URL devolvió HTML en lugar de una imagen.”
   - si `content-type` no empieza con `image/`, devolver:
     - “El recurso no es una imagen compatible.”
3. Si la respuesta es imagen válida:
   - leer bytes
   - generar representación segura para renderer:
     - preferido: `data:` o mecanismo local temporal
   - devolver ese valor en `resolvedUrl`
4. Crear handler para archivo local:
   - abrir diálogo del sistema o recibir path
   - validar que el archivo exista
   - validar MIME/extensión
   - leer bytes
   - devolver `resolvedUrl` segura
5. Mantener una capa pequeña de helpers:
   - `mapImageLoadError`
   - `isHtmlContentType`
   - `isSupportedImageContentType`

---

### [src/preload/index.mjs](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/preload/index.mjs)

**Objetivo:** exponer API segura para `Settings`.

**Qué hacer:**

1. Añadir un namespace claro, por ejemplo:
   - `window.electron.imageSources.validateRemote(...)`
   - `window.electron.imageSources.pickLocal(...)`
2. Mantener separado de `windowControls`, porque esto es configuración/media source.
3. Exponer solo las operaciones necesarias, no `ipcRenderer` genérico nuevo.

---

### [src/renderer/index.html](/abs/path/c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/index.html)

**Objetivo:** resolver CSP sin abrirla más de lo necesario.

**Qué hacer:**

1. Mantener `img-src` restringido a:
   - `'self'`
   - `data:`
   - `blob:`
   - si sigue haciendo falta, `https://i.pinimg.com`
2. No cambiar a `img-src https:` o `img-src *`.
3. Si el background usa `background-image` con `data:` o `blob:`, revisar también si `style-src` actual lo permite por inline style; en principio ya usa `'unsafe-inline'`, así que no debería bloquear el style inline.
4. Si se descubre que la carga de fondo requiere `connect-src` para fetch remoto desde renderer, evitarlo moviendo el fetch al main process, que es la opción recomendada.

## Flujo funcional final

### Caso 1: URL remota válida

1. Usuario pega URL
2. `Settings` llama IPC
3. Main hace fetch
4. Si `content-type` es `image/*`, devuelve preview segura
5. `Settings` muestra preview y guarda valor resuelto

### Caso 2: URL devuelve HTML

1. Usuario pega URL
2. Main detecta `text/html`
3. Respuesta:
   - error claro: “La URL devolvió una página HTML en lugar de una imagen.”
4. `Settings` no reemplaza la imagen válida anterior

### Caso 3: URL inválida / 404 / timeout

1. Main detecta fallo concreto
2. Devuelve mensaje claro
3. `Settings` lo muestra debajo del input

### Caso 4: archivo local válido

1. Usuario elige imagen local
2. Main lee archivo
3. Devuelve preview segura
4. `Settings` guarda y muestra preview

### Caso 5: archivo local no válido

1. Main detecta que no es imagen
2. Devuelve:
   - “El archivo seleccionado no es una imagen compatible.”

## Casos de prueba

- URL `https://github.com/TylorDev.png` debe funcionar tras pasar por IPC/main.
- URL que devuelve HTML debe mostrar error específico de HTML.
- URL con `404` debe mostrar error con estado.
- URL con `content-type` no imagen (`application/json`, `text/plain`) debe mostrar error claro.
- Archivo local `.png`, `.jpg`, `.webp`, `.gif` debe funcionar.
- Archivo local no imagen debe rechazarse.
- El preview de `Settings` y el fondo real de `Background` deben usar la misma imagen resuelta.
- Limpiar imagen debe borrar preview, storage y fondo.
- Valores viejos en localStorage no deben romper la app.

## Supuestos cerrados

- El soporte aplica tanto a la imagen de banner como al background.
- La validación remota se hará en el proceso principal, no directamente en renderer.
- La CSP no se abrirá a “cualquier servidor”; el renderer seguirá cargando solo `blob:`/`data:`/`self`, y el main actuará como capa de validación/normalización.
