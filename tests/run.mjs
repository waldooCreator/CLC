// Prueba que la calculadora da lo mismo que los PDF de documentacion/ en todos los ejercicios.
// Uso: node tests/run.mjs   (sale con código 1 si algo no coincide)
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadSX } from './load.mjs';

const SX = loadSX();
const { Frac } = SX;
const DOCS = join(dirname(fileURLToPath(import.meta.url)), '..', 'documentacion');
let failures = 0;
const rows = [];

function simplexModel(f) {
  const P = (s) => (String(s).trim() === '' ? Frac.ZERO : Frac.parse(s));
  return {
    sense: f.sense,
    varNames: f.c.map((_, j) => `x${j + 1}`),
    varSigns: f.signs,
    c: f.c.map(P),
    constraints: f.rows.map(([a, rel, b]) => ({ a: a.map(P), rel, b: P(b) })),
  };
}

// Corre el ejercicio con el algoritmo de su tema y lo contrasta con el PL, la librería y la fuerza bruta.
function solvePreset(p) {
  const checks = [];
  let value;
  let status;
  if (p.mode === 'simplex') {
    const model = simplexModel(p.form);
    const res = SX.solve(model, p.form.method);
    status = res.status;
    value = res.solution.Z;
    const lib = SX.verify(model, res, 'Z');
    checks.push(['librería', lib.ok === true, lib.text]);
  } else if (p.mode === 'assign') {
    const model = SX.NetModel.assignFromForm(p.form);
    const res = SX.solveAssignment(model);
    status = res.status;
    value = res.total;
    const bf = SX.assignBruteForce(res);
    checks.push(['fuerza bruta', bf.status === status && bf.total.cmp(value) === 0, `${bf.total}`]);
    const chk = SX.NetLP.check('assign', model, value, status);
    checks.push(['PL + Simplex', chk.ok, chk.text], ['librería', chk.lib.ok === true, chk.lib.text]);
  } else if (p.mode === 'maxflow') {
    const model = SX.NetModel.maxflowFromForm(p.form);
    const res = SX.solveMaxFlow(model);
    status = res.status;
    value = res.total;
    checks.push(['corte mínimo', res.cut.ok, `capacidad del corte ${res.cut.cap}`]);
    const chk = SX.NetLP.check('maxflow', model, value, status);
    checks.push(['PL + Simplex', chk.ok, chk.text], ['librería', chk.lib.ok === true, chk.lib.text]);
  } else {
    const model = SX.NetModel.mincostFromForm(p.form);
    const res = SX.solveMinCost(model);
    status = res.status;
    value = res.cost;
    checks.push(['conservación', res.balance.every((b) => b.ok), 'oferta y demanda de cada nodo']);
    const chk = SX.NetLP.check('mincost', model, value, status);
    checks.push(['PL + Simplex', chk.ok, chk.text], ['librería', chk.lib.ok === true, chk.lib.text]);
  }
  return { value, status, checks };
}

// Busca el \res{...} número k del PDF del tema y revisa que traiga el mismo valor.
function docValue(p, k) {
  const group = SX.Vault.groups.find((g) => g.key === p.group);
  const tex = join(DOCS, group.doc.replace(/\.pdf$/, '.tex'));
  if (!existsSync(tex)) return [false, `falta ${group.doc.replace(/\.pdf$/, '.tex')}`];
  const src = readFileSync(tex, 'utf8');
  const blocks = [...src.matchAll(/\\res\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}/g)].map((m) => m[1]);
  if (!blocks[k]) return [false, `el documento no tiene el resultado ${k + 1}`];
  const norm = blocks[k].replace(/\\[,;! ]|\\quad|\\qquad|~/g, '').replace(/\s+/g, '');
  const val = Frac.parse(p.expected.value);
  const forms = [val.toString(), val.toDecimal(4)];
  if (val.d !== 1n) forms.push(`\\tfrac{${val.n}}{${val.d}}`, `\\frac{${val.n}}{${val.d}}`);
  const hit = forms.some((f) => new RegExp(`(^|[^0-9.])${f.replace(/[\\{}.]/g, '\\$&')}($|[^0-9])`).test(norm));
  return [hit, hit ? `el PDF dice ${p.expected.value}` : `el PDF dice: ${blocks[k]}`];
}

const byGroup = {};
for (const p of SX.Vault.presets) {
  const k = (byGroup[p.group] = (byGroup[p.group] ?? -1) + 1);
  let out;
  try {
    out = solvePreset(p);
  } catch (err) {
    out = { status: 'error', value: null, checks: [['ejecución', false, err.message]] };
  }
  const same = out.value && out.value.cmp(Frac.parse(p.expected.value)) === 0;
  const checks = [['valor esperado', Boolean(same), `${out.value} vs ${p.expected.value}`], ...out.checks, ['documento', ...docValue(p, k)]];
  const ok = checks.every((c) => c[1]);
  if (!ok) failures++;
  rows.push({ ok, p, out, checks });
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad('', 3)}${pad('#', 4)}${pad('Ejercicio', 30)}${pad('Tema', 10)}${pad('Óptimo', 10)}Comprobaciones`);
for (const { ok, p, out, checks } of rows) {
  console.log(`${ok ? '✓' : '✗'}  ${pad(p.slot, 4)}${pad(p.name, 30)}${pad(p.group, 10)}${pad(out.value ?? '—', 10)}${checks.map((c) => `${c[1] ? '✓' : '✗'} ${c[0]}`).join(' · ')}`);
  checks.filter((c) => !c[1]).forEach((c) => console.log(`      ✗ ${c[0]}: ${c[2]}`));
}
console.log(`\n${rows.length - failures}/${rows.length} ejercicios coinciden en todo.`);
process.exit(failures ? 1 : 0);
