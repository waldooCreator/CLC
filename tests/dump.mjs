// Imprime el cuaderno paso a paso de una memoria en texto plano (sirve para escribir los PDF).
// Uso: node tests/dump.mjs <número de memoria>
import { loadSX } from './load.mjs';

const SX = loadSX();
const p = SX.Vault.presets.find((x) => x.slot === Number(process.argv[2]));
if (!p) { console.error('Memoria no encontrada. Usa un número del 4 al 15.'); process.exit(1); }
let nb;
if (p.mode === 'assign') nb = SX.NetNB.assignNotebook(SX.solveAssignment(SX.NetModel.assignFromForm(p.form)));
else if (p.mode === 'maxflow') nb = SX.NetNB.maxflowNotebook(SX.solveMaxFlow(SX.NetModel.maxflowFromForm(p.form)), { layout: p.layout });
else if (p.mode === 'mincost') nb = SX.NetNB.mincostNotebook(SX.solveMinCost(SX.NetModel.mincostFromForm(p.form)), { layout: p.layout });
else { console.error('Esa memoria es del Simplex.'); process.exit(1); }
console.log(`# ${p.name} (${p.topic})\n`);
nb.sheets.forEach((sh) => {
  console.log(`## ${sh.title}`);
  sh.steps.forEach((st) => console.log(`\n### ${st.title}\n${st.lines.map((l) => {
    if (l.type === 'row') return `${l.text.trim()}${l.hint ? `   (${l.hint})` : ''}`.replace(/\[\/?(?:[rRpybk]|c\d)\]/g, '');
    if (l.type === 'hmatrix') return SX.NetNB.plainH(l);
    if (l.type === 'svg') return '(dibujo de la red)';
    return '';
  }).join('\n')}`));
  console.log('');
});
