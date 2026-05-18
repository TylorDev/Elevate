# Reporte: ¿Mover los nombres (Keys) de los Presets a la Base de Datos?

La respuesta corta es: **Depende de qué más muevas**. 

Si **solo** mueves los nombres (las llaves o strings) a la base de datos, el rendimiento en realidad **empeorará** y el código **aumentará**. Sin embargo, si mueves **tanto los nombres como el código JSON de los presets** a la base de datos, obtendrás una **mejora masiva en la memoria RAM** de tu aplicación.

A continuación se detalla el porqué de cada escenario:

---

## Escenario 1: Guardar SOLO los Nombres (Keys) en la BD

Actualmente, el código hace esto en una sola línea:
`const ALL_PRESET_KEYS = Object.keys(PRESET_CATALOG)`

Si decidieras guardar esos nombres en Prisma/SQLite, los resultados serían:

* 🔴 **Rendimiento (Empeora):** Filtrar y buscar un string en un arreglo en memoria de JavaScript (incluso si son 10,000 presets) toma menos de **1 milisegundo**. Si lo mueves a la base de datos, cada vez que abras la pestaña de biblioteca o busques un preset, React tendrá que hacer una llamada IPC asíncrona a Electron, que consultará a SQLite y devolverá la respuesta. Esto añade latencia innecesaria (aprox 10-30ms) para algo que el navegador puede hacer instantáneamente. Además, aún tendrías que cargar el archivo `elevate.min.js` entero en memoria para reproducirlos de todos modos.
* 🔴 **Magnitud del Código (Aumenta):** Tendrías que escribir un esquema en `schema.prisma`, crear funciones de migración para "sembrar" (seed) la base de datos la primera vez que se abre la app, y crear nuevos canales IPC (ej. `visualizer:search-presets`, `visualizer:get-presets`). Reemplazarías 1 línea de código en React por ~50 líneas de código backend.

---

## Escenario 2: Guardar los Nombres Y los Datos JSON del Preset en la BD

Aquí es donde la arquitectura cambia por completo. En lugar de importar el archivo pesado `elevate.min.js` (que puede pesar varios Megabytes y congela la carga inicial de React), inyectas todos esos JSON en la base de datos durante la instalación o primer inicio.

* 🟢 **Rendimiento de Memoria (Mejora Masivamente):** En lugar de que React cargue 5,000 presets en la RAM permanentemente, React carga **0 presets** en memoria inicial. Cuando el reloj dice que es hora de cambiar el visualizador (cada 5 segundos), hace una llamada a la BD: `SELECT jsonData FROM Presets WHERE name = 'mi_preset_favorito'`, y solo carga ese pequeño objeto en memoria. Se llama **Lazy Loading** (Carga Diferida).
* 🔴 **Magnitud del Código (Aumenta):** El código crecerá porque necesitarás un script de ingesta (para leer el `.min.js` original, desarmarlo, e insertarlo en SQLite), esquemas Prisma, y lógica de lectura bajo demanda.

---

## Resumen y Recomendación

### ¿Reduce la magnitud del código?
**No, de ninguna manera.** Mover datos estáticos locales a una base de datos siempre requiere más código "boilerplate" (esquemas, migraciones, IPCs, handlers asíncronos). `Object.keys()` siempre será la solución con menos código.

### ¿Mejora el rendimiento?
* Si el archivo de presets de Butterchurn no es muy pesado (menos de 2 MB), **no lo muevas a la base de datos**. Mantén `Object.keys()`. La CPU de hoy en día filtra arreglos de 2 MB instantáneamente.
* Si tienes una mega-biblioteca de +10,000 presets y el archivo `.min.js` pesa 10 MB o más, **sí, muévelo completo a la BD (Escenario 2)**. Aumentará un poco la complejidad del código, pero tu aplicación usará muchísima menos RAM y cargará más rápido al inicio.
