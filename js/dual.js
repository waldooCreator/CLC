(function (root) {
  const SX = root.SX;
  const { Frac } = SX;

  const SIGN_TXT = { '>=0': '≥ 0', '<=0': '≤ 0', free: 'irrestricta' };

  // Filas de la tabla de dualidad (lado MAX ↔ lado MIN).
  const TABLE = [
    { group: 'VARIABLES', max: '≥ 0', min: '≥', minGroup: 'RESTRICCIONES' },
    { group: '', max: '≤ 0', min: '≤', minGroup: '' },
    { group: '', max: 'irrestricta', min: '=', minGroup: '' },
    { group: 'RESTRICCIONES', max: '≤', min: '≥ 0', minGroup: 'VARIABLES' },
    { group: '', max: '≥', min: '≤ 0', minGroup: '' },
    { group: '', max: '=', min: 'irrestricta', minGroup: '' },
  ];

  function buildDual(model) {
    const isMax = model.sense === 'max';
    const pSigns = model.varSigns || model.varNames.map(() => '>=0');
    const varRule = isMax ? { '<=': '>=0', '>=': '<=0', '=': 'free' } : { '>=': '>=0', '<=': '<=0', '=': 'free' };
    const conRule = isMax ? { '>=0': '>=', '<=0': '<=', free: '=' } : { '>=0': '<=', '<=0': '>=', free: '=' };
    const rowVar = isMax ? { '>=0': 0, '<=0': 1, free: 2 } : { '>=0': 3, '<=0': 4, free: 5 };
    const rowCon = isMax ? { '<=': 3, '>=': 4, '=': 5 } : { '>=': 0, '<=': 1, '=': 2 };
    const varNames = model.constraints.map((_, i) => `y${i + 1}`);

    const dual = {
      sense: isMax ? 'min' : 'max',
      varNames,
      varSigns: model.constraints.map((r) => varRule[r.rel]),
      c: model.constraints.map((r) => r.b),
      constraints: model.varNames.map((_, j) => ({
        a: model.constraints.map((r) => r.a[j]),
        rel: conRule[pSigns[j]],
        b: model.c[j],
      })),
      primalSigns: pSigns,
      rowForVar: pSigns.map((s) => rowVar[s]),
      rowForCon: model.constraints.map((r) => rowCon[r.rel]),
    };

    const R = SX.REL_TXT;
    dual.rules = [
      `El primal es de ${isMax ? 'MAXIMIZACIÓN' : 'MINIMIZACIÓN'}, así que el dual es de ${isMax ? 'MINIMIZACIÓN' : 'MAXIMIZACIÓN'}.`,
      `Cada restricción del primal da una variable dual: ${varNames.join(', ')}.`,
      `Cada variable del primal da una restricción del dual (${model.varNames.length} en total).`,
      `Los lados derechos del primal (${model.constraints.map((r) => r.b).join(', ')}) son los coeficientes de W.`,
      `Los coeficientes de Z (${model.c.join(', ')}) son los lados derechos del dual.`,
      'La matriz A se transpone: cada columna del primal se vuelve una fila del dual.',
      ...model.varNames.map((x, j) => `${x} ${SIGN_TXT[pSigns[j]]} → la restricción D${j + 1} del dual es "${R[dual.constraints[j].rel]}".`),
      ...model.constraints.map((r, i) => `R${i + 1} es "${R[r.rel]}" → y${i + 1} ${SIGN_TXT[dual.varSigns[i]]}.`),
    ];
    return dual;
  }

  function solveDuality(model, method) {
    const primal = SX.solve(model, method);
    const dual = buildDual(model);
    const dualRes = SX.solve(dual, method);
    const out = { primal, dual, dualRes, conv: dualRes.subst };

    if (primal.status === 'optimal' && dualRes.status === 'optimal') {
      const x = primal.solution.decision.map((d) => d.value);
      const y = dualRes.solution.decision.map((d) => d.value);
      const primalSlack = model.constraints.map((r) =>
        r.b.sub(r.a.reduce((acc, a, j) => acc.add(a.mul(x[j])), Frac.ZERO)));
      const dualSurplus = model.varNames.map((_, j) =>
        model.constraints.reduce((acc, r, i) => acc.add(r.a[j].mul(y[i])), Frac.ZERO).sub(model.c[j]));
      out.check = {
        x, y,
        Z: primal.solution.Z,
        W: dualRes.solution.Z,
        strong: primal.solution.Z.cmp(dualRes.solution.Z) === 0,
        yFromPrimal: primal.solution.duals,
        sameY: y.every((v, i) => v.cmp(primal.solution.duals[i]) === 0),
        cs1: model.constraints.map((_, i) => ({ y: y[i], slack: primalSlack[i], prod: y[i].mul(primalSlack[i]) })),
        cs2: model.varNames.map((name, j) => ({ name, x: x[j], surplus: dualSurplus[j], prod: x[j].mul(dualSurplus[j]) })),
      };
    } else {
      const P = primal.status, D = dualRes.status;
      if (P === 'unbounded') out.theory = 'El primal es NO ACOTADO; por el teorema de dualidad, el dual NO tiene solución factible.';
      else if (D === 'unbounded') out.theory = 'El dual es NO ACOTADO; por el teorema de dualidad, el primal NO tiene solución factible.';
      else if (P === 'infeasible' && D === 'infeasible') out.theory = 'Tanto el primal como el dual son infactibles (caso posible en la teoría de dualidad).';
      else out.theory = 'Si uno de los dos problemas no tiene óptimo, el otro tampoco puede tener un óptimo finito.';
    }
    return out;
  }

  SX.SIGN_TXT = SIGN_TXT;
  SX.DUAL_TABLE = TABLE;
  SX.buildDual = buildDual;
  SX.solveDuality = solveDuality;
})(typeof window !== 'undefined' ? window : globalThis);
