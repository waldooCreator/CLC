// Carga los módulos de la calculadora en Node, sin navegador.
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const FILES = ['fraction', 'linalg', 'solver', 'dual', 'verify', 'assign', 'maxflow', 'mincost', 'netmodel', 'netverify', 'vault', 'graphic', 'notebook', 'netdraw', 'netnotebook', 'ai'];

export function loadSX() {
  const ctx = createContext({ console });
  ctx.globalThis = ctx;
  const store = new Map([['sx.openrouter.key', 'sk-prueba'], ['sx.openrouter.model', 'modelo/prueba:free']]);
  ctx.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  ctx.location = { protocol: 'file:', origin: 'null' };
  // La IA usa fetch; en las pruebas se reemplaza por globalThis.__fetch (respuesta simulada).
  ctx.fetch = (...args) => globalThis.__fetch(...args);
  ctx.solver = createRequire(import.meta.url)('javascript-lp-solver');
  for (const f of FILES) {
    const path = join(here, '..', 'js', `${f}.js`);
    let src;
    try { src = readFileSync(path, 'utf8'); } catch { continue; }
    runInContext(src, ctx, { filename: path });
  }
  ctx.SX.UI = ctx.SX.UI || { esc: (s) => String(s) };
  ctx.SX.REL_TXT = ctx.SX.REL_TXT;
  return ctx.SX;
}
