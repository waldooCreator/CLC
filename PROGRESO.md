# Progreso de la noche (18 → 19 oct 2026)

Plan: `PLAN.md`. Rama: `asignacion-y-flujos`. Corte: 05:00.

## Bitácora
- 20:46 — Fase 0: rama creada, suspensión bloqueada hasta las 05:05, dependencias de pruebas instaladas.
- 20:53 — Fase 1 (algoritmos) lista: `assign.js` (húngaro + casos particulares), `maxflow.js` (Edmonds-Karp + corte mínimo), `mincost.js` (rutas más baratas sucesivas), `netmodel.js`, `netverify.js` (PL + librería), 15 memorias en `vault.js` y `tests/run.mjs`. Los 12 ejercicios nuevos dan el valor del libro y coinciden con la fuerza bruta, el PL resuelto con Simplex y la librería. Datos corregidos con la web: Distribution Unlimited (capacidad 10 en F1→F2) da 49 000, igual que el libro. El ejercicio de maximización es "adaptado" porque no se encontró uno de libro con datos verificables.
- 20:58 — Cuaderno paso a paso (`netnotebook.js`), dibujo de redes (`netdraw.js`), `tests/dump.mjs` y estilos LaTeX compartidos (`estilo-libro.sty`, `estilo-presentacion.sty`). Se lanzaron 4 agentes en paralelo, uno por tema, para escribir los documentos y las presentaciones. Yo sigo con la interfaz (Fase 2).
- 21:03 — Fase 2 (interfaz): pestañas 3P/4P/5P, formularios de asignación y redes (`netforms.js`), pantallas de resultado (`netui.js`), tabla húngara con líneas y círculos, redes en SVG, bóveda agrupada por tema con 15 memorias, enlaces `index.html#mN&run`, IA con temas nuevos. Revisado con capturas de Firefox (memorias 8, 9, 11 y 13).
- 21:05 — Capturas de las 12 memorias para las presentaciones (`documentacion/presentaciones/capturas/`), vista de celular revisada, `tests/bordes.mjs` (20 casos borde + IA simulada en los 3 modos nuevos: todos pasan) y README actualizado.
- 21:10 — Tema 3 (flujo máximo) terminado: `04-flujo-maximo.pdf` (14 págs.) y su presentación (14 diapositivas). Revisado: sigue los caminos de la calculadora y las figuras están bien. La red de Taha se marcó como "adaptado de" porque en el libro algunos arcos podrían tener capacidad en los dos sentidos.
