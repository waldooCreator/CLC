(function (root) {
  const SX = root.SX;
  const { Frac } = SX;

  const isForbidden = (s) => /^(m|-|x|—|–)$/i.test(String(s).trim());

  // Lee un número del formulario; `where` dice qué celda marcar si está mal escrito.
  function num(value, where, { allowEmpty = true, emptyValue = Frac.ZERO } = {}) {
    const s = String(value ?? '').trim();
    if (s === '') {
      if (allowEmpty) return emptyValue;
      throw Object.assign(new Error(`Falta un valor en ${where.label}.`), { where });
    }
    try {
      return Frac.parse(s);
    } catch {
      throw Object.assign(new Error(`"${s}" no es un número válido (${where.label}). Usa 3, 0.5 o 3/4.`), { where });
    }
  }

  const clean = (s) => String(s ?? '').trim();

  function assignFromForm(f) {
    const agents = f.agents.map((a, i) => clean(a) || `A${i + 1}`);
    const tasks = f.tasks.map((t, j) => clean(t) || `T${j + 1}`);
    const cost = f.cost.map((row, i) => row.map((v, j) => (isForbidden(v) ? null
      : num(v, { kind: 'cost', i, j, label: `fila ${agents[i]}, columna ${tasks[j]}` }))));
    const capacity = agents.map((_, i) => {
      const v = f.capacity && clean(f.capacity[i]);
      if (!v) return 1;
      const k = Number(v);
      if (!Number.isInteger(k) || k < 1 || k > 10) {
        throw Object.assign(new Error(`La capacidad de ${agents[i]} debe ser un entero entre 1 y 10.`), { where: { kind: 'cap', i } });
      }
      return k;
    });
    const dup = (list, what) => { const d = list.find((x, k) => list.indexOf(x) !== k); if (d) throw new Error(`Hay dos ${what} llamados "${d}".`); };
    dup(agents, 'agentes');
    dup(tasks, 'tareas');
    return { sense: f.sense === 'max' ? 'max' : 'min', agents, tasks, cost, capacity };
  }

  function arcsFromForm(rows, withCost) {
    const arcs = rows
      .map((r, k) => ({ r, k }))
      .filter(({ r }) => clean(r[0]) || clean(r[1]))
      .map(({ r, k }) => {
        const from = clean(r[0]);
        const to = clean(r[1]);
        if (!from || !to) throw Object.assign(new Error(`El arco ${k + 1} necesita nodo de origen y de destino.`), { where: { kind: 'arc', k } });
        if (from === to) throw Object.assign(new Error(`El arco ${k + 1} va de ${from} a sí mismo.`), { where: { kind: 'arc', k } });
        const capTxt = clean(r[2]);
        const cap = capTxt === '' || /^(inf|∞|-)$/i.test(capTxt) ? null : num(capTxt, { kind: 'arc', k, col: 2, label: `capacidad del arco ${from}→${to}` });
        if (cap && cap.sign() < 0) throw Object.assign(new Error(`La capacidad del arco ${from}→${to} no puede ser negativa.`), { where: { kind: 'arc', k, col: 2 } });
        const arc = { from, to, cap };
        if (withCost) arc.cost = num(r[3], { kind: 'arc', k, col: 3, label: `costo del arco ${from}→${to}` });
        return arc;
      });
    if (!arcs.length) throw new Error('Escribe al menos un arco.');
    return arcs;
  }

  function maxflowFromForm(f) {
    const arcs = arcsFromForm(f.arcs, false);
    const source = clean(f.source);
    const sink = clean(f.sink);
    const names = new Set(arcs.flatMap((a) => [a.from, a.to]));
    if (!names.has(source)) throw new Error(`La fuente "${source}" no aparece en ningún arco.`);
    if (!names.has(sink)) throw new Error(`El sumidero "${sink}" no aparece en ningún arco.`);
    if (source === sink) throw new Error('La fuente y el sumidero deben ser nodos distintos.');
    return { arcs, source, sink };
  }

  function mincostFromForm(f) {
    const arcs = arcsFromForm(f.arcs, true);
    const nodes = f.nodes
      .map((r, k) => ({ r, k }))
      .filter(({ r }) => clean(r[0]))
      .map(({ r, k }) => ({ id: clean(r[0]), supply: num(r[1], { kind: 'node', k, label: `oferta/demanda de ${clean(r[0])}` }) }));
    if (!nodes.some((n) => n.supply.sign() > 0)) throw new Error('Ningún nodo ofrece unidades: escribe al menos una oferta positiva.');
    if (!nodes.some((n) => n.supply.sign() < 0)) throw new Error('Ningún nodo pide unidades: escribe al menos una demanda negativa.');
    const names = new Set(arcs.flatMap((a) => [a.from, a.to]));
    const lost = nodes.find((n) => !names.has(n.id) && !n.supply.isZero());
    if (lost) throw new Error(`El nodo ${lost.id} tiene oferta o demanda pero ningún arco lo toca.`);
    // Red no dirigida: cada conexión se puede recorrer en los dos sentidos con el mismo costo.
    if (f.undirected) return { nodes, arcs: [...arcs, ...arcs.map((a) => ({ ...a, from: a.to, to: a.from }))], undirected: arcs.length };
    return { nodes, arcs };
  }

  SX.NetModel = { assignFromForm, maxflowFromForm, mincostFromForm, isForbidden };
})(typeof window !== 'undefined' ? window : globalThis);
