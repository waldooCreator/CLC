# Plan de implementación: Asignación y Flujo en Redes

Entrega: **lunes 19 de octubre de 2026**. Trabajo nocturno en modo *goal* con **corte duro a las 05:00**.

## 0. Qué se entrega al final

| # | Entregable | Dónde |
|---|---|---|
| 1 | Calculadora ampliada con 3 modos nuevos: **Asignación (Kuhn-Munkres)**, **Flujo máximo** y **Flujo a costo mínimo**. Los casos particulares se resuelven dentro de Asignación | `index.html`, `js/` |
| 2 | 4 documentos en el **mismo formato de libro** del PDF actual, con 3 ejercicios resueltos cada uno (12 en total) | `documentacion/*.tex` + `.pdf` |
| 3 | 4 presentaciones (una por tema) en Beamer, con el mismo estilo en blanco y negro | `documentacion/presentaciones/*.tex` + `.pdf` |
| 4 | Pruebas automáticas que demuestran que **calculadora = documento** en los 12 ejercicios nuevos y en los 3 antiguos | `tests/` |
| 5 | Informe de la noche: qué quedó, qué se probó y qué falta | `PROGRESO.md` |

Los 4 temas, porque "asignación" y "Kuhn-Munkres" son el problema y su método:

1. **El problema de asignación y el método de Kuhn-Munkres (húngaro)**
2. **Casos particulares de la asignación**
3. **Flujo máximo**
4. **Flujo a costo mínimo**

## 1. Reglas que se aplican a todo

- **Mismo look.** La calculadora conserva la estética arcade: paneles `px-panel`, botones `px-btn`, fuentes Press Start 2P y VT323, sonidos de 8 bits y el cuaderno con letra Kalam. Los documentos copian el preámbulo del `.tex` actual: blanco y negro, `\paso`, `\nota`, `\res`, cajas `idea` y `ojo`, y TikZ con estilos de línea en lugar de colores.
- **Lenguaje llano.** Cada concepto se explica primero con un ejemplo cotidiano y después con la fórmula. Ningún término se usa antes de definirlo, y cada documento tiene una tabla de "las palabras que se usan". Las explicaciones son cortas: un párrafo por idea.
- **Cálculo exacto.** Todos los algoritmos trabajan con `SX.Frac`, así que no hay errores de redondeo y los números coinciden con los del documento.
- **Verificación doble.** Cada problema nuevo se resuelve con su algoritmo y además se plantea como programación lineal, que se resuelve con el Simplex que ya existe (`SX.solve`) y con `javascript-lp-solver`. En asignaciones pequeñas también se prueban todas las permutaciones posibles.
- **Ejercicios de libros famosos:** Hillier y Lieberman, Taha, Winston y Anderson-Sweeney-Williams. Siempre se indica la fuente. Si un dato del libro no se puede confirmar con seguridad, el ejercicio se marca como "adaptado de".
- **Git.** Todo se hace en la rama `asignacion-y-flujos`, con un commit local al final de cada fase. **No se hace push.**
- **Prioridad si falta tiempo:** algoritmos y pruebas → calculadora → documentos → presentaciones. Nada a medias: si algo no alcanza, queda anotado en `PROGRESO.md`.

## 2. Fase 0: preparación (≈20 min)

1. Evitar que el equipo se suspenda: `systemd-inhibit --what=idle:sleep --why="goal CLC" sleep 9h`, ejecutado en segundo plano.
2. Crear la rama `asignacion-y-flujos`.
3. LaTeX: **ya está listo** (verificado el 18 oct a las 20:42). TeX Live 2026 está instalado con dnf, y `tikzfill` y `listingsutf8`, que faltaban para `tcolorbox [most]`, se agregaron en `~/texmf`. El `.tex` actual compila sin errores (23 páginas, igual que el original) y Beamer también compila. No volver a compilar encima del PDF original: usar una carpeta temporal.
4. Crear `tests/package.json` con `javascript-lp-solver@1.0.3` como dependencia de desarrollo y añadir `node_modules/` al `.gitignore`.

## 3. Fase 1: algoritmos y pruebas (≈1 h 30)

Cada archivo sigue el patrón de los actuales: un IIFE que se registra en `SX`, con funciones puras y una lista de pasos que después dibuja el cuaderno.

### 3.1 `js/assign.js`: asignación y Kuhn-Munkres
Entrada: `{ sense: 'min'|'max', agents[], tasks[], cost[i][j] (Frac o null = prohibida), capacity[i] (por defecto 1) }`.

1. **Preparación de los casos particulares.** Se aplica en este orden y cada transformación queda registrada como paso:
   - **Un agente con varias tareas** (capacidad > 1): su fila se duplica.
   - **Prohibidas:** se usa un costo M (valor `MVal` con parte M = 1, o un número grande y exacto si conviene más en pantalla).
   - **Maximización:** cada valor se resta del máximo de la matriz (matriz de "pérdida de oportunidad").
   - **No balanceado:** se agregan filas o columnas ficticias con costo 0.
2. **Método húngaro, con cada paso registrado:**
   1. Restar a cada fila su mínimo.
   2. Restar a cada columna su mínimo.
   3. Cubrir todos los ceros con el **mínimo número de líneas**. Se usa el método de marcas de König: asignación máxima sobre los ceros, marcar filas sin asignación, etc. Así las líneas son las mismas que se harían a mano.
   4. Si hay n líneas, se pasa a asignar. Si no, se toma k = el menor valor no cubierto: se resta k a lo no cubierto y se suma k en los cruces de líneas. Vuelve a 3.
   5. **Asignar:** se busca la asignación con un cero en cada fila y columna, empezando por la fila o columna con un único cero.
3. **Salida:** asignación (agente → tarea), costo total con los costos **originales**, filas o columnas ficticias que quedaron asignadas (es decir, el agente o tarea que se queda sin pareja), aviso de **óptimos múltiples** si existe otra asignación de ceros, y número de ajustes realizados.
4. **Detecciones:** si es infactible (todas las opciones posibles caen en celdas prohibidas) se dice claramente.

### 3.2 `js/maxflow.js`: flujo máximo
Entrada: `{ nodes[], arcs[{from,to,cap}], source, sink }`.

- **Ford-Fulkerson con búsqueda en anchura (Edmonds-Karp).** Por cada iteración se registra la red residual, el camino de aumento encontrado, el cuello de botella (la capacidad más pequeña del camino) y los flujos actualizados. Si el camino usa un arco al revés ("devolver flujo"), se explica.
- **Final:** flujo máximo, flujo en cada arco, **corte mínimo** (los nodos alcanzables desde la fuente en la residual y los arcos que cruzan) y la comprobación *flujo máximo = capacidad del corte mínimo*.
- Los arcos en ambos sentidos y los arcos paralelos se aceptan y se suman.

### 3.3 `js/mincost.js`: flujo a costo mínimo
Entrada: `{ nodes[{id, supply}] (oferta > 0, demanda < 0), arcs[{from,to,cap|null,cost}] }`.

1. **Preparación:** si la oferta total es distinta de la demanda, se agrega un nodo ficticio, igual que el "destino ficticio" de transporte. Se crea una superfuente y un supersumidero para unir varias ofertas y demandas.
2. **Caminos más cortos sucesivos.** En cada iteración se busca la **ruta más barata** de la superfuente al supersumidero en la red residual, con Bellman-Ford, porque los arcos de regreso tienen costo negativo. Se envía por ella todo lo que permita el cuello de botella y se registran la ruta, su costo por unidad, la cantidad enviada y el costo acumulado.
3. **Final:** flujo por arco, costo total, comprobación de conservación (lo que entra − lo que sale = oferta o demanda de cada nodo) y el **modelo de programación lineal equivalente**, para enlazar con el Simplex Revisado del primer previo.
4. **Casos que se reportan:** infactible (la demanda no se puede cubrir) e ilimitado (un ciclo de costo negativo con capacidad infinita).

### 3.4 `js/netverify.js`: verificación
- Funciones `toLP` para los 3 problemas: asignación con x_ij ∈ [0,1] (la solución del PL ya sale entera), flujo máximo y costo mínimo como PL.
- Se resuelven con `SX.solve` (exacto) y `javascript-lp-solver`, y se usa `SX.verifyBadge` para mostrar el aviso **solo si no coinciden**, como hoy.
- Fuerza bruta de permutaciones para asignaciones de hasta 7×7.

### 3.5 `tests/run.mjs`
- Carga los `js/*.js` en `node:vm` con `globalThis`, sin navegador.
- Por cada uno de los **15 ejercicios** (12 nuevos y 3 antiguos) compara el algoritmo con lo **esperado**: óptimo, asignación o flujo por arco, número de iteraciones y corte. También compara el algoritmo con el PL y con la librería.
- Los valores esperados están en `tests/esperados.json`, que es la misma fuente con la que se escriben los documentos. Una prueba adicional busca cada resultado dentro del `\res{...}` del `.tex` correspondiente: si el documento y la calculadora no dicen lo mismo, la prueba falla.
- Pruebas de bordes: no balanceado en filas y en columnas, todo prohibido, red sin camino, costo mínimo infactible, empates y óptimos múltiples.
- Se ejecuta con `node tests/run.mjs`, que imprime una tabla ✓/✗ y sale con código 1 si algo falla.

## 4. Fase 2: calculadora (≈2 h)

### 4.1 Modos
Se agregan pestañas a `.modes`: `3P ASIGNACIÓN`, `4P FLUJO MÁX.` y `5P COSTO MÍN.`. La fila de pestañas pasa a 2 líneas en pantallas angostas. Al cambiar de modo, el panel MODELO cambia de formulario y **se conservan los datos de cada modo**.

### 4.2 Formularios, en `js/forms.js` para no inflar `app.js`
- **Asignación:** OBJETIVO (MIN/MAX), número de AGENTES y TAREAS (hasta 10×10), nombres editables, matriz de celdas que aceptan número, `M` o `-` (prohibida) y una columna opcional de **CAPACIDAD** por agente. Los chips de ejemplo son: BALANCEADO, NO BALANCEADO, MAX y PROHIBIDAS.
- **Flujo máximo:** tabla de arcos (DESDE, HACIA, CAPACIDAD) con botones `+ ARCO` y `✕`, y selectores de FUENTE y SUMIDERO que se llenan con los nodos escritos.
- **Costo mínimo:** tabla de arcos (DESDE, HACIA, CAPACIDAD —vacía = sin límite—, COSTO) y tabla de nodos (NODO, OFERTA/DEMANDA, con la nota "positivo = ofrece, negativo = pide").
- Los errores de entrada se muestran con el mismo `form-error` y celdas en rojo.

### 4.3 Pantalla de resultado
Mantiene el mismo orden que Simplex: **banner arcade** (`OPTIMAL`/`INFEASIBLE` con el puntaje = costo o flujo), luego el **cuaderno paso a paso** y al final el cajón **MODO ARCADE**.
- Cuaderno, con las funciones nuevas en `js/notebook.js` (`assignNotebook`, `maxflowNotebook`, `mincostNotebook`) y los mismos tipos de línea `row` y `matrices`, más dos nuevos:
  - `hmatrix`: matriz con ceros resaltados, líneas de cobertura dibujadas (filas y columnas tachadas) y la asignación encerrada en círculo, como a mano.
  - `network`: SVG de la red.
- **Dibujo de redes**, en `js/netdraw.js`: nodos en capas según su distancia a la fuente, o con coordenadas fijas en los ejercicios del libro para que se vean igual que en el PDF. Las etiquetas de los arcos dicen `flujo/capacidad` o `costo`, el camino de la iteración se resalta en `--hot` y el corte mínimo se dibuja con una línea discontinua. Tiene modo claro dentro del cuaderno, como la gráfica actual.
- **Hojas del cuaderno:** "Preparación" (casos particulares), "Método húngaro" / "Caminos de aumento" / "Rutas más baratas", "Resultado" y, en flujos, "Modelo como programación lineal".

### 4.4 IA (explicar a detalle)
- `AI.comment(kind, …)` acepta los tipos `assign`, `maxflow` y `mincost`, cada uno con su tema y una línea de "ayuda para entender los pasos", como la que ya existe para Simplex. Por ejemplo: "en el húngaro se resta el mínimo de cada fila y columna, se cubren los ceros con el menor número de líneas…".
- `NB.forAI` aprende a convertir `hmatrix` y `network` en texto plano: la matriz como filas y la red como una lista de arcos con flujo.
- Las explicaciones se guardan en la bóveda igual que hoy.

### 4.5 Bóveda
- `PRESETS` pasa a tener 15 memorias agrupadas por tema, con subtítulos "PRIMER PREVIO · SIMPLEX", "ASIGNACIÓN", "CASOS PARTICULARES", "FLUJO MÁXIMO" y "COSTO MÍNIMO". Cada una lleva `mode`, `form`, `view` y `expected.pages` del PDF que le corresponde.
- Se amplía `isExercise` para los modos nuevos, se agregan etiquetas (`3P`, `4P`, `5P`) y se mantiene la compatibilidad con los ejercicios ya guardados.
- **Enlace directo** `index.html#m7` o `#m7&run`, que carga y resuelve una memoria. Sirve para compartir y para tomar capturas automáticas.

### 4.6 Cierre de la fase
- Actualizar `README.md`: modos nuevos, estructura de archivos y cómo correr las pruebas.
- Prueba visual con `firefox --headless --screenshot --window-size=1440,2600 "file://…/index.html#mN&run"` de cada memoria y revisión de cada captura: que no haya desbordes, que el SVG sea legible y que se vea bien a 390 px de ancho.

## 5. Fase 3: documentos (≈2 h 30)

- `documentacion/estilo-libro.sty` recibe el preámbulo del `.tex` actual, copiado. El archivo original no se modifica.
- Cuatro documentos:
  - `02-asignacion-kuhn-munkres.tex`
  - `03-casos-particulares-asignacion.tex`
  - `04-flujo-maximo.tex`
  - `05-flujo-costo-minimo.tex`

### Estructura de cada documento (igual a la del actual)
**Parte I: ¿En qué consiste?**
1. ¿Qué tipo de problema resuelve?, con un ejemplo cotidiano en una caja `ojo`.
2. La idea del método, con un dibujo en TikZ.
3. Cómo preparar el problema.
4. Las palabras que se usan (tabla).
5. Los pasos, cada uno con `\paso` y el ejemplo pequeño intercalado, más una caja `idea` de resumen y un diagrama de flujo en TikZ.
6. ¿Cómo se sabe que terminó?
7. Ventajas y desventajas, y la relación con la programación lineal y el Simplex.

**Parte II: Ejercicios resueltos** (3 por tema), cada uno con: fuente, planteamiento con tabla de datos, formulación, preparación, cada iteración con `\paso` y `\nota` al margen, `\res{…}` con el resultado, comprobación con ✓, interpretación (matriz con líneas o red con flujos en TikZ) y lo que significa en palabras.

**Cierre:** tabla resumen de los 3 ejercicios, caja de conclusiones, nota de verificación con la calculadora y la librería, y referencias.

- Extensión objetivo: de 8 a 14 páginas por documento.

### Ejercicios
Los datos se confirman en la Fase 1 con la calculadora antes de escribir cada uno.

| Tema | Ejercicio | Fuente | Qué muestra | Esperado |
|---|---|---|---|---|
| 1 | Los tres hijos de Joe Klyne (podar, pintar, lavar) | Taha, cap. 5 | 3×3 básico | costo 27 |
| 1 | Fowle Marketing Research (líderes de proyecto ↔ clientes) | Anderson-Sweeney-Williams | 3×3 con explicación completa | 26 días |
| 1 | Machineco (4 máquinas ↔ 4 trabajos, tiempos de preparación) | Winston, cap. 7 | 4×4 con al menos un ajuste de líneas | 15 h |
| 2 | Job Shop Co. (3 máquinas, 4 ubicaciones, una prohibida) | Hillier-Lieberman, cap. 8 | **no balanceado + prohibida (M)** | 29 |
| 2 | Asignación de vendedores a zonas (ganancias) | Taha o Anderson, se elige el que tenga los datos más claros | **maximización** | se confirma en la Fase 1 |
| 2 | Better Products Co. (plantas que fabrican más de un producto) | Hillier-Lieberman, cap. 8 | **un agente con varias tareas + ficticio + óptimos múltiples si aparecen** | se confirma en la Fase 1 |
| 3 | Sunco Oil (oleoducto) | Winston, cap. 8 | red pequeña, camino que **devuelve flujo** | 3 |
| 3 | Parque Seervada (tranvías O→T) | Hillier-Lieberman, cap. 9 | red mediana, corte mínimo | 14 |
| 3 | Red de oleoductos o de tuberías | Taha, cap. 6 | otro libro, varias iteraciones | se confirma en la Fase 1 |
| 4 | Powerco (3 plantas, 4 ciudades) | Winston, cap. 7 | **el transporte como caso de costo mínimo** | 1 020 |
| 4 | Distribution Unlimited Co. (fábricas, centro de distribución, almacenes) | Hillier-Lieberman, cap. 9 | red con capacidades y transbordo | se confirma en la Fase 1 |
| 4 | Ruta más corta en el Parque Seervada | Hillier-Lieberman, cap. 9 | **la ruta más corta como caso de costo mínimo** (1 unidad de O a T) | 13 |

Regla: si el valor calculado no coincide con el que trae el libro, se revisan los datos. Solo se escribe el ejercicio cuando la calculadora, el PL y la librería coinciden.

- Compilar cada documento dos veces (para el índice), revisar el log (sin errores y sin overfull grave) y mirar cada página convertida en imagen, para comprobar que las figuras TikZ no se monten sobre el texto.

## 6. Fase 4: presentaciones (≈1 h)

- 4 archivos Beamer en `documentacion/presentaciones/`, con un tema propio en blanco y negro que sigue el estilo del libro. Cada uno tiene de 10 a 14 diapositivas:
  1. Portada (tema, curso y **una diapositiva de integrantes con espacios para completar**).
  2. ¿Qué problema resuelve?, con el ejemplo cotidiano.
  3. Ideas y palabras clave.
  4. El método en pasos, con diagrama.
  5. Un ejercicio resuelto paso a paso, en versión resumida.
  6. Los otros dos ejercicios: planteamiento y resultado.
  7. **Demostración de la calculadora**: capturas generadas con `#mN&run`.
  8. Conclusiones y referencias.
- El "pacto pedagógico" no está en la carpeta: en `PROGRESO.md` se anota que el grupo debe revisar sus requisitos (portada, duración, etc.).

## 7. Fase 5: verificación final y cierre (≈30 min, empieza a más tardar a las 04:20)

1. `node tests/run.mjs` → **15/15 ✓**. La tabla queda copiada en `PROGRESO.md`.
2. Recompilar todos los PDF y repetir la revisión visual de la calculadora.
3. Comprobar que los 3 ejercicios antiguos siguen dando lo mismo, para confirmar que no se rompió nada.
4. Escribir `PROGRESO.md`: lista de entregables con su ruta, resultado de las pruebas, decisiones tomadas, pendientes y cómo abrir todo.
5. Commit final en la rama, sin push.

## 8. Control de la hora

- Antes de empezar cada fase y cada documento se revisa `date`.
- **A las 04:20** se deja de crear contenido nuevo y se pasa a la Fase 5.
- **A las 05:00** se detiene todo, aunque falte algo: lo pendiente se anota en `PROGRESO.md` y no se deja ningún archivo roto. Si algo quedó a medias, se revierte a la última versión que funcionaba.
