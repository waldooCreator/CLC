# CLC — Calculadora de Simplex Revisado y Dualidad

Calculadora web para Investigación de Operaciones. Resuelve problemas de
programación lineal con el **Método Simplex Revisado** y construye y resuelve el
**problema dual**, mostrando cada paso como si estuviera escrito a mano en una
hoja de cuaderno.

Interfaz de estética arcade retro.

## Cómo abrirla

Doble clic en `index.html`. No necesita servidor, ni instalación, ni conexión
para calcular: todo corre en el navegador.

## Qué hace

- **Simplex Revisado** con la forma producto de la inversa: base B, B⁻¹, π = c_B B⁻¹,
  costos reducidos, prueba de la razón mínima y actualización por matrices eta.
- **Dualidad**: arma el dual aplicando las reglas de signos, lo resuelve y
  comprueba dualidad fuerte, precios sombra y holgura complementaria.
- **Todos los casos**: restricciones ≤, ≥ y =, minimización, variables libres o
  no positivas, Gran M y Dos Fases, degeneración, no acotado, infactible y
  óptimos múltiples.
- **Despejes y método gráfico** opcionales, con la región factible y el recorrido
  de las iteraciones sobre los vértices.
- **Bóveda de ejercicios**: guarda y recupera ejercicios, con tres memorias
  precargadas (Wyndor Glass, Reddy Mikks y Terapia de radiación).
- **Explicar a detalle**: opcionalmente, una IA vía OpenRouter redacta la
  explicación de cada sección con lenguaje llano.

## Precisión

Los cálculos usan **aritmética racional exacta** con BigInt (sin errores de
punto flotante). Los resultados se contrastan de forma independiente contra la
librería `javascript-lp-solver` 1.0.3.

## Estructura

| Archivo | Rol |
|---|---|
| `js/fraction.js` | Fracciones exactas con BigInt y valores con Gran M |
| `js/linalg.js` | Álgebra matricial: inversa, productos, submatrices |
| `js/solver.js` | Estandarización del modelo y motor del Simplex Revisado |
| `js/dual.js` | Construcción del dual y comprobaciones de dualidad |
| `js/graphic.js` | Método gráfico y dibujo del SVG |
| `js/notebook.js` | Redacción de los pasos en formato hoja de cuaderno |
| `js/verify.js` | Verificación contra la librería externa |
| `js/vault.js` | Bóveda de ejercicios en localStorage |
| `js/ai.js` | Cliente de OpenRouter para las explicaciones |
| `js/app.js` | Interfaz y estado |

## Configurar la IA (opcional)

La calculadora resuelve sin IA. Para activar "explicar a detalle":

1. Crea una cuenta en [openrouter.ai](https://openrouter.ai).
2. Genera una API key en *Keys*.
3. Pulsa **OPENROUTER** en la app y pégala.

La clave se guarda únicamente en el localStorage de tu navegador; no se sube a
ningún lado ni queda en el código.

## Documentación

`documentacion/ejercicios-simplex-revisado.tex` — documento en LaTeX con la
explicación del método y tres ejercicios clásicos resueltos paso a paso. Se
compila con `pdflatex` y el PDF resultante está incluido.
