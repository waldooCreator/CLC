(function (root) {
  const SX = root.SX;
  const { Frac } = SX;
  const ONE = Frac.ONE;
  const ZERO = Frac.ZERO;

  const row = (n, entries) => {
    const a = Array.from({ length: n }, () => ZERO);
    entries.forEach(([j, v]) => { a[j] = a[j].add(v); });
    return a;
  };

  // Asignación como PL: x(i,j) = 1 si el agente i hace la tarea j (sin celdas prohibidas).
  function assignLP(model) {
    const cap = model.agents.map((_, i) => Math.max(1, (model.capacity && model.capacity[i]) | 0 || 1));
    const vars = [];
    model.cost.forEach((r, i) => r.forEach((v, j) => { if (v !== null) vars.push({ i, j, c: Frac.of(v) }); }));
    const n = vars.length;
    const R = cap.reduce((a, b) => a + b, 0);
    const C = model.tasks.length;
    const constraints = [
      ...model.agents.map((_, i) => ({
        a: row(n, vars.map((v, k) => [k, v.i === i ? ONE : ZERO])),
        rel: R > C ? '<=' : '=',
        b: new Frac(BigInt(cap[i])),
      })),
      ...model.tasks.map((_, j) => ({
        a: row(n, vars.map((v, k) => [k, v.j === j ? ONE : ZERO])),
        rel: R < C ? '<=' : '=',
        b: ONE,
      })),
    ];
    return {
      sense: model.sense,
      varNames: vars.map((v) => `x${v.i + 1}${v.j + 1}`),
      c: vars.map((v) => v.c),
      constraints,
    };
  }

  // Flujo máximo como PL: maximizar lo que sale de la fuente respetando capacidades y conservación.
  function maxflowLP(model) {
    const arcs = model.arcs;
    const n = arcs.length;
    const nodes = SX.nodeOrder(arcs, model.source, model.sink, model.nodes || []);
    const c = arcs.map((a) => (a.from === model.source ? ONE : a.to === model.source ? ONE.neg() : ZERO));
    const constraints = [];
    arcs.forEach((a, k) => { if (a.cap !== null) constraints.push({ a: row(n, [[k, ONE]]), rel: '<=', b: Frac.of(a.cap) }); });
    nodes.filter((v) => v !== model.source && v !== model.sink).forEach((v) => {
      constraints.push({ a: row(n, arcs.flatMap((a, k) => [...(a.to === v ? [[k, ONE]] : []), ...(a.from === v ? [[k, ONE.neg()]] : [])])), rel: '=', b: ZERO });
    });
    return { sense: 'max', varNames: arcs.map((a) => `f(${a.from},${a.to})`), c, constraints };
  }

  // Costo mínimo como PL: lo que sale menos lo que entra en cada nodo es su oferta (o −demanda).
  function mincostLP(model) {
    const arcs = model.arcs;
    const n = arcs.length;
    const nodes = [];
    (model.nodes || []).forEach((x) => { if (!nodes.includes(x.id)) nodes.push(x.id); });
    arcs.forEach((a) => { [a.from, a.to].forEach((v) => { if (!nodes.includes(v)) nodes.push(v); }); });
    const b = (id) => { const x = (model.nodes || []).find((y) => y.id === id); return x ? Frac.of(x.supply || 0) : ZERO; };
    const S = nodes.reduce((acc, id) => (b(id).sign() > 0 ? acc.add(b(id)) : acc), ZERO);
    const D = nodes.reduce((acc, id) => (b(id).sign() < 0 ? acc.sub(b(id)) : acc), ZERO);
    const constraints = [];
    arcs.forEach((a, k) => { if (a.cap !== null) constraints.push({ a: row(n, [[k, ONE]]), rel: '<=', b: Frac.of(a.cap) }); });
    nodes.forEach((v) => {
      const bv = b(v);
      let rel = '=';
      if (S.cmp(D) > 0 && bv.sign() > 0) rel = '<=';
      if (D.cmp(S) > 0 && bv.sign() < 0) rel = '>=';
      constraints.push({ a: row(n, arcs.flatMap((a, k) => [...(a.from === v ? [[k, ONE]] : []), ...(a.to === v ? [[k, ONE.neg()]] : [])])), rel, b: bv });
    });
    return { sense: 'min', varNames: arcs.map((a) => `f(${a.from},${a.to})`), c: arcs.map((a) => Frac.of(a.cost)), constraints };
  }

  // Resuelve el PL con el Simplex Revisado exacto y con la librería externa, y compara con el algoritmo.
  function check(kind, model, value, status = 'optimal') {
    const lp = kind === 'assign' ? assignLP(model) : kind === 'maxflow' ? maxflowLP(model) : mincostLP(model);
    let simplex;
    try {
      simplex = SX.solve(lp, 'bigM');
    } catch (err) {
      simplex = { status: 'error', message: err.message };
    }
    const sameStatus = simplex.status === status || (status !== 'optimal' && simplex.status !== 'optimal');
    const sameValue = status !== 'optimal' || (simplex.status === 'optimal' && simplex.solution.Z.cmp(value) === 0);
    const lib = SX.verify(lp, status === 'optimal' ? { status, solution: { Z: value } } : { status: simplex.status }, 'Z');
    return {
      lp,
      simplex,
      ok: sameStatus && sameValue,
      lib,
      text: simplex.status === 'optimal' ? `el Simplex Revisado sobre el modelo de PL da Z* = ${simplex.solution.Z}` : `el Simplex Revisado sobre el modelo de PL dice: ${simplex.status}`,
    };
  }

  // Aviso que solo aparece si algo no coincide (igual que en el Simplex).
  function badge(chk) {
    const parts = [];
    if (!chk.ok) parts.push(`<p class="verify badge-bad"><span>✗ NO COINCIDE · PL</span>${SX.UI.esc(chk.text)}</p>`);
    parts.push(SX.verifyBadge(chk.lib, 'LIBRERÍA'));
    return parts.join('');
  }

  SX.NetLP = { assignLP, maxflowLP, mincostLP, check, badge };
})(typeof window !== 'undefined' ? window : globalThis);
