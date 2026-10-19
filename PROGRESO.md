# Progreso de la noche (18 → 19 oct 2026)

Plan: `PLAN.md`. Rama: `asignacion-y-flujos`. Corte: 05:00.

## Bitácora
- 20:46 — Fase 0: rama creada, suspensión bloqueada hasta las 05:05, dependencias de pruebas instaladas.
- 20:53 — Fase 1 (algoritmos) lista: `assign.js` (húngaro + casos particulares), `maxflow.js` (Edmonds-Karp + corte mínimo), `mincost.js` (rutas más baratas sucesivas), `netmodel.js`, `netverify.js` (PL + librería), 15 memorias en `vault.js` y `tests/run.mjs`. Los 12 ejercicios nuevos dan el valor del libro y coinciden con la fuerza bruta, el PL resuelto con Simplex y la librería. Datos corregidos con la web: Distribution Unlimited (capacidad 10 en F1→F2) da 49 000, igual que el libro. El ejercicio de maximización es "adaptado" porque no se encontró uno de libro con datos verificables.
- 20:58 — Cuaderno paso a paso (`netnotebook.js`), dibujo de redes (`netdraw.js`), `tests/dump.mjs` y estilos LaTeX compartidos (`estilo-libro.sty`, `estilo-presentacion.sty`). Se lanzaron 4 agentes en paralelo, uno por tema, para escribir los documentos y las presentaciones. Yo sigo con la interfaz (Fase 2).
- 21:03 — Fase 2 (interfaz): pestañas 3P/4P/5P, formularios de asignación y redes (`netforms.js`), pantallas de resultado (`netui.js`), tabla húngara con líneas y círculos, redes en SVG, bóveda agrupada por tema con 15 memorias, enlaces `index.html#mN&run`, IA con temas nuevos. Revisado con capturas de Firefox (memorias 8, 9, 11 y 13).
- 21:05 — Capturas de las 12 memorias para las presentaciones (`documentacion/presentaciones/capturas/`), vista de celular revisada, `tests/bordes.mjs` (20 casos borde + IA simulada en los 3 modos nuevos: todos pasan) y README actualizado.
- 21:10 — Tema 3 (flujo máximo) terminado: `04-flujo-maximo.pdf` (14 págs.) y su presentación (14 diapositivas). Revisado: sigue los caminos de la calculadora y las figuras están bien. La red de Taha se marcó como "adaptado de" porque en el libro algunos arcos podrían tener capacidad en los dos sentidos.
- 21:15 — Tema 1 (asignación y Kuhn-Munkres) terminado: `02-asignacion-kuhn-munkres.pdf` (14 págs.) y su presentación (14 diapositivas). Revisado. Por sugerencia del agente, el cuaderno ahora dice "único cero libre de su fila" en el paso 5.
- 21:19 — Tema 4 (flujo a costo mínimo) terminado: `05-flujo-costo-minimo.pdf` (16 págs., 2 más que el objetivo por la portada con índice y los dibujos de las rutas que deshacen envíos) y su presentación (14 diapositivas). Revisado.
- 21:21 — Tema 2 (casos particulares) terminado: `03-casos-particulares-asignacion.pdf` (15 págs.) y su presentación (14 diapositivas). El agente detectó un aviso falso de "óptimos múltiples" en Better Products: solo se intercambiaban copias de la misma planta. Se corrigió `assign.js`: ahora solo cuenta si cambia una pareja real agente→tarea. Se agregó una prueba, se ajustó el texto del documento y se rehízo la captura m9.
- 21:22 — Prueba de interfaz con clics reales (Playwright + Firefox, `tests/ui.mjs`): 17/17 OK, sin errores en consola. Se lanzaron 2 agentes revisores para corregir los 4 documentos y las 4 presentaciones.
- 21:31 — Revisión de los temas 1 y 2 terminada: los números coinciden con la calculadora. Se hicieron correcciones puntuales: explicaciones de líneas en Klyne, Fowle y Machineco, Job Shop (18 de 24 combinaciones respetan la prohibición), redacción, franjas y etiquetas encimadas en figuras, y títulos sueltos al final de página.
- 21:34 — Revisión de los temas 3 y 4 terminada: sin errores numéricos; se corrigió una afirmación (Powerco tiene una sola solución óptima), el argumento del teorema de Ford-Fulkerson en la presentación, etiquetas tapadas en las figuras y redacción. Fase 5: compilación limpia de los 9 archivos LaTeX sin errores, pruebas 15/15, bordes 21/21, interfaz 17/17. Trabajo terminado.

## Resumen final

**Todo el plan quedó hecho antes de las 05:00.** Rama `asignacion-y-flujos` (commits locales, sin push).

### Entregables

| Qué | Dónde | Estado |
|---|---|---|
| Calculadora con 5 modos (1P Simplex, 2P Dualidad, **3P Asignación**, **4P Flujo máximo**, **5P Costo mínimo**) | `index.html` (doble clic) | ✅ |
| Tema 1 · Asignación y Kuhn-Munkres | `documentacion/02-asignacion-kuhn-munkres.pdf` (15 págs.) | ✅ |
| Tema 2 · Casos particulares de la asignación | `documentacion/03-casos-particulares-asignacion.pdf` (15 págs.) | ✅ |
| Tema 3 · Flujo máximo | `documentacion/04-flujo-maximo.pdf` (14 págs.) | ✅ |
| Tema 4 · Flujo a costo mínimo | `documentacion/05-flujo-costo-minimo.pdf` (16 págs.) | ✅ |
| 4 presentaciones (14 diapositivas cada una) | `documentacion/presentaciones/*.pdf` | ✅ |
| Pruebas | `tests/` (`node run.mjs`, `node bordes.mjs`, `node ui.mjs`) | ✅ |

### Los 12 ejercicios nuevos (memorias M4–M15 de la bóveda)

| Tema | Ejercicio | Fuente | Óptimo |
|---|---|---|---|
| 1 | Los hijos de Joe Klyne | Taha | 27 |
| 1 | Fowle Marketing Research | Anderson, Sweeney y Williams | 26 |
| 1 | Machineco | Winston | 15 |
| 2 | Job Shop Co. (no balanceado + prohibida) | Hillier y Lieberman | 29 |
| 2 | Vendedores y zonas (maximización) | **adaptado** (datos propios) | 252 |
| 2 | Better Products Co. (plantas con 2 productos) | Hillier y Lieberman | 3 290 |
| 3 | Sunco Oil | Winston | 3 |
| 3 | Parque Seervada | Hillier y Lieberman | 14 |
| 3 | Red de Taha | **adaptado de** Taha | 60 |
| 4 | Powerco (transporte como red) | Winston | 1 020 |
| 4 | Distribution Unlimited Co. | Hillier y Lieberman | 49 000 |
| 4 | Ruta más corta en Seervada | Hillier y Lieberman | 13 |

### Prueba "calculadora = documento"

`node tests/run.mjs` → **15/15**: cada ejercicio da el valor del libro y coincide con la fuerza bruta (asignación), el corte mínimo o la conservación (redes), el mismo problema como PL resuelto con Simplex Revisado, la librería javascript-lp-solver y el `\res{}` del PDF. Además, `tests/bordes.mjs` (21 casos borde y la IA simulada en los 3 modos nuevos) y `tests/ui.mjs` (17 controles con clics reales en Firefox, sin errores en consola).

### Lo que le toca al grupo

1. **Integrantes:** cada presentación tiene una diapositiva con 5 líneas en blanco para los nombres.
2. **Pacto pedagógico:** no estaba en la carpeta. Revisen sus requisitos (portada, duración, formato) contra las presentaciones.
3. **Ejercicios "adaptados":** el de maximización (vendedores) tiene datos propios porque no se encontró uno de libro con datos verificables. La red de Taha podría tener en el libro algunos arcos con capacidad en los dos sentidos. Ambos están señalados así en el PDF.
4. **Moneda:** el ejemplo pequeño del tema 4 (panaderías) habla de "soles"; cámbienlo si en su país usan otra moneda.
5. La rama no se subió a GitHub (no se hizo push). Para llevarla a `main`: `git checkout main && git merge asignacion-y-flujos`.
