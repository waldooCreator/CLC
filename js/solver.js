(function (root) {
  const SX = root.SX;
  const { Frac, MVal, LA } = SX;

  const FLIP = { '<=': '>=', '>=': '<=', '=': '=' };
  const REL_TXT = { '<=': '≤', '>=': '≥', '=': '=' };
  const MAX_ITER = 200;

  const absCoef = (f) => {
    const s = f.sign() < 0 ? f.neg() : f;
    if (s.isOne()) return '';
    return s.d === 1n ? s.toString() : `(${s})`;
  };

  function joinTerms(terms) {
    if (!terms.length) return '0';
    return terms.map((t, i) => (i === 0 ? (t.neg ? '-' : '') : t.neg ? ' - ' : ' + ') + t.body).join('');
  }

  const linearExpr = (coefs, names) =>
    joinTerms(coefs.flatMap((c, j) => (c.isZero() ? [] : [{ neg: c.sign() < 0, body: absCoef(c) + names[j] }])));

  const mLinearExpr = (coefs, names) =>
    joinTerms(coefs.flatMap((c, j) => {
      if (c.isZero()) return [];
      if (!c.hasM()) return [{ neg: c.a.sign() < 0, body: absCoef(c.a) + names[j] }];
      if (c.a.isZero()) return [{ neg: c.b.sign() < 0, body: `${absCoef(c.b)}M${names[j]}` }];
      return [{ neg: false, body: `(${c})${names[j]}` }];
    }));

  function standardize(model, method) {
    const isMin = model.sense === 'min';
    const notes = [];
    const rows = model.constraints.map((r, i) => {
      if (r.b.sign() < 0) {
        notes.push(`R${i + 1}: su lado derecho es negativo (${r.b}). Se multiplica toda la restricción por −1 y la desigualdad se invierte (${REL_TXT[r.rel]} → ${REL_TXT[FLIP[r.rel]]}).`);
        return { a: r.a.map((x) => x.neg()), rel: FLIP[r.rel], b: r.b.neg(), flipped: true };
      }
      return { a: [...r.a], rel: r.rel, b: r.b, flipped: false };
    });

    if (isMin) {
      notes.push('Minimizar Z es lo mismo que maximizar (−Z). Se cambian los signos de los coeficientes de la función objetivo y al final se vuelve a cambiar el signo del resultado.');
    }

    const columns = model.varNames.map((name, j) => ({
      name,
      kind: 'decision',
      cost: MVal.of(isMin ? model.c[j].neg() : model.c[j]),
    }));
    const A = rows.map((r) => [...r.a]);
    const basis = [];
    const artCost = method === 'bigM' ? new MVal(Frac.ZERO, Frac.ONE.neg()) : new MVal();

    const addCol = (col, row, val) => {
      columns.push({ ...col, row });
      A.forEach((line, i) => line.push(i === row ? val : Frac.ZERO));
      return columns.length - 1;
    };

    rows.forEach((r, i) => {
      const k = i + 1;
      if (r.rel === '<=') {
        basis[i] = addCol({ name: `s${k}`, kind: 'slack', cost: new MVal() }, i, Frac.ONE);
        notes.push(`R${k} (≤): se suma una variable de holgura s${k} ≥ 0 para convertirla en igualdad. s${k} entra a la base inicial.`);
      } else if (r.rel === '>=') {
        addCol({ name: `e${k}`, kind: 'surplus', cost: new MVal() }, i, Frac.ONE.neg());
        basis[i] = addCol({ name: `a${k}`, kind: 'artificial', cost: artCost }, i, Frac.ONE);
        notes.push(`R${k} (≥): se resta una variable de exceso e${k} ≥ 0 y se suma una artificial a${k} ≥ 0 (e${k} no sirve como básica inicial porque tiene coeficiente −1).`);
      } else {
        basis[i] = addCol({ name: `a${k}`, kind: 'artificial', cost: artCost }, i, Frac.ONE);
        notes.push(`R${k} (=): ya es igualdad, pero no tiene una variable básica natural; se suma una artificial a${k} ≥ 0.`);
      }
    });

    const hasArt = columns.some((c) => c.kind === 'artificial');
    if (hasArt && method === 'bigM') {
      notes.push('Método de la Gran M: cada artificial se penaliza en la función objetivo con coeficiente −M (M es un número muy grande), para que el método la saque de la base.');
    } else if (hasArt) {
      notes.push('Método de las Dos Fases: en la Fase 1 se maximiza W = −(suma de artificiales). Si al final W = 0 el problema es factible y la Fase 2 resuelve el objetivo original sin artificiales.');
    }

    const names = columns.map((c) => c.name);
    const equations = rows.map((r, i) => `${linearExpr(A[i], names)} = ${r.b}`);
    const objective = `Max ${isMin ? '(−Z)' : 'Z'} = ${mLinearExpr(columns.map((c) => c.cost), names)}`;

    return { rows, A, b: rows.map((r) => r.b), columns, names, basis, notes, isMin, method, equations, objective, hasArt };
  }

  function etaMatrix(alpha, r) {
    const m = alpha.length;
    const E = LA.identity(m);
    for (let i = 0; i < m; i++) {
      E[i][r] = i === r ? Frac.ONE.div(alpha[r]) : alpha[i].neg().div(alpha[r]);
    }
    return E;
  }

  function runRevised({ A, b, columns, costs, basis, Binv, allowed }) {
    basis = [...basis];
    const m = A.length;
    const iterations = [];
    const seen = new Set();
    let bland = false;

    for (let k = 0; k <= MAX_ITER; k++) {
      const it = { index: k, basis: [...basis], rule: bland ? 'bland' : 'dantzig' };
      it.B = LA.subMatrixByColumns(A, basis);
      it.Binv = Binv;
      it.xB = LA.matVec(Binv, b);
      it.cB = basis.map((j) => costs[j]);
      it.pi = LA.mRowTimesMat(it.cB, Binv);
      it.Z = LA.mDot(it.cB, it.xB);

      it.reduced = [];
      columns.forEach((_, j) => {
        if (basis.includes(j) || !allowed(j)) return;
        const z = LA.mDot(it.pi, LA.column(A, j));
        it.reduced.push({ j, z, zc: z.sub(costs[j]) });
      });

      const candidates = it.reduced.filter((r) => r.zc.sign() < 0);
      if (!candidates.length) {
        it.status = 'optimal';
        iterations.push(it);
        return { status: 'optimal', iterations, basis, Binv };
      }

      let enter = candidates[0];
      if (!bland) for (const c of candidates) if (c.zc.cmp(enter.zc) < 0) enter = c;
      it.entering = enter.j;
      it.alpha = LA.matVec(Binv, LA.column(A, enter.j));
      it.ratios = it.alpha.map((a, i) => (a.sign() > 0 ? it.xB[i].div(a) : null));

      let r = -1;
      it.ratios.forEach((ratio, i) => {
        if (ratio === null) return;
        if (r === -1) return void (r = i);
        const c = ratio.cmp(it.ratios[r]);
        if (c < 0 || (c === 0 && basis[i] < basis[r])) r = i;
      });

      if (r === -1) {
        it.status = 'unbounded';
        iterations.push(it);
        return { status: 'unbounded', iterations, basis, Binv };
      }

      it.leavingRow = r;
      it.leaving = basis[r];
      it.degenerate = it.ratios[r].isZero();
      it.E = etaMatrix(it.alpha, r);
      it.newBinv = LA.matMul(it.E, Binv);
      it.status = 'continue';
      iterations.push(it);

      Binv = it.newBinv;
      basis[r] = enter.j;
      const key = [...basis].sort((x, y) => x - y).join(',');
      if (seen.has(key)) bland = true;
      seen.add(key);
    }
    return { status: 'error', iterations, basis, Binv };
  }

  // Variables ≤ 0 o irrestrictas se sustituyen por variables ≥ 0.
  function expandSigns(model) {
    const signs = model.varSigns || model.varNames.map(() => '>=0');
    const varNames = [];
    const c = [];
    const cols = model.constraints.map(() => []);
    const groups = [];
    const notes = [];
    model.varNames.forEach((name, j) => {
      const push = (newName, f) => {
        varNames.push(newName);
        c.push(model.c[j].mul(f));
        model.constraints.forEach((r, k) => cols[k].push(r.a[j].mul(f)));
        return varNames.length - 1;
      };
      if (signs[j] === '<=0') {
        groups.push({ type: 'neg', name, idx: [push(`${name}'`, Frac.ONE.neg())] });
        notes.push(`${name} ≤ 0 → la cambio por ${name} = −${name}' con ${name}' ≥ 0 (a su columna le cambio los signos).`);
      } else if (signs[j] === 'free') {
        groups.push({ type: 'free', name, idx: [push(`${name}⁺`, Frac.ONE), push(`${name}⁻`, Frac.ONE.neg())] });
        notes.push(`${name} irrestricta → la cambio por ${name} = ${name}⁺ − ${name}⁻ con ${name}⁺ ≥ 0 y ${name}⁻ ≥ 0.`);
      } else {
        groups.push({ type: 'pos', name, idx: [push(name, Frac.ONE)] });
      }
    });
    return {
      changed: notes.length > 0,
      notes,
      groups,
      model: {
        sense: model.sense,
        varNames,
        c,
        constraints: model.constraints.map((r, k) => ({ a: cols[k], rel: r.rel, b: r.b })),
      },
      recover: (values) => groups.map((g) => {
        if (g.type === 'pos') return values[g.idx[0]];
        if (g.type === 'neg') return values[g.idx[0]].neg();
        return values[g.idx[0]].sub(values[g.idx[1]]);
      }),
    };
  }

  function solve(model, method = 'bigM') {
    const subst = expandSigns(model);
    const res = solveCore(subst.model, method);
    res.subst = subst;
    if (res.status === 'optimal') {
      const vals = subst.recover(res.solution.values);
      res.solution.decision = model.varNames.map((name, j) => ({ name, value: vals[j] }));
    }
    return res;
  }

  function solveCore(model, method) {
    const std = standardize(model, method);
    const { A, b, columns } = std;
    const m = A.length;
    const phases = [];
    let basis = [...std.basis];
    let Binv = LA.identity(m);
    let res;
    let costs;
    const warnings = [];
    const isArt = (j) => columns[j].kind === 'artificial';

    const artificialPositive = (bs, xB) => bs.some((j, i) => isArt(j) && xB[i].sign() > 0);

    if (method === 'bigM') {
      costs = columns.map((c) => c.cost);
      res = runRevised({ A, b, columns, costs, basis, Binv, allowed: () => true });
      phases.push({ key: 'bigM', title: std.hasArt ? 'Simplex Revisado · Gran M' : 'Simplex Revisado', costs, iterations: res.iterations });
      const last = res.iterations[res.iterations.length - 1];
      if (res.status === 'optimal' && artificialPositive(res.basis, last.xB)) {
        return { status: 'infeasible', std, phases, method, message: 'Al llegar al óptimo todavía hay variables artificiales con valor positivo en la base: el problema NO tiene solución factible.' };
      }
      if (res.status === 'unbounded' && artificialPositive(last.basis, last.xB)) {
        warnings.push('La dirección no acotada apareció con artificiales positivas en la base; verifica la factibilidad del modelo.');
      }
    } else {
      if (std.hasArt) {
        const costs1 = columns.map((c) => (c.kind === 'artificial' ? MVal.of(Frac.ONE.neg()) : new MVal()));
        const r1 = runRevised({ A, b, columns, costs: costs1, basis, Binv, allowed: () => true });
        const phase1 = { key: 'phase1', title: 'Fase 1 · Maximizar W = −Σ artificiales', costs: costs1, iterations: r1.iterations, adjustments: [] };
        phases.push(phase1);
        const last = r1.iterations[r1.iterations.length - 1];
        if (r1.status !== 'optimal' || last.Z.sign() < 0) {
          return { status: 'infeasible', std, phases, method, message: `La Fase 1 terminó con W = ${last.Z} < 0: no se pudieron eliminar las artificiales, así que el problema NO tiene solución factible.` };
        }
        basis = [...r1.basis];
        Binv = r1.Binv;
        for (let r = 0; r < m; r++) {
          if (!isArt(basis[r])) continue;
          const art = basis[r];
          const j = columns.findIndex((c, idx) => !isArt(idx) && !basis.includes(idx) &&
            !LA.matVec([Binv[r]], LA.column(A, idx))[0].isZero());
          if (j === -1) {
            phase1.adjustments.push({ type: 'redundant', row: r, col: art });
            continue;
          }
          const alpha = LA.matVec(Binv, LA.column(A, j));
          const E = etaMatrix(alpha, r);
          const newBinv = LA.matMul(E, Binv);
          phase1.adjustments.push({ type: 'pivotOut', row: r, from: art, to: j, alpha, E, newBinv });
          Binv = newBinv;
          basis[r] = j;
        }
      }
      costs = columns.map((c) => (c.kind === 'artificial' ? new MVal() : c.cost));
      res = runRevised({ A, b, columns, costs, basis, Binv, allowed: (j) => !isArt(j) });
      phases.push({ key: 'phase2', title: std.hasArt ? 'Fase 2 · Objetivo original' : 'Simplex Revisado', costs, iterations: res.iterations });
    }

    if (res.status === 'error') {
      return { status: 'error', std, phases, method, message: `Se superó el límite de ${MAX_ITER} iteraciones.` };
    }

    const last = res.iterations[res.iterations.length - 1];
    if (res.status === 'unbounded') {
      const name = columns[last.entering].name;
      return {
        status: 'unbounded', std, phases, method, warnings,
        message: `La variable ${name} puede entrar a la base, pero ningún elemento de la columna B⁻¹·a(${name}) es positivo: ${name} puede crecer sin límite y Z también. Solución NO ACOTADA.`,
      };
    }

    const values = columns.map(() => Frac.ZERO);
    last.basis.forEach((j, i) => (values[j] = last.xB[i]));
    const zStd = last.Z;
    const Z = std.isMin ? zStd.a.neg() : zStd.a;
    const duals = last.pi.map((p, i) => {
      let y = p.a;
      if (std.rows[i].flipped) y = y.neg();
      if (std.isMin) y = y.neg();
      return y;
    });
    const alternative = last.reduced.some((r) => r.zc.isZero() && !isArt(r.j));

    return {
      status: 'optimal', std, phases, method, warnings, alternative,
      solution: {
        values,
        decision: model.varNames.map((name, j) => ({ name, value: values[j] })),
        extra: columns.map((c, j) => ({ name: c.name, kind: c.kind, value: values[j] })).filter((c) => c.kind !== 'decision'),
        Z,
        zStd,
        duals,
        pi: last.pi,
      },
    };
  }

  SX.linearExpr = linearExpr;
  SX.mLinearExpr = mLinearExpr;
  SX.REL_TXT = REL_TXT;
  SX.solve = solve;
  SX.expandSigns = expandSigns;
})(typeof window !== 'undefined' ? window : globalThis);
