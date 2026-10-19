(function (root) {
  const SX = root.SX;
  const { Frac } = SX;

  const MAX_ITER = 500;

  // Lista de nodos en el orden en que aparecen (fuente primero, sumidero al final).
  function nodeOrder(arcs, first, last, extra = []) {
    const out = [];
    const add = (v) => { if (v !== undefined && v !== null && v !== '' && !out.includes(v)) out.push(v); };
    add(first);
    extra.forEach(add);
    arcs.forEach((a) => { add(a.from); add(a.to); });
    if (last !== undefined && out.includes(last)) out.push(out.splice(out.indexOf(last), 1)[0]);
    return out;
  }

  // Aristas residuales de cada arco: hacia adelante lo que falta por llenar, hacia atrás lo que se puede devolver.
  function residualEdges(arcs, flow) {
    const edges = [];
    arcs.forEach((a, k) => {
      const fwd = a.cap === null ? null : a.cap.sub(flow[k]);
      if (fwd === null || fwd.sign() > 0) edges.push({ arc: k, dir: 1, from: a.from, to: a.to, res: fwd });
      if (flow[k].sign() > 0) edges.push({ arc: k, dir: -1, from: a.to, to: a.from, res: flow[k] });
    });
    return edges;
  }

  // Camino con menos arcos (búsqueda en anchura), en orden fijo para que sea reproducible a mano.
  function bfs(nodes, edges, s, t) {
    const prev = new Map([[s, null]]);
    const queue = [s];
    while (queue.length) {
      const u = queue.shift();
      if (u === t) break;
      edges.filter((e) => e.from === u).forEach((e) => {
        if (prev.has(e.to)) return;
        prev.set(e.to, e);
        queue.push(e.to);
      });
    }
    if (!prev.has(t)) return { path: null, reach: [...prev.keys()] };
    const path = [];
    for (let v = t; v !== s; v = prev.get(v).from) path.unshift(prev.get(v));
    return { path, reach: [...prev.keys()] };
  }

  function solveMaxFlow(model) {
    const arcs = model.arcs.map((a) => ({ from: a.from, to: a.to, cap: a.cap === null ? null : Frac.of(a.cap) }));
    const { source: s, sink: t } = model;
    const nodes = nodeOrder(arcs, s, t, model.nodes || []);
    const flow = arcs.map(() => Frac.ZERO);
    const iterations = [];
    let total = Frac.ZERO;

    for (let k = 0; k < MAX_ITER; k++) {
      const edges = residualEdges(arcs, flow);
      const { path } = bfs(nodes, edges, s, t);
      if (!path) break;
      const finite = path.filter((e) => e.res !== null).map((e) => e.res);
      if (!finite.length) {
        return { status: 'unbounded', model, arcs, nodes, iterations, flow, total, message: `Hay un camino de ${s} a ${t} donde ningún arco tiene límite: el flujo puede crecer sin fin (NO ACOTADO).` };
      }
      const delta = finite.reduce((m, v) => (v.cmp(m) < 0 ? v : m));
      const before = [...flow];
      path.forEach((e) => { flow[e.arc] = e.dir === 1 ? flow[e.arc].add(delta) : flow[e.arc].sub(delta); });
      total = total.add(delta);
      iterations.push({
        index: k + 1,
        path: path.map((e) => ({ ...e })),
        nodes: [s, ...path.map((e) => e.to)],
        delta,
        before,
        after: [...flow],
        total,
        usesBack: path.some((e) => e.dir === -1),
      });
    }

    // Corte mínimo: los nodos que todavía se alcanzan desde la fuente.
    const { reach } = bfs(nodes, residualEdges(arcs, flow), s, null);
    const S = nodes.filter((v) => reach.includes(v));
    const T = nodes.filter((v) => !reach.includes(v));
    const cutArcs = arcs.map((a, k) => ({ ...a, k })).filter((a) => S.includes(a.from) && T.includes(a.to));
    const cutCap = cutArcs.reduce((acc, a) => acc.add(a.cap), Frac.ZERO);

    return {
      status: 'optimal', model, arcs, nodes, iterations, flow, total,
      cut: { S, T, arcs: cutArcs, cap: cutCap, ok: cutCap.cmp(total) === 0 },
    };
  }

  SX.nodeOrder = nodeOrder;
  SX.residualEdges = residualEdges;
  SX.solveMaxFlow = solveMaxFlow;
})(typeof window !== 'undefined' ? window : globalThis);
