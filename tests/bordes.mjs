// Casos borde de los algoritmos nuevos y de la explicación con IA (con una respuesta simulada).
// Uso: node tests/bordes.mjs
import { loadSX } from './load.mjs';

const SX = loadSX();
const F = (x) => SX.Frac.parse(String(x));
let bad = 0;
const ok = (cond, name, extra = '') => { console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`); if (!cond) bad++; };

const assign = (form) => {
  const model = SX.NetModel.assignFromForm(form);
  const res = SX.solveAssignment(model);
  const bf = SX.assignBruteForce(res);
  const chk = SX.NetLP.check('assign', model, res.total, res.status);
  return { res, bf, chk };
};
const sameAll = ({ res, bf, chk }) => bf.status === res.status && (res.status !== 'optimal' || bf.total.cmp(res.total) === 0) && chk.ok && chk.lib.ok !== false;

let r = assign({ sense: 'min', agents: ['A', 'B'], tasks: ['1', '2', '3'], cost: [['8', '4', '7'], ['5', '6', '9']] });
ok(sameAll(r) && r.res.total.cmp(F(9)) === 0, 'asignación: más tareas que agentes', `${r.res.total}`);
r = assign({ sense: 'min', agents: ['A', 'B', 'C'], tasks: ['1', '2'], cost: [['8', '4'], ['5', '6'], ['3', '9']] });
ok(sameAll(r) && r.res.total.cmp(F(7)) === 0, 'asignación: más agentes que tareas', `${r.res.total}`);
r = assign({ sense: 'min', agents: ['A', 'B'], tasks: ['1', '2'], cost: [['M', 'M'], ['1', '2']] });
ok(r.res.status === 'infeasible' && sameAll(r), 'asignación: fila toda prohibida → infactible', r.res.status);
r = assign({ sense: 'max', agents: ['A', 'B', 'C'], tasks: ['1', '2', '3'], cost: [['4', 'M', '6'], ['5', '3', 'M'], ['M', '7', '2']] });
ok(sameAll(r), 'asignación: maximizar con prohibidas', `${r.res.total}`);
r = assign({ sense: 'min', agents: ['A', 'B'], tasks: ['1', '2', '3', '4'], cost: [['1', '2', '3', '4'], ['4', '3', '2', '1']], capacity: ['2', '2'] });
ok(sameAll(r) && r.res.total.cmp(F(6)) === 0, 'asignación: capacidad 2 por agente', `${r.res.total}`);
r = assign({ sense: 'min', agents: ['A', 'B'], tasks: ['1', '2'], cost: [['1', '1'], ['1', '1']] });
ok(sameAll(r) && r.res.alternative, 'asignación: empate total → óptimos múltiples');
r = assign({ sense: 'min', agents: ['A', 'B', 'C'], tasks: ['1', '2', '3'], cost: [['1/2', '0.25', '3'], ['2', '1/3', '1'], ['0', '5', '2.5']] });
ok(sameAll(r), 'asignación: fracciones y decimales', `${r.res.total}`);

const flow = (arcs, s, t) => {
  const model = SX.NetModel.maxflowFromForm({ source: s, sink: t, arcs: arcs.split(';').map((x) => x.trim().split(/\s+/)) });
  const res = SX.solveMaxFlow(model);
  return { res, chk: SX.NetLP.check('maxflow', model, res.total, res.status) };
};
let f = flow('s a 3; b t 2', 's', 't');
ok(f.res.status === 'optimal' && f.res.total.isZero() && f.chk.ok, 'flujo máximo: sin camino → 0');
f = flow('s a 1; s b 1; a b 1; a t 1; b t 1', 's', 't');
ok(f.res.total.cmp(F(2)) === 0 && f.res.cut.ok && f.chk.ok, 'flujo máximo: red con camino que se cruza', `${f.res.total}`);
f = flow('s a 5; a s 2; a t 4; s t 1', 's', 't');
ok(f.res.total.cmp(F(5)) === 0 && f.chk.ok, 'flujo máximo: arco de regreso a la fuente', `${f.res.total}`);
f = flow('s a -; a t -', 's', 't');
ok(f.res.status === 'unbounded', 'flujo máximo: todo sin límite → no acotado', f.res.status);
try { flow('s a 3', 's', 'z'); ok(false, 'flujo máximo: sumidero inexistente da error'); } catch { ok(true, 'flujo máximo: sumidero inexistente da error'); }

const mc = (nodes, arcs, undirected = false) => {
  const model = SX.NetModel.mincostFromForm({ undirected, nodes, arcs: arcs.split(';').map((x) => x.trim().split(/\s+/)) });
  const res = SX.solveMinCost(model);
  return { res, chk: SX.NetLP.check('mincost', model, res.cost, res.status) };
};
let m = mc([['A', '40'], ['B', '-15'], ['C', '-10']], 'A B 20 2; A C - 5; B C 10 1');
ok(m.res.status === 'optimal' && m.chk.ok && m.chk.lib.ok !== false, 'costo mínimo: oferta > demanda (ficticio)', `${m.res.cost}`);
m = mc([['A', '10'], ['B', '-25']], 'A B - 3');
ok(m.res.status === 'optimal' && m.res.cost.cmp(F(30)) === 0 && m.chk.ok, 'costo mínimo: demanda > oferta (demanda sin cubrir)', `${m.res.cost}`);
m = mc([['A', '10'], ['B', '-10']], 'A B 4 3');
ok(m.res.status === 'infeasible' && m.chk.ok, 'costo mínimo: capacidad insuficiente → infactible', m.res.status);
m = mc([['A', '5'], ['C', '-5']], 'A B - 2; B C - 2; A C - 7', true);
ok(m.res.status === 'optimal' && m.res.cost.cmp(F(20)) === 0 && m.chk.ok, 'costo mínimo: red no dirigida', `${m.res.cost}`);
m = mc([['A', '5'], ['C', '-5']], 'A B 3 -2; B C - 1; A C - 4');
ok(m.res.status === 'optimal' && m.chk.ok, 'costo mínimo: costo negativo', `${m.res.cost}`);

// IA: se simula la respuesta de OpenRouter y se revisa que cada paso reciba su explicación.
for (const [kind, nb] of [
  ['assign', SX.NetNB.assignNotebook(SX.solveAssignment(SX.NetModel.assignFromForm(SX.Vault.presets.find((p) => p.slot === 6).form)))],
  ['maxflow', SX.NetNB.maxflowNotebook(SX.solveMaxFlow(SX.NetModel.maxflowFromForm(SX.Vault.presets.find((p) => p.slot === 11).form)))],
  ['mincost', SX.NetNB.mincostNotebook(SX.solveMinCost(SX.NetModel.mincostFromForm(SX.Vault.presets.find((p) => p.slot === 14).form)))],
]) {
  const steps = SX.NB.forAI(nb);
  let sentSystem = '';
  globalThis.__fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    sentSystem = body.messages[0].content;
    const pasos = steps.map((_, i) => ({ paso: i + 1, explicacion: `Explicación ${i + 1} del paso.` }));
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({ pasos, resumen: 'Resumen final.' }) } }] }) };
  };
  const out = await SX.AI.comment(kind, steps);
  ok(out.explained === steps.length && out.comments.final && sentSystem.includes(kind === 'assign' ? 'húngaro' : kind === 'maxflow' ? 'flujo máximo' : 'costo mínimo'),
    `IA: explica todos los pasos de ${kind}`, `${out.explained}/${steps.length}`);
}

console.log(bad ? `\n${bad} casos fallaron.` : '\nTodos los casos borde pasan.');
process.exit(bad ? 1 : 0);
