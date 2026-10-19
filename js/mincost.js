(function (root) {
  const SX = root.SX;
  const { Frac } = SX;

  const MAX_ITER = 500;
  const SRC = 'S*';
  const SNK = 'T*';
  const DUMMY = 'Ficticio';

  // Ruta más barata en la red residual (Bellman-Ford: acepta los costos negativos de "devolver").
  function cheapest(nodes, edges, s) {
    const dist = new Map([[s, Frac.ZERO]]);
    const prev = new Map();
    for (let round = 0; round < nodes.length; round++) {
      let changed = false;
      edges.forEach((e) => {
        if (!dist.has(e.from)) return;
        const d = dist.get(e.from).add(e.cost);
        if (!dist.has(e.to) || d.cmp(dist.get(e.to)) < 0) {
          dist.set(e.to, d);
          prev.set(e.to, e);
          changed = true;
        }
      });
      if (!changed) return { dist, prev, negCycle: false };
    }
    return { dist, prev, negCycle: true };
  }

  function edgesOf(arcs, flow) {
    const out = [];
    arcs.forEach((a, k) => {
      const fwd = a.cap === null ? null : a.cap.sub(flow[k]);
      if (fwd === null || fwd.sign() > 0) out.push({ arc: k, dir: 1, from: a.from, to: a.to, res: fwd, cost: a.cost });
      if (flow[k].sign() > 0) out.push({ arc: k, dir: -1, from: a.to, to: a.from, res: flow[k], cost: a.cost.neg() });
    });
    return out;
  }

  function solveMinCost(model) {
    const supply = new Map();
    const order = [];
    const addNode = (id) => { if (!order.includes(id)) order.push(id); };
    (model.nodes || []).forEach((n) => { addNode(n.id); supply.set(n.id, Frac.of(n.supply || 0)); });
    const arcs = model.arcs.map((a) => ({ from: a.from, to: a.to, cap: a.cap === null ? null : Frac.of(a.cap), cost: Frac.of(a.cost), kind: 'real' }));
    arcs.forEach((a) => { addNode(a.from); addNode(a.to); });
    order.forEach((id) => { if (!supply.has(id)) supply.set(id, Frac.ZERO); });

    const nReal = arcs.length;
    const offer = order.filter((id) => supply.get(id).sign() > 0);
    const need = order.filter((id) => supply.get(id).sign() < 0);
    const S = offer.reduce((acc, id) => acc.add(supply.get(id)), Frac.ZERO);
    const D = need.reduce((acc, id) => acc.add(supply.get(id).neg()), Frac.ZERO);
    const notes = [];
    let dummy = null;

    if (S.cmp(D) > 0) {
      dummy = { id: DUMMY, supply: S.sub(D).neg(), side: 'demand' };
      offer.forEach((id) => arcs.push({ from: id, to: DUMMY, cap: null, cost: Frac.ZERO, kind: 'dummy' }));
      notes.push(`Se ofrece ${S} pero solo se pide ${D}. Se agrega un destino ficticio que "recibe" el sobrante (${S.sub(D)}) con costo 0: lo que llegue ahí en realidad se queda sin enviar.`);
    } else if (D.cmp(S) > 0) {
      dummy = { id: DUMMY, supply: D.sub(S), side: 'supply' };
      need.forEach((id) => arcs.push({ from: DUMMY, to: id, cap: null, cost: Frac.ZERO, kind: 'dummy' }));
      notes.push(`Se pide ${D} pero solo se ofrece ${S}. Se agrega un origen ficticio que "entrega" el faltante (${D.sub(S)}) con costo 0: lo que salga de él es demanda que se queda sin cubrir.`);
    }
    if (dummy) { order.push(DUMMY); supply.set(DUMMY, dummy.supply); }

    // Superfuente y supersumidero: juntan todas las ofertas y todas las demandas en un solo punto.
    order.forEach((id) => {
      const b = supply.get(id);
      if (b.sign() > 0) arcs.push({ from: SRC, to: id, cap: b, cost: Frac.ZERO, kind: 'super' });
      if (b.sign() < 0) arcs.push({ from: id, to: SNK, cap: b.neg(), cost: Frac.ZERO, kind: 'super' });
    });
    const all = [SRC, ...order, SNK];
    const goal = S.cmp(D) > 0 ? S : D;
    const flow = arcs.map(() => Frac.ZERO);
    const iterations = [];
    let sent = Frac.ZERO;
    let cost = Frac.ZERO;

    const base = { model, arcs, nReal, order, supply, notes, dummy, S, D };

    const first = cheapest(all, edgesOf(arcs, flow), SRC);
    if (first.negCycle) {
      return { ...base, status: 'error', iterations, flow, sent, cost, message: 'La red tiene un ciclo de costo negativo sin límite de capacidad: el costo puede bajar sin fin (NO ACOTADO).' };
    }

    for (let k = 0; k < MAX_ITER && sent.cmp(goal) < 0; k++) {
      const { dist, prev, negCycle } = cheapest(all, edgesOf(arcs, flow), SRC);
      if (negCycle) return { ...base, status: 'error', iterations, flow, sent, cost, message: 'Apareció un ciclo de costo negativo: revisa los datos.' };
      if (!dist.has(SNK)) break;
      const path = [];
      for (let v = SNK; v !== SRC; v = prev.get(v).from) path.unshift(prev.get(v));
      const finite = path.filter((e) => e.res !== null).map((e) => e.res);
      const delta = finite.reduce((m, v) => (v.cmp(m) < 0 ? v : m));
      const unit = dist.get(SNK);
      const before = [...flow];
      path.forEach((e) => { flow[e.arc] = e.dir === 1 ? flow[e.arc].add(delta) : flow[e.arc].sub(delta); });
      sent = sent.add(delta);
      cost = cost.add(unit.mul(delta));
      const inner = path.filter((e) => arcs[e.arc].kind !== 'super');
      iterations.push({
        index: k + 1,
        path: path.map((e) => ({ ...e })),
        inner,
        nodes: [path[0].to, ...inner.map((e) => e.to)],
        unit, delta, partial: unit.mul(delta), cost, sent,
        before, after: [...flow],
        usesBack: path.some((e) => e.dir === -1),
      });
    }

    if (sent.cmp(goal) < 0) {
      return { ...base, status: 'infeasible', iterations, flow, sent, cost, message: `Solo se pudieron mover ${sent} de ${goal} unidades: las capacidades no alcanzan. El problema NO tiene solución factible.` };
    }

    // Comprobación: en cada nodo, lo que sale menos lo que entra debe ser su oferta (o −demanda).
    const balance = order.map((id) => {
      let net = Frac.ZERO;
      arcs.forEach((a, k) => {
        if (a.kind === 'super') return;
        if (a.from === id) net = net.add(flow[k]);
        if (a.to === id) net = net.sub(flow[k]);
      });
      return { id, net, b: supply.get(id), ok: net.cmp(supply.get(id)) === 0 };
    });
    const realCost = arcs.slice(0, nReal).reduce((acc, a, k) => acc.add(a.cost.mul(flow[k])), Frac.ZERO);

    return { ...base, status: 'optimal', iterations, flow, sent, cost: realCost, balance };
  }

  SX.MC = { SRC, SNK, DUMMY };
  SX.solveMinCost = solveMinCost;
})(typeof window !== 'undefined' ? window : globalThis);
