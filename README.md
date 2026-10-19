# CLC — Calculadora de Investigación de Operaciones

Calculadora web para Investigación de Operaciones. Resuelve problemas de
programación lineal con el **Método Simplex Revisado**, construye y resuelve el
**problema dual**, y resuelve problemas de **asignación** (método de
Kuhn-Munkres), **flujo máximo** y **flujo a costo mínimo**. Muestra cada paso
como si estuviera escrito a mano en una hoja de cuaderno.

Interfaz de estética arcade retro.

## Cómo abrirla

Doble clic en `index.html`. No necesita servidor, ni instalación, ni conexión
para calcular: todo corre en el navegador.

Enlace directo a un ejercicio de la bóveda: `index.html#m11` lo carga e
`index.html#m11&run` además lo resuelve.

## Qué hace

| Modo | Qué resuelve | Método que muestra paso a paso |
|---|---|---|
| **1P Simplex Revisado** | Programación lineal | Forma producto de la inversa: B⁻¹, π = c_B B⁻¹, costos reducidos, razón mínima, matrices eta. Gran M y Dos Fases |
| **2P Dualidad** | El dual de un PL | Reglas de signos, solución del dual, dualidad fuerte, precios sombra y holgura complementaria |
| **3P Asignación** | Agentes ↔ tareas, minimizando o maximizando | Método húngaro: restar mínimos, tapar ceros con el menor número de líneas, ajustar y asignar |
| **4P Flujo máximo** | Cuánto se puede enviar de una fuente a un sumidero | Ford-Fulkerson con búsqueda en anchura (Edmonds-Karp) y corte mínimo |
| **5P Costo mínimo** | Enviar ofertas a demandas gastando lo menos | Rutas más baratas sucesivas (red residual con Bellman-Ford) |

- **Casos particulares de la asignación**: problema no balanceado (filas o
  columnas ficticias), maximización (pérdida de oportunidad), asignaciones
  prohibidas (costo M), un agente con varias tareas (capacidad) y aviso de
  óptimos múltiples.
- **Redes**: dibujo de cada iteración con el camino resaltado, arcos que
  devuelven flujo, corte mínimo, nodos ficticios cuando la oferta y la demanda no
  coinciden, y redes no dirigidas (ruta más corta).
- **Despejes y método gráfico** opcionales en Simplex y Dualidad.
- **Bóveda de ejercicios**: guarda y recupera ejercicios, con 15 memorias
  precargadas agrupadas por tema (los ejercicios resueltos en los PDF).
- **Explicar a detalle**: opcionalmente, una IA vía OpenRouter redacta la
  explicación de cada paso del cuaderno con lenguaje llano, en los cinco modos.

## Precisión

Los cálculos usan **aritmética racional exacta** con BigInt (sin errores de
punto flotante). Cada resultado se contrasta de forma independiente:

- Simplex y Dualidad, contra la librería `javascript-lp-solver` 1.0.3.
- Asignación, flujo máximo y costo mínimo: el mismo problema se plantea como
  programación lineal y se resuelve con el Simplex Revisado exacto y con la
  librería; en asignación también se prueban todas las permutaciones.

La pantalla solo muestra un aviso si algo no coincide.

## Estructura

| Archivo | Rol |
|---|---|
| `js/fraction.js` | Fracciones exactas con BigInt y valores con Gran M |
| `js/linalg.js` | Álgebra matricial: inversa, productos, submatrices |
| `js/solver.js` | Estandarización del modelo y motor del Simplex Revisado |
| `js/dual.js` | Construcción del dual y comprobaciones de dualidad |
| `js/graphic.js` | Método gráfico y dibujo del SVG |
| `js/assign.js` | Método húngaro y casos particulares de la asignación |
| `js/maxflow.js` | Flujo máximo (Edmonds-Karp) y corte mínimo |
| `js/mincost.js` | Flujo a costo mínimo (rutas más baratas sucesivas) |
| `js/netmodel.js` | Lectura y validación de los formularios de asignación y redes |
| `js/netverify.js` | Modelos de PL equivalentes y verificación cruzada |
| `js/netdraw.js` | Dibujo de redes en SVG |
| `js/netnotebook.js` | Pasos de asignación y redes en formato hoja de cuaderno |
| `js/netforms.js` | Formularios de los modos 3P, 4P y 5P |
| `js/netui.js` | Pantallas de resultado de los modos 3P, 4P y 5P |
| `js/notebook.js` | Redacción de los pasos en formato hoja de cuaderno |
| `js/render.js` | Pantallas de resultado de Simplex y Dualidad |
| `js/verify.js` | Verificación contra la librería externa |
| `js/vault.js` | Bóveda de ejercicios en localStorage y memorias precargadas |
| `js/ai.js` | Cliente de OpenRouter para las explicaciones |
| `js/app.js` | Interfaz y estado |

## Pruebas

```
cd tests
npm install
node run.mjs      # los 15 ejercicios: calculadora = libro = PDF = PL = librería
node bordes.mjs   # casos borde y explicación con IA simulada
node dump.mjs 11  # imprime el cuaderno de una memoria en texto
node ui.mjs       # opcional: clics reales en Firefox (requiere playwright)
```

## Configurar la IA (opcional)

La calculadora resuelve sin IA. Para activar "explicar a detalle":

1. Crea una cuenta en [openrouter.ai](https://openrouter.ai).
2. Genera una API key en *Keys*.
3. Pulsa **OPENROUTER** en la app y pégala.

La clave se guarda únicamente en el localStorage de tu navegador; no se sube a
ningún lado ni queda en el código.

## Documentación

En `documentacion/`, documentos en LaTeX con la explicación de cada método y
ejercicios clásicos resueltos paso a paso (el PDF compilado está incluido):

| Documento | Tema |
|---|---|
| `ejercicios-simplex-revisado` | Método Simplex Revisado (3 ejercicios) |
| `02-asignacion-kuhn-munkres` | Problema de asignación y método de Kuhn-Munkres (3 ejercicios) |
| `03-casos-particulares-asignacion` | Casos particulares de la asignación (3 ejercicios) |
| `04-flujo-maximo` | Problema de flujo máximo (3 ejercicios) |
| `05-flujo-costo-minimo` | Problema de flujo a costo mínimo (3 ejercicios) |

`documentacion/presentaciones/` tiene una presentación (Beamer) por tema. Los
documentos usan `estilo-libro.sty` y las presentaciones `estilo-presentacion.sty`;
se compilan con `pdflatex` dentro de su carpeta.
